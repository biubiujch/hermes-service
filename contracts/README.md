# 🏗️ Hermora 合约架构

本项目采用模块化合约架构，支持用户资金管理、会员系统和策略执行。

## 📋 合约列表

### 1. MockToken.sol
测试代币合约，用于本地链测试。

**功能特性：**
- ERC20标准代币
- 支持铸造和销毁
- 可配置小数位数
- 仅限owner铸造

**部署参数：**
- `name`: 代币名称
- `symbol`: 代币符号  
- `decimals`: 小数位数
- `initialOwner`: 初始拥有者地址

### 2. Vault.sol
用户资金池管理合约。

**功能特性：**
- 用户资金充值/提现
- 手续费自动收取
- 支持多种代币
- 策略执行器资金调用接口
- 管理员配置功能

**核心方法：**
- `deposit(token, amount)`: 充值资金
- `withdraw(token, amount)`: 提现资金
- `getBalance(user)`: 查询用户余额
- `deductForStrategy(user, amount)`: 策略扣除资金
- `addForStrategy(user, amount)`: 策略添加资金

### 3. Membership.sol
会员订阅与权限管理合约。

**功能特性：**
- 月度/年度/永久会员订阅
- USDT支付支持
- 会员状态查询
- 管理员权限管理

**核心方法：**
- `subscribeMonthly()`: 订阅月度会员
- `subscribeYearly()`: 订阅年度会员
- `subscribePermanent()`: 订阅永久会员
- `isActiveMember(user)`: 检查会员状态
- `getMemberInfo(user)`: 获取会员信息

## 🚀 部署流程

### 1. 编译合约
```bash
pnpm run compile
```

### 2. 运行测试
```bash
pnpm run contract:test
```

### 3. 部署到本地网络
```bash
# 启动本地节点
npx hardhat node

# 部署合约
pnpm run contract:deploy:local
```

### 4. 部署到测试网/主网
```bash
pnpm run contract:deploy
```

## 🔧 配置说明

### 环境变量
在 `.env` 文件中配置以下变量：

```env
# 合约地址（部署后更新）
MOCK_TOKEN_ADDRESS=0x...
VAULT_ADDRESS=0x...
MEMBERSHIP_ADDRESS=0x...

# 部署者私钥（用于注入资金等操作）
DEPLOYER_PRIVATE_KEY=0x...
```

### 网络配置
在 `hardhat.config.ts` 中配置网络：

```typescript
networks: {
  hardhat: {
    chainId: 31337,
  },
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
  // 生产网络配置
  arbitrum: {
    url: process.env.ARBITRUM_MAINNET_URL,
    chainId: 42161,
  },
}
```

## 🧪 测试说明

### 测试结构
- `test/MockToken.test.ts`: MockToken合约测试
- `test/Vault.test.ts`: Vault合约测试
- `test/Membership.test.ts`: Membership合约测试

### 运行测试
```bash
# 运行所有测试
pnpm run contract:test

# 运行特定测试文件
npx hardhat test test/MockToken.test.ts
```

## 🔐 安全特性

### 权限控制
- 所有管理员功能仅限owner调用
- 用户只能操作自己的资金
- 策略执行器有专门的接口

### 重入攻击防护
- 使用OpenZeppelin的ReentrancyGuard
- 状态更新在外部调用之前

### 输入验证
- 地址格式验证
- 金额有效性检查
- 权限验证

## 📊 事件系统

所有重要操作都会触发事件，便于前端监听：

- `Deposit`: 用户充值
- `Withdraw`: 用户提现
- `FeeCollected`: 手续费收取
- `MemberSubscribed`: 会员订阅
- `TokenSupported`: 代币支持状态变更

## 🔄 升级机制

合约采用模块化设计，支持独立升级：

1. 新版本合约部署
2. 数据迁移（如需要）
3. 前端配置更新
4. 旧合约弃用

## 📝 开发规范

### 代码风格
- 使用Solidity 0.8.28
- 遵循OpenZeppelin标准
- 完整的NatSpec文档
- 清晰的错误信息

### 测试要求
- 单元测试覆盖率 > 90%
- 集成测试覆盖主要流程
- 边界条件测试
- 异常情况处理

### 部署检查清单
- [ ] 合约编译通过
- [ ] 所有测试通过
- [ ] 网络配置正确
- [ ] 环境变量设置
- [ ] 权限配置正确
- [ ] 事件监听配置
