// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "./interfaces/Realitio.sol";

contract Enum {
    enum Operation {
        Call,
        DelegateCall
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

    uint256 public constant INVALIDATED_TIME = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    event ExecutionAnnouncement(
        bytes32 indexed questionId,
        string indexed proposalId,
        uint256 timestamp
    );

    Executor public executor;
    Realitio public oracle;
    uint256 public template;
    uint32 public questionTimeout;
    uint32 public questionCooldown;
    address public questionArbitrator;
    uint256 public minimumBond;
    mapping(bytes32 => mapping(string => uint256)) public executionAnnouncements;
    mapping(bytes32 => mapping(bytes32 => bool)) public executedPropsalTransactions;

    constructor(Executor _executor, Realitio _oracle, uint32 timeout, uint32 cooldown, uint256 bond, uint256 templateId) {
        require(timeout > 0, "Timeout has to be greater 0");
        executor = _executor;
        oracle = _oracle;
        questionTimeout = timeout;
        questionCooldown = cooldown;
        questionArbitrator = address(this);
        minimumBond = bond;
        template = templateId;
    }

    function setQuestionTimeout(uint32 timeout) public {
        require(msg.sender == address(executor), "Not authorized to update timeout");
        require(timeout > 0, "Timeout has to be greater 0");
        questionTimeout = timeout;
    }

    function setQuestionCooldown(uint32 cooldown) public {
        require(msg.sender == address(executor), "Not authorized to update cooldown");
        questionCooldown = cooldown;
    }

    function setArbitrator(address arbitrator) public {
        require(msg.sender == address(executor), "Not authorized to update arbitrator");
        questionArbitrator = arbitrator;
    }

    function setMinimumBond(uint256 bond) public {
        require(msg.sender == address(executor), "Not authorized to update minimum bond");
        minimumBond = bond;
    }

    function setTemplate(uint256 templateId) public {
        require(msg.sender == address(executor), "Not authorized to update template");
        template = templateId;
    }

    // TODO: take an array of complete transactions
    // Theoretically this doesn't need to be done via the module
    function addProposal(string memory proposalId, bytes32[] memory txHashes) public {
        uint256 templateId = template;
        uint32 timeout = questionTimeout;
        address arbitrator = questionArbitrator;
        string memory question = buildQuestion(proposalId, txHashes);
        bytes32 expectedQuestionId = getQuestionId(
            templateId, question, arbitrator, timeout, 0, 0
        );
        bytes32 questionId = oracle.askQuestion(templateId, question, arbitrator, timeout, 0, 0);
        require(expectedQuestionId == questionId, "Unexpected question id");
    }

    function requestProposalReadyForExecution(string memory proposalId, bytes32[] memory txHashes) public {
        bytes memory data = abi.encodeWithSignature(
            "markProposalReadyForExecution(string,bytes32[])", 
            proposalId, 
            txHashes
        );
        // We redirect the request via the executor
        // This is a preemptive check that this modules is enabled
        // This also notifies the executor that a proposal is being prepared for execution
        require(executor.execTransactionFromModule(address(this), 0, data, Enum.Operation.Call), "Could not mark proposal ready for execution");
    }

    function markProposalReadyForExecution(string memory proposalId, bytes32[] memory txHashes) public {
        require(msg.sender == address(executor), "Not authorized to mark proposal as ready");
        string memory question = buildQuestion(proposalId, txHashes);
        bytes32 questionId = getQuestionId(
            template, question, questionArbitrator, questionTimeout, 0, 0
        );
        require(executionAnnouncements[questionId][question] == 0, "Transaction was already marked as ready");
        executionAnnouncements[questionId][question] = block.timestamp;
        // We expect a boolean as an answer (1 == true)
        require(oracle.resultFor(questionId) == bytes32(uint256(1)), "Transaction was not approved");
        uint256 minBond = minimumBond;
        require(minBond == 0 || minBond <= oracle.getBond(questionId), "Bond on question not high enough");
        emit ExecutionAnnouncement(questionId, proposalId, block.timestamp);
    }

    function markProposalAsInvalid(bytes32 questionId, string memory proposalId, bytes32[] memory txHashes) public {
        require(msg.sender == address(executor), "Not authorized to invalidate proposal");
        string memory question = buildQuestion(proposalId, txHashes);
        executionAnnouncements[questionId][question] = INVALIDATED_TIME;
    }

    // TODO: take an array of complete transactions
    function executeProposal(bytes32 questionId, string memory proposalId, bytes32[] memory txHashes, address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 nonce) public {

        // These have been checked before, but we double check to make sure that they did not change (should not be possible)
        require(oracle.resultFor(questionId) == bytes32(uint256(1)), "Transaction was not approved");
        uint256 minBond = minimumBond;
        require(minBond == 0 || minBond <= oracle.getBond(questionId), "Bond on question not high enough");

        bytes32 txHash = getTransactionHash(to, value, data, operation, nonce);
        // Find the index in the tx hash array of the tx we want to execute
        uint256 txIndex = 0;
        for (uint256 i = 0; i < txHashes.length; i++) {
            if (txHashes[i] == txHash) {
                txIndex = i;
                break;
            }
        }
        require(txHashes[txIndex] == txHash, "Unexpected transaction hash");

        string memory question = buildQuestion(proposalId, txHashes);
        uint256 announcementTime = executionAnnouncements[questionId][question];
        require(announcementTime > 0, "Proposal execution has not been marked as ready");
        require(announcementTime != INVALIDATED_TIME, "Proposal has been marked as invalid");
        require(announcementTime + uint256(questionCooldown) < block.timestamp, "Wait for additional cooldown");

        // We use the hash of the question to check the execution state, as the other parameters might change, but the question not
        bytes32 questionHash = keccak256(bytes(question));
        require(txIndex == 0 || executedPropsalTransactions[questionHash][txHashes[txIndex - 1]], "Previous transaction not executed yet");
        require(!executedPropsalTransactions[questionHash][txHash], "Cannot execute transaction again");
        executedPropsalTransactions[questionHash][txHash] = true;

        executor.execTransactionFromModule(to, value, data, operation);
    }

    function buildQuestion(string memory proposalId, bytes32[] memory txHashes) public pure returns(string memory) {
        string memory txsHash = bytes32ToAsciiString(keccak256(abi.encodePacked(txHashes)));
        return string(abi.encodePacked(proposalId, bytes3(0xe2909f), txsHash));
    }

    function getQuestionId(uint256 templateId, string memory question, address arbitrator, uint32 timeout, uint32 openingTs, uint256 nonce) public view returns(bytes32) {
        bytes32 contentHash = keccak256(abi.encodePacked(templateId, openingTs, question));
        return keccak256(abi.encodePacked(contentHash, arbitrator, timeout, this, nonce));
    }

    function getTransactionHash(address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 nonce) public view returns(bytes32) {
        // TODO: EIP-712
        return keccak256(abi.encode(this, to, value, data, operation, nonce));
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