import { ethers } from "ethers";
import { MockUSDT__factory } from "../../typechain-types";

export class TokenService {
  private provider: ethers.Provider;
  private mockUSDTContract: MockUSDT__factory;
  private mockUSDTAddress: string;

  constructor(rpcUrl: string, mockUSDTAddress: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.mockUSDTAddress = mockUSDTAddress;
    this.mockUSDTContract = new MockUSDT__factory();
  }

  /**
   * 领取测试代币
   * @param userAddress 用户地址
   * @param amount 领取数量（以USDT为单位，如1000表示1000 USDT）
   * @returns 交易哈希
   */
  async claimTestTokens(userAddress: string, amount: number = 1000): Promise<string> {
    try {
      // 验证地址格式
      if (!ethers.isAddress(userAddress)) {
        throw new Error("Invalid user address");
      }

      // 验证金额
      if (amount <= 0 || amount > 1000) {
        throw new Error("Amount must be between 1 and 1000 USDT");
      }

      // 连接到合约
      const contract = this.mockUSDTContract.attach(this.mockUSDTAddress);
      
      // 检查用户当前余额
      const currentBalance = await contract.balanceOf(userAddress);
      console.log(`Current balance for ${userAddress}: ${ethers.formatUnits(currentBalance, 6)} USDT`);

      // 计算要领取的数量（转换为6位小数）
      const claimAmount = ethers.parseUnits(amount.toString(), 6);

      // 调用合约的mintForTesting函数
      // 注意：这里需要一个有权限的账户来调用，或者合约需要允许任何人调用
      const tx = await contract.mintForTesting(claimAmount);
      await tx.wait();

      console.log(`Successfully claimed ${amount} USDT for ${userAddress}`);
      return tx.hash;

    } catch (error) {
      console.error("Error claiming test tokens:", error);
      throw new Error(`Failed to claim test tokens: ${error.message}`);
    }
  }

  /**
   * 获取用户代币余额
   * @param userAddress 用户地址
   * @returns 余额（USDT）
   */
  async getBalance(userAddress: string): Promise<string> {
    try {
      if (!ethers.isAddress(userAddress)) {
        throw new Error("Invalid user address");
      }

      const contract = this.mockUSDTContract.attach(this.mockUSDTAddress);
      const balance = await contract.balanceOf(userAddress);
      return ethers.formatUnits(balance, 6);
    } catch (error) {
      console.error("Error getting balance:", error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * 获取合约信息
   * @returns 合约信息
   */
  async getContractInfo() {
    try {
      const contract = this.mockUSDTContract.attach(this.mockUSDTAddress);
      const name = await contract.name();
      const symbol = await contract.symbol();
      const decimals = await contract.decimals();
      
      return {
        address: this.mockUSDTAddress,
        name,
        symbol,
        decimals: decimals.toString(),
        maxClaimAmount: 1000 // 最大领取数量
      };
    } catch (error) {
      console.error("Error getting contract info:", error);
      throw new Error(`Failed to get contract info: ${error.message}`);
    }
  }
} 