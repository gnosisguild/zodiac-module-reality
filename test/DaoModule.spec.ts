import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { nextBlockTime } from "./utils";
import { BigNumber } from "ethers";
import { _TypedDataEncoder } from "@ethersproject/hash";

const EIP712_TYPES = {
    "Transaction": [
        {
            "name": "to",
            "type": "address"
        },
        {
            "name": "value",
            "type": "uint256"
        },
        {
            "name": "data",
            "type": "bytes"
        },
        {
            "name": "operation",
            "type": "uint8"
        },
        {
            "name": "nonce",
            "type": "uint256"
        }
    ]
}

const INVALIDATED_STATE = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const ZERO_STATE = "0x0000000000000000000000000000000000000000000000000000000000000000";

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
        const module = await Module.deploy(base.executor.address, base.mock.address, 42, 23, 0, 1337);
        return { ...base, Module, module };
    })

    const setupTestWithMockExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("DaoModule");
        const module = await Module.deploy(base.mock.address, base.mock.address, 42, 23, 0, 1337);
        return { ...base, Module, module };
    })
    const [user1] = waffle.provider.getWallets();

    describe("constructor", async () => {
        it("throws if timeout is 0", async () => {
            const Module = await hre.ethers.getContractFactory("DaoModule");
            await expect(
                Module.deploy(user1.address, user1.address, 0, 0, 0, 0)
            ).to.be.revertedWith("Timeout has to be greater 0");
        })
    })

    describe("setQuestionTimeout", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setQuestionTimeout(2)
            ).to.be.revertedWith("Not authorized to update timeout");
        })

        it("throws if timeout is 0", async () => {
            const { executor, module } = await setupTestWithTestExecutor();
            const calldata = module.interface.encodeFunctionData("setQuestionTimeout", [0])
            await expect(
                executor.exec(module.address, 0, calldata)
            ).to.be.revertedWith("Timeout has to be greater 0");
        })

        it("updates question timeout", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            expect(
                await module.questionTimeout()
            ).to.be.equals(42);

            const calldata = module.interface.encodeFunctionData("setQuestionTimeout", [511])
            await executor.exec(module.address, 0, calldata)

            expect(
                await module.questionTimeout()
            ).to.be.equals(511);
        })
    })

    describe("setQuestionCooldown", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setQuestionCooldown(2)
            ).to.be.revertedWith("Not authorized to update cooldown");
        })

        it("updates question cooldown", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            expect(
                await module.questionCooldown()
            ).to.be.equals(23);

            const calldata = module.interface.encodeFunctionData("setQuestionCooldown", [511])
            await executor.exec(module.address, 0, calldata)

            expect(
                await module.questionCooldown()
            ).to.be.equals(511);
        })
    })

    describe("setArbitrator", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setArbitrator(ethers.constants.AddressZero)
            ).to.be.revertedWith("Not authorized to update arbitrator");
        })

        it("updates arbitrator", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            expect(
                await module.questionArbitrator()
            ).to.be.equals(executor.address);

            const calldata = module.interface.encodeFunctionData("setArbitrator", [ethers.constants.AddressZero])
            await executor.exec(module.address, 0, calldata)

            expect(
                await module.questionArbitrator()
            ).to.be.equals(ethers.constants.AddressZero);
        })
    })

    describe("setMinimumBond", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setMinimumBond(2)
            ).to.be.revertedWith("Not authorized to update minimum bond");
        })

        it("updates minimum bond", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            expect(
                (await module.minimumBond()).toNumber()
            ).to.be.equals(0);

            const calldata = module.interface.encodeFunctionData("setMinimumBond", [424242])
            await executor.exec(module.address, 0, calldata)

            expect(
                (await module.minimumBond()).toNumber()
            ).to.be.equals(424242);
        })
    })

    describe("setTemplate", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setTemplate(2)
            ).to.be.revertedWith("Not authorized to update template");
        })

        it("updates template", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            expect(
                (await module.template()).toNumber()
            ).to.be.equals(1337);

            const calldata = module.interface.encodeFunctionData("setTemplate", [112358])
            await executor.exec(module.address, 0, calldata)

            expect(
                (await module.template()).toNumber()
            ).to.be.equals(112358);
        })
    })

    describe("markQuestionIdAsInvalid", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            const questionId = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.markQuestionIdAsInvalid(questionId)
            ).to.be.revertedWith("Not authorized to invalidate proposal");
        })

        it("marks unknown question id as invalid", async () => {
            const { module, executor } = await setupTestWithTestExecutor();

            const questionId = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            expect(
                (await module.questionHashes(questionId))
            ).to.be.equals(ZERO_STATE);

            const calldata = module.interface.encodeFunctionData("markQuestionIdAsInvalid", [questionId])
            await executor.exec(module.address, 0, calldata)

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(INVALIDATED_STATE);
        })

        it("marks known question id as invalid", async () => {
            const { module, mock, oracle, executor } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)

            await expect(
                module.addProposal(id, [txHash])
            ).to.emit(module, "ProposalQuestionCreated").withArgs(questionId, id)

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(question)))

            const calldata = module.interface.encodeFunctionData("markQuestionIdAsInvalid", [questionId])
            await executor.exec(module.address, 0, calldata)

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(INVALIDATED_STATE);
        })
    })

    describe("getTransactionHash", async () => {
        it("correctly generates hash for tx without data", async () => {
            const { module } = await setupTestWithTestExecutor();
            const chainId = await module.getChainId()
            const domain = {
                "chainId": chainId,
                "verifyingContract": module.address,
            }
            const tx = { to: user1.address, value: 42, data: "0x", operation: 0, nonce: 0 }
            expect(
                await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.equals(_TypedDataEncoder.hash(domain, EIP712_TYPES, tx));
        })

        it("correctly generates hash for complex tx", async () => {
            const { module } = await setupTestWithTestExecutor();
            const chainId = await module.getChainId()
            const domain = {
                "chainId": chainId,
                "verifyingContract": module.address,
            }
            const tx = { to: user1.address, value: 23, data: "0xbaddad", operation: 1, nonce: 13 }
            expect(
                await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.equals(_TypedDataEncoder.hash(domain, EIP712_TYPES, tx));
        })
    })

    describe("buildQuestion", async () => {
        it("concatenats id and hashed hashes as ascii strings", async () => {
            const { module } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const tx1Hash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            const tx2Hash = ethers.utils.solidityKeccak256(["string"], ["some_other_tx_data"]);
            const hashesHash = ethers.utils.solidityKeccak256(["bytes32[]"], [[tx1Hash, tx2Hash]]).slice(2);
            expect(
                await module.buildQuestion(id, [tx1Hash, tx2Hash])
            ).to.be.equals(`${id}␟${hashesHash}`);
        })
    })

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

        it("throws if proposed question was already invalidated before creation", async () => {
            const { module, mock, oracle, executor } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0);
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId);

            const markQuestionIdAsInvalid = module.interface.encodeFunctionData(
                "markQuestionIdAsInvalid",
                [questionId]
            );
            await executor.exec(module.address, 0, markQuestionIdAsInvalid);

            await expect(
                module.addProposal(id, [txHash])
            ).to.be.revertedWith("New question state is not unset");
        })

        it("calls askQuestion with correct data", async () => {
            const { module, mock, oracle, executor } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)

            await expect(
                module.addProposal(id, [txHash])
            ).to.emit(module, "ProposalQuestionCreated").withArgs(questionId, id)

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(question)))

            const askQuestionCalldata = oracle.interface.encodeFunctionData("askQuestion", [1337, question, executor.address, 42, 0, 0])
            expect(
                (await mock.callStatic.invocationCountForCalldata(askQuestionCalldata)).toNumber()
            ).to.be.equals(1);
            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1);
        })
    })

    describe("addProposalWithNonce", async () => {
        it("throws if previous nonce was not invalid", async () => {
            const { module, mock, oracle } = await setupTestWithTestExecutor();
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), 42)
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.addProposalWithNonce(id, [txHash], 1)
            ).to.be.revertedWith("Previous question was not invalidated");
        })

        it("calls askQuestion with correct data", async () => {
            const { module, mock, oracle, executor } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 1)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            const previousQuestionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)
            const resultForCalldata = oracle.interface.encodeFunctionData("resultFor", [previousQuestionId])
            await mock.givenCalldataReturnUint(resultForCalldata, INVALIDATED_STATE)

            await expect(
                module.addProposalWithNonce(id, [txHash], 1)
            ).to.emit(module, "ProposalQuestionCreated").withArgs(questionId, id)

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(question)))

            const askQuestionCalldata = oracle.interface.encodeFunctionData("askQuestion", [1337, question, executor.address, 42, 0, 1])
            expect(
                (await mock.callStatic.invocationCountForCalldata(askQuestionCalldata)).toNumber()
            ).to.be.equals(1);

            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1);
        })

        it("does not create proposal if previous nonce was internally invalidated", async () => {
            const { module, mock, oracle, executor } = await setupTestWithTestExecutor();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionIdNonce0 = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)
            const questionIdNonce1 = await module.getQuestionId(1337, question, executor.address, 42, 0, 1)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionIdNonce0)
            const proposalParameters = [id, [txHash]]
            await module.addProposal(...proposalParameters)

            const markAsInvalidCalldata = module.interface.encodeFunctionData("markQuestionIdAsInvalid", [questionIdNonce0])
            await executor.exec(module.address, 0, markAsInvalidCalldata);
            expect(
                await module.questionHashes(questionIdNonce0)
            ).to.deep.equal(INVALIDATED_STATE)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("resultFor"), INVALIDATED_STATE)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionIdNonce1)
            await expect(
                module.addProposalWithNonce(...proposalParameters, 1)
            ).to.be.revertedWith("This proposal has been marked as invalid")

            expect(
                await module.questionHashes(questionIdNonce1)
            ).to.deep.equal(ZERO_STATE)
        })
    })

    describe("executeProposal", async () => {
        it("throws if question hash was not set", async () => {
            const { mock, module } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("No question hash set for provided id");
        })

        it("throws if proposal has been invalidated", async () => {
            const { executor, mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            const markQuestionIdAsInvalid = module.interface.encodeFunctionData(
                "markQuestionIdAsInvalid",
                [questionId]
            )
            await executor.exec(module.address, 0, markQuestionIdAsInvalid)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Question has been invalidated");
        })

        it("throws if tx data doesn't belong to proposal", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 1)
            ).to.be.revertedWith("Unexpected transaction hash");
        })

        it("throws if tx data doesn't belong to questionId", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, []);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [])

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0)
            ).to.be.revertedWith("Unexpected question hash");
        })

        it("throws if tx was not approved", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), false)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0)
            ).to.be.revertedWith("Transaction was not approved");
        })

        it("throws if bond was not high enough", async () => {
            const { executor, mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)

            const setMinimumBond = module.interface.encodeFunctionData(
                "setMinimumBond",
                [7331]
            )
            await executor.exec(module.address, 0, setMinimumBond)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            ).to.be.revertedWith("Bond on question not high enough");
        })

        it("triggers module transaction when bond is high enough", async () => {
            const { executor, mock, module, oracle } = await setupTestWithTestExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, executor.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            const setMinimumBond = module.interface.encodeFunctionData(
                "setMinimumBond",
                [7331]
            )
            await executor.exec(module.address, 0, setMinimumBond)
            await executor.setModule(module.address)

            const block = await ethers.provider.getBlock("latest")
            await mock.reset()
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getBond"), 7331)
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)

            await nextBlockTime(hre, block.timestamp + 24)
            await module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0);

            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), txHash)
            ).to.be.equals(true)
        })

        it("throws if cooldown was not over", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            const block = await ethers.provider.getBlock("latest")
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)

            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0)
            ).to.be.revertedWith("Wait for additional cooldown");
        })

        it("throws if tx was already executed for that question", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])
            const block = await ethers.provider.getBlock("latest")
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)
            await nextBlockTime(hre, block.timestamp + 24)
            await module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0);
            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0)
            ).to.be.revertedWith("Cannot execute transaction again");
        })

        it("triggers module transaction", async () => {
            const { executor, mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const txHash = await module.getTransactionHash(tx.to, tx.value, tx.data, tx.operation, tx.nonce)
            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])

            const block = await ethers.provider.getBlock("latest")
            await mock.reset()
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)
            await nextBlockTime(hre, block.timestamp + 23)
            await expect(
                module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0)
            ).to.be.revertedWith("Wait for additional cooldown");

            await nextBlockTime(hre, block.timestamp + 24)
            await module.executeProposal(questionId, id, [txHash], tx.to, tx.value, tx.data, tx.operation, 0);

            expect(
                await module.questionHashes(questionId)
            ).to.be.deep.equals(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(question)))
            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), txHash)
            ).to.be.equals(true)

            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(1)
            const execTransactionFromModuleCalldata = executor.interface.encodeFunctionData(
                "execTransactionFromModule",
                [tx.to, tx.value, tx.data, tx.operation]
            )
            expect(
                (await mock.callStatic.invocationCountForCalldata(execTransactionFromModuleCalldata)).toNumber()
            ).to.be.equals(1)
        })

        it("throws if previous tx in tx array was not executed yet", async () => {
            const { mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx1 = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const tx1Hash = await module.getTransactionHash(tx1.to, tx1.value, tx1.data, tx1.operation, tx1.nonce)
            const tx2 = { to: user1.address, value: 23, data: "0xdeaddeed", operation: 0, nonce: 1 }
            const tx2Hash = await module.getTransactionHash(tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)
            const question = await module.buildQuestion(id, [tx1Hash, tx2Hash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [tx1Hash, tx2Hash])
            const block = await ethers.provider.getBlock("latest")
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)
            await nextBlockTime(hre, block.timestamp + 24)
            await expect(
                module.executeProposalWithIndex(questionId, id, 1, [tx1Hash, tx2Hash], tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)
            ).to.be.revertedWith("Previous transaction not executed yet");
        })

        it("allows to execute the transactions in different blocks", async () => {
            const { executor, mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx1 = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const tx1Hash = await module.getTransactionHash(tx1.to, tx1.value, tx1.data, tx1.operation, tx1.nonce)
            const tx2 = { to: user1.address, value: 23, data: "0xdeaddeed", operation: 0, nonce: 1 }
            const tx2Hash = await module.getTransactionHash(tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)
            const question = await module.buildQuestion(id, [tx1Hash, tx2Hash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [tx1Hash, tx2Hash])
            const block = await ethers.provider.getBlock("latest")
            await mock.reset()
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)
            await nextBlockTime(hre, block.timestamp + 24)

            await module.executeProposal(questionId, id, [tx1Hash, tx2Hash], tx1.to, tx1.value, tx1.data, tx1.operation, tx1.nonce)

            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), tx1Hash)
            ).to.be.equals(true)

            const execTransaction1FromModuleCalldata = executor.interface.encodeFunctionData(
                "execTransactionFromModule",
                [tx1.to, tx1.value, tx1.data, tx1.operation]
            )
            expect(
                (await mock.callStatic.invocationCountForCalldata(execTransaction1FromModuleCalldata)).toNumber()
            ).to.be.equals(1)

            await module.executeProposalWithIndex(questionId, id, 1, [tx1Hash, tx2Hash], tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)

            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), tx2Hash)
            ).to.be.equals(true)
            const execTransaction2FromModuleCalldata = executor.interface.encodeFunctionData(
                "execTransactionFromModule",
                [tx2.to, tx2.value, tx2.data, tx2.operation]
            )
            expect(
                (await mock.callStatic.invocationCountForCalldata(execTransaction2FromModuleCalldata)).toNumber()
            ).to.be.equals(1)

            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(2)
        })

        it("allows to send same tx (with different nonce) multiple times in proposal", async () => {
            const { executor, mock, module, oracle } = await setupTestWithMockExecutor();

            const id = "some_random_id";
            const tx1 = { to: user1.address, value: 42, data: "0xbaddad", operation: 0, nonce: 0 }
            const tx1Hash = await module.getTransactionHash(tx1.to, tx1.value, tx1.data, tx1.operation, tx1.nonce)
            const tx2 = { ...tx1, nonce: 1 }
            const tx2Hash = await module.getTransactionHash(tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)
            expect(tx1Hash).to.be.not.equals(tx2Hash)

            const question = await module.buildQuestion(id, [tx1Hash, tx2Hash]);
            const questionId = await module.getQuestionId(1337, question, mock.address, 42, 0, 0)

            await mock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [tx1Hash, tx2Hash])
            const block = await ethers.provider.getBlock("latest")
            await mock.reset()
            await mock.givenMethodReturnBool(oracle.interface.getSighash("resultFor"), true)
            await mock.givenMethodReturnUint(oracle.interface.getSighash("getFinalizeTS"), block.timestamp)
            await nextBlockTime(hre, block.timestamp + 24)

            await module.executeProposal(questionId, id, [tx1Hash, tx2Hash], tx1.to, tx1.value, tx1.data, tx1.operation, tx1.nonce)

            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), tx1Hash)
            ).to.be.equals(true)

            const execTransactionFromModuleCalldata = executor.interface.encodeFunctionData(
                "execTransactionFromModule",
                [tx1.to, tx1.value, tx1.data, tx1.operation]
            )
            expect(
                (await mock.callStatic.invocationCountForCalldata(execTransactionFromModuleCalldata)).toNumber()
            ).to.be.equals(1)

            await module.executeProposalWithIndex(questionId, id, 1, [tx1Hash, tx2Hash], tx2.to, tx2.value, tx2.data, tx2.operation, tx2.nonce)

            expect(
                await module.executedProposalTransactions(ethers.utils.solidityKeccak256(["string"], [question]), tx2Hash)
            ).to.be.equals(true)
            expect(
                (await mock.callStatic.invocationCountForCalldata(execTransactionFromModuleCalldata)).toNumber()
            ).to.be.equals(2)

            expect(
                (await mock.callStatic.invocationCount()).toNumber()
            ).to.be.equals(2)
        })
    })
})