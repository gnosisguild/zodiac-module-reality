import { task, types } from 'hardhat/config'

import { deployMastercopy, readMastercopies } from '@gnosis-guild/zodiac-core'
import { createEIP1193 } from './create-EIP1193'

task(
  'deploy:mastercopy',
  'For every entry on the artifacts file, that corresponds to the provided entry, deploy the mastercopy into the current network',
)
  .addOptionalParam(
    'contractVersion',
    'The specific version of the contract to deploy',
    'latest', // Default value
    types.string,
  )
  .setAction(async ({ contractVersion }, hre) => {
    const [signer] = await hre.ethers.getSigners()
    const provider = createEIP1193(hre.network.provider, signer)

    for (const mastercopy of readMastercopies({ contractVersion })) {
      const {
        contractName,
        contractVersion,
        factory,
        bytecode,
        constructorArgs,
        salt,
      } = mastercopy
      const { address, noop } = await deployMastercopy({
        factory,
        bytecode,
        constructorArgs,
        salt,
        provider,
        onStart: () => {
          console.log(
            `⏳ ${contractName}@${contractVersion}: Deployment starting...`,
          )
        },
      })
      if (noop) {
        console.log(
          `🔄 ${contractName}@${contractVersion}: Already deployed at ${address}`,
        )
      } else {
        console.log(
          `🚀 ${contractName}@${contractVersion}: Successfully deployed at ${address}`,
        )
      }
    }
  })
