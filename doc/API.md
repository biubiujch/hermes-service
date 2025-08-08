# Hermora API Documentation

## Overview

The Hermora API is built using a decorator pattern with unified response formats and error handling. It supports EIP-712 signature verification for secure blockchain transactions.

## Architecture

### Controller Hierarchy

```
BaseController (Base Controller)
├── Request context management
├── Response methods (success, error, paginated)
├── Parameter extraction (getParam, getQueryParam, getBody)
└── Error handling

ContractController (Contract Controller Base)
├── Inherits BaseController
├── Provider and Signer management
├── Contract instance creation
└── Address validation

Specific Controllers
├── VaultController (inherits ContractController)
├── WalletController (inherits ContractController)
├── StrategyController (inherits ContractController)
└── ExampleController (inherits BaseController)
```

## Response Format

All API responses follow this unified format:

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

## API Endpoints

### Example Controller (`/api/example`)

#### Search Examples
- **GET** `/api/example/search`
- **Query Parameters**:
  - `q` (required): Search keyword
- **Response**: Array of matching examples

#### Get All Examples
- **GET** `/api/example`
- **Query Parameters**:
  - `page` (optional): Page number, default 1
  - `limit` (optional): Items per page, default 10
- **Response**: Paginated list of examples

#### Get Example by ID
- **GET** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID
- **Response**: Single example object

#### Create Example
- **POST** `/api/example`
- **Request Body**:
```json
{
  "name": "Example Name",
  "description": "Example Description"
}
```

#### Update Example
- **PUT** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID
- **Request Body**: Same as create

#### Delete Example
- **DELETE** `/api/example/:id`
- **Path Parameters**:
  - `id`: Example ID

### Wallet Controller (`/api/wallet`)

#### Get Configuration
- **GET** `/api/wallet/config`
- **Description**: Get application configuration including fee collector, rates, etc.
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
        "strategyRegistry": "0x..."
      }
    }
  }
}
```

#### Get Supported Networks
- **GET** `/api/wallet/networks`
- **Description**: Get list of supported blockchain networks
- **Response**: Array of network configurations with chain IDs, RPC URLs, etc.

#### Get Wallet Balance
- **GET** `/api/wallet/balance`
- **Query Parameters**:
  - `walletAddress` (required): Ethereum wallet address
- **Response Example**:
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

#### Inject Test Funds
- **POST** `/api/wallet/inject-funds`
- **Description**: Inject USDT funds to wallet (local test only)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "amount": "1000"
}
```

### Vault Controller (`/api/vault`)

#### Get Vault Configuration
- **GET** `/api/vault/config`
- **Description**: Get vault configuration including max pools, fee rates, etc.
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "maxPoolsPerUser": 10,
    "minPoolBalance": "0.001",
    "feeRate": 5,
    "feeCollector": "0x...",
    "vaultAddress": "0x...",
    "mockTokenAddress": "0x..."
  }
}
```

#### Get User Pools
- **GET** `/api/vault/pools/user/:walletAddress`
- **Path Parameters**:
  - `walletAddress`: Wallet address
- **Response**: Array of user's pools

#### Get Pool Details
- **GET** `/api/vault/pools/:poolId`
- **Path Parameters**:
  - `poolId`: Pool ID
- **Response**: Single pool object

#### Create Pool
- **POST** `/api/vault/pools`
- **Description**: Create new pool with initial funds (requires EIP-712 signature)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "initialAmount": "1.0",
  "tokenAddress": "0x...",
  "nonce": 0,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

#### Delete Pool
- **DELETE** `/api/vault/pools/:poolId`
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

#### Merge Pools
- **PUT** `/api/vault/pools/merge`
- **Description**: Merge two pools owned by same user
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

#### Deposit to Pool
- **POST** `/api/vault/pools/:poolId/deposit`
- **Path Parameters**:
  - `poolId`: Pool ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "amount": "0.5",
  "tokenAddress": "0x...",
  "nonce": 3,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

#### Withdraw from Pool
- **POST** `/api/vault/pools/:poolId/withdraw`
- **Path Parameters**:
  - `poolId`: Pool ID
- **Request Body**: Same as deposit

#### Get Token Approval Status
- **GET** `/api/vault/token/approval/:walletAddress/:tokenAddress`
- **Path Parameters**:
  - `walletAddress`: Wallet address
  - `tokenAddress`: Token address
- **Response**: Balance, allowance, and approval status

#### Get User Nonce
- **GET** `/api/vault/nonce/:walletAddress`
- **Path Parameters**:
  - `walletAddress`: Wallet address
- **Response**: Current nonce for signature verification

#### Get Domain Separator
- **GET** `/api/vault/domain-separator`
- **Response**: EIP-712 domain separator for vault operations

#### Verify Signature
- **POST** `/api/vault/verify-signature`
- **Description**: Verify EIP-712 signature
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "message": "Hello World",
  "signature": "0x..."
}
```

### Strategy Controller (`/api/strategy`)

#### Get Strategy Configuration
- **GET** `/api/strategy/config`
- **Description**: Get strategy system configuration
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "maxStrategiesPerUser": 50,
    "nextStrategyId": 1,
    "domainSeparator": "0x...",
    "strategyRegistryAddress": "0x...",
    "eip712Domain": {
      "name": "Hermora Strategy",
      "version": "1",
      "chainId": 31337,
      "verifyingContract": "0x..."
    }
  }
}
```

#### Get User Strategies
- **GET** `/api/strategy/user/:walletAddress`
- **Path Parameters**:
  - `walletAddress`: Wallet address
- **Response**: Array of user's strategies with parameters

#### Get Strategy Details
- **GET** `/api/strategy/:strategyId`
- **Path Parameters**:
  - `strategyId`: Strategy ID
- **Response**: Single strategy with parameters

#### Register Strategy
- **POST** `/api/strategy/register`
- **Description**: Register new strategy (requires EIP-712 signature)
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "params": {
    "symbol": "ETH",
    "leverage": 3,
    "takeProfit": 0.05,
    "stopLoss": 0.02,
    "amountLimit": "1000 USDT",
    "maxDrawdown": 0.1,
    "freq": "1h",
    "riskLevel": "medium"
  },
  "symbol": "ETH",
  "nonce": 0,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

#### Update Strategy
- **PUT** `/api/strategy/:strategyId`
- **Path Parameters**:
  - `strategyId`: Strategy ID
- **Request Body**: Same as register but without symbol field

#### Set Strategy Active Status
- **PUT** `/api/strategy/:strategyId/active`
- **Path Parameters**:
  - `strategyId`: Strategy ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "active": false,
  "nonce": 2,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

#### Delete Strategy
- **DELETE** `/api/strategy/:strategyId`
- **Path Parameters**:
  - `strategyId`: Strategy ID
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "nonce": 3,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

#### Get User Nonce
- **GET** `/api/strategy/nonce/:walletAddress`
- **Path Parameters**:
  - `walletAddress`: Wallet address
- **Response**: Current nonce for strategy operations

#### Get Domain Separator
- **GET** `/api/strategy/domain-separator`
- **Response**: EIP-712 domain separator for strategy operations

#### Verify Signature
- **POST** `/api/strategy/verify-signature`
- **Description**: Verify strategy EIP-712 signature
- **Request Body**:
```json
{
  "walletAddress": "0x...",
  "params": {
    "symbol": "ETH",
    "leverage": 3
  },
  "symbol": "ETH",
  "nonce": 0,
  "deadline": 1234567890,
  "signature": "0x..."
}
```

## EIP-712 Signature Verification

### Vault Domain
```typescript
const domain = {
  name: 'Hermora Vault',
  version: '1',
  chainId: 31337,
  verifyingContract: VAULT_ADDRESS
};
```

### Strategy Domain
```typescript
const domain = {
  name: 'Hermora Strategy',
  version: '1',
  chainId: 31337,
  verifyingContract: STRATEGY_REGISTRY_ADDRESS
};
```

### Signature Types

#### Vault Operations
```typescript
const types = {
  CreatePool: [
    { name: 'walletAddress', type: 'address' },
    { name: 'initialAmount', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  DeletePool: [
    { name: 'walletAddress', type: 'address' },
    { name: 'poolId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  Deposit: [
    { name: 'walletAddress', type: 'address' },
    { name: 'poolId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  Withdraw: [
    { name: 'walletAddress', type: 'address' },
    { name: 'poolId', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};
```

#### Strategy Operations
```typescript
const types = {
  CreateStrategy: [
    { name: 'walletAddress', type: 'address' },
    { name: 'paramsHash', type: 'bytes32' },
    { name: 'symbol', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  UpdateStrategy: [
    { name: 'walletAddress', type: 'address' },
    { name: 'strategyId', type: 'uint256' },
    { name: 'paramsHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  SetStrategyActive: [
    { name: 'walletAddress', type: 'address' },
    { name: 'strategyId', type: 'uint256' },
    { name: 'active', type: 'bool' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ],
  DeleteStrategy: [
    { name: 'walletAddress', type: 'address' },
    { name: 'strategyId', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }
  ]
};
```

## Frontend Integration Example

### Signature Flow
```typescript
import { ethers } from 'ethers';

// 1. Get nonce
const nonceResponse = await fetch(`/api/vault/nonce/${walletAddress}`);
const { nonce } = await nonceResponse.json();

// 2. Get domain separator
const domainResponse = await fetch('/api/vault/domain-separator');
const { domainSeparator } = await domainResponse.json();

// 3. Construct message
const deadline = Math.floor(Date.now() / 1000) + 3600;
const message = {
  walletAddress: walletAddress,
  initialAmount: ethers.parseEther('1.0'),
  tokenAddress: ethers.ZeroAddress,
  nonce: nonce,
  deadline: deadline
};

// 4. Sign message
const signature = await wallet.signTypedData(domain, types, message);

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

## Error Handling

### Common Errors
- `InvalidSignature()` - Signature verification failed
- `InvalidNonce()` - Nonce mismatch
- `ExpiredSignature()` - Signature expired
- `PoolNotFound()` - Pool not found
- `PoolNotOwned()` - Pool not owned by user
- `MaxPoolsReached()` - Maximum pools reached
- `InsufficientBalance()` - Insufficient balance
- `StrategyNotFound()` - Strategy not found
- `StrategyNotOwned()` - Strategy not owned by user

### Error Response Format
```json
{
  "success": false,
  "error": "Error description",
  "timestamp": 1703123456789
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `500` - Internal Server Error
- `501` - Not Implemented

## Performance Features

1. **Async Initialization**: Contract instances initialize asynchronously
2. **Timeout Protection**: Request and transaction-level timeout protection
3. **Duplicate Request Handling**: Prevents duplicate write operations
4. **Memory Caching**: Strategy parameters cached in memory for fast access
5. **Async File Operations**: Non-blocking file I/O for strategy storage
6. **Batch Processing**: Write operations batched for better performance

## Storage Architecture

### Strategy Parameters
- **On-chain**: Strategy metadata (ID, owner, symbol, paramsHash, status)
- **Off-chain**: Complete strategy parameters (JSON files + memory cache)
- **Content-addressed**: Files named by parameter hash for integrity
- **Dual backup**: Main storage + backup storage directories
- **IPFS ready**: Prepared for future web3.storage integration
