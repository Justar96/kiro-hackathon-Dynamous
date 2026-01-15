// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {CTFHelpers} from "../src/libraries/CTFHelpers.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TestSetup} from "./helpers/TestSetup.sol";
import {Generators} from "./helpers/Generators.sol";

/**
 * @title ConditionalTokensFuzzTest
 * @notice Property-based tests for ConditionalTokens contract
 * @dev Tests the core invariants of the Conditional Token Framework
 */
contract ConditionalTokensFuzzTest is TestSetup, Generators {
    ConditionalTokens public conditionalTokens;
    MockERC20 public usdc;

    // Binary partition for YES/NO markets
    uint256[] public binaryPartition;

    function setUp() public override {
        super.setUp();

        // Deploy contracts
        conditionalTokens = new ConditionalTokens();
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Setup binary partition [1, 2] for YES/NO
        binaryPartition = new uint256[](2);
        binaryPartition[0] = CTFHelpers.YES_INDEX_SET; // 1 = YES
        binaryPartition[1] = CTFHelpers.NO_INDEX_SET; // 2 = NO
    }

    // ============ Helper Functions ============

    /// @notice Prepare a binary condition and return the condition ID
    function _prepareCondition(bytes32 questionId) internal returns (bytes32 conditionId) {
        conditionalTokens.prepareCondition(oracle, questionId, CTFHelpers.BINARY_OUTCOME_COUNT);
        conditionId = CTFHelpers.getConditionId(oracle, questionId, CTFHelpers.BINARY_OUTCOME_COUNT);
    }

    /// @notice Get YES and NO position IDs for a condition
    function _getPositionIds(bytes32 conditionId)
        internal
        view
        returns (uint256 yesPositionId, uint256 noPositionId)
    {
        yesPositionId = CTFHelpers.getYesPositionId(IERC20(address(usdc)), conditionId);
        noPositionId = CTFHelpers.getNoPositionId(IERC20(address(usdc)), conditionId);
    }

    /// @notice Setup user with USDC and approval
    function _setupUserWithCollateral(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(conditionalTokens), amount);
    }

    /// @notice Split position for a user
    function _splitPosition(address user, bytes32 conditionId, uint256 amount) internal {
        vm.prank(user);
        conditionalTokens.splitPosition(IERC20(address(usdc)), bytes32(0), conditionId, binaryPartition, amount);
    }

    /// @notice Merge positions for a user
    function _mergePositions(address user, bytes32 conditionId, uint256 amount) internal {
        vm.prank(user);
        conditionalTokens.mergePositions(IERC20(address(usdc)), bytes32(0), conditionId, binaryPartition, amount);
    }

    // ============ Property Tests ============

    /**
     * @dev Feature: on-chain-settlement, Property 1: Token Minting Balance Invariant
     * For any collateral deposit into a market, the amount of YES tokens minted SHALL equal
     * the amount of NO tokens minted, and both SHALL equal the collateral amount deposited.
     * **Validates: Requirements 1.2, 2.1**
     */
    function testFuzz_tokenMintingBalanceInvariant(uint256 collateralAmount, uint256 questionSeed) public {
        // Bound inputs to realistic range
        collateralAmount = genCollateral(collateralAmount);
        bytes32 questionId = genQuestionId(questionSeed);

        // Setup
        bytes32 conditionId = _prepareCondition(questionId);
        (uint256 yesPositionId, uint256 noPositionId) = _getPositionIds(conditionId);
        _setupUserWithCollateral(user1, collateralAmount);

        // Record initial state
        uint256 initialUsdcBalance = usdc.balanceOf(user1);
        uint256 initialYesBalance = conditionalTokens.balanceOf(user1, yesPositionId);
        uint256 initialNoBalance = conditionalTokens.balanceOf(user1, noPositionId);

        // Action: Split position
        _splitPosition(user1, conditionId, collateralAmount);

        // Property assertions
        uint256 finalYesBalance = conditionalTokens.balanceOf(user1, yesPositionId);
        uint256 finalNoBalance = conditionalTokens.balanceOf(user1, noPositionId);
        uint256 finalUsdcBalance = usdc.balanceOf(user1);

        // YES tokens minted == collateral amount
        assertEq(
            finalYesBalance - initialYesBalance,
            collateralAmount,
            "Property 1: YES tokens minted != collateral amount"
        );

        // NO tokens minted == collateral amount
        assertEq(
            finalNoBalance - initialNoBalance,
            collateralAmount,
            "Property 1: NO tokens minted != collateral amount"
        );

        // YES tokens == NO tokens
        assertEq(
            finalYesBalance - initialYesBalance,
            finalNoBalance - initialNoBalance,
            "Property 1: YES tokens != NO tokens"
        );

        // USDC transferred from user
        assertEq(
            initialUsdcBalance - finalUsdcBalance,
            collateralAmount,
            "Property 1: USDC not transferred correctly"
        );
    }


    /**
     * @dev Feature: on-chain-settlement, Property 2: Token Redemption Round-Trip
     * For any user who mints tokens by depositing collateral, if they subsequently redeem
     * equal amounts of YES and NO tokens, they SHALL receive back the original collateral amount.
     * **Validates: Requirements 2.2**
     */
    function testFuzz_tokenRedemptionRoundTrip(uint256 collateralAmount, uint256 questionSeed) public {
        // Bound inputs to realistic range
        collateralAmount = genCollateral(collateralAmount);
        bytes32 questionId = genQuestionId(questionSeed);

        // Setup
        bytes32 conditionId = _prepareCondition(questionId);
        _setupUserWithCollateral(user1, collateralAmount);

        // Record initial USDC balance
        uint256 initialUsdcBalance = usdc.balanceOf(user1);

        // Action 1: Split position (mint YES/NO tokens)
        _splitPosition(user1, conditionId, collateralAmount);

        // Verify tokens were minted
        (uint256 yesPositionId, uint256 noPositionId) = _getPositionIds(conditionId);
        assertEq(conditionalTokens.balanceOf(user1, yesPositionId), collateralAmount, "YES tokens not minted");
        assertEq(conditionalTokens.balanceOf(user1, noPositionId), collateralAmount, "NO tokens not minted");

        // Action 2: Merge positions (redeem equal YES/NO back to collateral)
        _mergePositions(user1, conditionId, collateralAmount);

        // Property assertions
        uint256 finalUsdcBalance = usdc.balanceOf(user1);
        uint256 finalYesBalance = conditionalTokens.balanceOf(user1, yesPositionId);
        uint256 finalNoBalance = conditionalTokens.balanceOf(user1, noPositionId);

        // User should have original USDC back
        assertEq(finalUsdcBalance, initialUsdcBalance, "Property 2: USDC not returned after round-trip");

        // All tokens should be burned
        assertEq(finalYesBalance, 0, "Property 2: YES tokens not burned");
        assertEq(finalNoBalance, 0, "Property 2: NO tokens not burned");
    }

    /**
     * @dev Feature: on-chain-settlement, Property 17: Total Supply Invariant
     * For any market, the total supply of YES tokens SHALL equal the total supply of NO tokens at all times.
     * **Validates: Requirements 2.5**
     */
    function testFuzz_totalSupplyInvariant(
        uint256 collateralAmount1,
        uint256 collateralAmount2,
        uint256 mergeAmount,
        uint256 questionSeed
    ) public {
        // Bound inputs to realistic range
        collateralAmount1 = genCollateral(collateralAmount1);
        collateralAmount2 = genCollateral(collateralAmount2);
        bytes32 questionId = genQuestionId(questionSeed);

        // Setup
        bytes32 conditionId = _prepareCondition(questionId);
        (uint256 yesPositionId, uint256 noPositionId) = _getPositionIds(conditionId);

        // Setup users with collateral
        _setupUserWithCollateral(user1, collateralAmount1);
        _setupUserWithCollateral(user2, collateralAmount2);

        // Initial state: total supply should be 0
        assertEq(conditionalTokens.totalSupply(yesPositionId), 0, "Initial YES supply != 0");
        assertEq(conditionalTokens.totalSupply(noPositionId), 0, "Initial NO supply != 0");

        // Action 1: User1 splits position
        _splitPosition(user1, conditionId, collateralAmount1);

        // Check invariant after first split
        uint256 yesSupply = conditionalTokens.totalSupply(yesPositionId);
        uint256 noSupply = conditionalTokens.totalSupply(noPositionId);
        assertEq(yesSupply, noSupply, "Property 17: YES supply != NO supply after split 1");
        assertEq(yesSupply, collateralAmount1, "Supply != collateral after split 1");

        // Action 2: User2 splits position
        _splitPosition(user2, conditionId, collateralAmount2);

        // Check invariant after second split
        yesSupply = conditionalTokens.totalSupply(yesPositionId);
        noSupply = conditionalTokens.totalSupply(noPositionId);
        assertEq(yesSupply, noSupply, "Property 17: YES supply != NO supply after split 2");
        assertEq(yesSupply, collateralAmount1 + collateralAmount2, "Supply != total collateral after split 2");

        // Action 3: User1 merges some positions
        // Bound merge amount to what user1 has
        mergeAmount = bound(mergeAmount, 1, collateralAmount1);
        _mergePositions(user1, conditionId, mergeAmount);

        // Check invariant after merge
        yesSupply = conditionalTokens.totalSupply(yesPositionId);
        noSupply = conditionalTokens.totalSupply(noPositionId);
        assertEq(yesSupply, noSupply, "Property 17: YES supply != NO supply after merge");
        assertEq(
            yesSupply,
            collateralAmount1 + collateralAmount2 - mergeAmount,
            "Supply incorrect after merge"
        );
    }

    /**
     * @dev Additional test: Multiple users splitting and merging maintains invariant
     */
    function testFuzz_totalSupplyInvariantMultipleUsers(
        uint256[3] memory amounts,
        uint256 questionSeed
    ) public {
        bytes32 questionId = genQuestionId(questionSeed);
        bytes32 conditionId = _prepareCondition(questionId);
        (uint256 yesPositionId, uint256 noPositionId) = _getPositionIds(conditionId);

        address[3] memory users = [user1, user2, user3];
        uint256 totalMinted = 0;

        // Each user splits a random amount
        for (uint256 i = 0; i < 3; i++) {
            amounts[i] = genCollateral(amounts[i]);
            _setupUserWithCollateral(users[i], amounts[i]);
            _splitPosition(users[i], conditionId, amounts[i]);
            totalMinted += amounts[i];

            // Check invariant after each operation
            uint256 yesSupply = conditionalTokens.totalSupply(yesPositionId);
            uint256 noSupply = conditionalTokens.totalSupply(noPositionId);
            assertEq(yesSupply, noSupply, "Property 17: YES != NO during minting");
            assertEq(yesSupply, totalMinted, "Supply != total minted");
        }

        // Each user merges half their tokens
        uint256 totalBurned = 0;
        for (uint256 i = 0; i < 3; i++) {
            uint256 mergeAmount = amounts[i] / 2;
            if (mergeAmount > 0) {
                _mergePositions(users[i], conditionId, mergeAmount);
                totalBurned += mergeAmount;

                // Check invariant after each operation
                uint256 yesSupply = conditionalTokens.totalSupply(yesPositionId);
                uint256 noSupply = conditionalTokens.totalSupply(noPositionId);
                assertEq(yesSupply, noSupply, "Property 17: YES != NO during burning");
                assertEq(yesSupply, totalMinted - totalBurned, "Supply incorrect during burning");
            }
        }
    }
}
