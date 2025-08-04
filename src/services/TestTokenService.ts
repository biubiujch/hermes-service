import { ethers } from "ethers";
import { MockERC20, MockERC20__factory } from "../../typechain-types";
import { BlockchainService } from "./BlockchainService";
import { TokenConfigManager, TokenConfig } from "../config/TokenConfig";
import logger from "../utils/logger";

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  needsInjection: boolean;
}

export class TestTokenService {
  private blockchainService: BlockchainService;
  private tokenConfigManager: TokenConfigManager;

  constructor() {
    this.blockchainService = new BlockchainService();
    this.tokenConfigManager = TokenConfigManager.getInstance();
  }

  /**
   * 获取所有测试代币配置
   */
  getTestTokenConfigs(): TokenConfig[] {
    return this.tokenConfigManager.getTokenConfigs();
  }

  /**
   * 获取特定代币配置
   */
  getTestTokenConfig(symbol: string): TokenConfig | undefined {
    return this.tokenConfigManager.getTokenConfig(symbol);
  }

  /**
   * 检查用户代币余额
   */
  async checkUserTokenBalance(
    network: string, 
    userAddress: string, 
    tokenSymbol: string
  ): Promise<TokenBalance> {
    try {
      const tokenConfig = this.getTestTokenConfig(tokenSymbol);
      if (!tokenConfig) {
        throw new Error(`不支持的测试代币: ${tokenSymbol}`);
      }

      const provider = this.blockchainService.getProvider(network);
      let balance: bigint;
      let symbol = tokenSymbol;

      if (tokenConfig.address === ethers.ZeroAddress) {
        // ETH余额
        balance = await provider.getBalance(userAddress);
        symbol = "ETH";
      } else {
        // ERC20代币余额
        const tokenContract = MockERC20__factory.connect(tokenConfig.address, provider);
        balance = await tokenContract.balanceOf(userAddress);
        symbol = await tokenContract.symbol();
      }

      const balanceFormatted = ethers.formatUnits(balance, tokenConfig.decimals);
      const minBalanceWei = ethers.parseUnits(tokenConfig.minBalance, tokenConfig.decimals);
      const needsInjection = balance < minBalanceWei;

      return {
        token: tokenConfig.address,
        symbol,
        balance: balanceFormatted,
        decimals: tokenConfig.decimals,
        needsInjection
      };
    } catch (error) {
      logger.error(`检查用户代币余额失败:`, error);
      throw new Error(`检查用户代币余额失败: ${error}`);
    }
  }

  /**
   * 注入测试代币
   */
  async injectTestToken(
    network: string,
    userAddress: string,
    tokenSymbol: string,
    privateKey?: string
  ): Promise<string> {
    try {
      const tokenConfig = this.getTestTokenConfig(tokenSymbol);
      if (!tokenConfig) {
        throw new Error(`不支持的测试代币: ${tokenSymbol}`);
      }

      const provider = this.blockchainService.getProvider(network);
      const signer = privateKey 
        ? new ethers.Wallet(privateKey, provider)
        : this.blockchainService.getSigner(network);

      if (!signer) {
        throw new Error("需要提供私钥或签名者");
      }

      if (tokenConfig.address === ethers.ZeroAddress) {
        // 注入ETH
        const injectAmountWei = ethers.parseUnits(tokenConfig.injectAmount, tokenConfig.decimals);
        
        // 从部署者账户转移ETH到用户账户
        const deployerSigner = this.blockchainService.getSigner(network);
        if (!deployerSigner) {
          throw new Error("部署者签名者未设置");
        }

        const tx = await deployerSigner.sendTransaction({
          to: userAddress,
          value: injectAmountWei
        });

        logger.info(`已注入 ${tokenConfig.injectAmount} ${tokenSymbol} 到 ${userAddress}: ${tx.hash}`);
        return tx.hash;
      } else {
        // 注入ERC20代币
        const tokenContract = MockERC20__factory.connect(tokenConfig.address, signer);
        const injectAmountWei = ethers.parseUnits(tokenConfig.injectAmount, tokenConfig.decimals);

        const tx = await tokenContract.mint(userAddress, injectAmountWei);
        
        logger.info(`已注入 ${tokenConfig.injectAmount} ${tokenSymbol} 到 ${userAddress}: ${tx.hash}`);
        return tx.hash;
      }
    } catch (error) {
      logger.error(`注入测试代币失败:`, error);
      throw new Error(`注入测试代币失败: ${error}`);
    }
  }

  /**
   * 检查并自动注入测试代币
   */
  async checkAndInjectTestToken(
    network: string,
    userAddress: string,
    tokenSymbol: string,
    privateKey?: string
  ): Promise<{ injected: boolean; txHash?: string; balance: TokenBalance }> {
    try {
      const balance = await this.checkUserTokenBalance(network, userAddress, tokenSymbol);
      
      if (balance.needsInjection) {
        const txHash = await this.injectTestToken(network, userAddress, tokenSymbol, privateKey);
        
        // 等待交易确认
        await this.blockchainService.waitForTransaction(network, txHash);
        
        // 重新检查余额
        const newBalance = await this.checkUserTokenBalance(network, userAddress, tokenSymbol);
        
        return {
          injected: true,
          txHash,
          balance: newBalance
        };
      }

      return {
        injected: false,
        balance
      };
    } catch (error) {
      logger.error(`检查并注入测试代币失败:`, error);
      throw new Error(`检查并注入测试代币失败: ${error}`);
    }
  }

  /**
   * 获取用户所有测试代币余额
   */
  async getAllUserTokenBalances(
    network: string,
    userAddress: string
  ): Promise<TokenBalance[]> {
    try {
      const balances: TokenBalance[] = [];
      
      const configs = this.tokenConfigManager.getTokenConfigs();
      for (const config of configs) {
        try {
          const balance = await this.checkUserTokenBalance(network, userAddress, config.symbol);
          balances.push(balance);
        } catch (error) {
          logger.warn(`获取 ${config.symbol} 余额失败:`, error);
          // 继续处理其他代币
        }
      }

      return balances;
    } catch (error) {
      logger.error(`获取用户所有代币余额失败:`, error);
      throw new Error(`获取用户所有代币余额失败: ${error}`);
    }
  }
} 