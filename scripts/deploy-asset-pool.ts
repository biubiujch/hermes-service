import { ethers } from "hardhat";
import { AssetPool } from "../typechain-types";
import { writeFileSync } from "fs";
import { join } from "path";

interface DeploymentInfo {
  contractName: string;
  contractAddress: string;
  deployer: string;
  feeCollector: string;
  network: string;
  deploymentTime: string;
  constructorArgs: any[];
}

async function main() {
  console.log("🚀 开始部署 AssetPool 合约...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("📋 部署账户:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("❌ 部署账户余额不足，请确保有足够的ETH支付gas费用");
  }

  // 设置手续费收集地址（这里使用部署者地址作为示例）
  const feeCollector = deployer.address;
  console.log("💸 手续费收集地址:", feeCollector);

  // 部署 AssetPool 合约
  console.log("\n📦 正在部署 AssetPool 合约...");
  const AssetPool = await ethers.getContractFactory("AssetPool");
  const assetPool = await AssetPool.deploy(feeCollector);
  
  console.log("⏳ 等待合约部署确认...");
  await assetPool.waitForDeployment();

  const assetPoolAddress = await assetPool.getAddress();
  console.log("✅ AssetPool 合约已部署到:", assetPoolAddress);

  // 验证合约部署
  console.log("\n🔍 === 合约验证 ===");
  console.log("手续费收集地址:", await assetPool.feeCollector());
  console.log("最小存款金额:", ethers.formatEther(await assetPool.minDepositAmount()), "ETH");
  console.log("最大资金池规模:", ethers.formatEther(await assetPool.maxPoolSize()), "ETH");
  console.log("手续费率:", await assetPool.FEE_RATE(), "basis points (0.5%)");
  
  // 检查ETH是否支持
  const ethSupported = await assetPool.isTokenSupported(ethers.ZeroAddress);
  console.log("ETH支持状态:", ethSupported ? "✅ 支持" : "❌ 不支持");

  // 获取网络信息
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;

  console.log("\n🎉 === 部署完成 ===");
  console.log("合约地址:", assetPoolAddress);
  console.log("部署者:", deployer.address);
  console.log("手续费收集者:", feeCollector);
  console.log("网络:", networkName);

  // 保存部署信息
  const deploymentInfo: DeploymentInfo = {
    contractName: "AssetPool",
    contractAddress: assetPoolAddress,
    deployer: deployer.address,
    feeCollector: feeCollector,
    network: networkName,
    deploymentTime: new Date().toISOString(),
    constructorArgs: [feeCollector],
  };

  // 保存到文件
  const deploymentPath = join(__dirname, "..", "deployments", `${networkName}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📄 部署信息已保存到:", deploymentPath);
  console.log("\n部署信息:", JSON.stringify(deploymentInfo, null, 2));

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  }); 