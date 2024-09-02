import { task } from 'hardhat/config'

import { writeMastercopyFromBuild } from '@gnosis-guild/zodiac-core'

import packageJson from '../../package.json'

const AddressOne = '0x0000000000000000000000000000000000000001'
const types = [
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
]
const args = [
  AddressOne,
  AddressOne,
  AddressOne,
  AddressOne,
  1,
  61,
  0,
  0,
  0,
  AddressOne,
]

task(
  'extract:mastercopy',
  'Extracts and persists current mastercopy build artifacts',
).setAction(async (_, hre) => {
  writeMastercopyFromBuild({
    contractVersion: packageJson.version,
    contractName: 'RealityModuleETH',
    compilerInput: await hre.run('verify:etherscan-get-minimal-input', {
      sourceName: 'contracts/RealityModuleETH.sol',
    }),
    constructorArgs: {
      types,
      values: args,
    },
    salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
  })

  writeMastercopyFromBuild({
    contractVersion: packageJson.version,
    contractName: 'RealityModuleERC20',
    compilerInput: await hre.run('verify:etherscan-get-minimal-input', {
      sourceName: 'contracts/RealityModuleERC20.sol',
    }),
    constructorArgs: {
      types,
      values: args,
    },
    salt: '0x0000000000000000000000000000000000000000000000000000000000000000',
  })
})
