import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-verify'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import dotenv from 'dotenv'
import type { HttpNetworkUserConfig } from 'hardhat/types'
import yargs from 'yargs'
import 'hardhat-contract-sizer'

const argv = yargs
  .option('network', {
    type: 'string',
    default: 'hardhat',
  })
  .help(false)
  .version(false).argv

// Load environment variables.
dotenv.config()
const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK, ALCHEMY_KEY } = process.env

import "./src/tasks/extract-mastercopy";
import "./src/tasks/deploy-mastercopies";
import "./src/tasks/deploy-mastercopy";
import "./src/tasks/verify-mastercopies";
import "./src/tasks/verify-mastercopy";


const DEFAULT_MNEMONIC =
  'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'

const sharedNetworkConfig: HttpNetworkUserConfig = {}
if (PK) {
  sharedNetworkConfig.accounts = [PK]
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  }
}

if (['mainnet', 'sepolia'].includes(argv.network) && INFURA_KEY === undefined) {
  throw new Error(
    `Could not find Infura key in env, unable to connect to network ${argv.network}`,
  )
}

export default {
  paths: {
    artifacts: 'build/artifacts',
    cache: 'build/cache',
    deploy: 'src/deploy',
    sources: 'contracts',
  },
  solidity: {
    compilers: [
      { version: '0.8.20' },
      { version: '0.8.4' }, 
      { version: '0.8.2' },
      { version: '0.8.1' },
      { version: '0.8.0' },
      { version: '0.6.12' },
    ],
  },
  networks: {
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    sepolia: {
      ...sharedNetworkConfig,
      url: `https://sepolia.infura.io/v3/${INFURA_KEY}`,
    },
    arbitrum: {
      ...sharedNetworkConfig,
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
    },
    xdai: {
      ...sharedNetworkConfig,
      url: 'https://xdai.poanetwork.dev',
    },
    matic: {
      ...sharedNetworkConfig,
      url: 'https://polygon-rpc.com',
    },
    bsc: {
      ...sharedNetworkConfig,
      url: 'https://bsc-dataseed.binance.org',
    },
    'truffle-dashboard': {
      url: 'http://localhost:24012/rpc',
      timeout: 100000000,
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  mocha: {
    timeout: 2000000,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
}
