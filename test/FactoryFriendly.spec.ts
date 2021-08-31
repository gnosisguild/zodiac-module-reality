import { expect } from "chai";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { AbiCoder } from "ethers/lib/utils";
import { BigNumber } from "ethers";

const FIRST_ADDRESS = "0x0000000000000000000000000000000000000001";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const saltNonce = "0xfa";

describe("Module works with factory", () => {
  const timeout = 60;
  const cooldown = 60;
  const expiration = 120;
  const bond = BigNumber.from(10000);
  const templateId = BigNumber.from(1);

  const paramsTypes = [
    "address",
    "address",
    "address",
    "uint32",
    "uint32",
    "uint32",
    "uint256",
    "uint256",
  ];

  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const Factory = await hre.ethers.getContractFactory("ModuleProxyFactory");
    const DaoModuleETH = await hre.ethers.getContractFactory("DaoModuleETH");
    const factory = await Factory.deploy();

    const masterCopy = await DaoModuleETH.deploy(
      FIRST_ADDRESS,
      FIRST_ADDRESS,
      ZERO_ADDRESS,
      1,
      0,
      60,
      0,
      0
    );

    return { factory, masterCopy };
  });

  it("should throw because master copy is already initialized", async () => {
    const { masterCopy } = await baseSetup();
    const [executor, oracle] = await ethers.getSigners();

    const encodedParams = new AbiCoder().encode(paramsTypes, [
      executor.address,
      executor.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      templateId,
    ]);

    await expect(masterCopy.setUp(encodedParams)).to.be.revertedWith(
      "Module is already initialized"
    );
  });

  it("should deploy new dao module proxy", async () => {
    const { factory, masterCopy } = await baseSetup();
    const [executor, oracle] = await ethers.getSigners();
    const paramsValues = [
      executor.address,
      executor.address,
      oracle.address,
      timeout,
      cooldown,
      expiration,
      bond,
      templateId,
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

    const newProxy = await hre.ethers.getContractAt(
      "DaoModuleETH",
      newProxyAddress
    );
    expect(await newProxy.questionTimeout()).to.be.eq(timeout);
    expect(await newProxy.questionCooldown()).to.be.eq(cooldown);
    expect(await newProxy.answerExpiration()).to.be.eq(expiration);
    expect(await newProxy.minimumBond()).to.be.eq(BigNumber.from(bond));
    expect(await newProxy.template()).to.be.eq(BigNumber.from(templateId));
  });
});
