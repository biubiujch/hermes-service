// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Vault
 * @dev 用户资金池管理合约
 * 支持用户创建多个资金池，管理自己的资金，支持手续费收集
 */
contract Vault is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  // 资金池结构
  struct Pool {
    uint256 id;
    address owner;
    uint256 totalBalance;
    bool isActive;
    uint256 createdAt;
    uint256 lastActivityAt;
  }

  // 用户资金池映射
  struct UserPools {
    uint256[] poolIds;
    mapping(uint256 => bool) hasPool;
  }

  // 状态变量
  uint256 public nextPoolId = 1;
  uint256 public maxPoolsPerUser = 10; // 每个用户最大资金池数量，可配置
  uint256 public minPoolBalance = 0.001 ether; // 最小资金池余额，可配置
  uint256 public feeRate = 5; // 手续费率 0.05% (5/10000)
  address public feeCollector; // 手续费收集地址

  // 映射
  mapping(uint256 => Pool) public pools;
  mapping(address => UserPools) private userPools;
  mapping(address => bool) public supportedTokens; // 支持的代币列表

  // 事件
  event PoolCreated(uint256 indexed poolId, address indexed owner, uint256 initialAmount);
  event PoolDeleted(uint256 indexed poolId, address indexed owner, uint256 finalAmount);
  event PoolMerged(uint256 indexed targetPoolId, uint256 indexed sourcePoolId, address indexed owner);
  event FundsDeposited(uint256 indexed poolId, address indexed owner, address token, uint256 amount);
  event FundsWithdrawn(uint256 indexed poolId, address indexed owner, address token, uint256 amount, uint256 fee);
  event FeeCollected(address indexed token, uint256 amount);
  event MaxPoolsPerUserUpdated(uint256 newMax);
  event MinPoolBalanceUpdated(uint256 newMin);
  event FeeRateUpdated(uint256 newRate);
  event FeeCollectorUpdated(address newCollector);
  event TokenSupported(address indexed token, bool supported);

  // 错误定义
  error PoolNotFound();
  error PoolNotActive();
  error PoolNotOwned();
  error MaxPoolsReached();
  error InsufficientBalance();
  error InvalidAmount();
  error InvalidToken();
  error InvalidFeeCollector();
  error PoolMergeFailed();
  error GasInsufficient();

  constructor(address initialOwner, address _feeCollector) Ownable(initialOwner) {
    feeCollector = _feeCollector;
  }

  /**
   * @dev 创建资金池
   * @param initialAmount 初始资金数量
   */
  function createPool(uint256 initialAmount) external payable nonReentrant returns (uint256) {
    address user = msg.sender;

    // 检查用户资金池数量限制
    if (userPools[user].poolIds.length >= maxPoolsPerUser) {
      revert MaxPoolsReached();
    }

    // 验证初始资金
    if (initialAmount == 0 && msg.value == 0) {
      revert InvalidAmount();
    }

    uint256 poolId = nextPoolId++;
    uint256 totalAmount = initialAmount + msg.value;

    // 创建资金池
    pools[poolId] = Pool({id: poolId, owner: user, totalBalance: totalAmount, isActive: true, createdAt: block.timestamp, lastActivityAt: block.timestamp});

    // 添加到用户资金池列表
    userPools[user].poolIds.push(poolId);
    userPools[user].hasPool[poolId] = true;

    emit PoolCreated(poolId, user, totalAmount);

    return poolId;
  }

  /**
   * @dev 删除资金池（资金自动转出）
   * @param poolId 资金池ID
   */
  function deletePool(uint256 poolId) external nonReentrant {
    Pool storage pool = pools[poolId];

    if (pool.id == 0) {
      revert PoolNotFound();
    }

    if (!pool.isActive) {
      revert PoolNotActive();
    }

    if (pool.owner != msg.sender) {
      revert PoolNotOwned();
    }

    uint256 finalAmount = pool.totalBalance;

    // 标记资金池为非活跃
    pool.isActive = false;
    pool.lastActivityAt = block.timestamp;

    // 从用户资金池列表中移除
    _removePoolFromUser(pool.owner, poolId);

    // 转出资金
    if (finalAmount > 0) {
      // 检查是否有足够资金支付gas费用
      if (finalAmount < minPoolBalance) {
        // 资金太少，直接转给手续费收集者
        (bool success, ) = feeCollector.call{value: finalAmount}("");
        if (!success) {
          revert GasInsufficient();
        }
        emit FeeCollected(address(0), finalAmount);
      } else {
        // 正常转出
        (bool success, ) = pool.owner.call{value: finalAmount}("");
        if (!success) {
          revert GasInsufficient();
        }
      }
    }

    emit PoolDeleted(poolId, pool.owner, finalAmount);
  }

  /**
   * @dev 合并资金池
   * @param targetPoolId 目标资金池ID
   * @param sourcePoolId 源资金池ID
   */
  function mergePools(uint256 targetPoolId, uint256 sourcePoolId) external nonReentrant {
    Pool storage targetPool = pools[targetPoolId];
    Pool storage sourcePool = pools[sourcePoolId];

    // 验证资金池存在且属于同一用户
    if (targetPool.id == 0 || sourcePool.id == 0) {
      revert PoolNotFound();
    }

    if (!targetPool.isActive || !sourcePool.isActive) {
      revert PoolNotActive();
    }

    if (targetPool.owner != msg.sender || sourcePool.owner != msg.sender) {
      revert PoolNotOwned();
    }

    if (targetPoolId == sourcePoolId) {
      revert InvalidAmount();
    }

    uint256 sourceAmount = sourcePool.totalBalance;

    // 将源资金池的资金转移到目标资金池
    targetPool.totalBalance += sourceAmount;
    targetPool.lastActivityAt = block.timestamp;

    // 删除源资金池
    sourcePool.isActive = false;
    sourcePool.lastActivityAt = block.timestamp;
    _removePoolFromUser(msg.sender, sourcePoolId);

    emit PoolMerged(targetPoolId, sourcePoolId, msg.sender);
  }

  /**
   * @dev 存入资金到资金池
   * @param poolId 资金池ID
   * @param token 代币地址（0x0表示ETH）
   * @param amount 存入金额
   */
  function deposit(uint256 poolId, address token, uint256 amount) external payable nonReentrant {
    Pool storage pool = pools[poolId];

    if (pool.id == 0) {
      revert PoolNotFound();
    }

    if (!pool.isActive) {
      revert PoolNotActive();
    }

    if (pool.owner != msg.sender) {
      revert PoolNotOwned();
    }

    uint256 depositAmount;

    if (token == address(0)) {
      // ETH存款
      depositAmount = msg.value;
      if (depositAmount == 0) {
        revert InvalidAmount();
      }
    } else {
      // ERC20代币存款
      if (!supportedTokens[token]) {
        revert InvalidToken();
      }
      if (amount == 0) {
        revert InvalidAmount();
      }
      depositAmount = amount;

      // 转移代币到合约
      IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    pool.totalBalance += depositAmount;
    pool.lastActivityAt = block.timestamp;

    emit FundsDeposited(poolId, msg.sender, token, depositAmount);
  }

  /**
   * @dev 从资金池取出资金
   * @param poolId 资金池ID
   * @param token 代币地址（0x0表示ETH）
   * @param amount 取出金额
   */
  function withdraw(uint256 poolId, address token, uint256 amount) external nonReentrant {
    Pool storage pool = pools[poolId];

    if (pool.id == 0) {
      revert PoolNotFound();
    }

    if (!pool.isActive) {
      revert PoolNotActive();
    }

    if (pool.owner != msg.sender) {
      revert PoolNotOwned();
    }

    if (amount == 0 || amount > pool.totalBalance) {
      revert InvalidAmount();
    }

    // 计算手续费
    uint256 fee = (amount * feeRate) / 10000;
    uint256 withdrawAmount = amount - fee;

    pool.totalBalance -= amount;
    pool.lastActivityAt = block.timestamp;

    // 转移资金
    if (token == address(0)) {
      // ETH提现
      if (fee > 0) {
        (bool feeSuccess, ) = feeCollector.call{value: fee}("");
        if (!feeSuccess) {
          revert GasInsufficient();
        }
        emit FeeCollected(address(0), fee);
      }

      (bool success, ) = msg.sender.call{value: withdrawAmount}("");
      if (!success) {
        revert GasInsufficient();
      }
    } else {
      // ERC20代币提现
      if (!supportedTokens[token]) {
        revert InvalidToken();
      }

      if (fee > 0) {
        IERC20(token).safeTransfer(feeCollector, fee);
        emit FeeCollected(token, fee);
      }

      IERC20(token).safeTransfer(msg.sender, withdrawAmount);
    }

    emit FundsWithdrawn(poolId, msg.sender, token, withdrawAmount, fee);
  }

  /**
   * @dev 获取用户的所有资金池
   * @param user 用户地址
   * @return 资金池ID数组
   */
  function getUserPools(address user) external view returns (uint256[] memory) {
    return userPools[user].poolIds;
  }

  /**
   * @dev 获取资金池详情
   * @param poolId 资金池ID
   * @return 资金池信息
   */
  function getPool(uint256 poolId) external view returns (Pool memory) {
    return pools[poolId];
  }

  /**
   * @dev 获取用户资金池数量
   * @param user 用户地址
   * @return 资金池数量
   */
  function getUserPoolCount(address user) external view returns (uint256) {
    return userPools[user].poolIds.length;
  }

  // 管理员功能

  /**
   * @dev 设置每个用户最大资金池数量
   * @param newMax 新的最大数量
   */
  function setMaxPoolsPerUser(uint256 newMax) external onlyOwner {
    maxPoolsPerUser = newMax;
    emit MaxPoolsPerUserUpdated(newMax);
  }

  /**
   * @dev 设置最小资金池余额
   * @param newMin 新的最小余额
   */
  function setMinPoolBalance(uint256 newMin) external onlyOwner {
    minPoolBalance = newMin;
    emit MinPoolBalanceUpdated(newMin);
  }

  /**
   * @dev 设置手续费率
   * @param newRate 新的手续费率（基点）
   */
  function setFeeRate(uint256 newRate) external onlyOwner {
    feeRate = newRate;
    emit FeeRateUpdated(newRate);
  }

  /**
   * @dev 设置手续费收集地址
   * @param newCollector 新的收集地址
   */
  function setFeeCollector(address newCollector) external onlyOwner {
    if (newCollector == address(0)) {
      revert InvalidFeeCollector();
    }
    feeCollector = newCollector;
    emit FeeCollectorUpdated(newCollector);
  }

  /**
   * @dev 设置代币支持状态
   * @param token 代币地址
   * @param supported 是否支持
   */
  function setTokenSupported(address token, bool supported) external onlyOwner {
    supportedTokens[token] = supported;
    emit TokenSupported(token, supported);
  }

  /**
   * @dev 紧急提取合约中的代币（仅限owner）
   * @param token 代币地址
   * @param to 接收地址
   * @param amount 提取金额
   */
  function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
    if (token == address(0)) {
      (bool success, ) = to.call{value: amount}("");
      if (!success) {
        revert GasInsufficient();
      }
    } else {
      IERC20(token).safeTransfer(to, amount);
    }
  }

  // 内部函数

  /**
   * @dev 从用户资金池列表中移除资金池
   * @param user 用户地址
   * @param poolId 资金池ID
   */
  function _removePoolFromUser(address user, uint256 poolId) internal {
    uint256[] storage poolIds = userPools[user].poolIds;
    for (uint256 i = 0; i < poolIds.length; i++) {
      if (poolIds[i] == poolId) {
        poolIds[i] = poolIds[poolIds.length - 1];
        poolIds.pop();
        break;
      }
    }
    userPools[user].hasPool[poolId] = false;
  }

  // 接收ETH
  receive() external payable {}
}
