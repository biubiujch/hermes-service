import { ethers } from "ethers";
import { AssetPool, AssetPool__factory } from "../../typechain-types";
import logger from "../utils/logger";

export interface PoolBalance {
  token: string;
  balance: string;
  decimals: number;
}

export interface UserBalance {
  user: string;
  token: string;
  balance: string;
  decimals: number;
}

export interface DepositParams {
  user: string;
  token: string;
  amount: string;
  privateKey?: string;
}

export interface WithdrawParams {
  user: string;
  token: string;
  amount: string;
  privateKey?: string;
}

export class AssetPoolService {
  private contract: AssetPool;
  private provider: ethers.Provider;
  private signer?: ethers.Signer;

  constructor(
    contractAddress: string,
    provider: ethers.Provider,
    signer?: ethers.Signer
  ) {
    this.provider = provider;
    this.signer = signer;
    
    // 创建合约实例
    this.contract = AssetPool__factory.connect(contractAddress, signer || provider);
  }

  /**
   * 获取资金池总余额
   */
  async getPoolBalance(token: string): Promise<PoolBalance> {
    try {
      const balance = await this.contract.getPoolBalance(token);
      const decimals = token === ethers.ZeroAddress ? 18 : 18; // 简化处理，实际应该从token合约获取
      
      return {
        token,
        balance: ethers.formatUnits(balance, decimals),
        decimals
      };
    } catch (error) {
      logger.error("获取资金池余额失败:", error);
      throw new Error(`获取资金池余额失败: ${error}`);
    }
  }

  /**
   * 获取用户余额
   */
  async getUserBalance(user: string, token: string): Promise<UserBalance> {
    try {
      const balance = await this.contract.getUserBalance(user, token);
      const decimals = token === ethers.ZeroAddress ? 18 : 18; // 简化处理
      
      return {
        user,
        token,
        balance: ethers.formatUnits(balance, decimals),
        decimals
      };
    } catch (error) {
      logger.error("获取用户余额失败:", error);
      throw new Error(`获取用户余额失败: ${error}`);
    }
  }

  /**
   * 用户存款
   */
  async deposit(params: DepositParams): Promise<string> {
    try {
      const { user, token, amount, privateKey } = params;
      
      // 创建签名者
      const signer = privateKey 
        ? new ethers.Wallet(privateKey, this.provider)
        : this.signer;
      
      if (!signer) {
        throw new Error("需要提供私钥或签名者");
      }

      const contractWithSigner = this.contract.connect(signer);
      const amountWei = ethers.parseUnits(amount, 18); // 简化处理

      let tx;
      if (token === ethers.ZeroAddress) {
        // ETH存款
        tx = await contractWithSigner.deposit(ethers.ZeroAddress, amountWei, {
          value: amountWei
        });
      } else {
        // ERC20代币存款
        tx = await contractWithSigner.deposit(token, amountWei);
      }

      logger.info(`用户 ${user} 存款交易已提交: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error("存款失败:", error);
      throw new Error(`存款失败: ${error}`);
    }
  }

  /**
   * 用户提款
   */
  async withdraw(params: WithdrawParams): Promise<string> {
    try {
      const { user, token, amount, privateKey } = params;
      
      // 创建签名者
      const signer = privateKey 
        ? new ethers.Wallet(privateKey, this.provider)
        : this.signer;
      
      if (!signer) {
        throw new Error("需要提供私钥或签名者");
      }

      const contractWithSigner = this.contract.connect(signer);
      const amountWei = ethers.parseUnits(amount, 18);

      const tx = await contractWithSigner.withdraw(token, amountWei);
      
      logger.info(`用户 ${user} 提款交易已提交: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      logger.error("提款失败:", error);
      throw new Error(`提款失败: ${error}`);
    }
  }

  /**
   * 检查代币是否支持
   */
  async isTokenSupported(token: string): Promise<boolean> {
    try {
      return await this.contract.isTokenSupported(token);
    } catch (error) {
      logger.error("检查代币支持状态失败:", error);
      return false;
    }
  }

  /**
   * 检查策略是否已授权
   */
  async isStrategyAuthorized(strategy: string): Promise<boolean> {
    try {
      return await this.contract.isStrategyAuthorized(strategy);
    } catch (error) {
      logger.error("检查策略授权状态失败:", error);
      return false;
    }
  }

  /**
   * 获取合约配置信息
   */
  async getContractConfig() {
    try {
      const [feeCollector, minDeposit, maxPoolSize, feeRate] = await Promise.all([
        this.contract.feeCollector(),
        this.contract.minDepositAmount(),
        this.contract.maxPoolSize(),
        this.contract.FEE_RATE()
      ]);

      return {
        feeCollector,
        minDeposit: ethers.formatEther(minDeposit),
        maxPoolSize: ethers.formatEther(maxPoolSize),
        feeRate: feeRate.toString(),
        feeRatePercent: (Number(feeRate) / 100).toFixed(2) + "%"
      };
    } catch (error) {
      logger.error("获取合约配置失败:", error);
      throw new Error(`获取合约配置失败: ${error}`);
    }
  }

  /**
   * 获取合约地址
   */
  getContractAddress(): string {
    return this.contract.target as string;
  }
} 