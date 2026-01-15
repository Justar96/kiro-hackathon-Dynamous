// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISettlementVault
 * @notice Interface for Merkle-based batch settlement vault
 */
interface ISettlementVault {
    // ============ Structs ============

    struct Epoch {
        bytes32 merkleRoot;
        uint256 timestamp;
        uint256 totalAmount;
    }

    // ============ Events ============

    event Deposit(address indexed user, uint256 amount);
    event EpochCommitted(uint256 indexed epochId, bytes32 merkleRoot, uint256 totalAmount);
    event Claimed(address indexed user, uint256 indexed epochId, uint256 amount);

    // ============ Errors ============

    error NotOperator();
    error AlreadyClaimed();
    error InvalidProof();
    error ZeroAmount();
    error InsufficientDeposit();

    // ============ User Functions ============

    /// @notice Deposit collateral into the vault
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external;

    /// @notice Claim settlement using Merkle proof
    /// @param epochId The epoch to claim from
    /// @param amount Amount to claim
    /// @param proof Merkle proof
    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof) external;

    // ============ Operator Functions ============

    /// @notice Commit a new settlement epoch
    /// @param merkleRoot Root of the balance Merkle tree
    /// @param totalAmount Total amount in this epoch
    function commitEpoch(bytes32 merkleRoot, uint256 totalAmount) external;

    /// @notice Deduct from user deposit
    /// @param user User address
    /// @param amount Amount to deduct
    function deductDeposit(address user, uint256 amount) external;

    /// @notice Credit user deposit
    /// @param user User address
    /// @param amount Amount to credit
    function creditDeposit(address user, uint256 amount) external;

    // ============ Admin Functions ============

    /// @notice Set the operator address
    /// @param operator New operator address
    function setOperator(address operator) external;

    // ============ View Functions ============

    /// @notice Get epoch data
    function getEpoch(uint256 epochId) external view returns (Epoch memory);

    /// @notice Check if user has claimed for epoch
    function hasClaimed(address user, uint256 epochId) external view returns (bool);

    /// @notice Get user deposit balance
    function deposits(address user) external view returns (uint256);

    /// @notice Get current epoch number
    function currentEpoch() external view returns (uint256);

    /// @notice Get operator address
    function operator() external view returns (address);
}
