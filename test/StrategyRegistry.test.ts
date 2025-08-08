import { expect } from "chai";
import { ethers } from "hardhat";

describe("StrategyRegistry", function () {
  let registry: any;
  let owner: any;
  let user: any;
  let other: any;

  beforeEach(async function () {
    [owner, user, other] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("StrategyRegistry");
    registry = await Factory.deploy(owner.address);
    await registry.waitForDeployment();
  });

  function bytes32Symbol(sym: string) {
    return ethers.encodeBytes32String(sym);
  }

  async function domain() {
    return {
      name: "Hermora Strategy",
      version: "1",
      chainId: await ethers.provider.getNetwork().then((n) => n.chainId),
      verifyingContract: await registry.getAddress()
    };
  }

  describe("Register Strategy", function () {
    it("registers with valid signature", async function () {
      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const paramsHash = ethers.keccak256(ethers.toUtf8Bytes('{"symbol":"ETH","leverage":3}'));
      const symbol = bytes32Symbol("ETH");

      const types = {
        CreateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "paramsHash", type: "bytes32" },
          { name: "symbol", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = {
        walletAddress: user.address,
        paramsHash,
        symbol,
        nonce: Number(nonce),
        deadline
      } as const;

      const signature = await user.signTypedData(await domain(), types, message);

      await expect(
        registry.registerStrategy(
          user.address,
          paramsHash,
          symbol,
          message.nonce,
          deadline,
          signature,
          "ipfs://metadata/eth-3x"
        )
      ).to.emit(registry, "StrategyRegistered");

      const newNonce = await registry.getNonce(user.address);
      expect(newNonce).to.equal(Number(nonce) + 1);
    });

    it("reverts with expired signature", async function () {
      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) - 1;
      const paramsHash = ethers.keccak256(ethers.toUtf8Bytes("{}"));
      const symbol = bytes32Symbol("ETH");

      const types = {
        CreateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "paramsHash", type: "bytes32" },
          { name: "symbol", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = {
        walletAddress: user.address,
        paramsHash,
        symbol,
        nonce: Number(nonce),
        deadline
      } as const;

      const signature = await user.signTypedData(await domain(), types, message);
      await expect(
        registry.registerStrategy(
          user.address,
          paramsHash,
          symbol,
          message.nonce,
          deadline,
          signature,
          "ipfs://metadata"
        )
      ).to.be.revertedWithCustomError(registry, "ExpiredSignature");
    });

    it("reverts with invalid nonce", async function () {
      const nonce = 10; // wrong nonce
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const paramsHash = ethers.keccak256(ethers.toUtf8Bytes("{}"));
      const symbol = bytes32Symbol("ETH");

      const types = {
        CreateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "paramsHash", type: "bytes32" },
          { name: "symbol", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = {
        walletAddress: user.address,
        paramsHash,
        symbol,
        nonce,
        deadline
      } as const;

      const signature = await user.signTypedData(await domain(), types, message);
      await expect(
        registry.registerStrategy(
          user.address,
          paramsHash,
          symbol,
          nonce,
          deadline,
          signature,
          "ipfs://metadata"
        )
      ).to.be.revertedWithCustomError(registry, "InvalidNonce");
    });
  });

  describe("Update / Activate / Delete", function () {
    async function registerOne() {
      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const paramsHash = ethers.keccak256(ethers.toUtf8Bytes('{"a":1}'));
      const symbol = bytes32Symbol("ETH");
      const types = {
        CreateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "paramsHash", type: "bytes32" },
          { name: "symbol", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;
      const message = { walletAddress: user.address, paramsHash, symbol, nonce: Number(nonce), deadline } as const;
      const signature = await user.signTypedData(await domain(), types, message);
      const tx = await registry.registerStrategy(user.address, paramsHash, symbol, message.nonce, deadline, signature, "uri");
      const rc = await tx.wait();
      const event = rc!.logs.map((l: any) => l).find((l: any) => l.fragment && l.fragment.name === "StrategyRegistered");
      const id = event?.args?.[0] ?? 1n;
      return Number(id);
    }

    it("updates paramsHash with valid signature", async function () {
      const id = await registerOne();

      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const newParams = ethers.keccak256(ethers.toUtf8Bytes('{"a":2}'));

      const types = {
        UpdateStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "strategyId", type: "uint256" },
          { name: "paramsHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = { walletAddress: user.address, strategyId: id, paramsHash: newParams, nonce: Number(nonce), deadline } as const;
      const signature = await user.signTypedData(await domain(), types, message);

      await expect(
        registry.updateStrategy(user.address, id, newParams, message.nonce, deadline, signature, "uri2")
      ).to.emit(registry, "StrategyUpdated");

      const s = await registry.getStrategy(id);
      expect(s.paramsHash).to.equal(newParams);
    });

    it("toggles active with valid signature", async function () {
      const id = await registerOne();
      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const types = {
        SetStrategyActive: [
          { name: "walletAddress", type: "address" },
          { name: "strategyId", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = { walletAddress: user.address, strategyId: id, active: false, nonce: Number(nonce), deadline } as const;
      const signature = await user.signTypedData(await domain(), types, message);

      await expect(
        registry.setStrategyActive(user.address, id, false, message.nonce, deadline, signature)
      ).to.emit(registry, "StrategyActivationChanged");

      const s = await registry.getStrategy(id);
      expect(s.isActive).to.equal(false);
    });

    it("deletes with valid signature", async function () {
      const id = await registerOne();
      const nonce = await registry.getNonce(user.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      const types = {
        DeleteStrategy: [
          { name: "walletAddress", type: "address" },
          { name: "strategyId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ]
      } as const;

      const message = { walletAddress: user.address, strategyId: id, nonce: Number(nonce), deadline } as const;
      const signature = await user.signTypedData(await domain(), types, message);

      await expect(
        registry.deleteStrategy(user.address, id, message.nonce, deadline, signature)
      ).to.emit(registry, "StrategyDeleted");

      const list = await registry.getUserStrategies(user.address);
      expect(list.map((x: bigint) => Number(x))).to.not.include(id);
    });
  });
});

