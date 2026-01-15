// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {Generators} from "./helpers/Generators.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {Market} from "../src/Market.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {CTFHelpers} from "../src/libraries/CTFHelpers.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MarketFuzzTest
 * @notice Property-based tests for Market contract
 * @dev Tests settlement payouts, fee calculations, and invalid market redemption
 */
contract MarketFuzzTest is TestSetup, Generators {
    ConditionalTokens public conditionalTokens;
    MockERC20 public usdc;
    Market public market;

    // Test constants
    string constant TEST_QUESTION = "Will ETH reach $10,000 by end of 2025?";
    string constant TEST_RESOLUTION_CRITERIA = "Based on CoinGecko price at 23:59 UTC on Dec 31, 2025";

    function setUp() public override {
        super.setUp();

        // Deploy contracts
        conditionalTokens = new ConditionalTokens();
        usdc = new MockERC20("USD Coin", "USDC", 6);
    }

    // ============ Helper Functions ============

    /// @notice Deploy a new market with given end time
    function _deployMarket(uint256 endTimeOffset) internal returns (Market) {
        bytes32 questionId = keccak256(abi.encodePacked(TEST_QUESTION, block.timestamp, endTimeOffset));
        uint256 marketEndTime = block.timestamp + endTimeOffset;

        return new Market(
            address(conditionalTokens),
            address(usdc),
            oracle,
            feeRecipient,
            questionId,
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            marketEndTime
        );
    }

    /// @notice Setup user with USDC and approval for market
    function _setupUserWithCollateral(address user, uint256 amount, Market _market) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(_market), amount);
    }

    /// @notice Mint tokens for a user
    function _mintTokensForUser(address user, uint256 amount, Market _market) internal {
        _setupUserWithCollateral(user, amount, _market);
        vm.prank(user);
        _market.mintTokens(amount);
    }

    /// @notice Approve market to transfer user's outcome tokens
    function _approveMarketForTokens(address user, Market _market) internal {
        vm.prank(user);
        conditionalTokens.setApprovalForAll(address(_market), true);
    }

    /// @notice Resolve market with given outcome
    function _resolveMarket(Market _market, IMarket.Outcome _outcome) internal {
        // Advance time past end time
        vm.warp(_market.endTime() + 1);

        // Oracle proposes resolution
        vm.prank(oracle);
        _market.proposeResolution(_outcome);

        // Advance past dispute period
        vm.warp(block.timestamp + DISPUTE_PERIOD + 1);

        // Finalize resolution
        _market.finalizeResolution();
    }


    // ============ Property Tests ============

    /**
     * @dev Feature: on-chain-settlement, Property 6: Settlement Payout for Winners
     * For any resolved market with outcome YES or NO, holders of the winning token type
     * SHALL be able to redeem each token for 1.00 USDC (minus protocol fee), and holders
     * of the losing token type SHALL receive 0.00 USDC.
     * **Validates: Requirements 5.1, 5.2, 5.7**
     */
    function testFuzz_settlementPayoutForWinners(
        uint256 collateralAmount,
        bool outcomeIsYes
    ) public {
        // Bound inputs to realistic range
        collateralAmount = genCollateral(collateralAmount);

        // Deploy market with 7 days until end
        market = _deployMarket(7 days);

        // Mint tokens for user1 (will hold winning tokens)
        _mintTokensForUser(user1, collateralAmount, market);

        // Approve market to transfer tokens
        _approveMarketForTokens(user1, market);

        // Determine outcome
        IMarket.Outcome resolvedOutcome = outcomeIsYes ? IMarket.Outcome.YES : IMarket.Outcome.NO;

        // Resolve market
        _resolveMarket(market, resolvedOutcome);

        // Record balances before redemption
        uint256 usdcBefore = usdc.balanceOf(user1);
        uint256 yesBalanceBefore = conditionalTokens.balanceOf(user1, market.yesTokenId());
        uint256 noBalanceBefore = conditionalTokens.balanceOf(user1, market.noTokenId());

        // User redeems winnings
        vm.prank(user1);
        market.redeemWinnings();

        // Calculate expected payout (winning tokens * 1.00 - 2% fee)
        uint256 winningTokens = outcomeIsYes ? yesBalanceBefore : noBalanceBefore;
        uint256 expectedGrossPayout = winningTokens; // 1.00 per token
        uint256 expectedFee = (expectedGrossPayout * PROTOCOL_FEE_BPS) / 10000;
        uint256 expectedNetPayout = expectedGrossPayout - expectedFee;

        // Verify payout
        uint256 usdcAfter = usdc.balanceOf(user1);
        assertEq(
            usdcAfter - usdcBefore,
            expectedNetPayout,
            "Property 6: Winner payout incorrect"
        );

        // Verify winning tokens were burned (transferred to market)
        uint256 yesBalanceAfter = conditionalTokens.balanceOf(user1, market.yesTokenId());
        uint256 noBalanceAfter = conditionalTokens.balanceOf(user1, market.noTokenId());

        if (outcomeIsYes) {
            assertEq(yesBalanceAfter, 0, "Property 6: YES tokens not burned");
            assertEq(noBalanceAfter, noBalanceBefore, "Property 6: NO tokens should remain");
        } else {
            assertEq(noBalanceAfter, 0, "Property 6: NO tokens not burned");
            assertEq(yesBalanceAfter, yesBalanceBefore, "Property 6: YES tokens should remain");
        }
    }

    /**
     * @dev Test that losing token holders receive 0 payout
     * Part of Property 6: Settlement Payout for Winners
     * **Validates: Requirements 5.7**
     */
    function testFuzz_losingTokensHaveZeroValue(
        uint256 collateralAmount,
        bool outcomeIsYes
    ) public {
        // Bound inputs
        collateralAmount = genCollateral(collateralAmount);

        // Deploy market
        market = _deployMarket(7 days);

        // Mint tokens for user1
        _mintTokensForUser(user1, collateralAmount, market);

        // User1 transfers all winning tokens to user2, keeping only losing tokens
        uint256 yesTokenId = market.yesTokenId();
        uint256 noTokenId = market.noTokenId();

        vm.startPrank(user1);
        if (outcomeIsYes) {
            // Transfer YES tokens away, keep NO tokens (which will be losers)
            conditionalTokens.safeTransferFrom(user1, user2, yesTokenId, collateralAmount, "");
        } else {
            // Transfer NO tokens away, keep YES tokens (which will be losers)
            conditionalTokens.safeTransferFrom(user1, user2, noTokenId, collateralAmount, "");
        }
        vm.stopPrank();

        // Approve market
        _approveMarketForTokens(user1, market);

        // Resolve market
        IMarket.Outcome resolvedOutcome = outcomeIsYes ? IMarket.Outcome.YES : IMarket.Outcome.NO;
        _resolveMarket(market, resolvedOutcome);

        // User1 only has losing tokens
        uint256 usdcBefore = usdc.balanceOf(user1);

        // User can call redeemWinnings but will get 0 payout since they only have losing tokens
        vm.prank(user1);
        market.redeemWinnings();

        // Verify no USDC was transferred (losing tokens have 0 value)
        assertEq(usdc.balanceOf(user1), usdcBefore, "Property 6: Loser should receive 0 USDC");
    }

    /**
     * @dev Feature: on-chain-settlement, Property 7: Settlement Fee Calculation
     * For any winning token redemption, the payout SHALL equal
     * (token_amount × 1.00 × (1 - 0.02)), where 0.02 represents the 2% protocol fee.
     * **Validates: Requirements 5.4, 5.5**
     */
    function testFuzz_settlementFeeCalculation(
        uint256 collateralAmount,
        bool outcomeIsYes
    ) public {
        // Bound inputs to realistic range
        collateralAmount = genCollateral(collateralAmount);

        // Deploy market
        market = _deployMarket(7 days);

        // Mint tokens for user1
        _mintTokensForUser(user1, collateralAmount, market);

        // Approve market
        _approveMarketForTokens(user1, market);

        // Resolve market
        IMarket.Outcome resolvedOutcome = outcomeIsYes ? IMarket.Outcome.YES : IMarket.Outcome.NO;
        _resolveMarket(market, resolvedOutcome);

        // Record state before redemption
        uint256 usdcBefore = usdc.balanceOf(user1);
        uint256 feesBefore = market.totalFeesCollected();

        // User redeems winnings
        vm.prank(user1);
        market.redeemWinnings();

        // Calculate expected values
        // Gross payout = token_amount * 1.00 = collateralAmount
        uint256 grossPayout = collateralAmount;
        // Fee = grossPayout * 2% = grossPayout * 200 / 10000
        uint256 expectedFee = (grossPayout * PROTOCOL_FEE_BPS) / 10000;
        // Net payout = grossPayout - fee = grossPayout * (1 - 0.02)
        uint256 expectedNetPayout = grossPayout - expectedFee;

        // Verify payout matches formula: token_amount × 1.00 × (1 - 0.02)
        uint256 usdcAfter = usdc.balanceOf(user1);
        uint256 actualPayout = usdcAfter - usdcBefore;

        assertEq(
            actualPayout,
            expectedNetPayout,
            "Property 7: Payout should equal token_amount * 1.00 * (1 - 0.02)"
        );

        // Verify fee was collected correctly
        uint256 feesAfter = market.totalFeesCollected();
        assertEq(
            feesAfter - feesBefore,
            expectedFee,
            "Property 7: Fee should equal token_amount * 0.02"
        );

        // Verify the relationship: payout + fee = gross amount
        assertEq(
            actualPayout + (feesAfter - feesBefore),
            grossPayout,
            "Property 7: Payout + Fee should equal gross amount"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 8: Invalid Market 50/50 Redemption
     * For any market resolved with INVALID outcome, all token holders (both YES and NO)
     * SHALL be able to redeem each token for exactly 0.50 USDC (minus protocol fee).
     * **Validates: Requirements 4.6**
     */
    function testFuzz_invalidMarket5050Redemption(
        uint256 collateralAmount,
        uint256 yesRatio
    ) public {
        // Bound inputs
        collateralAmount = genCollateral(collateralAmount);
        // yesRatio determines how many YES tokens user keeps (0-100%)
        yesRatio = bound(yesRatio, 0, 100);

        // Deploy market
        market = _deployMarket(7 days);

        // Mint tokens for user1
        _mintTokensForUser(user1, collateralAmount, market);

        // User1 may transfer some tokens to user2 to have different YES/NO balances
        uint256 yesTokenId = market.yesTokenId();
        uint256 noTokenId = market.noTokenId();

        uint256 yesToKeep = (collateralAmount * yesRatio) / 100;
        uint256 noToKeep = collateralAmount - yesToKeep;

        // Transfer tokens to create the desired ratio
        vm.startPrank(user1);
        if (yesToKeep < collateralAmount) {
            conditionalTokens.safeTransferFrom(user1, user2, yesTokenId, collateralAmount - yesToKeep, "");
        }
        if (noToKeep < collateralAmount) {
            conditionalTokens.safeTransferFrom(user1, user2, noTokenId, collateralAmount - noToKeep, "");
        }
        vm.stopPrank();

        // Approve market
        _approveMarketForTokens(user1, market);

        // Resolve market as INVALID
        _resolveMarket(market, IMarket.Outcome.INVALID);

        // Skip if user has no tokens
        if (yesToKeep == 0 && noToKeep == 0) {
            return;
        }

        // Record state before redemption
        uint256 usdcBefore = usdc.balanceOf(user1);

        // User redeems winnings
        vm.prank(user1);
        market.redeemWinnings();

        // Calculate expected payout for INVALID outcome
        // Each token (YES or NO) is worth 0.50 USDC
        // Total value = (yesToKeep + noToKeep) * 0.50 = (yesToKeep + noToKeep) / 2
        uint256 totalTokens = yesToKeep + noToKeep;
        uint256 grossPayout = totalTokens / 2;
        uint256 expectedFee = (grossPayout * PROTOCOL_FEE_BPS) / 10000;
        uint256 expectedNetPayout = grossPayout - expectedFee;

        // Verify payout
        uint256 usdcAfter = usdc.balanceOf(user1);
        uint256 actualPayout = usdcAfter - usdcBefore;

        assertEq(
            actualPayout,
            expectedNetPayout,
            "Property 8: Invalid market payout should be 0.50 per token (minus fee)"
        );
    }

    /**
     * @dev Additional test for Property 8: Verify both YES and NO holders get same rate
     * **Validates: Requirements 4.6**
     */
    function testFuzz_invalidMarketEqualRateForBothTokenTypes(
        uint256 collateralAmount
    ) public {
        // Bound inputs
        collateralAmount = genCollateral(collateralAmount);

        // Deploy market
        market = _deployMarket(7 days);

        // Mint tokens for both users
        _mintTokensForUser(user1, collateralAmount, market);
        _mintTokensForUser(user2, collateralAmount, market);

        uint256 yesTokenId = market.yesTokenId();
        uint256 noTokenId = market.noTokenId();

        // User1 keeps only YES tokens, transfers NO to user3
        // User2 keeps only NO tokens, transfers YES to user3
        vm.prank(user1);
        conditionalTokens.safeTransferFrom(user1, user3, noTokenId, collateralAmount, "");

        vm.prank(user2);
        conditionalTokens.safeTransferFrom(user2, user3, yesTokenId, collateralAmount, "");

        // Approve market for both users
        _approveMarketForTokens(user1, market);
        _approveMarketForTokens(user2, market);

        // Resolve market as INVALID
        _resolveMarket(market, IMarket.Outcome.INVALID);

        // Record balances before
        uint256 user1UsdcBefore = usdc.balanceOf(user1);
        uint256 user2UsdcBefore = usdc.balanceOf(user2);

        // Both users redeem
        vm.prank(user1);
        market.redeemWinnings();

        vm.prank(user2);
        market.redeemWinnings();

        // Calculate expected payout (same for both since they have same amount of tokens)
        // Each has collateralAmount of one token type, worth 0.50 each
        uint256 grossPayout = collateralAmount / 2;
        uint256 expectedFee = (grossPayout * PROTOCOL_FEE_BPS) / 10000;
        uint256 expectedNetPayout = grossPayout - expectedFee;

        // Verify both users got the same payout
        uint256 user1Payout = usdc.balanceOf(user1) - user1UsdcBefore;
        uint256 user2Payout = usdc.balanceOf(user2) - user2UsdcBefore;

        assertEq(
            user1Payout,
            expectedNetPayout,
            "Property 8: YES holder should get 0.50 per token"
        );
        assertEq(
            user2Payout,
            expectedNetPayout,
            "Property 8: NO holder should get 0.50 per token"
        );
        assertEq(
            user1Payout,
            user2Payout,
            "Property 8: YES and NO holders should get same rate in INVALID market"
        );
    }

}
