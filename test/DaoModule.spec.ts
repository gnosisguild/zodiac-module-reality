import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("DaoModule", async () => {

    const setupTest = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const Mock = await hre.ethers.getContractFactory("MockContract");
        const oracleMock = await Mock.deploy();
        const Module = await hre.ethers.getContractFactory("DaoModule");
        const module = await Module.deploy(executor.address, oracleMock.address, 42, 1, 0, 1337);
        const oracle = await hre.ethers.getContractAt("Realitio", oracleMock.address);
        return { executor, module, oracleMock, oracle };
    })
    const [user1] = waffle.provider.getWallets();

    describe("addProposal", async () => {
        it("throws if unexpected question id is returned", async () => {
            const { module, oracleMock, oracle } = await setupTest();
            await oracleMock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), 42)
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.addProposal(id, [txHash])
            ).to.be.revertedWith("Unexpected question id");
        })

        it("calls askQuestion with correct data", async () => {
            const { module, oracleMock, oracle } = await setupTest();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);

            const question = await module.buildQuestion(id, [txHash]);
            const questionId = await module.getQuestionId(1337, question, module.address, 42, 0, 0)
            await oracleMock.givenMethodReturnUint(oracle.interface.getSighash("askQuestion"), questionId)
            await module.addProposal(id, [txHash])
            
            const askQuestionCalldata = oracle.interface.encodeFunctionData("askQuestion", [1337, question, module.address, 42, 0, 0])
            expect(
                (await oracleMock.callStatic.invocationCountForCalldata(askQuestionCalldata)).toNumber()
            ).to.be.equals(1);
        })
    })

    describe("requestProposalReadyForExecution", async () => {
        it("throws if module is not enabled", async () => {
            const { module } = await setupTest();
            const id = "some_random_id";
            const txHash = ethers.utils.solidityKeccak256(["string"], ["some_tx_data"]);
            await expect(
                module.requestProposalReadyForExecution(id, [txHash])
            ).to.be.revertedWith("Not authorized");
        })
    })
})