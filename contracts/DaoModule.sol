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

    uint256 public constant INVALIDATED = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

    bytes32 public constant DOMAIN_SEPARATOR_TYPEHASH = 0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218;
    // keccak256(
    //     "EIP712Domain(uint256 chainId,address verifyingContract)"
    // );

    bytes32 public constant TRANSACTION_TYPEHASH = keccak256(
         "Transaction(address to,uint256 value,bytes data,uint8 operation,uint256 nonce)"
    );

    event ProposalQuestionCreated(
        bytes32 indexed questionId,
        string indexed proposalId
    );

    Executor public executor;
    Realitio public oracle;
    uint256 public template;
    uint32 public questionTimeout;
    uint32 public questionCooldown;
    address public questionArbitrator;
    uint256 public minimumBond;
    mapping(bytes32 => uint256) public questionStates;
    mapping(bytes32 => mapping(bytes32 => bool)) public executedPropsalTransactions;

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
    function addProposal(string memory proposalId, bytes32[] memory txHashes) public {
        addProposalWithNonce(proposalId, txHashes, 0);
    }

    function addProposalWithNonce(string memory proposalId, bytes32[] memory txHashes, uint256 nonce) public {
        uint256 templateId = template;
        uint32 timeout = questionTimeout;
        address arbitrator = questionArbitrator;
        string memory question = buildQuestion(proposalId, txHashes);
        if (nonce > 0) {
            // Check if question with lower nonce was invalid, else it should not be allowed to increase the nonce
            bytes32 invalidatedQuestionId = getQuestionId(
                templateId, question, arbitrator, timeout, 0, nonce - 1
            );
            require(oracle.resultFor(invalidatedQuestionId) == bytes32(INVALIDATED), "Previous question was not invalidated");
        }
        bytes32 expectedQuestionId = getQuestionId(
            templateId, question, arbitrator, timeout, 0, nonce
        );
        require(questionStates[expectedQuestionId] == 0, "New question state is not unset");
        questionStates[expectedQuestionId] = 1;
        bytes32 questionId = oracle.askQuestion(templateId, question, arbitrator, timeout, 0, nonce);
        require(expectedQuestionId == questionId, "Unexpected question id");
        emit ProposalQuestionCreated(questionId, proposalId);
    }

    function markProposalAsInvalid(bytes32 questionId) public {
        require(msg.sender == address(executor), "Not authorized to invalidate proposal");
        questionStates[questionId] = INVALIDATED;
    }

    // TODO: take an array of complete transactions
    function executeProposal(bytes32 questionId, string memory proposalId, bytes32[] memory txHashes, address to, uint256 value, bytes memory data, Enum.Operation operation, uint256 nonce) public {

        require(questionStates[questionId] == 1, "Invalid question state for provided id");

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

        require(oracle.resultFor(questionId) == bytes32(uint256(1)), "Transaction was not approved");
        uint256 minBond = minimumBond;
        require(minBond == 0 || minBond <= oracle.getBond(questionId), "Bond on question not high enough");
        uint32 finalizeTs = oracle.getFinalizeTS(questionId);
        require(finalizeTs + uint256(questionCooldown) < block.timestamp, "Wait for additional cooldown");

        // We use the hash of the question to check the execution state, as the other parameters might change, but the question not
        string memory question = buildQuestion(proposalId, txHashes);
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
    
    /// @dev Returns the chain id used by this contract.
    function getChainId() public view returns (uint256) {
        uint256 id;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            id := chainid()
        }
        return id;
    }
    
    /// @dev Generates the data for the delayed transaction hash (required for signing)
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