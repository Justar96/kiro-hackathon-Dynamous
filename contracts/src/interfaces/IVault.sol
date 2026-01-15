// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IVault
 * @notice Interface for non-custodial collateral vault
 */
interface IVault {
    // ============ Events ============

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event OperatorWithdrawal(address indexed user, uint256 amount, address indexed operator);

    // ============ Errors ============

    error Paused();
    error NotOperator();
    error ZeroAmount();

    // ============ User Functions ============

    /// @notice Deposit collateral into the vault
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external;

    // ============ Operator Functions ============

    /// @notice Withdraw collateral for a user (operator only)
    /// @param user User to withdraw for
    /// @param amount Amount to withdraw
    function withdrawFor(address user, uint256 amount) external;

    // ============ Admin Functions ============

    /// @notice Set the operator address
    function setOperator(address operator) external;

    /// @notice Pause/unpause the vault
    function setPaused(bool paused) external;

    // ============ View Functions ============

    /// @notice Get vault collateral balance
    function balance() external view returns (uint256);

    /// @notice Get collateral token address
    function collateral() external view returns (IERC20);

    /// @notice Get operator address
    function operator() external view returns (address);

    /// @notice Check if vault is paused
    function paused() external view returns (bool);
}
