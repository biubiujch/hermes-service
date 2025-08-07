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
        console.log(`MockToken initialized with address: ${mockTokenAddress}`);
      } else {
        console.warn('MockToken address not configured - set MOCK_TOKEN_ADDRESS in .env file');
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
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
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
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
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
      let usdtError = null;
      if (this.mockToken) {
        try {
          const usdtBalanceRaw = await this.mockToken.balanceOf(walletAddress);
          const decimals = await this.mockToken.decimals();
          usdtBalance = ethers.formatUnits(usdtBalanceRaw, decimals);
        } catch (error) {
          console.error('Failed to get USDT balance:', error);
          usdtError = 'Failed to get USDT balance - contract may not be deployed or address is invalid';
        }
      } else {
        usdtError = 'MockToken contract not initialized - check MOCK_TOKEN_ADDRESS configuration';
      }

      this.success({
        walletAddress,
        balances: {
          eth: ethBalanceFormatted,
          usdt: usdtBalance
        },
        errors: usdtError ? { usdt: usdtError } : undefined
      });
    } catch (error) {
      this.error(error as Error);
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
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
      const { walletAddress, amount = '10' } = body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      // 验证金额
      const amountNumber = parseFloat(amount);
      if (isNaN(amountNumber) || amountNumber <= 0) {
        this.error("Invalid amount - must be a positive number", 400);
        return;
      }

      // 检查MockToken是否已初始化
      if (!this.mockToken) {
        this.error("MockToken contract not initialized - check MOCK_TOKEN_ADDRESS configuration", 500);
        return;
      }

      try {
        // 获取合约的decimals
        const decimals = await this.mockToken.decimals();
        
        // 将金额转换为合约单位
        const amountInWei = ethers.parseUnits(amount, decimals);
        
        // 获取部署者账户（用于mint操作）
        const deployerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Hardhat默认账户
        
        // 创建部署者签名者
        const deployerSigner = await this.provider.getSigner(deployerAddress);
        
        // 使用部署者账户连接合约
        const mockTokenWithSigner = this.mockToken.connect(deployerSigner) as any;
        
        // 执行mint操作
        const tx = await mockTokenWithSigner.mint(walletAddress, amountInWei);
        
        // 等待交易确认
        await tx.wait();
        
        // 获取新的余额
        const newBalance = await this.mockToken.balanceOf(walletAddress);
        const newBalanceFormatted = ethers.formatUnits(newBalance, decimals);
        
        this.success({
          walletAddress,
          injectedAmount: amount,
          newBalance: newBalanceFormatted,
          transactionHash: tx.hash,
          message: `Successfully injected ${amount} USDT to wallet`
        });
        
      } catch (error) {
        console.error('Failed to inject funds:', error);
        this.error(`Failed to inject funds: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
      }
    } catch (error) {
      this.error(error as Error);
      // 不要抛出错误，避免被错误处理中间件重复处理
      return;
    }
  }
} 