import { ethers } from "hardhat";
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log("🚀 Starting contract deployment...");

  const [deployer, feeCollector] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  console.log("💰 Fee collector:", feeCollector.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // 1. 部署测试代币
  console.log("\n📦 Deploying MockToken...");
  const MockToken = await ethers.getContractFactory("MockToken");
  const mockToken = await MockToken.deploy("Test USDT", "tUSDT", 6, deployer.address);
  await mockToken.waitForDeployment();
  const mockTokenAddress = await mockToken.getAddress();
  console.log("✅ MockToken deployed to:", mockTokenAddress);

  // 2. 部署资金池合约
  console.log("\n🏦 Deploying Vault...");
  const Vault = await ethers.getContractFactory("Vault");
  const vault = await Vault.deploy(deployer.address, feeCollector.address);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ Vault deployed to:", vaultAddress);

  // 3. 配置资金池合约
  console.log("\n⚙️ Configuring Vault...");
  await vault.setTokenSupported(mockTokenAddress, true);
  console.log("✅ MockToken added as supported token");

  // 4. 给部署者铸造一些测试代币
  console.log("\n🪙 Minting test tokens...");
  await mockToken.mint(deployer.address, ethers.parseUnits("1000000", 6)); // 1M USDT
  console.log("✅ Minted 1,000,000 tUSDT to deployer");

  // 5. 保存部署信息到文件
  const deploymentInfo = {
    network: "localhost",
    deployer: deployer.address,
    feeCollector: feeCollector.address,
    contracts: {
      mockToken: mockTokenAddress,
      vault: vaultAddress
    },
    timestamp: new Date().toISOString()
  };

  const deploymentPath = path.join(__dirname, '../deployments/localhost.json');
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));

  // 6. 输出部署信息
  console.log("\n🎉 Deployment completed successfully!");
  console.log("=".repeat(50));
  console.log("📋 Contract Addresses:");
  console.log("MockToken:", mockTokenAddress);
  console.log("Vault:", vaultAddress);
  console.log("Fee Collector:", feeCollector.address);
  console.log("=".repeat(50));
  console.log("🔧 Next steps:");
  console.log("1. Contract addresses saved to: deployments/localhost.json");
  console.log("2. Update your .env file with:");
  console.log(`   MOCK_TOKEN_ADDRESS=${mockTokenAddress}`);
  console.log(`   VAULT_ADDRESS=${vaultAddress}`);
  console.log(`   FEE_COLLECTOR_ADDRESS=${feeCollector.address}`);
  console.log("3. Run tests: pnpm run contract:test");
  console.log("4. Start API server: pnpm run dev");
  
  // 7. 生成.env更新命令
  console.log("\n💡 Quick .env update commands:");
  console.log(`sed -i '' 's/MOCK_TOKEN_ADDRESS=.*/MOCK_TOKEN_ADDRESS=${mockTokenAddress}/' .env`);
  console.log(`sed -i '' 's/VAULT_ADDRESS=.*/VAULT_ADDRESS=${vaultAddress}/' .env`);
  console.log(`sed -i '' 's/FEE_COLLECTOR_ADDRESS=.*/FEE_COLLECTOR_ADDRESS=${feeCollector.address}/' .env`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 