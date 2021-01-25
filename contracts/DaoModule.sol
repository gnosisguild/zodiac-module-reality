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
    mapping(bytes32 => bool) executedPropsals;

    constructor(Executor _executor, Realitio _oracle) {
        executor = _executor;
        oracle = _oracle;
        // We assume the question is "Did proposal <proposalHash> decide to execute the Safe tx with hash <txHash>"
        template = oracle.createTemplate('{"dependencyId": "%s", "proposalHash": "%s", "txHash": "%s", "type": "bool"}');
    }

    function addProposal(bytes32 dependencyId, bytes32 proposalHash, address to, uint256 value, bytes memory data, Enum.Operation operation) public {
        uint256 templateId = template;
        bytes32 txHash = getTransactionHash(to, value, data, operation);
        // This is not 100% correct as it is not a string concat but oprates on bytes
        string memory question = string(abi.encodePacked(dependencyId, bytes3(0xe2909f), proposalHash, bytes3(0xe2909f), txHash));
        bytes32 expectedProposalId = getProposalId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        // timeout == 48h
        bytes32 proposalId = oracle.askQuestion(templateId, question, address(this), 48 * 3600, 0, 0);
        require(expectedProposalId == proposalId, "Unexpected proposal id");
    }

    function executeProposal(bytes32 dependencyId, bytes32 proposalHash, address to, uint256 value, bytes memory data, Enum.Operation operation) public {
        require(dependencyId == bytes32(0) || executedPropsals[dependencyId], "Dependency not executed yet");
        uint256 templateId = template;
        bytes32 txHash = getTransactionHash(to, value, data, operation);
        // This is not 100% correct as it is not a string concat but oprates on bytes
        string memory question = string(abi.encodePacked(dependencyId, bytes3(0xe2909f), proposalHash, bytes3(0xe2909f), txHash));
        bytes32 proposalId = getProposalId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        require(!executedPropsals[proposalId], "Cannot execute transaction again");
        executedPropsals[proposalId] = true;
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