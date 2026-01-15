// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IVault} from "./interfaces/IVault.sol";

/**
 * @title Vault
 * @author Thesis App
 * @notice Non-custodial vault for user collateral deposits
 * @dev Users deposit collateral; operator can withdraw on their behalf for settlements
 */
contract Vault is IVault, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ State ============

    /// @inheritdoc IVault
    IERC20 public immutable collateral;
    
    /// @inheritdoc IVault
    address public operator;
    
    /// @inheritdoc IVault
    bool public paused;

    // ============ Constructor ============

    constructor(address collateral_, address operator_) Ownable(msg.sender) {
        collateral = IERC20(collateral_);
        operator = operator_;
    }

    // ============ Modifiers ============

    modifier notPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ============ User Functions ============

    /// @inheritdoc IVault
    function deposit(uint256 amount) external nonReentrant notPaused {
        if (amount == 0) revert ZeroAmount();
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    // ============ Operator Functions ============

    /// @inheritdoc IVault
    function withdrawFor(address user, uint256 amount) external nonReentrant onlyOperator {
        if (amount == 0) revert ZeroAmount();
        collateral.safeTransfer(user, amount);
        emit OperatorWithdrawal(user, amount, msg.sender);
    }

    // ============ Admin Functions ============

    /// @inheritdoc IVault
    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
    }

    /// @inheritdoc IVault
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
    }

    // ============ View Functions ============

    /// @inheritdoc IVault
    function balance() external view returns (uint256) {
        return collateral.balanceOf(address(this));
    }
}
