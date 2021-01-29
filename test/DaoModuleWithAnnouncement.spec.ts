import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { increaseBlockTime } from "./utils";
import { BigNumber } from "ethers";

describe("DaoModuleWithAnnouncement", async () => {

    const baseSetup = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const Mock = await hre.ethers.getContractFactory("MockContract");
        const mock = await Mock.deploy();
        const oracle = await hre.ethers.getContractAt("Realitio", mock.address);
        return { Executor, executor, module, mock, oracle };
    })

    const setupTestWithTestExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("DaoModuleWithAnnouncement");
        const module = await Module.deploy(base.executor.address, base.mock.address, 42, 23, 0, 1337);
        return { ...base, Module, module };
    })

    const setupTestWithMockExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("DaoModuleWithAnnouncement");
        const module = await Module.deploy(base.mock.address, base.mock.address, 42, 23, 0, 1337);
        return { ...base, Module, module };
    })
    const [user1] = waffle.provider.getWallets();

    describe("addProposal", async () => {
        it("throws if unexpected question id is returned", async () => {
            const { module, mock, oracle } = await setupTestWithTestExecutor();
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), 42)
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.addProposal(id, [txHash])
            ).to.be.revertedWith("Unexpected question id");
        })

        it("calls askQuestion with correct data", async () => {
            const { module, mock, oracle } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])
            
            const askQuestionCalldata = oracle.interface.encodeFunctionData("askQuestion", [1337, question, module.address, 42, 0, 0])
            expect(
                (await mock.callStatic.invocationCountForCalldata(askQuestionCalldata)).toNumber()
            ).to.be.equals(1);
            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1);
        })
    })

    describe("requestProposalReadyForExecution", async () => {
        it("throws if module is not enabled", async () => {
            const { mock, module, executor } = await setupTestWithMockExecutor();
            await mock.givenMethodReturnBool(executor.interface.getSighash("execTransactionFromModule"), false)
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            await expect(
                module.requestProposalReadyForExecution(id, [txHash])
            ).to.be.revertedWith("Could not mark proposal ready for execution");
        })
        
        it("calls executor to mark proposal as ready", async () => {
            const { module, mock, executor } = await setupTestWithMockExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await mock.givenMethodReturnBool(executor.interface.getSighash("execTransactionFromModule"), true)
            await module.requestProposalReadyForExecution(id, [txHash])
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )
            const execCallData = executor.interface.encodeFunctionData(
                "execTransactionFromModule", 
                [module.address, 0, markProposalReadyForExecutionData, 0]
            )
            expect(
                (await mock.callStatic.invocationCountForCalldata(execCallData)).toNumber()
            ).to.be.equals(1);
            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1);
        })
    })

    describe("markProposalReadyForExecution", async () => {

        it("throws if not called by executor", async () => {
            const { module } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            await expect(
                module.markProposalReadyForExecution(id, [txHash])
            ).to.be.revertedWith("Not authorized to mark proposal as ready");
        })

        it("throws if question not resolved", async () => {
            const { mock, module, executor, oracle } = await setupTestWithTestExecutor();
            await mock.givenMethodRevert(oracle.interface.getSighash("resultFor"))
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )

            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData)
            ).to.be.reverted;
        })

        it("throws if question not resolved to true", async () => {
            const { mock, module, executor, oracle } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), false)
            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData)
            ).to.be.revertedWith("Transaction was not approved");

            await mock.givenMethodReturnUint(oracle.interface.getSighash("resultFor"), 2)
            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData)
            ).to.be.revertedWith("Transaction was not approved");

            await mock.givenMethodReturnUint(oracle.interface.getSighash("resultFor"), "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData)
            ).to.be.revertedWith("Transaction was not approved");
        })

        it.skip("throws if minimum bond was not reached", async () => {
        })

        it("throws if question was already marked ready", async () => {
            const { mock, module, executor, oracle } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)

            await executor.exec(module.address, 0, markProposalReadyForExecutionData)

            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData)
            ).to.be.revertedWith("Transaction was already marked as ready");
        })
        
        it("to emit event when successful", async () => {
            const { mock, module, executor, oracle } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )
            
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            let announceTx: any;

            await expect(
                executor.exec(module.address, 0, markProposalReadyForExecutionData).then((tx: any) => announceTx = tx)
            ).to.emit(module, "ExecutionAnnouncement")
            // TODO: check event args

            const block = await ethers.provider.getBlock(announceTx!!.blockHash)
            expect(
                (await module.executionAnnouncements(questionId, question)).toNumber()
            ).to.be.equals(block.timestamp)

            // We do no changing calls
            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(0);
        })
    })

    describe("executeProposal", async () => {
        it("throws if tx was not approved", async () => {
            const { mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: mock.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), false)

            
            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Transaction was not approved");
        })

        it.skip("throws if bond was not high enough", async () => {
        })

        it("throws if tx data doesn't belong to proposal", async () => {
            const { mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: mock.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)

            
            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 1)
            ).to.be.revertedWith("Unexpected transaction hash");
        })

        it("throws if proposal not marked as ready", async () => {
            const { mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: mock.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)

            
            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Proposal execution has not been marked as ready");
        })

        it.skip("throws if proposal has been invalidated", async () => {
        })

        it("throws if proposal cooldown is not over", async () => {
            const { mock, executor, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: mock.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await executor.setModule(module.address)
            await module.requestProposalReadyForExecution(id, [txHash])

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Wait for additional cooldown");
        })

        it.skip("throws if previous tx in tx array was not executed yet", async () => {
        })

        it.skip("throws if tx was already executed for that question", async () => {
        })

        it("triggers module transaction on execution", async () => {
            const { mock, executor, module, oracle } = await setupTestWithTestExecutor();

            await user1.sendTransaction({
                to: executor.address,
                value: BigNumber.from(100)
            })

            expect(
                await ethers.provider.getBalance(executor.address)
            ).to.be.deep.equals(BigNumber.from(100))

            expect(
                await ethers.provider.getBalance(mock.address)
            ).to.be.deep.equals(BigNumber.from(0))


            const id = "some_random_id";
            const tx = { to: mock.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await executor.setModule(module.address)
            await module.requestProposalReadyForExecution(id, [txHash])
            await increaseBlockTime(hre, 23)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Wait for additional cooldown");


            // Additional tx increases the time
            await module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce);

            expect(
                await ethers.provider.getBalance(executor.address)
            ).to.be.deep.equals(BigNumber.from(58))
            expect(
                await ethers.provider.getBalance(mock.address)
            ).to.be.deep.equals(BigNumber.from(42))

            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1)
            expect(
                (await mock.callStatic.invocationCountForCalldata("0xbaddad")).toNumber()
            ).to.be.equals(1)
        })

        it.skip("allows to send same tx (with different nonce) multiple times in proposal", async () => {
        })
    })
})