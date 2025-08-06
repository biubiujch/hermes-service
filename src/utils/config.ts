import { getEnvironmentVariable } from './envPaser';

/**
 * 网络配置接口
 */
interface NetworkConfig {
  id: number;
  name: string;
  rpcUrl: string;
  chainId: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  isTestnet: boolean;
  isLocal: boolean;
}

/**
 * 应用配置管理类
 * 用于管理各种配置项，包括手续费收集账户等
 */
export class AppConfig {
  private static instance: AppConfig;
  
  // 手续费收集账户配置
  private feeCollectorAddress: string | null = null;
  private feeCollectorPrivateKey: string | null = null;
  
  // 手续费率配置
  private tradingFeeRate: number = 0.001; // 0.1%
  private withdrawalFeeRate: number = 0.0005; // 0.05%
  
  // 网络配置
  private localNodeUrl: string = 'http://127.0.0.1:8545';
  
  // 合约地址配置
  private mockTokenAddress: string | null = null;
  private vaultAddress: string | null = null;
  private membershipAddress: string | null = null;

  // 支持的网络列表
  private networks: NetworkConfig[] = [
    {
      id: 31337,
      name: 'Hardhat Local',
      rpcUrl: 'http://127.0.0.1:8545',
      chainId: '0x7A69', // 31337 in hex
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorerUrls: [],
      isTestnet: true,
      isLocal: true
    },
    {
      id: 42161,
      name: 'Arbitrum One',
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      chainId: '0xA4B1', // 42161 in hex
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorerUrls: ['https://arbiscan.io'],
      isTestnet: false,
      isLocal: false
    },
    {
      id: 43114,
      name: 'Avalanche C-Chain',
      rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
      chainId: '0xA86A', // 43114 in hex
      nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18
      },
      blockExplorerUrls: ['https://snowtrace.io'],
      isTestnet: false,
      isLocal: false
    },
    {
      id: 3636,
      name: 'Botanix',
      rpcUrl: 'https://rpc.btxtestchain.com',
      chainId: '0xE34', // 3636 in hex
      nativeCurrency: {
        name: 'Bitcoin',
        symbol: 'BTC',
        decimals: 18
      },
      blockExplorerUrls: ['https://testnet.botanixscan.com'],
      isTestnet: true,
      isLocal: false
    }
  ];

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  /**
   * 加载配置
   */
  private loadConfig(): void {
    // 手续费收集账户配置
    this.feeCollectorAddress = getEnvironmentVariable('FEE_COLLECTOR_ADDRESS') || null;
    this.feeCollectorPrivateKey = getEnvironmentVariable('FEE_COLLECTOR_PRIVATE_KEY') || null;
    
    // 手续费率配置
    const tradingFeeRateStr = getEnvironmentVariable('TRADING_FEE_RATE');
    if (tradingFeeRateStr) {
      this.tradingFeeRate = parseFloat(tradingFeeRateStr);
    }
    
    const withdrawalFeeRateStr = getEnvironmentVariable('WITHDRAWAL_FEE_RATE');
    if (withdrawalFeeRateStr) {
      this.withdrawalFeeRate = parseFloat(withdrawalFeeRateStr);
    }
    
    // 网络配置
    this.localNodeUrl = getEnvironmentVariable('LOCAL_NODE_URL') || 'http://127.0.0.1:8545';
    
    // 合约地址配置
    this.mockTokenAddress = getEnvironmentVariable('MOCK_TOKEN_ADDRESS') || null;
    this.vaultAddress = getEnvironmentVariable('VAULT_ADDRESS') || null;
    this.membershipAddress = getEnvironmentVariable('MEMBERSHIP_ADDRESS') || null;
  }

  /**
   * 获取所有支持的网络列表
   */
  public getNetworks(): NetworkConfig[] {
    return this.networks;
  }

  /**
   * 根据网络ID获取网络配置
   */
  public getNetworkById(chainId: number): NetworkConfig | null {
    return this.networks.find(network => network.id === chainId) || null;
  }

  /**
   * 获取本地网络配置
   */
  public getLocalNetwork(): NetworkConfig | null {
    return this.networks.find(network => network.isLocal) || null;
  }

  /**
   * 获取测试网络列表
   */
  public getTestnetNetworks(): NetworkConfig[] {
    return this.networks.filter(network => network.isTestnet);
  }

  /**
   * 获取主网网络列表
   */
  public getMainnetNetworks(): NetworkConfig[] {
    return this.networks.filter(network => !network.isTestnet);
  }

  /**
   * 添加自定义网络
   */
  public addNetwork(network: NetworkConfig): void {
    // 检查是否已存在相同ID的网络
    const existingIndex = this.networks.findIndex(n => n.id === network.id);
    if (existingIndex >= 0) {
      this.networks[existingIndex] = network;
    } else {
      this.networks.push(network);
    }
  }

  /**
   * 移除网络
   */
  public removeNetwork(chainId: number): boolean {
    const initialLength = this.networks.length;
    this.networks = this.networks.filter(network => network.id !== chainId);
    return this.networks.length < initialLength;
  }

  /**
   * 获取手续费收集账户地址
   */
  public getFeeCollectorAddress(): string | null {
    return this.feeCollectorAddress;
  }

  /**
   * 设置手续费收集账户地址
   */
  public setFeeCollectorAddress(address: string): void {
    this.feeCollectorAddress = address;
  }

  /**
   * 获取手续费收集账户私钥（仅用于特定场景）
   */
  public getFeeCollectorPrivateKey(): string | null {
    return this.feeCollectorPrivateKey;
  }

  /**
   * 获取交易手续费率
   */
  public getTradingFeeRate(): number {
    return this.tradingFeeRate;
  }

  /**
   * 设置交易手续费率
   */
  public setTradingFeeRate(rate: number): void {
    this.tradingFeeRate = rate;
  }

  /**
   * 获取提现手续费率
   */
  public getWithdrawalFeeRate(): number {
    return this.withdrawalFeeRate;
  }

  /**
   * 设置提现手续费率
   */
  public setWithdrawalFeeRate(rate: number): void {
    this.withdrawalFeeRate = rate;
  }

  /**
   * 获取本地节点URL
   */
  public getLocalNodeUrl(): string {
    return this.localNodeUrl;
  }

  /**
   * 获取MockToken地址
   */
  public getMockTokenAddress(): string | null {
    return this.mockTokenAddress;
  }

  /**
   * 设置MockToken地址
   */
  public setMockTokenAddress(address: string): void {
    this.mockTokenAddress = address;
  }

  /**
   * 获取Vault地址
   */
  public getVaultAddress(): string | null {
    return this.vaultAddress;
  }

  /**
   * 设置Vault地址
   */
  public setVaultAddress(address: string): void {
    this.vaultAddress = address;
  }

  /**
   * 获取Membership地址
   */
  public getMembershipAddress(): string | null {
    return this.membershipAddress;
  }

  /**
   * 设置Membership地址
   */
  public setMembershipAddress(address: string): void {
    this.membershipAddress = address;
  }

  /**
   * 检查手续费收集账户是否已配置
   */
  public isFeeCollectorConfigured(): boolean {
    return !!this.feeCollectorAddress;
  }

  /**
   * 获取所有配置信息（用于调试）
   */
  public getConfigInfo(): object {
    return {
      feeCollector: {
        address: this.feeCollectorAddress,
        configured: this.isFeeCollectorConfigured()
      },
      fees: {
        tradingRate: this.tradingFeeRate,
        withdrawalRate: this.withdrawalFeeRate
      },
      network: {
        localNodeUrl: this.localNodeUrl
      },
      contracts: {
        mockToken: this.mockTokenAddress,
        vault: this.vaultAddress,
        membership: this.membershipAddress
      },
      supportedNetworks: this.networks.map(network => ({
        id: network.id,
        name: network.name,
        isTestnet: network.isTestnet,
        isLocal: network.isLocal
      }))
    };
  }
}

// 导出单例实例
export const appConfig = AppConfig.getInstance(); 