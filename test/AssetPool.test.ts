import { expect } from "chai";
import { ethers } from "hardhat";
import { AssetPool } from "../typechain-types";
import { MockERC20 } from "../typechain-types";

describe("AssetPool", function () {
  let assetPool: AssetPool;
  let mockToken: MockERC20;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeCollector: any;

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const MIN_DEPOSIT = ethers.parseEther("0.01");
  const MAX_POOL_SIZE = ethers.parseEther("1000");
  const FEE_RATE = 50; // 0.5%

  beforeEach(async function () {
    // 获取测试账户
    [owner, user1, user2, feeCollector] = await ethers.getSigners();

    // 部署MockERC20代币
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock Token", "MTK");

    // 部署AssetPool合约
    const AssetPool = await ethers.getContractFactory("AssetPool");
    assetPool = await AssetPool.deploy(feeCollector.address);

    // 给用户1和用户2一些ETH用于测试
    await owner.sendTransaction({
      to: user1.address,
      value: ethers.parseEther("10")
    });

    await owner.sendTransaction({
      to: user2.address,
      value: ethers.parseEther("10")
    });

    // 给用户1和用户2一些Mock代币
    await mockToken.mint(user1.address, ethers.parseEther("1000"));
    await mockToken.mint(user2.address, ethers.parseEther("1000"));
  });

  describe("部署", function () {
    it("应该正确设置初始参数", async function () {
      expect(await assetPool.feeCollector()).to.equal(feeCollector.address);
      expect(await assetPool.minDepositAmount()).to.equal(MIN_DEPOSIT);
      expect(await assetPool.maxPoolSize()).to.equal(MAX_POOL_SIZE);
      expect(await assetPool.FEE_RATE()).to.equal(FEE_RATE);
      expect(await assetPool.owner()).to.equal(owner.address);
    });

    it("应该默认支持ETH", async function () {
      expect(await assetPool.isTokenSupported(ZERO_ADDRESS)).to.be.true;
    });
  });

  describe("ETH存款", function () {
    it("应该允许用户存款ETH", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await assetPool.connect(user1).deposit(ZERO_ADDRESS, depositAmount, {
        value: depositAmount
      });

      expect(await assetPool.getUserBalance(user1.address, ZERO_ADDRESS)).to.equal(depositAmount);
      expect(await assetPool.getPoolBalance(ZERO_ADDRESS)).to.equal(depositAmount);
    });

    it("应该拒绝低于最小存款金额的存款", async function () {
      const smallAmount = ethers.parseEther("0.005");
      
      await expect(
        assetPool.connect(user1).deposit(ZERO_ADDRESS, smallAmount, {
          value: smallAmount
        })
      ).to.be.revertedWith("AssetPool: Amount below minimum");
    });

    it("应该拒绝超过最大资金池规模的存款", async function () {
      const largeAmount = ethers.parseEther("1001");
      
      await expect(
        assetPool.connect(user1).deposit(ZERO_ADDRESS, largeAmount, {
          value: largeAmount
        })
      ).to.be.revertedWith("AssetPool: Pool size limit exceeded");
    });

    it("应该拒绝ETH金额不匹配的存款", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await expect(
        assetPool.connect(user1).deposit(ZERO_ADDRESS, depositAmount, {
          value: ethers.parseEther("0.5")
        })
      ).to.be.revertedWith("AssetPool: ETH amount mismatch");
    });
  });

  describe("ERC20代币存款", function () {
    it("应该允许用户存款ERC20代币", async function () {
      const depositAmount = ethers.parseEther("100");
      
      // 先授权
      await mockToken.connect(user1).approve(assetPool.target, depositAmount);
      
      await assetPool.connect(user1).deposit(mockToken.target, depositAmount);

      expect(await assetPool.getUserBalance(user1.address, mockToken.target)).to.equal(depositAmount);
      expect(await assetPool.getPoolBalance(mockToken.target)).to.equal(depositAmount);
    });

    it("应该拒绝未授权的ERC20代币存款", async function () {
      const depositAmount = ethers.parseEther("100");
      
      await expect(
        assetPool.connect(user1).deposit(mockToken.target, depositAmount)
      ).to.be.revertedWith("ERC20: insufficient allowance");
    });
  });

  describe("提款", function () {
    beforeEach(async function () {
      // 用户1先存款一些ETH
      const depositAmount = ethers.parseEther("2");
      await assetPool.connect(user1).deposit(ZERO_ADDRESS, depositAmount, {
        value: depositAmount
      });
    });

    it("应该允许用户提款ETH", async function () {
      const withdrawAmount = ethers.parseEther("1");
      const initialBalance = await ethers.provider.getBalance(user1.address);
      
      await assetPool.connect(user1).withdraw(ZERO_ADDRESS, withdrawAmount);
      
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const fee = (withdrawAmount * BigInt(FEE_RATE)) / BigInt(10000);
      const expectedBalance = initialBalance + withdrawAmount - fee;
      
      expect(finalBalance).to.be.closeTo(expectedBalance, ethers.parseEther("0.01"));
    });

    it("应该拒绝超过余额的提款", async function () {
      const largeAmount = ethers.parseEther("3");
      
      await expect(
        assetPool.connect(user1).withdraw(ZERO_ADDRESS, largeAmount)
      ).to.be.revertedWith("AssetPool: Insufficient balance");
    });

    it("应该正确计算和转移手续费", async function () {
      const withdrawAmount = ethers.parseEther("1");
      const fee = (withdrawAmount * BigInt(FEE_RATE)) / BigInt(10000);
      
      await assetPool.connect(user1).withdraw(ZERO_ADDRESS, withdrawAmount);
      
      expect(await ethers.provider.getBalance(feeCollector.address)).to.equal(fee);
    });
  });

  describe("策略交互", function () {
    let strategyContract: any;

    beforeEach(async function () {
      // 创建一个模拟的策略合约
      const MockStrategy = await ethers.getContractFactory("MockERC20"); // 临时使用MockERC20作为策略合约
      strategyContract = await MockStrategy.deploy("Strategy", "STRAT");
      
      // 授权策略合约
      await assetPool.addAuthorizedStrategy(strategyContract.target);
      
      // 用户1存款
      const depositAmount = ethers.parseEther("1");
      await assetPool.connect(user1).deposit(ZERO_ADDRESS, depositAmount, {
        value: depositAmount
      });
    });

    it("应该允许授权策略转移资金", async function () {
      const transferAmount = ethers.parseEther("0.5");
      
      await assetPool.connect(strategyContract).transferToStrategy(
        user1.address,
        ZERO_ADDRESS,
        transferAmount
      );

      expect(await assetPool.getUserBalance(user1.address, ZERO_ADDRESS)).to.equal(ethers.parseEther("0.5"));
      expect(await assetPool.getPoolBalance(ZERO_ADDRESS)).to.equal(ethers.parseEther("0.5"));
    });

    it("应该拒绝未授权策略转移资金", async function () {
      const MockUnauthorizedStrategy = await ethers.getContractFactory("MockERC20");
      const unauthorizedStrategy = await MockUnauthorizedStrategy.deploy("Unauthorized", "UNAUTH");
      
      await expect(
        assetPool.connect(unauthorizedStrategy).transferToStrategy(
          user1.address,
          ZERO_ADDRESS,
          ethers.parseEther("0.5")
        )
      ).to.be.revertedWith("AssetPool: Only authorized strategies can call this function");
    });

    it("应该允许策略返回资金", async function () {
      const returnAmount = ethers.parseEther("0.3");
      
      await assetPool.connect(strategyContract).returnFromStrategy(
        user1.address,
        ZERO_ADDRESS,
        returnAmount,
        { value: returnAmount }
      );

      expect(await assetPool.getUserBalance(user1.address, ZERO_ADDRESS)).to.equal(ethers.parseEther("1.3"));
      expect(await assetPool.getPoolBalance(ZERO_ADDRESS)).to.equal(ethers.parseEther("1.3"));
    });
  });

  describe("管理员功能", function () {
    it("应该允许所有者添加授权策略", async function () {
      const strategyAddress = user1.address;
      
      await assetPool.addAuthorizedStrategy(strategyAddress);
      
      expect(await assetPool.isStrategyAuthorized(strategyAddress)).to.be.true;
    });

    it("应该允许所有者移除授权策略", async function () {
      const strategyAddress = user1.address;
      
      await assetPool.addAuthorizedStrategy(strategyAddress);
      await assetPool.removeAuthorizedStrategy(strategyAddress);
      
      expect(await assetPool.isStrategyAuthorized(strategyAddress)).to.be.false;
    });

    it("应该允许所有者添加支持的代币", async function () {
      const tokenAddress = mockToken.target;
      
      await assetPool.addSupportedToken(tokenAddress);
      
      expect(await assetPool.isTokenSupported(tokenAddress)).to.be.true;
    });

    it("应该允许所有者设置手续费收集地址", async function () {
      const newFeeCollector = user2.address;
      
      await assetPool.setFeeCollector(newFeeCollector);
      
      expect(await assetPool.feeCollector()).to.equal(newFeeCollector);
    });

    it("应该拒绝非所有者调用管理员功能", async function () {
      await expect(
        assetPool.connect(user1).addAuthorizedStrategy(user2.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("紧急功能", function () {
    beforeEach(async function () {
      // 用户1存款
      const depositAmount = ethers.parseEther("1");
      await assetPool.connect(user1).deposit(ZERO_ADDRESS, depositAmount, {
        value: depositAmount
      });
    });

    it("应该允许暂停合约", async function () {
      await assetPool.pause();
      expect(await assetPool.paused()).to.be.true;
    });

    it("应该允许恢复合约", async function () {
      await assetPool.pause();
      await assetPool.unpause();
      expect(await assetPool.paused()).to.be.false;
    });

    it("暂停时应该拒绝正常存款", async function () {
      await assetPool.pause();
      
      await expect(
        assetPool.connect(user2).deposit(ZERO_ADDRESS, ethers.parseEther("0.1"), {
          value: ethers.parseEther("0.1")
        })
      ).to.be.revertedWith("Pausable: paused");
    });

    it("暂停时应该允许紧急提款", async function () {
      await assetPool.pause();
      
      const initialBalance = await ethers.provider.getBalance(user1.address);
      await assetPool.connect(user1).emergencyWithdraw(ZERO_ADDRESS);
      const finalBalance = await ethers.provider.getBalance(user1.address);
      
      expect(finalBalance).to.be.gt(initialBalance);
      expect(await assetPool.getUserBalance(user1.address, ZERO_ADDRESS)).to.equal(0);
    });
  });

  describe("查询功能", function () {
    beforeEach(async function () {
      // 用户1和用户2存款
      await assetPool.connect(user1).deposit(ZERO_ADDRESS, ethers.parseEther("1"), {
        value: ethers.parseEther("1")
      });
      
      await assetPool.connect(user2).deposit(ZERO_ADDRESS, ethers.parseEther("2"), {
        value: ethers.parseEther("2")
      });
    });

    it("应该正确返回用户余额", async function () {
      expect(await assetPool.getUserBalance(user1.address, ZERO_ADDRESS)).to.equal(ethers.parseEther("1"));
      expect(await assetPool.getUserBalance(user2.address, ZERO_ADDRESS)).to.equal(ethers.parseEther("2"));
    });

    it("应该正确返回资金池总余额", async function () {
      expect(await assetPool.getPoolBalance(ZERO_ADDRESS)).to.equal(ethers.parseEther("3"));
    });
  });
}); 