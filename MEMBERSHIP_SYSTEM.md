# 会员系统说明

## 概述

Hermes 交易机器人采用简化的会员系统，只有两种状态：
- **非会员 (FREE)**: 免费用户
- **会员 (MEMBER)**: 付费会员

## 会员时长选项

会员可以按以下时长购买：

| 时长类型 | 天数 | 价格 (USDT) | 说明 |
|---------|------|-------------|------|
| 月付 | 30天 | 50 | 按月付费 |
| 季度 | 90天 | 120 | 按季度付费 |
| 年付 | 365天 | 400 | 按年付费 |

## 费用率对比

| 用户类型 | 费用率 | 说明 |
|---------|--------|------|
| 非会员 | 5% | 免费用户，手续费较高 |
| 会员 | 1% | 付费会员，享受优惠费率 |

## 功能限制对比

| 功能 | 非会员 | 会员 |
|------|--------|------|
| 最大资金池数量 | 1 | 10 |
| 最大策略数量 | 2 | 20 |

## 技术实现

### 合约调用

```solidity
// 升级会员 (0=月付, 1=季度, 2=年付)
function upgradeMembership(uint8 duration) external payable;

// 示例：购买月付会员
hermesController.upgradeMembership(0); // 需要先approve 50 USDT

// 示例：购买季度会员  
hermesController.upgradeMembership(1); // 需要先approve 120 USDT

// 示例：购买年付会员
hermesController.upgradeMembership(2); // 需要先approve 400 USDT
```

### 会员状态查询

```solidity
// 获取用户会员信息
function getUserMembership(address user) external view returns (
    uint8 membershipType,  // 0=非会员, 1=会员
    uint256 expiryTime,    // 过期时间戳
    uint256 lastUpgradeTime, // 最后升级时间
    bool isWhitelisted,    // 是否白名单
    bool isValid          // 会员是否有效
);

// 获取用户费用率
function getFeeRate(address user) external view returns (uint256);
```

## 会员续费机制

- 如果用户在会员有效期内再次购买会员，会自动延长会员期限
- 如果用户会员已过期，会重新开始计算会员期限
- 支持不同时长的组合购买（如先买月付，再买季度）

## 白名单功能

- 白名单用户享受0%费用率
- 白名单状态独立于会员状态
- 管理员可以批量设置白名单

## 前端集成建议

1. **会员购买界面**：显示三种时长选项和对应价格
2. **会员状态显示**：显示当前会员类型和剩余有效期
3. **费用率显示**：在交易前显示用户的实际费用率
4. **续费提醒**：在会员即将过期时提醒用户续费

## 安全考虑

- 所有会员费用直接转入费用收集地址
- 会员状态通过智能合约验证，不可篡改
- 支持紧急暂停功能
- 管理员可以更新费用收集地址 