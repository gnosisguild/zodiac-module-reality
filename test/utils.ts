import { Contract } from "ethers";
import { defaultAbiCoder } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export const buildMockInitializerParams = (mock: Contract): string => {
    return defaultAbiCoder.encode(
        ["address", "address", "address", "uint32", "uint32", "uint32", "uint256", "uint256"], 
        [mock.address, mock.address, mock.address, 42, 23, 0, 0, 1337]
    )
} 

export const nextBlockTime = async (hre: HardhatRuntimeEnvironment, timestamp: number) =>  {
    await hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp])
}

export const increaseBlockTime = async (hre: HardhatRuntimeEnvironment, seconds: number) =>  {
    const block = await hre.ethers.provider.getBlock("latest")
    await nextBlockTime(hre, block.timestamp + seconds)
}

export const logGas = async (message: string, tx: Promise<any>): Promise<any> => {
    return tx.then(async (result) => {
        const receipt = await result.wait()
        console.log("           Used", receipt.gasUsed.toNumber(), `gas for >${message}<`)
        return result
    })
}
