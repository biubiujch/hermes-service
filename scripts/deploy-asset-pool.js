const { ethers } = require("hardhat");

async function main() {
  console.log("开始部署 AssetPool 合约...");

  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  console.log("部署账户:", deployer.address);
  console.log("账户余额:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

  // 设置手续费收集地址（这里使用部署者地址作为示例）
  const feeCollector = deployer.address;

  // 部署 AssetPool 合约
  const AssetPool = await ethers.getContractFactory("AssetPool");
  const assetPool = await AssetPool.deploy(feeCollector);
  await assetPool.waitForDeployment();

  const assetPoolAddress = await assetPool.getAddress();
  console.log("AssetPool 合约已部署到:", assetPoolAddress);

  // 验证合约部署
  console.log("\n=== 合约验证 ===");
  console.log("手续费收集地址:", await assetPool.feeCollector());
  console.log("最小存款金额:", ethers.formatEther(await assetPool.minDepositAmount()), "ETH");
  console.log("最大资金池规模:", ethers.formatEther(await assetPool.maxPoolSize()), "ETH");
  console.log("手续费率:", await assetPool.FEE_RATE(), "basis points (0.5%)");
  
  // 检查ETH是否支持
  const ethSupported = await assetPool.isTokenSupported(ethers.ZeroAddress);
  console.log("ETH支持状态:", ethSupported);

  console.log("\n=== 部署完成 ===");
  console.log("合约地址:", assetPoolAddress);
  console.log("部署者:", deployer.address);
  console.log("手续费收集者:", feeCollector);

  // 保存部署信息
  const deploymentInfo = {
    contractName: "AssetPool",
    contractAddress: assetPoolAddress,
    deployer: deployer.address,
    feeCollector: feeCollector,
    network: (await ethers.provider.getNetwork()).name,
    deploymentTime: new Date().toISOString()
  };

  console.log("\n部署信息:", JSON.stringify(deploymentInfo, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  }); 