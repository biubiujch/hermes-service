import { ethers } from "hardhat";
import { MockERC20 } from "../typechain-types";
import { writeFileSync } from "fs";
import { join } from "path";

interface TokenDeploymentInfo {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  deployer: string;
  network: string;
  deploymentTime: string;
}

async function main() {
  console.log("🚀 开始部署测试代币...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("📋 部署账户:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 账户余额:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    throw new Error("❌ 部署账户余额不足，请确保有足够的ETH支付gas费用");
  }

  // 获取网络信息
  const network = await ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;

  // 测试代币配置
  const testTokens = [
    {
      name: "Mock USDT",
      symbol: "USDT",
      decimals: 6
    },
    {
      name: "Mock USDC", 
      symbol: "USDC",
      decimals: 6
    },
    {
      name: "Mock DAI",
      symbol: "DAI", 
      decimals: 18
    },
    {
      name: "Mock WETH",
      symbol: "WETH",
      decimals: 18
    }
  ];

  const deployedTokens: TokenDeploymentInfo[] = [];

  for (const tokenConfig of testTokens) {
    console.log(`\n📦 正在部署 ${tokenConfig.name} (${tokenConfig.symbol})...`);
    
    // 部署MockERC20合约
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy(tokenConfig.name, tokenConfig.symbol);
    
    console.log("⏳ 等待合约部署确认...");
    await token.waitForDeployment();

    const tokenAddress = await token.getAddress();
    console.log(`✅ ${tokenConfig.symbol} 已部署到:`, tokenAddress);

    // 验证合约
    const name = await token.name();
    const symbol = await token.symbol();
    const decimals = await token.decimals();
    
    console.log(`🔍 合约验证:`);
    console.log(`  名称: ${name}`);
    console.log(`  符号: ${symbol}`);
    console.log(`  小数位: ${decimals}`);

    // 给部署者铸造一些代币用于测试
    const mintAmount = ethers.parseUnits("1000000", decimals); // 100万代币
    await token.mint(deployer.address, mintAmount);
    console.log(`💰 已铸造 ${ethers.formatUnits(mintAmount, decimals)} ${symbol} 到部署者账户`);

    deployedTokens.push({
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      address: tokenAddress,
      decimals: decimals,
      deployer: deployer.address,
      network: networkName,
      deploymentTime: new Date().toISOString()
    });
  }

  console.log("\n🎉 === 所有测试代币部署完成 ===");
  console.log("部署的代币:");
  deployedTokens.forEach(token => {
    console.log(`  ${token.symbol}: ${token.address}`);
  });

  // 保存部署信息
  const deploymentInfo = {
    network: networkName,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    tokens: deployedTokens
  };

  // 保存到文件
  const deploymentPath = join(__dirname, "..", "deployments", `test-tokens-${networkName}.json`);
  writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📄 部署信息已保存到:", deploymentPath);

  // 生成环境变量配置示例
  console.log("\n📝 环境变量配置示例:");
  deployedTokens.forEach(token => {
    console.log(`${token.symbol.toUpperCase()}_ADDRESS=${token.address}`);
  });

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ 部署失败:", error);
    process.exit(1);
  }); 