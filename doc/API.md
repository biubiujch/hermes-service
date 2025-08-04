# Hermes Service API 文档

## 概述

Hermes Service 是一个资金池管理系统的后端API，提供完整的资金池管理功能，包括存款、提款、余额查询等。

## 基础信息

- **基础URL**: `http://localhost:9999`
- **API版本**: v1.0.0
- **数据格式**: JSON
- **认证方式**: 暂无（后续可添加JWT认证）

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  "data": {
    // 具体数据
  }
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误描述"
}
```

## 网络管理

### 获取支持的网络列表

**GET** `/api/asset-pool/networks`

获取系统支持的所有区块链网络。

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "name": "localhost",
      "chainId": 31337,
      "rpcUrl": "http://127.0.0.1:8545"
    },
    {
      "name": "arbitrumTestnet",
      "chainId": 421614,
      "rpcUrl": "https://sepolia-rollup.arbitrum.io/rpc",
      "explorerUrl": "https://sepolia.arbiscan.io"
    },
    {
      "name": "arbitrum",
      "chainId": 42161,
      "rpcUrl": "https://arb1.arbitrum.io/rpc",
      "explorerUrl": "https://arbiscan.io"
    }
  ]
}
```

### 获取网络状态

**GET** `/api/asset-pool/{network}/status`

获取指定网络的连接状态和基本信息。

**参数:**
- `network` (path): 网络名称

**响应示例:**
```json
{
  "success": true,
  "data": {
    "networkName": "arbitrumTestnet",
    "chainId": "421614",
    "blockNumber": "12345678",
    "connected": true
  }
}
```

## 合约配置

### 获取合约配置信息

**GET** `/api/asset-pool/{network}/config`

获取资金池合约的配置信息。

**参数:**
- `network` (path): 网络名称

**响应示例:**
```json
{
  "success": true,
  "data": {
    "feeCollector": "0x1234567890123456789012345678901234567890",
    "minDeposit": "0.01",
    "maxPoolSize": "1000.0",
    "feeRate": "50",
    "feeRatePercent": "0.50%",
    "contractAddress": "0xabcdef1234567890abcdef1234567890abcdef12",
    "network": "arbitrumTestnet"
  }
}
```

## 余额查询

### 获取资金池余额

**GET** `/api/asset-pool/{network}/balance`

获取指定网络资金池的总余额。

**参数:**
- `network` (path): 网络名称
- `token` (query, 可选): 代币地址，默认为ETH (0x0000000000000000000000000000000000000000)

**响应示例:**
```json
{
  "success": true,
  "data": {
    "token": "0x0000000000000000000000000000000000000000",
    "balance": "150.5",
    "decimals": 18
  }
}
```

### 获取用户余额

**GET** `/api/asset-pool/{network}/user/{address}/balance`

获取指定用户在资金池中的余额。

**参数:**
- `network` (path): 网络名称
- `address` (path): 用户地址
- `token` (query, 可选): 代币地址，默认为ETH

**响应示例:**
```json
{
  "success": true,
  "data": {
    "user": "0x1234567890123456789012345678901234567890",
    "token": "0x0000000000000000000000000000000000000000",
    "balance": "25.5",
    "decimals": 18
  }
}
```

### 获取账户ETH余额

**GET** `/api/asset-pool/{network}/balance/{address}`

获取指定账户在区块链上的ETH余额。

**参数:**
- `network` (path): 网络名称
- `address` (path): 账户地址

**响应示例:**
```json
{
  "success": true,
  "data": {
    "address": "0x1234567890123456789012345678901234567890",
    "balance": "1.23456789",
    "token": "ETH"
  }
}
```

## 资金操作

### 用户存款

**POST** `/api/asset-pool/{network}/deposit`

用户向资金池存款。

**参数:**
- `network` (path): 网络名称

**请求体:**
```json
{
  "user": "0x1234567890123456789012345678901234567890",
  "token": "0x0000000000000000000000000000000000000000",
  "amount": "1.5",
  "privateKey": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "network": "arbitrumTestnet",
    "user": "0x1234567890123456789012345678901234567890",
    "token": "0x0000000000000000000000000000000000000000",
    "amount": "1.5"
  }
}
```

### 用户提款

**POST** `/api/asset-pool/{network}/withdraw`

用户从资金池提款。

**参数:**
- `network` (path): 网络名称

**请求体:**
```json
{
  "user": "0x1234567890123456789012345678901234567890",
  "token": "0x0000000000000000000000000000000000000000",
  "amount": "0.5",
  "privateKey": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
}
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "txHash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "network": "arbitrumTestnet",
    "user": "0x1234567890123456789012345678901234567890",
    "token": "0x0000000000000000000000000000000000000000",
    "amount": "0.5"
  }
}
```

## 代币管理

### 检查代币支持状态

**GET** `/api/asset-pool/{network}/token/{token}/supported`

检查指定代币是否在资金池中支持。

**参数:**
- `network` (path): 网络名称
- `token` (path): 代币地址

**响应示例:**
```json
{
  "success": true,
  "data": {
    "token": "0x1234567890123456789012345678901234567890",
    "supported": true
  }
}
```

## 策略管理

### 检查策略授权状态

**GET** `/api/asset-pool/{network}/strategy/{strategy}/authorized`

检查指定策略合约是否已授权。

**参数:**
- `network` (path): 网络名称
- `strategy` (path): 策略合约地址

**响应示例:**
```json
{
  "success": true,
  "data": {
    "strategy": "0x1234567890123456789012345678901234567890",
    "authorized": true
  }
}
```

## 交易管理

### 获取交易详情

**GET** `/api/asset-pool/{network}/transaction/{txHash}`

获取指定交易的详细信息。

**参数:**
- `network` (path): 网络名称
- `txHash` (path): 交易哈希

**响应示例:**
```json
{
  "success": true,
  "data": {
    "hash": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    "from": "0x1234567890123456789012345678901234567890",
    "to": "0xabcdef1234567890abcdef1234567890abcdef12",
    "value": "1.5",
    "gasLimit": "21000",
    "gasPrice": "20 gwei",
    "nonce": 5,
    "data": "0x"
  }
}
```

## 系统状态

### 健康检查

**GET** `/health`

检查API服务是否正常运行。

**响应示例:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### API信息

**GET** `/`

获取API的基本信息和可用端点。

**响应示例:**
```json
{
  "message": "Hermes Service API",
  "version": "1.0.0",
  "endpoints": {
    "health": "/health",
    "assetPool": "/api/asset-pool"
  }
}
```

## 错误码说明

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

## 使用示例

### 1. 检查网络状态
```bash
curl -X GET "http://localhost:9999/api/asset-pool/arbitrumTestnet/status"
```

### 2. 获取用户余额
```bash
curl -X GET "http://localhost:9999/api/asset-pool/arbitrumTestnet/user/0x1234567890123456789012345678901234567890/balance"
```

### 3. 存款操作
```bash
curl -X POST "http://localhost:9999/api/asset-pool/arbitrumTestnet/deposit" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "0x1234567890123456789012345678901234567890",
    "amount": "1.5",
    "privateKey": "your_private_key_here"
  }'
```

## 注意事项

1. **私钥安全**: 在生产环境中，私钥应该通过安全的方式传递，而不是在API请求中明文传输
2. **网络配置**: 确保在调用API前，目标网络的合约已经正确部署
3. **Gas费用**: 所有链上操作都需要支付gas费用，请确保账户有足够的ETH
4. **手续费**: 提款操作会收取0.5%的手续费
5. **最小存款**: 最小存款金额为0.01 ETH
6. **最大资金池规模**: 单个代币的最大资金池规模为1000 ETH 