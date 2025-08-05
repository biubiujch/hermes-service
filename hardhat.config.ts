import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    // 注释掉其他网络，仅用于本地开发测试
    // 生产环境需要取消注释并配置相应的环境变量
    // arbitrumTestnet: {
    //   url: process.env.ARBITRUM_TESTNET_URL || "https://sepolia-rollup.arbitrum.io/rpc",
    //   chainId: 421614,
    // },
    // arbitrum: {
    //   url: process.env.ARBITRUM_MAINNET_URL || "https://arb1.arbitrum.io/rpc",
    //   chainId: 42161,
    // },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};

export default config;
