import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { task, types } from "hardhat/config";
import defaultTemplate from "./defaultTemplate.json";
import { Contract } from "ethers";

task("setup", "Provides the clearing price to an auction")
    .addParam("dao", "Address of the DAO (e.g. Safe)", undefined, types.string)
    .addParam("oracle", "Address of the oracle (e.g. Realitio)", undefined, types.string)
    .addParam(
        "template", 
        "Template that should be used for proposal questions (See https://github.com/realitio/realitio-dapp#structuring-and-fetching-information)", 
        undefined, 
        types.string
    )
    .addParam("timeout", "Timeout in seconds that should be required for the oracle", 48 * 3600, types.int, true)
    .addParam("cooldown", "Cooldown in seconds that should be required after a oracle provided answer", 24 * 3600, types.int, true)
    .addParam("expiration", "Time duration in seconds for which a positive answer is valid. After this time the answer is expired", 7 * 24 * 3600, types.int, true)
    .addParam("bond", "Minimum bond that is required for an answer to be accepted", "0", types.string, true)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);
        const Module = await hardhatRuntime.ethers.getContractFactory("DaoModule");
        const module = await Module.deploy(taskArgs.dao, taskArgs.oracle, taskArgs.timeout, taskArgs.cooldown, taskArgs.expiration, taskArgs.bond, taskArgs.template);

        console.log("Module deployed to:", module.address);
    });

task("factory-setup", "Deploy and initialize DAO Module through a Proxy Factory")
    .addParam("factory", "Address of the Proxy Factory", undefined, types.string)
    .addParam("singleton", "Address of the DAO Module Master Copy", undefined, types.string)
    .addParam("dao", "Address of the DAO (e.g. Safe)", undefined, types.string)
    .addParam("oracle", "Address of the oracle (e.g. Realitio)", undefined, types.string)
    .addParam(
        "template", 
        "Template that should be used for proposal questions (See https://github.com/realitio/realitio-dapp#structuring-and-fetching-information)", 
        undefined, 
        types.string
    )
    .addParam("timeout", "Timeout in seconds that should be required for the oracle", 48 * 3600, types.int, true)
    .addParam("cooldown", "Cooldown in seconds that should be required after a oracle provided answer", 24 * 3600, types.int, true)
    .addParam("expiration", "Time duration in seconds for which a positive answer is valid. After this time the answer is expired", 7 * 24 * 3600, types.int, true)
    .addParam("bond", "Minimum bond that is required for an answer to be accepted", "0", types.string, true)
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);

        const FactoryAbi = [
            `function deployModule(
                  address singleton, 
                  bytes memory initializer
              ) public returns (address clone)`,
          ];
        
        const Factory = new Contract(taskArgs.factory, FactoryAbi, caller)
        const Module = await hardhatRuntime.ethers.getContractFactory("DaoModule");

        const initParams = Module.interface.encodeFunctionData('setUp', [
            taskArgs.dao, 
            taskArgs.oracle,
            taskArgs.timeout,
            taskArgs.cooldown,
            taskArgs.expiration,
            taskArgs.bond,
            taskArgs.template

        ])

        const receipt = await Factory.deployModule(taskArgs.singleton, initParams).then((tx: any) => tx.wait(3));
        console.log("Module deployed to: ", receipt.logs[1].address);
    });
task("verifyEtherscan", "Verifies the contract on etherscan")
    .addParam("module", "Address of the module", undefined, types.string)
    .addParam("dao", "Address of the DAO (e.g. Safe)", undefined, types.string)
    .addParam("oracle", "Address of the oracle (e.g. Realitio)", undefined, types.string)
    .addParam(
        "template", 
        "Template that should be used for proposal questions (See https://github.com/realitio/realitio-dapp#structuring-and-fetching-information)", 
        undefined, 
        types.string
    )
    .addParam("timeout", "Timeout in seconds that should be required for the oracle", 48 * 3600, types.int, true)
    .addParam("cooldown", "Cooldown in seconds that should be required after a oracle provided answer", 24 * 3600, types.int, true)
    .addParam("expiration", "Time duration in seconds for which a positive answer is valid. After this time the answer is expired", 7 * 24 * 3600, types.int, true)
    .addParam("bond", "Minimum bond that is required for an answer to be accepted", "0", types.string, true)
    .setAction(async (taskArgs, hardhatRuntime) => {
        await hardhatRuntime.run("verify", {
            address: taskArgs.module,
            constructorArgsParams: [
                taskArgs.dao, taskArgs.oracle, `${taskArgs.timeout}`, `${taskArgs.cooldown}`, `${taskArgs.expiration}`, `${taskArgs.bond}`, taskArgs.template
            ]
        })
    });

task("createDaoTemplate", "Creates a question template on the oracle address")
    .addParam("oracle", "Address of the oracle (e.g. Realitio)", undefined, types.string)
    .addParam(
        "template", 
        "Template string for question (should include placeholders for proposal id and txs hash)", 
        JSON.stringify(defaultTemplate), 
        types.string,
        true
    )
    .setAction(async (taskArgs, hardhatRuntime) => {
        const [caller] = await hardhatRuntime.ethers.getSigners();
        console.log("Using the account:", caller.address);
        const oracle = await hardhatRuntime.ethers.getContractAt("Realitio", taskArgs.oracle);
        const receipt = await oracle.createTemplate(taskArgs.template).then((tx: any) => tx.wait());
        const id = receipt.logs[0].topics[1]
        console.log("Template id:", id);
    });


export { };