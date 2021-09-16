# Reality Module

[![Build Status](https://github.com/gnosis/zodiac-module-reality/workflows/zodiac-module-reality/badge.svg?branch=main)](https://github.com/gnosis/zodiac-module-reality/actions)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/zodiac-module-reality/badge.svg?branch=main)](https://coveralls.io/github/gnosis/zodiac-module-reality)

This module allows for execution of transactions that have been approved via a Realitio question for execution. The question asked on Realitio consists of a proposal ID (e.g. an ipfs hash) that can be used to provide more information for the transactions to be executed. And of an array of EIP-712 based transaction hashes that represent the transactions that should be executed.

These two components (`proposalId` and `txHashes`) uniquely identify a question on the module. While it is possible to ask the same question with different Realitio question parameters, it is only possible to execute transactions related to a specific question once.

Once the question on Realitio has resolved to "yes" that the transactions should be executed, they are submitted to the immutable executor defined in the module. Transactions defined in questions that resolve to "no" or "invalid" cannot be executed by the module.

This module is intended to be used with the [Gnosis Safe](https://github.com/gnosis/safe-contracts).

### Features

- Submit proposals uniquely identified by a `proposalId` and an array of `txHashes`, to create a Realitio question that validates the execution of the connected transactions.
- Proposals can be marked invalid by the `executor` using `markProposalInvalid` preventing the execution of the transactions related to that proposal
- The Realitio question parameters (`templateId`, `timeout`, `arbitrator`) are set on the module by the executor
- A `minimum bond` can be set that is required to be staked on a Realitio answer before the transactions can be executed
- A `cooldown` can be specified representing the minimum time that needs to pass after the Realitio question has been answered before the transactions can be executed

### Flow

- Create question on Realitio via the `addProposal` method of this module.
- Question needs to be answered on Realitio with yes (1) to approve it for execution.
- Once the has a result and the `cooldown` period has passed the transaction(s) can be execute via `executeProposal`

### Definitions

#### Transaction nonce or index

The `nonce` of a transaction makes it possible to have two transactions with the same `to`, `value` and `data` but still generate a different transaction hash. This is important as all hashes in the `txHashes` array should be unique. To make sure that this is the case the module will always use the `index` of the transaction hash inside the `txHashes` array as a nonce. So the first transaction to be executed has the `nonce` with the value `0`, the second with the value `1`, and so on.

Therefore we can simplify it to the following statement:
The `nonce` of a Reality module transaction is equals to the `index` of that transactions hash in the `txHashes` array.

#### Proposal nonce

There is a chance that a question for a proposal is marked invalid on the oracle (e.g. when it is asked to early). In this case it should be possible to ask the question again. For this we need to be able to generate a new question ID. For this it is possible to provide the next higher `nonce` compared to the last invalidated proposal. So in case the first proposal (with the default `nonce` of `0`) was marked invalid on the oracle, a new proposal can be submitted with the `nonce` of `1`.

#### Oracle / Realitio

The Reality module depends on an oracle to determine if a proposal was expected and was deemed valid. The following assumptions are being made:

- The oracle MUST implement the [Realitio contract interface](./contracts/interfaces/Realitio.sol)
- It MUST not be possible to ask the same question with the same parameters again
- Once a result is known for a question and it is finalized it MUST not change
- The oracle MUST use the same question ID generation algorithm as this module

The reference oracle implementations are the Realitio contracts. These can be found on

- https://www.npmjs.com/package/@realitio/realitio-contracts
- https://github.com/realitio/realitio-contracts/
  - Ether: https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/Realitio.sol
  - ERC20: https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/RealitioERC20.sol

### Failed transactions

It is required that the transactions from a proposal are successful (should not internally revert for any reason). If any of the transactions of a proposal fail it will not be possible to continue with the execution of the following transactions. This is to prevent subsequent transactions being executed in a scenario where earlier transactions failed due to the gas limit being too low or due to other errors.

Transactions that failed will _not_ be marked as executed and therefore can be executed at any later point in time. This is a potential risk and therefore it is recommended to either set an answer expiration time or invalidate the proposal (e.g. via another proposal).

### Answer expiration

The module can be configured so that positive answers will expire after a certain time. This can be done by calling `setAnswerExpiration` with a time duration in seconds. If the transactions related to the proposal are not executed before the answer expires, it will not be possible to execute them. This is useful in the case of transactions that revert and therefore cannot be executed, to prevent that they are unexpectedly executed in the future. Negative answers (no or invalid) cannot expire.

Note: If the expiration time is set to `0` answers will never expire. This also means answers that expired before will become available again. To prevent this, it is recommended to call `markProposalWithExpiredAnswerAsInvalid` immediately after any proposal expires (or on all outstanding expired answers prior to setting the expiration date to `0`), this will mark a proposal with an expired answer as invalid. This method can be called by anyone.

### EIP-712 details

[EIP-712](https://github.com/Ethereum/EIPs/blob/master/EIPS/eip-712.md) is used to generate the hashes for the transactions to be executed. The following EIP-712 domain and types are used.

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

### Solidity Compiler

The contracts have been developed with [Solidity 0.8.0](https://github.com/ethereum/solidity/releases/tag/v0.8.0) in mind. This version of Solidity made all arithmetic checked by default, therefore eliminating the need for explicit overflow or underflow (or other arithmetic) checks.

### Setup Guide

Follow our [SafeSnap Setup Guide](./docs/setup_guide.md) to setup a Reality module and connect it to Snapshot.

### Audits

An audit has been performed by the [G0 group](https://github.com/g0-group).

The audit results are available as a pdf in [this repo](./docs/ZodiacRealityModuleSep2021.pdf) or on the [g0-group repo](https://github.com/g0-group/Audits/blob/e11752abb010f74e32a6fc61142032a10deed578/ZodiacRealityModuleSep2021.pdf).

### Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.