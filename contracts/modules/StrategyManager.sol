// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/HermesConstants.sol";

/**
 * @title StrategyManager
 * @dev 策略管理模块
 */
contract StrategyManager is AccessControl, ReentrancyGuard, Pausable {
    using HermesConstants for *;
    
    struct Strategy {
        uint256 id;
        uint256 poolId;
        address owner;
        string name;
        string description;
        bytes strategyData;
        HermesConstants.StrategyStatus status;
        uint256 createdAt;
        uint256 lastExecutedAt;
        uint256 executionCount;
        uint256 successCount;
        uint256 failureCount;
    }
    
    struct StrategyExecution {
        uint256 strategyId;
        uint256 timestamp;
        bool success;
        string result;
        uint256 gasUsed;
    }
    
    // 状态变量
    uint256 private _nextStrategyId = 1;
    mapping(uint256 => Strategy) public strategies;
    mapping(address => uint256[]) public userStrategies;
    mapping(address => uint256) public userStrategyCount;
    mapping(uint256 => StrategyExecution[]) public strategyExecutions;
    
    // 事件
    event StrategyCreated(uint256 indexed strategyId, address indexed owner, string name);
    event StrategyUpdated(uint256 indexed strategyId, string name, string description);
    event StrategyExecuted(uint256 indexed strategyId, bool success, string result);
    event StrategyStatusChanged(uint256 indexed strategyId, HermesConstants.StrategyStatus status);
    
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HermesConstants.ADMIN_ROLE, admin);
        _grantRole(HermesConstants.OPERATOR_ROLE, admin);
    }
    
    /**
     * @dev 创建策略
     */
    function createStrategy(
        address owner,
        uint256 poolId,
        string memory name,
        string memory description,
        bytes memory strategyData
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) returns (uint256) {
        require(bytes(name).length > 0, "Strategy name cannot be empty");
        require(userStrategyCount[owner] < _getMaxStrategies(owner), "Exceeds max strategies limit");
        
        uint256 strategyId = _nextStrategyId++;
        
        strategies[strategyId] = Strategy({
            id: strategyId,
            poolId: poolId,
            owner: owner,
            name: name,
            description: description,
            strategyData: strategyData,
            status: HermesConstants.StrategyStatus.INACTIVE,
            createdAt: block.timestamp,
            lastExecutedAt: 0,
            executionCount: 0,
            successCount: 0,
            failureCount: 0
        });
        
        userStrategies[owner].push(strategyId);
        userStrategyCount[owner]++;
        
        emit StrategyCreated(strategyId, owner, name);
        return strategyId;
    }
    
    /**
     * @dev 更新策略
     */
    function updateStrategy(
        uint256 strategyId,
        string memory name,
        string memory description,
        bytes memory strategyData
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.owner != address(0), "Strategy does not exist");
        
        strategy.name = name;
        strategy.description = description;
        strategy.strategyData = strategyData;
        
        emit StrategyUpdated(strategyId, name, description);
    }
    
    /**
     * @dev 执行策略
     */
    function executeStrategy(
        uint256 strategyId,
        bool success,
        string memory result,
        uint256 gasUsed
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.owner != address(0), "Strategy does not exist");
        require(strategy.status == HermesConstants.StrategyStatus.ACTIVE, "Strategy is not active");
        
        strategy.lastExecutedAt = block.timestamp;
        strategy.executionCount++;
        
        if (success) {
            strategy.successCount++;
        } else {
            strategy.failureCount++;
        }
        
        // 记录执行历史
        strategyExecutions[strategyId].push(StrategyExecution({
            strategyId: strategyId,
            timestamp: block.timestamp,
            success: success,
            result: result,
            gasUsed: gasUsed
        }));
        
        emit StrategyExecuted(strategyId, success, result);
    }
    
    /**
     * @dev 更改策略状态
     */
    function setStrategyStatus(
        uint256 strategyId,
        HermesConstants.StrategyStatus status
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.owner != address(0), "Strategy does not exist");
        
        strategy.status = status;
        
        emit StrategyStatusChanged(strategyId, status);
    }
    
    /**
     * @dev 获取策略信息
     */
    function getStrategyInfo(uint256 strategyId) external view returns (
        uint256 poolId,
        address owner,
        string memory name,
        string memory description,
        HermesConstants.StrategyStatus status,
        uint256 createdAt,
        uint256 lastExecutedAt,
        uint256 executionCount,
        uint256 successCount,
        uint256 failureCount
    ) {
        Strategy storage strategy = strategies[strategyId];
        return (
            strategy.poolId,
            strategy.owner,
            strategy.name,
            strategy.description,
            strategy.status,
            strategy.createdAt,
            strategy.lastExecutedAt,
            strategy.executionCount,
            strategy.successCount,
            strategy.failureCount
        );
    }
    
    /**
     * @dev 获取策略数据
     */
    function getStrategyData(uint256 strategyId) external view returns (bytes memory) {
        return strategies[strategyId].strategyData;
    }
    
    /**
     * @dev 获取用户的所有策略ID
     */
    function getUserStrategies(address user) external view returns (uint256[] memory) {
        return userStrategies[user];
    }
    
    /**
     * @dev 获取用户策略数量
     */
    function getUserStrategyCount(address user) external view returns (uint256) {
        return userStrategyCount[user];
    }
    
    /**
     * @dev 获取策略执行历史
     */
    function getStrategyExecutions(uint256 strategyId) external view returns (StrategyExecution[] memory) {
        return strategyExecutions[strategyId];
    }
    
    /**
     * @dev 获取策略执行历史数量
     */
    function getStrategyExecutionCount(uint256 strategyId) external view returns (uint256) {
        return strategyExecutions[strategyId].length;
    }
    
    /**
     * @dev 获取最大策略数量限制
     */
    function getMaxStrategies(address user) external view returns (uint256) {
        return _getMaxStrategies(user);
    }
    
    /**
     * @dev 检查策略是否存在
     */
    function strategyExists(uint256 strategyId) external view returns (bool) {
        return strategies[strategyId].owner != address(0);
    }
    
    /**
     * @dev 检查策略是否属于指定用户
     */
    function isStrategyOwner(uint256 strategyId, address user) external view returns (bool) {
        return strategies[strategyId].owner == user;
    }
    
    // 内部函数
    
    function _getMaxStrategies(address user) internal view returns (uint256) {
        // 这里需要从会员管理模块获取用户会员类型
        // 暂时返回基础限制，后续会通过接口调用获取
        return HermesConstants.FREE_USER_MAX_STRATEGIES;
    }
    
    // 管理员功能
    
    function pause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyDeleteStrategy(uint256 strategyId) external onlyRole(HermesConstants.ADMIN_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.owner != address(0), "Strategy does not exist");
        
        // 从用户策略列表中移除
        uint256[] storage userStrategyList = userStrategies[strategy.owner];
        for (uint256 i = 0; i < userStrategyList.length; i++) {
            if (userStrategyList[i] == strategyId) {
                userStrategyList[i] = userStrategyList[userStrategyList.length - 1];
                userStrategyList.pop();
                break;
            }
        }
        
        userStrategyCount[strategy.owner]--;
        
        // 删除策略
        delete strategies[strategyId];
        delete strategyExecutions[strategyId];
    }
} 