import { expect } from "chai";
import { ethers } from "hardhat";
import { HermesController, MockUSDT } from "../typechain-types";

describe("Pool Freeze Functionality", function () {
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

  describe("Pool Freeze Management", function () {
    it("Should freeze pool successfully", async function () {
      // 创建资金池
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      
      // 冻结资金池
      await expect(hermesController.connect(owner).freezePool(1, "Test freeze"))
        .to.emit(hermesController, "PoolFrozen");
      
      // 检查资金池是否被冻结
      const isFrozen = await hermesController.isPoolFrozen(1);
      expect(isFrozen).to.be.true;
      
      // 获取冻结信息
      const [frozen, frozenAt] = await hermesController.getPoolFreezeInfo(1);
      expect(frozen).to.be.true;
      expect(frozenAt).to.be.gt(0);
    });

    it("Should unfreeze pool successfully", async function () {
      // 创建资金池并冻结
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      await hermesController.connect(owner).freezePool(1, "Test freeze");
      
      // 解冻资金池
      await expect(hermesController.connect(owner).unfreezePool(1))
        .to.emit(hermesController, "PoolUnfrozen");
      
      // 检查资金池是否已解冻
      const isFrozen = await hermesController.isPoolFrozen(1);
      expect(isFrozen).to.be.false;
    });

    it("Should prevent deposit to frozen pool", async function () {
      // 创建资金池并存款
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);
      await hermesController.connect(user1).depositToPool(1, depositAmount);
      
      // 冻结资金池
      await hermesController.connect(owner).freezePool(1, "Test freeze");
      
      // 尝试再次存款应该失败
      const newDepositAmount = ethers.parseUnits("500", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), newDepositAmount);
      
      await expect(hermesController.connect(user1).depositToPool(1, newDepositAmount))
        .to.be.revertedWith("Pool is frozen");
    });

    it("Should prevent strategy execution on frozen pool", async function () {
      // 创建资金池和策略
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      await hermesController.connect(user1).createStrategy(
        1,
        "Test Strategy",
        "A test strategy",
        ethers.toUtf8Bytes("test data")
      );
      
      // 冻结资金池
      await hermesController.connect(owner).freezePool(1, "Test freeze");
      
      // 尝试执行策略应该失败
      await expect(hermesController.connect(user1).executeStrategy(1))
        .to.be.revertedWith("Pool is frozen, cannot execute strategy");
    });

    it("Should allow withdrawal from frozen pool", async function () {
      // 创建资金池并存款
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      const depositAmount = ethers.parseUnits("1000", 6);
      await mockUSDT.connect(user1).approve(await hermesController.getAddress(), depositAmount);
      await hermesController.connect(user1).depositToPool(1, depositAmount);
      
      // 冻结资金池
      await hermesController.connect(owner).freezePool(1, "Test freeze");
      
      // 提款应该仍然可以成功
      const withdrawAmount = ethers.parseUnits("500", 6);
      await expect(hermesController.connect(user1).withdrawFromPool(1, withdrawAmount))
        .to.emit(hermesController, "PoolWithdrawn");
    });

    it("Should prevent non-admin from freezing pool", async function () {
      // 创建资金池
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      
      // 非管理员尝试冻结应该失败
      await expect(hermesController.connect(user1).freezePool(1, "Test freeze"))
        .to.be.revertedWithCustomError(hermesController, "AccessControlUnauthorizedAccount");
    });

    it("Should prevent freezing non-existent pool", async function () {
      await expect(hermesController.connect(owner).freezePool(999, "Test freeze"))
        .to.be.revertedWith("Pool is not active");
    });

    it("Should prevent double freezing", async function () {
      // 创建资金池并冻结
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      await hermesController.connect(owner).freezePool(1, "Test freeze");
      
      // 再次冻结应该失败
      await expect(hermesController.connect(owner).freezePool(1, "Test freeze again"))
        .to.be.revertedWith("Pool is already frozen");
    });

    it("Should prevent unfreezing non-frozen pool", async function () {
      // 创建资金池
      await hermesController.connect(user1).createPool("Test Pool", "A test pool");
      
      // 解冻未冻结的池应该失败
      await expect(hermesController.connect(owner).unfreezePool(1))
        .to.be.revertedWith("Pool is not frozen");
    });
  });
}); 