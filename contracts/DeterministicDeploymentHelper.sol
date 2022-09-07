// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "./interfaces/RealitioV3.sol";
import "./RealityModule.sol";
import "@gnosis.pm/zodiac/contracts/factory/ModuleProxyFactory.sol";

contract DeterministicDeploymentHelper {
  function createTemplateAndChangeOwner(
    string calldata templateContent,
    RealitioV3 realityOracle,
    RealityModule realityModuleInstance,
    address newOwner
  ) public {
    uint256 templateId = realityOracle.createTemplate(templateContent);
    realityModuleInstance.setTemplate(templateId);
    realityModuleInstance.transferOwnership(newOwner);
  }
}
