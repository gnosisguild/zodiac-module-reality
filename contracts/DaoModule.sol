// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "./interfaces/Realitio.sol";

contract Enum {
    enum Operation {
        Call, DelegateCall
    }
}

interface Executor {
    /// @dev Allows a Module to execute a transaction.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, Enum.Operation operation)
        external
        returns (bool success);
}

contract DaoModule {

    bytes32 public constant INVALIDATED = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    bytes32 public constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;
    // keccak256(
    //     "EIP712Domain(uint256 chainId,address verifyingContract)"
    // );

    bytes32 public constant TRANSACTION_TYPEHASH = 0x72e9670a7ee00f5fbf1049b8c38e3f22fab7e9b85029e85cf9412f17fdd5c2ad;
    // keccak256(
    //     "Transaction(address to,uint256 value,bytes data,uint8 operation,uint256 nonce)"
    // );

    event ProposalQuestionCreated(
        bytes32 indexed questionId,
        string indexed proposalId
    );

    Executor public immutable executor;
    Realitio public immutable oracle;
    uint256 public template;
    uint32 public questionTimeout;
    uint32 public questionCooldown;
    address public questionArbitrator;
    uint256 public minimumBond;
    // Mapping of question hash to question id. Special case: INVALIDATED for question hashes that have been invalidated
    mapping(bytes32 => bytes32) public questionIds;
    // Mapping of questionHash to transactionHash to execution state
    mapping(bytes32 => mapping(bytes32 => bool)) public executedProposalTransactions;

    constructor(Executor _executor, Realitio _oracle, uint32 timeout, uint32 cooldown, uint256 bond, uint256 templateId) {
        require(timeout > 0, "Timeout has to be greater 0");
        executor = _executor;
        oracle = _oracle;
        questionTimeout = timeout;
        questionCooldown = cooldown;
        questionArbitrator = address(_executor);
        minimumBond = bond;
        template = templateId;
    }
    
    modifier executorOnly() {
        require(msg.sender == address(executor), "Not authorized");
        _;
    }

    /// @notice This can only be called by the executor
    function setQuestionTimeout(uint32 timeout) 
        public
        executorOnly()
    {
        require(timeout > 0, "Timeout has to be greater 0");
        questionTimeout = timeout;
    }

    /// @notice This can only be called by the executor
    function setQuestionCooldown(uint32 cooldown) 
        public
        executorOnly()
    {
        questionCooldown = cooldown;
    }

    /// @notice This can only be called by the executor
    function setArbitrator(address arbitrator)
        public
        executorOnly()
    {
        questionArbitrator = arbitrator;
    }

    /// @notice This can only be called by the executor
    function setMinimumBond(uint256 bond)
        public
        executorOnly()
    {
        minimumBond = bond;
    }

    /// @notice This can only be called by the executor
    function setTemplate(uint256 templateId)
        public
        executorOnly()
    {
        template = templateId;
    }

    /// @dev Function to add a proposal that should be considered for execution
    /// @param proposalId Id that should identify the proposal uniquely
    /// @param txHashes EIP-712 hashes of the transactions that should be executed
    /// @notice The nonce used for the question by this function is always 0
    function addProposal(string memory proposalId, bytes32[] memory txHashes) public {
        addProposalWithNonce(proposalId, txHashes, 0);
    }

    /// @dev Function to add a proposal that should be considered for execution
    /// @param proposalId Id that should identify the proposal uniquely
    /// @param txHashes EIP-712 hashes of the transactions that should be executed
    /// @param nonce Nonce that should be used when asking the question on the oracle
    function addProposalWithNonce(string memory proposalId, bytes32[] memory txHashes, uint256 nonce) public {
        // We load some storage variables into memory to save gas
        uint256 templateId = template;
        uint32 timeout = questionTimeout;
        address arbitrator = questionArbitrator;
        // We generate the question string used for the oracle
        string memory question = buildQuestion(proposalId, txHashes);
        bytes32 questionHash = keccak256(bytes(question));
        if (nonce > 0) {
            // Previous nonce must have been invalidated by the oracle.
            // However, if the proposal was internally invalidated, it should not be possible to ask it again.
            bytes32 currentQuestionId = questionIds[questionHash];
            require(currentQuestionId != INVALIDATED, "This proposal has been marked as invalid");
            require(oracle.resultFor(currentQuestionId) == INVALIDATED, "Previous proposal was not invalidated");
        } else {
            require(questionIds[questionHash] == bytes32(0), "Proposal has already been submitted");
        }
        bytes32 expectedQuestionId = getQuestionId(
            templateId, question, arbitrator, timeout, 0, nonce
        );
        // Set the question hash for this quesion id
        questionIds[questionHash] = expectedQuestionId;
        // Ask the question with a starting time of 0, so that it can be immediately answered
        bytes32 questionId = oracle.askQuestion(templateId, question, arbitrator, timeout, 0, nonce);
        require(expectedQuestionId == questionId, "Unexpected question id");
        emit ProposalQuestionCreated(questionId, proposalId);
    }

    /// @dev Marks a proposal as invalid, preventing execution of the connected transactions
    /// @param proposalId Id that should identify the proposal uniquely
    /// @param txHashes EIP-712 hashes of the transactions that should be executed
    /// @notice This can only be called by the executor
    function markProposalAsInvalid(string memory proposalId, bytes32[] memory txHashes) 
        public 
        // Executor only is checked in markProposalAsInvalidByHash(bytes32)
    {
        string memory question = buildQuestion(proposalId, txHashes);
        bytes32 questionHash = keccak256(bytes(question));
        markProposalAsInvalidByHash(questionHash);
    }

    /// @dev Marks a question hash as invalid, preventing execution of the connected transactions
    /// @param questionHash Question hash calculated based on the proposal id and txHashes
    /// @notice This can only be called by the executor
    function markProposalAsInvalidByHash(bytes32 questionHash) 
        public 
        executorOnly()
    {
        questionIds[questionHash] = INVALIDATED;
    }

    /// @dev Executes the transactions of a proposal via the executor if accepted
    /// @param proposalId Id that should identify the proposal uniquely
    /// @param txHashes EIP-712 hashes of the transactions that should be executed
    /// @param to Target of the transaction that should be executed
    /// @param value Wei value of the transaction that should be executed
    /// @param data Data of the transaction that should be executed
    /// @param operation Operation (Call or Delegatecall) of the transaction that should be executed
    /// @notice The txIndex used by this function is always 0
    function executeProposal(string memory proposalId, bytes32[] memory txHashes, address to, uint256 value, bytes memory data, Enum.Operation operation) public {
        executeProposalWithIndex(proposalId, txHashes, to, value, data, operation, 0);
    }

    /// @dev Executes the transactions of a proposal via the executor if accepted
    /// @param proposalId Id that should identify the proposal uniquely
    /// @param txHashes EIP-712 hashes of the transactions that should be executed
    /// @param to Target of the transaction that should be executed
    /// @param value Wei value of the transaction that should be executed
    /// @param data Data of the transaction that should be executed
    /// @param operation Operation (Call or Delegatecall) of the transaction that should be executed
    /// @param txIndex Index of the transaction hash in txHashes. This is used as the nonce for the transaction, to make the tx hash unique
    function executeProposalWithIndex(string memory proposalId, bytes32[] memory txHashes, address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 txIndex) public {
        // We use the hash of the question to check the execution state, as the other parameters might change, but the question not
        bytes32 questionHash = keccak256(bytes(buildQuestion(proposalId, txHashes)));
        // Lookup question id for this proposal
        bytes32 questionId = questionIds[questionHash];
        // Question hash needs to set to be eligible for execution
        require(questionId != bytes32(0), "No question id set for provided proposal");
        require(questionId != INVALIDATED, "Proposal has been invalidated");

        bytes32 txHash = getTransactionHash(to, value, data, operation, txIndex);
        require(txHashes[txIndex] == txHash, "Unexpected transaction hash");

        // Check that the result of the question is 1 (true)
        require(oracle.resultFor(questionId) == bytes32(uint256(1)), "Transaction was not approved");
        uint256 minBond = minimumBond;
        require(minBond == 0 || minBond <= oracle.getBond(questionId), "Bond on question not high enough");
        uint32 finalizeTs = oracle.getFinalizeTS(questionId);
        require(finalizeTs + uint256(questionCooldown) < block.timestamp, "Wait for additional cooldown");
        // Check this is either the first transaction in the list or that the previous question was already approved
        require(txIndex == 0 || executedProposalTransactions[questionHash][txHashes[txIndex - 1]], "Previous transaction not executed yet");
        // Check that this question was not executed yet
        require(!executedProposalTransactions[questionHash][txHash], "Cannot execute transaction again");
        // Mark transaction as executed
        executedProposalTransactions[questionHash][txHash] = true;
        // Execute the transaction via the executor. We do not care about the return value (indicating if the internal tx was a success).
        // But if the transaction reverts it will be propagated up (in case this module was not allowed to execute transactions).
        executor.execTransactionFromModule(to, value, data, operation);
    }

    /// @dev Build the question by combining the proposalId and the hex string of the hash of the txHashes
    /// @param proposalId Id of the proposal that proposes to execute the transactions represented by the txHashes
    /// @param txHashes EIP-712 Hashes of the transactions that should be executed
    function buildQuestion(string memory proposalId, bytes32[] memory txHashes) public pure returns(string memory) {
        string memory txsHash = bytes32ToAsciiString(keccak256(abi.encodePacked(txHashes)));
        return string(abi.encodePacked(proposalId, bytes3(0xe2909f), txsHash));
    }

    /// @dev Generate the question id.
    /// @notice It is required that this is the same as for the oracle implementation used.
    function getQuestionId(uint256 templateId, string memory question, address arbitrator, uint32 timeout, uint32 openingTs, uint256 nonce) public view returns(bytes32) {
        bytes32 contentHash = keccak256(abi.encodePacked(templateId, openingTs, question));
        return keccak256(abi.encodePacked(contentHash, arbitrator, timeout, this, nonce));
    }
    
    /// @dev Returns the chain id used by this contract.
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }
    
    /// @dev Generates the data for the module transaction hash (required for signing)
    function generateTransactionHashData(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation,
        uint256 nonce
    ) public view returns(bytes memory) {
        uint256 chainId = getChainId();
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_SEPARATOR_TYPEHASH, chainId, this));
        bytes32 transactionHash = keccak256(
            abi.encode(TRANSACTION_TYPEHASH, to, value, keccak256(data), operation, nonce)
        );
        return abi.encodePacked(bytes1(0x19), bytes1(0x01), domainSeparator, transactionHash);
    }

    function getTransactionHash(address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 nonce) public view returns(bytes32) {
        return keccak256(generateTransactionHashData(to, value, data, operation, nonce));
    }

    function bytes32ToAsciiString(bytes32 _bytes) internal pure returns (string memory) {
        bytes memory s = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            uint8 b = uint8(bytes1(_bytes << i * 8));
            uint8 hi = uint8(b) / 16;
            uint8 lo = uint8(b) % 16;
            s[2 * i] = char(hi);
            s[2 * i + 1] = char(lo);
        }
        return string(s);
    }

    function char(uint8 b) internal pure returns (bytes1 c) {
        if (b < 10) return bytes1(b + 0x30);
        else return bytes1(b + 0x57);
    }
}