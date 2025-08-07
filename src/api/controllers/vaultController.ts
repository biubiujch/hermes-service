import { Request, Response, NextFunction } from "express";
import { ethers } from 'ethers';
import { Controller, Get, Post, Delete, Put } from "../decorators";
import { BaseController } from "../baseController";
import { appConfig } from "../../utils/config";

// Vault ABI - 包含资金池相关的方法
const VAULT_ABI = [
  "function createPool(uint256 initialAmount) external payable returns (uint256)",
  "function deletePool(uint256 poolId) external",
  "function mergePools(uint256 targetPoolId, uint256 sourcePoolId) external",
  "function deposit(uint256 poolId, address token, uint256 amount) external payable",
  "function withdraw(uint256 poolId, address token, uint256 amount) external",
  "function getUserPools(address user) external view returns (uint256[])",
  "function getPool(uint256 poolId) external view returns (tuple(uint256 id, address owner, uint256 totalBalance, bool isActive, uint256 createdAt, uint256 lastActivityAt))",
  "function getUserPoolCount(address user) external view returns (uint256)",
  "function maxPoolsPerUser() external view returns (uint256)",
  "function minPoolBalance() external view returns (uint256)",
  "function feeRate() external view returns (uint256)",
  "function feeCollector() external view returns (address)",
  "function supportedTokens(address token) external view returns (bool)"
];

// MockToken ABI - 用于代币授权
const MOCK_TOKEN_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)"
];

/**
 * 资金池控制器
 * 提供资金池相关的API接口
 */
@Controller("/api/vault")
export class VaultController extends BaseController {
  private provider: ethers.JsonRpcProvider;
  private vault: ethers.Contract | null = null;
  private mockToken: ethers.Contract | null = null;
  private vaultAddress: string | null = null;
  private mockTokenAddress: string | null = null;

  constructor() {
    super();
    // 连接到本地Hardhat节点
    this.provider = new ethers.JsonRpcProvider(appConfig.getLocalNodeUrl());
    this.initializeContracts();
  }

  private async initializeContracts() {
    try {
      // 从配置中获取合约地址
      this.vaultAddress = appConfig.getVaultAddress();
      this.mockTokenAddress = appConfig.getMockTokenAddress();

      if (this.vaultAddress) {
        this.vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.provider);
        console.log(`Vault initialized with address: ${this.vaultAddress}`);
      } else {
        console.warn('Vault address not configured - set VAULT_ADDRESS in .env file');
      }

      if (this.mockTokenAddress) {
        this.mockToken = new ethers.Contract(this.mockTokenAddress, MOCK_TOKEN_ABI, this.provider);
        console.log(`MockToken initialized with address: ${this.mockTokenAddress}`);
      } else {
        console.warn('MockToken address not configured - set MOCK_TOKEN_ADDRESS in .env file');
      }
    } catch (error) {
      console.error('Failed to initialize contracts:', error);
    }
  }

  /**
   * 获取资金池配置信息
   * GET /api/vault/config
   */
  @Get("/config")
  async getConfig(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const [maxPoolsPerUser, minPoolBalance, feeRate, feeCollector] = await Promise.all([
        this.vault.maxPoolsPerUser(),
        this.vault.minPoolBalance(),
        this.vault.feeRate(),
        this.vault.feeCollector()
      ]);

      this.success({
        maxPoolsPerUser: Number(maxPoolsPerUser),
        minPoolBalance: ethers.formatEther(minPoolBalance),
        feeRate: Number(feeRate),
        feeCollector,
        supportedTokens: this.mockTokenAddress ? {
          mockToken: this.mockTokenAddress,
          isSupported: await this.vault.supportedTokens(this.mockTokenAddress)
        } : null
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取用户资金池列表
   * GET /api/vault/pools
   */
  @Get("/pools")
  async getUserPools(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const walletAddress = this.getQueryParam("walletAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const poolIds = await this.vault.getUserPools(walletAddress);
      const poolCount = await this.vault.getUserPoolCount(walletAddress);

      // 获取每个资金池的详细信息
      const pools = await Promise.all(
        poolIds.map(async (poolId: bigint) => {
          const pool = await this.vault!.getPool(poolId);
          return {
            id: Number(poolId),
            owner: pool.owner,
            totalBalance: ethers.formatEther(pool.totalBalance),
            isActive: pool.isActive,
            createdAt: Number(pool.createdAt),
            lastActivityAt: Number(pool.lastActivityAt)
          };
        })
      );

      this.success({
        walletAddress,
        poolCount: Number(poolCount),
        pools
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取单个资金池详情
   * GET /api/vault/pools/:poolId
   */
  @Get("/pools/:poolId")
  async getPool(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const poolId = this.getParam("poolId");
      const poolIdNumber = parseInt(poolId);

      if (isNaN(poolIdNumber) || poolIdNumber <= 0) {
        this.error("Invalid pool ID", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const pool = await this.vault.getPool(poolIdNumber);

      if (!pool.owner || pool.owner === ethers.ZeroAddress) {
        this.error("Pool not found", 404);
        return;
      }

      this.success({
        id: poolIdNumber,
        owner: pool.owner,
        totalBalance: ethers.formatEther(pool.totalBalance),
        isActive: pool.isActive,
        createdAt: Number(pool.createdAt),
        lastActivityAt: Number(pool.lastActivityAt)
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 创建资金池
   * POST /api/vault/pools
   */
  @Post("/pools")
  async createPool(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const body = this.getBody<{
        walletAddress: string;
        initialAmount?: string;
        tokenAddress?: string;
      }>();

      const { walletAddress, initialAmount = "0", tokenAddress } = body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      // 验证金额
      const amountNumber = parseFloat(initialAmount);
      if (isNaN(amountNumber) || amountNumber < 0) {
        this.error("Invalid amount", 400);
        return;
      }

      // 创建签名者（这里需要前端传递签名）
      const signer = await this.provider.getSigner(walletAddress);
      const vaultWithSigner = this.vault.connect(signer) as any;

      let poolId: bigint;
      let tx: any;

      if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
        // ERC20代币创建资金池
        if (!this.mockToken || tokenAddress !== this.mockTokenAddress) {
          this.error("Unsupported token", 400);
          return;
        }

        const amountInWei = ethers.parseUnits(initialAmount, 6); // USDT 6位小数
        
        // 检查代币余额
        const tokenBalance = await this.mockToken.balanceOf(walletAddress);
        if (tokenBalance < amountInWei) {
          this.error("Insufficient token balance", 400);
          return;
        }

        // 检查授权额度
        const allowance = await this.mockToken.allowance(walletAddress, this.vaultAddress);
        if (allowance < amountInWei) {
          this.error("Token approval required", 400);
          return;
        }

        tx = await vaultWithSigner.createPool(amountInWei);
      } else {
        // ETH创建资金池
        const amountInWei = ethers.parseEther(initialAmount);
        tx = await vaultWithSigner.createPool(0, { value: amountInWei });
      }

      const receipt = await tx.wait();
      const event = this.vault.interface.parseLog(receipt.logs[0] as any);
      poolId = event?.args[0];

      this.success({
        poolId: Number(poolId),
        walletAddress,
        initialAmount,
        transactionHash: tx.hash,
        message: "Pool created successfully"
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 删除资金池
   * DELETE /api/vault/pools/:poolId
   */
  @Delete("/pools/:poolId")
  async deletePool(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const poolId = this.getParam("poolId");
      const poolIdNumber = parseInt(poolId);
      const body = this.getBody<{ walletAddress: string }>();
      const { walletAddress } = body;

      if (isNaN(poolIdNumber) || poolIdNumber <= 0) {
        this.error("Invalid pool ID", 400);
        return;
      }

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      // 验证资金池所有权
      const pool = await this.vault.getPool(poolIdNumber);
      if (pool.owner !== walletAddress) {
        this.error("Pool not owned by wallet", 403);
        return;
      }

      // 创建签名者
      const signer = await this.provider.getSigner(walletAddress);
      const vaultWithSigner = this.vault.connect(signer) as any;

      const tx = await vaultWithSigner.deletePool(poolIdNumber);
      await tx.wait();

      this.success({
        poolId: poolIdNumber,
        walletAddress,
        transactionHash: tx.hash,
        message: "Pool deleted successfully"
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 合并资金池
   * PUT /api/vault/pools/merge
   */
  @Put("/pools/merge")
  async mergePools(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const body = this.getBody<{
        walletAddress: string;
        targetPoolId: number;
        sourcePoolId: number;
      }>();

      const { walletAddress, targetPoolId, sourcePoolId } = body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!targetPoolId || !sourcePoolId || targetPoolId === sourcePoolId) {
        this.error("Invalid pool IDs", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      // 验证资金池所有权
      const [targetPool, sourcePool] = await Promise.all([
        this.vault.getPool(targetPoolId),
        this.vault.getPool(sourcePoolId)
      ]);

      if (targetPool.owner !== walletAddress || sourcePool.owner !== walletAddress) {
        this.error("Pool not owned by wallet", 403);
        return;
      }

      // 创建签名者
      const signer = await this.provider.getSigner(walletAddress);
      const vaultWithSigner = this.vault.connect(signer) as any;

      const tx = await vaultWithSigner.mergePools(targetPoolId, sourcePoolId);
      await tx.wait();

      this.success({
        targetPoolId,
        sourcePoolId,
        walletAddress,
        transactionHash: tx.hash,
        message: "Pools merged successfully"
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 存入资金
   * POST /api/vault/pools/:poolId/deposit
   */
  @Post("/pools/:poolId/deposit")
  async deposit(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const poolId = this.getParam("poolId");
      const poolIdNumber = parseInt(poolId);
      const body = this.getBody<{
        walletAddress: string;
        amount: string;
        tokenAddress?: string;
      }>();

      const { walletAddress, amount, tokenAddress } = body;

      if (isNaN(poolIdNumber) || poolIdNumber <= 0) {
        this.error("Invalid pool ID", 400);
        return;
      }

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        this.error("Invalid amount", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      // 验证资金池所有权
      const pool = await this.vault.getPool(poolIdNumber);
      if (pool.owner !== walletAddress) {
        this.error("Pool not owned by wallet", 403);
        return;
      }

      // 创建签名者
      const signer = await this.provider.getSigner(walletAddress);
      const vaultWithSigner = this.vault.connect(signer) as any;

      let tx: any;

      if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
        // ERC20代币存款
        if (!this.mockToken || tokenAddress !== this.mockTokenAddress) {
          this.error("Unsupported token", 400);
          return;
        }

        const amountInWei = ethers.parseUnits(amount, 6);
        
        // 检查授权额度
        const allowance = await this.mockToken.allowance(walletAddress, this.vaultAddress);
        if (allowance < amountInWei) {
          this.error("Token approval required", 400);
          return;
        }

        tx = await vaultWithSigner.deposit(poolIdNumber, tokenAddress, amountInWei);
      } else {
        // ETH存款
        const amountInWei = ethers.parseEther(amount);
        tx = await vaultWithSigner.deposit(poolIdNumber, ethers.ZeroAddress, 0, { value: amountInWei });
      }

      await tx.wait();

      this.success({
        poolId: poolIdNumber,
        walletAddress,
        amount,
        tokenAddress: tokenAddress || ethers.ZeroAddress,
        transactionHash: tx.hash,
        message: "Deposit successful"
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 取出资金
   * POST /api/vault/pools/:poolId/withdraw
   */
  @Post("/pools/:poolId/withdraw")
  async withdraw(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const poolId = this.getParam("poolId");
      const poolIdNumber = parseInt(poolId);
      const body = this.getBody<{
        walletAddress: string;
        amount: string;
        tokenAddress?: string;
      }>();

      const { walletAddress, amount, tokenAddress } = body;

      if (isNaN(poolIdNumber) || poolIdNumber <= 0) {
        this.error("Invalid pool ID", 400);
        return;
      }

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!amount || parseFloat(amount) <= 0) {
        this.error("Invalid amount", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      // 验证资金池所有权
      const pool = await this.vault.getPool(poolIdNumber);
      if (pool.owner !== walletAddress) {
        this.error("Pool not owned by wallet", 403);
        return;
      }

      // 创建签名者
      const signer = await this.provider.getSigner(walletAddress);
      const vaultWithSigner = this.vault.connect(signer) as any;

      let tx: any;

      if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
        // ERC20代币提现
        if (!this.mockToken || tokenAddress !== this.mockTokenAddress) {
          this.error("Unsupported token", 400);
          return;
        }

        const amountInWei = ethers.parseUnits(amount, 6);
        tx = await vaultWithSigner.withdraw(poolIdNumber, tokenAddress, amountInWei);
      } else {
        // ETH提现
        const amountInWei = ethers.parseEther(amount);
        tx = await vaultWithSigner.withdraw(poolIdNumber, ethers.ZeroAddress, amountInWei);
      }

      await tx.wait();

      this.success({
        poolId: poolIdNumber,
        walletAddress,
        amount,
        tokenAddress: tokenAddress || ethers.ZeroAddress,
        transactionHash: tx.hash,
        message: "Withdrawal successful"
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 检查代币授权状态
   * GET /api/vault/approval-status
   */
  @Get("/approval-status")
  async getApprovalStatus(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      const walletAddress = this.getQueryParam("walletAddress");
      const tokenAddress = this.getQueryParam("tokenAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.mockToken || !this.vaultAddress) {
        this.error("Contracts not initialized", 500);
        return;
      }

      const [balance, allowance] = await Promise.all([
        this.mockToken.balanceOf(walletAddress),
        this.mockToken.allowance(walletAddress, this.vaultAddress)
      ]);

      this.success({
        walletAddress,
        tokenAddress: await this.mockToken.getAddress(),
        balance: ethers.formatUnits(balance, 6),
        allowance: ethers.formatUnits(allowance, 6),
        needsApproval: allowance === 0n
      });
    } catch (error) {
      this.error(error as Error);
    }
  }
} 