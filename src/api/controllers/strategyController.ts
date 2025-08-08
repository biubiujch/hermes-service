import { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";
import { Controller, Get, Post, Put, Delete } from "../decorators";
import { appConfig } from "../../utils/config";
import { ContractController } from "../baseController";
import { contentStore } from "../../utils/contentStore";

// StrategyRegistry ABI
const STRATEGY_REGISTRY_ABI = [
  // 查询方法
  "function getUserStrategies(address user) external view returns (uint256[])",
  "function getStrategy(uint256 strategyId) external view returns (tuple(uint256 id, address owner, bytes32 symbol, bytes32 paramsHash, bool isActive, uint256 createdAt, uint256 updatedAt))",
  "function maxStrategiesPerUser() external view returns (uint256)",
  "function nextStrategyId() external view returns (uint256)",
  // 核心操作方法（带签名验证）
  "function registerStrategy(address walletAddress, bytes32 paramsHash, bytes32 symbol, uint256 nonce, uint256 deadline, bytes calldata signature, string calldata metadataURI) external returns (uint256)",
  "function updateStrategy(address walletAddress, uint256 strategyId, bytes32 newParamsHash, uint256 nonce, uint256 deadline, bytes calldata signature, string calldata metadataURI) external",
  "function setStrategyActive(address walletAddress, uint256 strategyId, bool active, uint256 nonce, uint256 deadline, bytes calldata signature) external",
  "function deleteStrategy(address walletAddress, uint256 strategyId, uint256 nonce, uint256 deadline, bytes calldata signature) external",
  "function getNonce(address user) external view returns (uint256)",
  "function getDomainSeparator() external view returns (bytes32)"
];

interface StrategyParams {
  symbol: string;
  leverage: number;
  takeProfit: number;
  stopLoss: number;
  amountLimit: string;
  maxDrawdown: number;
  freq: string;
  riskLevel: string;
  indicators?: Record<string, any>;
  [key: string]: any;
}

interface StoredStrategy {
  strategyId: number;
  owner: string;
  params: StrategyParams;
  paramsHash: string;
  signature?: string;
  version: number;
}

@Controller("/api/strategy")
export class StrategyController extends ContractController {
  private strategyRegistry: ethers.Contract | null = null;
  private strategyRegistryAddress: string | null = null;

  constructor() {
    super();
    this.initializeContracts();
  }

  private async initializeContracts() {
    try {
      // 从配置中获取合约地址
      this.strategyRegistryAddress = appConfig.getStrategyRegistryAddress();

      if (!this.strategyRegistryAddress) {
        console.error("StrategyRegistry address not found in configuration - set STRATEGY_REGISTRY_ADDRESS in .env file");
        return;
      }

      // 初始化合约实例
      this.strategyRegistry = await this.createContract(this.strategyRegistryAddress, STRATEGY_REGISTRY_ABI);

      console.log("Strategy contracts initialized successfully");
    } catch (error) {
      console.error("Failed to initialize strategy contracts:", error);
    }
  }

  /**
   * 获取策略配置信息
   * GET /api/strategy/config
   */
  @Get("/config")
  async getConfig(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const [maxStrategiesPerUser, nextStrategyId, domainSeparator] = await Promise.all([
        this.strategyRegistry.maxStrategiesPerUser(),
        this.strategyRegistry.nextStrategyId(),
        this.strategyRegistry.getDomainSeparator()
      ]);

      this.success({
        maxStrategiesPerUser: Number(maxStrategiesPerUser),
        nextStrategyId: Number(nextStrategyId),
        domainSeparator: String(domainSeparator),
        strategyRegistryAddress: this.strategyRegistryAddress,
        eip712Domain: {
          name: "Hermora Strategy",
          version: "1",
          chainId: Number(await this.provider.getNetwork().then(n => n.chainId)),
          verifyingContract: this.strategyRegistryAddress
        }
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取用户策略列表
   * GET /api/strategy/user/:walletAddress
   */
  @Get("/user/:walletAddress")
  async getUserStrategies(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const walletAddress = this.getParam("walletAddress");
      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      const strategyIds = await this.strategyRegistry.getUserStrategies(walletAddress);
      const strategies = [];

      for (const strategyId of strategyIds) {
        try {
          const strategy = await this.strategyRegistry.getStrategy(strategyId);
          const storedParams = contentStore.getForExecution<StrategyParams>('strategies', strategy.paramsHash);
          
          strategies.push({
            id: Number(strategy.id),
            owner: strategy.owner,
            symbol: ethers.decodeBytes32String(strategy.symbol),
            paramsHash: strategy.paramsHash,
            isActive: strategy.isActive,
            createdAt: Number(strategy.createdAt),
            updatedAt: Number(strategy.updatedAt),
            params: storedParams || null
          });
        } catch (error) {
          console.error(`Failed to get strategy ${strategyId}:`, error);
        }
      }

      this.success({
        walletAddress,
        strategies,
        total: strategies.length
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取用户 nonce
   * GET /api/strategy/nonce/:walletAddress
   */
  @Get("/nonce/:walletAddress")
  async getNonce(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const walletAddress = this.getParam("walletAddress");
      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      const nonce = await this.strategyRegistry.getNonce(walletAddress);

      this.success({
        walletAddress,
        nonce: Number(nonce)
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取 EIP-712 域名分隔符
   * GET /api/strategy/domain-separator
   */
  @Get("/domain-separator")
  async getDomainSeparator(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const domainSeparator = await this.strategyRegistry.getDomainSeparator();

      this.success({
        domainSeparator: String(domainSeparator),
        eip712Domain: {
          name: "Hermora Strategy",
          version: "1",
          chainId: Number(await this.provider.getNetwork().then(n => n.chainId)),
          verifyingContract: this.strategyRegistryAddress
        }
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 获取策略详情
   * GET /api/strategy/:strategyId
   */
  @Get("/:strategyId")
  async getStrategy(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const strategyId = this.getParam("strategyId");
      if (!strategyId || isNaN(Number(strategyId))) {
        this.error("Invalid strategy ID", 400);
        return;
      }

      const strategy = await this.strategyRegistry.getStrategy(strategyId);
      const storedParams = contentStore.getForExecution<StrategyParams>('strategies', strategy.paramsHash);

      this.success({
        id: Number(strategy.id),
        owner: strategy.owner,
        symbol: ethers.decodeBytes32String(strategy.symbol),
        paramsHash: strategy.paramsHash,
        isActive: strategy.isActive,
        createdAt: Number(strategy.createdAt),
        updatedAt: Number(strategy.updatedAt),
        params: storedParams || null
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 注册策略
   * POST /api/strategy/register
   */
  @Post("/register")
  async registerStrategy(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const body = this.getBody<{
        walletAddress: string;
        params: StrategyParams;
        symbol: string;
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, params, symbol, nonce, deadline, signature } = body;

      // 验证参数
      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!params || !symbol) {
        this.error("Missing required parameters", 400);
        return;
      }

      // 计算参数哈希
      const paramsHash = contentStore.computeHash(params);
      
      // 存储策略参数到本地（只存储参数，不存储元数据）
      contentStore.put('strategies', params);

      // 调用合约注册策略
      const symbolBytes32 = ethers.encodeBytes32String(symbol);
      const metadataURI = `ipfs://strategies/${paramsHash}`; // 预留 IPFS URI

      const tx = await this.strategyRegistry.registerStrategy(
        walletAddress,
        paramsHash,
        symbolBytes32,
        nonce,
        deadline,
        signature,
        metadataURI
      );

      // 等待交易确认
      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      // 查找 StrategyRegistered 事件
      let strategyId = 0;
      for (const log of receipt.logs) {
        try {
          const event = this.strategyRegistry!.interface.parseLog(log as any);
          if (event && event.name === 'StrategyRegistered') {
            strategyId = Number(event.args[0]);
            break;
          }
        } catch (error) {
          continue;
        }
      }

      this.success({
        strategyId,
        paramsHash,
        transactionHash: receipt.hash,
        metadataURI
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 更新策略
   * PUT /api/strategy/:strategyId
   */
  @Put("/:strategyId")
  async updateStrategy(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const strategyId = this.getParam("strategyId");
      const body = this.getBody<{
        walletAddress: string;
        params: StrategyParams;
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, params, nonce, deadline, signature } = body;

      // 验证参数
      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      if (!params) {
        this.error("Missing strategy parameters", 400);
        return;
      }

      // 计算新的参数哈希
      const newParamsHash = contentStore.computeHash(params);
      
      // 更新本地存储（只存储参数）
      contentStore.put('strategies', params);

      // 调用合约更新策略
      const metadataURI = `ipfs://strategies/${newParamsHash}`;

      const tx = await this.strategyRegistry.updateStrategy(
        walletAddress,
        strategyId,
        newParamsHash,
        nonce,
        deadline,
        signature,
        metadataURI
      );

      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      this.success({
        strategyId: Number(strategyId),
        newParamsHash,
        transactionHash: receipt.hash,
        metadataURI
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 设置策略激活状态
   * PUT /api/strategy/:strategyId/active
   */
  @Put("/:strategyId/active")
  async setStrategyActive(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const strategyId = this.getParam("strategyId");
      const body = this.getBody<{
        walletAddress: string;
        active: boolean;
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, active, nonce, deadline, signature } = body;

      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      const tx = await this.strategyRegistry.setStrategyActive(
        walletAddress,
        strategyId,
        active,
        nonce,
        deadline,
        signature
      );

      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      this.success({
        strategyId: Number(strategyId),
        active,
        transactionHash: receipt.hash
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 删除策略
   * DELETE /api/strategy/:strategyId
   */
  @Delete("/:strategyId")
  async deleteStrategy(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const strategyId = this.getParam("strategyId");
      const body = this.getBody<{
        walletAddress: string;
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, nonce, deadline, signature } = body;

      if (!this.validateAddress(walletAddress)) {
        this.error("Invalid wallet address", 400);
        return;
      }

      const tx = await this.strategyRegistry.deleteStrategy(
        walletAddress,
        strategyId,
        nonce,
        deadline,
        signature
      );

      const receipt = await Promise.race([
        tx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), 30000)
        )
      ]);

      this.success({
        strategyId: Number(strategyId),
        transactionHash: receipt.hash
      });
    } catch (error) {
      this.error(error as Error);
    }
  }

  /**
   * 验证签名（调试用）
   * POST /api/strategy/verify-signature
   */
  @Post("/verify-signature")
  async verifySignature(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);

    try {
      if (!this.strategyRegistry) {
        this.error("StrategyRegistry contract not initialized", 500);
        return;
      }

      const body = this.getBody<{
        walletAddress: string;
        params: StrategyParams;
        symbol: string;
        nonce: number;
        deadline: number;
        signature: string;
      }>();

      const { walletAddress, params, symbol, nonce, deadline, signature } = body;

      // 计算参数哈希
      const paramsHash = contentStore.computeHash(params);
      const symbolBytes32 = ethers.encodeBytes32String(symbol);

      // 构建 EIP-712 消息
      const domain = {
        name: "Hermora Strategy",
        version: "1",
        chainId: await this.provider.getNetwork().then(n => n.chainId),
        verifyingContract: this.strategyRegistryAddress
      };

      const types = {
        CreateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "paramsHash", type: "bytes32" },
          { name: "symbol", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      };

      const message = {
        walletAddress,
        paramsHash,
        symbol: symbolBytes32,
        nonce,
        deadline
      };

      // 验证签名
      const recoveredAddress = ethers.verifyTypedData(domain, types, message, signature);

      this.success({
        walletAddress,
        recoveredAddress,
        isValid: recoveredAddress.toLowerCase() === walletAddress.toLowerCase(),
        paramsHash,
        symbolBytes32
      });
    } catch (error) {
      this.error(error as Error);
    }
  }
} 