import { Contract, AbiCoder } from 'ethers'

import { HardhatRuntimeEnvironment } from 'hardhat/types'

export const buildMockInitializerParams = async (mock: Contract): Promise<string> => {
  return AbiCoder.defaultAbiCoder().encode(
    [
      'address',
      'address',
      'address',
      'address',
      'uint32',
      'uint32',
      'uint32',
      'uint256',
      'uint256',
      'address',
    ],
    [
      await mock.getAddress(),
      await mock.getAddress(),
      await mock.getAddress(),
      await mock.getAddress(),
      42,
      23,
      0,
      0,
      1337,
      await mock.getAddress(),
    ],
  )
}

export const nextBlockTime = async (
  hre: HardhatRuntimeEnvironment,
  timestamp: number,
) => {
  await hre.ethers.provider.send('evm_setNextBlockTimestamp', [timestamp])
}

export const increaseBlockTime = async (
  hre: HardhatRuntimeEnvironment,
  seconds: number,
) => {
  const block = await hre.ethers.provider.getBlock('latest')
  if (!block) return
  await nextBlockTime(hre, block?.timestamp + seconds)
}

export const logGas = async (
  message: string,
  tx: Promise<any>,
): Promise<any> => {
  return tx.then(async (result) => {
    const receipt = await result.wait()
    console.log(
      '           Used',
      receipt.gasUsed.toNumber(),
      `gas for >${message}<`,
    )
    return result
  })
}
