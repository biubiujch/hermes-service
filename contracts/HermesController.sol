// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/HermesConstants.sol";
import "./tokens/MockUSDT.sol";
import "./modules/PoolManager.sol";
import "./modules/MembershipManager.sol";
import "./modules/StrategyManager.sol";
import "./mock/MockGMX.sol";
import "./interfaces/IHermesController.sol";

/**
 * @title HermesController
 * @dev Hermes交易机器人主控制器，整合所有模块功能
 */
contract HermesController is IHermesController, AccessControl, ReentrancyGuard, Pausable {
    using HermesConstants for *;
    
    // 模块合约
    MockUSDT public immutable usdtToken;
    PoolManager public immutable poolManager;
    MembershipManager public immutable membershipManager;
    StrategyManager public immutable strategyManager;
    MockGMX public immutable mockGMX;
    
    // 状态变量
    address public feeCollector;
    uint256 public totalFeesCollected;
    
    constructor(
        address _usdtToken,
        address _feeCollector,
        address admin
    ) {
        usdtToken = MockUSDT(_usdtToken);
        feeCollector = _feeCollector;
        
        // 部署模块合约
        poolManager = new PoolManager(_usdtToken, address(this));
        membershipManager = new MembershipManager(_usdtToken, address(this), _feeCollector);
        strategyManager = new StrategyManager(address(this));
        mockGMX = new MockGMX(_usdtToken, address(this));
        
        // 设置角色
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HermesConstants.ADMIN_ROLE, admin);
        _grantRole(HermesConstants.OPERATOR_ROLE, admin);
        _grantRole(HermesConstants.WHITELIST_ROLE, admin);
        
        // 将模块合约的角色授予主控制器
        poolManager.grantRole(HermesConstants.OPERATOR_ROLE, address(this));
        membershipManager.grantRole(HermesConstants.OPERATOR_ROLE, address(this));
        strategyManager.grantRole(HermesConstants.OPERATOR_ROLE, address(this));
        mockGMX.grantRole(HermesConstants.OPERATOR_ROLE, address(this));
        
        // 将主控制器的OPERATOR角色授予自己，以便能够调用模块合约
        _grantRole(HermesConstants.OPERATOR_ROLE, address(this));
    }
    
    // ============ 资金池管理 ============
    
    /**
     * @dev 创建资金池
     */
    function createPool(
        string memory name,
        string memory description
    ) external override returns (uint256) {
        require(!paused(), "Contract is paused");
        require(bytes(name).length > 0, "Pool name cannot be empty");
        
        // 检查用户池数量限制
        uint256 maxPools = membershipManager.getMaxPools(msg.sender);
        uint256 currentPools = poolManager.getUserPoolCount(msg.sender);
        require(currentPools < maxPools, "Exceeds max pools limit");
        
        uint256 poolId = poolManager.createPool(msg.sender, name, description);
        emit PoolCreated(address(poolManager), msg.sender, poolId);
        return poolId;
    }
    
    /**
     * @dev 向资金池存款
     */
    function depositToPool(uint256 poolId, uint256 amount) external override {
        require(!paused(), "Contract is paused");
        require(amount > 0, "Amount must be greater than 0");
        
        // 检查费用
        uint256 feeRate = getFeeRate(msg.sender);
        uint256 fee = (amount * feeRate) / HermesConstants.FEE_BASIS_POINTS;
        uint256 depositAmount = amount - fee;
        
        // 收取费用
        if (fee > 0) {
            totalFeesCollected += fee;
            require(usdtToken.transferFrom(msg.sender, address(this), fee), "Fee transfer failed");
        }
        
        // 存款到池
        require(usdtToken.transferFrom(msg.sender, address(poolManager), depositAmount), "Deposit transfer failed");
        poolManager.depositToPool(poolId, msg.sender, depositAmount);
        emit PoolDeposited(address(poolManager), msg.sender, amount);
    }
    
    /**
     * @dev 从资金池提款
     */
    function withdrawFromPool(uint256 poolId, uint256 amount) external override {
        require(!paused(), "Contract is paused");
        require(amount > 0, "Amount must be greater than 0");
        
        poolManager.withdrawFromPool(poolId, msg.sender, amount);
        emit PoolWithdrawn(address(poolManager), msg.sender, amount);
    }
    
    /**
     * @dev 获取资金池信息
     */
    function getPoolInfo(uint256 poolId) external view override returns (
        address owner,
        string memory name,
        string memory description,
        uint256 totalBalance,
        uint256 userCount
    ) {
        (
            owner,
            name,
            description,
            totalBalance,
            userCount,
            , // isActive
            , // isFrozen
            , // frozenAt
            // createdAt
        ) = poolManager.getPoolInfo(poolId);
    }
    
    // ============ 策略管理 ============
    
    /**
     * @dev 创建策略
     */
    function createStrategy(
        uint256 poolId,
        string memory name,
        string memory description,
        bytes memory strategyData
    ) external override returns (uint256) {
        require(!paused(), "Contract is paused");
        require(bytes(name).length > 0, "Strategy name cannot be empty");
        
        // 检查用户策略数量限制
        uint256 maxStrategies = membershipManager.getMaxStrategies(msg.sender);
        uint256 currentStrategies = strategyManager.getUserStrategyCount(msg.sender);
        require(currentStrategies < maxStrategies, "Exceeds max strategies limit");
        
        uint256 strategyId = strategyManager.createStrategy(msg.sender, poolId, name, description, strategyData);
        emit StrategyCreated(strategyId, msg.sender, name);
        return strategyId;
    }
    
    /**
     * @dev 执行策略
     */
    function executeStrategy(uint256 strategyId) external override returns (bool) {
        require(!paused(), "Contract is paused");
        
        // 获取策略信息
        (
            uint256 poolId,
            , // owner
            , // name
            , // description
            HermesConstants.StrategyStatus status,
            , // createdAt
            , // lastExecutedAt
            , // executionCount
            , // successCount
            // failureCount
        ) = strategyManager.getStrategyInfo(strategyId);
        
        // 检查资金池是否被冻结
        require(!poolManager.isPoolFrozen(poolId), "Pool is frozen, cannot execute strategy");
        
        // 激活策略（如果未激活）
        if (status != HermesConstants.StrategyStatus.ACTIVE) {
            strategyManager.setStrategyStatus(strategyId, HermesConstants.StrategyStatus.ACTIVE);
        }
        
        // 这里应该包含实际的策略执行逻辑
        // 暂时返回成功
        strategyManager.executeStrategy(strategyId, true, "Strategy executed successfully", 0);
        emit StrategyExecuted(strategyId, true);
        return true;
    }
    
    /**
     * @dev 获取策略信息
     */
    function getStrategyInfo(uint256 strategyId) external view override returns (
        uint256 poolId,
        address owner,
        string memory name,
        string memory description,
        bool isActive
    ) {
        (
            poolId,
            owner,
            name,
            description,
            , // status
            , // createdAt
            , // lastExecutedAt
            , // executionCount
            , // successCount
            // failureCount
        ) = strategyManager.getStrategyInfo(strategyId);
        
        // 检查策略是否激活
        (
            , // poolId
            , // owner
            , // name
            , // description
            HermesConstants.StrategyStatus status,
            , // createdAt
            , // lastExecutedAt
            , // executionCount
            , // successCount
            // failureCount
        ) = strategyManager.getStrategyInfo(strategyId);
        
        isActive = (status == HermesConstants.StrategyStatus.ACTIVE);
    }
    
    // ============ 会员管理 ============
    
    /**
     * @dev 升级会员
     */
    function upgradeMembership(uint8 duration) external payable override {
        require(!paused(), "Contract is paused");
        require(duration >= 0 && duration <= 2, "Invalid membership duration");
        
        HermesConstants.MembershipDuration membershipDuration = HermesConstants.MembershipDuration(duration);
        uint256 price = _getMembershipPrice(membershipDuration);
        require(usdtToken.transferFrom(msg.sender, address(membershipManager), price), "Payment transfer failed");
        membershipManager.upgradeMembership(msg.sender, membershipDuration);
        emit MembershipUpgraded(msg.sender, 1); // 1 表示会员
    }
    
    /**
     * @dev 获取用户会员信息
     */
    function getUserMembership(address user) external view override returns (uint8) {
        (
            HermesConstants.MembershipType membershipType,
            , // expiryTime
            , // lastUpgradeTime
            , // isWhitelisted
            bool isValid
        ) = membershipManager.getUserMembership(user);
        
        if (!isValid) {
            return 0; // FREE
        }
        
        return uint8(membershipType);
    }
    
    /**
     * @dev 检查用户是否为白名单
     */
    function isWhitelisted(address user) external view override returns (bool) {
        return membershipManager.isWhitelisted(user);
    }
    
    // ============ 费用管理 ============
    
    /**
     * @dev 获取用户费用率
     */
    function getFeeRate(address user) public view override returns (uint256) {
        return membershipManager.getFeeRate(user);
    }
    
    /**
     * @dev 提取费用
     */
    function withdrawFees() external override {
        require(!paused(), "Contract is paused");
        require(msg.sender == feeCollector || hasRole(HermesConstants.ADMIN_ROLE, msg.sender), "Not authorized");
        require(totalFeesCollected > 0, "No fees to withdraw");
        
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        
        require(usdtToken.transfer(feeCollector, amount), "Fee withdrawal failed");
    }
    
    // ============ 管理员功能 ============
    
    function pause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _unpause();
    }
    
    function updateFeeCollector(address newCollector) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(newCollector != address(0), "Invalid fee collector");
        feeCollector = newCollector;
    }
    
    function grantModuleRole(bytes32 role, address account) external onlyRole(HermesConstants.ADMIN_ROLE) {
        poolManager.grantRole(role, account);
        membershipManager.grantRole(role, account);
        strategyManager.grantRole(role, account);
        mockGMX.grantRole(role, account);
    }
    
    function revokeModuleRole(bytes32 role, address account) external onlyRole(HermesConstants.ADMIN_ROLE) {
        poolManager.revokeRole(role, account);
        membershipManager.revokeRole(role, account);
        strategyManager.revokeRole(role, account);
        mockGMX.revokeRole(role, account);
    }
    
    // ============ 资金池冻结管理 ============
    
    /**
     * @dev 冻结资金池 (仅限管理员)
     */
    function freezePool(uint256 poolId, string memory reason) external onlyRole(HermesConstants.ADMIN_ROLE) {
        poolManager.freezePool(poolId, reason);
        emit PoolFrozen(poolId, msg.sender, reason);
    }
    
    /**
     * @dev 解冻资金池 (仅限管理员)
     */
    function unfreezePool(uint256 poolId) external onlyRole(HermesConstants.ADMIN_ROLE) {
        poolManager.unfreezePool(poolId);
        emit PoolUnfrozen(poolId, msg.sender);
    }
    
    /**
     * @dev 检查资金池是否被冻结
     */
    function isPoolFrozen(uint256 poolId) external view returns (bool) {
        return poolManager.isPoolFrozen(poolId);
    }
    
    /**
     * @dev 获取资金池冻结信息
     */
    function getPoolFreezeInfo(uint256 poolId) external view returns (bool isFrozen, uint256 frozenAt) {
        return poolManager.getPoolFreezeInfo(poolId);
    }
    
    // ============ 查询功能 ============
    
    function getModuleAddresses() external view returns (
        address _poolManager,
        address _membershipManager,
        address _strategyManager,
        address _mockGMX
    ) {
        return (
            address(poolManager),
            address(membershipManager),
            address(strategyManager),
            address(mockGMX)
        );
    }
    
    function getSystemInfo() external view returns (
        uint256 _totalFeesCollected,
        address _feeCollector,
        bool _paused
    ) {
        return (
            totalFeesCollected,
            feeCollector,
            paused()
        );
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
} 