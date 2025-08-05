import { expect } from "chai";
import { ethers } from "hardhat";
import { HermesController, MockUSDT } from "../typechain-types";

describe("HermesController", function () {
  let hermesController: HermesController;
  let mockUSDT: MockUSDT;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeCollector: any;

  beforeEach(async function () {
    [owner, user1, user2, feeCollector] = await ethers.getSigners();

    // 部署 MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy(owner.address);

    // 部署 HermesController
    const HermesController = await ethers.getContractFactory("HermesController");
    hermesController = await HermesController.deploy(
      await mockUSDT.getAddress(),
      feeCollector.address,
      owner.address
    );

    // 为测试用户铸造 USDT
    const amount = ethers.parseUnits("10000", 6);
    await mockUSDT.mint(user1.address, amount);
    await mockUSDT.mint(user2.address, amount);
    await mockUSDT.mint(owner.address, amount);
  });

  describe("Deployment", function () {
    it("Should deploy all contracts correctly", async function () {
      const moduleAddresses = await hermesController.getModuleAddresses();
      
      expect(moduleAddresses[0]).to.not.equal(ethers.ZeroAddress); // PoolManager
      expect(moduleAddresses[1]).to.not.equal(ethers.ZeroAddress); // MembershipManager
      expect(moduleAddresses[2]).to.not.equal(ethers.ZeroAddress); // StrategyManager
      expect(moduleAddresses[3]).to.not.equal(ethers.ZeroAddress); // MockGMX
    });

    it("Should set correct fee collector", async function () {
      expect(await hermesController.feeCollector()).to.equal(feeCollector.address);
    });
  });

  describe("Pool Management", function () {
    it("Should create pool successfully", async function () {
      const poolName = "Test Pool";
      const poolDescription = "A test pool";

      await expect(hermesController.connect(user1).createPool(poolName, poolDescription))
        .to.emit(hermesController, "PoolCreated");

      const poolInfo = await hermesController.getPoolInfo(1);
      expect(poolInfo.owner).to.equal(user1.address);
      expect(poolInfo.name).to.equal(poolName);
      expect(poolInfo.description).to.equal(poolDescription);
    });

    it("Should deposit to pool successfully", async function () {
      // 创建池
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");

      // 存款
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);

      await expect(hermesController.connect(user1).depositToPool(1, depositAmount))
        .to.emit(hermesController, "PoolDeposited");

      const poolInfo = await hermesController.getPoolInfo(1);
      // 免费用户费用率为5%，所以实际存入的是95%
      const expectedBalance = depositAmount * 95n / 100n;
      expect(poolInfo.totalBalance).to.equal(expectedBalance);
    });

    it("Should withdraw from pool successfully", async function () {
      // 创建池并存款
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);
      await hermesController.connect(user1).depositToPool(1, depositAmount);

      // 提款
      const withdrawAmount = ethers.parseUnits("500", 6);
      await expect(hermesController.connect(user1).withdrawFromPool(1, withdrawAmount))
        .to.emit(hermesController, "PoolWithdrawn");

      const poolInfo = await hermesController.getPoolInfo(1);
      // 免费用户费用率为5%，所以实际存入的是95%，减去提款金额
      const expectedBalance = depositAmount * 95n / 100n - withdrawAmount;
      expect(poolInfo.totalBalance).to.equal(expectedBalance);
    });
  });

  describe("Strategy Management", function () {
    beforeEach(async function () {
      // 创建池
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
    });

    it("Should create strategy successfully", async function () {
      const strategyName = "Test Strategy";
      const strategyDescription = "A test strategy";
      const strategyData = ethers.toUtf8Bytes("test data");

      await expect(hermesController.connect(user1).createStrategy(
        1, // poolId
        strategyName,
        strategyDescription,
        strategyData
      )).to.emit(hermesController, "StrategyCreated");

      const strategyInfo = await hermesController.getStrategyInfo(1);
      expect(strategyInfo.owner).to.equal(user1.address);
      expect(strategyInfo.name).to.equal(strategyName);
      expect(strategyInfo.description).to.equal(strategyDescription);
    });

    it("Should execute strategy successfully", async function () {
      // 创建策略
      await hermesController.connect(user1).createStrategy(
        1,
        "Test Strategy",
        "A test strategy",
        ethers.toUtf8Bytes("test data")
      );

      // 执行策略
      await expect(hermesController.connect(user1).executeStrategy(1))
        .to.emit(hermesController, "StrategyExecuted");
    });
  });

  describe("Membership Management", function () {
    it("Should upgrade membership successfully", async function () {
      const membershipPrice = ethers.parseUnits("50", 6); // MONTHLY membership
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), membershipPrice);

      await expect(hermesController.connect(user1).upgradeMembership(0)) // 0 = MONTH
        .to.emit(hermesController, "MembershipUpgraded");

      const membership = await hermesController.getUserMembership(user1.address);
      expect(membership).to.equal(1); // MEMBER
    });

    it("Should return correct fee rate for different membership types", async function () {
      // 免费用户
      let feeRate = await hermesController.getFeeRate(user1.address);
      expect(feeRate).to.equal(500); // 5%

      // 升级到会员
      const membershipPrice = ethers.parseUnits("50", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), membershipPrice);
      await hermesController.connect(user1).upgradeMembership(0); // 0 = MONTH

      feeRate = await hermesController.getFeeRate(user1.address);
      expect(feeRate).to.equal(100); // 1%
    });
  });

  describe("Fee Management", function () {
    it("Should collect fees correctly", async function () {
      // 创建池并存款（会产生费用）
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);
      await hermesController.connect(user1).depositToPool(1, depositAmount);

      // 检查费用收集
      const [totalFeesCollected, , ] = await hermesController.getSystemInfo();
      expect(totalFeesCollected).to.be.gt(0);
    });

    it("Should allow fee collector to withdraw fees", async function () {
      // 创建池并存款
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);
      await hermesController.connect(user1).depositToPool(1, depositAmount);

      // 提取费用
      await expect(hermesController.connect(feeCollector).withdrawFees())
        .to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should allow admin to pause/unpause", async function () {
      await hermesController.connect(owner).pause();
      expect(await hermesController.paused()).to.be.true;

      await hermesController.connect(owner).unpause();
      expect(await hermesController.paused()).to.be.false;
    });

    it("Should prevent non-admin from pausing", async function () {
      await expect(hermesController.connect(user1).pause())
        .to.be.revertedWithCustomError(hermesController, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Mock GMX", function () {
    it("Should have initialized markets", async function () {
      const moduleAddresses = await hermesController.getModuleAddresses();
      const mockGMX = await ethers.getContractAt("MockGMX", moduleAddresses[3]);

      const markets = await mockGMX.getActiveMarkets();
      expect(markets.length).to.be.gt(0);
      expect(markets).to.include("BTC/USD");
      expect(markets).to.include("ETH/USD");
    });
  });
}); 