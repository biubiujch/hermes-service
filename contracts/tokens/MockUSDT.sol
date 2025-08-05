// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @dev 用于本地测试的Mock USDT代币
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private _decimals = 6; // USDT使用6位小数
    
    constructor(address initialOwner) ERC20("Mock USDT", "mUSDT") Ownable(initialOwner) {}
    
    /**
     * @dev 返回代币小数位数
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
    
    /**
     * @dev 铸造代币 (仅限管理员)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev 销毁代币 (仅限管理员)
     */
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
    
    /**
     * @dev 为测试目的，允许任何人铸造少量代币
     */
    function mintForTesting(uint256 amount) external {
        require(amount <= 1000 * 10**6, "Amount too large for testing"); // 最多1000 USDT
        _mint(msg.sender, amount);
    }
} 