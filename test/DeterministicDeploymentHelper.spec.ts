import { expect } from 'chai'
import hre, { ethers } from 'hardhat'
import '@nomicfoundation/hardhat-ethers'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import createAdapter from './createEIP1193'
import { deployFactories, deployProxy } from '@gnosis-guild/zodiac-core'
import { AbiCoder } from 'ethers'

const FIRST_ADDRESS = '0x0000000000000000000000000000000000000001'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ARBITRATOR = FIRST_ADDRESS
const SALT_NONCE = '0xfa'
const DEFAULT_TEMPLATE = {
  title:
    'Did the Snapshot proposal with the id %s pass the execution of the array of Module transactions with the hash 0x%s? The hash is the keccak of the concatenation of the individual EIP-712 hashes of the Module transactions. If this question was asked before the Snapshot proposal was resolved it should ALWAYS be resolved to INVALID!',
  lang: 'en',
  type: 'bool',
  category: 'DAO proposal',
}
let proxyAddress0: string
let proxyAddress1: string
let proxyAddress2: string
let proxyAddress3: string

describe('Module can be deployed and configured via the DeterministicDeploymentHelper', () => {
  const timeout = 61
  const cooldown = 60
  const expiration = 120
  const bond = BigInt(10000)
  const defaultTemplateId = BigInt(0)

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
    const [, deployer] = await ethers.getSigners()
    const Factory = await hre.ethers.getContractFactory('ModuleProxyFactory')
    const factory = await Factory.deploy()
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

    const Mock = await hre.ethers.getContractFactory('MockContract')
    const mock = await Mock.deploy()
    const oracle = await hre.ethers.getContractAt(
      'RealitioV3ERC20',
      await mock.getAddress(),
    )
    return { factory, masterCopy, mock, oracle, eip1193Provider }
  }

  it('option 0: can be deterministically deployed and set up, then configured with a custom template via `createTemplate`', async () => {
    // in use this call should be done as a delegatecall from the module owner. Here we do a direct call for testing.
    const { masterCopy, mock, oracle, factory } = await loadFixture(baseSetup)
    const [safe] = await ethers.getSigners()
    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      'DeterministicDeploymentHelper',
    )
    const deploymentHelper = await DeterministicDeploymentHelper.deploy()
    const deploymentHelperAddress = await deploymentHelper.getAddress()
    const oracleAddress = await oracle.getAddress()
    const paramsValues = [
      deploymentHelperAddress, // set the deterministic deployment helper to be the owner. In production this will be the Safe.
      safe.address,
      safe.address,
      oracleAddress,
      timeout,
      cooldown,
      expiration,
      bond,
      defaultTemplateId,
      ARBITRATOR,
    ]
    const encodedParams = [
      AbiCoder.defaultAbiCoder().encode(paramsTypes, paramsValues),
    ]
    const initParams = masterCopy.interface.encodeFunctionData(
      'setUp',
      encodedParams,
    )

    const receipt = await factory
      .deployModule(await masterCopy.getAddress(), initParams, SALT_NONCE)
      .then((tx: any) => tx.wait())

    const parsedLogs = receipt.logs.map((log: any) => {
      try {
        return deploymentHelper.interface.parseLog(log)
      } catch (error) {
        return null
      }
    })

    const event = parsedLogs.find(
      (log: any) => log && log.name === 'ModuleProxyCreation',
    )

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = event

    proxyAddress0 = newProxyAddress

    const newProxy = await hre.ethers.getContractAt(
      'RealityModuleETH',
      newProxyAddress,
    )
    expect(await newProxy.template()).to.be.eq(BigInt(0))
    expect(await newProxy.owner()).to.be.eq(deploymentHelperAddress)
    expect(await newProxy.avatar()).to.be.eq(safe.address)
    expect(await newProxy.oracle()).to.be.eq(oracleAddress)
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.owner()).to.be.eq(deploymentHelperAddress)

    const sighash = oracle.interface.getFunction('createTemplate').selector
    await mock.givenMethodReturnUint(sighash, 5)

    await deploymentHelper
      .createTemplate(
        newProxyAddress,
        oracleAddress,
        JSON.stringify(DEFAULT_TEMPLATE),
      )
      .then((tx: any) => tx.wait())

    expect(await newProxy.avatar()).to.be.eq(safe.address)
    expect(await newProxy.oracle()).to.be.eq(oracleAddress)
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.template()).to.be.eq(BigInt(5))
    expect(await newProxy.owner()).to.be.eq(deploymentHelperAddress)
  })

  it('option 1: can be deterministically deployed and set up, then configured with a custom template and new owner via `createTemplateAndChangeOwner`', async () => {
    const { factory, masterCopy, mock, oracle } = await baseSetup()
    const [safe] = await ethers.getSigners()
  
    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      'DeterministicDeploymentHelper',
    )
  
    const deploymentHelper = await DeterministicDeploymentHelper.deploy()
  
    const paramsValues = [
      await deploymentHelper.getAddress(), // set the deterministic deployment helper to be the owner
      safe.address,
      safe.address,
      await oracle.getAddress(),
      timeout,
      cooldown,
      expiration,
      bond,
      defaultTemplateId,
      ARBITRATOR,
    ]
    

    const encodedParams = [
      AbiCoder.defaultAbiCoder().encode(paramsTypes, paramsValues),
    ]
    

    const initParams = masterCopy.interface.encodeFunctionData(
      'setUp',
      encodedParams,
    )
  

    const receipt = await factory
      .deployModule(await masterCopy.getAddress(), initParams, SALT_NONCE)
      .then((tx: any) => tx.wait())
  

    const parsedLogs = receipt.logs.map((log: any) => {
      try {
        return deploymentHelper.interface.parseLog(log)
      } catch (error) {
        return null
      }
    })
  

    const event = parsedLogs.find(
      (log: any) => log && log.name === 'ModuleProxyCreation',
    )
  

    const {
      args: [newProxyAddress],
    } = event
  

    proxyAddress1 = proxyAddress0
  

    const newProxy = await hre.ethers.getContractAt(
      'RealityModuleETH',
      newProxyAddress,
    )
  

    expect(await newProxy.template()).to.be.eq(BigInt(0))
    expect(await newProxy.owner()).to.be.eq(await deploymentHelper.getAddress())
  

    const sighash = oracle.interface.getFunction('createTemplate').selector
    await mock.givenMethodReturnUint(sighash, 5)
  

    await deploymentHelper
      .createTemplateAndChangeOwner(
        newProxyAddress,
        await oracle.getAddress(),
        JSON.stringify(DEFAULT_TEMPLATE),
        safe.address, 
      )
      .then((tx: any) => tx.wait())

      

    expect(await newProxy.avatar()).to.be.eq(safe.address)
    expect(await newProxy.oracle()).to.be.eq(await oracle.getAddress())
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.template()).to.be.eq(BigInt(5))

    expect(await newProxy.owner()).to.be.eq(safe.address)
  })
  
  

  it('option 2: can be deterministically set up and configured with a custom template via `deployWithEncodedParams`', async () => {
    const { masterCopy, mock, oracle, factory } = await loadFixture(baseSetup)
    const [safe] = await ethers.getSigners()

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      'DeterministicDeploymentHelper',
    )

    const deploymentHelper = await DeterministicDeploymentHelper.deploy()
    const deploymentHelperAddress = await deploymentHelper.getAddress()
    const oracleAddress = await oracle.getAddress()
    const paramsValues = [
      deploymentHelperAddress, // set the deterministic deployment helper to be the owner
      safe.address, //avatar
      safe.address, //target
      oracleAddress, //oracle
      timeout, //timeout
      cooldown, //cooldown
      expiration, //expiration
      bond, //bond
      defaultTemplateId, //templateId
      ARBITRATOR, //arbitrator
    ]
    const encodedParams = [
      AbiCoder.defaultAbiCoder().encode(paramsTypes, paramsValues),
    ]
    const initParams = masterCopy.interface.encodeFunctionData(
      'setUp',
      encodedParams,
    )
    const sighash = oracle.interface.getFunction('createTemplate').selector
    await mock.givenMethodReturnUint(sighash, 5)

    const receipt = await deploymentHelper
      .deployWithEncodedParams(
        await factory.getAddress(),
        await masterCopy.getAddress(),
        initParams,
        SALT_NONCE,
        oracleAddress,
        JSON.stringify(DEFAULT_TEMPLATE),
        safe.address,
      )
      .then((tx: any) => tx.wait())
    const parsedLogs = receipt.logs.map((log: any) => {
      try {
        return deploymentHelper.interface.parseLog(log)
      } catch (error) {
        return null
      }
    })

    const event = parsedLogs.find(
      (log: any) => log && log.name === 'ModuleProxyCreation',
    )

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = event
    proxyAddress2 = newProxyAddress
    const newProxy = await hre.ethers.getContractAt(
      'RealityModuleETH',
      newProxyAddress,
    )

    expect(await newProxy.avatar()).to.be.eq(safe.address)
    expect(await newProxy.oracle()).to.be.eq(oracleAddress)
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.template()).to.be.eq(BigInt(5))
    expect(await newProxy.owner()).to.be.eq(safe.address)
  })

  it('option 3: can be deterministically set up and configured with a custom template via `deployWithTemplate`', async () => {
    const { factory, masterCopy, mock, oracle } = await loadFixture(baseSetup)
    const [safe] = await ethers.getSigners()

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      'DeterministicDeploymentHelper',
    )

    const deploymentHelper = await DeterministicDeploymentHelper.deploy()

    const sighash = oracle.interface.getFunction('createTemplate').selector
    await mock.givenMethodReturnUint(sighash, 5)
    const oracleAddress = await oracle.getAddress()
    const receipt = await deploymentHelper
      .deployWithTemplate(
        await factory.getAddress(),
        await masterCopy.getAddress(),
        SALT_NONCE,
        {
          realityOracle: oracleAddress,
          templateContent: JSON.stringify(DEFAULT_TEMPLATE),
          owner: safe.address,
          avatar: safe.address,
          target: safe.address,
          timeout: timeout,
          cooldown: cooldown,
          expiration: expiration,
          bond: bond,
          arbitrator: ARBITRATOR,
        },
      )
      .then((tx: any) => tx.wait())

    const parsedLogs = receipt.logs.map((log: any) => {
      try {
        return deploymentHelper.interface.parseLog(log)
      } catch (error) {
        return null
      }
    })

    const event = parsedLogs.find(
      (log: any) => log && log.name === 'ModuleProxyCreation',
    )

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = event

    proxyAddress3 = newProxyAddress

    const newProxy = await hre.ethers.getContractAt(
      'RealityModuleETH',
      newProxyAddress,
    )
    expect(await newProxy.avatar()).to.be.eq(safe.address)
    expect(await newProxy.oracle()).to.be.eq(oracleAddress)
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR)
    expect(await newProxy.questionTimeout()).to.be.eq(timeout)
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown)
    expect(await newProxy.answerExpiration()).to.be.eq(expiration)
    expect(await newProxy.minimumBond()).to.be.eq(BigInt(bond))
    expect(await newProxy.template()).to.be.eq(BigInt(5))
    expect(await newProxy.owner()).to.be.eq(safe.address)
  })

  it('no matter what deployment function is used, the module proxy should end up at the same address', async () => {
    expect(proxyAddress0).to.equal(proxyAddress1, 'Address from option 0 and 1 are different')
    expect(proxyAddress0).to.equal(proxyAddress2, 'Address from option 0 and 2 are different')
    expect(proxyAddress0).to.equal(proxyAddress3, 'Address from option 0 and 3 are different')
  })
})
