# Zodiac Reality Module Setup Guide

This is a technical guide that uses command line tools, [to set up using the Zodiac App and UI, go here.](https://gnosis.github.io/zodiac/docs/tutorial-module-reality/get-started)

This guide shows how to setup the Reality module with a Gnosis Safe on the Rinkeby testnetwork. It will use [Reality.eth](https://realit.io/) and can be used with [Snapshot](https://snapshot.org/).

The Reality Module belongs to the [Zodiac](https://github.com/gnosis/zodiac) collection of tools. If you have any questions about Zodiac, join the [Gnosis Guild Discord](https://discord.gg/wwmBWTgyEq). Follow [@GnosisGuild](https://twitter.com/gnosisguild) on Twitter for updates. For more information on the Reality Module (formerly SafeSnap) please refer to the original [Gnosis blog post](https://blog.gnosis.pm/ea67eb95c34f).

## Prerequisites

To start the process, you need to create a Gnosis Safe on the Rinkeby testnetwork, for exampe on [https://rinkeby.gnosis-safe.io](https://rinkeby.gnosis-safe.io)). This Safe will represent the DAO and hold its assets, such as tokens and collectibles. A Safe transaction is required to set up the Reality Module.

For the hardhat tasks to work, the environment needs to be properly configured. See the [sample env file](../.env.sample) for more information.

The guide will use the Rinkeby ETH Reality.eth V3 contract at [`0xDf33060F476F8cff7511F806C72719394da1Ad64`](https://rinkeby.etherscan.io/address/0xDf33060F476F8cff7511F806C72719394da1Ad64#code). Other network addresses can be found in the Truffle build folder on the [Reality.eth GitHub repo](https://github.com/RealityETH/monorepo/tree/main/packages/contracts/chains/deployments).

DISCLAIMER: Check the deployed Reality.eth contracts before using them.

## Setup the Reality.eth template

As part of the setup, you need to define or choose a template on Reality.eth. More information on how to format templates can be found in [their docs](https://github.com/realitio/realitio-dapp#structuring-and-fetching-information).

To define your own template, a hardhat task is provided in the repository. It is possible to provide a template to that task via `--template`. Otherwise, the [default template](../src/tasks/defaultTemplate.json) is used.

The template should have roughly the following format:
```json
{
    "title": "Did the proposal with the id %s pass the execution of the transactions with hash 0x%s?",
    "lang": "en",
    "type": "bool",
    "category": "DAO Proposal"
}
```

- It is important that the `type` is `bool` as the module expects the outcome reported by Reality.eth to be `true`, `false` or `INVALID`.
- The `category` and `lang` can be freely choosen and are only used in the Reality.eth web interfaces.
- The title will also be displayed in the Reality.eth web interface and MUST include two `%s` placeholders.
  - The first placeholder is for the `id` of the proposal (e.g. an IPFS hash).
  - The second placeholder is the hash of the concatenation of the EIP-712 transaction hashes. See the [README](../README.md) for more information.
- IMPORTANT: The template should be clearly in accordance with when and how to vote on your questions.
  - An example can be found in [🍯DAO requirements](https://cloudflare-ipfs.com/ipfs/QmeJwtwdG4mPzC8sESrW7zqixZqdHDYnREz6ar9GCewgz7/).

DISCLAIMER: DO NOT BLINDLY COPY THE REQUIREMENTS. You should check the requirements and make the adjustments for your setup.

Using this template, you can run the task by using `yarn hardhat --network <network> createDaoTemplate --oracle <oracle address> --template <your template json>` and this should provide you with a template id.

For example, on Rinkeby using the default template this would be:
`yarn hardhat --network rinkeby createDaoTemplate ---oracle 0xDf33060F476F8cff7511F806C72719394da1Ad64`

For this guide we will assume that the returned template id is `0x0000000000000000000000000000000000000000000000000000000000000dad`.

You can also create your template using the [Reality.eth Template Builder UI](https://reality.eth.link/app/template-generator/). For more info on using it, [use this guide](https://gnosis.github.io/zodiac/docs/tutorial-module-reality/add-template#template-builder).

Now that we have a template, a hardhat task can be used to deploy a Reality Module instance. The Reality Module will be linked to one DAO and an oracle. 

The module has ten attributes:

- `Owner`: Address that can call setter functions
- `Avatar`: Address of the DAO (e.g a Gnosis Safe)
- `Target`: Address on which the module will call `execModuleTransaction()`
- `Oracle`: Address of the oracle (e.g RealitioV3 contract address)
- `Timeout`: Duration that answers can be submitted to the oracle
- `Cooldown`: Duration (in seconds) required before the transaction can be executed (after the timeout has expired)
- `Expiration`: Duration that a transaction is valid in seconds (or 0 if valid forever) after the cooldown
- `Bond`: Minimum bond that is required for an answer to be accepted
- `Template ID`: ID of the template used for proposal questions (more information on how to format templates can be found in [their docs](https://github.com/realitio/realitio-dapp#structuring-and-fetching-information)
- `Arbitrator`: The oracle's arbitrator (e.g. see Realitio's arbitrator [requirements](https://realitio.github.io/docs/html/arbitrators.html) and its arbitrators [list](https://github.com/realitio/realitio-contracts/blob/master/config/arbitrators.json)).



Hardhat tasks can be used to deploy the Reality Module instance. There are two different ways to deploy the module, the first one is through a normal deployment, passing arguments to the constructor (without the `proxied` flag), or to deploy the module through a [Minimal Proxy Factory](https://eips.ethereum.org/EIPS/eip-1167) (with the `proxied` flag) to save on gas costs.

The master copy and factory address can be found in the [Zodiac repository](https://github.com/gnosis/zodiac/blob/master/src/factory/constants.ts). These are the addresses used when deploying the module through the factory.

This task requires the following parameters:

- `Owner`: Address that can call setter functions
- `Avatar`: Address of the DAO (e.g a Gnosis Safe)
- `Target`: Address on which the module will call `execTransactionFromModule()` (e.g. the next Zodiac module in the chain or the Avatar address)
- `Oracle`: Address of the oracle (e.g RealitioV3 contract address)
- `template`: the template to be used with RealitioV3
- `iserc20` (Optional): If set to true, the module `RealityERC20` is going to be deployed, otherwise `RealityETH` is deployed (false by default)
- `proxied` (Optional): Deploys the module through a proxy factory

There are more optional parameters, for more information run `yarn hardhat setup --help`.

An example for this on Rinkeby would be:

`yarn hardhat --network rinkeby setup --owner <owner_address> --avatar <avatar_address> --target <target_address> --oracle 0xDf33060F476F8cff7511F806C72719394da1Ad64 --template 0x0000000000000000000000000000000000000000000000000000000000000dad`

Once the module has been deployed, you should verify the source code. (Note: It is likely that Etherscan will verify it automatically, but just in case, you should verify it yourself.) If you use a network that is Etherscan compatible, and you configure the `ETHERSCAN_API_KEY` in your environment, you can use the provided hardhat task to do this.

An example of this on Rinkeby would be:
`yarn hardhat --network rinkeby verifyEtherscan --module 0x4242424242424242424242424242424242424242 --owner <owner_address> --avatar <avatar_address> --target <target_address> --oracle 0xDf33060F476F8cff7511F806C72719394da1Ad64 --template 0x0000000000000000000000000000000000000000000000000000000000000dad`

### Enabling the module

To allow the Reality Module to actually execute transactions, you must enable it on the Gnosis Safe to which it is connected. For this, it is possible to use the Zodiac app (enabling a custom module with the address of your newly deployed module above) or the Transaction Builder on https://rinkeby.gnosis-safe.io. For this you can follow our tutorial on [adding a module with the transaction builder](https://help.gnosis-safe.io/en/articles/4934427-add-a-module).

## Snapshot integration

To setup the newly deployed module on snapshot view our [Snapshot integration guide here.](https://gnosis.github.io/zodiac/docs/tutorial-module-reality/integrate-snapshot). 

## Monitoring your module

Because anyone can submit proposals to your module, it is strongly recommended to put in place monitoring practices. The Reality Module relies on the oracle (e.g. Reality.eth) to provide the correct answer, so that no malicious transactions are executed. In the worst case, the avatar (e.g. the connected Gnosis Safe) can invalidate a submitted proposal. See the [README](../README.md) for more information on this. 

To make sure that all of the involved stakeholders can react in a timely manner, the events emitted by the module contract should be monitored. Each time a new proposal is submitted, the contract will emit a `ProposalQuestionCreated` event with the following parameters:
```
event ProposalQuestionCreated(
    bytes32 indexed questionId, // e.g. Realityeth question id
    string indexed proposalId // e.g. Snapshot proposal id
);
```

There are different services available for monitoring such as the [OpenZepplin Defender Sentinel](https://docs.openzeppelin.com/defender/sentinel).

## Support

If you have any questions about the Reality Module or the Zodiac collection of tools, join the [Gnosis Guild Discord](https://discord.gg/wwmBWTgyEq).


## Deploy a master copy 

The master copy contracts can be deployed through the `yarn deploy` command. Note that this only should be done if the Reality Module contracts are updated. The ones referred to on the [Zodiac repository](https://github.com/gnosis/zodiac/blob/master/src/factory/constants.ts) should be used.
