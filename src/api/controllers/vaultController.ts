import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { Controller, Get, Post, Put, Delete } from "../decorators";
import { appConfig } from "../../utils/config";
import { BaseController } from "../baseController";

// Vault ABI - 包含所有方法
const VAULT_ABI = [
  // 查询方法
  "function getUserPools(address user) external view returns (uint256[])",
  "function getPool(uint256 poolId) external view returns (tuple(uint256 id, address owner, uint256 totalBalance, bool isActive, uint256 createdAt, uint256 lastActivityAt))",
  "function getUserPoolCount(address user) external view returns (uint256)",
  "function maxPoolsPerUser() external view returns (uint256)",
  "function minPoolBalance() external view returns (uint256)",
  "function feeRate() external view returns (uint256)",
  "function feeCollector() external view returns (address)",
  "function supportedTokens(address token) external view returns (bool)",
  // 核心操作方法（带签名验证）
  "function createPool(address walletAddress, uint256 initialAmount, address tokenAddress, uint256 nonce, uint256 deadline, bytes memory signature) external payable returns (uint256)",
  "function deletePool(address walletAddress, uint256 poolId, uint256 nonce, uint256 deadline, bytes memory signature) external",
  "function mergePools(address walletAddress, uint256 targetPoolId, uint256 sourcePoolId, uint256 nonce, uint256 deadline, bytes memory signature) external",
  "function deposit(address walletAddress, uint256 poolId, uint256 amount, address tokenAddress, uint256 nonce, uint256 deadline, bytes memory signature) external payable",
  "function withdraw(address walletAddress, uint256 poolId, uint256 amount, address tokenAddress, uint256 nonce, uint256 deadline, bytes memory signature) external",
  "function getNonce(address user) external view returns (uint256)",
  "function getDomainSeparator() external view returns (bytes32)"
];

// MockToken ABI
const MOCK_TOKEN_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)"
];

@Controller("/api/vault")
export class VaultController extends BaseController {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer | null = null;
  private vault: ethers.Contract | null = null;
  private mockToken: ethers.Contract | null = null;
  private vaultAddress: string | null = null;
  private mockTokenAddress: string | null = null;

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(appConfig.getLocalNodeUrl());
    this.initializeContracts();
  }

  private async initializeContracts() {
    try {
      // 从配置中获取合约地址
      this.vaultAddress = appConfig.getVaultAddress();
      this.mockTokenAddress = appConfig.getMockTokenAddress();

      if (!this.vaultAddress || !this.mockTokenAddress) {
        console.error("Contract addresses not found in configuration - set VAULT_ADDRESS and MOCK_TOKEN_ADDRESS in .env file");
        return;
      }

      // 获取私钥配置（用于发送交易）
      const privateKey = appConfig.getFeeCollectorPrivateKey();
      if (privateKey) {
        this.signer = new ethers.Wallet(privateKey, this.provider);
        console.log("Signer initialized with private key");
      } else {
        // 如果没有配置私钥，使用第一个账户作为默认 signer（仅用于测试）
        const accounts = await this.provider.listAccounts();
        if (accounts.length > 0) {
          this.signer = accounts[0];
          console.log("Using first account as signer for testing");
        } else {
          console.warn("No private key configured and no accounts available");
        }
      }

      // 初始化合约实例
      this.vault = new ethers.Contract(this.vaultAddress, VAULT_ABI, this.signer || this.provider);
      this.mockToken = new ethers.Contract(this.mockTokenAddress, MOCK_TOKEN_ABI, this.provider);

      console.log("Vault contracts initialized successfully");
    } catch (error) {
      console.error("Failed to initialize vault contracts:", error);
    }
  }

  /**
   * 获取配置信息
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
        feeCollector: feeCollector,
        vaultAddress: this.vaultAddress,
        mockTokenAddress: this.mockTokenAddress
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取用户的所有资金池
   * GET /api/vault/pools/user/:walletAddress
   */
  @Get("/pools/user/:walletAddress")
  async getUserPools(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      const walletAddress = this.getParam("walletAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const poolIds = await this.vault.getUserPools(walletAddress);
      const pools = [];

      for (const poolId of poolIds) {
        const pool = await this.vault.getPool(poolId);
        pools.push({
          id: Number(pool.id),
          owner: pool.owner,
          totalBalance: ethers.formatEther(pool.totalBalance),
          isActive: pool.isActive,
          createdAt: Number(pool.createdAt),
          lastActivityAt: Number(pool.lastActivityAt)
        });
      }

      this.success({
        walletAddress,
        pools,
        totalPools: pools.length
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取特定资金池信息
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

      if (pool.id === 0n) {
        this.error("Pool not found", 404);
        return;
      }

      this.success({
        id: Number(pool.id),
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
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, initialAmount = "0", tokenAddress, nonce, deadline, signature } = body;

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

      let poolId: bigint | null = null;
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

        tx = await this.vault.createPool(walletAddress, amountInWei, tokenAddress, nonce, deadline, signature);
      } else {
        // ETH创建资金池 - 使用 initialAmount 作为签名验证，但合约调用时传递 0
        const amountInWei = ethers.parseEther(initialAmount);
        // 注意：这里我们传递 initialAmount 而不是 0，因为签名是基于 initialAmount 生成的
        tx = await this.vault.createPool(walletAddress, amountInWei, ethers.ZeroAddress, nonce, deadline, signature, { value: amountInWei });
      }

      const receipt = await tx.wait();
      
      // 查找 PoolCreated 事件
      for (const log of receipt.logs) {
        try {
          const event = this.vault.interface.parseLog(log as any);
          if (event && event.name === 'PoolCreated') {
            poolId = event.args[0];
            break;
          }
        } catch (error) {
          // 忽略无法解析的日志
          continue;
        }
      }
      
      // 如果没有找到事件，记录警告
      if (!poolId) {
        console.warn("No PoolCreated event found in transaction receipt");
      }

      this.success({
        poolId: poolId ? Number(poolId) : null,
        walletAddress,
        initialAmount,
        transactionHash: tx.hash,
        message: "Pool created successfully"
      });
    } catch (error) {
      this.error(error as Error);
      return;
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
      const body = this.getBody<{
        walletAddress: string;
        nonce: number;
        deadline: number;
        signature: string;
      }>();
      const { walletAddress, nonce, deadline, signature } = body;

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

      const tx = await this.vault.deletePool(walletAddress, poolIdNumber, nonce, deadline, signature);
      await tx.wait();

      this.success({
        poolId: poolIdNumber,
        walletAddress,
        transactionHash: tx.hash,
        message: "Pool deleted successfully"
      });
    } catch (error) {
      this.error(error as Error);
      return;
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
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, targetPoolId, sourcePoolId, nonce, deadline, signature } = body;

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
      const [targetPool, sourcePool] = await Promise.all([this.vault.getPool(targetPoolId), this.vault.getPool(sourcePoolId)]);

      if (targetPool.owner !== walletAddress || sourcePool.owner !== walletAddress) {
        this.error("Pool not owned by wallet", 403);
        return;
      }

      const tx = await this.vault.mergePools(walletAddress, targetPoolId, sourcePoolId, nonce, deadline, signature);
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
      return;
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
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, amount, tokenAddress, nonce, deadline, signature } = body;

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

        tx = await this.vault.deposit(walletAddress, poolIdNumber, amountInWei, tokenAddress, nonce, deadline, signature);
      } else {
        // ETH存款
        const amountInWei = ethers.parseEther(amount);
        tx = await this.vault.deposit(walletAddress, poolIdNumber, 0, ethers.ZeroAddress, nonce, deadline, signature, { value: amountInWei });
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
      return;
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
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, amount, tokenAddress, nonce, deadline, signature } = body;

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

      let tx: any;

      if (tokenAddress && tokenAddress !== ethers.ZeroAddress) {
        // ERC20代币提现
        if (!this.mockToken || tokenAddress !== this.mockTokenAddress) {
          this.error("Unsupported token", 400);
          return;
        }

        const amountInWei = ethers.parseUnits(amount, 6);
        tx = await this.vault.withdraw(walletAddress, poolIdNumber, amountInWei, tokenAddress, nonce, deadline, signature);
      } else {
        // ETH提现
        const amountInWei = ethers.parseEther(amount);
        tx = await this.vault.withdraw(walletAddress, poolIdNumber, amountInWei, ethers.ZeroAddress, nonce, deadline, signature);
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
   * 获取代币授权状态
   * GET /api/vault/token/approval/:walletAddress/:tokenAddress
   */
  @Get("/token/approval/:walletAddress/:tokenAddress")
  async getApprovalStatus(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      const walletAddress = this.getParam("walletAddress");
      const tokenAddress = this.getParam("tokenAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
        this.error("Invalid token address", 400);
        return;
      }

      if (!this.mockToken || tokenAddress !== this.mockTokenAddress) {
        this.error("Unsupported token", 400);
        return;
      }

      const [balance, allowance] = await Promise.all([this.mockToken.balanceOf(walletAddress), this.mockToken.allowance(walletAddress, this.vaultAddress)]);

      this.success({
        walletAddress,
        tokenAddress,
        balance: ethers.formatUnits(balance, 6),
        allowance: ethers.formatUnits(allowance, 6),
        needsApproval: allowance === 0n
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取用户nonce
   * GET /api/vault/nonce/:walletAddress
   */
  @Get("/nonce/:walletAddress")
  async getNonce(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      const walletAddress = this.getParam("walletAddress");

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const nonce = await this.vault.getNonce(walletAddress);

      this.success({
        walletAddress,
        nonce: Number(nonce)
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取域名分隔符
   * GET /api/vault/domain-separator
   */
  @Get("/domain-separator")
  async getDomainSeparator(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.vault) {
        this.error("Vault contract not initialized", 500);
        return;
      }

      const domainSeparator = await this.vault.getDomainSeparator();

      this.success({
        domainSeparator: domainSeparator
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 验证签名
   * POST /api/vault/verify-signature
   */
  @Post("/verify-signature")
  async verifySignature(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      const body = this.getBody<{
        walletAddress: string;
        message: string;
        signature: string;
      }>();

      const { walletAddress, message, signature } = body;

      if (!walletAddress || !ethers.isAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!message || !signature) {
        this.error("Message and signature are required", 400);
        return;
      }

      // 验证签名
      const messageHash = ethers.hashMessage(message);
      const recoveredAddress = ethers.verifyMessage(message, signature);

      const isValid = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

      this.success({
        walletAddress,
        message,
        signature,
        isValid,
        recoveredAddress: recoveredAddress
      });
    } catch (error) {
      this.error(error as Error);
    }
  }
}
