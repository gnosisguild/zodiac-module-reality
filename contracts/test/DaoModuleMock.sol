// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "../DaoModule.sol";

contract DaoModuleMock is DaoModule {
    constructor() DaoModule() {
        isInitialized = false;
    }
}
