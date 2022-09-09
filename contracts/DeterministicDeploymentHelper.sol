// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "./interfaces/RealitioV3.sol";
import "./RealityModule.sol";
import "@gnosis.pm/zodiac/contracts/factory/ModuleProxyFactory.sol";

contract DeterministicDeploymentHelper {
  event ModuleProxyCreation(address indexed proxy, address indexed masterCopy);

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

  function deployWithTemplate(
    ModuleProxyFactory factory,
    address masterCopy,
    bytes memory initParams, // function selector and parameters for the initializer
    uint256 saltNonce,
    string calldata templateContent,
    RealitioV3 realityOracle,
    address moduleModifierOwner
  ) public returns (address realityModuleProxy) {
    realityModuleProxy = factory.deployModule(
      masterCopy,
      initParams,
      saltNonce
    );
    uint256 templateId = realityOracle.createTemplate(templateContent);
    RealityModule(realityModuleProxy).setTemplate(templateId);
    RealityModule(realityModuleProxy).transferOwnership(moduleModifierOwner);
    emit ModuleProxyCreation(realityModuleProxy, masterCopy);
  }
}
