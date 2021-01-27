import { time } from "console";
import hre, { deployments, ethers, waffle } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const nextBlockTime = async (hre: HardhatRuntimeEnvironment, timestamp: number) =>  {
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp])
}