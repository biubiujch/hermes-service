import { readFileSync, existsSync } from "fs";
import { join } from "path";
import logger from "../utils/logger";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  contractAddress?: string;
}

export interface AppConfig {
  port: number;
  allowedOrigins: string[];
  logLevel: string;
  networks: NetworkConfig[];
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config!: AppConfig;
  private deployments: Map<string, any> = new Map();

  private constructor() {
    this.loadConfig();
    this.loadDeployments();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * 加载应用配置
   */
  private loadConfig(): void {
    const env = process.env.NODE_ENV || "development";
    
    // 基础配置
    this.config = {
      port: parseInt(process.env.PORT || "9999"),
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
      logLevel: process.env.LOG_LEVEL || "info",
      networks: [
        {
          name: "localhost",
          chainId: 31337,
          rpcUrl: "http://127.0.0.1:8545",
          contractAddress: process.env.LOCALHOST_CONTRACT_ADDRESS
        },
        {
          name: "arbitrumTestnet",
          chainId: 421614,
          rpcUrl: process.env.ARBITRUM_TESTNET_URL || "https://sepolia-rollup.arbitrum.io/rpc",
          explorerUrl: "https://sepolia.arbiscan.io",
          contractAddress: process.env.ARBITRUM_TESTNET_CONTRACT_ADDRESS
        },
        {
          name: "arbitrum",
          chainId: 42161,
          rpcUrl: process.env.ARBITRUM_MAINNET_URL || "https://arb1.arbitrum.io/rpc",
          explorerUrl: "https://arbiscan.io",
          contractAddress: process.env.ARBITRUM_MAINNET_CONTRACT_ADDRESS
        }
      ]
    };

    logger.info(`配置已加载，环境: ${env}`);
  }

  /**
   * 加载部署信息
   */
  private loadDeployments(): void {
    const deploymentsDir = join(__dirname, "..", "..", "deployments");
    
    if (!existsSync(deploymentsDir)) {
      logger.warn("部署目录不存在，跳过加载部署信息");
      return;
    }

    try {
      const fs = require("fs");
      const files = fs.readdirSync(deploymentsDir);
      
      files.forEach((file: string) => {
        if (file.endsWith(".json")) {
          const networkName = file.replace(".json", "");
          const filePath = join(deploymentsDir, file);
          const deploymentInfo = JSON.parse(readFileSync(filePath, "utf8"));
          
          this.deployments.set(networkName, deploymentInfo);
          logger.info(`已加载 ${networkName} 网络的部署信息`);
        }
      });
    } catch (error) {
      logger.error("加载部署信息失败:", error);
    }
  }

  /**
   * 获取应用配置
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * 获取网络配置
   */
  getNetworkConfig(networkName: string): NetworkConfig | undefined {
    return this.config.networks.find(network => network.name === networkName);
  }

  /**
   * 获取所有网络配置
   */
  getAllNetworks(): NetworkConfig[] {
    return this.config.networks;
  }

  /**
   * 获取合约地址
   */
  getContractAddress(networkName: string): string | undefined {
    // 优先从部署信息获取
    const deployment = this.deployments.get(networkName);
    if (deployment?.contractAddress) {
      return deployment.contractAddress;
    }

    // 从环境变量获取
    const networkConfig = this.getNetworkConfig(networkName);
    return networkConfig?.contractAddress;
  }

  /**
   * 获取部署信息
   */
  getDeploymentInfo(networkName: string): any {
    return this.deployments.get(networkName);
  }

  /**
   * 更新合约地址
   */
  updateContractAddress(networkName: string, contractAddress: string): void {
    const networkConfig = this.getNetworkConfig(networkName);
    if (networkConfig) {
      networkConfig.contractAddress = contractAddress;
      logger.info(`已更新 ${networkName} 网络的合约地址: ${contractAddress}`);
    }
  }

  /**
   * 验证配置
   */
  validateConfig(): boolean {
    const requiredEnvVars = [
      "NODE_ENV"
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`缺少必要的环境变量: ${missingVars.join(", ")}`);
      return false;
    }

    // 验证网络配置
    for (const network of this.config.networks) {
      if (!network.rpcUrl) {
        logger.error(`网络 ${network.name} 缺少 RPC URL`);
        return false;
      }
    }

    logger.info("配置验证通过");
    return true;
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo(): any {
    return {
      nodeEnv: process.env.NODE_ENV || "development",
      port: this.config.port,
      logLevel: this.config.logLevel,
      networks: this.config.networks.map(network => ({
        name: network.name,
        chainId: network.chainId,
        hasContractAddress: !!network.contractAddress
      })),
      deployments: Array.from(this.deployments.keys())
    };
  }

  /**
   * 重新加载配置
   */
  reload(): void {
    this.loadConfig();
    this.loadDeployments();
    logger.info("配置已重新加载");
  }
} 