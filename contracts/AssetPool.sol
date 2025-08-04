// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AssetPool
 * @dev 资金池管理合约，负责用户资金的托管和策略执行时的资金转移
 */
contract AssetPool is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // 事件定义
    event Deposit(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event StrategyExecution(address indexed user, address indexed strategy, address indexed token, uint256 amount, uint256 timestamp);
    event StrategyReturn(address indexed user, address indexed strategy, address indexed token, uint256 amount, uint256 timestamp);
    event EmergencyWithdraw(address indexed user, address indexed token, uint256 amount, uint256 timestamp);
    event FeeCollected(address indexed token, uint256 amount, uint256 timestamp);

    // 状态变量
    mapping(address => mapping(address => uint256)) public userBalances; // user => token => balance
    mapping(address => bool) public authorizedStrategies; // 授权的策略合约
    mapping(address => bool) public authorizedTokens; // 支持的代币
    mapping(address => uint256) public totalPoolBalances; // token => total balance
    
    uint256 public constant FEE_RATE = 50; // 0.5% 手续费率 (basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    address public feeCollector; // 手续费收集地址
    uint256 public minDepositAmount = 0.01 ether; // 最小存款金额
    uint256 public maxPoolSize = 1000 ether; // 最大资金池规模

    // 修饰符
    modifier onlyAuthorizedStrategy() {
        require(authorizedStrategies[msg.sender], "AssetPool: Only authorized strategies can call this function");
        _;
    }

    modifier onlySupportedToken(address token) {
        require(authorizedTokens[token], "AssetPool: Token not supported");
        _;
    }

    modifier validAmount(uint256 amount) {
        require(amount > 0, "AssetPool: Amount must be greater than 0");
        _;
    }

    constructor(address _feeCollector) Ownable(msg.sender) {
        require(_feeCollector != address(0), "AssetPool: Invalid fee collector address");
        feeCollector = _feeCollector;
        
        // 默认支持ETH和常见代币
        authorizedTokens[address(0)] = true; // ETH
    }

    /**
     * @dev 用户存款到资金池
     * @param token 代币地址，address(0)表示ETH
     */
    function deposit(address token, uint256 amount) external payable onlySupportedToken(token) nonReentrant whenNotPaused {
        require(amount >= minDepositAmount, "AssetPool: Amount below minimum");
        
        if (token == address(0)) {
            // ETH存款
            require(msg.value == amount, "AssetPool: ETH amount mismatch");
        } else {
            // ERC20代币存款
            require(msg.value == 0, "AssetPool: ETH should not be sent for token deposit");
            
            // 转移代币到合约
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        // 检查资金池容量限制
        require(totalPoolBalances[token] + amount <= maxPoolSize, "AssetPool: Pool size limit exceeded");

        // 更新余额
        userBalances[msg.sender][token] += amount;
        totalPoolBalances[token] += amount;

        emit Deposit(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev 用户从资金池提取资金
     * @param token 代币地址
     * @param amount 提取金额
     */
    function withdraw(address token, uint256 amount) external onlySupportedToken(token) validAmount(amount) nonReentrant whenNotPaused {
        require(userBalances[msg.sender][token] >= amount, "AssetPool: Insufficient balance");
        
        // 计算手续费
        uint256 fee = (amount * FEE_RATE) / BASIS_POINTS;
        uint256 withdrawAmount = amount - fee;

        // 更新余额
        userBalances[msg.sender][token] -= amount;
        totalPoolBalances[token] -= amount;

        // 转移资金
        if (token == address(0)) {
            // 转移ETH
            (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
            require(success, "AssetPool: ETH transfer failed");
            
            if (fee > 0) {
                (bool feeSuccess, ) = payable(feeCollector).call{value: fee}("");
                require(feeSuccess, "AssetPool: Fee transfer failed");
                emit FeeCollected(token, fee, block.timestamp);
            }
        } else {
            // 转移ERC20代币
            IERC20(token).safeTransfer(msg.sender, withdrawAmount);
            
            if (fee > 0) {
                IERC20(token).safeTransfer(feeCollector, fee);
                emit FeeCollected(token, fee, block.timestamp);
            }
        }

        emit Withdraw(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev 策略执行时转移资金（仅授权策略可调用）
     * @param user 用户地址
     * @param token 代币地址
     * @param amount 转移金额
     */
    function transferToStrategy(address user, address token, uint256 amount) 
        external 
        onlyAuthorizedStrategy 
        onlySupportedToken(token) 
        validAmount(amount) 
        nonReentrant 
        whenNotPaused 
    {
        require(userBalances[user][token] >= amount, "AssetPool: Insufficient user balance");
        
        // 更新余额
        userBalances[user][token] -= amount;
        totalPoolBalances[token] -= amount;

        // 转移资金到策略合约
        if (token == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "AssetPool: ETH transfer to strategy failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }

        emit StrategyExecution(user, msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev 策略返回资金到用户账户
     * @param user 用户地址
     * @param token 代币地址
     * @param amount 返回金额
     */
    function returnFromStrategy(address user, address token, uint256 amount) 
        external 
        payable
        onlyAuthorizedStrategy 
        onlySupportedToken(token) 
        validAmount(amount) 
        nonReentrant 
        whenNotPaused 
    {
        // 检查资金池容量限制
        require(totalPoolBalances[token] + amount <= maxPoolSize, "AssetPool: Pool size limit exceeded");

        // 更新余额
        userBalances[user][token] += amount;
        totalPoolBalances[token] += amount;

        // 从策略合约接收资金
        if (token == address(0)) {
            require(msg.value == amount, "AssetPool: ETH amount mismatch");
        } else {
            IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        }

        emit StrategyReturn(user, msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev 紧急提取（暂停时可用）
     * @param token 代币地址
     */
    function emergencyWithdraw(address token) external onlySupportedToken(token) nonReentrant {
        uint256 balance = userBalances[msg.sender][token];
        require(balance > 0, "AssetPool: No balance to withdraw");

        // 清零用户余额
        userBalances[msg.sender][token] = 0;
        totalPoolBalances[token] -= balance;

        // 转移资金（紧急情况下不收手续费）
        if (token == address(0)) {
            (bool success, ) = payable(msg.sender).call{value: balance}("");
            require(success, "AssetPool: Emergency ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, balance);
        }

        emit EmergencyWithdraw(msg.sender, token, balance, block.timestamp);
    }

    // 管理员功能

    /**
     * @dev 添加授权策略
     * @param strategy 策略合约地址
     */
    function addAuthorizedStrategy(address strategy) external onlyOwner {
        require(strategy != address(0), "AssetPool: Invalid strategy address");
        authorizedStrategies[strategy] = true;
    }

    /**
     * @dev 移除授权策略
     * @param strategy 策略合约地址
     */
    function removeAuthorizedStrategy(address strategy) external onlyOwner {
        authorizedStrategies[strategy] = false;
    }

    /**
     * @dev 添加支持的代币
     * @param token 代币地址
     */
    function addSupportedToken(address token) external onlyOwner {
        require(token != address(0), "AssetPool: Invalid token address");
        authorizedTokens[token] = true;
    }

    /**
     * @dev 移除支持的代币
     * @param token 代币地址
     */
    function removeSupportedToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
    }

    /**
     * @dev 设置手续费收集地址
     * @param _feeCollector 新的手续费收集地址
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "AssetPool: Invalid fee collector address");
        feeCollector = _feeCollector;
    }

    /**
     * @dev 设置最小存款金额
     * @param _minDepositAmount 最小存款金额
     */
    function setMinDepositAmount(uint256 _minDepositAmount) external onlyOwner {
        minDepositAmount = _minDepositAmount;
    }

    /**
     * @dev 设置最大资金池规模
     * @param _maxPoolSize 最大资金池规模
     */
    function setMaxPoolSize(uint256 _maxPoolSize) external onlyOwner {
        maxPoolSize = _maxPoolSize;
    }

    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // 查询功能

    /**
     * @dev 获取用户余额
     * @param user 用户地址
     * @param token 代币地址
     * @return 用户余额
     */
    function getUserBalance(address user, address token) external view returns (uint256) {
        return userBalances[user][token];
    }

    /**
     * @dev 获取资金池总余额
     * @param token 代币地址
     * @return 资金池总余额
     */
    function getPoolBalance(address token) external view returns (uint256) {
        return totalPoolBalances[token];
    }

    /**
     * @dev 检查策略是否已授权
     * @param strategy 策略地址
     * @return 是否已授权
     */
    function isStrategyAuthorized(address strategy) external view returns (bool) {
        return authorizedStrategies[strategy];
    }

    /**
     * @dev 检查代币是否支持
     * @param token 代币地址
     * @return 是否支持
     */
    function isTokenSupported(address token) external view returns (bool) {
        return authorizedTokens[token];
    }

    // 接收ETH的回退函数
    receive() external payable {
        // 允许接收ETH
    }

    fallback() external payable {
        // 回退函数
    }
}
