import { Router, Request, Response } from "express";
import { AssetPoolService } from "../../services/AssetPoolService";
import { BlockchainService } from "../../services/BlockchainService";
import { ConfigManager } from "../../config/ConfigManager";
import logger from "../../utils/logger";

const router = Router();

// 获取服务实例
const blockchainService = new BlockchainService();
const configManager = ConfigManager.getInstance();

// 从配置管理器获取合约地址
const getContractAddress = (network: string): string => {
  const contractAddress = configManager.getContractAddress(network);
  if (!contractAddress) {
    throw new Error(`网络 ${network} 的合约地址未配置`);
  }
  return contractAddress;
};

// 创建资金池服务实例
const createAssetPoolService = (network: string): AssetPoolService => {
  const contractAddress = getContractAddress(network);
  if (!contractAddress) {
    throw new Error(`网络 ${network} 的合约地址未配置`);
  }
  
  const provider = blockchainService.getProvider(network);
  const signer = blockchainService.getSigner(network);
  
  return new AssetPoolService(contractAddress, provider, signer);
};

/**
 * GET /api/asset-pool/networks
 * 获取支持的网络列表
 */
router.get("/networks", async (req: Request, res: Response) => {
  try {
    const networks = blockchainService.getSupportedNetworks();
    res.json({
      success: true,
      data: networks
    });
  } catch (error) {
    logger.error("获取网络列表失败:", error);
    res.status(500).json({
      success: false,
      error: "获取网络列表失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/status
 * 获取网络状态
 */
router.get("/:network/status", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const status = await blockchainService.getNetworkStatus(network);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error("获取网络状态失败:", error);
    res.status(500).json({
      success: false,
      error: "获取网络状态失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/config
 * 获取合约配置信息
 */
router.get("/:network/config", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const assetPoolService = createAssetPoolService(network);
    const config = await assetPoolService.getContractConfig();
    
    res.json({
      success: true,
      data: {
        ...config,
        contractAddress: assetPoolService.getContractAddress(),
        network
      }
    });
  } catch (error) {
    logger.error("获取合约配置失败:", error);
    res.status(500).json({
      success: false,
      error: "获取合约配置失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/balance
 * 获取资金池余额
 */
router.get("/:network/balance", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { token = "0x0000000000000000000000000000000000000000" } = req.query;
    
    const assetPoolService = createAssetPoolService(network);
    const balance = await assetPoolService.getPoolBalance(token as string);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error("获取资金池余额失败:", error);
    res.status(500).json({
      success: false,
      error: "获取资金池余额失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/user/:address/balance
 * 获取用户余额
 */
router.get("/:network/user/:address/balance", async (req: Request, res: Response) => {
  try {
    const { network, address } = req.params;
    const { token = "0x0000000000000000000000000000000000000000" } = req.query;
    
    const assetPoolService = createAssetPoolService(network);
    const balance = await assetPoolService.getUserBalance(address, token as string);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error("获取用户余额失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户余额失败"
    });
  }
});

/**
 * POST /api/asset-pool/:network/deposit
 * 用户存款
 */
router.post("/:network/deposit", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { user, token, amount, privateKey } = req.body;
    
    if (!user || !amount) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: user, amount"
      });
    }
    
    const assetPoolService = createAssetPoolService(network);
    const txHash = await assetPoolService.deposit({
      user,
      token: token || "0x0000000000000000000000000000000000000000",
      amount,
      privateKey
    });
    
    res.json({
      success: true,
      data: {
        txHash,
        network,
        user,
        token: token || "0x0000000000000000000000000000000000000000",
        amount
      }
    });
  } catch (error) {
    logger.error("存款失败:", error);
    res.status(500).json({
      success: false,
      error: "存款失败"
    });
  }
});

/**
 * POST /api/asset-pool/:network/withdraw
 * 用户提款
 */
router.post("/:network/withdraw", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { user, token, amount, privateKey } = req.body;
    
    if (!user || !amount) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: user, amount"
      });
    }
    
    const assetPoolService = createAssetPoolService(network);
    const txHash = await assetPoolService.withdraw({
      user,
      token: token || "0x0000000000000000000000000000000000000000",
      amount,
      privateKey
    });
    
    res.json({
      success: true,
      data: {
        txHash,
        network,
        user,
        token: token || "0x0000000000000000000000000000000000000000",
        amount
      }
    });
  } catch (error) {
    logger.error("提款失败:", error);
    res.status(500).json({
      success: false,
      error: "提款失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/token/:token/supported
 * 检查代币是否支持
 */
router.get("/:network/token/:token/supported", async (req: Request, res: Response) => {
  try {
    const { network, token } = req.params;
    const assetPoolService = createAssetPoolService(network);
    const isSupported = await assetPoolService.isTokenSupported(token);
    
    res.json({
      success: true,
      data: {
        token,
        supported: isSupported
      }
    });
  } catch (error) {
    logger.error("检查代币支持状态失败:", error);
    res.status(500).json({
      success: false,
      error: "检查代币支持状态失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/strategy/:strategy/authorized
 * 检查策略是否已授权
 */
router.get("/:network/strategy/:strategy/authorized", async (req: Request, res: Response) => {
  try {
    const { network, strategy } = req.params;
    const assetPoolService = createAssetPoolService(network);
    const isAuthorized = await assetPoolService.isStrategyAuthorized(strategy);
    
    res.json({
      success: true,
      data: {
        strategy,
        authorized: isAuthorized
      }
    });
  } catch (error) {
    logger.error("检查策略授权状态失败:", error);
    res.status(500).json({
      success: false,
      error: "检查策略授权状态失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/transaction/:txHash
 * 获取交易详情
 */
router.get("/:network/transaction/:txHash", async (req: Request, res: Response) => {
  try {
    const { network, txHash } = req.params;
    const transaction = await blockchainService.getTransaction(network, txHash);
    
    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    logger.error("获取交易详情失败:", error);
    res.status(500).json({
      success: false,
      error: "获取交易详情失败"
    });
  }
});

/**
 * GET /api/asset-pool/:network/account/:address/balance
 * 获取账户ETH余额
 */
router.get("/:network/account/:address/balance", async (req: Request, res: Response) => {
  try {
    const { network, address } = req.params;
    const balance = await blockchainService.getBalance(network, address);
    
    res.json({
      success: true,
      data: {
        address,
        balance,
        token: "ETH"
      }
    });
  } catch (error) {
    logger.error("获取账户余额失败:", error);
    res.status(500).json({
      success: false,
      error: "获取账户余额失败"
    });
  }
});

export default router; 