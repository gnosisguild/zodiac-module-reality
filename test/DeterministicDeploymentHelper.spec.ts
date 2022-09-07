import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AbiCoder } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const FIRST_ADDRESS = "0x0000000000000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const saltNonce = "0xfa";
const defaultTemplate = {
  title:
    "Did the Snapshot proposal with the id %s pass the execution of the array of Module transactions with the hash 0x%s? The hash is the keccak of the concatenation of the individual EIP-712 hashes of the Module transactions. If this question was asked before the Snapshot proposal was resolved it should ALWAYS be resolved to INVALID!",
  lang: "en",
  type: "bool",
  category: "DAO proposal",
};

describe("Module can be deployed and configured via the DeterministicDeploymentHelper", () => {
  const timeout = 60;
  const cooldown = 60;
  const expiration = 120;
  const bond = BigNumber.from(10000);
  const templateId = BigNumber.from(0);

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

  it("can be deterministically set up and configured with a custom template", async () => {
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
      templateId,
      oracle.address,
    ];
    const encodedParams = [new AbiCoder().encode(paramsTypes, paramsValues)];
    const initParams = masterCopy.interface.encodeFunctionData(
      "setUp",
      encodedParams
    );
    const receipt = await factory
      .deployModule(masterCopy.address, initParams, saltNonce)
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );

    const newProxyStep1 = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );
    expect(await newProxyStep1.template()).to.be.eq(BigNumber.from(0));
    expect(await newProxyStep1.owner()).to.be.eq(deploymentHelper.address);

    await mock.givenMethodReturnUint(
      oracle.interface.getSighash("createTemplate"),
      5
    );

    await deploymentHelper
      .createTemplateAndChangeOwner(
        JSON.stringify(defaultTemplate),
        oracle.address,
        newProxyAddress,
        safe.address
      )
      .then((tx: any) => tx.wait());

    const newProxyStep2 = await hre.ethers.getContractAt(
      "RealityModuleETH",
      newProxyAddress
    );

    expect(await newProxyStep2.template()).to.be.eq(BigNumber.from(5));
    expect(await newProxyStep2.owner()).to.be.eq(safe.address);
  });
});
