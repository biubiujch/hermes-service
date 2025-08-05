// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/HermesConstants.sol";
import "../tokens/MockUSDT.sol";

/**
 * @title MockGMX
 * @dev Mock GMX交易合约，用于本地测试
 */
contract MockGMX is AccessControl, ReentrancyGuard, Pausable {
    using HermesConstants for *;
    
    MockUSDT public immutable usdtToken;
    
    struct Position {
        uint256 id;
        address owner;
        string symbol;
        bool isLong;
        uint256 size;
        uint256 collateral;
        uint256 entryPrice;
        uint256 currentPrice;
        uint256 pnl;
        uint256 createdAt;
        bool isActive;
    }
    
    struct Market {
        string symbol;
        uint256 currentPrice;
        uint256 lastUpdateTime;
        bool isActive;
        uint256 volume24h;
        uint256 openInterest;
    }
    
    // 状态变量
    uint256 private _nextPositionId = 1;
    mapping(uint256 => Position) public positions;
    mapping(string => Market) public markets;
    mapping(address => uint256[]) public userPositions;
    mapping(address => uint256) public userPositionCount;
    
    // 事件
    event PositionOpened(uint256 indexed positionId, address indexed owner, string symbol, bool isLong, uint256 size, uint256 collateral);
    event PositionClosed(uint256 indexed positionId, address indexed owner, uint256 pnl);
    event MarketPriceUpdated(string symbol, uint256 oldPrice, uint256 newPrice);
    event TradeExecuted(uint256 indexed positionId, string symbol, bool isLong, uint256 size, uint256 price);
    
    constructor(address _usdtToken, address admin) {
        usdtToken = MockUSDT(_usdtToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(HermesConstants.ADMIN_ROLE, admin);
        _grantRole(HermesConstants.OPERATOR_ROLE, admin);
        
        // 初始化一些测试市场
        _initializeMarkets();
    }
    
    /**
     * @dev 开仓
     */
    function openPosition(
        address owner,
        string memory symbol,
        bool isLong,
        uint256 size,
        uint256 collateral
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) nonReentrant returns (uint256) {
        require(markets[symbol].isActive, "Market not active");
        require(size > 0, "Size must be greater than 0");
        require(collateral > 0, "Collateral must be greater than 0");
        require(usdtToken.transferFrom(msg.sender, address(this), collateral), "Collateral transfer failed");
        
        uint256 positionId = _nextPositionId++;
        uint256 currentPrice = markets[symbol].currentPrice;
        
        positions[positionId] = Position({
            id: positionId,
            owner: owner,
            symbol: symbol,
            isLong: isLong,
            size: size,
            collateral: collateral,
            entryPrice: currentPrice,
            currentPrice: currentPrice,
            pnl: 0,
            createdAt: block.timestamp,
            isActive: true
        });
        
        userPositions[owner].push(positionId);
        userPositionCount[owner]++;
        
        // 更新市场数据
        markets[symbol].volume24h += size;
        markets[symbol].openInterest += size;
        
        emit PositionOpened(positionId, owner, symbol, isLong, size, collateral);
        emit TradeExecuted(positionId, symbol, isLong, size, currentPrice);
        
        return positionId;
    }
    
    /**
     * @dev 平仓
     */
    function closePosition(
        uint256 positionId,
        uint256 closeSize
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) nonReentrant returns (uint256 pnl) {
        Position storage position = positions[positionId];
        require(position.isActive, "Position is not active");
        require(closeSize <= position.size, "Close size exceeds position size");
        
        string memory symbol = position.symbol;
        uint256 currentPrice = markets[symbol].currentPrice;
        
        // 计算盈亏
        if (position.isLong) {
            pnl = (currentPrice - position.entryPrice) * closeSize / position.entryPrice;
        } else {
            pnl = (position.entryPrice - currentPrice) * closeSize / position.entryPrice;
        }
        
        // 更新仓位
        position.size -= closeSize;
        position.currentPrice = currentPrice;
        position.pnl += pnl;
        
        // 计算返还的抵押品
        uint256 collateralToReturn = (position.collateral * closeSize) / (position.size + closeSize);
        position.collateral -= collateralToReturn;
        
        // 如果仓位完全平仓
        if (position.size == 0) {
            position.isActive = false;
            position.collateral = 0;
        }
        
        // 更新市场数据
        markets[symbol].volume24h += closeSize;
        markets[symbol].openInterest -= closeSize;
        
        // 转账给用户
        uint256 totalReturn = collateralToReturn + pnl;
        if (totalReturn > 0) {
            require(usdtToken.transfer(position.owner, totalReturn), "Return transfer failed");
        }
        
        emit PositionClosed(positionId, position.owner, pnl);
        emit TradeExecuted(positionId, symbol, !position.isLong, closeSize, currentPrice);
        
        return pnl;
    }
    
    /**
     * @dev 更新市场价格
     */
    function updateMarketPrice(
        string memory symbol,
        uint256 newPrice
    ) external onlyRole(HermesConstants.OPERATOR_ROLE) {
        require(markets[symbol].isActive, "Market not active");
        require(newPrice > 0, "Price must be greater than 0");
        
        uint256 oldPrice = markets[symbol].currentPrice;
        markets[symbol].currentPrice = newPrice;
        markets[symbol].lastUpdateTime = block.timestamp;
        
        emit MarketPriceUpdated(symbol, oldPrice, newPrice);
    }
    
    /**
     * @dev 获取仓位信息
     */
    function getPosition(uint256 positionId) external view returns (
        address owner,
        string memory symbol,
        bool isLong,
        uint256 size,
        uint256 collateral,
        uint256 entryPrice,
        uint256 currentPrice,
        uint256 pnl,
        bool isActive
    ) {
        Position storage position = positions[positionId];
        return (
            position.owner,
            position.symbol,
            position.isLong,
            position.size,
            position.collateral,
            position.entryPrice,
            position.currentPrice,
            position.pnl,
            position.isActive
        );
    }
    
    /**
     * @dev 获取市场信息
     */
    function getMarket(string memory symbol) external view returns (
        uint256 currentPrice,
        uint256 lastUpdateTime,
        bool isActive,
        uint256 volume24h,
        uint256 openInterest
    ) {
        Market storage market = markets[symbol];
        return (
            market.currentPrice,
            market.lastUpdateTime,
            market.isActive,
            market.volume24h,
            market.openInterest
        );
    }
    
    /**
     * @dev 获取用户的所有仓位ID
     */
    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }
    
    /**
     * @dev 获取用户仓位数量
     */
    function getUserPositionCount(address user) external view returns (uint256) {
        return userPositionCount[user];
    }
    
    /**
     * @dev 计算仓位盈亏
     */
    function calculatePnl(uint256 positionId) external view returns (uint256) {
        Position storage position = positions[positionId];
        if (!position.isActive) {
            return position.pnl;
        }
        
        uint256 currentPrice = markets[position.symbol].currentPrice;
        uint256 unrealizedPnl;
        
        if (position.isLong) {
            unrealizedPnl = (currentPrice - position.entryPrice) * position.size / position.entryPrice;
        } else {
            unrealizedPnl = (position.entryPrice - currentPrice) * position.size / position.entryPrice;
        }
        
        return position.pnl + unrealizedPnl;
    }
    
    /**
     * @dev 获取所有活跃市场
     */
    function getActiveMarkets() external view returns (string[] memory) {
        // 这里简化处理，返回预定义的市场列表
        string[] memory activeMarkets = new string[](5);
        activeMarkets[0] = "BTC/USD";
        activeMarkets[1] = "ETH/USD";
        activeMarkets[2] = "SOL/USD";
        activeMarkets[3] = "AVAX/USD";
        activeMarkets[4] = "ARB/USD";
        return activeMarkets;
    }
    
    // 内部函数
    
    function _initializeMarkets() internal {
        // 初始化测试市场
        markets["BTC/USD"] = Market({
            symbol: "BTC/USD",
            currentPrice: 45000 * 10**6, // 45000 USDT
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
        
        markets["ETH/USD"] = Market({
            symbol: "ETH/USD",
            currentPrice: 3000 * 10**6, // 3000 USDT
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
        
        markets["SOL/USD"] = Market({
            symbol: "SOL/USD",
            currentPrice: 100 * 10**6, // 100 USDT
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
        
        markets["AVAX/USD"] = Market({
            symbol: "AVAX/USD",
            currentPrice: 25 * 10**6, // 25 USDT
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
        
        markets["ARB/USD"] = Market({
            symbol: "ARB/USD",
            currentPrice: 1 * 10**6, // 1 USDT
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
    }
    
    // 管理员功能
    
    function pause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(HermesConstants.ADMIN_ROLE) {
        _unpause();
    }
    
    function addMarket(string memory symbol, uint256 initialPrice) external onlyRole(HermesConstants.ADMIN_ROLE) {
        require(!markets[symbol].isActive, "Market already exists");
        require(initialPrice > 0, "Initial price must be greater than 0");
        
        markets[symbol] = Market({
            symbol: symbol,
            currentPrice: initialPrice,
            lastUpdateTime: block.timestamp,
            isActive: true,
            volume24h: 0,
            openInterest: 0
        });
    }
    
    function emergencyClosePosition(uint256 positionId) external onlyRole(HermesConstants.ADMIN_ROLE) {
        Position storage position = positions[positionId];
        require(position.isActive, "Position is not active");
        
        position.isActive = false;
        require(usdtToken.transfer(position.owner, position.collateral), "Emergency close failed");
    }
} 