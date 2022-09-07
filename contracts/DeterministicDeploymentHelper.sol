// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "./interfaces/RealitioV3.sol";
import "./RealityModule.sol";

contract DeterministicDeploymentHelper {
  function createTemplateAndChangeOwner(
    string calldata templateContent,
    address realityOracle,
    address realityModuleInstance,
    address newOwner
  ) public {
    uint256 templateId = RealitioV3(realityOracle).createTemplate(
      templateContent
    );
    RealityModule(realityModuleInstance).setTemplate(templateId);
    RealityModule(realityModuleInstance).transferOwnership(newOwner);
  }
}
