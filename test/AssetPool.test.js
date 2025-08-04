const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AssetPool", function () {
  let assetPool;
  let owner;
  let user1;
  let user2;
  let strategy1;
  let feeCollector;
  let mockToken;

  const MIN_DEPOSIT = ethers.parseEther("0.01");
  const MAX_POOL_SIZE = ethers.parseEther("1000");
  const FEE_RATE = 50; // 0.5%

  beforeEach(async function () {
    [owner, user1, user2, strategy1, feeCollector] = await ethers.getSigners();

    // 部署 AssetPool 合约
    const AssetPool = await ethers.getContractFactory("AssetPool");
    assetPool = await AssetPool.deploy(feeCollector.address);
    await assetPool.waitForDeployment();

    // 部署模拟ERC20代币
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock Token", "MTK");
    await mockToken.waitForDeployment();

    // 添加支持的代币
    await assetPool.addSupportedToken(await mockToken.getAddress());
  });

  describe("部署", function () {
    it("应该正确设置初始参数", async function () {
      expect(await assetPool.feeCollector()).to.equal(feeCollector.address);
      expect(await assetPool.minDepositAmount()).to.equal(MIN_DEPOSIT);
      expect(await assetPool.maxPoolSize()).to.equal(MAX_POOL_SIZE);
      expect(await assetPool.FEE_RATE()).to.equal(FEE_RATE);
      expect(await assetPool.isTokenSupported(ethers.ZeroAddress)).to.be.true; // ETH
    });
  });

  describe("存款功能", function () {
    it("应该允许用户存入ETH", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await expect(assetPool.connect(user1).deposit(ethers.ZeroAddress, depositAmount, { value: depositAmount }))
        .to.emit(assetPool, "Deposit");

      expect(await assetPool.getUserBalance(user1.address, ethers.ZeroAddress)).to.equal(depositAmount);
      expect(await assetPool.getPoolBalance(ethers.ZeroAddress)).to.equal(depositAmount);
    });

    it("应该允许用户存入ERC20代币", async function () {
      const depositAmount = ethers.parseEther("100");
      
      // 给用户铸造代币
      await mockToken.mint(user1.address, depositAmount);
      await mockToken.connect(user1).approve(await assetPool.getAddress(), depositAmount);

      await expect(assetPool.connect(user1).deposit(await mockToken.getAddress(), depositAmount))
        .to.emit(assetPool, "Deposit");

      expect(await assetPool.getUserBalance(user1.address, await mockToken.getAddress())).to.equal(depositAmount);
      expect(await assetPool.getPoolBalance(await mockToken.getAddress())).to.equal(depositAmount);
    });

    it("应该拒绝低于最小存款金额的存款", async function () {
      const smallAmount = ethers.parseEther("0.005");
      
      await expect(
        assetPool.connect(user1).deposit(ethers.ZeroAddress, smallAmount, { value: smallAmount })
      ).to.be.revertedWith("AssetPool: Amount below minimum");
    });

    it("应该拒绝不支持的代币存款", async function () {
      const unsupportedToken = await ethers.getContractFactory("MockERC20");
      const token = await unsupportedToken.deploy("Unsupported", "UNS");
      await token.waitForDeployment();

      await expect(
        assetPool.connect(user1).deposit(await token.getAddress(), ethers.parseEther("1"))
      ).to.be.revertedWith("AssetPool: Token not supported");
    });
  });

  describe("提款功能", function () {
    beforeEach(async function () {
      // 用户1存入一些ETH
      const depositAmount = ethers.parseEther("10");
      await assetPool.connect(user1).deposit(ethers.ZeroAddress, depositAmount, { value: depositAmount });
    });

    it("应该允许用户提取ETH并收取手续费", async function () {
      const withdrawAmount = ethers.parseEther("5");
      const fee = (withdrawAmount * BigInt(FEE_RATE)) / BigInt(10000);
      const actualWithdrawAmount = withdrawAmount - fee;

      const initialBalance = await ethers.provider.getBalance(user1.address);
      const initialFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address);

      await expect(assetPool.connect(user1).withdraw(ethers.ZeroAddress, withdrawAmount))
        .to.emit(assetPool, "Withdraw");

      expect(await assetPool.getUserBalance(user1.address, ethers.ZeroAddress)).to.equal(ethers.parseEther("5"));
      expect(await assetPool.getPoolBalance(ethers.ZeroAddress)).to.equal(ethers.parseEther("5"));
    });

    it("应该拒绝提取超过余额的金额", async function () {
      const tooMuch = ethers.parseEther("20");
      
      await expect(
        assetPool.connect(user1).withdraw(ethers.ZeroAddress, tooMuch)
      ).to.be.revertedWith("AssetPool: Insufficient balance");
    });
  });

  describe("策略执行功能", function () {
    beforeEach(async function () {
      // 用户1存入ETH
      const depositAmount = ethers.parseEther("10");
      await assetPool.connect(user1).deposit(ethers.ZeroAddress, depositAmount, { value: depositAmount });
      
      // 授权策略
      await assetPool.addAuthorizedStrategy(strategy1.address);
    });

    it("应该允许授权策略转移用户资金", async function () {
      const transferAmount = ethers.parseEther("5");
      
      await expect(assetPool.connect(strategy1).transferToStrategy(user1.address, ethers.ZeroAddress, transferAmount))
        .to.emit(assetPool, "StrategyExecution");

      expect(await assetPool.getUserBalance(user1.address, ethers.ZeroAddress)).to.equal(ethers.parseEther("5"));
      expect(await assetPool.getPoolBalance(ethers.ZeroAddress)).to.equal(ethers.parseEther("5"));
    });

    it("应该允许策略返回资金给用户", async function () {
      const returnAmount = ethers.parseEther("3");
      
      await expect(assetPool.connect(strategy1).returnFromStrategy(user1.address, ethers.ZeroAddress, returnAmount, { value: returnAmount }))
        .to.emit(assetPool, "StrategyReturn");

      expect(await assetPool.getUserBalance(user1.address, ethers.ZeroAddress)).to.equal(ethers.parseEther("13"));
      expect(await assetPool.getPoolBalance(ethers.ZeroAddress)).to.equal(ethers.parseEther("13"));
    });

    it("应该拒绝未授权策略调用", async function () {
      const unauthorizedStrategy = user2;
      
      await expect(
        assetPool.connect(unauthorizedStrategy).transferToStrategy(user1.address, ethers.ZeroAddress, ethers.parseEther("1"))
      ).to.be.revertedWith("AssetPool: Only authorized strategies can call this function");
    });
  });

  describe("管理员功能", function () {
    it("应该允许所有者添加授权策略", async function () {
      await assetPool.addAuthorizedStrategy(strategy1.address);
      expect(await assetPool.isStrategyAuthorized(strategy1.address)).to.be.true;
    });

    it("应该允许所有者移除授权策略", async function () {
      await assetPool.addAuthorizedStrategy(strategy1.address);
      await assetPool.removeAuthorizedStrategy(strategy1.address);
      expect(await assetPool.isStrategyAuthorized(strategy1.address)).to.be.false;
    });

    it("应该允许所有者添加支持的代币", async function () {
      const newToken = await ethers.getContractFactory("MockERC20");
      const token = await newToken.deploy("New Token", "NTK");
      await token.waitForDeployment();

      await assetPool.addSupportedToken(await token.getAddress());
      expect(await assetPool.isTokenSupported(await token.getAddress())).to.be.true;
    });

    it("应该拒绝非所有者调用管理员功能", async function () {
      await expect(
        assetPool.connect(user1).addAuthorizedStrategy(strategy1.address)
      ).to.be.revertedWithCustomError(assetPool, "OwnableUnauthorizedAccount");
    });
  });

  describe("紧急功能", function () {
    beforeEach(async function () {
      // 用户1存入ETH
      const depositAmount = ethers.parseEther("10");
      await assetPool.connect(user1).deposit(ethers.ZeroAddress, depositAmount, { value: depositAmount });
    });

    it("应该允许暂停合约", async function () {
      await assetPool.pause();
      expect(await assetPool.paused()).to.be.true;
    });

    it("暂停后应该拒绝正常操作", async function () {
      await assetPool.pause();
      
      await expect(
        assetPool.connect(user1).deposit(ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(assetPool, "EnforcedPause");
    });

    it("暂停后应该允许紧急提取", async function () {
      await assetPool.pause();
      
      await expect(assetPool.connect(user1).emergencyWithdraw(ethers.ZeroAddress))
        .to.emit(assetPool, "EmergencyWithdraw");

      expect(await assetPool.getUserBalance(user1.address, ethers.ZeroAddress)).to.equal(0);
    });
  });

  // 辅助函数
  async function time() {
    return (await ethers.provider.getBlock("latest")).timestamp;
  }

  // 辅助函数：检查时间戳是否在合理范围内
  async function checkTimestamp(timestamp) {
    const currentTime = await time();
    return Math.abs(currentTime - timestamp) <= 2; // 允许2秒的误差
  }
});

// 模拟ERC20代币合约
const MockERC20 = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockERC20 is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
`; 