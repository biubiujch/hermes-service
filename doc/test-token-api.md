# 测试代币API文档

## 概述

测试代币API提供了在本地测试链上管理测试代币的功能，包括余额检查、自动注入等。

## 快速开始

### 1. 部署测试代币

```bash
# 启动本地Hardhat节点
npx hardhat node

# 部署测试代币
npm run deploy:tokens:local
```

### 2. 启动API服务

```bash
npm run dev
```

## API端点

### 获取测试代币配置

```http
GET /api/test-token/configs
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "name": "Mock USDT",
      "symbol": "USDT",
      "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "decimals": 6,
      "minBalance": "1000",
      "injectAmount": "1000"
    },
    {
      "name": "Ethereum",
      "symbol": "ETH",
      "address": "0x0000000000000000000000000000000000000000",
      "decimals": 18,
      "minBalance": "1",
      "injectAmount": "10"
    }
  ]
}
```

### 检查用户代币余额

```http
GET /api/test-token/{network}/user/{address}/balance/{symbol}
```

**参数：**
- `network`: 网络名称 (localhost, arbitrumTestnet, arbitrum)
- `address`: 用户钱包地址
- `symbol`: 代币符号 (USDT, ETH, USDC, DAI, WETH)

**响应示例：**
```json
{
  "success": true,
  "data": {
    "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "symbol": "USDT",
    "balance": "500.000000",
    "decimals": 6,
    "needsInjection": true
  }
}
```

### 获取用户所有代币余额

```http
GET /api/test-token/{network}/user/{address}/balances
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "symbol": "USDT",
      "balance": "500.000000",
      "decimals": 6,
      "needsInjection": true
    },
    {
      "token": "0x0000000000000000000000000000000000000000",
      "symbol": "ETH",
      "balance": "2.5",
      "decimals": 18,
      "needsInjection": false
    }
  ]
}
```

### 手动注入测试代币

```http
POST /api/test-token/{network}/inject/{symbol}
```

**请求体：**
```json
{
  "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "privateKey": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "txHash": "0x1234567890abcdef...",
    "network": "localhost",
    "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "symbol": "USDT",
    "message": "已注入测试代币 USDT 到 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }
}
```

### 检查并自动注入测试代币

```http
POST /api/test-token/{network}/check-and-inject/{symbol}
```

**功能：** 如果用户余额低于最小余额，自动注入指定金额

**响应示例：**
```json
{
  "success": true,
  "data": {
    "injected": true,
    "txHash": "0x1234567890abcdef...",
    "balance": {
      "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      "symbol": "USDT",
      "balance": "1000.000000",
      "decimals": 6,
      "needsInjection": false
    },
    "network": "localhost",
    "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "symbol": "USDT",
    "message": "已自动注入测试代币 USDT 到 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }
}
```

### 自动注入所有测试代币

```http
POST /api/test-token/{network}/auto-inject-all
```

**功能：** 检查所有支持的代币，对余额不足的自动注入

**响应示例：**
```json
{
  "success": true,
  "data": {
    "network": "localhost",
    "userAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "results": [
      {
        "symbol": "USDT",
        "injected": true,
        "txHash": "0x1234567890abcdef...",
        "balance": {
          "token": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
          "symbol": "USDT",
          "balance": "1000.000000",
          "decimals": 6,
          "needsInjection": false
        }
      },
      {
        "symbol": "ETH",
        "injected": false,
        "balance": {
          "token": "0x0000000000000000000000000000000000000000",
          "symbol": "ETH",
          "balance": "2.5",
          "decimals": 18,
          "needsInjection": false
        }
      }
    ],
    "summary": {
      "total": 2,
      "injected": 1,
      "skipped": 1
    },
    "message": "检查完成，共 2 个代币，注入 1 个，跳过 1 个"
  }
}
```

### 获取服务状态

```http
GET /api/test-token/{network}/status
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "network": {
      "networkName": "localhost",
      "chainId": "31337",
      "blockNumber": "12345",
      "connected": true
    },
    "supportedTokens": 5,
    "tokens": [
      {
        "symbol": "USDT",
        "name": "Mock USDT",
        "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        "minBalance": "1000",
        "injectAmount": "1000"
      }
    ]
  }
}
```

## 前端集成示例

### 使用fetch API

```javascript
// 检查USDT余额并自动注入
async function checkAndInjectUSDT(userAddress) {
  try {
    const response = await fetch(`/api/test-token/localhost/check-and-inject/USDT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userAddress: userAddress
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      if (result.data.injected) {
        console.log(`✅ 已自动注入 ${result.data.balance.symbol}`);
      } else {
        console.log(`💰 余额充足: ${result.data.balance.balance} ${result.data.balance.symbol}`);
      }
    } else {
      console.error('❌ 注入失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 请求失败:', error);
  }
}

// 获取所有代币余额
async function getAllBalances(userAddress) {
  try {
    const response = await fetch(`/api/test-token/localhost/user/${userAddress}/balances`);
    const result = await response.json();
    
    if (result.success) {
      result.data.forEach(balance => {
        console.log(`${balance.symbol}: ${balance.balance} ${balance.needsInjection ? '(需要注入)' : '(余额充足)'}`);
      });
    }
  } catch (error) {
    console.error('❌ 获取余额失败:', error);
  }
}
```

### 使用wagmi集成

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
    
    const result = await response.json();
    return result;
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

## 配置说明

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
```

### 部署者私钥

确保在环境变量中设置了部署者的私钥，用于注入ETH：

```bash
PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```

## 注意事项

1. **安全性**: 测试代币API仅用于开发测试，不要在生产环境使用
2. **私钥管理**: 部署者私钥用于注入ETH，请妥善保管
3. **网络支持**: 目前支持localhost、Arbitrum测试网和主网
4. **代币支持**: 支持ETH和ERC20代币的注入
5. **余额检查**: 自动检查余额是否低于最小阈值，决定是否需要注入 