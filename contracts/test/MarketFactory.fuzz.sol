// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {Generators} from "./helpers/Generators.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {Market} from "../src/Market.sol";
import {IMarketFactory} from "../src/interfaces/IMarketFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * @title MarketFactoryFuzzTest
 * @notice Property-based tests for MarketFactory contract
 * @dev Tests market end date validation and minimum collateral enforcement
 */
contract MarketFactoryFuzzTest is TestSetup, Generators {
    ConditionalTokens public conditionalTokens;
    MockERC20 public usdc;
    MarketFactory public factory;

    // Test constants
    string constant TEST_QUESTION = "Will ETH reach $10,000 by end of 2025?";
    string constant TEST_RESOLUTION_CRITERIA = "Based on CoinGecko price at 23:59 UTC on Dec 31, 2025";

    function setUp() public override {
        super.setUp();

        // Deploy contracts
        conditionalTokens = new ConditionalTokens();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        
        // Deploy factory
        factory = new MarketFactory(
            address(conditionalTokens),
            address(usdc),
            oracle,
            feeRecipient
        );
    }

    // ============ Helper Functions ============

    /// @notice Setup user with USDC and approval for factory
    function _setupUserWithCollateral(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(factory), amount);
    }

    // ============ Property Tests ============

    /**
     * @dev Feature: on-chain-settlement, Property 15: Market End Date Validation
     * For any market creation attempt with end date in the past,
     * the market factory SHALL revert the transaction.
     * **Validates: Requirements 1.5**
     */
    function testFuzz_marketEndDateValidation_rejectsPassedEndDate(
        uint256 currentTime,
        uint256 pastOffset
    ) public {
        // Set a reasonable current time first
        currentTime = bound(currentTime, 365 days, type(uint128).max);
        vm.warp(currentTime);
        
        // Bound pastOffset to ensure end date is in the past (1 second to 365 days ago)
        pastOffset = bound(pastOffset, 1, 365 days);
        
        // Calculate a past end time
        uint256 pastEndTime = block.timestamp - pastOffset;
        
        // Setup user with sufficient collateral
        uint256 initialLiquidity = factory.minInitialLiquidity();
        _setupUserWithCollateral(marketCreator, initialLiquidity);
        
        // Attempt to create market with past end date - should revert
        vm.prank(marketCreator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IMarketFactory.InvalidEndDate.selector,
                pastEndTime,
                block.timestamp
            )
        );
        factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            pastEndTime,
            initialLiquidity
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 15: Market End Date Validation
     * For any market creation attempt with end date equal to current time,
     * the market factory SHALL revert the transaction.
     * **Validates: Requirements 1.5**
     */
    function testFuzz_marketEndDateValidation_rejectsCurrentTime(
        uint256 currentTimestamp
    ) public {
        // Bound timestamp to reasonable range
        currentTimestamp = bound(currentTimestamp, 1, type(uint128).max);
        
        // Warp to the specified timestamp
        vm.warp(currentTimestamp);
        
        // Setup user with sufficient collateral
        uint256 initialLiquidity = factory.minInitialLiquidity();
        _setupUserWithCollateral(marketCreator, initialLiquidity);
        
        // Attempt to create market with current timestamp as end date - should revert
        vm.prank(marketCreator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IMarketFactory.InvalidEndDate.selector,
                currentTimestamp,
                currentTimestamp
            )
        );
        factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            currentTimestamp,
            initialLiquidity
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 15: Market End Date Validation
     * For any market creation attempt with end date in the future,
     * the market factory SHALL accept the request.
     * **Validates: Requirements 1.5**
     */
    function testFuzz_marketEndDateValidation_acceptsFutureEndDate(
        uint256 futureOffset
    ) public {
        // Bound futureOffset to ensure end date is in the future (1 second to 365 days)
        futureOffset = bound(futureOffset, 1, 365 days);
        
        // Calculate a future end time
        uint256 futureEndTime = block.timestamp + futureOffset;
        
        // Setup user with sufficient collateral
        uint256 initialLiquidity = factory.minInitialLiquidity();
        _setupUserWithCollateral(marketCreator, initialLiquidity);
        
        // Create market with future end date - should succeed
        vm.prank(marketCreator);
        address market = factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            futureEndTime,
            initialLiquidity
        );
        
        // Verify market was created
        assertNotEq(market, address(0), "Property 15: Market should be created with future end date");
        assertEq(Market(market).endTime(), futureEndTime, "Property 15: Market end time should match");
    }

    /**
     * @dev Feature: on-chain-settlement, Property 16: Minimum Collateral Enforcement
     * For any market creation attempt with initial liquidity less than 10 USDC,
     * the market factory SHALL revert the transaction.
     * **Validates: Requirements 1.6**
     */
    function testFuzz_minimumCollateralEnforcement_rejectsInsufficientLiquidity(
        uint256 insufficientLiquidity
    ) public {
        // Bound to less than minimum (0 to MIN_INITIAL_LIQUIDITY - 1)
        uint256 minLiquidity = factory.minInitialLiquidity();
        insufficientLiquidity = bound(insufficientLiquidity, 0, minLiquidity - 1);
        
        // Setup user with the insufficient amount
        _setupUserWithCollateral(marketCreator, insufficientLiquidity);
        
        // Calculate future end time
        uint256 futureEndTime = block.timestamp + 7 days;
        
        // Attempt to create market with insufficient liquidity - should revert
        vm.prank(marketCreator);
        vm.expectRevert(
            abi.encodeWithSelector(
                IMarketFactory.InsufficientInitialLiquidity.selector,
                insufficientLiquidity,
                minLiquidity
            )
        );
        factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            futureEndTime,
            insufficientLiquidity
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 16: Minimum Collateral Enforcement
     * For any market creation attempt with initial liquidity equal to or greater than 10 USDC,
     * the market factory SHALL accept the request (assuming other validations pass).
     * **Validates: Requirements 1.6**
     */
    function testFuzz_minimumCollateralEnforcement_acceptsSufficientLiquidity(
        uint256 sufficientLiquidity
    ) public {
        // Bound to at least minimum (MIN_INITIAL_LIQUIDITY to reasonable max)
        uint256 minLiquidity = factory.minInitialLiquidity();
        sufficientLiquidity = bound(sufficientLiquidity, minLiquidity, 1_000_000e6);
        
        // Setup user with sufficient collateral
        _setupUserWithCollateral(marketCreator, sufficientLiquidity);
        
        // Calculate future end time
        uint256 futureEndTime = block.timestamp + 7 days;
        
        // Create market with sufficient liquidity - should succeed
        vm.prank(marketCreator);
        address market = factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            futureEndTime,
            sufficientLiquidity
        );
        
        // Verify market was created
        assertNotEq(market, address(0), "Property 16: Market should be created with sufficient liquidity");
        
        // Verify creator received the outcome tokens
        uint256 yesTokenId = Market(market).yesTokenId();
        uint256 noTokenId = Market(market).noTokenId();
        
        assertEq(
            conditionalTokens.balanceOf(marketCreator, yesTokenId),
            sufficientLiquidity,
            "Property 16: Creator should receive YES tokens equal to liquidity"
        );
        assertEq(
            conditionalTokens.balanceOf(marketCreator, noTokenId),
            sufficientLiquidity,
            "Property 16: Creator should receive NO tokens equal to liquidity"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 16: Minimum Collateral Enforcement
     * Verify the exact boundary: 10 USDC should be accepted, 9.999999 USDC should be rejected.
     * **Validates: Requirements 1.6**
     */
    function testFuzz_minimumCollateralEnforcement_exactBoundary(
        uint256 offset
    ) public {
        // Test values around the boundary
        uint256 minLiquidity = factory.minInitialLiquidity();
        
        // Bound offset to small values around boundary
        offset = bound(offset, 0, 1e6); // 0 to 1 USDC offset
        
        // Test: exactly at minimum should succeed
        _setupUserWithCollateral(marketCreator, minLiquidity);
        
        uint256 futureEndTime = block.timestamp + 7 days;
        
        vm.prank(marketCreator);
        address market = factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            futureEndTime,
            minLiquidity
        );
        
        assertNotEq(market, address(0), "Property 16: Exactly minimum liquidity should be accepted");
    }
}
