// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/HermesConstants.sol";
import "../tokens/MockUSDT.sol";

/**
 * @title PoolManager
 * @dev 资金池管理模块
 */
contract PoolManager is AccessControl, ReentrancyGuard, Pausable {
    using HermesConstants for *;
    
    MockUSDT public immutable usdtToken;
    
    struct Pool {
        uint256 id;
        address owner;
        string name;
        string description;
        uint256 totalBalance;
        uint256 userCount;
        bool isActive;
        bool isFrozen;        // 新增：是否被冻结
        uint256 frozenAt;     // 新增：冻结时间
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    struct UserPool {
        uint256 poolId;
        uint256 balance;
        uint256 lastDepositTime;
        uint256 lastWithdrawTime;
    }
    
    // 状态变量
    uint256 private _nextPoolId = 1;
    mapping(uint256 => Pool) public pools;
    mapping(address => UserPool[]) public userPools;
    mapping(address => uint256) public userPoolCount;
    
    // 事件
    event PoolCreated(uint256 indexed poolId, address indexed owner, string name);
    event PoolDeposited(uint256 indexed poolId, address indexed user, uint256 amount);
    event PoolWithdrawn(uint256 indexed poolId, address indexed user, uint256 amount);
    event PoolClosed(uint256 indexed poolId, address indexed owner);
    event PoolFrozen(uint256 indexed poolId, address indexed owner, string reason);
    event PoolUnfrozen(uint256 indexed poolId, address indexed owner);
    
    constructor(address _usdtToken, address admin) {
        usdtToken = MockUSDT(_usdtToken);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HermesConstants.ADMIN_ROLE, admin);
        _grantRole(HermesConstants.OPERATOR_ROLE, admin);
    }
    
    /**
     * @dev 创建资金池
     */
    function createPool(
        address owner,
        string memory name,
        string memory description
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) returns (uint256) {
        require(bytes(name).length > 0, "Pool name cannot be empty");
        require(userPoolCount[owner] < _getMaxPools(owner), "Exceeds max pools limit");
        
        uint256 poolId = _nextPoolId++;
        
        pools[poolId] = Pool({
            id: poolId,
            owner: owner,
            name: name,
            description: description,
            totalBalance: 0,
            userCount: 0,
            isActive: true,
            isFrozen: false,
            frozenAt: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        emit PoolCreated(poolId, owner, name);
        return poolId;
    }
    
    /**
     * @dev 向资金池存款
     */
    function depositToPool(
        uint256 poolId,
        address user,
        uint256 amount
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) nonReentrant {
        require(pools[poolId].isActive, "Pool is not active");
        require(!pools[poolId].isFrozen, "Pool is frozen");
        require(amount >= HermesConstants.MIN_POOL_DEPOSIT, "Amount below minimum");
        
        // 代币已经从主控制器转移到这里，不需要再次转移
        Pool storage pool = pools[poolId];
        pool.totalBalance += amount;
        pool.updatedAt = block.timestamp;
        
        // 更新用户池信息
        _updateUserPool(user, poolId, amount, true);
        
        emit PoolDeposited(poolId, user, amount);
    }
    
    /**
     * @dev 从资金池提款
     */
    function withdrawFromPool(
        uint256 poolId,
        address user,
        uint256 amount
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) nonReentrant {
        require(pools[poolId].isActive, "Pool is not active");
        require(amount > 0, "Amount must be greater than 0");
        
        Pool storage pool = pools[poolId];
        require(pool.totalBalance >= amount, "Insufficient pool balance");
        
        // 检查用户余额
        uint256 userBalance = _getUserPoolBalance(user, poolId);
        require(userBalance >= amount, "Insufficient user balance");
        
        pool.totalBalance -= amount;
        pool.updatedAt = block.timestamp;
        
        // 更新用户池信息
        _updateUserPool(user, poolId, amount, false);
        
        require(usdtToken.transfer(user, amount), "Transfer failed");
        
        emit PoolWithdrawn(poolId, user, amount);
    }
    
    /**
     * @dev 关闭资金池 (仅限池主)
     */
    function closePool(uint256 poolId) external {
        Pool storage pool = pools[poolId];
        require(pool.owner == msg.sender, "Only pool owner can close");
        require(pool.isActive, "Pool is already closed");
        require(pool.totalBalance == 0, "Pool must be empty to close");
        
        pool.isActive = false;
        pool.updatedAt = block.timestamp;
        
        emit PoolClosed(poolId, msg.sender);
    }
    
    /**
     * @dev 获取资金池信息
     */
    function getPoolInfo(uint256 poolId) external view returns (
        address owner,
        string memory name,
        string memory description,
        uint256 totalBalance,
        uint256 userCount,
        bool isActive,
        bool isFrozen,
        uint256 frozenAt,
        uint256 createdAt
    ) {
        Pool storage pool = pools[poolId];
        return (
            pool.owner,
            pool.name,
            pool.description,
            pool.totalBalance,
            pool.userCount,
            pool.isActive,
            pool.isFrozen,
            pool.frozenAt,
            pool.createdAt
        );
    }
    
    /**
     * @dev 获取用户在指定池中的余额
     */
    function getUserPoolBalance(address user, uint256 poolId) external view returns (uint256) {
        return _getUserPoolBalance(user, poolId);
    }
    
    /**
     * @dev 获取用户的所有池信息
     */
    function getUserPools(address user) external view returns (UserPool[] memory) {
        return userPools[user];
    }
    
    /**
     * @dev 获取用户池数量
     */
    function getUserPoolCount(address user) external view returns (uint256) {
        return userPoolCount[user];
    }
    
    /**
     * @dev 获取最大池数量限制
     */
    function getMaxPools(address user) external view returns (uint256) {
        return _getMaxPools(user);
    }
    
    /**
     * @dev 冻结资金池 (仅限管理员)
     */
    function freezePool(uint256 poolId, string memory reason) external onlyRole(HermesConstants.ADMIN_ROLE) {
        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool is not active");
        require(!pool.isFrozen, "Pool is already frozen");
        
        pool.isFrozen = true;
        pool.frozenAt = block.timestamp;
        pool.updatedAt = block.timestamp;
        
        emit PoolFrozen(poolId, pool.owner, reason);
    }
    
    /**
     * @dev 解冻资金池 (仅限管理员)
     */
    function unfreezePool(uint256 poolId) external onlyRole(HermesConstants.ADMIN_ROLE) {
        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool is not active");
        require(pool.isFrozen, "Pool is not frozen");
        
        pool.isFrozen = false;
        pool.frozenAt = 0;
        pool.updatedAt = block.timestamp;
        
        emit PoolUnfrozen(poolId, pool.owner);
    }
    
    /**
     * @dev 检查资金池是否被冻结
     */
    function isPoolFrozen(uint256 poolId) external view returns (bool) {
        return pools[poolId].isFrozen;
    }
    
    /**
     * @dev 获取资金池冻结信息
     */
    function getPoolFreezeInfo(uint256 poolId) external view returns (bool isFrozen, uint256 frozenAt) {
        Pool storage pool = pools[poolId];
        return (pool.isFrozen, pool.frozenAt);
    }
    
    // 内部函数
    
    function _updateUserPool(
        address user,
        uint256 poolId,
        uint256 amount,
        bool isDeposit
    ) internal {
        UserPool[] storage userPoolList = userPools[user];
        bool found = false;
        
        for (uint256 i = 0; i < userPoolList.length; i++) {
            if (userPoolList[i].poolId == poolId) {
                if (isDeposit) {
                    userPoolList[i].balance += amount;
                    userPoolList[i].lastDepositTime = block.timestamp;
                } else {
                    userPoolList[i].balance -= amount;
                    userPoolList[i].lastWithdrawTime = block.timestamp;
                }
                found = true;
                break;
            }
        }
        
        if (!found && isDeposit) {
            userPoolList.push(UserPool({
                poolId: poolId,
                balance: amount,
                lastDepositTime: block.timestamp,
                lastWithdrawTime: 0
            }));
            userPoolCount[user]++;
            
            // 更新池的用户数量
            pools[poolId].userCount++;
        }
    }
    
    function _getUserPoolBalance(address user, uint256 poolId) internal view returns (uint256) {
        UserPool[] storage userPoolList = userPools[user];
        for (uint256 i = 0; i < userPoolList.length; i++) {
            if (userPoolList[i].poolId == poolId) {
                return userPoolList[i].balance;
            }
        }
        return 0;
    }
    
    function _getMaxPools(address user) internal view returns (uint256) {
        // 这里需要从会员管理模块获取用户会员类型
        // 暂时返回基础限制，后续会通过接口调用获取
        return HermesConstants.FREE_USER_MAX_POOLS;
    }
    
    // 管理员功能
    
    function pause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _unpause();
    }
    
    function emergencyWithdraw(uint256 poolId) external onlyRole(HermesConstants.ADMIN_ROLE) {
        Pool storage pool = pools[poolId];
        require(pool.totalBalance > 0, "Pool is empty");
        
        uint256 amount = pool.totalBalance;
        pool.totalBalance = 0;
        pool.isActive = false;
        
        require(usdtToken.transfer(pool.owner, amount), "Emergency withdrawal failed");
    }
} 