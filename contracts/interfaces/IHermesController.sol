// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IHermesController
 * @dev Hermes交易机器人主控制器接口
 */
interface IHermesController {
    // 事件定义
    event PoolCreated(address indexed poolAddress, address indexed owner, uint256 poolId);
    event PoolDeposited(address indexed poolAddress, address indexed user, uint256 amount);
    event PoolWithdrawn(address indexed poolAddress, address indexed user, uint256 amount);
    event PoolFrozen(uint256 indexed poolId, address indexed owner, string reason);
    event PoolUnfrozen(uint256 indexed poolId, address indexed owner);
    event StrategyCreated(uint256 indexed strategyId, address indexed owner, string name);
    event StrategyExecuted(uint256 indexed strategyId, bool success);
    event MembershipUpgraded(address indexed user, uint8 membershipType);
    
    // 资金池相关
    function createPool(string memory name, string memory description) external returns (uint256);
    function depositToPool(uint256 poolId, uint256 amount) external;
    function withdrawFromPool(uint256 poolId, uint256 amount) external;
    function getPoolInfo(uint256 poolId) external view returns (
        address owner,
        string memory name,
        string memory description,
        uint256 totalBalance,
        uint256 userCount
    );
    
    // 策略相关
    function createStrategy(
        uint256 poolId,
        string memory name,
        string memory description,
        bytes memory strategyData
    ) external returns (uint256);
    function executeStrategy(uint256 strategyId) external returns (bool);
    function getStrategyInfo(uint256 strategyId) external view returns (
        uint256 poolId,
        address owner,
        string memory name,
        string memory description,
        bool isActive
    );
    
    // 会员相关
    function upgradeMembership(uint8 duration) external payable;
    function getUserMembership(address user) external view returns (uint8);
    function isWhitelisted(address user) external view returns (bool);
    
    // 费用相关
    function getFeeRate(address user) external view returns (uint256);
    function withdrawFees() external;
} 