// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

interface RealitioV3 {
    /// @notice Report whether the answer to the specified question is finalized
    /// @param question_id The ID of the question
    /// @return Return true if finalized
    function isFinalized(bytes32 question_id) external view returns (bool);

    /// @notice Return the final answer to the specified question, or revert if there isn't one
    /// @param question_id The ID of the question
    /// @return The answer formatted as a bytes32
    function resultFor(bytes32 question_id) external view returns (bytes32);

    /// @notice Returns the timestamp at which the question will be/was finalized
    /// @param question_id The ID of the question
    function getFinalizeTS(bytes32 question_id) external view returns (uint32);

    /// @notice Returns whether the question is pending arbitration
    /// @param question_id The ID of the question
    function isPendingArbitration(bytes32 question_id)
        external
        view
        returns (bool);

    /// @notice Create a reusable template, which should be a JSON document.
    /// Placeholders should use gettext() syntax, eg %s.
    /// @dev Template data is only stored in the event logs, but its block number is kept in contract storage.
    /// @param content The template content
    /// @return The ID of the newly-created template, which is created sequentially.
    function createTemplate(string calldata content) external returns (uint256);

    /// @notice Returns the highest bond posted so far for a question
    /// @param question_id The ID of the question
    function getBond(bytes32 question_id) external view returns (uint256);

    /// @notice Returns the questions's content hash, identifying the question content
    /// @param question_id The ID of the question
    function getContentHash(bytes32 question_id)
        external
        view
        returns (bytes32);
}

interface RealitioV3ETH is RealitioV3 {
    /// @notice Ask a new question and return the ID
    /// @dev Template data is only stored in the event logs, but its block number is kept in contract storage.
    /// @param template_id The ID number of the template the question will use
    /// @param question A string containing the parameters that will be passed into the template to make the question
    /// @param arbitrator The arbitration contract that will have the final word on the answer if there is a dispute
    /// @param timeout How long the contract should wait after the answer is changed before finalizing on that answer
    /// @param opening_ts If set, the earliest time it should be possible to answer the question.
    /// @param nonce A user-specified nonce used in the question ID. Change it to repeat a question.
    /// @param min_bond The minimum bond that may be used for an answer.
    /// @return The ID of the newly-created question, created deterministically.
    function askQuestionWithMinBond(
        uint256 template_id,
        string memory question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce,
        uint256 min_bond
    ) external payable returns (bytes32);
}

interface RealitioV3ERC20 is RealitioV3 {
    /// @notice Ask a new question and return the ID
    /// @dev Template data is only stored in the event logs, but its block number is kept in contract storage.
    /// @param template_id The ID number of the template the question will use
    /// @param question A string containing the parameters that will be passed into the template to make the question
    /// @param arbitrator The arbitration contract that will have the final word on the answer if there is a dispute
    /// @param timeout How long the contract should wait after the answer is changed before finalizing on that answer
    /// @param opening_ts If set, the earliest time it should be possible to answer the question.
    /// @param nonce A user-specified nonce used in the question ID. Change it to repeat a question.
    /// @param min_bond The minimum bond that may be used for an answer.
    /// @param tokens Number of tokens sent
    /// @return The ID of the newly-created question, created deterministically.
    function askQuestionWithMinBondERC20(
        uint256 template_id,
        string memory question,
        address arbitrator,
        uint32 timeout,
        uint32 opening_ts,
        uint256 nonce,
        uint256 min_bond,
        uint256 tokens
    ) external returns (bytes32);
}
