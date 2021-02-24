# DAO Module
[![Build Status](https://github.com/gnosis/dao-module/workflows/dao-module/badge.svg?branch=main)](https://github.com/gnosis/dao-module/actions)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/dao-module/badge.svg?branch=main)](https://coveralls.io/github/gnosis/dao-module)

This module allow to execute transactions that have been approved via a Realitio question for execution. The question asked on Realitio consists of a proposal id (e.g. an ipfs hash) that can be used to provide more information for the transactions to be executed. And of an array of EIP-712 based transaction hashes that represent the transactions that should be executed. 

These two components (`proposalId` and `txHashes`) uniquely identify a question on the module. While it is possible to ask the same question with different Realitio question parameters, it is only possible to execute transactions related to a specific question once.

Once the question on Realitio has confirmed that the transactions should be executed, they are submitted to the immutable executor defined in the module.

### Features
- Submit proposals uniquely identified by a `proposalId` and an array of `txHashes`, to create a Realitio question that validates the execution of the connected transactions.
- Proposals can be marked invalid by the `executor` using `markProposalInvalid` preventing the execution of the transactions related to that proposal
- The Realitio question parameters (`templateId`, `timeout`, `arbitrator`) are set on the module by the executor
- A `minimum bond` can be set that is required to be stacked on a Realitio answer before the transactions can be executed
- A `cooldown` can be specified representing the minimum time that needs to pass after the Realitio question has been answered before the transactions can be executed

### Flow
- Create question on Realitio via the `addProposal` method of this module.
- Question needs to be answered on Realitio with yes (1) to approve it for execution.
- Once the has a result and the `cooldown` period has passed the transaction(s) can be execute via `executeProposal`

### Definitions

#### Transaction nonce or index

The `nonce` of a transaction makes it possible to have two transactions with the same `to`, `value` and `data` but still generate a different transaction hash. This is important as all hashes in the `txHashes` array should be unique. To make sure that this is the case the module will always use the `index` of the transaction hash inside the `txHashes` array as a nonce. So the first transction to be executed has the `nonce` with the value `0`, the second with the value `1`, and so on.

Therefore we can simplify it to the following statement:
The `nonce` of a DAO module transaction is equals to the `index` of that transactions hash in the `txHashes` array.

#### Proposal nonce

There is the change that a question for a proposal is marked invalid on the oracle (e.g. when it is asked to early). In this case it should be possible to ask the question again. For this we need to be able to generate a new question id. For this it is possible to provide the next higher `nonce` compared to the last invalidated proposal. So in case the first proposal (with the default `nonce` of `0`) was marked invalid on the oracle, a new proposal can be submitted with the `nonce` of `1`.

### EIP-712 details

[EIP-712](https://github.com/Ethereum/EIPs/blob/master/EIPS/eip-712.md) is used to generate the hashes for the transactions to be executed. The following EIP-712 domain and types are used

#### Domain

```
{
  EIP712Domain: [
    { type: "uint256", name: "chainId" },
    { type: "address", name: "verifyingContract" }
  ]
}
```

#### TransactionType

```
{
  Transaction: [
    { type: "address", name: "to" },
    { type: "uint256", name: "value" },
    { type: "bytes", name: "data" },
    { type: "uint8", name: "operation" },
    { type: "uint256", name: "nonce" }
  ]
}
```

### Example

- `yarn build`
- `yarn hardhat --network rinkeby setup --dao <safe_address> --oracle <realitio_address> --cooldown 60 --timeout 30`
- Enable module (e.g. with transaction builder and abi from `0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F`)
- `yarn hardhat --network rinkeby addProposal --module <module_address> --proposal-file sample_proposal.json`
- Resolve oracle (e.g. answer question on Rinkeby https://reality.eth.link/app/)
- `yarn hardhat --network rinkeby executeProposal --module <module_address> --question <question_id_from_realitio> --proposal-file sample_proposal.json`

### Notes

- Realitio contracts can be found via
  - https://www.npmjs.com/package/@realitio/realitio-contracts
  - https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/RealitioERC20.sol

### Audit Notes

#### Consistency
- Check for duplicate tx hashes
  - Note: Checking this naively (comparing all elements) is quite expensive. We require `n*(n-1)/2` loops and each loop is around 400 gas.
- Use tx index as nonce to avoid duplication :heavy_check_mark:
- When the Realitio question params (e.g. `templateId`) change after a question has been marked invalid on the oracle. It will not be possible to try this question again with a higher nonce.

#### Gas usage
- When the `questionId` is `0` or `INVALIDATED` oracle.resultFor won't return 1, therefore the requires on the `questionId` could be removed
- When asking submitting a proposal with a `nonce > 0` it is not required to check if the `questionId` has been invalidated as we check if it is the `questionId` with the previous nonce
