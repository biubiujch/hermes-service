import { Request, Response, NextFunction } from "express";
import { ethers } from 'ethers';
import { Controller, Get, Post } from "../decorators";
import { BaseController } from "../baseController";
import { appConfig } from "../../utils/config";

// MockToken ABI - 只包含需要的方法
const MOCK_TOKEN_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function mint(address to, uint256 amount)",
  "function decimals() view returns (uint8)"
];

/**
 * 钱包控制器
 * 提供钱包相关的API接口
 */
@Controller("/api/wallet")
export class WalletController extends BaseController {
  private provider: ethers.JsonRpcProvider;
  private mockToken: ethers.Contract | null = null;
  private mockTokenAddress: string | null = null;

  constructor() {
    super();
    // 连接到本地Hardhat节点
    this.provider = new ethers.JsonRpcProvider(appConfig.getLocalNodeUrl());
    this.initializeMockToken();
  }

  private async initializeMockToken() {
    try {
      // 从配置中获取MockToken地址
      const mockTokenAddress = appConfig.getMockTokenAddress();
      if (mockTokenAddress) {
        this.mockTokenAddress = mockTokenAddress;
        this.mockToken = new ethers.Contract(mockTokenAddress, MOCK_TOKEN_ABI, this.provider);
      }
    } catch (error) {
      console.error('Failed to initialize MockToken:', error);
    }
  }

  /**
   * 获取应用配置信息
   * GET /api/wallet/config
   */
  @Get("/config")
  async getConfig(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      this.success({
        config: appConfig.getConfigInfo(),
        note: 'Configuration information for debugging and setup'
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取可用网络列表
   * GET /api/wallet/networks
   */
  @Get("/networks")
  async getNetworks(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const networks = appConfig.getNetworks();
      const currentNetwork = await this.getCurrentNetwork();

      this.success({
        networks,
        currentNetwork
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取当前连接的网络信息
   */
  private async getCurrentNetwork() {
    try {
      const network = await this.provider.getNetwork();
      return {
        chainId: network.chainId.toString(),
        name: network.name || 'Unknown'
      };
    } catch (error) {
      console.error('Error getting current network:', error);
      return null;
    }
  }

  /**
   * 获取钱包余额
   * GET /api/wallet/balance
   */
  @Get("/balance")
  async getBalance(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const walletAddress = this.getQueryParam("walletAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      // 获取ETH余额
      const ethBalance = await this.provider.getBalance(walletAddress);
      const ethBalanceFormatted = ethers.formatEther(ethBalance);

      // 获取USDT余额（如果MockToken已初始化）
      let usdtBalance = '0';
      if (this.mockToken) {
        try {
          const usdtBalanceRaw = await this.mockToken.balanceOf(walletAddress);
          const decimals = await this.mockToken.decimals();
          usdtBalance = ethers.formatUnits(usdtBalanceRaw, decimals);
        } catch (error) {
          console.error('Failed to get USDT balance:', error);
        }
      }

      this.success({
        walletAddress,
        balances: {
          eth: ethBalanceFormatted,
          usdt: usdtBalance
        }
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 注入资金到钱包（仅本地测试环境）
   * POST /api/wallet/inject-funds
   * 注意：这个功能仅用于本地测试，生产环境应该移除
   */
  @Post("/inject-funds")
  async injectFunds(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const body = this.getBody<{ walletAddress: string; amount?: string }>();
      const { walletAddress, amount = '1000' } = body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      // 检查当前USDT余额
      if (this.mockToken) {
        try {
          const currentBalance = await this.mockToken.balanceOf(walletAddress);
          const decimals = await this.mockToken.decimals();
          const currentBalanceFormatted = parseFloat(ethers.formatUnits(currentBalance, decimals));
          
          if (currentBalanceFormatted >= 1000) {
            this.error("User already has sufficient funds (>= 1000 USDT)", 400);
            return;
          }
        } catch (error) {
          console.error('Failed to check current balance:', error);
        }
      }

      // 注意：这个功能仅用于本地测试
      // 在生产环境中，应该通过前端wagmi连接钱包来执行交易
      this.error("Fund injection is only available in local test environment. In production, use frontend wallet connection.", 501);
    } catch (error) {
      this.error(error as Error);
    }
  }
} 