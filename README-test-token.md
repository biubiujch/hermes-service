# 测试代币管理功能

## 🎯 功能概述

为前端提供测试币注入的入口，当连接到本地测试链的钱包余额不足时，可以自动注入测试代币。

## ✨ 主要功能

- ✅ **余额检查**: 检查用户钱包中各种代币的余额
- ✅ **自动注入**: 当余额低于阈值时自动注入测试代币
- ✅ **手动注入**: 手动注入指定数量的测试代币
- ✅ **批量操作**: 一次性检查并注入所有支持的代币
- ✅ **多网络支持**: 支持localhost、Arbitrum测试网和主网
- ✅ **多代币支持**: 支持ETH、USDT、USDC、DAI、WETH等

## 🚀 快速开始

### 1. 启动本地区块链

```bash
# 启动Hardhat本地节点
npx hardhat node
```

### 2. 部署测试代币

```bash
# 部署测试代币合约
npm run deploy:tokens:local
```

### 3. 启动API服务

```bash
# 启动开发服务器
npm run dev
```

### 4. 使用前端示例

打开 `examples/frontend-integration.html` 在浏览器中查看前端集成示例。

## 📋 API接口

### 基础URL
```
http://localhost:9999
```

### 主要端点

#### 1. 获取代币配置
```http
GET /api/test-token/configs
```

#### 2. 检查用户余额
```http
GET /api/test-token/{network}/user/{address}/balance/{symbol}
```

#### 3. 获取所有余额
```http
GET /api/test-token/{network}/user/{address}/balances
```

#### 4. 手动注入代币
```http
POST /api/test-token/{network}/inject/{symbol}
```

#### 5. 检查并自动注入
```http
POST /api/test-token/{network}/check-and-inject/{symbol}
```

#### 6. 自动注入所有代币
```http
POST /api/test-token/{network}/auto-inject-all
```

## 💡 使用示例

### JavaScript/TypeScript

```javascript
// 检查USDT余额并自动注入
async function checkAndInjectUSDT(userAddress) {
  const response = await fetch('/api/test-token/localhost/check-and-inject/USDT', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userAddress })
  });
  
  const result = await response.json();
  
  if (result.success) {
    if (result.data.injected) {
      console.log(`✅ 已自动注入 ${result.data.balance.symbol}`);
    } else {
      console.log(`💰 余额充足: ${result.data.balance.balance} ${result.data.balance.symbol}`);
    }
  }
}
```

### React + wagmi

```typescript
import { useAccount, useNetwork } from 'wagmi';

function TestTokenManager() {
  const { address } = useAccount();
  const { chain } = useNetwork();
  
  const checkAndInject = async (symbol: string) => {
    if (!address) return;
    
    const network = chain?.id === 31337 ? 'localhost' : 'arbitrumTestnet';
    
    const response = await fetch(`/api/test-token/${network}/check-and-inject/${symbol}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress: address })
    });
    
    return await response.json();
  };
  
  return (
    <div>
      <button onClick={() => checkAndInject('USDT')}>
        检查并注入USDT
      </button>
      <button onClick={() => checkAndInject('ETH')}>
        检查并注入ETH
      </button>
    </div>
  );
}
```

## ⚙️ 配置说明

### 环境变量

```bash
# 代币地址配置
MOCK_USDT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
MOCK_USDC_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
MOCK_DAI_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

# 最小余额配置
MIN_USDT_BALANCE=1000
MIN_USDC_BALANCE=1000
MIN_DAI_BALANCE=1000
MIN_ETH_BALANCE=1

# 注入金额配置
INJECT_USDT_AMOUNT=1000
INJECT_USDC_AMOUNT=1000
INJECT_DAI_AMOUNT=1000
INJECT_ETH_AMOUNT=10

# 部署者私钥 (用于注入ETH)
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

### 默认配置

| 代币 | 最小余额 | 注入金额 | 小数位 |
|------|----------|----------|--------|
| ETH  | 1        | 10       | 18     |
| USDT | 1000     | 1000     | 6      |
| USDC | 1000     | 1000     | 6      |
| DAI  | 1000     | 1000     | 18     |
| WETH | 1        | 10       | 18     |

## 🔧 开发指南

### 项目结构

```
src/
├── services/
│   └── TestTokenService.ts      # 测试代币服务
├── config/
│   └── TokenConfig.ts           # 代币配置管理
└── api/
    └── routes/
        └── testToken.ts         # API路由
```

### 添加新代币

1. 在 `scripts/deploy-test-tokens.ts` 中添加新代币配置
2. 在 `src/config/TokenConfig.ts` 中添加环境变量支持
3. 重新部署测试代币

### 自定义注入逻辑

可以修改 `TestTokenService.ts` 中的注入逻辑：

```typescript
// 自定义注入条件
async checkAndInjectTestToken(network: string, userAddress: string, tokenSymbol: string) {
  const balance = await this.checkUserTokenBalance(network, userAddress, tokenSymbol);
  
  // 自定义条件：余额小于100时注入
  if (parseFloat(balance.balance) < 100) {
    return await this.injectTestToken(network, userAddress, tokenSymbol);
  }
  
  return { injected: false, balance };
}
```

## 🧪 测试

运行测试：

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --grep "TestTokenService"
```

## 📝 注意事项

1. **安全性**: 此功能仅用于开发测试，不要在生产环境使用
2. **私钥管理**: 部署者私钥用于注入ETH，请妥善保管
3. **网络限制**: 目前主要支持本地测试网络
4. **代币限制**: 仅支持已部署的测试代币
5. **余额检查**: 自动检查余额是否低于最小阈值

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个功能！

## �� 许可证

MIT License 