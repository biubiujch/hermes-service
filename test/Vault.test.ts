import { expect } from "chai";
import { ethers } from "hardhat";
import { Vault, MockToken } from "../typechain-types";

describe("Vault", function () {
  let vault: Vault;
  let mockToken: MockToken;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeCollector: any;

  beforeEach(async function () {
    [owner, user1, user2, feeCollector] = await ethers.getSigners();

    // 部署MockToken
    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await MockTokenFactory.deploy("Test USDT", "tUSDT", 6, owner.address);

    // 部署Vault
    const VaultFactory = await ethers.getContractFactory("Vault");
    vault = await VaultFactory.deploy(owner.address, feeCollector.address);

    // 设置MockToken为支持的代币
    await vault.setTokenSupported(await mockToken.getAddress(), true);

    // 给用户铸造一些代币
    await mockToken.mint(user1.address, ethers.parseUnits("10000", 6));
    await mockToken.mint(user2.address, ethers.parseUnits("10000", 6));
  });

  describe("Deployment", function () {
    it("Should set the correct owner and fee collector", async function () {
      expect(await vault.owner()).to.equal(owner.address);
      expect(await vault.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set correct default values", async function () {
      expect(await vault.maxPoolsPerUser()).to.equal(10);
      expect(await vault.minPoolBalance()).to.equal(ethers.parseEther("0.001"));
      expect(await vault.feeRate()).to.equal(5);
    });
  });

  describe("Pool Creation", function () {
    it("Should create a pool with ETH", async function () {
      const initialAmount = ethers.parseEther("1");
      const tx = await vault.connect(user1).createPool(0, { value: initialAmount });
      const receipt = await tx.wait();

      // 检查事件
      const event = receipt?.logs.find(log => 
        vault.interface.parseLog(log as any)?.name === "PoolCreated"
      );
      expect(event).to.not.be.undefined;

      // 检查资金池状态
      const poolId = 1;
      const pool = await vault.getPool(poolId);
      expect(pool.owner).to.equal(user1.address);
      expect(pool.totalBalance).to.equal(initialAmount);
      expect(pool.isActive).to.be.true;
    });

    it("Should create a pool with ERC20 token", async function () {
      const initialAmount = ethers.parseUnits("1000", 6);
      
      // 先授权
      await mockToken.connect(user1).approve(await vault.getAddress(), initialAmount);
      
      const tx = await vault.connect(user1).createPool(initialAmount);
      const receipt = await tx.wait();

      // 检查事件
      const event = receipt?.logs.find(log => 
        vault.interface.parseLog(log as any)?.name === "PoolCreated"
      );
      expect(event).to.not.be.undefined;

      // 检查资金池状态
      const poolId = 1;
      const pool = await vault.getPool(poolId);
      expect(pool.owner).to.equal(user1.address);
      expect(pool.totalBalance).to.equal(initialAmount);
      expect(pool.isActive).to.be.true;
    });

    it("Should not create pool with zero amount", async function () {
      await expect(
        vault.connect(user1).createPool(0)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should respect max pools per user limit", async function () {
      const initialAmount = ethers.parseEther("0.1");
      
      // 创建最大数量的资金池
      for (let i = 0; i < 10; i++) {
        await vault.connect(user1).createPool(0, { value: initialAmount });
      }

      // 尝试创建第11个资金池应该失败
      await expect(
        vault.connect(user1).createPool(0, { value: initialAmount })
      ).to.be.revertedWithCustomError(vault, "MaxPoolsReached");
    });
  });

  describe("Pool Deletion", function () {
    let poolId: number;

    beforeEach(async function () {
      // 创建一个资金池
      const initialAmount = ethers.parseEther("1");
      const tx = await vault.connect(user1).createPool(0, { value: initialAmount });
      const receipt = await tx.wait();
      const event = vault.interface.parseLog(receipt!.logs[0] as any);
      poolId = Number(event?.args[0]);
    });

    it("Should delete pool and return funds", async function () {
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      const tx = await vault.connect(user1).deletePool(poolId);
      await tx.wait();

      const finalBalance = await ethers.provider.getBalance(user1.address);
      expect(finalBalance).to.be.gt(initialBalance);

      // 检查资金池状态
      const pool = await vault.getPool(poolId);
      expect(pool.isActive).to.be.false;
    });

    it("Should not allow non-owner to delete pool", async function () {
      await expect(
        vault.connect(user2).deletePool(poolId)
      ).to.be.revertedWithCustomError(vault, "PoolNotOwned");
    });

    it("Should not allow deleting non-existent pool", async function () {
      await expect(
        vault.connect(user1).deletePool(999)
      ).to.be.revertedWithCustomError(vault, "PoolNotFound");
    });

    it("Should not allow deleting already deleted pool", async function () {
      await vault.connect(user1).deletePool(poolId);
      
      await expect(
        vault.connect(user1).deletePool(poolId)
      ).to.be.revertedWithCustomError(vault, "PoolNotActive");
    });
  });

  describe("Pool Merging", function () {
    let pool1Id: number;
    let pool2Id: number;

    beforeEach(async function () {
      // 创建两个资金池
      const amount1 = ethers.parseEther("1");
      const amount2 = ethers.parseEther("2");
      
      await vault.connect(user1).createPool(0, { value: amount1 });
      await vault.connect(user1).createPool(0, { value: amount2 });
      
      pool1Id = 1;
      pool2Id = 2;
    });

    it("Should merge pools correctly", async function () {
      const pool1Before = await vault.getPool(pool1Id);
      const pool2Before = await vault.getPool(pool2Id);
      
      await vault.connect(user1).mergePools(pool1Id, pool2Id);
      
      const pool1After = await vault.getPool(pool1Id);
      const pool2After = await vault.getPool(pool2Id);
      
      // 目标资金池应该包含两个资金池的总和
      expect(pool1After.totalBalance).to.equal(pool1Before.totalBalance + pool2Before.totalBalance);
      
      // 源资金池应该被标记为非活跃
      expect(pool2After.isActive).to.be.false;
    });

    it("Should not allow merging pools from different users", async function () {
      // 为用户2创建一个资金池
      await vault.connect(user2).createPool(0, { value: ethers.parseEther("1") });
      const user2PoolId = 3;
      
      await expect(
        vault.connect(user1).mergePools(pool1Id, user2PoolId)
      ).to.be.revertedWithCustomError(vault, "PoolNotOwned");
    });

    it("Should not allow merging same pool", async function () {
      await expect(
        vault.connect(user1).mergePools(pool1Id, pool1Id)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });
  });

  describe("Deposits", function () {
    let poolId: number;

    beforeEach(async function () {
      // 创建一个资金池
      await vault.connect(user1).createPool(0, { value: ethers.parseEther("1") });
      poolId = 1;
    });

    it("Should deposit ETH correctly", async function () {
      const depositAmount = ethers.parseEther("0.5");
      const poolBefore = await vault.getPool(poolId);
      
      await vault.connect(user1).deposit(poolId, ethers.ZeroAddress, 0, { value: depositAmount });
      
      const poolAfter = await vault.getPool(poolId);
      expect(poolAfter.totalBalance).to.equal(poolBefore.totalBalance + depositAmount);
    });

    it("Should deposit ERC20 token correctly", async function () {
      const depositAmount = ethers.parseUnits("500", 6);
      
      // 授权
      await mockToken.connect(user1).approve(await vault.getAddress(), depositAmount);
      
      const poolBefore = await vault.getPool(poolId);
      await vault.connect(user1).deposit(poolId, await mockToken.getAddress(), depositAmount);
      
      const poolAfter = await vault.getPool(poolId);
      expect(poolAfter.totalBalance).to.equal(poolBefore.totalBalance + depositAmount);
    });

    it("Should not allow non-owner to deposit", async function () {
      const depositAmount = ethers.parseEther("0.5");
      
      await expect(
        vault.connect(user2).deposit(poolId, ethers.ZeroAddress, 0, { value: depositAmount })
      ).to.be.revertedWithCustomError(vault, "PoolNotOwned");
    });

    it("Should not allow depositing unsupported token", async function () {
      const depositAmount = ethers.parseUnits("500", 6);
      
      await expect(
        vault.connect(user1).deposit(poolId, user2.address, depositAmount)
      ).to.be.revertedWithCustomError(vault, "InvalidToken");
    });
  });

  describe("Withdrawals", function () {
    let poolId: number;

    beforeEach(async function () {
      // 创建一个资金池
      await vault.connect(user1).createPool(0, { value: ethers.parseEther("1") });
      poolId = 1;
    });

    it("Should withdraw ETH correctly with fee", async function () {
      const withdrawAmount = ethers.parseEther("0.5");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      const feeCollectorBalance = await ethers.provider.getBalance(feeCollector.address);
      
      await vault.connect(user1).withdraw(poolId, ethers.ZeroAddress, withdrawAmount);
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const finalFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address);
      
      // 用户应该收到扣除手续费后的金额
      const fee = (withdrawAmount * 5n) / 10000n; // 0.05% fee
      const expectedReceived = withdrawAmount - fee;
      expect(finalBalance).to.be.gt(initialBalance + expectedReceived - ethers.parseEther("0.01")); // 考虑gas费用
      
      // 手续费收集者应该收到手续费
      expect(finalFeeCollectorBalance).to.equal(feeCollectorBalance + fee);
    });

    it("Should not allow withdrawing more than balance", async function () {
      const withdrawAmount = ethers.parseEther("2"); // 超过资金池余额
      
      await expect(
        vault.connect(user1).withdraw(poolId, ethers.ZeroAddress, withdrawAmount)
      ).to.be.revertedWithCustomError(vault, "InvalidAmount");
    });

    it("Should not allow non-owner to withdraw", async function () {
      const withdrawAmount = ethers.parseEther("0.1");
      
      await expect(
        vault.connect(user2).withdraw(poolId, ethers.ZeroAddress, withdrawAmount)
      ).to.be.revertedWithCustomError(vault, "PoolNotOwned");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set max pools per user", async function () {
      await vault.setMaxPoolsPerUser(5);
      expect(await vault.maxPoolsPerUser()).to.equal(5);
    });

    it("Should allow owner to set min pool balance", async function () {
      const newMin = ethers.parseEther("0.01");
      await vault.setMinPoolBalance(newMin);
      expect(await vault.minPoolBalance()).to.equal(newMin);
    });

    it("Should allow owner to set fee rate", async function () {
      await vault.setFeeRate(10); // 0.1%
      expect(await vault.feeRate()).to.equal(10);
    });

    it("Should allow owner to set fee collector", async function () {
      await vault.setFeeCollector(user2.address);
      expect(await vault.feeCollector()).to.equal(user2.address);
    });

    it("Should allow owner to set token support", async function () {
      await vault.setTokenSupported(user1.address, true);
      expect(await vault.supportedTokens(user1.address)).to.be.true;
      
      await vault.setTokenSupported(user1.address, false);
      expect(await vault.supportedTokens(user1.address)).to.be.false;
    });

    it("Should not allow non-owner to call admin functions", async function () {
      await expect(
        vault.connect(user1).setMaxPoolsPerUser(5)
      ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // 为用户1创建多个资金池
      await vault.connect(user1).createPool(0, { value: ethers.parseEther("1") });
      await vault.connect(user1).createPool(0, { value: ethers.parseEther("1") });
      
      // 为用户2创建一个资金池
      await vault.connect(user2).createPool(0, { value: ethers.parseEther("1") });
    });

    it("Should return correct user pools", async function () {
      const user1Pools = await vault.getUserPools(user1.address);
      expect(user1Pools.length).to.equal(2);
      expect(user1Pools[0]).to.equal(1);
      expect(user1Pools[1]).to.equal(2);
      
      const user2Pools = await vault.getUserPools(user2.address);
      expect(user2Pools.length).to.equal(1);
      expect(user2Pools[0]).to.equal(3);
    });

    it("Should return correct pool count", async function () {
      expect(await vault.getUserPoolCount(user1.address)).to.equal(2);
      expect(await vault.getUserPoolCount(user2.address)).to.equal(1);
    });

    it("Should return correct pool details", async function () {
      const pool = await vault.getPool(1);
      expect(pool.owner).to.equal(user1.address);
      expect(pool.totalBalance).to.equal(ethers.parseEther("1"));
      expect(pool.isActive).to.be.true;
    });
  });
}); 