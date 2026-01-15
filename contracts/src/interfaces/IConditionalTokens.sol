// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IConditionalTokens
 * @notice Interface for the Gnosis Conditional Token Framework (CTF)
 * @dev This interface is compatible with Solidity 0.8.x and mirrors the original CTF contract
 *      deployed at 0x4d97dcd97ec945f40cf65f87097ace5ea0476045 on Polygon
 */
interface IConditionalTokens {
    // ============ Events ============

    /// @dev Emitted upon the successful preparation of a condition
    event ConditionPreparation(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256 outcomeSlotCount
    );

    /// @dev Emitted when a condition is resolved
    event ConditionResolution(
        bytes32 indexed conditionId,
        address indexed oracle,
        bytes32 indexed questionId,
        uint256 outcomeSlotCount,
        uint256[] payoutNumerators
    );

    /// @dev Emitted when a position is successfully split
    event PositionSplit(
        address indexed stakeholder,
        IERC20 collateralToken,
        bytes32 indexed parentCollectionId,
        bytes32 indexed conditionId,
        uint256[] partition,
        uint256 amount
    );

    /// @dev Emitted when positions are successfully merged
    event PositionsMerge(
        address indexed stakeholder,
        IERC20 collateralToken,
        bytes32 indexed parentCollectionId,
        bytes32 indexed conditionId,
        uint256[] partition,
        uint256 amount
    );

    /// @dev Emitted when positions are redeemed for payout
    event PayoutRedemption(
        address indexed redeemer,
        IERC20 indexed collateralToken,
        bytes32 indexed parentCollectionId,
        bytes32 conditionId,
        uint256[] indexSets,
        uint256 payout
    );

    // ============ State Variables ============

    /// @notice Get the payout numerator for a specific outcome slot
    /// @param conditionId The condition ID
    /// @param index The outcome slot index
    /// @return The payout numerator for that slot
    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256);

    /// @notice Get the payout denominator for a condition (non-zero means resolved)
    /// @param conditionId The condition ID
    /// @return The payout denominator
    function payoutDenominator(bytes32 conditionId) external view returns (uint256);

    // ============ ERC-1155 Functions ============

    /// @notice Get the balance of a specific token for an account
    /// @param account The address to query
    /// @param id The token ID (position ID)
    /// @return The balance
    function balanceOf(address account, uint256 id) external view returns (uint256);

    /// @notice Get balances for multiple account/token pairs
    /// @param accounts Array of addresses
    /// @param ids Array of token IDs
    /// @return Array of balances
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids)
        external
        view
        returns (uint256[] memory);

    /// @notice Set approval for an operator to manage all tokens
    /// @param operator The operator address
    /// @param approved Whether to approve or revoke
    function setApprovalForAll(address operator, bool approved) external;

    /// @notice Check if an operator is approved for all tokens
    /// @param account The token owner
    /// @param operator The operator address
    /// @return Whether the operator is approved
    function isApprovedForAll(address account, address operator) external view returns (bool);

    /// @notice Transfer tokens from one address to another
    /// @param from Source address
    /// @param to Destination address
    /// @param id Token ID
    /// @param amount Amount to transfer
    /// @param data Additional data
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external;

    /// @notice Batch transfer tokens
    /// @param from Source address
    /// @param to Destination address
    /// @param ids Array of token IDs
    /// @param amounts Array of amounts
    /// @param data Additional data
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] calldata ids,
        uint256[] calldata amounts,
        bytes calldata data
    ) external;

    // ============ CTF Core Functions ============

    /// @notice Prepare a new condition for outcome token trading
    /// @param oracle The account that will report the result
    /// @param questionId Unique identifier for the question
    /// @param outcomeSlotCount Number of possible outcomes (max 256)
    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external;

    /// @notice Report the payouts for a condition (oracle only)
    /// @param questionId The question ID being resolved
    /// @param payouts Array of payout numerators for each outcome
    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external;

    /// @notice Split collateral into outcome tokens
    /// @param collateralToken The ERC-20 token used as collateral
    /// @param parentCollectionId Parent collection (bytes32(0) for root)
    /// @param conditionId The condition to split on
    /// @param partition Array of index sets representing the partition
    /// @param amount Amount of collateral to split
    function splitPosition(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @notice Merge outcome tokens back into collateral
    /// @param collateralToken The ERC-20 token used as collateral
    /// @param parentCollectionId Parent collection (bytes32(0) for root)
    /// @param conditionId The condition to merge on
    /// @param partition Array of index sets representing the partition
    /// @param amount Amount of tokens to merge
    function mergePositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata partition,
        uint256 amount
    ) external;

    /// @notice Redeem winning positions for collateral after resolution
    /// @param collateralToken The ERC-20 token used as collateral
    /// @param parentCollectionId Parent collection (bytes32(0) for root)
    /// @param conditionId The resolved condition
    /// @param indexSets Array of index sets to redeem
    function redeemPositions(
        IERC20 collateralToken,
        bytes32 parentCollectionId,
        bytes32 conditionId,
        uint256[] calldata indexSets
    ) external;

    // ============ View Functions ============

    /// @notice Get the number of outcome slots for a condition
    /// @param conditionId The condition ID
    /// @return Number of outcome slots (0 if not prepared)
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256);

    /// @notice Compute a condition ID from its components
    /// @param oracle The oracle address
    /// @param questionId The question ID
    /// @param outcomeSlotCount Number of outcomes
    /// @return The condition ID
    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        external
        pure
        returns (bytes32);

    /// @notice Compute a collection ID
    /// @param parentCollectionId Parent collection ID
    /// @param conditionId Condition ID
    /// @param indexSet Index set for the collection
    /// @return The collection ID
    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        external
        view
        returns (bytes32);

    /// @notice Compute a position ID (ERC-1155 token ID)
    /// @param collateralToken The collateral token address
    /// @param collectionId The collection ID
    /// @return The position ID
    function getPositionId(IERC20 collateralToken, bytes32 collectionId) external pure returns (uint256);
}
