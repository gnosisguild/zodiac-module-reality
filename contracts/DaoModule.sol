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
        //See https://github.com/realitio/realitio-dapp#structuring-and-fetching-information
        template = oracle.createTemplate('{"title": "Did the proposal with the id %s voted to execute the array of Module transactions that have the hash %s? The hash is the keccak of the concatenation of the individual EIP-712 hashes of the Module transactions.", "lang": "en", "type": "bool"}');
    }

    // TODO: take an array of complete transactions
    // Theoretically this doesn't need to be done via the module
    function addProposal(string memory proposalId, bytes32[] memory txHashes) public {
        uint256 templateId = template;
        string memory txsHash = bytes32ToAsciiString(keccak256(abi.encodePacked(txHashes)));
        string memory question = string(abi.encodePacked(proposalId, bytes3(0xe2909f), txsHash));
        bytes32 expectedQuestionId = getQuestionId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        // timeout == 48h
        bytes32 questionId = oracle.askQuestion(templateId, question, address(this), 48 * 3600, 0, 0);
        require(expectedQuestionId == questionId, "Unexpected proposal id");
    }

    function executeProposal(string memory proposalId, bytes32[] memory txHashes, uint256 txIndex, address to, uint256 value, bytes memory data, Enum.Operation operation) public {
        uint256 templateId = template;
        bytes32 txHash = getTransactionHash(to, value, data, operation);
        require(txHashes[txIndex] == txHash, "Unexpected transaction hash");
        string memory txsHash = bytes32ToAsciiString(keccak256(abi.encodePacked(txHashes)));
        string memory question = string(abi.encodePacked(proposalId, bytes3(0xe2909f), txsHash));
        bytes32 questionId = getQuestionId(
            templateId, question, address(this), 48 * 3600, 0, 0
        );
        require(txIndex == 0 || executedPropsals[questionId][txHashes[txIndex - 1]], "Previous transaction not executed yet");
        require(!executedPropsals[questionId][txHash], "Cannot execute transaction again");
        executedPropsals[questionId][txHash] = true;
        // We expect a boolean as an answer (1 == true)
        require(oracle.resultFor(questionId) == bytes32(uint256(1)), "Transaction was not approved");
        require(oracle.getFinalizeTS(questionId) + 24 hours > block.timestamp, "Wait for additional cooldown");
        executor.execTransactionFromModule(to, value, data, operation);
    }

    function getQuestionId(uint256 templateId, string memory question, address arbitrator, uint32 timeout, uint32 openingTs, uint256 nonce) public view returns(bytes32) {
        bytes32 contentHash = keccak256(abi.encodePacked(templateId, openingTs, question));
        return keccak256(abi.encodePacked(contentHash, arbitrator, timeout, this, nonce));
    }

    function getTransactionHash(address to, uint256 value, bytes memory data, Enum.Operation operation) public view returns(bytes32) {
        // TODO: EIP-712
        return keccak256(abi.encode(this, to, value, data, operation));
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


    // 582c96cb65b2d96cb65b2d96cbe5f2793c1e8f47a3d168349acde673b9dceef7
    // 9c22ff5f21f0b81b113e63f7db6da94fedef11b2119b4088b89664fb9a3cb658
}