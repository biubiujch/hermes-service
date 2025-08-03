import express from "express";
import { ethers } from "ethers";
import { AssetPool__factory, StrategyManager__factory } from "../typechain-types";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 合约地址（从部署文件读取）
let assetPoolAddress: string;
let strategyManagerAddress: string;
let assetPool: any;
let strategyManager: any;
let provider: ethers.Provider;

// 初始化合约连接
async function initializeContracts() {
  try {
    // 读取部署信息
    const deploymentInfo = require("../deployment.json");
    assetPoolAddress = deploymentInfo.contracts.AssetPool;
    strategyManagerAddress = deploymentInfo.contracts.StrategyManager;

    // 连接到本地网络
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

    // 初始化合约实例
    assetPool = AssetPool__factory.connect(assetPoolAddress, provider);
    strategyManager = StrategyManager__factory.connect(strategyManagerAddress, provider);

    console.log("合约初始化成功");
    console.log("AssetPool 地址:", assetPoolAddress);
    console.log("StrategyManager 地址:", strategyManagerAddress);
  } catch (error) {
    console.error("合约初始化失败:", error);
    process.exit(1);
  }
}

// 资金池相关API

/**
 * 获取用户余额信息
 * GET /api/pool/balance/:userAddress
 */
app.get("/api/pool/balance/:userAddress", async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "无效的用户地址" });
    }

    const userBalance = await assetPool.getUserBalance(userAddress);
    const availableBalance = await assetPool.getAvailableBalance(userAddress);
    const lockedBalance = await assetPool.getLockedBalance(userAddress);

    res.json({
      success: true,
      data: {
        userAddress,
        totalDeposited: ethers.formatEther(userBalance.totalDeposited),
        totalWithdrawn: ethers.formatEther(userBalance.totalWithdrawn),
        availableBalance: ethers.formatEther(availableBalance),
        lockedBalance: ethers.formatEther(lockedBalance),
        lastDepositTime: userBalance.lastDepositTime.toString(),
        lastWithdrawTime: userBalance.lastWithdrawTime.toString()
      }
    });
  } catch (error) {
    console.error("获取用户余额失败:", error);
    res.status(500).json({ error: "获取用户余额失败" });
  }
});

/**
 * 获取池子总余额
 * GET /api/pool/total-balance
 */
app.get("/api/pool/total-balance", async (req, res) => {
  try {
    const totalPoolBalance = await assetPool.totalPoolBalance();
    const contractBalance = await assetPool.getContractBalance();

    res.json({
      success: true,
      data: {
        totalPoolBalance: ethers.formatEther(totalPoolBalance),
        contractBalance: ethers.formatEther(contractBalance)
      }
    });
  } catch (error) {
    console.error("获取池子总余额失败:", error);
    res.status(500).json({ error: "获取池子总余额失败" });
  }
});

/**
 * 获取池子配置信息
 * GET /api/pool/config
 */
app.get("/api/pool/config", async (req, res) => {
  try {
    const minDepositAmount = await assetPool.minDepositAmount();
    const maxWithdrawAmount = await assetPool.maxWithdrawAmount();

    res.json({
      success: true,
      data: {
        minDepositAmount: ethers.formatEther(minDepositAmount),
        maxWithdrawAmount: ethers.formatEther(maxWithdrawAmount)
      }
    });
  } catch (error) {
    console.error("获取池子配置失败:", error);
    res.status(500).json({ error: "获取池子配置失败" });
  }
});

// 策略相关API

/**
 * 获取用户策略列表
 * GET /api/strategies/:userAddress
 */
app.get("/api/strategies/:userAddress", async (req, res) => {
  try {
    const { userAddress } = req.params;

    if (!ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "无效的用户地址" });
    }

    const strategyIds = await strategyManager.getUserStrategies(userAddress);
    const strategies = [];

    for (const strategyId of strategyIds) {
      try {
        const strategy = await strategyManager.getStrategy(strategyId);
        strategies.push({
          id: strategy.id.toString(),
          name: strategy.name,
          symbol: strategy.symbol,
          investmentAmount: ethers.formatEther(strategy.investmentAmount),
          leverage: strategy.leverage.toString(),
          entryPrice: ethers.formatEther(strategy.entryPrice),
          stopLoss: ethers.formatEther(strategy.stopLoss),
          takeProfit: ethers.formatEther(strategy.takeProfit),
          maxSlippage: strategy.maxSlippage.toString(),
          status: strategy.status,
          createdAt: strategy.createdAt.toString(),
          updatedAt: strategy.updatedAt.toString(),
          executedAt: strategy.executedAt.toString(),
          isLong: strategy.isLong,
          gasLimit: strategy.gasLimit.toString(),
          maxGasPrice: ethers.formatEther(strategy.maxGasPrice)
        });
      } catch (error) {
        console.error(`获取策略 ${strategyId} 失败:`, error);
      }
    }

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    console.error("获取用户策略列表失败:", error);
    res.status(500).json({ error: "获取用户策略列表失败" });
  }
});

/**
 * 获取活跃策略列表
 * GET /api/strategies/active
 */
app.get("/api/strategies/active", async (req, res) => {
  try {
    const activeStrategyIds = await strategyManager.getActiveStrategies();
    const strategies = [];

    for (const strategyId of activeStrategyIds) {
      try {
        const strategy = await strategyManager.getStrategy(strategyId);
        strategies.push({
          id: strategy.id.toString(),
          user: strategy.user,
          name: strategy.name,
          symbol: strategy.symbol,
          investmentAmount: ethers.formatEther(strategy.investmentAmount),
          leverage: strategy.leverage.toString(),
          entryPrice: ethers.formatEther(strategy.entryPrice),
          stopLoss: ethers.formatEther(strategy.stopLoss),
          takeProfit: ethers.formatEther(strategy.takeProfit),
          maxSlippage: strategy.maxSlippage.toString(),
          status: strategy.status,
          createdAt: strategy.createdAt.toString(),
          updatedAt: strategy.updatedAt.toString(),
          executedAt: strategy.executedAt.toString(),
          isLong: strategy.isLong,
          gasLimit: strategy.gasLimit.toString(),
          maxGasPrice: ethers.formatEther(strategy.maxGasPrice)
        });
      } catch (error) {
        console.error(`获取活跃策略 ${strategyId} 失败:`, error);
      }
    }

    res.json({
      success: true,
      data: strategies
    });
  } catch (error) {
    console.error("获取活跃策略列表失败:", error);
    res.status(500).json({ error: "获取活跃策略列表失败" });
  }
});

/**
 * 获取策略详情
 * GET /api/strategies/detail/:strategyId
 */
app.get("/api/strategies/detail/:strategyId", async (req, res) => {
  try {
    const { strategyId } = req.params;

    const strategy = await strategyManager.getStrategy(strategyId);

    res.json({
      success: true,
      data: {
        id: strategy.id.toString(),
        user: strategy.user,
        name: strategy.name,
        symbol: strategy.symbol,
        investmentAmount: ethers.formatEther(strategy.investmentAmount),
        leverage: strategy.leverage.toString(),
        entryPrice: ethers.formatEther(strategy.entryPrice),
        stopLoss: ethers.formatEther(strategy.stopLoss),
        takeProfit: ethers.formatEther(strategy.takeProfit),
        maxSlippage: strategy.maxSlippage.toString(),
        status: strategy.status,
        createdAt: strategy.createdAt.toString(),
        updatedAt: strategy.updatedAt.toString(),
        executedAt: strategy.executedAt.toString(),
        isLong: strategy.isLong,
        gasLimit: strategy.gasLimit.toString(),
        maxGasPrice: ethers.formatEther(strategy.maxGasPrice)
      }
    });
  } catch (error) {
    console.error("获取策略详情失败:", error);
    res.status(500).json({ error: "获取策略详情失败" });
  }
});

/**
 * 获取策略管理器配置
 * GET /api/strategies/config
 */
app.get("/api/strategies/config", async (req, res) => {
  try {
    const minInvestmentAmount = await strategyManager.minInvestmentAmount();
    const maxInvestmentAmount = await strategyManager.maxInvestmentAmount();
    const maxLeverage = await strategyManager.maxLeverage();
    const defaultMaxSlippage = await strategyManager.defaultMaxSlippage();

    res.json({
      success: true,
      data: {
        minInvestmentAmount: ethers.formatEther(minInvestmentAmount),
        maxInvestmentAmount: ethers.formatEther(maxInvestmentAmount),
        maxLeverage: maxLeverage.toString(),
        defaultMaxSlippage: defaultMaxSlippage.toString()
      }
    });
  } catch (error) {
    console.error("获取策略配置失败:", error);
    res.status(500).json({ error: "获取策略配置失败" });
  }
});

// 系统状态API

/**
 * 获取系统状态
 * GET /api/system/status
 */
app.get("/api/system/status", async (req, res) => {
  try {
    const assetPoolPaused = await assetPool.paused();
    const strategyManagerPaused = await strategyManager.paused();

    res.json({
      success: true,
      data: {
        assetPoolPaused,
        strategyManagerPaused,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("获取系统状态失败:", error);
    res.status(500).json({ error: "获取系统状态失败" });
  }
});

/**
 * 获取合约地址
 * GET /api/system/contracts
 */
app.get("/api/system/contracts", async (req, res) => {
  res.json({
    success: true,
    data: {
      assetPool: assetPoolAddress,
      strategyManager: strategyManagerAddress
    }
  });
});

// 错误处理中间件
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("服务器错误:", error);
  res.status(500).json({ error: "服务器内部错误" });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ error: "接口不存在" });
});

// 启动服务器
async function startServer() {
  await initializeContracts();

  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log("API 接口已就绪");
  });
}

startServer().catch(console.error);
