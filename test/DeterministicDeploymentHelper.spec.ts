import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AbiCoder } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const FIRST_ADDRESS = "0x0000000000000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ARBITRATOR = FIRST_ADDRESS;
const SALT_NONCE = "0xfa";
const DEFAULT_TEMPLATE = {
  title:
    "Did the Snapshot proposal with the id %s pass the execution of the array of Module transactions with the hash 0x%s? The hash is the keccak of the concatenation of the individual EIP-712 hashes of the Module transactions. If this question was asked before the Snapshot proposal was resolved it should ALWAYS be resolved to INVALID!",
  lang: "en",
  type: "bool",
  category: "DAO proposal",
};
let proxyAddress0: string;
let proxyAddress1: string;
let proxyAddress2: string;
let proxyAddress3: string;

describe("Module can be deployed and configured via the DeterministicDeploymentHelper", () => {
  const timeout = 60;
  const cooldown = 60;
  const expiration = 120;
  const bond = BigNumber.from(10000);
  const defaultTemplateId = BigNumber.from(0);

  const paramsTypes = [
    "address",
    "address",
    "address",
    "address",
    "uint32",
    "uint32",
    "uint32",
    "uint256",
    "uint256",
    "address",
  ];

  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const Factory = await hre.ethers.getContractFactory("ModuleProxyFactory");
    const RealityModuleETH = await hre.ethers.getContractFactory(
      "RealityModuleETH"
    );
    const factory = await Factory.deploy();

    const masterCopy = await RealityModuleETH.deploy(
      FIRST_ADDRESS,
      FIRST_ADDRESS,
      FIRST_ADDRESS,
      ZERO_ADDRESS,
      1,
      0,
      60,
      0,
      0,
      ZERO_ADDRESS
    );

    const Mock = await hre.ethers.getContractFactory("MockContract");
    const mock = await Mock.deploy();
    const oracle = await hre.ethers.getContractAt(
      "RealitioV3ERC20",
      mock.address
    );

    return { factory, masterCopy, mock, oracle };
  });

  it("option 0: can be deterministically deployed and set up, then configured with a custom template via `createTemplate`", async () => {
    // in use this call should be done as a delegatecall from the module owner. Here we do a direct call for testing.

    const { factory, masterCopy, mock, oracle } = await baseSetup();
    const [safe] = await ethers.getSigners();

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      "DeterministicDeploymentHelper"
    );

    const deploymentHelper = await DeterministicDeploymentHelper.deploy();

    const paramsValues = [
      deploymentHelper.address, // set the deterministic deployment helper to be the owner. In production this will be the Safe.
      safe.address,
      safe.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      defaultTemplateId,
      ARBITRATOR,
    ];
    const encodedParams = [new AbiCoder().encode(paramsTypes, paramsValues)];
    const initParams = masterCopy.interface.encodeFunctionData(
      "setUp",
      encodedParams
    );
    const receipt = await factory
      .deployModule(masterCopy.address, initParams, SALT_NONCE)
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );
    proxyAddress0 = newProxyAddress;

    const newProxy = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );
    expect(await newProxy.template()).to.be.eq(BigNumber.from(0));
    expect(await newProxy.owner()).to.be.eq(deploymentHelper.address);
    expect(await newProxy.avatar()).to.be.eq(safe.address);
    expect(await newProxy.target()).to.be.eq(safe.address);
    expect(await newProxy.oracle()).to.be.eq(oracle.address);
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR);
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.owner()).to.be.eq(deploymentHelper.address);

    await mock.givenMethodReturnUint(
      oracle.interface.getSighash("createTemplate"),
      5
    );

    await deploymentHelper
      .createTemplate(
        newProxyAddress,
        oracle.address,
        JSON.stringify(DEFAULT_TEMPLATE)
      )
      .then((tx: any) => tx.wait());

    expect(await newProxy.avatar()).to.be.eq(safe.address);
    expect(await newProxy.target()).to.be.eq(safe.address);
    expect(await newProxy.oracle()).to.be.eq(oracle.address);
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR);
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.template()).to.be.eq(BigNumber.from(5));
    expect(await newProxy.owner()).to.be.eq(deploymentHelper.address);
  });

  it("option 1: can be deterministically deployed and set up, then configured with a custom template and new owner via `createTemplateAndChangeOwner`", async () => {
    const { factory, masterCopy, mock, oracle } = await baseSetup();
    const [safe] = await ethers.getSigners();

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      "DeterministicDeploymentHelper"
    );

    const deploymentHelper = await DeterministicDeploymentHelper.deploy();

    const paramsValues = [
      deploymentHelper.address, // set the deterministic deployment helper to be the owner
      safe.address,
      safe.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      defaultTemplateId,
      ARBITRATOR,
    ];
    const encodedParams = [new AbiCoder().encode(paramsTypes, paramsValues)];
    const initParams = masterCopy.interface.encodeFunctionData(
      "setUp",
      encodedParams
    );
    const receipt = await factory
      .deployModule(masterCopy.address, initParams, SALT_NONCE)
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );
    proxyAddress1 = newProxyAddress;

    const newProxy = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );
    expect(await newProxy.template()).to.be.eq(BigNumber.from(0));
    expect(await newProxy.owner()).to.be.eq(deploymentHelper.address);

    await mock.givenMethodReturnUint(
      oracle.interface.getSighash("createTemplate"),
      5
    );

    await deploymentHelper
      .createTemplateAndChangeOwner(
        newProxyAddress,
        oracle.address,
        JSON.stringify(DEFAULT_TEMPLATE),
        safe.address
      )
      .then((tx: any) => tx.wait());

    expect(await newProxy.avatar()).to.be.eq(safe.address);
    expect(await newProxy.target()).to.be.eq(safe.address);
    expect(await newProxy.oracle()).to.be.eq(oracle.address);
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR);
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.template()).to.be.eq(BigNumber.from(5));
    expect(await newProxy.owner()).to.be.eq(safe.address);
  });

  it("option 2: can be deterministically set up and configured with a custom template via `deployWithEncodedParams`", async () => {
    const { factory, masterCopy, mock, oracle } = await baseSetup();
    const [safe] = await ethers.getSigners();

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      "DeterministicDeploymentHelper"
    );

    const deploymentHelper = await DeterministicDeploymentHelper.deploy();

    const paramsValues = [
      deploymentHelper.address, // set the deterministic deployment helper to be the owner
      safe.address,
      safe.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      defaultTemplateId,
      ARBITRATOR,
    ];
    const encodedParams = [new AbiCoder().encode(paramsTypes, paramsValues)];
    const initParams = masterCopy.interface.encodeFunctionData(
      "setUp",
      encodedParams
    );
    await mock.givenMethodReturnUint(
      oracle.interface.getSighash("createTemplate"),
      5
    );

    const receipt = await deploymentHelper
      .deployWithEncodedParams(
        factory.address,
        masterCopy.address,
        initParams,
        SALT_NONCE,
        oracle.address,
        JSON.stringify(DEFAULT_TEMPLATE),
        safe.address
      )
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );

    proxyAddress2 = newProxyAddress;

    const newProxy = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );

    expect(await newProxy.avatar()).to.be.eq(safe.address);
    expect(await newProxy.target()).to.be.eq(safe.address);
    expect(await newProxy.oracle()).to.be.eq(oracle.address);
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR);
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.template()).to.be.eq(BigNumber.from(5));
    expect(await newProxy.owner()).to.be.eq(safe.address);
  });

  it("option 3: can be deterministically set up and configured with a custom template via `deployWithTemplate`", async () => {
    const { factory, masterCopy, mock, oracle } = await baseSetup();
    const [safe] = await ethers.getSigners();

    const DeterministicDeploymentHelper = await hre.ethers.getContractFactory(
      "DeterministicDeploymentHelper"
    );

    const deploymentHelper = await DeterministicDeploymentHelper.deploy();

    await mock.givenMethodReturnUint(
      oracle.interface.getSighash("createTemplate"),
      5
    );

    const receipt = await deploymentHelper
      .deployWithTemplate(factory.address, masterCopy.address, SALT_NONCE, {
        realityOracle: oracle.address,
        templateContent: JSON.stringify(DEFAULT_TEMPLATE),
        owner: safe.address,
        avatar: safe.address,
        target: safe.address,
        timeout: timeout,
        cooldown: cooldown,
        expiration: expiration,
        bond: bond,
        arbitrator: ARBITRATOR,
      })
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );

    proxyAddress3 = newProxyAddress;

    const newProxy = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );
    expect(await newProxy.avatar()).to.be.eq(safe.address);
    expect(await newProxy.target()).to.be.eq(safe.address);
    expect(await newProxy.oracle()).to.be.eq(oracle.address);
    expect(await newProxy.questionArbitrator()).to.be.eq(ARBITRATOR);
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.template()).to.be.eq(BigNumber.from(5));
    expect(await newProxy.owner()).to.be.eq(safe.address);
  });

  it("no matter what deployment function is used, the module proxy should end up at the same address", async () => {
    expect(proxyAddress0).to.equal(proxyAddress1);
    expect(proxyAddress0).to.equal(proxyAddress2);
    expect(proxyAddress0).to.equal(proxyAddress3);
  });
});
