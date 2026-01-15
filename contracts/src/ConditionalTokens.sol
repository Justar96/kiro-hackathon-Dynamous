// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {CTFHelpers} from "./libraries/CTFHelpers.sol";

/**
 * @title ConditionalTokens
 * @notice ERC-1155 implementation of the Gnosis Conditional Token Framework
 * @dev Manages outcome tokens for binary prediction markets
 *      - Conditions are prepared with an oracle and question ID
 *      - Collateral can be split into YES/NO outcome tokens
 *      - Equal YES/NO tokens can be merged back into collateral
 *      - After resolution, winning tokens can be redeemed for collateral
 */
contract ConditionalTokens is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;

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

    // ============ Errors ============

    error TooManyOutcomeSlots();
    error TooFewOutcomeSlots();
    error ConditionAlreadyPrepared();
    error ConditionNotPrepared();
    error ConditionAlreadyResolved();
    error ConditionNotResolved();
    error InvalidPartition();
    error PartitionNotDisjoint();
    error InvalidIndexSet();
    error PayoutAllZeroes();
    error PayoutNumeratorAlreadySet();
    error ZeroAmount();

    // ============ State Variables ============

    /// @notice Payout numerators for each outcome slot of a condition
    /// @dev conditionId => outcomeIndex => numerator
    mapping(bytes32 => uint256[]) private _payoutNumerators;

    /// @notice Payout denominator for a condition (non-zero means resolved)
    /// @dev conditionId => denominator
    mapping(bytes32 => uint256) private _payoutDenominator;

    /// @notice Total supply tracking for each position ID
    /// @dev positionId => totalSupply
    mapping(uint256 => uint256) private _totalSupply;

    // ============ Constructor ============

    constructor() ERC1155("") {}

    // ============ External View Functions ============

    /// @notice Get the payout numerator for a specific outcome slot
    /// @param conditionId The condition ID
    /// @param index The outcome slot index
    /// @return The payout numerator for that slot
    function payoutNumerators(bytes32 conditionId, uint256 index) external view returns (uint256) {
        return _payoutNumerators[conditionId][index];
    }

    /// @notice Get the payout denominator for a condition (non-zero means resolved)
    /// @param conditionId The condition ID
    /// @return The payout denominator
    function payoutDenominator(bytes32 conditionId) external view returns (uint256) {
        return _payoutDenominator[conditionId];
    }

    /// @notice Gets the outcome slot count of a condition
    /// @param conditionId ID of the condition
    /// @return Number of outcome slots, or zero if not prepared
    function getOutcomeSlotCount(bytes32 conditionId) external view returns (uint256) {
        return _payoutNumerators[conditionId].length;
    }

    /// @notice Compute a condition ID from its components
    /// @param oracle The oracle address
    /// @param questionId The question ID
    /// @param outcomeSlotCount Number of outcomes
    /// @return The condition ID
    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        external
        pure
        returns (bytes32)
    {
        return CTFHelpers.getConditionId(oracle, questionId, outcomeSlotCount);
    }

    /// @notice Compute a collection ID
    /// @param parentCollectionId Parent collection ID
    /// @param conditionId Condition ID
    /// @param indexSet Index set for the collection
    /// @return The collection ID
    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        external
        pure
        returns (bytes32)
    {
        return CTFHelpers.getCollectionId(parentCollectionId, conditionId, indexSet);
    }

    /// @notice Compute a position ID (ERC-1155 token ID)
    /// @param collateralToken The collateral token address
    /// @param collectionId The collection ID
    /// @return The position ID
    function getPositionId(IERC20 collateralToken, bytes32 collectionId) external pure returns (uint256) {
        return CTFHelpers.getPositionId(collateralToken, collectionId);
    }

    /// @notice Get the total supply of a position token
    /// @param positionId The position ID (ERC-1155 token ID)
    /// @return The total supply
    function totalSupply(uint256 positionId) external view returns (uint256) {
        return _totalSupply[positionId];
    }

    // ============ External State-Changing Functions ============

    /// @notice Prepare a new condition for outcome token trading
    /// @param oracle The account that will report the result
    /// @param questionId Unique identifier for the question
    /// @param outcomeSlotCount Number of possible outcomes (max 256)
    function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external nonReentrant {
        // Limit of 256 because we use a partition array that is a number of 256 bits
        if (outcomeSlotCount > 256) revert TooManyOutcomeSlots();
        if (outcomeSlotCount <= 1) revert TooFewOutcomeSlots();

        bytes32 conditionId = CTFHelpers.getConditionId(oracle, questionId, outcomeSlotCount);

        // Check condition not already prepared
        if (_payoutNumerators[conditionId].length != 0) revert ConditionAlreadyPrepared();

        // Initialize payout numerators array
        _payoutNumerators[conditionId] = new uint256[](outcomeSlotCount);

        emit ConditionPreparation(conditionId, oracle, questionId, outcomeSlotCount);
    }

    /// @notice Report the payouts for a condition (oracle only)
    /// @param questionId The question ID being resolved
    /// @param payouts Array of payout numerators for each outcome
    function reportPayouts(bytes32 questionId, uint256[] calldata payouts) external nonReentrant {
        uint256 outcomeSlotCount = payouts.length;
        if (outcomeSlotCount <= 1) revert TooFewOutcomeSlots();

        // Oracle is enforced to be the sender because it's part of the hash
        bytes32 conditionId = CTFHelpers.getConditionId(msg.sender, questionId, outcomeSlotCount);

        // Check condition is prepared
        if (_payoutNumerators[conditionId].length != outcomeSlotCount) revert ConditionNotPrepared();

        // Check not already resolved
        if (_payoutDenominator[conditionId] != 0) revert ConditionAlreadyResolved();

        uint256 den = 0;
        for (uint256 i = 0; i < outcomeSlotCount; i++) {
            uint256 num = payouts[i];
            den += num;

            // Check numerator not already set
            if (_payoutNumerators[conditionId][i] != 0) revert PayoutNumeratorAlreadySet();
            _payoutNumerators[conditionId][i] = num;
        }

        if (den == 0) revert PayoutAllZeroes();
        _payoutDenominator[conditionId] = den;

        emit ConditionResolution(conditionId, msg.sender, questionId, outcomeSlotCount, _payoutNumerators[conditionId]);
    }


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
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (partition.length <= 1) revert InvalidPartition();

        uint256 outcomeSlotCount = _payoutNumerators[conditionId].length;
        if (outcomeSlotCount == 0) revert ConditionNotPrepared();

        // For a condition with 2 outcomes, fullIndexSet is 0b11 (3)
        // For 3 outcomes, it's 0b111 (7), etc.
        uint256 fullIndexSet = (1 << outcomeSlotCount) - 1;
        uint256 freeIndexSet = fullIndexSet;

        // Prepare arrays for batch minting
        uint256[] memory positionIds = new uint256[](partition.length);
        uint256[] memory amounts = new uint256[](partition.length);

        // Validate partition and compute position IDs
        for (uint256 i = 0; i < partition.length; i++) {
            uint256 indexSet = partition[i];

            // Index set must be valid (non-zero and within range)
            if (indexSet == 0 || indexSet >= fullIndexSet) revert InvalidIndexSet();

            // Check partition is disjoint
            if ((indexSet & freeIndexSet) != indexSet) revert PartitionNotDisjoint();
            freeIndexSet ^= indexSet;

            bytes32 collectionId = CTFHelpers.getCollectionId(parentCollectionId, conditionId, indexSet);
            positionIds[i] = CTFHelpers.getPositionId(collateralToken, collectionId);
            amounts[i] = amount;
        }

        // Handle collateral/token source
        if (freeIndexSet == 0) {
            // Full partition - take collateral or burn parent position
            if (parentCollectionId == bytes32(0)) {
                // Transfer collateral from sender to this contract
                collateralToken.safeTransferFrom(msg.sender, address(this), amount);
            } else {
                // Burn parent position
                uint256 parentPositionId = CTFHelpers.getPositionId(collateralToken, parentCollectionId);
                _burn(msg.sender, parentPositionId, amount);
                _totalSupply[parentPositionId] -= amount;
            }
        } else {
            // Partial partition - burn the complementary position
            bytes32 complementCollectionId =
                CTFHelpers.getCollectionId(parentCollectionId, conditionId, fullIndexSet ^ freeIndexSet);
            uint256 complementPositionId = CTFHelpers.getPositionId(collateralToken, complementCollectionId);
            _burn(msg.sender, complementPositionId, amount);
            _totalSupply[complementPositionId] -= amount;
        }

        // Mint outcome tokens
        _mintBatch(msg.sender, positionIds, amounts, "");

        // Update total supply for minted positions
        for (uint256 i = 0; i < positionIds.length; i++) {
            _totalSupply[positionIds[i]] += amounts[i];
        }

        emit PositionSplit(msg.sender, collateralToken, parentCollectionId, conditionId, partition, amount);
    }

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
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (partition.length <= 1) revert InvalidPartition();

        uint256 outcomeSlotCount = _payoutNumerators[conditionId].length;
        if (outcomeSlotCount == 0) revert ConditionNotPrepared();

        uint256 fullIndexSet = (1 << outcomeSlotCount) - 1;
        uint256 freeIndexSet = fullIndexSet;

        // Prepare arrays for batch burning
        uint256[] memory positionIds = new uint256[](partition.length);
        uint256[] memory amounts = new uint256[](partition.length);

        // Validate partition and compute position IDs
        for (uint256 i = 0; i < partition.length; i++) {
            uint256 indexSet = partition[i];

            if (indexSet == 0 || indexSet >= fullIndexSet) revert InvalidIndexSet();
            if ((indexSet & freeIndexSet) != indexSet) revert PartitionNotDisjoint();
            freeIndexSet ^= indexSet;

            bytes32 collectionId = CTFHelpers.getCollectionId(parentCollectionId, conditionId, indexSet);
            positionIds[i] = CTFHelpers.getPositionId(collateralToken, collectionId);
            amounts[i] = amount;
        }

        // Burn outcome tokens
        _burnBatch(msg.sender, positionIds, amounts);

        // Update total supply for burned positions
        for (uint256 i = 0; i < positionIds.length; i++) {
            _totalSupply[positionIds[i]] -= amounts[i];
        }

        // Handle collateral/token destination
        if (freeIndexSet == 0) {
            // Full partition - return collateral or mint parent position
            if (parentCollectionId == bytes32(0)) {
                // Transfer collateral back to sender
                collateralToken.safeTransfer(msg.sender, amount);
            } else {
                // Mint parent position
                uint256 parentPositionId = CTFHelpers.getPositionId(collateralToken, parentCollectionId);
                _mint(msg.sender, parentPositionId, amount, "");
                _totalSupply[parentPositionId] += amount;
            }
        } else {
            // Partial partition - mint the complementary position
            bytes32 complementCollectionId =
                CTFHelpers.getCollectionId(parentCollectionId, conditionId, fullIndexSet ^ freeIndexSet);
            uint256 complementPositionId = CTFHelpers.getPositionId(collateralToken, complementCollectionId);
            _mint(msg.sender, complementPositionId, amount, "");
            _totalSupply[complementPositionId] += amount;
        }

        emit PositionsMerge(msg.sender, collateralToken, parentCollectionId, conditionId, partition, amount);
    }

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
    ) external nonReentrant {
        uint256 den = _payoutDenominator[conditionId];
        if (den == 0) revert ConditionNotResolved();

        uint256 outcomeSlotCount = _payoutNumerators[conditionId].length;
        if (outcomeSlotCount == 0) revert ConditionNotPrepared();

        uint256 totalPayout = 0;
        uint256 fullIndexSet = (1 << outcomeSlotCount) - 1;

        for (uint256 i = 0; i < indexSets.length; i++) {
            uint256 indexSet = indexSets[i];
            if (indexSet == 0 || indexSet >= fullIndexSet) revert InvalidIndexSet();

            bytes32 collectionId = CTFHelpers.getCollectionId(parentCollectionId, conditionId, indexSet);
            uint256 positionId = CTFHelpers.getPositionId(collateralToken, collectionId);

            // Calculate payout numerator for this index set
            uint256 payoutNumerator = 0;
            for (uint256 j = 0; j < outcomeSlotCount; j++) {
                if ((indexSet & (1 << j)) != 0) {
                    payoutNumerator += _payoutNumerators[conditionId][j];
                }
            }

            // Get user's balance and calculate payout
            uint256 payoutStake = balanceOf(msg.sender, positionId);
            if (payoutStake > 0) {
                totalPayout += (payoutStake * payoutNumerator) / den;
                _burn(msg.sender, positionId, payoutStake);
                _totalSupply[positionId] -= payoutStake;
            }
        }

        // Transfer payout
        if (totalPayout > 0) {
            if (parentCollectionId == bytes32(0)) {
                collateralToken.safeTransfer(msg.sender, totalPayout);
            } else {
                uint256 parentPositionId = CTFHelpers.getPositionId(collateralToken, parentCollectionId);
                _mint(msg.sender, parentPositionId, totalPayout, "");
                _totalSupply[parentPositionId] += totalPayout;
            }
        }

        emit PayoutRedemption(msg.sender, collateralToken, parentCollectionId, conditionId, indexSets, totalPayout);
    }
}
