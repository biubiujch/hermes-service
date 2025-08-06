import { expect } from "chai";
import { ethers } from "hardhat";
import { MockToken } from "../typechain-types";

describe("MockToken", function () {
  let mockToken: MockToken;
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const MockTokenFactory = await ethers.getContractFactory("MockToken");
    mockToken = await MockTokenFactory.deploy("Test USDT", "tUSDT", 6, owner.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await mockToken.owner()).to.equal(owner.address);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await mockToken.name()).to.equal("Test USDT");
      expect(await mockToken.symbol()).to.equal("tUSDT");
    });

    it("Should set the correct decimals", async function () {
      expect(await mockToken.decimals()).to.equal(6);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await mockToken.mint(user1.address, mintAmount);
      expect(await mockToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      await expect(
        mockToken.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(mockToken, "OwnableUnauthorizedAccount");
    });
  });

  describe("Burning", function () {
    it("Should allow users to burn their own tokens", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      const burnAmount = ethers.parseUnits("500", 6);
      
      await mockToken.mint(user1.address, mintAmount);
      await mockToken.connect(user1).burn(burnAmount);
      
      expect(await mockToken.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
    });

    it("Should not allow users to burn more tokens than they have", async function () {
      const mintAmount = ethers.parseUnits("1000", 6);
      const burnAmount = ethers.parseUnits("1500", 6);
      
      await mockToken.mint(user1.address, mintAmount);
      await expect(
        mockToken.connect(user1).burn(burnAmount)
      ).to.be.revertedWithCustomError(mockToken, "ERC20InsufficientBalance");
    });
  });
}); 