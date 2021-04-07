import { expect } from "chai";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

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

describe("safeBridgeModule", async () => {

    const baseSetup = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        const Mock = await hre.ethers.getContractFactory("MockContract");
        const mock = await Mock.deploy();
        const amb = await hre.ethers.getContractAt("IAMB", mock.address);
        return { Executor, executor, module, mock, amb };
    })

    const setupTestWithTestExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("SafeBridgeModule");
        const provider = await hre.ethers.getDefaultProvider();
        const network = await provider.getNetwork();
        const signers = await hre.ethers.getSigners();
        const amb = base.amb;
        const module = await Module.deploy(base.executor.address, base.amb.address, signers[0].address, network.chainId);
        return { ...base, Module, module, signers, network, amb };
    })

    const [user1] = waffle.provider.getWallets();

    describe("setAmb()", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setAmb(module.address)
            ).to.be.revertedWith("Not authorized");
        })

        it("throws if already set to input address", async () => {
            const { module, executor, amb } = await setupTestWithTestExecutor();

            expect(
                await module.amb()
            ).to.be.equals(amb.address);

            const calldata = module.interface.encodeFunctionData("setAmb", [amb.address]);
            await expect(
                executor.exec(module.address, 0, calldata)
            ).to.be.revertedWith("AMB address already set to this");
        })

        it("updates AMB address", async () => {
            const { module, executor, amb } = await setupTestWithTestExecutor();

            expect(
                await module.amb()
            ).to.be.equals(amb.address);

            const calldata = module.interface.encodeFunctionData("setAmb", [user1.address]);
            executor.exec(module.address, 0, calldata);

            expect(
                await module.amb()
            ).to.be.equals(user1.address);
        })
    })

    describe("chainId()", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setChainId(42)
            ).to.be.revertedWith("Not authorized");
        })

        it("throws if already set to input address", async () => {
            const { module, executor, network } = await setupTestWithTestExecutor();
            const chainID = hre.ethers.BigNumber.from(network.chainId);

            expect(
                await module.chainId()
            ).to.be.equals(chainID);

            const calldata = module.interface.encodeFunctionData("setChainId", [chainID]);
            await expect(
                executor.exec(module.address, 0, calldata)
            ).to.be.revertedWith("chainId already set to this");
        })

        it("updates chainId", async () => {
            const { module, executor, network } = await setupTestWithTestExecutor();

            expect(
                await module.chainId()
            ).to.be.equals(network.chainId);

            const calldata = module.interface.encodeFunctionData("setChainId", [42]);
            executor.exec(module.address, 0, calldata);

            expect(
                await module.chainId()
            ).to.be.equals(42);
        })
    })
})
