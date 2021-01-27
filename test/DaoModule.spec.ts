import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { exec } from "child_process";

describe("DaoModule", async () => {

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
        const Module = await hre.ethers.getContractFactory("DaoModule");
        const module = await Module.deploy(base.executor.address, base.mock.address, 42, 1, 0, 1337);
        return { ...base, Module, module };
    })

    const setupTestWithMockExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("DaoModule");
        const module = await Module.deploy(base.mock.address, base.mock.address, 42, 1, 0, 1337);
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
        })
    })

    describe("requestProposalReadyForExecution", async () => {
        it.only("throws if module is not enabled", async () => {
            const { mock, module, executor } = await setupTestWithMockExecutor();
            await mock.givenMethodReturnBool(executor.interface.getSighash("execTransactionFromModule"), false)
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.requestProposalReadyForExecution(id, [txHash])
            ).to.be.revertedWith("Could not mark proposal ready for execution");
            
            const markProposalReadyForExecutionData = module.interface.encodeFunctionData(
                "markProposalReadyForExecution",
                [id, [txHash]]
            )
            const execCallData = executor.interface.encodeFunctionData(
                "execTransactionFromModule", 
                [module.address, 0, markProposalReadyForExecutionData, 0]
            )
            // We expect 0 here as it reverted
            expect(
                (await mock.callStatic.invocationCountForCalldata(execCallData)).toNumber()
            ).to.be.equals(0);
        })
        it.only("calls executor to mark proposal as ready", async () => {
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
        })
    })
})