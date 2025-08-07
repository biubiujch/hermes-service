# API Documentation

## Overview

This project uses decorator pattern to build APIs, providing unified response format and error handling mechanism.

## Response Format

All API responses follow the following unified format:

```typescript
interface ApiResponse<T = any> {
  success: boolean;      // Whether the request was successful
  data?: T;             // Response data
  message?: string;     // Response message
  error?: string;       // Error message
  timestamp: number;    // Timestamp
}
```

### Success Response Example

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Example Data"
  },
  "message": "Operation successful",
  "timestamp": 1703123456789
}
```

### Error Response Example

```json
{
  "success": false,
  "error": "Data not found",
  "timestamp": 1703123456789
}
```

### Pagination Response Example

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
  "message": "Data retrieved successfully",
  "timestamp": 1703123456789
}
```

## Controller Development Guide

### 1. Create Controller

```typescript
import { Controller, Get, Post, Put, Delete } from "../decorators";
import { BaseController } from "../baseController";

@Controller("/api/your-prefix")
export class YourController extends BaseController {
  
  @Get()
  async getList(req: Request, res: Response, next: NextFunction) {
    this.setContext(req, res, next);
    
    try {
      // Your business logic
      const data = await this.getData();
      this.success(data, "Data retrieved successfully");
    } catch (error) {
      this.error(error as Error);
    }
  }
}
```

### 2. Available Decorators

- `@Controller(prefix)` - Controller decorator, defines route prefix
- `@Get(path)` - GET request decorator
- `@Post(path)` - POST request decorator
- `@Put(path)` - PUT request decorator
- `@Delete(path)` - DELETE request decorator
- `@Patch(path)` - PATCH request decorator

### 3. Base Controller Methods

After inheriting `BaseController`, you can use the following methods:

```typescript
// Response methods
this.success(data, message, statusCode);
this.error(error, statusCode);
this.paginated(data, page, limit, total, message);

// Request data retrieval methods
this.getQueryParam(key, defaultValue);
this.getParam(key, defaultValue);
this.getBody<T>();
this.getHeader(key);
```

### 4. Error Handling

The system provides various predefined error types:

```typescript
import { 
  BadRequestError, 
  UnauthorizedError, 
  NotFoundError,
  ValidationError 
} from "../error";

// Usage in controller
if (!data) {
  throw new NotFoundError("Data not found");
}
```

## Wallet Related APIs

### Get Application Configuration
- **GET** `/api/wallet/config`
- **Description**: Get application configuration information, including fee collector account, rates, etc.
- **Response Example**:
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

### Get Available Networks
- **GET** `/api/wallet/networks`
- **Description**: Get list of supported blockchain networks
- **Response Example**:
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

### Get Wallet Balance
- **GET** `/api/wallet/balance`
- **Description**: Get ETH and USDT balance for specified wallet address
- **Query Parameters**:
  - `walletAddress` (required): Wallet address, must be a valid Ethereum address
- **Request Example**:
  ```
  GET /api/wallet/balance?walletAddress=0xe13B97DA8D53CD4456f215526635d0Db35CFB658
  ```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0xe13B97DA8D53CD4456f215526635d0Db35CFB658",
    "balances": {
      "eth": "1.5",
      "usdt": "1000.0"
    }
  }
}
```
- **Error Response Example**:
```json
{
  "success": false,
  "error": "Invalid wallet address",
  "timestamp": 1703123456789
}
```

### Inject Funds to Wallet (Local Test Only)
- **POST** `/api/wallet/inject-funds`
- **Description**: Inject USDT funds to specified wallet (only for local test environment)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "amount": "1000"
}
```
- **Response Example**:
```json
{
  "success": false,
  "message": "Fund injection is only available in local test environment. In production, use frontend wallet connection.",
  "note": "This API should be called from frontend with user wallet signature"
}
```
- **Note**: This API is disabled in production environment, only for local testing

## Vault (资金池) Related APIs

### Get Vault Configuration
- **GET** `/api/vault/config`
- **Description**: Get vault configuration information including max pools per user, fee rates, etc.
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "maxPoolsPerUser": 10,
    "minPoolBalance": "0.001",
    "feeRate": 5,
    "feeCollector": "0x...",
    "supportedTokens": {
      "mockToken": "0x...",
      "isSupported": true
    }
  }
}
```

### Get User Pools
- **GET** `/api/vault/pools/user/:walletAddress`
- **Description**: Get all pools owned by a specific wallet address
- **Path Parameters**:
  - `walletAddress` (required): Wallet address
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "totalPools": 2,
    "pools": [
      {
        "id": 1,
        "owner": "0x...",
        "totalBalance": "1.5",
        "isActive": true,
        "createdAt": 1703123456,
        "lastActivityAt": 1703123456
      }
    ]
  }
}
```

### Get Pool Details
- **GET** `/api/vault/pools/:poolId`
- **Description**: Get detailed information about a specific pool
- **Path Parameters**:
  - `poolId`: Pool ID
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "owner": "0x...",
    "totalBalance": "1.5",
    "isActive": true,
    "createdAt": 1703123456,
    "lastActivityAt": 1703123456
  }
}
```

### Create Pool
- **POST** `/api/vault/pools`
- **Description**: Create a new pool with initial funds (requires signature verification)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "initialAmount": "1.0",
  "tokenAddress": "0x...", // Optional, defaults to ETH
  "nonce": 0,
  "deadline": 1234567890,
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "poolId": 1,
    "walletAddress": "0x...",
    "initialAmount": "1.0",
    "transactionHash": "0x...",
    "message": "Pool created successfully"
  }
}
```

### Delete Pool
- **DELETE** `/api/vault/pools/:poolId`
- **Description**: Delete a pool and withdraw all funds (requires signature verification)
- **Path Parameters**:
  - `poolId`: Pool ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "nonce": 1,
  "deadline": 1234567890,
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "poolId": 1,
    "walletAddress": "0x...",
    "transactionHash": "0x...",
    "message": "Pool deleted successfully"
  }
}
```

### Merge Pools
- **PUT** `/api/vault/pools/merge`
- **Description**: Merge two pools owned by the same user (requires signature verification)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "targetPoolId": 1,
  "sourcePoolId": 2,
  "nonce": 2,
  "deadline": 1234567890,
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "targetPoolId": 1,
    "sourcePoolId": 2,
    "walletAddress": "0x...",
    "transactionHash": "0x...",
    "message": "Pools merged successfully"
  }
}
```

### Deposit Funds
- **POST** `/api/vault/pools/:poolId/deposit`
- **Description**: Deposit funds into a pool (requires signature verification)
- **Path Parameters**:
  - `poolId`: Pool ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "amount": "0.5",
  "tokenAddress": "0x...", // Optional, defaults to ETH
  "nonce": 3,
  "deadline": 1234567890,
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "poolId": 1,
    "walletAddress": "0x...",
    "amount": "0.5",
    "tokenAddress": "0x0000000000000000000000000000000000000000",
    "transactionHash": "0x...",
    "message": "Deposit successful"
  }
}
```

### Withdraw Funds
- **POST** `/api/vault/pools/:poolId/withdraw`
- **Description**: Withdraw funds from a pool with fee deduction (requires signature verification)
- **Path Parameters**:
  - `poolId`: Pool ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "amount": "0.5",
  "tokenAddress": "0x...", // Optional, defaults to ETH
  "nonce": 4,
  "deadline": 1234567890,
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "poolId": 1,
    "walletAddress": "0x...",
    "amount": "0.5",
    "tokenAddress": "0x0000000000000000000000000000000000000000",
    "transactionHash": "0x...",
    "message": "Withdrawal successful"
  }
}
```

### Get Token Approval Status
- **GET** `/api/vault/token/approval/:walletAddress/:tokenAddress`
- **Description**: Check token approval status for vault operations
- **Path Parameters**:
  - `walletAddress` (required): Wallet address
  - `tokenAddress` (required): Token address
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "tokenAddress": "0x...",
    "balance": "1000.0",
    "allowance": "500.0",
    "needsApproval": false
  }
}
```
- **Note**: `needsApproval` is `true` when `allowance` is 0, indicating that the vault contract needs approval to spend tokens on behalf of the user.

## Signature Verification APIs

### Get User Nonce
- **GET** `/api/vault/nonce/:walletAddress`
- **Description**: Get current nonce for a wallet address (used for signature verification)
- **Path Parameters**:
  - `walletAddress` (required): Wallet address
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "nonce": 5
  }
}
```

### Get Domain Separator
- **GET** `/api/vault/domain-separator`
- **Description**: Get EIP-712 domain separator for signature verification
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "domainSeparator": "0x..."
  }
}
```

### Verify Signature
- **POST** `/api/vault/verify-signature`
- **Description**: Verify a message signature
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "message": "Hello World",
  "signature": "0x..."
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "walletAddress": "0x...",
    "message": "Hello World",
    "signature": "0x...",
    "isValid": true,
    "recoveredAddress": "0x..."
  }
}
```



## Frontend Integration Guide

### Signature Flow

1. **Get Nonce**: Call `/api/vault/nonce?walletAddress=0x...` to get current nonce
2. **Get Domain Separator**: Call `/api/vault/domain-separator` to get EIP-712 domain separator
3. **Construct Message**: Create EIP-712 typed data structure
4. **Sign Message**: Use wallet to sign the message
5. **Submit Transaction**: Call the appropriate API with signature

### Example Frontend Code

```typescript
import { ethers } from 'ethers';

// 1. Get nonce
const nonceResponse = await fetch(`/api/vault/nonce/${walletAddress}`);
const { nonce } = await nonceResponse.json();

// 2. Get domain separator
const domainResponse = await fetch('/api/vault/domain-separator');
const { domainSeparator } = await domainResponse.json();

// 3. Construct EIP-712 message
const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const message = {
  types: {
    CreatePool: [
      { name: 'walletAddress', type: 'address' },
      { name: 'initialAmount', type: 'uint256' },
      { name: 'tokenAddress', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  },
  primaryType: 'CreatePool',
  domain: {
    name: 'Hermora Vault',
    version: '1',
    chainId: chainId,
    verifyingContract: vaultAddress
  },
  message: {
    walletAddress: walletAddress,
    initialAmount: ethers.parseEther('1.0'),
    tokenAddress: ethers.ZeroAddress,
    nonce: nonce,
    deadline: deadline
  }
};

// 4. Sign message
const signature = await signer._signTypedData(
  message.domain,
  { CreatePool: message.types.CreatePool },
  message.message
);

// 5. Submit transaction
const response = await fetch('/api/vault/pools', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress,
    initialAmount: '1.0',
    tokenAddress: ethers.ZeroAddress,
    nonce,
    deadline,
    signature
  })
});
```

## Example APIs

### Example Controller APIs

#### Get Example List
- **GET** `/api/example`
- **Query Parameters**:
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 10
- **Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Example Name",
      "description": "Example Description"
    }
  ],
  "message": "Example data retrieved successfully",
  "timestamp": 1703123456789
}
```

#### Get Single Example
- **GET** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Example Name",
    "description": "Example Description"
  },
  "message": "Example data retrieved successfully",
  "timestamp": 1703123456789
}
```
- **Error Response Example**:
```json
{
  "success": false,
  "error": "Example data not found",
  "timestamp": 1703123456789
}
```

#### Create Example
- **POST** `/api/example`
- **Request Body**:
```json
{
  "name": "Example Name",
  "description": "Example Description"
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Example Name",
    "description": "Example Description"
  },
  "message": "Example data created successfully",
  "timestamp": 1703123456789
}
```
- **Error Response Example**:
```json
{
  "success": false,
  "error": "Name and description cannot be empty",
  "timestamp": 1703123456789
}
```

#### Update Example
- **PUT** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID
- **Request Body**:
```json
{
  "name": "Updated Name",
  "description": "Updated Description"
}
```
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Name",
    "description": "Updated Description"
  },
  "message": "Example data updated successfully",
  "timestamp": 1703123456789
}
```
- **Error Response Example**:
```json
{
  "success": false,
  "error": "Example data not found",
  "timestamp": 1703123456789
}
```

#### Delete Example
- **DELETE** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Example Name",
    "description": "Example Description"
  },
  "message": "Example data deleted successfully",
  "timestamp": 1703123456789
}
```
- **Error Response Example**:
```json
{
  "success": false,
  "error": "Example data not found",
  "timestamp": 1703123456789
}
```

#### Search Examples
- **GET** `/api/example/search`
- **Query Parameters**:
  - `q`: Search keyword
- **Request Example**:
  ```
  GET /api/example/search?q=example
  ```
- **Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Example Name",
      "description": "Example Description"
    }
  ],
  "message": "Search completed successfully",
  "timestamp": 1703123456789
}
```

## Register New Controller

Register new controllers in `src/api/index.ts`:

```typescript
import { YourController } from "./controllers/yourController";

// Register controllers
RouteRegistry.registerControllers([
  ExampleController,
  YourController  // Add your controller
]);
```

## Middleware Support

You can add middleware in decorators:

```typescript
@Get("/protected", [authMiddleware, validationMiddleware])
async protectedMethod(req: Request, res: Response, next: NextFunction) {
  // This method will go through authMiddleware and validationMiddleware first
}
```

## Status Code Reference

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `500` - Internal Server Error
- `501` - Not Implemented (e.g., fund injection API in production environment)
