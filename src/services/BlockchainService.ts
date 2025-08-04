import { ethers } from "ethers";
import logger from "../utils/logger";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
}

export class BlockchainService {
  private providers: Map<string, ethers.Provider> = new Map();
  private signers: Map<string, ethers.Signer> = new Map();
  private networks: Map<string, NetworkConfig> = new Map();

  constructor() {
    this.initializeNetworks();
  }

  /**
   * 初始化支持的网络配置
   */
  private initializeNetworks() {
    const networks: NetworkConfig[] = [
      {
        name: "localhost",
        chainId: 31337,
        rpcUrl: "http://127.0.0.1:8545",
      },
      {
        name: "arbitrumTestnet",
        chainId: 421614,
        rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
        explorerUrl: "https://sepolia.arbiscan.io",
      },
      {
        name: "arbitrum",
        chainId: 42161,
        rpcUrl: "https://arb1.arbitrum.io/rpc",
        explorerUrl: "https://arbiscan.io",
      },
    ];

    networks.forEach(network => {
      this.networks.set(network.name, network);
    });
  }

  /**
   * 获取网络配置
   */
  getNetworkConfig(networkName: string): NetworkConfig | undefined {
    return this.networks.get(networkName);
  }

  /**
   * 获取所有支持的网络
   */
  getSupportedNetworks(): NetworkConfig[] {
    return Array.from(this.networks.values());
  }

  /**
   * 获取或创建Provider
   */
  getProvider(networkName: string): ethers.Provider {
    if (!this.providers.has(networkName)) {
      const network = this.networks.get(networkName);
      if (!network) {
        throw new Error(`不支持的网络: ${networkName}`);
      }

      const provider = new ethers.JsonRpcProvider(network.rpcUrl);
      this.providers.set(networkName, provider);
      logger.info(`已创建 ${networkName} 网络的Provider`);
    }

    return this.providers.get(networkName)!;
  }

  /**
   * 设置签名者
   */
  setSigner(networkName: string, privateKey: string): ethers.Signer {
    const provider = this.getProvider(networkName);
    const signer = new ethers.Wallet(privateKey, provider);
    this.signers.set(networkName, signer);
    
    logger.info(`已设置 ${networkName} 网络的签名者: ${signer.address}`);
    return signer;
  }

  /**
   * 获取签名者
   */
  getSigner(networkName: string): ethers.Signer | undefined {
    return this.signers.get(networkName);
  }

  /**
   * 检查网络连接
   */
  async checkNetworkConnection(networkName: string): Promise<boolean> {
    try {
      const provider = this.getProvider(networkName);
      const network = await provider.getNetwork();
      const expectedChainId = this.networks.get(networkName)?.chainId;
      
      if (network.chainId !== BigInt(expectedChainId || 0)) {
        logger.warn(`网络 ${networkName} 的链ID不匹配: 期望 ${expectedChainId}, 实际 ${network.chainId}`);
        return false;
      }

      logger.info(`网络 ${networkName} 连接正常`);
      return true;
    } catch (error) {
      logger.error(`网络 ${networkName} 连接失败:`, error);
      return false;
    }
  }

  /**
   * 获取账户余额
   */
  async getBalance(networkName: string, address: string): Promise<string> {
    try {
      const provider = this.getProvider(networkName);
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      logger.error(`获取账户余额失败:`, error);
      throw new Error(`获取账户余额失败: ${error}`);
    }
  }

  /**
   * 获取当前网络状态
   */
  async getNetworkStatus(networkName: string) {
    try {
      const provider = this.getProvider(networkName);
      const [network, blockNumber] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber()
      ]);

      return {
        networkName,
        chainId: network.chainId.toString(),
        blockNumber: blockNumber.toString(),
        connected: true
      };
    } catch (error) {
      logger.error(`获取网络状态失败:`, error);
      return {
        networkName,
        chainId: "unknown",
        blockNumber: "unknown",
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(networkName: string, txHash: string, confirmations: number = 1) {
    try {
      const provider = this.getProvider(networkName);
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      
      if (receipt) {
        logger.info(`交易 ${txHash} 已确认，区块: ${receipt.blockNumber}`);
      } else {
        logger.warn(`交易 ${txHash} 确认失败，receipt为null`);
      }
      return receipt;
    } catch (error) {
      logger.error(`等待交易确认失败:`, error);
      throw new Error(`等待交易确认失败: ${error}`);
    }
  }

  /**
   * 获取交易详情
   */
  async getTransaction(networkName: string, txHash: string) {
    try {
      const provider = this.getProvider(networkName);
      const tx = await provider.getTransaction(txHash);
      
      if (!tx) {
        throw new Error("交易不存在");
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, "gwei") + " gwei" : "unknown",
        nonce: tx.nonce,
        data: tx.data
      };
    } catch (error) {
      logger.error(`获取交易详情失败:`, error);
      throw new Error(`获取交易详情失败: ${error}`);
    }
  }

  /**
   * 清理连接
   */
  async cleanup() {
    // 清理所有provider连接
    for (const [networkName, provider] of this.providers) {
      try {
        if (provider.destroy) {
          await provider.destroy();
        }
        logger.info(`已清理 ${networkName} 网络连接`);
      } catch (error) {
        logger.error(`清理 ${networkName} 网络连接失败:`, error);
      }
    }

    this.providers.clear();
    this.signers.clear();
  }
} 