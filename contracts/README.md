# Hermes 合约架构

## 概述

Hermes 是一个模块化的加密货币交易策略机器人合约系统，包含以下核心功能：

- 资金池管理
- 会员管理
- 策略管理
- Mock GMX 交易功能
- 本地链测试币

## 合约架构

### 1. 主控制器合约

**HermesController.sol**
- 整合所有模块功能的主合约
- 提供统一的用户接口
- 管理模块间的交互
- 处理费用收集和分配

### 2. 核心模块

#### 2.1 资金池管理 (PoolManager.sol)
- 创建和管理资金池
- 处理存款和提款
- 跟踪用户池余额
- 支持池主关闭池

#### 2.2 会员管理 (MembershipManager.sol)
- 管理用户会员等级
- 处理会员升级和续费
- 白名单管理
- 费用率计算

#### 2.3 策略管理 (StrategyManager.sol)
- 创建和管理交易策略
- 策略执行记录
- 策略状态管理
- 执行历史跟踪

#### 2.4 Mock GMX 交易 (MockGMX.sol)
- 模拟 GMX 交易功能
- 支持开仓和平仓
- 市场数据管理
- 仓位盈亏计算

### 3. 辅助合约

#### 3.1 测试代币 (MockUSDT.sol)
- 用于本地测试的 USDT 代币
- 支持铸造和销毁
- 6位小数精度

#### 3.2 常量库 (HermesConstants.sol)
- 系统常量定义
- 会员类型枚举
- 策略状态枚举
- 费用和限制配置

#### 3.3 接口定义 (IHermesController.sol)
- 主控制器接口
- 事件定义
- 函数签名

## 会员等级

| 等级 | 费用率 | 最大池数 | 最大策略数 | 价格 |
|------|--------|----------|------------|------|
| FREE | 5% | 1 | 2 | 免费 |
| BASIC | 2% | 3 | 5 | 100 USDT |
| PREMIUM | 0.5% | 10 | 20 | 500 USDT |
| PERMANENT | 0% | 50 | 100 | 2000 USDT |

## 部署流程

1. 部署 MockUSDT 代币
2. 部署 HermesController（会自动部署所有模块）
3. 配置角色和权限
4. 初始化测试数据

## 使用示例

### 创建资金池
```solidity
await hermesController.createPool("My Pool", "A test pool");
```

### 存款到池
```solidity
await mockUSDT.approve(hermesController.address, amount);
await hermesController.depositToPool(poolId, amount);
```

### 创建策略
```solidity
await hermesController.createStrategy(
    poolId,
    "My Strategy",
    "A trading strategy",
    strategyData
);
```

### 升级会员
```solidity
await mockUSDT.approve(hermesController.address, membershipPrice);
await hermesController.upgradeMembership(1); // BASIC membership
```

## 安全特性

- 使用 OpenZeppelin 的安全合约
- 角色基础的访问控制
- 重入攻击防护
- 暂停机制
- 紧急提款功能

## 测试

运行测试：
```bash
npm run test
```

运行部署脚本：
```bash
npx hardhat run scripts/deploy.ts --network localhost
```

## 注意事项

1. 所有金额都使用 USDT 的 6 位小数精度
2. 费用以基点为单位（1 基点 = 0.01%）
3. 白名单用户免手续费
4. 合约支持暂停和紧急操作
5. 模块间通过角色权限进行交互

## 扩展性

合约设计支持以下扩展：
- 添加新的会员等级
- 增加新的交易策略类型
- 支持更多代币
- 集成真实的 GMX 合约
- 添加治理功能 