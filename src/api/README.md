# API 服务文档

## 概述

API 服务采用分层架构设计，提供区块链资金池管理的完整功能。支持 EIP-712 签名验证，确保交易安全性。

## 架构设计

### 目录结构

```
src/api/
├── middleware/                    # 中间件
│   ├── duplicateRequestHandler.ts # 重复请求处理
│   └── errorHandler.ts           # 全局错误处理
├── utils/                        # 工具类
│   ├── errors.ts                 # 错误类定义
│   └── responseHandler.ts        # 响应格式化工具
├── controllers/                  # 控制器
│   ├── exampleController.ts      # 示例接口
│   ├── walletController.ts       # 钱包相关接口
│   └── vaultController.ts        # 资金池管理接口
├── router/                       # 路由配置
├── decorators.ts                 # 路由装饰器
├── baseController.ts             # 基础控制器类
├── exports.ts                    # 模块导出
└── index.ts                      # API 入口点
```

### 类层次结构

```
BaseController (基础控制器)
├── 请求上下文管理
├── 响应方法 (success, error, paginated)
├── 参数获取 (getParam, getQueryParam, getBody)
└── 错误处理

ContractController (合约控制器基类)
├── 继承 BaseController
├── Provider 和 Signer 管理
├── 合约实例创建
└── 地址验证

具体控制器
├── VaultController (继承 ContractController)
├── WalletController (继承 ContractController)
└── ExampleController (继承 BaseController)
```

## 响应格式

### 成功响应
```json
{
  "success": true,
  "data": {...},
  "message": "Success",
  "timestamp": 1754588348741
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误信息",
  "timestamp": 1754588348741
}
```

### 分页响应
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  },
  "message": "Success",
  "timestamp": 1754588348741
}
```

## API 接口

### 资金池管理接口 (VaultController)

#### 获取配置信息
```http
GET /api/vault/config
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "maxPoolsPerUser": 10,
    "minPoolBalance": "0.001",
    "feeRate": 5,
    "feeCollector": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "vaultAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "mockTokenAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
  }
}
```

#### 获取用户资金池列表
```http
GET /api/vault/pools/user/:walletAddress
```

**参数：**
- `walletAddress` (路径参数): 钱包地址

**响应示例：**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "pools": [
      {
        "id": 1,
        "owner": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "totalBalance": "0.1",
        "isActive": true,
        "createdAt": 1754588348,
        "lastActivityAt": 1754588348
      }
    ],
    "totalPools": 1
  }
}
```

#### 获取资金池详情
```http
GET /api/vault/pools/:poolId
```

**参数：**
- `poolId` (路径参数): 资金池ID

#### 创建资金池
```http
POST /api/vault/pools
```

**请求体：**
```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "initialAmount": "0.1",
  "tokenAddress": "0x0000000000000000000000000000000000000000",
  "nonce": 7,
  "deadline": 1754593638,
  "signature": "0x9b5b67dc4eda43d58249e8ca0c3d08fb7f18abd97781b59ccbe958f363fe0c4a45577011498d9b497f37bccee90924c7a34a13852129c0d083b52889ea7ed8c61c"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "poolId": 1,
    "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "initialAmount": "0.1",
    "transactionHash": "0x0e7020afcd32d830cb424de9c186734a8b4d9212b990afe923d92f90456eaa49",
    "message": "Pool created successfully"
  }
}
```

#### 存款到资金池
```http
POST /api/vault/pools/:poolId/deposit
```

**参数：**
- `poolId` (路径参数): 资金池ID

**请求体：**
```json
{
  "walletAddress": "0xe13B97DA8D53CD4456f215526635d0Db35CFB658",
  "amount": "10",
  "tokenAddress": "0x0000000000000000000000000000000000000000",
  "nonce": 1,
  "deadline": 1754593339,
  "signature": "0x5262072af9b2ff90ee238cd63c3af5021ef97d25f3e082e2f4028743d20f48327f560fa7f1436672d4759981d84ec5e11f0d8482c8443281ede38f6801375cb41c"
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "poolId": 4,
    "walletAddress": "0xe13B97DA8D53CD4456f215526635d0Db35CFB658",
    "amount": "10",
    "transactionHash": "0x8673a14ebd6da894b25146d4d77660e9ddfb68b40fe7e39de33941d585cd0ec9",
    "message": "Deposit successful"
  }
}
```

#### 从资金池提款
```http
POST /api/vault/pools/:poolId/withdraw
```

**参数：**
- `poolId` (路径参数): 资金池ID

**请求体：**
```json
{
  "walletAddress": "0xe13B97DA8D53CD4456f215526635d0Db35CFB658",
  "amount": "5",
  "tokenAddress": "0x0000000000000000000000000000000000000000",
  "nonce": 2,
  "deadline": 1754593339,
  "signature": "0x..."
}
```

#### 删除资金池
```http
DELETE /api/vault/pools/:poolId
```

**参数：**
- `poolId` (路径参数): 资金池ID

**请求体：**
```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "nonce": 8,
  "deadline": 1754593638,
  "signature": "0x..."
}
```

#### 合并资金池
```http
POST /api/vault/pools/merge
```

**请求体：**
```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "targetPoolId": 1,
  "sourcePoolId": 2,
  "nonce": 9,
  "deadline": 1754593638,
  "signature": "0x..."
}
```

#### 获取用户 Nonce
```http
GET /api/vault/nonce/:walletAddress
```

**参数：**
- `walletAddress` (路径参数): 钱包地址

**响应示例：**
```json
{
  "success": true,
  "data": {
    "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "nonce": 7
  }
}
```

#### 获取 Domain Separator
```http
GET /api/vault/domain-separator
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "domainSeparator": "0xbaaeaac73154471759385fda41508b2779494c5113a72fd8f6e589bc94e61faf"
  }
}
```

#### 验证签名
```http
POST /api/vault/verify-signature
```

**请求体：**
```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "messageHash": "0x...",
  "signature": "0x..."
}
```

### 钱包管理接口 (WalletController)

#### 获取钱包配置
```http
GET /api/wallet/config
```

#### 获取支持的网络
```http
GET /api/wallet/networks
```

#### 获取钱包余额
```http
GET /api/wallet/balance?walletAddress=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

**参数：**
- `walletAddress` (查询参数): 钱包地址

#### 注入测试资金
```http
POST /api/wallet/inject-funds
```

**请求体：**
```json
{
  "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "amount": "1.0"
}
```

### 示例接口 (ExampleController)

#### 获取示例列表
```http
GET /api/example?page=1&limit=10
```

#### 搜索示例
```http
GET /api/example/search?q=关键词
```

#### 获取示例详情
```http
GET /api/example/:id
```

#### 创建示例
```http
POST /api/example
```

#### 更新示例
```http
PUT /api/example/:id
```

#### 删除示例
```http
DELETE /api/example/:id
```

## EIP-712 签名

### Domain 定义
```typescript
const domain = {
  name: 'Hermora Vault',
  version: '1',
  chainId: 31337, // Hardhat 本地网络
  verifyingContract: VAULT_ADDRESS
};
```

### 类型定义

#### CreatePool
```typescript
const CREATE_POOL_TYPE = {
  CreatePool: [
    { name: 'walletAddress', type: 'address' },
    { name: 'initialAmount', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};
```

#### Deposit
```typescript
const DEPOSIT_TYPE = {
  Deposit: [
    { name: 'walletAddress', type: 'address' },
    { name: 'poolId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};
```

### 签名生成示例
```typescript
import { ethers } from "ethers";

const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const message = {
  walletAddress: WALLET_ADDRESS,
  initialAmount: ethers.parseEther("0.1"),
  tokenAddress: ethers.ZeroAddress,
  nonce: 7,
  deadline: Math.floor(Date.now() / 1000) + 3600
};

const signature = await wallet.signTypedData(domain, CREATE_POOL_TYPE, message);
```

## 错误处理

### 错误类型
- `BadRequestError` (400) - 请求参数错误
- `UnauthorizedError` (401) - 未授权
- `NotFoundError` (404) - 资源不存在
- `ValidationError` (422) - 数据验证失败
- `InternalServerError` (500) - 服务器内部错误

### 常见错误
- `InvalidSignature()` - 签名验证失败
- `InvalidNonce()` - Nonce 不匹配
- `ExpiredSignature()` - 签名已过期
- `PoolNotFound()` - 资金池不存在
- `PoolNotOwned()` - 资金池不属于该用户
- `MaxPoolsReached()` - 达到最大资金池数量
- `InsufficientBalance()` - 余额不足

## 中间件

### 重复请求处理
- 防止重复的写操作请求
- 只对 POST、PUT、DELETE、PATCH 方法生效
- 1秒超时，5秒清理间隔

### 全局错误处理
- 统一的错误响应格式
- 自动日志记录
- 支持自定义错误类型

### 请求超时
- 30秒请求超时保护
- 自动清理超时定时器

## 开发指南

### 创建新控制器
```typescript
import { Controller, Get, Post } from "../decorators";
import { BaseController } from "../baseController";

@Controller("/api/example")
export class ExampleController extends BaseController {
  @Get("/test")
  async test(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      this.success({ message: "Hello World" });
    } catch (error) {
      this.error(error as Error);
    }
  }
}
```

### 创建合约控制器
```typescript
import { ContractController } from "../baseController";

@Controller("/api/contract")
export class ContractController extends ContractController {
  private contract: ethers.Contract | null = null;

  constructor() {
    super();
    this.initializeContract();
  }

  private async initializeContract() {
    this.contract = await this.createContract(ADDRESS, ABI);
  }
}
```

## 配置要求

### 环境变量
```env
API_PORT=5500
VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
MOCK_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
FEE_COLLECTOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### 网络配置
- 本地 Hardhat 节点: `http://127.0.0.1:8545`
- 链 ID: 31337
- 支持的网络: Hardhat Local, Arbitrum One, Avalanche C-Chain, Botanix

## 性能优化

1. **异步初始化**: 合约实例异步初始化，避免阻塞
2. **超时保护**: 请求和交易级别的超时保护
3. **重复请求处理**: 防止重复的写操作
4. **错误缓存**: 统一的错误处理和响应格式
5. **日志优化**: 减少不必要的日志输出 