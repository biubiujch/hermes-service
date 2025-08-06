# API 文档

## 概述

本项目使用装饰器模式构建API，提供了统一的响应格式和错误处理机制。

## 响应格式

所有API响应都遵循以下统一格式：

```typescript
interface ApiResponse<T = any> {
  success: boolean;      // 请求是否成功
  data?: T;             // 响应数据
  message?: string;     // 响应消息
  error?: string;       // 错误信息
  timestamp: number;    // 时间戳
}
```

### 成功响应示例

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "示例数据"
  },
  "message": "操作成功",
  "timestamp": 1703123456789
}
```

### 错误响应示例

```json
{
  "success": false,
  "error": "数据不存在",
  "timestamp": 1703123456789
}
```

### 分页响应示例

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
  "message": "获取数据成功",
  "timestamp": 1703123456789
}
```

## 控制器开发指南

### 1. 创建控制器

```typescript
import { Controller, Get, Post, Put, Delete } from "../decorators";
import { BaseController } from "../baseController";

@Controller("/api/your-prefix")
export class YourController extends BaseController {
  
  @Get()
  async getList(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      // 你的业务逻辑
      const data = await this.getData();
      this.success(data, "获取数据成功");
    } catch (error) {
      this.error(error as Error);
    }
  }
}
```

### 2. 可用的装饰器

- `@Controller(prefix)` - 控制器装饰器，定义路由前缀
- `@Get(path)` - GET请求装饰器
- `@Post(path)` - POST请求装饰器
- `@Put(path)` - PUT请求装饰器
- `@Delete(path)` - DELETE请求装饰器
- `@Patch(path)` - PATCH请求装饰器

### 3. 基础控制器方法

继承 `BaseController` 后，你可以使用以下方法：

```typescript
// 响应方法
this.success(data, message, statusCode);
this.error(error, statusCode);
this.paginated(data, page, limit, total, message);

// 请求数据获取方法
this.getQueryParam(key, defaultValue);
this.getParam(key, defaultValue);
this.getBody<T>();
this.getHeader(key);
```

### 4. 错误处理

系统提供了多种预定义错误类型：

```typescript
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ValidationError 
} from "../error";

// 在控制器中使用
if (!data) {
  throw new NotFoundError("数据不存在");
}
```

## 钱包相关API

### 获取应用配置信息
- **GET** `/api/wallet/config`
- **描述**: 获取应用配置信息，包括手续费收集账户、费率等配置
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "config": {
      "feeCollector": {
        "address": "0x...",
        "configured": true
      },
      "fees": {
        "tradingRate": 0.001,
        "withdrawalRate": 0.0005
      },
      "network": {
        "localNodeUrl": "http://127.0.0.1:8545"
      },
      "contracts": {
        "mockToken": "0x...",
        "vault": "0x...",
        "membership": "0x..."
      }
    },
    "note": "Configuration information for debugging and setup"
  }
}
```

### 获取可用网络列表
- **GET** `/api/wallet/networks`
- **描述**: 获取支持的区块链网络列表
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "networks": [
      {
        "id": 31337,
        "name": "Hardhat Local",
        "rpcUrl": "http://127.0.0.1:8545",
        "chainId": "0x7A69",
        "nativeCurrency": {
          "name": "Ether",
          "symbol": "ETH",
          "decimals": 18
        },
        "blockExplorerUrls": [],
        "isTestnet": true,
        "isLocal": true
      },
      {
        "id": 42161,
        "name": "Arbitrum One",
        "rpcUrl": "https://arb1.arbitrum.io/rpc",
        "chainId": "0xA4B1",
        "nativeCurrency": {
          "name": "Ether",
          "symbol": "ETH",
          "decimals": 18
        },
        "blockExplorerUrls": ["https://arbiscan.io"],
        "isTestnet": false,
        "isLocal": false
      },
      {
        "id": 43114,
        "name": "Avalanche C-Chain",
        "rpcUrl": "https://api.avax.network/ext/bc/C/rpc",
        "chainId": "0xA86A",
        "nativeCurrency": {
          "name": "Avalanche",
          "symbol": "AVAX",
          "decimals": 18
        },
        "blockExplorerUrls": ["https://snowtrace.io"],
        "isTestnet": false,
        "isLocal": false
      },
      {
        "id": 3636,
        "name": "Botanix",
        "rpcUrl": "https://rpc.btxtestchain.com",
        "chainId": "0xE34",
        "nativeCurrency": {
          "name": "Bitcoin",
          "symbol": "BTC",
          "decimals": 18
        },
        "blockExplorerUrls": ["https://testnet.botanixscan.com"],
        "isTestnet": true,
        "isLocal": false
      }
    ],
    "currentNetwork": {
      "chainId": 31337,
      "name": "Hardhat"
    }
  }
}
```

### 获取钱包余额
- **GET** `/api/wallet/balance`
- **描述**: 获取指定钱包地址的ETH和USDT余额
- **请求体**:
```json
{
  "walletAddress": "0x..."
}
```
- **响应示例**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "balances": {
      "eth": "1.5",
      "usdt": "1000.0"
    }
  }
}
```

### 注入资金到钱包（仅本地测试）
- **POST** `/api/wallet/inject-funds`
- **描述**: 向指定钱包注入USDT资金（仅用于本地测试环境）
- **请求体**:
```json
{
  "walletAddress": "0x...",
  "amount": "1000"
}
```
- **响应示例**:
```json
{
  "success": false,
  "message": "Fund injection is only available in local test environment. In production, use frontend wallet connection.",
  "note": "This API should be called from frontend with user wallet signature"
}
```
- **注意**: 此API在生产环境中被禁用，仅用于本地测试

## 示例API

### 示例控制器 API

#### 获取示例列表
- **GET** `/api/example`
- **查询参数**：
  - `page` (可选): 页码，默认1
  - `limit` (可选): 每页数量，默认10

#### 获取单个示例
- **GET** `/api/example/:id`
- **路径参数**：
  - `id`: 示例ID

#### 创建示例
- **POST** `/api/example`
- **请求体**：
```json
{
  "name": "示例名称",
  "description": "示例描述"
}
```

#### 更新示例
- **PUT** `/api/example/:id`
- **路径参数**：
  - `id`: 示例ID
- **请求体**：
```json
{
  "name": "新名称",
  "description": "新描述"
}
```

#### 删除示例
- **DELETE** `/api/example/:id`
- **路径参数**：
  - `id`: 示例ID

#### 搜索示例
- **GET** `/api/example/search`
- **查询参数**：
  - `q`: 搜索关键词

## 注册新控制器

在 `src/api/index.ts` 中注册新的控制器：

```typescript
import { YourController } from "./controllers/yourController";

// 注册控制器
RouteRegistry.registerControllers([
  ExampleController,
  YourController  // 添加你的控制器
]);
```

## 中间件支持

你可以在装饰器中添加中间件：

```typescript
@Get("/protected", [authMiddleware, validationMiddleware])
async protectedMethod(req: Request, res: Response, next: NextFunction) {
  // 这个方法会先经过 authMiddleware 和 validationMiddleware
}
```

## 错误码说明

- `200` - 成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未授权
- `403` - 禁止访问
- `404` - 资源不存在
- `409` - 冲突
- `422` - 验证错误
- `500` - 服务器内部错误
- `501` - 功能未实现（如注入资金API在生产环境中的状态）
