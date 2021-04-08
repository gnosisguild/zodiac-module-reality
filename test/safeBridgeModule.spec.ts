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
        const Mock = await hre.ethers.getContractFactory("Mock");
        const mock = await Mock.deploy();
        const amb = await hre.ethers.getContractAt("IAMB", mock.address);
        const badMock = await Mock.deploy();
        const badAmb = await hre.ethers.getContractAt("IAMB", badMock.address);

        const signers = await hre.ethers.getSigners();

        await mock.givenMethodReturnUint(amb.interface.getSighash("sourceChainId"), 1);
        await badMock.givenMethodReturnUint(badAmb.interface.getSighash("sourceChainId"), 2);
        await mock.givenMethodReturnAddress(amb.interface.getSighash("messageSender"), signers[0].address);
        await badMock.givenMethodReturnAddress(badAmb.interface.getSighash("messageSender"), signers[1].address);

        return { Executor, executor, module, mock, badMock, amb, badAmb, signers };
    })

    const setupTestWithTestExecutor = deployments.createFixture(async () => {
        const base = await baseSetup();
        const Module = await hre.ethers.getContractFactory("SafeBridgeModule");
        const provider = await hre.ethers.getDefaultProvider();
        const network = await provider.getNetwork();
        const module = await Module.deploy(base.executor.address, base.amb.address, base.signers[0].address, base.amb.sourceChainId());
        await base.executor.setModule(module.address);
        return { ...base, Module, module, network };
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

    describe("setChainId()", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setChainId(42)
            ).to.be.revertedWith("Not authorized");
        })

        it("throws if already set to input address", async () => {
            const { module, executor, network } = await setupTestWithTestExecutor();
            const currentChainID = await module.chainId();

            const calldata = module.interface.encodeFunctionData("setChainId", [currentChainID]);
            await expect(
                executor.exec(module.address, 0, calldata)
            ).to.be.revertedWith("chainId already set to this");
        })

        it("updates chainId", async () => {
            const { module, executor, network } = await setupTestWithTestExecutor();
            let currentChainID = await module.chainId();
            const newChainID = await hre.ethers.BigNumber.from(42);

            expect(
                await currentChainID._hex
            ).to.not.equals(newChainID._hex);

            const calldata = module.interface.encodeFunctionData("setChainId", [newChainID]);
            executor.exec(module.address, 0, calldata);

            currentChainID = await module.chainId();
            expect(
                await currentChainID._hex
            ).to.be.equals(newChainID._hex);
        })
    })

    describe("setOwner()", async () => {
        it("throws if not authorized", async () => {
            const { module } = await setupTestWithTestExecutor();
            await expect(
                module.setOwner(user1.address)
            ).to.be.revertedWith("Not authorized");
        })

        it("throws if already set to input address", async () => {
            const { module, executor } = await setupTestWithTestExecutor();
            const currentOwenr = await module.owner();

            const calldata = module.interface.encodeFunctionData("setOwner", [currentOwenr]);
            await expect(
                executor.exec(module.address, 0, calldata)
            ).to.be.revertedWith("owner already set to this");
        })

        it("updates owner", async () => {
            const { module, executor, signers } = await setupTestWithTestExecutor();
            let currentOwner = await module.owner();
            let newOwner = signers[1].address;

            expect(
                await currentOwner
            ).to.not.equals(signers[1].address);

            const calldata = module.interface.encodeFunctionData("setOwner", [newOwner]);
            executor.exec(module.address, 0, calldata);

            currentOwner = await module.owner();
            expect(
                await module.owner()
            ).to.be.equals(newOwner);
        })
    })

    describe("executeTrasnaction()", async () => {
        it("throws if amb is unauthorized", async () => {
            const { module, signers } = await setupTestWithTestExecutor();
            const tx = { to: user1.address, value: 0, data: "0xbaddad", operation: 0}
            await expect(
                module.executeTransaction(tx.to, tx.value, tx.data, tx.operation)
            ).to.be.revertedWith("Unauthorized amb");
        })

        it("throws if chainId is unauthorized", async () => {
            const { mock, badMock, module, signers, amb, badAmb } = await setupTestWithTestExecutor();
            const ambTx = await module.populateTransaction.executeTransaction(user1.address, 0, "0xbaddad", 0);

            await mock.givenMethodReturnUint(amb.interface.getSighash("sourceChainId"), 2);

            await expect(
                mock.exec(module.address, 0, ambTx.data)
            ).to.be.revertedWith("Unauthorized chainId");
        })

        it("throws if messageSender is unauthorized", async () => {
            const { mock, badMock, module, signers, amb, badAmb } = await setupTestWithTestExecutor();
            const ambTx = await module.populateTransaction.executeTransaction(user1.address, 0, "0xbaddad", 0);

            await mock.givenMethodReturnUint(amb.interface.getSighash("messageSender"), signers[1].address);

            await expect(
                mock.exec(module.address, 0, ambTx.data)
            ).to.be.revertedWith("Unauthorized owner");
        })

        it("throws if trasnaction already executed", async () => {
            const { mock, badMock, module, signers, amb, badAmb } = await setupTestWithTestExecutor();
            const ambTx = await module.populateTransaction.executeTransaction(user1.address, 0, "0xbaddad", 0);

            await mock.givenMethodReturnUint(amb.interface.getSighash("messageId"), 1);

            await mock.exec(module.address, 0, ambTx.data);

            await expect(
                mock.exec(module.address, 0, ambTx.data)
            ).to.be.revertedWith("Transaction already executed");
        })

        it("throws if module transaction fails", async () => {
            const { mock, badMock, module, signers, amb, badAmb } = await setupTestWithTestExecutor();
            const ambTx = await module.populateTransaction.executeTransaction(user1.address, 10000000, "0xbaddad", 0);

            await mock.givenMethodReturnUint(amb.interface.getSighash("messageId"), 1);

            await expect(
                mock.exec(module.address, 0, ambTx.data)
            ).to.be.revertedWith("Module transaction failed");
        })

        it("executes a transaction", async () => {
            const { mock, badMock, module, signers, amb, badAmb } = await setupTestWithTestExecutor();
            const ambTx = await module.populateTransaction.executeTransaction(user1.address, 0, "0xbaddad", 0);

            await mock.givenMethodReturnUint(amb.interface.getSighash("messageId"), 1);

            await mock.exec(module.address, 0, ambTx.data);
        })
    })
})
