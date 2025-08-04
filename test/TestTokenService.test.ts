import { expect } from "chai";
import { ethers } from "hardhat";
import { MockERC20 } from "../typechain-types";
import { TestTokenService } from "../src/services/TestTokenService";

describe("TestTokenService", function () {
  let testTokenService: TestTokenService;
  let mockUSDT: MockERC20;
  let owner: any;
  let user: any;

  beforeEach(async function () {
    // 获取测试账户
    [owner, user] = await ethers.getSigners();

    // 部署Mock USDT
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockUSDT = await MockERC20.deploy("Mock USDT", "USDT");

    // 创建测试代币服务
    testTokenService = new TestTokenService();
  });

  describe("配置管理", function () {
    it("应该能够获取测试代币配置", function () {
      const configs = testTokenService.getTestTokenConfigs();
      expect(configs).to.be.an('array');
      expect(configs.length).to.be.greaterThan(0);
    });

    it("应该能够获取特定代币配置", function () {
      const ethConfig = testTokenService.getTestTokenConfig("ETH");
      expect(ethConfig).to.not.be.undefined;
      expect(ethConfig?.symbol).to.equal("ETH");
      expect(ethConfig?.address).to.equal(ethers.ZeroAddress);
    });
  });

  describe("余额检查", function () {
    it("应该能够检查ETH余额", async function () {
      const balance = await testTokenService.checkUserTokenBalance(
        "localhost",
        user.address,
        "ETH"
      );

      expect(balance.symbol).to.equal("ETH");
      expect(balance.token).to.equal(ethers.ZeroAddress);
      expect(parseFloat(balance.balance)).to.be.greaterThan(0);
    });

    it("应该能够检查ERC20代币余额", async function () {
      // 给用户铸造一些USDT
      await mockUSDT.mint(user.address, ethers.parseUnits("1000", 6));

      const balance = await testTokenService.checkUserTokenBalance(
        "localhost",
        user.address,
        "USDT"
      );

      expect(balance.symbol).to.equal("USDT");
      expect(parseFloat(balance.balance)).to.equal(1000);
    });
  });

  describe("代币注入", function () {
    it("应该能够注入ERC20代币", async function () {
      // 设置部署者签名者
      const blockchainService = (testTokenService as any).blockchainService;
      blockchainService.setSigner("localhost", owner.privateKey);

      const txHash = await testTokenService.injectTestToken(
        "localhost",
        user.address,
        "USDT",
        owner.privateKey
      );

      expect(txHash).to.be.a('string');
      expect(txHash.length).to.be.greaterThan(0);

      // 检查余额是否增加
      const balance = await testTokenService.checkUserTokenBalance(
        "localhost",
        user.address,
        "USDT"
      );
      expect(parseFloat(balance.balance)).to.be.greaterThan(0);
    });
  });

  describe("自动检查和注入", function () {
    it("应该能够检查并自动注入代币", async function () {
      // 设置部署者签名者
      const blockchainService = (testTokenService as any).blockchainService;
      blockchainService.setSigner("localhost", owner.privateKey);

      const result = await testTokenService.checkAndInjectTestToken(
        "localhost",
        user.address,
        "USDT",
        owner.privateKey
      );

      expect(result).to.have.property('injected');
      expect(result).to.have.property('balance');
      expect(result.balance.symbol).to.equal("USDT");
    });
  });

  describe("批量余额检查", function () {
    it("应该能够获取用户所有代币余额", async function () {
      const balances = await testTokenService.getAllUserTokenBalances(
        "localhost",
        user.address
      );

      expect(balances).to.be.an('array');
      expect(balances.length).to.be.greaterThan(0);

      // 检查是否包含ETH
      const ethBalance = balances.find(b => b.symbol === "ETH");
      expect(ethBalance).to.not.be.undefined;
    });
  });
}); 