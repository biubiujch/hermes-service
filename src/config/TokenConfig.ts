import { readFileSync } from "fs";
import { join } from "path";

export interface TokenConfig {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  minBalance: string;
  injectAmount: string;
}

export class TokenConfigManager {
  private static instance: TokenConfigManager;
  private tokenConfigs: Map<string, TokenConfig> = new Map();

  private constructor() {
    this.loadTokenConfigs();
  }

  public static getInstance(): TokenConfigManager {
    if (!TokenConfigManager.instance) {
      TokenConfigManager.instance = new TokenConfigManager();
    }
    return TokenConfigManager.instance;
  }

  /**
   * 加载代币配置
   */
  private loadTokenConfigs() {
    try {
      // 尝试从部署文件加载
      const deploymentPath = join(__dirname, "..", "..", "deployments", "test-tokens-localhost.json");
      const deploymentData = JSON.parse(readFileSync(deploymentPath, "utf8"));
      
      // 从环境变量获取最小余额和注入金额配置
      const minBalances = {
        USDT: process.env.MIN_USDT_BALANCE || "1000",
        USDC: process.env.MIN_USDC_BALANCE || "1000", 
        DAI: process.env.MIN_DAI_BALANCE || "1000",
        WETH: process.env.MIN_WETH_BALANCE || "1",
        ETH: process.env.MIN_ETH_BALANCE || "1"
      };

      const injectAmounts = {
        USDT: process.env.INJECT_USDT_AMOUNT || "1000",
        USDC: process.env.INJECT_USDC_AMOUNT || "1000",
        DAI: process.env.INJECT_DAI_AMOUNT || "1000", 
        WETH: process.env.INJECT_WETH_AMOUNT || "10",
        ETH: process.env.INJECT_ETH_AMOUNT || "10"
      };

      // 添加部署的代币
      deploymentData.tokens.forEach((token: any) => {
        this.tokenConfigs.set(token.symbol, {
          name: token.name,
          symbol: token.symbol,
          address: token.address,
          decimals: token.decimals,
          minBalance: minBalances[token.symbol as keyof typeof minBalances] || "1000",
          injectAmount: injectAmounts[token.symbol as keyof typeof injectAmounts] || "1000"
        });
      });

      // 添加ETH配置
      this.tokenConfigs.set("ETH", {
        name: "Ethereum",
        symbol: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        minBalance: minBalances.ETH,
        injectAmount: injectAmounts.ETH
      });

      console.log(`✅ 已加载 ${this.tokenConfigs.size} 个代币配置`);
    } catch (error) {
      console.warn("⚠️ 无法加载代币部署文件，使用默认配置");
      this.loadDefaultConfigs();
    }
  }

  /**
   * 加载默认配置
   */
  private loadDefaultConfigs() {
    const defaultTokens: TokenConfig[] = [
      {
        name: "Mock USDT",
        symbol: "USDT",
        address: process.env.MOCK_USDT_ADDRESS || "0x0000000000000000000000000000000000000000",
        decimals: 6,
        minBalance: "1000",
        injectAmount: "1000"
      },
      {
        name: "Ethereum",
        symbol: "ETH",
        address: "0x0000000000000000000000000000000000000000",
        decimals: 18,
        minBalance: "1",
        injectAmount: "10"
      }
    ];

    defaultTokens.forEach(token => {
      this.tokenConfigs.set(token.symbol, token);
    });
  }

  /**
   * 获取所有代币配置
   */
  getTokenConfigs(): TokenConfig[] {
    return Array.from(this.tokenConfigs.values());
  }

  /**
   * 获取特定代币配置
   */
  getTokenConfig(symbol: string): TokenConfig | undefined {
    return this.tokenConfigs.get(symbol);
  }

  /**
   * 获取代币地址
   */
  getTokenAddress(symbol: string): string | undefined {
    const config = this.getTokenConfig(symbol);
    return config?.address;
  }

  /**
   * 检查代币是否支持
   */
  isTokenSupported(symbol: string): boolean {
    return this.tokenConfigs.has(symbol);
  }

  /**
   * 获取支持的代币符号列表
   */
  getSupportedSymbols(): string[] {
    return Array.from(this.tokenConfigs.keys());
  }

  /**
   * 重新加载配置
   */
  reloadConfigs() {
    this.tokenConfigs.clear();
    this.loadTokenConfigs();
  }
} 