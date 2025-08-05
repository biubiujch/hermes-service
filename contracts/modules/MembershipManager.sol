// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/HermesConstants.sol";
import "../tokens/MockUSDT.sol";

/**
 * @title MembershipManager
 * @dev 会员管理模块
 */
contract MembershipManager is AccessControl, ReentrancyGuard, Pausable {
    using HermesConstants for *;
    
    MockUSDT public immutable usdtToken;
    address public poolManagerAddress; // 新增：PoolManager地址
    
    struct UserMembership {
        HermesConstants.MembershipType membershipType;
        uint256 expiryTime;
        uint256 lastUpgradeTime;
        bool isWhitelisted;
    }
    
    struct FeeConfig {
        address feeCollector;
        uint256 totalFeesCollected;
        uint256 lastWithdrawTime;
    }
    
    // 状态变量
    mapping(address => UserMembership) public userMemberships;
    mapping(address => bool) public whitelistedUsers;
    FeeConfig public feeConfig;
    
    // 事件
    event MembershipUpgraded(address indexed user, HermesConstants.MembershipType membershipType, uint256 expiryTime);
    event UserWhitelisted(address indexed user, bool whitelisted);
    event FeesCollected(address indexed user, uint256 amount);
    event FeesWithdrawn(address indexed collector, uint256 amount);
    event MembershipExpired(address indexed user, uint256 expiredAt);
    
    constructor(address _usdtToken, address admin, address _feeCollector) {
        usdtToken = MockUSDT(_usdtToken);
        feeConfig.feeCollector = _feeCollector;
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HermesConstants.ADMIN_ROLE, admin);
        _grantRole(HermesConstants.OPERATOR_ROLE, admin);
        _grantRole(HermesConstants.WHITELIST_ROLE, admin);
    }
    
    /**
     * @dev 设置PoolManager地址 (仅限管理员)
     */
    function setPoolManagerAddress(address _poolManagerAddress) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(_poolManagerAddress != address(0), "Invalid pool manager address");
        poolManagerAddress = _poolManagerAddress;
    }
    
    /**
     * @dev 升级会员
     */
    function upgradeMembership(
        address user,
        HermesConstants.MembershipDuration duration
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) nonReentrant {
        uint256 price = _getMembershipPrice(duration);
        // 代币已经从主控制器转移到这里，不需要再次转移
        
        // 更新费用统计
        feeConfig.totalFeesCollected += price;
        
        // 更新用户会员信息
        UserMembership storage membership = userMemberships[user];
        membership.membershipType = HermesConstants.MembershipType.MEMBER;
        membership.lastUpgradeTime = block.timestamp;
        
        // 计算过期时间
        uint256 durationInDays;
        if (duration == HermesConstants.MembershipDuration.MONTH) {
            durationInDays = 30;
        } else if (duration == HermesConstants.MembershipDuration.QUARTER) {
            durationInDays = 90;
        } else if (duration == HermesConstants.MembershipDuration.YEAR) {
            durationInDays = 365;
        } else {
            revert("Invalid membership duration");
        }
        
        // 如果用户已经是会员，延长过期时间；否则设置新的过期时间
        if (membership.membershipType == HermesConstants.MembershipType.MEMBER && membership.expiryTime > block.timestamp) {
            membership.expiryTime += durationInDays * 1 days;
        } else {
            membership.expiryTime = block.timestamp + durationInDays * 1 days;
        }
        
        emit MembershipUpgraded(user, HermesConstants.MembershipType.MEMBER, membership.expiryTime);
        emit FeesCollected(user, price);
    }
    
    /**
     * @dev 添加/移除白名单用户
     */
    function setWhitelisted(address user, bool whitelisted) external onlyRole(HermesConstants.WHITELIST_ROLE) {
        whitelistedUsers[user] = whitelisted;
        userMemberships[user].isWhitelisted = whitelisted;
        
        emit UserWhitelisted(user, whitelisted);
    }
    
    /**
     * @dev 批量设置白名单
     */
    function batchSetWhitelisted(address[] calldata users, bool whitelisted) external onlyRole(HermesConstants.WHITELIST_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            whitelistedUsers[users[i]] = whitelisted;
            userMemberships[users[i]].isWhitelisted = whitelisted;
            emit UserWhitelisted(users[i], whitelisted);
        }
    }
    
    /**
     * @dev 获取用户会员信息
     */
    function getUserMembership(address user) external view returns (
        HermesConstants.MembershipType membershipType,
        uint256 expiryTime,
        uint256 lastUpgradeTime,
        bool isWhitelisted,
        bool isValid
    ) {
        UserMembership storage membership = userMemberships[user];
        bool valid = _isMembershipValid(membership);
        
        return (
            membership.membershipType,
            membership.expiryTime,
            membership.lastUpgradeTime,
            membership.isWhitelisted,
            valid
        );
    }
    
    /**
     * @dev 检查用户是否为白名单
     */
    function isWhitelisted(address user) external view returns (bool) {
        return whitelistedUsers[user] || userMemberships[user].isWhitelisted;
    }
    
    /**
     * @dev 获取用户费用率
     */
    function getFeeRate(address user) external view returns (uint256) {
        UserMembership storage membership = userMemberships[user];
        
        // 白名单用户免手续费
        if (whitelistedUsers[user] || membership.isWhitelisted) {
            return 0;
        }
        
        // 检查会员是否有效
        if (!_isMembershipValid(membership)) {
            return HermesConstants.FREE_USER_FEE_RATE;
        }
        
        // 根据会员类型返回费用率
        if (membership.membershipType == HermesConstants.MembershipType.MEMBER) {
            return HermesConstants.MEMBER_FEE_RATE;
        }
        
        return HermesConstants.FREE_USER_FEE_RATE;
    }
    
    /**
     * @dev 获取用户最大池数量限制
     */
    function getMaxPools(address user) external view returns (uint256) {
        UserMembership storage membership = userMemberships[user];
        
        if (!_isMembershipValid(membership)) {
            return HermesConstants.FREE_USER_MAX_POOLS;
        }
        
        if (membership.membershipType == HermesConstants.MembershipType.MEMBER) {
            return HermesConstants.MEMBER_MAX_POOLS;
        }
        
        return HermesConstants.FREE_USER_MAX_POOLS;
    }
    
    /**
     * @dev 获取用户最大策略数量限制
     */
    function getMaxStrategies(address user) external view returns (uint256) {
        UserMembership storage membership = userMemberships[user];
        
        if (!_isMembershipValid(membership)) {
            return HermesConstants.FREE_USER_MAX_STRATEGIES;
        }
        
        if (membership.membershipType == HermesConstants.MembershipType.MEMBER) {
            return HermesConstants.MEMBER_MAX_STRATEGIES;
        }
        
        return HermesConstants.FREE_USER_MAX_STRATEGIES;
    }
    
    /**
     * @dev 提取费用
     */
    function withdrawFees() external onlyRole(HermesConstants.ADMIN_ROLE) nonReentrant {
        require(feeConfig.totalFeesCollected > 0, "No fees to withdraw");
        
        uint256 amount = feeConfig.totalFeesCollected;
        feeConfig.totalFeesCollected = 0;
        feeConfig.lastWithdrawTime = block.timestamp;
        
        require(usdtToken.transfer(feeConfig.feeCollector, amount), "Fee withdrawal failed");
        
        emit FeesWithdrawn(feeConfig.feeCollector, amount);
    }
    
    /**
     * @dev 更新费用收集地址
     */
    function updateFeeCollector(address newCollector) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid fee collector");
        feeConfig.feeCollector = newCollector;
    }
    
    // 内部函数
    
    function _getMembershipPrice(HermesConstants.MembershipDuration duration) internal pure returns (uint256) {
        if (duration == HermesConstants.MembershipDuration.MONTH) {
            return HermesConstants.MONTHLY_MEMBERSHIP_PRICE;
        } else if (duration == HermesConstants.MembershipDuration.QUARTER) {
            return HermesConstants.QUARTERLY_MEMBERSHIP_PRICE;
        } else if (duration == HermesConstants.MembershipDuration.YEAR) {
            return HermesConstants.YEARLY_MEMBERSHIP_PRICE;
        }
        revert("Invalid membership duration");
    }
    
    function _isMembershipValid(UserMembership storage membership) internal view returns (bool) {
        return membership.membershipType != HermesConstants.MembershipType.FREE && 
               (membership.expiryTime == type(uint256).max || membership.expiryTime > block.timestamp);
    }
    
    /**
     * @dev 获取用户资金池数量 (通过接口调用PoolManager)
     */
    function _getUserPoolCount(address user) internal view returns (uint256) {
        // 这里需要通过接口调用PoolManager，暂时返回0
        // 实际实现时需要创建PoolManager接口
        return 0;
    }
    
    /**
     * @dev 冻结超限的资金池 (通过接口调用PoolManager)
     */
    function _freezeExcessPools(address user, uint256 maxAllowedPools) internal {
        // 这里需要通过接口调用PoolManager冻结超限的资金池
        // 实际实现时需要创建PoolManager接口
        // 暂时为空实现
    }
    
    // 管理员功能
    
    function pause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyRefund(address user, uint256 amount) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(usdtToken.transfer(user, amount), "Emergency refund failed");
    }
    
    /**
     * @dev 检查会员到期并冻结超限资金池 (仅限管理员)
     */
    function checkMembershipExpiryAndFreezePools(address user) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(poolManagerAddress != address(0), "Pool manager address not set");
        
        UserMembership storage membership = userMemberships[user];
        
        // 检查会员是否已过期
        if (membership.membershipType == HermesConstants.MembershipType.MEMBER && 
            membership.expiryTime <= block.timestamp) {
            
            // 会员已过期，发出事件
            emit MembershipExpired(user, block.timestamp);
            
            // 获取用户当前资金池数量
            uint256 currentPools = _getUserPoolCount(user);
            uint256 maxAllowedPools = HermesConstants.FREE_USER_MAX_POOLS;
            
            // 如果用户资金池数量超过免费用户限制，冻结超限的资金池
            if (currentPools > maxAllowedPools) {
                // 冻结超限的资金池
                _freezeExcessPools(user, maxAllowedPools);
            }
        }
    }
    
    /**
     * @dev 批量检查会员到期 (仅限管理员)
     */
    function batchCheckMembershipExpiry(address[] calldata users) external onlyRole(HermesConstants.ADMIN_ROLE) {
        for (uint256 i = 0; i < users.length; i++) {
            // 直接在这里实现检查逻辑，避免函数调用顺序问题
            UserMembership storage membership = userMemberships[users[i]];
            
            if (membership.membershipType == HermesConstants.MembershipType.MEMBER && 
                membership.expiryTime <= block.timestamp) {
                
                emit MembershipExpired(users[i], block.timestamp);
                
                uint256 currentPools = _getUserPoolCount(users[i]);
                uint256 maxAllowedPools = HermesConstants.FREE_USER_MAX_POOLS;
                
                if (currentPools > maxAllowedPools) {
                    _freezeExcessPools(users[i], maxAllowedPools);
                }
            }
        }
    }
} 