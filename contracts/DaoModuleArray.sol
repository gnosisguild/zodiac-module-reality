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

contract DaoTxModule {

    Executor public executor;
    Realitio public oracle;
    uint256 public template;
    mapping(bytes32 => mapping(bytes32 => bool)) executedPropsals;

    constructor(Executor _executor, Realitio _oracle) {
        executor = _executor;
        oracle = _oracle;
        // We assume the question is "Did proposal <proposalHash> decide to execute the Safe txs with hash <txsHash>"
        template = oracle.createTemplate('{""proposalHash": "%s", "txsHash": "%s", "type": "bool"}');
    }

    // TODO: take an array of complete transactions
    function addProposal(bytes32 proposalHash, bytes32[] memory txHashes) public {
        uint256 templateId = template;
        // This is not 100% correct as it is not a string concat but oprates on bytes
        string memory question = string(abi.encodePacked(proposalHash, bytes3(0xe2909f), txHashes));
        bytes32 expectedProposalId = getProposalId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        // timeout == 48h
        bytes32 proposalId = oracle.askQuestion(templateId, question, address(this), 48 * 3600, 0, 0);
        require(expectedProposalId == proposalId, "Unexpected proposal id");
    }

    function executeProposal(bytes32 proposalHash, bytes32[] memory txHashes, uint256 txIndex, address to, uint256 value, bytes memory data, Enum.Operation operation) public {
        uint256 templateId = template;
        bytes32 txHash = getTransactionHash(to, value, data, operation);
        require(txHashes[txIndex] == txHash, "Unexpected transaction hash");
        // This is not 100% correct as it is not a string concat but oprates on bytes
        string memory question = string(abi.encodePacked(proposalHash, bytes3(0xe2909f), txHashes));
        bytes32 proposalId = getProposalId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        require(txIndex == 0 || executedPropsals[proposalId][txHashes[txIndex - 1]], "Previous transaction not executed yet");
        require(!executedPropsals[proposalId][txHash], "Cannot execute transaction again");
        executedPropsals[proposalId][txHash] = true;
        // We expect a boolean as an answer (1 == true)
        require(oracle.resultFor(proposalId) == bytes32(uint256(1)), "Transaction was not approved");
        require(oracle.getFinalizeTS(proposalId) + 24 hours > block.timestamp, "Wait for additional cooldown");
        executor.execTransactionFromModule(to, value, data, operation);
    }

    function getProposalId(uint256 templateId, string memory question, address arbitrator, uint32 timeout, uint32 openingTs, uint256 nonce) public view returns(bytes32) {
        bytes32 contentHash = keccak256(abi.encodePacked(templateId, openingTs, question));
        return keccak256(abi.encodePacked(contentHash, arbitrator, timeout, this, nonce));
    }

    function getTransactionHash(address to, uint256 value, bytes memory data, Enum.Operation operation) public view returns(bytes32) {
        // TODO: EIP-712
        return keccak256(abi.encode(this, to, value, data, operation));
    }

    // TODO: add authenticated setters for timeouts (module and realitio) 
    // TODO: add arbitration methods
}