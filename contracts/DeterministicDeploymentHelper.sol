// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "./interfaces/RealitioV3.sol";
import "./RealityModule.sol";
import "@gnosis.pm/zodiac/contracts/factory/ModuleProxyFactory.sol";

/**
 * @title Deterministic Deployment Helper
 * @notice This contract contains helper functions that can be used to deploy the RealityModule to a deterministic address even though the template is new
 * @dev This is needed because if a new template is added in the same transaction, the template ID is unknown until the template is created.
 * This is unnecessary if the template ID is already known (the template has been created in an earlier transaction).
 * This functionality is helpful if the template will be created and the RealityModule deployed in the same transaction.
 */
contract DeterministicDeploymentHelper {
  event ModuleProxyCreation(address indexed proxy, address indexed masterCopy);
  event ModuleProxyConfigured(uint256 templateId);

  /// @notice It creates the template on the oracle, then sets the template ID on the module and transfers ownership of the module to the specified owner
  /// @dev
  /// @param moduleInstance The module instance
  /// @param realityOracle The address of the oracle instance to use
  /// @param templateContent The Reality.eth template
  /// @param newOwner The address that should be set as the Module owner
  /// @return templateId The templates ID at the reality oracle
  function createTemplateAndChangeOwner(
    RealityModule moduleInstance,
    RealitioV3 realityOracle,
    string calldata templateContent,
    address newOwner
  ) public returns (uint256 templateId) {
    templateId = realityOracle.createTemplate(templateContent);
    moduleInstance.setTemplate(templateId);
    moduleInstance.transferOwnership(newOwner);
    emit ModuleProxyConfigured(templateId);
  }

  /// @notice Deploys the Reality Module to a deterministic address, then creates the template and sets ownership to the specified owner
  /// @dev In the init parameters the owner must be set to the address of this contract and the templateId should be set to 0
  /// @param factory The Module Proxy Factory used for deploying modules
  /// @param masterCopy The modules implementation logic, used for the Proxy (Module instance)
  /// @param initParams The initialization parameters passed to the factory, used for calling the setup function with the required parameters.
  /// @param saltNonce The salt used in the creation of the proxy
  /// @param realityOracle The address of the Reality.eth oracle instance to use
  /// @param templateContent The Reality.eth template
  /// @param finalModuleOwner The address that should be set as the Module owner
  /// @return realityModuleProxy The address of the new module proxy
  function deployWithEncodedParams(
    ModuleProxyFactory factory,
    address masterCopy,
    bytes memory initParams, // function selector and parameters for the initializer
    uint256 saltNonce,
    RealitioV3 realityOracle,
    string calldata templateContent,
    address finalModuleOwner
  ) public returns (address realityModuleProxy) {
    realityModuleProxy = factory.deployModule(
      masterCopy,
      initParams,
      saltNonce
    );
    createTemplateAndChangeOwner(
      RealityModule(realityModuleProxy),
      realityOracle,
      templateContent,
      finalModuleOwner
    );
    emit ModuleProxyCreation(realityModuleProxy, masterCopy);
  }

  struct ModuleSetupParams {
    RealitioV3 realityOracle;
    string templateContent;
    address owner;
    address avatar;
    address target;
    uint32 timeout;
    uint32 cooldown;
    uint32 expiration;
    uint256 bond;
    address arbitrator;
  }

  /// @notice Deploys the Reality Module to a deterministic address, then creates the template and sets ownership to the specified owner
  /// @param factory The Module Proxy Factory used for deploying modules
  /// @param masterCopy The modules implementation logic, used for the Proxy (Module instance)
  /// @param saltNonce The salt used in the creation of the proxy
  /// @param setupParams The setup parameters (see the ModuleSetupParams struct for details)
  /// @return realityModuleProxy The address of the new module proxy
  function deployWithTemplate(
    ModuleProxyFactory factory,
    address masterCopy,
    uint256 saltNonce,
    ModuleSetupParams calldata setupParams
  ) public returns (address realityModuleProxy) {
    bytes memory initParams = abi.encodeWithSelector(
      RealityModule(masterCopy).setUp.selector,
      abi.encode(
        address(this),
        setupParams.avatar,
        setupParams.target,
        address(setupParams.realityOracle),
        setupParams.timeout,
        setupParams.cooldown,
        setupParams.expiration,
        setupParams.bond,
        0,
        setupParams.arbitrator
      )
    );
    realityModuleProxy = deployWithEncodedParams(
      factory,
      masterCopy,
      initParams,
      saltNonce,
      setupParams.realityOracle,
      setupParams.templateContent,
      setupParams.owner
    );
  }
}
