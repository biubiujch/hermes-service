// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HermesConstants
 * @dev Hermes系统常量定义
 */
library HermesConstants {
    // 会员类型枚举
    enum MembershipType {
        FREE,       // 0: 非会员
        MEMBER      // 1: 会员
    }
    
    // 会员时长枚举
    enum MembershipDuration {
        MONTH,      // 0: 月付（30天）
        QUARTER,    // 1: 季度（90天）
        YEAR        // 2: 年付（365天）
    }
    
    // 策略状态枚举
    enum StrategyStatus {
        INACTIVE,   // 0: 未激活
        ACTIVE,     // 1: 激活
        PAUSED,     // 2: 暂停
        COMPLETED   // 3: 完成
    }
    
    // 费用相关常量 (以基点为单位，1基点 = 0.01%)
    uint256 public constant FEE_BASIS_POINTS = 10000;
    uint256 public constant FREE_USER_FEE_RATE = 500;      // 5%
    uint256 public constant MEMBER_FEE_RATE = 100;         // 1%
    
    // 限制相关常量
    uint256 public constant FREE_USER_MAX_POOLS = 1;
    uint256 public constant FREE_USER_MAX_STRATEGIES = 2;
    uint256 public constant MEMBER_MAX_POOLS = 10;
    uint256 public constant MEMBER_MAX_STRATEGIES = 20;
    
    // 会员价格 (以USDT为单位，需要转换为wei)
    uint256 public constant MONTHLY_MEMBERSHIP_PRICE = 50 * 10**6;   // 50 USDT/月
    uint256 public constant QUARTERLY_MEMBERSHIP_PRICE = 120 * 10**6; // 120 USDT/季度
    uint256 public constant YEARLY_MEMBERSHIP_PRICE = 400 * 10**6;   // 400 USDT/年
    
    // 最小存款金额
    uint256 public constant MIN_POOL_DEPOSIT = 10 * 10**6;  // 10 USDT
    
    // 角色定义
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");
} 