// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "./DaoModule.sol";
import "./interfaces/RealitioV3.sol";

contract DaoModuleERC20 is DaoModule {
    /// @param _executor Address of the executor (e.g. a Safe)
    /// @param _oracle Address of the oracle (e.g. RealitioV3)
    /// @param timeout Timeout in seconds that should be required for the oracle
    /// @param cooldown Cooldown in seconds that should be required after a oracle provided answer
    /// @param expiration Duration that a positive answer of the oracle is valid in seconds (or 0 if valid forever)
    /// @param bond Minimum bond that is required for an answer to be accepted
    /// @param templateId ID of the template that should be used for proposal questions (see https://github.com/RealitioV3/RealitioV3-dapp#structuring-and-fetching-information)
    /// @notice There need to be at least 60 seconds between end of cooldown and expiration
    constructor(
        Executor _executor,
        RealitioV3 _oracle,
        uint32 timeout,
        uint32 cooldown,
        uint32 expiration,
        uint256 bond,
        uint256 templateId
    )
        DaoModule(
            _executor,
            _oracle,
            timeout,
            cooldown,
            expiration,
            bond,
            templateId
        )
    {}

    function askQuestion(
        string memory question,
        uint256 nonce
    ) internal override returns (bytes32) {
        // Ask the question with a starting time of 0, so that it can be immediately answered
        return
            RealitioV3ERC20(address(oracle)).askQuestionWithMinBondERC20(
                template,
                question,
                questionArbitrator,
                questionTimeout,
                0,
                nonce,
                minimumBond,
                0
            );
    }
}
