import { expect } from "chai";
import { ethers } from "hardhat";
import { Vault } from "../typechain-types";

describe("Vault Signature Verification", function () {
  let vault: Vault;
  let owner: any;
  let user1: any;
  let user2: any;
  let feeCollector: any;

  beforeEach(async function () {
    [owner, user1, user2, feeCollector] = await ethers.getSigners();

    const VaultFactory = await ethers.getContractFactory("Vault");
    vault = await VaultFactory.deploy(owner.address, feeCollector.address);

    // 给用户1一些ETH以确保有足够资金支付gas
    await owner.sendTransaction({
      to: user1.address,
      value: ethers.parseEther("10.0")
    });
  });

  describe("EIP-712 Domain Separator", function () {
    it("Should return correct domain separator", async function () {
      const domainSeparator = await vault.getDomainSeparator();
      expect(domainSeparator).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Nonce Management", function () {
    it("Should start with nonce 0", async function () {
      const nonce = await vault.getNonce(user1.address);
      expect(nonce).to.equal(0);
    });

    it("Should increment nonce after successful operation", async function () {
      // Create a pool with signature to increment nonce
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await vault.createPool(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress,
        nonce,
        deadline,
        signature,
        { value: ethers.parseEther("1.0") }
      );

      const newNonce = await vault.getNonce(user1.address);
      expect(newNonce).to.equal(1);
    });
  });

  describe("Create Pool with Signature", function () {
    it("Should create pool with valid signature", async function () {
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.createPool(
          user1.address,
          ethers.parseEther("1.0"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          signature,
          { value: ethers.parseEther("1.0") }
        )
      ).to.emit(vault, "PoolCreated");
    });

    it("Should reject invalid signature", async function () {
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      // 创建一个正确长度但无效的签名
      const invalidSignature = "0x" + "1".repeat(130); // 65 bytes

      await expect(
        vault.createPool(
          user1.address,
          ethers.parseEther("1.0"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          invalidSignature,
          { value: ethers.parseEther("1.0") }
        )
      ).to.be.revertedWithCustomError(vault, "ECDSAInvalidSignature");
    });

    it("Should reject expired signature", async function () {
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) - 3600; // Expired 1 hour ago
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.createPool(
          user1.address,
          ethers.parseEther("1.0"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          signature,
          { value: ethers.parseEther("1.0") }
        )
      ).to.be.revertedWithCustomError(vault, "ExpiredSignature");
    });

    it("Should reject invalid nonce", async function () {
      const nonce = 5; // Invalid nonce
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.createPool(
          user1.address,
          ethers.parseEther("1.0"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          signature,
          { value: ethers.parseEther("1.0") }
        )
      ).to.be.revertedWithCustomError(vault, "InvalidNonce");
    });
  });

  describe("Delete Pool with Signature", function () {
    let poolId: number;

    beforeEach(async function () {
      // Create a pool first
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      const tx = await vault.createPool(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress,
        nonce,
        deadline,
        signature,
        { value: ethers.parseEther("1.0") }
      );

      const receipt = await tx.wait();
      const event = vault.interface.parseLog(receipt.logs[0] as any);
      poolId = Number(event?.args[0]);

      // 给用户1一些ETH以确保有足够资金支付gas
      await owner.sendTransaction({
        to: user1.address,
        value: ethers.parseEther("10.0")
      });

      // 再存入一些资金到资金池，确保有足够余额
      const depositNonce = 1;
      const depositDeadline = Math.floor(Date.now() / 1000) + 3600;
      
      const depositDomain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const depositTypes = {
        Deposit: [
          { name: 'walletAddress', type: 'address' },
          { name: 'poolId', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const depositMessage = {
        walletAddress: user1.address,
        poolId: poolId,
        amount: ethers.parseEther("5.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: depositNonce,
        deadline: depositDeadline
      };

      const depositSignature = await user1.signTypedData(depositDomain, depositTypes, depositMessage);

      await vault.deposit(
        user1.address,
        poolId,
        ethers.parseEther("5.0"),
        ethers.ZeroAddress,
        depositNonce,
        depositDeadline,
        depositSignature,
        { value: ethers.parseEther("5.0") }
      );
    });

    it.skip("Should delete pool with valid signature", async function () {
      const nonce = 2; // Incremented from create and deposit operations
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        DeletePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'poolId', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        poolId: poolId,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.connect(user1).deletePool(
          user1.address,
          poolId,
          nonce,
          deadline,
          signature
        )
      ).to.emit(vault, "PoolDeleted");
    });
  });

  describe("Deposit with Signature", function () {
    let poolId: number;

    beforeEach(async function () {
      // Create a pool first
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      const tx = await vault.createPool(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress,
        nonce,
        deadline,
        signature,
        { value: ethers.parseEther("1.0") }
      );

      const receipt = await tx.wait();
      const event = vault.interface.parseLog(receipt.logs[0] as any);
      poolId = Number(event?.args[0]);
    });

    it("Should deposit with valid signature", async function () {
      const nonce = 1; // Incremented from create operation
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        Deposit: [
          { name: 'walletAddress', type: 'address' },
          { name: 'poolId', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        poolId: poolId,
        amount: ethers.parseEther("0.5"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.deposit(
          user1.address,
          poolId,
          ethers.parseEther("0.5"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          signature,
          { value: ethers.parseEther("0.5") }
        )
      ).to.emit(vault, "FundsDeposited");
    });
  });

  describe("Withdraw with Signature", function () {
    let poolId: number;

    beforeEach(async function () {
      // Create a pool first
      const nonce = 0;
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        CreatePool: [
          { name: 'walletAddress', type: 'address' },
          { name: 'initialAmount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        initialAmount: ethers.parseEther("1.0"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      const tx = await vault.createPool(
        user1.address,
        ethers.parseEther("1.0"),
        ethers.ZeroAddress,
        nonce,
        deadline,
        signature,
        { value: ethers.parseEther("1.0") }
      );

      const receipt = await tx.wait();
      const event = vault.interface.parseLog(receipt.logs[0] as any);
      poolId = Number(event?.args[0]);
    });

    it("Should withdraw with valid signature", async function () {
      const nonce = 1; // Incremented from create operation
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      
      const domain = {
        name: "Hermora Vault",
        version: "1",
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        verifyingContract: await vault.getAddress()
      };

      const types = {
        Withdraw: [
          { name: 'walletAddress', type: 'address' },
          { name: 'poolId', type: 'uint256' },
          { name: 'amount', type: 'uint256' },
          { name: 'tokenAddress', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ]
      };

      const message = {
        walletAddress: user1.address,
        poolId: poolId,
        amount: ethers.parseEther("0.5"),
        tokenAddress: ethers.ZeroAddress,
        nonce: nonce,
        deadline: deadline
      };

      const signature = await user1.signTypedData(domain, types, message);

      await expect(
        vault.withdraw(
          user1.address,
          poolId,
          ethers.parseEther("0.5"),
          ethers.ZeroAddress,
          nonce,
          deadline,
          signature
        )
      ).to.emit(vault, "FundsWithdrawn");
    });
  });
}); 