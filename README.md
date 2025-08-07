# Hermora Service

一个基于以太坊的智能资金池管理服务，支持多用户资金池创建、存款、提款和合并操作。

## 功能特性

- 🏦 **智能资金池管理**: 支持用户创建和管理多个资金池
- 🔐 **EIP-712 签名验证**: 确保交易安全性和用户授权
- 💰 **多代币支持**: 支持 ETH 和 ERC20 代币操作
- 📊 **手续费管理**: 自动收取和分配交易手续费
- 🚀 **高性能 API**: 优化的 RESTful API 设计
- 🛡️ **安全防护**: 重复请求防护、超时保护、错误处理

## 技术栈

- **后端**: Node.js + TypeScript + Express
- **区块链**: Ethereum + Hardhat + ethers.js
- **智能合约**: Solidity + OpenZeppelin
- **开发工具**: TypeScript + ESLint + Prettier

## 快速开始

### 环境要求

- Node.js 18+
- pnpm (推荐) 或 npm
- Hardhat 本地节点

### 安装依赖

```bash
pnpm install
```

### 环境配置

复制环境变量模板并配置：

```bash
cp env.example .env
```

编辑 `.env` 文件：

```env
# API 配置
API_PORT=5500

# 区块链配置
VAULT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
MOCK_TOKEN_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
FEE_COLLECTOR_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 网络配置
LOCAL_NODE_URL=http://127.0.0.1:8545
```

### 启动本地区块链

```bash
# 启动 Hardhat 节点
pnpm hardhat node

# 部署合约
pnpm hardhat run scripts/deploy.ts --network localhost
```

### 启动 API 服务

```bash
# 开发模式
pnpm dev

# 生产模式
pnpm build
pnpm start
```

## API 接口

### 资金池管理

- `GET /api/vault/config` - 获取配置信息
- `GET /api/vault/pools/user/:walletAddress` - 获取用户资金池列表
- `GET /api/vault/pools/:poolId` - 获取资金池详情
- `POST /api/vault/pools` - 创建资金池
- `POST /api/vault/pools/:poolId/deposit` - 存款到资金池
- `POST /api/vault/pools/:poolId/withdraw` - 从资金池提款
- `DELETE /api/vault/pools/:poolId` - 删除资金池
- `POST /api/vault/pools/merge` - 合并资金池

### 钱包管理

- `GET /api/wallet/config` - 获取钱包配置
- `GET /api/wallet/networks` - 获取支持的网络
- `GET /api/wallet/balance` - 获取钱包余额
- `POST /api/wallet/inject-funds` - 注入测试资金

### 签名验证

- `GET /api/vault/nonce/:walletAddress` - 获取用户 Nonce
- `GET /api/vault/domain-separator` - 获取 Domain Separator
- `POST /api/vault/verify-signature` - 验证签名

详细的 API 文档请参考 [src/api/README.md](src/api/README.md)

## 智能合约

### 核心合约

- **Vault.sol**: 主要的资金池管理合约
- **MockToken.sol**: 测试用的 ERC20 代币合约

### 合约功能

- 资金池创建和管理
- 存款和提款操作
- 资金池合并
- 手续费收集
- EIP-712 签名验证
- 重放攻击防护

## 项目结构

```
hermora-service/
├── contracts/           # 智能合约
│   ├── Vault.sol       # 资金池管理合约
│   └── MockToken.sol   # 测试代币合约
├── src/
│   ├── api/            # API 服务
│   │   ├── controllers/ # 控制器
│   │   ├── middleware/  # 中间件
│   │   ├── utils/       # 工具类
│   │   └── router/      # 路由配置
│   ├── utils/           # 通用工具
│   └── main.ts          # 应用入口
├── scripts/             # 部署和工具脚本
├── test/                # 测试文件
└── deployments/         # 部署配置
```

## 开发指南

### 代码规范

- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 代码规范
- 使用装饰器进行路由注册
- 统一的错误处理和响应格式

### 测试

```bash
# 运行单元测试
pnpm test

# 运行特定测试
pnpm test Vault.test.ts
```

### 部署

```bash
# 部署到本地网络
pnpm hardhat run scripts/deploy.ts --network localhost

# 部署到测试网
pnpm hardhat run scripts/deploy.ts --network arbitrumGoerli
```

## 安全特性

- **EIP-712 签名验证**: 防止未授权操作
- **Nonce 机制**: 防止重放攻击
- **Deadline 检查**: 确保签名时效性
- **重复请求防护**: 防止重复交易
- **输入验证**: 严格的参数验证
- **错误处理**: 安全的错误响应

## 性能优化

- **异步初始化**: 合约实例异步初始化
- **超时保护**: 请求和交易级别超时
- **缓存机制**: 智能的请求缓存
- **日志优化**: 减少不必要的日志输出
- **错误恢复**: 优雅的错误处理

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持

如果您遇到问题或有建议，请：

1. 查看 [API 文档](src/api/README.md)
2. 检查 [问题追踪器](../../issues)
3. 联系开发团队

## 更新日志

### v1.0.0
- 初始版本发布
- 支持基本的资金池管理功能
- EIP-712 签名验证
- RESTful API 接口
- 完整的错误处理和日志记录