import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// 加载环境变量
dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  // 从环境变量获取手续费收集地址
  const feeCollectorAddress = process.env.FEE_COLLECTOR_ADDRESS;
  console.log("Environment FEE_COLLECTOR_ADDRESS:", feeCollectorAddress);
  
  if (!feeCollectorAddress || feeCollectorAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error("FEE_COLLECTOR_ADDRESS not set in environment variables or is zero address");
  }
  
  // 验证地址格式
  if (!ethers.isAddress(feeCollectorAddress)) {
    throw new Error("FEE_COLLECTOR_ADDRESS is not a valid Ethereum address");
  }
  
  console.log("Fee collector address:", feeCollectorAddress);

  // 部署 MockUSDT
  console.log("Deploying MockUSDT...");
  const MockUSDT = await ethers.getContractFactory("MockUSDT");
  const mockUSDT = await MockUSDT.deploy(deployer.address);
  await mockUSDT.waitForDeployment();
  console.log("MockUSDT deployed to:", await mockUSDT.getAddress());

  // 部署 HermesController
  console.log("Deploying HermesController...");
  const HermesController = await ethers.getContractFactory("HermesController");
  const hermesController = await HermesController.deploy(
    await mockUSDT.getAddress(),
    feeCollectorAddress, // feeCollector from env
    deployer.address  // admin
  );
  await hermesController.waitForDeployment();
  console.log("HermesController deployed to:", await hermesController.getAddress());

  // 获取模块地址
  const moduleAddresses = await hermesController.getModuleAddresses();
  console.log("PoolManager deployed to:", moduleAddresses[0]);
  console.log("MembershipManager deployed to:", moduleAddresses[1]);
  console.log("StrategyManager deployed to:", moduleAddresses[2]);
  console.log("MockGMX deployed to:", moduleAddresses[3]);

  // 注意：测试代币需要用户通过前端手动领取
  // 用户可以通过调用 MockUSDT.mintForTesting() 函数来领取测试代币
  console.log("Test USDT can be claimed by users through the frontend");
  console.log("Users can call MockUSDT.mintForTesting() function to get test tokens");

  console.log("\n=== Deployment Summary ===");
  console.log("MockUSDT:", await mockUSDT.getAddress());
  console.log("HermesController:", await hermesController.getAddress());
  console.log("PoolManager:", moduleAddresses[0]);
  console.log("MembershipManager:", moduleAddresses[1]);
  console.log("StrategyManager:", moduleAddresses[2]);
  console.log("MockGMX:", moduleAddresses[3]);
  console.log("Deployer:", deployer.address);
  console.log("Fee Collector:", feeCollectorAddress);

  // 验证合约功能
  console.log("\n=== Contract Verification ===");
  
  // 测试创建资金池（不需要代币）
  const poolName = "Test Pool";
  const poolDescription = "A test pool for development";
  const createPoolTx = await hermesController.createPool(poolName, poolDescription);
  await createPoolTx.wait();
  console.log("✓ Pool creation functionality verified");

  // 测试创建策略（不需要代币）
  const strategyName = "Test Strategy";
  const strategyDescription = "A test strategy";
  const strategyData = ethers.toUtf8Bytes("test strategy data");
  const createStrategyTx = await hermesController.createStrategy(
    1, // poolId
    strategyName,
    strategyDescription,
    strategyData
  );
  await createStrategyTx.wait();
  console.log("✓ Strategy creation functionality verified");

  console.log("\n=== Deployment completed successfully! ===");
  console.log("Note: Users need to claim test tokens before using deposit/withdraw features");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 