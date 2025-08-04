# AssetPool 资金池管理合约

## 概述

`AssetPool` 是一个智能合约，用于管理用户的资金托管和策略执行时的资金转移。它是 Hermes 策略交易系统的核心组件之一。

## 主要功能

### 1. 资金托管
- 用户可以将 ETH 和 ERC20 代币存入资金池
- 支持多种代币类型
- 设置最小存款金额和最大资金池规模限制

### 2. 策略执行
- 授权策略合约可以从用户账户转移资金进行交易
- 策略执行完成后可以将资金返回给用户
- 确保只有授权的策略合约可以操作资金

### 3. 手续费管理
- 提取资金时收取 0.5% 的手续费
- 手续费自动转移到指定的收集地址

### 4. 安全机制
- 重入攻击防护
- 可暂停功能
- 紧急提取功能
- 权限控制

## 合约接口

### 用户功能

#### `deposit(address token, uint256 amount)`
- **功能**: 存入资金到资金池
- **参数**: 
  - `token`: 代币地址（address(0) 表示 ETH）
  - `amount`: 存入金额
- **要求**: 发送 ETH 时，msg.value 必须等于 amount

#### `withdraw(address token, uint256 amount)`
- **功能**: 从资金池提取资金
- **参数**:
  - `token`: 代币地址
  - `amount`: 提取金额
- **手续费**: 提取时收取 0.5% 手续费

#### `emergencyWithdraw(address token)`
- **功能**: 紧急提取（合约暂停时可用）
- **参数**: `token`: 代币地址
- **特点**: 不收手续费，直接提取全部余额

### 策略执行功能

#### `transferToStrategy(address user, address token, uint256 amount)`
- **功能**: 策略执行时转移用户资金
- **权限**: 仅授权策略合约可调用
- **参数**:
  - `user`: 用户地址
  - `token`: 代币地址
  - `amount`: 转移金额

#### `returnFromStrategy(address user, address token, uint256 amount)`
- **功能**: 策略返回资金到用户账户
- **权限**: 仅授权策略合约可调用
- **参数**:
  - `user`: 用户地址
  - `token`: 代币地址
  - `amount`: 返回金额

### 管理员功能

#### `addAuthorizedStrategy(address strategy)`
- **功能**: 添加授权策略合约
- **权限**: 仅合约所有者

#### `removeAuthorizedStrategy(address strategy)`
- **功能**: 移除授权策略合约
- **权限**: 仅合约所有者

#### `addSupportedToken(address token)`
- **功能**: 添加支持的代币
- **权限**: 仅合约所有者

#### `removeSupportedToken(address token)`
- **功能**: 移除支持的代币
- **权限**: 仅合约所有者

#### `setFeeCollector(address _feeCollector)`
- **功能**: 设置手续费收集地址
- **权限**: 仅合约所有者

#### `setMinDepositAmount(uint256 _minDepositAmount)`
- **功能**: 设置最小存款金额
- **权限**: 仅合约所有者

#### `setMaxPoolSize(uint256 _maxPoolSize)`
- **功能**: 设置最大资金池规模
- **权限**: 仅合约所有者

#### `pause()` / `unpause()`
- **功能**: 暂停/恢复合约
- **权限**: 仅合约所有者

### 查询功能

#### `getUserBalance(address user, address token)`
- **功能**: 获取用户余额
- **返回**: 用户指定代币的余额

#### `getPoolBalance(address token)`
- **功能**: 获取资金池总余额
- **返回**: 指定代币的总余额

#### `isStrategyAuthorized(address strategy)`
- **功能**: 检查策略是否已授权
- **返回**: 布尔值

#### `isTokenSupported(address token)`
- **功能**: 检查代币是否支持
- **返回**: 布尔值

## 事件

- `Deposit`: 用户存款事件
- `Withdraw`: 用户提款事件
- `StrategyExecution`: 策略执行事件
- `StrategyReturn`: 策略返回事件
- `EmergencyWithdraw`: 紧急提取事件
- `FeeCollected`: 手续费收集事件

## 部署和使用

### 1. 编译合约
```bash
npm run compile
```

### 2. 运行测试
```bash
npm run test
```

### 3. 部署合约
```bash
npm run deploy
```

### 4. 本地部署
```bash
npm run deploy:local
```

## 安全考虑

1. **权限控制**: 只有授权的策略合约可以操作用户资金
2. **重入防护**: 使用 OpenZeppelin 的 ReentrancyGuard
3. **暂停机制**: 紧急情况下可以暂停合约
4. **资金限制**: 设置最小存款和最大池规模限制
5. **手续费**: 防止频繁提取的资金管理

## 集成示例

### 与策略合约集成
```solidity
// 在策略合约中调用
assetPool.transferToStrategy(user, token, amount);

// 策略执行完成后返回资金
assetPool.returnFromStrategy(user, token, returnAmount);
```

### 前端集成
```javascript
// 存款
await assetPool.deposit(ethers.ZeroAddress, ethers.parseEther("1"), { value: ethers.parseEther("1") });

// 查询余额
const balance = await assetPool.getUserBalance(userAddress, tokenAddress);

// 提款
await assetPool.withdraw(tokenAddress, amount);
```

## 注意事项

1. 部署时需要提供有效的手续费收集地址
2. 策略合约必须先获得授权才能操作资金
3. 支持的代币需要管理员手动添加
4. 紧急提取功能在合约暂停时仍然可用
5. 所有金额计算都使用 wei 单位 