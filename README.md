# Snapshot DAO Module

### Flow (Proposal)
- Proposal that links to Snapshot is submitted to module
  - Proposal contains Snapshot ID
  - Proposal contains Transaction data
- Module creates realitio question
  - Expected answer is a hash of the transaction that should be executed
  - Module is arbitrator for questions
- Answer to a question should be hash of transaction that is to be executed
- Module transaction can be triggered after answer has been finalized
  - Add additional delay

### Notes

- Evaluate if singleton deployment is preferred
  - Dedicated DAO module per Safe or general purpose DAO module
- Realitio
  - https://www.npmjs.com/package/@realitio/realitio-contracts
  - https://github.com/realitio/realitio-contracts/blob/master/truffle/contracts/RealitioERC20.sol
