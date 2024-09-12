import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import '@nomicfoundation/hardhat-ethers'
import { AbiCoder } from 'ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployFactories, deployProxy } from '@gnosis-guild/zodiac-core'
import createAdapter from './createEIP1193'

const FIRST_ADDRESS = '0x0000000000000000000000000000000000000001'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const saltNonce = '0xfa'

describe('Module works with factory', () => {
  const timeout = 60
  const cooldown = 60
  const expiration = 120
  const bond = BigInt(10000)
  const templateId = BigInt(1)

  const paramsTypes = [
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

  const baseSetup = async () => {
    const [safe, oracle, deployer] = await ethers.getSigners()
    const params = [
      safe.address,
      safe.address,
      safe.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      templateId,
      oracle.address,
    ]
    const eip1193Provider = createAdapter({
      provider: hre.network.provider,
      signer: deployer,
    })
    await deployFactories({ provider: eip1193Provider })

    const RealityModuleETH =
      await hre.ethers.getContractFactory('RealityModuleETH')
    const masterCopy = await RealityModuleETH.deploy(
      FIRST_ADDRESS,
      FIRST_ADDRESS,
      FIRST_ADDRESS,
      ZERO_ADDRESS,
      1,
      61,
      0,
      0,
      0,
      ZERO_ADDRESS,
    )
    const encodedParams = AbiCoder.defaultAbiCoder().encode(paramsTypes, params)
    return { masterCopy, params, eip1193Provider, encodedParams }
  }

  it('should throw because master copy is already initialized', async () => {
    const { masterCopy, params, eip1193Provider, encodedParams } =
      await loadFixture(baseSetup)

    const { address } = await deployProxy({
      provider: eip1193Provider,
      saltNonce,
      mastercopy: await masterCopy.getAddress(),
      setupArgs: {
        types: paramsTypes,
        values: params,
      },
    })
    const proxy = await hre.ethers.getContractAt('RealityModuleETH', address)
    await expect(proxy.setUp(encodedParams)).to.be.revertedWithCustomError(
      proxy,
      'InvalidInitialization()',
    )
  })

  it('should deploy new reality module proxy', async () => {
    const { masterCopy, params, eip1193Provider } = await loadFixture(baseSetup)
    const { address } = await deployProxy({
      provider: eip1193Provider,
      saltNonce,
      mastercopy: await masterCopy.getAddress(),
      setupArgs: {
        types: paramsTypes,
        values: params,
      },
    })
    const newProxy = await hre.ethers.getContractAt('RealityModuleETH', address)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.template()).to.be.eq(BigInt(templateId))
  })
})
