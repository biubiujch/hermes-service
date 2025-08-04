import { Router, Request, Response } from "express";
import { TestTokenService } from "../../services/TestTokenService";
import { BlockchainService } from "../../services/BlockchainService";
import logger from "../../utils/logger";

const router = Router();

// 获取服务实例
const testTokenService = new TestTokenService();
const blockchainService = new BlockchainService();

/**
 * GET /api/test-token/configs
 * 获取所有测试代币配置
 */
router.get("/configs", async (req: Request, res: Response) => {
  try {
    const configs = testTokenService.getTestTokenConfigs();
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    logger.error("获取测试代币配置失败:", error);
    res.status(500).json({
      success: false,
      error: "获取测试代币配置失败"
    });
  }
});

/**
 * GET /api/test-token/:network/user/:address/balance/:symbol
 * 检查用户特定代币余额
 */
router.get("/:network/user/:address/balance/:symbol", async (req: Request, res: Response) => {
  try {
    const { network, address, symbol } = req.params;
    
    // 验证地址格式
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: "无效的钱包地址格式"
      });
    }

    const balance = await testTokenService.checkUserTokenBalance(network, address, symbol);
    
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    logger.error("检查用户代币余额失败:", error);
    res.status(500).json({
      success: false,
      error: "检查用户代币余额失败"
    });
  }
});

/**
 * GET /api/test-token/:network/user/:address/balances
 * 获取用户所有测试代币余额
 */
router.get("/:network/user/:address/balances", async (req: Request, res: Response) => {
  try {
    const { network, address } = req.params;
    
    // 验证地址格式
    if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: "无效的钱包地址格式"
      });
    }

    const balances = await testTokenService.getAllUserTokenBalances(network, address);
    
    res.json({
      success: true,
      data: balances
    });
  } catch (error) {
    logger.error("获取用户所有代币余额失败:", error);
    res.status(500).json({
      success: false,
      error: "获取用户所有代币余额失败"
    });
  }
});

/**
 * POST /api/test-token/:network/inject/:symbol
 * 手动注入测试代币
 */
router.post("/:network/inject/:symbol", async (req: Request, res: Response) => {
  try {
    const { network, symbol } = req.params;
    const { userAddress, privateKey } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: userAddress"
      });
    }

    // 验证地址格式
    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: "无效的钱包地址格式"
      });
    }

    const txHash = await testTokenService.injectTestToken(network, userAddress, symbol, privateKey);
    
    res.json({
      success: true,
      data: {
        txHash,
        network,
        userAddress,
        symbol,
        message: `已注入测试代币 ${symbol} 到 ${userAddress}`
      }
    });
  } catch (error) {
    logger.error("注入测试代币失败:", error);
    res.status(500).json({
      success: false,
      error: "注入测试代币失败"
    });
  }
});

/**
 * POST /api/test-token/:network/check-and-inject/:symbol
 * 检查并自动注入测试代币（如果余额不足）
 */
router.post("/:network/check-and-inject/:symbol", async (req: Request, res: Response) => {
  try {
    const { network, symbol } = req.params;
    const { userAddress, privateKey } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: userAddress"
      });
    }

    // 验证地址格式
    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: "无效的钱包地址格式"
      });
    }

    const result = await testTokenService.checkAndInjectTestToken(network, userAddress, symbol, privateKey);
    
    res.json({
      success: true,
      data: {
        ...result,
        network,
        userAddress,
        symbol,
        message: result.injected 
          ? `已自动注入测试代币 ${symbol} 到 ${userAddress}`
          : `余额充足，无需注入 ${symbol}`
      }
    });
  } catch (error) {
    logger.error("检查并注入测试代币失败:", error);
    res.status(500).json({
      success: false,
      error: "检查并注入测试代币失败"
    });
  }
});

/**
 * POST /api/test-token/:network/auto-inject-all
 * 检查并自动注入所有测试代币（如果余额不足）
 */
router.post("/:network/auto-inject-all", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    const { userAddress, privateKey } = req.body;
    
    if (!userAddress) {
      return res.status(400).json({
        success: false,
        error: "缺少必要参数: userAddress"
      });
    }

    // 验证地址格式
    if (!userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({
        success: false,
        error: "无效的钱包地址格式"
      });
    }

    const configs = testTokenService.getTestTokenConfigs();
    const results = [];

    for (const config of configs) {
      try {
        const result = await testTokenService.checkAndInjectTestToken(
          network, 
          userAddress, 
          config.symbol, 
          privateKey
        );
        results.push({
          symbol: config.symbol,
          ...result
        });
      } catch (error) {
        logger.warn(`自动注入 ${config.symbol} 失败:`, error);
        results.push({
          symbol: config.symbol,
          injected: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const injectedCount = results.filter(r => r.injected).length;
    const totalCount = results.length;
    
    res.json({
      success: true,
      data: {
        network,
        userAddress,
        results,
        summary: {
          total: totalCount,
          injected: injectedCount,
          skipped: totalCount - injectedCount
        },
        message: `检查完成，共 ${totalCount} 个代币，注入 ${injectedCount} 个，跳过 ${totalCount - injectedCount} 个`
      }
    });
  } catch (error) {
    logger.error("自动注入所有测试代币失败:", error);
    res.status(500).json({
      success: false,
      error: "自动注入所有测试代币失败"
    });
  }
});

/**
 * GET /api/test-token/:network/status
 * 获取测试代币服务状态
 */
router.get("/:network/status", async (req: Request, res: Response) => {
  try {
    const { network } = req.params;
    
    // 检查网络连接
    const networkStatus = await blockchainService.getNetworkStatus(network);
    const configs = testTokenService.getTestTokenConfigs();
    
    res.json({
      success: true,
      data: {
        network: networkStatus,
        supportedTokens: configs.length,
        tokens: configs.map(config => ({
          symbol: config.symbol,
          name: config.name,
          address: config.address,
          minBalance: config.minBalance,
          injectAmount: config.injectAmount
        }))
      }
    });
  } catch (error) {
    logger.error("获取测试代币服务状态失败:", error);
    res.status(500).json({
      success: false,
      error: "获取测试代币服务状态失败"
    });
  }
});

export default router; 