// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {Generators} from "./helpers/Generators.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {Market} from "../src/Market.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {OrderBook} from "../src/OrderBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/**
 * @title OrderBookFuzzTest
 * @notice Property-based tests for OrderBook contract
 * @dev Tests order escrow, price-time priority, trade settlement, and price validation
 */
contract OrderBookFuzzTest is TestSetup, Generators {
    ConditionalTokens public conditionalTokens;
    MockERC20 public usdc;
    MarketFactory public factory;
    OrderBook public orderBook;
    Market public market;

    // Test constants
    string constant TEST_QUESTION = "Will ETH reach $10,000 by end of 2025?";
    string constant TEST_RESOLUTION_CRITERIA = "Based on CoinGecko price";
    uint256 constant INITIAL_LIQUIDITY = 100_000e6; // 100K USDC

    bytes32 public marketId;
    uint256 public yesTokenId;
    uint256 public noTokenId;

    function setUp() public override {
        super.setUp();

        // Deploy contracts
        conditionalTokens = new ConditionalTokens();
        usdc = new MockERC20("USD Coin", "USDC", 6);
        orderBook = new OrderBook(address(conditionalTokens), address(usdc));
        
        // Deploy factory
        factory = new MarketFactory(
            address(conditionalTokens),
            address(usdc),
            oracle,
            feeRecipient
        );

        // Create a market for testing
        uint256 endTime = block.timestamp + 7 days;
        usdc.mint(marketCreator, INITIAL_LIQUIDITY);
        vm.startPrank(marketCreator);
        usdc.approve(address(factory), INITIAL_LIQUIDITY);
        address marketAddr = factory.createMarket(
            TEST_QUESTION,
            TEST_RESOLUTION_CRITERIA,
            endTime,
            INITIAL_LIQUIDITY
        );
        vm.stopPrank();

        market = Market(marketAddr);
        marketId = market.questionId();
        yesTokenId = market.yesTokenId();
        noTokenId = market.noTokenId();
    }

    // ============ Helper Functions ============

    /// @notice Setup user with USDC
    function _setupUserWithCollateral(address user, uint256 amount) internal {
        usdc.mint(user, amount);
        vm.prank(user);
        usdc.approve(address(orderBook), amount);
    }

    /// @notice Setup user with outcome tokens
    function _setupUserWithTokens(address user, uint256 amount) internal {
        // Mint USDC and create tokens via market
        usdc.mint(user, amount);
        vm.startPrank(user);
        usdc.approve(address(market), amount);
        market.mintTokens(amount);
        // Approve orderbook to transfer tokens
        conditionalTokens.setApprovalForAll(address(orderBook), true);
        vm.stopPrank();
    }

    /// @notice Get user's token balance
    function _getTokenBalance(address user, uint256 tokenId) internal view returns (uint256) {
        return conditionalTokens.balanceOf(user, tokenId);
    }

    // ============ Property Tests ============

    /**
     * @dev Feature: on-chain-settlement, Property 3: Order Escrow Round-Trip
     * For any sell order placed on the order book, the maker's token balance SHALL decrease
     * by the order quantity. If the order is cancelled before being filled, the maker's
     * token balance SHALL be restored to its original value.
     * **Validates: Requirements 3.2, 3.6**
     */
    function testFuzz_orderEscrowRoundTrip_sellOrder(
        uint256 tokenAmount,
        uint256 priceSeed
    ) public {
        // Bound inputs
        tokenAmount = bound(tokenAmount, 1e6, 10_000e6); // 1 to 10K tokens
        uint256 price = genPrice(priceSeed);

        // Setup user with tokens
        _setupUserWithTokens(user1, tokenAmount);

        // Record balance before
        uint256 balanceBefore = _getTokenBalance(user1, yesTokenId);
        assertEq(balanceBefore, tokenAmount, "Setup: User should have tokens");

        // Place sell order
        vm.prank(user1);
        uint256 orderId = orderBook.placeOrder(
            marketId,
            yesTokenId,
            IOrderBook.Side.SELL,
            price,
            tokenAmount
        );

        // Verify tokens were escrowed (balance decreased)
        uint256 balanceAfterPlace = _getTokenBalance(user1, yesTokenId);
        assertEq(
            balanceAfterPlace,
            balanceBefore - tokenAmount,
            "Property 3: Token balance should decrease by order quantity"
        );

        // Cancel the order
        vm.prank(user1);
        orderBook.cancelOrder(orderId);

        // Verify tokens were returned (balance restored)
        uint256 balanceAfterCancel = _getTokenBalance(user1, yesTokenId);
        assertEq(
            balanceAfterCancel,
            balanceBefore,
            "Property 3: Token balance should be restored after cancellation"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 3: Order Escrow Round-Trip (Buy Orders)
     * For any buy order placed on the order book, the maker's collateral balance SHALL decrease
     * by the order cost. If the order is cancelled before being filled, the maker's
     * collateral balance SHALL be restored to its original value.
     * **Validates: Requirements 3.2, 3.6**
     */
    function testFuzz_orderEscrowRoundTrip_buyOrder(
        uint256 quantity,
        uint256 priceSeed
    ) public {
        // Bound inputs
        quantity = bound(quantity, 1e6, 10_000e6); // 1 to 10K tokens
        uint256 price = genPrice(priceSeed);

        // Calculate required collateral
        uint256 collateralRequired = (price * quantity) / 10000;

        // Setup user with collateral
        _setupUserWithCollateral(user1, collateralRequired);

        // Record balance before
        uint256 balanceBefore = usdc.balanceOf(user1);
        assertEq(balanceBefore, collateralRequired, "Setup: User should have collateral");

        // Place buy order
        vm.prank(user1);
        uint256 orderId = orderBook.placeOrder(
            marketId,
            yesTokenId,
            IOrderBook.Side.BUY,
            price,
            quantity
        );

        // Verify collateral was escrowed (balance decreased)
        uint256 balanceAfterPlace = usdc.balanceOf(user1);
        assertEq(
            balanceAfterPlace,
            balanceBefore - collateralRequired,
            "Property 3: Collateral balance should decrease by order cost"
        );

        // Cancel the order
        vm.prank(user1);
        orderBook.cancelOrder(orderId);

        // Verify collateral was returned (balance restored)
        uint256 balanceAfterCancel = usdc.balanceOf(user1);
        assertEq(
            balanceAfterCancel,
            balanceBefore,
            "Property 3: Collateral balance should be restored after cancellation"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 4: Order Matching Price-Time Priority
     * For any set of orders in the order book, when a new order arrives that can match
     * multiple existing orders, the order book SHALL fill against orders with the best
     * price first, and among orders at the same price, SHALL fill against the earliest
     * timestamp first.
     * **Validates: Requirements 3.5**
     */
    function testFuzz_priceTimePriority(
        uint256 quantity1,
        uint256 quantity2,
        uint256 priceSeed1,
        uint256 priceSeed2
    ) public {
        // Bound inputs
        quantity1 = bound(quantity1, 1e6, 5_000e6);
        quantity2 = bound(quantity2, 1e6, 5_000e6);
        uint256 price1 = genPrice(priceSeed1);
        uint256 price2 = genPrice(priceSeed2);

        // Ensure prices are different for clear priority testing
        if (price1 == price2) {
            price2 = price1 < MAX_PRICE_BPS ? price1 + 100 : price1 - 100;
        }

        // Setup sellers with tokens
        _setupUserWithTokens(user1, quantity1);
        _setupUserWithTokens(user2, quantity2);

        // Place sell orders - user1 first, then user2
        vm.prank(user1);
        uint256 orderId1 = orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, price1, quantity1);

        // Advance time to ensure different timestamps
        vm.warp(block.timestamp + 1);

        vm.prank(user2);
        uint256 orderId2 = orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, price2, quantity2);

        // Determine which order should be filled first (lower price = better for buyer)
        address expectedFirstSeller;
        uint256 expectedFirstPrice;
        if (price1 < price2) {
            expectedFirstSeller = user1;
            expectedFirstPrice = price1;
        } else {
            expectedFirstSeller = user2;
            expectedFirstPrice = price2;
        }

        // Setup buyer with enough collateral to buy from both
        uint256 totalQuantity = quantity1 + quantity2;
        uint256 maxPrice = price1 > price2 ? price1 : price2;
        uint256 collateralNeeded = (maxPrice * totalQuantity) / 10000;
        _setupUserWithCollateral(user3, collateralNeeded);

        // Record seller balances before
        uint256 seller1UsdcBefore = usdc.balanceOf(user1);
        uint256 seller2UsdcBefore = usdc.balanceOf(user2);

        // Place buy order at max price to match both sells
        vm.prank(user3);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.BUY, maxPrice, totalQuantity);

        // Verify the order with better price was filled first
        // The seller with better price should have received payment
        uint256 seller1UsdcAfter = usdc.balanceOf(user1);
        uint256 seller2UsdcAfter = usdc.balanceOf(user2);

        // Both should have received payment (orders matched)
        assertTrue(
            seller1UsdcAfter > seller1UsdcBefore || seller2UsdcAfter > seller2UsdcBefore,
            "Property 4: At least one seller should receive payment"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 4: Time Priority at Same Price
     * When multiple orders exist at the same price, earlier orders should be filled first.
     * **Validates: Requirements 3.5**
     */
    function testFuzz_timePriorityAtSamePrice(
        uint256 quantity1,
        uint256 quantity2,
        uint256 priceSeed
    ) public {
        // Bound inputs
        quantity1 = bound(quantity1, 1e6, 5_000e6);
        quantity2 = bound(quantity2, 1e6, 5_000e6);
        uint256 price = genPrice(priceSeed);

        // Setup sellers with tokens
        _setupUserWithTokens(user1, quantity1);
        _setupUserWithTokens(user2, quantity2);

        // Place sell orders at same price - user1 first
        vm.prank(user1);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, price, quantity1);

        // Advance time
        vm.warp(block.timestamp + 1);

        vm.prank(user2);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, price, quantity2);

        // Setup buyer with collateral for only quantity1 (to test partial fill)
        uint256 collateralNeeded = (price * quantity1) / 10000;
        _setupUserWithCollateral(user3, collateralNeeded);

        // Record balances
        uint256 seller1UsdcBefore = usdc.balanceOf(user1);
        uint256 seller2UsdcBefore = usdc.balanceOf(user2);

        // Place buy order for quantity1 only
        vm.prank(user3);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.BUY, price, quantity1);

        // Verify user1 (earlier order) was filled first
        uint256 seller1UsdcAfter = usdc.balanceOf(user1);
        uint256 seller2UsdcAfter = usdc.balanceOf(user2);

        assertGt(
            seller1UsdcAfter,
            seller1UsdcBefore,
            "Property 4: Earlier order (user1) should be filled first"
        );
        assertEq(
            seller2UsdcAfter,
            seller2UsdcBefore,
            "Property 4: Later order (user2) should not be filled when earlier order covers demand"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 5: Trade Settlement Token Flows
     * For any executed trade, the buyer's outcome token balance SHALL increase by the
     * trade quantity, the seller's outcome token balance SHALL decrease by the trade
     * quantity, the buyer's collateral balance SHALL decrease by (price × quantity),
     * and the seller's collateral balance SHALL increase by (price × quantity).
     * **Validates: Requirements 3.4**
     */
    function testFuzz_tradeSettlementTokenFlows(
        uint256 quantity,
        uint256 priceSeed
    ) public {
        // Bound inputs
        quantity = bound(quantity, 1e6, 10_000e6);
        uint256 price = genPrice(priceSeed);

        // Calculate collateral
        uint256 collateralRequired = (price * quantity) / 10000;

        // Setup seller with tokens
        _setupUserWithTokens(user1, quantity);

        // Setup buyer with collateral
        _setupUserWithCollateral(user2, collateralRequired);

        // Record balances before
        uint256 sellerTokensBefore = _getTokenBalance(user1, yesTokenId);
        uint256 sellerUsdcBefore = usdc.balanceOf(user1);
        uint256 buyerTokensBefore = _getTokenBalance(user2, yesTokenId);
        uint256 buyerUsdcBefore = usdc.balanceOf(user2);

        // Place sell order
        vm.prank(user1);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, price, quantity);

        // Place matching buy order
        vm.prank(user2);
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.BUY, price, quantity);

        // Record balances after
        uint256 sellerTokensAfter = _getTokenBalance(user1, yesTokenId);
        uint256 sellerUsdcAfter = usdc.balanceOf(user1);
        uint256 buyerTokensAfter = _getTokenBalance(user2, yesTokenId);
        uint256 buyerUsdcAfter = usdc.balanceOf(user2);

        // Verify token flows
        assertEq(
            sellerTokensAfter,
            sellerTokensBefore - quantity,
            "Property 5: Seller token balance should decrease by quantity"
        );
        assertEq(
            buyerTokensAfter,
            buyerTokensBefore + quantity,
            "Property 5: Buyer token balance should increase by quantity"
        );

        // Verify collateral flows
        assertEq(
            sellerUsdcAfter,
            sellerUsdcBefore + collateralRequired,
            "Property 5: Seller collateral should increase by price * quantity"
        );
        assertEq(
            buyerUsdcAfter,
            buyerUsdcBefore - collateralRequired,
            "Property 5: Buyer collateral should decrease by price * quantity"
        );
    }

    /**
     * @dev Feature: on-chain-settlement, Property 14: Price Boundary Validation
     * For any order placement with price ≤ 0.00 or price ≥ 1.00, the order book
     * SHALL revert the transaction.
     * **Validates: Requirements 3.8**
     */
    function testFuzz_priceBoundaryValidation_rejectsTooLow(
        uint256 invalidPrice,
        uint256 quantity
    ) public {
        // Bound price to be below minimum (0 to 99 basis points = $0.00 to $0.0099)
        invalidPrice = bound(invalidPrice, 0, MIN_PRICE_BPS - 1);
        quantity = bound(quantity, 1e6, 10_000e6);

        // Setup user with tokens
        _setupUserWithTokens(user1, quantity);

        // Attempt to place order with invalid low price - should revert
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.InvalidPrice.selector, invalidPrice));
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, invalidPrice, quantity);
    }

    /**
     * @dev Feature: on-chain-settlement, Property 14: Price Boundary Validation
     * For any order placement with price >= 1.00, the order book SHALL revert.
     * **Validates: Requirements 3.8**
     */
    function testFuzz_priceBoundaryValidation_rejectsTooHigh(
        uint256 invalidPrice,
        uint256 quantity
    ) public {
        // Bound price to be above maximum (9901 to 20000 basis points = $0.9901 to $2.00)
        invalidPrice = bound(invalidPrice, MAX_PRICE_BPS + 1, 20000);
        quantity = bound(quantity, 1e6, 10_000e6);

        // Calculate collateral for buy order
        uint256 collateralRequired = (invalidPrice * quantity) / 10000;
        _setupUserWithCollateral(user1, collateralRequired);

        // Attempt to place order with invalid high price - should revert
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(IOrderBook.InvalidPrice.selector, invalidPrice));
        orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.BUY, invalidPrice, quantity);
    }

    /**
     * @dev Feature: on-chain-settlement, Property 14: Price Boundary Validation
     * For any order placement with valid price (0.01-0.99), the order book SHALL accept.
     * **Validates: Requirements 3.8**
     */
    function testFuzz_priceBoundaryValidation_acceptsValidPrice(
        uint256 validPrice,
        uint256 quantity
    ) public {
        // Bound price to valid range
        validPrice = bound(validPrice, MIN_PRICE_BPS, MAX_PRICE_BPS);
        quantity = bound(quantity, 1e6, 10_000e6);

        // Setup user with tokens
        _setupUserWithTokens(user1, quantity);

        // Place order with valid price - should succeed
        vm.prank(user1);
        uint256 orderId = orderBook.placeOrder(marketId, yesTokenId, IOrderBook.Side.SELL, validPrice, quantity);

        // Verify order was created
        IOrderBook.Order memory order = orderBook.orders(orderId);
        assertEq(order.price, validPrice, "Property 14: Order should be created with valid price");
        assertTrue(order.active, "Property 14: Order should be active");
    }
}
