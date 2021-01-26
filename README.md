# Snapshot DAO Module

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
