import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import hre, { deployments, ethers, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("DaoModule", async () => {

    const getModule = async () => {
        const ModuleDeployment = await deployments.get("DaoModule");
        const Module = await hre.ethers.getContractFactory("DaoModule");
        return Module.attach(ModuleDeployment.address);
    }

    const setupTest = deployments.createFixture(async () => {
        await deployments.fixture();
        const Executor = await hre.ethers.getContractFactory("TestExecutor");
        const executor = await Executor.deploy();
        return { executor };
    })
    const [announcer, user1] = waffle.provider.getWallets();

    describe("create proposal", async () => {
        it("throws if module not configured", async () => {
            const { executor } = await setupTest();
            const module = await getModule();
            const to = user1.address;
            const value = 0;
            const data = "0x";
            const operation = 0;
            const nonce = 0;
            await expect(
                module.announceTransaction(executor.address, to, value, data, operation, nonce)
            ).to.be.revertedWith("Could not find valid config for executor and announcer");
        })
    })
})