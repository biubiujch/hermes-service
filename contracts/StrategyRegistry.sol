// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title StrategyRegistry
 * @dev 策略元数据注册与管理（参数化策略配置，最小化上链数据）
 * - 仅存关键索引与状态：owner、symbol、paramsHash、active、timestamps
 * - 通过事件携带完整配置（如 metadataURI），方便链下存储与检索
 * - 所有状态变更支持 EIP-712 签名 + nonce + deadline 防重放
 */
contract StrategyRegistry is Ownable, ReentrancyGuard {
  using ECDSA for bytes32;

  // EIP-712 域名分隔符
  bytes32 public DOMAIN_SEPARATOR;

  // 类型哈希
  bytes32 public constant CREATE_STRATEGY_TYPEHASH = keccak256(
    "CreateStrategy(address walletAddress,bytes32 paramsHash,bytes32 symbol,uint256 nonce,uint256 deadline)"
  );

  bytes32 public constant UPDATE_STRATEGY_TYPEHASH = keccak256(
    "UpdateStrategy(address walletAddress,uint256 strategyId,bytes32 paramsHash,uint256 nonce,uint256 deadline)"
  );

  bytes32 public constant SET_ACTIVE_TYPEHASH = keccak256(
    "SetStrategyActive(address walletAddress,uint256 strategyId,bool active,uint256 nonce,uint256 deadline)"
  );

  bytes32 public constant DELETE_STRATEGY_TYPEHASH = keccak256(
    "DeleteStrategy(address walletAddress,uint256 strategyId,uint256 nonce,uint256 deadline)"
  );

  struct Strategy {
    uint256 id;
    address owner;
    bytes32 symbol; // 如：bytes32("ETH")，以节省gas
    bytes32 paramsHash; // 策略参数的链下哈希（例如对JSON参数做keccak256）
    bool isActive;
    uint256 createdAt;
    uint256 updatedAt;
  }

  struct UserStrategies {
    uint256[] strategyIds;
    mapping(uint256 => bool) hasStrategy;
  }

  // 状态
  uint256 public nextStrategyId = 1;
  uint256 public maxStrategiesPerUser = 50; // 可由owner调整

  mapping(uint256 => Strategy) public strategies;
  mapping(address => UserStrategies) private userStrategies;
  mapping(address => uint256) public nonces; // 每个用户一份nonce，配合EIP-712

  // 事件（metadataURI 仅事件携带，不上链存储）
  event StrategyRegistered(
    uint256 indexed strategyId,
    address indexed owner,
    bytes32 indexed symbol,
    bytes32 paramsHash,
    string metadataURI
  );

  event StrategyUpdated(
    uint256 indexed strategyId,
    address indexed owner,
    bytes32 paramsHash,
    string metadataURI
  );

  event StrategyActivationChanged(
    uint256 indexed strategyId,
    address indexed owner,
    bool isActive
  );

  event StrategyDeleted(
    uint256 indexed strategyId,
    address indexed owner
  );

  event MaxStrategiesPerUserUpdated(uint256 newMax);

  // 错误
  error StrategyNotFound();
  error StrategyNotOwned();
  error StrategyNotActive();
  error MaxStrategiesReached();
  error InvalidSignature();
  error ExpiredSignature();
  error InvalidNonce();
  error InvalidParam();

  constructor(address initialOwner) Ownable(initialOwner) {
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(bytes("Hermora Strategy")),
        keccak256(bytes("1")),
        block.chainid,
        address(this)
      )
    );
  }

  // 内部：EIP-712 验签
  function verifySignature(
    address walletAddress,
    bytes32 messageHash,
    bytes memory signature
  ) internal view returns (address) {
    // 允许直接调用（signature.length == 0）
    if (signature.length == 0) {
      return walletAddress;
    }
    address signer = messageHash.recover(signature);
    if (signer != walletAddress) revert InvalidSignature();
    return signer;
  }

  // 内部：nonce + deadline 校验
  function verifyNonceAndDeadline(
    address walletAddress,
    uint256 nonce,
    uint256 deadline,
    bytes memory signature
  ) internal {
    if (signature.length == 0) {
      return; // 直接调用跳过
    }
    if (nonce != nonces[walletAddress]) revert InvalidNonce();
    if (block.timestamp > deadline) revert ExpiredSignature();
    nonces[walletAddress]++;
  }

  /**
   * @dev 注册策略（最小化上链：仅索引与哈希；完整参数由事件携带，链下存储）
   */
  function registerStrategy(
    address walletAddress,
    bytes32 paramsHash,
    bytes32 symbol,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature,
    string calldata metadataURI
  ) external nonReentrant returns (uint256) {
    if (symbol == bytes32(0) || paramsHash == bytes32(0)) revert InvalidParam();

    bytes32 messageHash = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            CREATE_STRATEGY_TYPEHASH,
            walletAddress,
            paramsHash,
            symbol,
            nonce,
            deadline
          )
        )
      )
    );

    verifySignature(walletAddress, messageHash, signature);
    verifyNonceAndDeadline(walletAddress, nonce, deadline, signature);

    if (userStrategies[walletAddress].strategyIds.length >= maxStrategiesPerUser) {
      revert MaxStrategiesReached();
    }

    uint256 strategyId = nextStrategyId++;
    strategies[strategyId] = Strategy({
      id: strategyId,
      owner: walletAddress,
      symbol: symbol,
      paramsHash: paramsHash,
      isActive: true,
      createdAt: block.timestamp,
      updatedAt: block.timestamp
    });

    userStrategies[walletAddress].strategyIds.push(strategyId);
    userStrategies[walletAddress].hasStrategy[strategyId] = true;

    emit StrategyRegistered(strategyId, walletAddress, symbol, paramsHash, metadataURI);
    return strategyId;
  }

  /**
   * @dev 更新策略参数哈希（链下参数变更时调用）。
   */
  function updateStrategy(
    address walletAddress,
    uint256 strategyId,
    bytes32 newParamsHash,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature,
    string calldata metadataURI
  ) external nonReentrant {
    if (newParamsHash == bytes32(0)) revert InvalidParam();

    bytes32 messageHash = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            UPDATE_STRATEGY_TYPEHASH,
            walletAddress,
            strategyId,
            newParamsHash,
            nonce,
            deadline
          )
        )
      )
    );

    verifySignature(walletAddress, messageHash, signature);
    verifyNonceAndDeadline(walletAddress, nonce, deadline, signature);

    Strategy storage s = strategies[strategyId];
    if (s.id == 0) revert StrategyNotFound();
    if (s.owner != walletAddress) revert StrategyNotOwned();
    if (!s.isActive) revert StrategyNotActive();

    s.paramsHash = newParamsHash;
    s.updatedAt = block.timestamp;

    emit StrategyUpdated(strategyId, walletAddress, newParamsHash, metadataURI);
  }

  /**
   * @dev 启用/禁用策略
   */
  function setStrategyActive(
    address walletAddress,
    uint256 strategyId,
    bool active,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
  ) external nonReentrant {
    bytes32 messageHash = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            SET_ACTIVE_TYPEHASH,
            walletAddress,
            strategyId,
            active,
            nonce,
            deadline
          )
        )
      )
    );

    verifySignature(walletAddress, messageHash, signature);
    verifyNonceAndDeadline(walletAddress, nonce, deadline, signature);

    Strategy storage s = strategies[strategyId];
    if (s.id == 0) revert StrategyNotFound();
    if (s.owner != walletAddress) revert StrategyNotOwned();

    s.isActive = active;
    s.updatedAt = block.timestamp;
    emit StrategyActivationChanged(strategyId, walletAddress, active);
  }

  /**
   * @dev 删除策略（标记为不可用并从用户列表移除）
   */
  function deleteStrategy(
    address walletAddress,
    uint256 strategyId,
    uint256 nonce,
    uint256 deadline,
    bytes calldata signature
  ) external nonReentrant {
    bytes32 messageHash = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(
          abi.encode(
            DELETE_STRATEGY_TYPEHASH,
            walletAddress,
            strategyId,
            nonce,
            deadline
          )
        )
      )
    );

    verifySignature(walletAddress, messageHash, signature);
    verifyNonceAndDeadline(walletAddress, nonce, deadline, signature);

    Strategy storage s = strategies[strategyId];
    if (s.id == 0) revert StrategyNotFound();
    if (s.owner != walletAddress) revert StrategyNotOwned();

    s.isActive = false;
    s.updatedAt = block.timestamp;

    // 从用户列表移除
    _removeStrategyFromUser(walletAddress, strategyId);

    emit StrategyDeleted(strategyId, walletAddress);
  }

  // 只读
  function getUserStrategies(address user) external view returns (uint256[] memory) {
    return userStrategies[user].strategyIds;
  }

  function getStrategy(uint256 strategyId) external view returns (Strategy memory) {
    return strategies[strategyId];
  }

  function getNonce(address user) external view returns (uint256) {
    return nonces[user];
  }

  function getDomainSeparator() external view returns (bytes32) {
    return DOMAIN_SEPARATOR;
  }

  // 管理员
  function setMaxStrategiesPerUser(uint256 newMax) external onlyOwner {
    maxStrategiesPerUser = newMax;
    emit MaxStrategiesPerUserUpdated(newMax);
  }

  // 内部工具
  function _removeStrategyFromUser(address user, uint256 strategyId) internal {
    uint256[] storage ids = userStrategies[user].strategyIds;
    for (uint256 i = 0; i < ids.length; i++) {
      if (ids[i] == strategyId) {
        ids[i] = ids[ids.length - 1];
        ids.pop();
        break;
      }
    }
    userStrategies[user].hasStrategy[strategyId] = false;
  }
}

