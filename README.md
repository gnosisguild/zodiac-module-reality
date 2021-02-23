# Snapshot DAO Module
[![Build Status](https://github.com/gnosis/dao-module/workflows/dao-module/badge.svg?branch=development)](https://github.com/gnosis/dao-module/actions)
[![Coverage Status](https://coveralls.io/repos/github/gnosis/dao-module/badge.svg?branch=main)](https://coveralls.io/github/gnosis/dao-module)

### Flow (Proposal)
- Question for Snapshot vote is posted on Realitio
  - Question contains Snapshot ID
  - Question contains array of module transactions
  - Format: `<SnapshotId>us<Hash of module transactions>`
  - Template: `{"title": "Did the Snapshop proposal with the id %s pass the execution of the array of Module transactions that have the hash 0x%s? The hash is the keccak of the concatenation of the individual EIP-712 hashes of the Module transactions.", "lang": "en", "type": "bool"}`
  - Hashing: EIP-712 hash for each module transaction, then `keccak(abi.encodePacked(transactionHashes))`
- Answer is posted to Realitio 
  - Module expects `bool` as answer
- Module transaction can be triggered after answer has been finalized
  - Add additional delay

### Notes

- Realitio
  - https://www.npmjs.com/package/@realitio/realitio-contracts
  - https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/RealitioERC20.sol
  - Rinkeby: `0x3D00D77ee771405628a4bA4913175EcC095538da`

### Example

- `yarn build`
- `yarn hardhat --network rinkeby setup --dao <safe_address> --oracle <realitio_address> --cooldown 60 --timeout 30`
- Enable module (e.g. with transaction builder and abi from `0x34CfAC646f301356fAa8B21e94227e3583Fe3F5F`)
- `yarn hardhat --network rinkeby addProposal --module <module_address> --proposal-file sample_proposal.json`
- Resolve oracle (e.g. answer question on Rinkeby https://reality.eth.link/app/)
- `yarn hardhat --network rinkeby executeProposal --module <module_address> --question <question_id_from_realitio> --proposal-file sample_proposal.json`