// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TestSetup} from "./helpers/TestSetup.sol";
import {Generators} from "./helpers/Generators.sol";
import {CTFExchange} from "../src/CTFExchange.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ICTFExchange} from "../src/interfaces/ICTFExchange.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CTFExchangeFuzzTest
 * @notice Property-based tests for CTFExchange order matching
 * @dev Validates Requirements 5.1, 5.2, 5.3 - On-chain trade settlement
 */
contract CTFExchangeFuzzTest is TestSetup, Generators {
    using ECDSA for bytes32;

    CTFExchange public exchange;
    ConditionalTokens public ctf;
    MockERC20 public usdc;

    address public operator;
    uint256 public operatorKey;
    
    address public maker1;
    uint256 public maker1Key;
    
    address public maker2;
    uint256 public maker2Key;

    bytes32 public conditionId;
    bytes32 public marketId;
    uint256 public yesTokenId;
    uint256 public noTokenId;

    // Constants
    uint256 constant ONE = 1e18;
    uint256 constant BPS_DIVISOR = 10000;

    function setUp() public override {
        super.setUp();

        // Create accounts with private keys for signing
        (operator, operatorKey) = makeAddrAndKey("operator");
        (maker1, maker1Key) = makeAddrAndKey("maker1");
        (maker2, maker2Key) = makeAddrAndKey("maker2");

        // Deploy contracts
        usdc = new MockERC20("USDC", "USDC", 6);
        ctf = new ConditionalTokens();
        exchange = new CTFExchange(address(usdc), address(ctf), operator);

        // Prepare a condition
        bytes32 questionId = keccak256("Will ETH reach $10k?");
        ctf.prepareCondition(address(this), questionId, 2);
        conditionId = ctf.getConditionId(address(this), questionId, 2);
        marketId = questionId;

        // Calculate token IDs
        bytes32 yesCollectionId = ctf.getCollectionId(bytes32(0), conditionId, 1);
        bytes32 noCollectionId = ctf.getCollectionId(bytes32(0), conditionId, 2);
        yesTokenId = ctf.getPositionId(usdc, yesCollectionId);
        noTokenId = ctf.getPositionId(usdc, noCollectionId);

        // Register tokens
        exchange.registerToken(yesTokenId, noTokenId, conditionId);

        // Fund users
        usdc.mint(maker1, 1_000_000e6);
        usdc.mint(maker2, 1_000_000e6);
        usdc.mint(operator, 1_000_000e6);

        // Approve exchange
        vm.prank(maker1);
        usdc.approve(address(exchange), type(uint256).max);
        vm.prank(maker2);
        usdc.approve(address(exchange), type(uint256).max);
        vm.prank(operator);
        usdc.approve(address(exchange), type(uint256).max);

        // Mint outcome tokens for sellers
        _mintOutcomeTokens(maker1, 500_000e6);
        _mintOutcomeTokens(maker2, 500_000e6);
        _mintOutcomeTokens(operator, 500_000e6);
    }

    // ============ Helper Functions ============

    function _mintOutcomeTokens(address user, uint256 amount) internal {
        // Split position to get outcome tokens
        vm.startPrank(user);
        usdc.approve(address(ctf), amount);
        
        uint256[] memory partition = new uint256[](2);
        partition[0] = 1;
        partition[1] = 2;
        
        ctf.splitPosition(usdc, bytes32(0), conditionId, partition, amount);
        
        // Approve exchange to transfer CTF tokens
        ctf.setApprovalForAll(address(exchange), true);
        vm.stopPrank();
    }

    function _createSignedOrder(
        address maker,
        uint256 makerKey,
        uint256 tokenId,
        ICTFExchange.Side side,
        uint256 makerAmount,
        uint256 takerAmount,
        uint256 salt
    ) internal view returns (ICTFExchange.SignedOrder memory order) {
        order = ICTFExchange.SignedOrder({
            salt: salt,
            maker: maker,
            signer: maker,
            taker: address(0),
            marketId: marketId,
            tokenId: tokenId,
            side: side,
            makerAmount: makerAmount,
            takerAmount: takerAmount,
            expiration: block.timestamp + 1 hours,
            nonce: exchange.nonces(maker),
            feeRateBps: 0, // No fees for simpler testing
            sigType: ICTFExchange.SignatureType.EOA,
            signature: new bytes(0)
        });

        // Sign the order
        bytes32 orderHash = exchange.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(makerKey, orderHash);
        order.signature = abi.encodePacked(r, s, v);
    }

    function _boundAmount(uint256 amount) internal pure returns (uint256) {
        return bound(amount, 1e6, 100_000e6); // 1 to 100K
    }

    function _boundPrice(uint256 price) internal pure returns (uint256) {
        // Price in basis points: 100 to 9900 (1% to 99%)
        return bound(price, 100, 9900);
    }

    // ============ Property Tests ============

    /**
     * @dev Feature: hybrid-clob-trading, Property: fillOrder executes correctly
     * For any valid signed order, fillOrder SHALL transfer the correct amounts
     * between maker and operator.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_transfersCorrectAmounts(
        uint256 makerAmountSeed,
        uint256 priceSeed,
        uint256 fillPercentSeed,
        uint256 salt
    ) public {
        // Use smaller amounts to ensure operator has enough tokens
        uint256 makerAmount = bound(makerAmountSeed, 1e6, 10_000e6); // 1 to 10K USDC
        uint256 price = bound(priceSeed, 1000, 9000); // 10% to 90% price
        
        // Calculate taker amount based on price (for a BUY order: maker gives USDC, gets tokens)
        // price = makerAmount / takerAmount => takerAmount = makerAmount * BPS_DIVISOR / price
        uint256 takerAmount = (makerAmount * BPS_DIVISOR) / price;
        if (takerAmount == 0) takerAmount = 1;
        
        // Ensure taker amount doesn't exceed operator's token balance
        uint256 operatorTokenBalance = ctf.balanceOf(operator, yesTokenId);
        if (takerAmount > operatorTokenBalance) {
            takerAmount = operatorTokenBalance / 2; // Use half to be safe
            if (takerAmount == 0) return; // Skip if no tokens
            // Recalculate maker amount based on constrained taker amount
            makerAmount = (takerAmount * price) / BPS_DIVISOR;
            if (makerAmount == 0) return;
        }
        
        // Bound fill amount to be <= maker amount
        uint256 fillPercent = bound(fillPercentSeed, 10, 100);
        uint256 fillAmount = (makerAmount * fillPercent) / 100;
        if (fillAmount == 0) fillAmount = 1;

        // Create a BUY order (maker gives USDC, wants tokens)
        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            takerAmount,
            salt
        );

        // Record balances before
        uint256 makerUsdcBefore = usdc.balanceOf(maker1);
        uint256 makerTokensBefore = ctf.balanceOf(maker1, yesTokenId);

        // Fill the order as operator
        vm.prank(operator);
        exchange.fillOrder(order, fillAmount);

        // Calculate expected taking amount
        uint256 expectedTaking = (fillAmount * takerAmount) / makerAmount;

        // Verify maker received tokens (minus any fees, but we set fees to 0)
        uint256 makerTokensAfter = ctf.balanceOf(maker1, yesTokenId);
        assertGe(
            makerTokensAfter,
            makerTokensBefore + expectedTaking - 1, // Allow 1 wei rounding
            "Property: Maker should receive tokens"
        );

        // Verify maker's USDC decreased
        uint256 makerUsdcAfter = usdc.balanceOf(maker1);
        assertEq(
            makerUsdcAfter,
            makerUsdcBefore - fillAmount,
            "Property: Maker USDC should decrease by fill amount"
        );
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: fillOrder respects order limits
     * For any fill amount greater than remaining, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsOverfill(
        uint256 makerAmountSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);
        uint256 takerAmount = makerAmount; // 1:1 for simplicity

        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            takerAmount,
            salt
        );

        // Try to fill more than the order amount
        uint256 overfillAmount = makerAmount + 1;

        vm.prank(operator);
        vm.expectRevert(ICTFExchange.MakingGtRemaining.selector);
        exchange.fillOrder(order, overfillAmount);
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: matchOrders for complementary trades
     * For any BUY vs SELL order pair with crossing prices, matchOrders SHALL
     * execute the trade correctly.
     * **Validates: Requirements 5.1, 5.2**
     */
    function testFuzz_matchOrders_complementary(
        uint256 takerAmountSeed,
        uint256 makerAmountSeed,
        uint256 salt1,
        uint256 salt2
    ) public {
        uint256 takerMakerAmount = _boundAmount(takerAmountSeed);
        uint256 makerMakerAmount = _boundAmount(makerAmountSeed);
        
        // Taker is buying tokens with USDC
        // Maker is selling tokens for USDC
        // For crossing: taker's price >= maker's price
        // Taker price = takerMakerAmount / takerTakerAmount (USDC per token)
        // Maker price = makerTakerAmount / makerMakerAmount (USDC per token)
        
        // Set prices so they cross
        uint256 takerTakerAmount = takerMakerAmount; // Taker willing to pay 1:1
        uint256 makerTakerAmount = makerMakerAmount; // Maker wants 1:1
        
        // Create taker BUY order
        ICTFExchange.SignedOrder memory takerOrder = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            takerMakerAmount,
            takerTakerAmount,
            salt1
        );

        // Create maker SELL order
        ICTFExchange.SignedOrder memory makerOrder = _createSignedOrder(
            maker2,
            maker2Key,
            yesTokenId,
            ICTFExchange.Side.SELL,
            makerMakerAmount,
            makerTakerAmount,
            salt2
        );

        // Determine fill amounts (minimum of both orders)
        uint256 fillAmount = takerMakerAmount < makerMakerAmount ? takerMakerAmount : makerMakerAmount;

        // Record balances before
        uint256 takerUsdcBefore = usdc.balanceOf(maker1);
        uint256 takerTokensBefore = ctf.balanceOf(maker1, yesTokenId);
        uint256 makerUsdcBefore = usdc.balanceOf(maker2);
        uint256 makerTokensBefore = ctf.balanceOf(maker2, yesTokenId);

        // Match orders
        ICTFExchange.SignedOrder[] memory makerOrders = new ICTFExchange.SignedOrder[](1);
        makerOrders[0] = makerOrder;
        uint256[] memory makerFillAmounts = new uint256[](1);
        makerFillAmounts[0] = fillAmount;

        vm.prank(operator);
        exchange.matchOrders(takerOrder, makerOrders, fillAmount, makerFillAmounts);

        // Verify taker received tokens
        uint256 takerTokensAfter = ctf.balanceOf(maker1, yesTokenId);
        assertGt(takerTokensAfter, takerTokensBefore, "Property: Taker should receive tokens");

        // Verify maker received USDC
        uint256 makerUsdcAfter = usdc.balanceOf(maker2);
        assertGt(makerUsdcAfter, makerUsdcBefore, "Property: Maker should receive USDC");
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Order signature validation
     * For any order with invalid signature, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsInvalidSignature(
        uint256 makerAmountSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);

        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            makerAmount,
            salt
        );

        // Corrupt the signature by changing a byte
        order.signature[0] = bytes1(uint8(order.signature[0]) ^ 0xFF);

        vm.prank(operator);
        // The contract may revert with either InvalidSignature or ECDSAInvalidSignature
        // depending on how the signature corruption affects recovery
        vm.expectRevert();
        exchange.fillOrder(order, makerAmount);
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Order expiration validation
     * For any expired order, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsExpiredOrder(
        uint256 makerAmountSeed,
        uint256 salt,
        uint256 timePassed
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);
        timePassed = bound(timePassed, 1 hours + 1, 365 days);

        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            makerAmount,
            salt
        );

        // Advance time past expiration
        vm.warp(block.timestamp + timePassed);

        vm.prank(operator);
        vm.expectRevert(ICTFExchange.OrderExpired.selector);
        exchange.fillOrder(order, makerAmount);
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Nonce validation
     * For any order with invalid nonce, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsInvalidNonce(
        uint256 makerAmountSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);

        // Increment maker's nonce first
        vm.prank(maker1);
        exchange.incrementNonce();

        // Create order with old nonce (0)
        ICTFExchange.SignedOrder memory order = ICTFExchange.SignedOrder({
            salt: salt,
            maker: maker1,
            signer: maker1,
            taker: address(0),
            marketId: marketId,
            tokenId: yesTokenId,
            side: ICTFExchange.Side.BUY,
            makerAmount: makerAmount,
            takerAmount: makerAmount,
            expiration: block.timestamp + 1 hours,
            nonce: 0, // Old nonce
            feeRateBps: 0,
            sigType: ICTFExchange.SignatureType.EOA,
            signature: new bytes(0)
        });

        // Sign with old nonce
        bytes32 orderHash = exchange.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(maker1Key, orderHash);
        order.signature = abi.encodePacked(r, s, v);

        vm.prank(operator);
        vm.expectRevert(ICTFExchange.InvalidNonce.selector);
        exchange.fillOrder(order, makerAmount);
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Cancelled order rejection
     * For any cancelled order, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsCancelledOrder(
        uint256 makerAmountSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);

        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            makerAmount,
            salt
        );

        // Cancel the order
        vm.prank(maker1);
        exchange.cancelOrder(order);

        // Try to fill cancelled order
        vm.prank(operator);
        vm.expectRevert(ICTFExchange.OrderFilledOrCancelled.selector);
        exchange.fillOrder(order, makerAmount);
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Partial fills track remaining
     * For any partially filled order, the remaining amount SHALL be tracked correctly.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_tracksPartialFills(
        uint256 makerAmountSeed,
        uint256 fillPercentSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);
        // Fill between 10% and 90%
        uint256 fillPercent = bound(fillPercentSeed, 10, 90);
        uint256 firstFill = (makerAmount * fillPercent) / 100;
        if (firstFill == 0) firstFill = 1;

        ICTFExchange.SignedOrder memory order = _createSignedOrder(
            maker1,
            maker1Key,
            yesTokenId,
            ICTFExchange.Side.BUY,
            makerAmount,
            makerAmount,
            salt
        );

        // First partial fill
        vm.prank(operator);
        exchange.fillOrder(order, firstFill);

        // Check remaining
        bytes32 orderHash = exchange.hashOrder(order);
        ICTFExchange.OrderStatus memory status = exchange.getOrderStatus(orderHash);
        
        assertEq(
            status.remaining,
            makerAmount - firstFill,
            "Property: Remaining should be tracked correctly"
        );
        assertFalse(status.isFilledOrCancelled, "Property: Order should not be fully filled");

        // Fill the rest
        uint256 secondFill = makerAmount - firstFill;
        vm.prank(operator);
        exchange.fillOrder(order, secondFill);

        // Check fully filled
        status = exchange.getOrderStatus(orderHash);
        assertTrue(status.isFilledOrCancelled, "Property: Order should be fully filled");
    }

    /**
     * @dev Feature: hybrid-clob-trading, Property: Fee rate validation
     * For any order with fee rate above maximum, fillOrder SHALL revert.
     * **Validates: Requirements 5.1**
     */
    function testFuzz_fillOrder_rejectsExcessiveFee(
        uint256 makerAmountSeed,
        uint256 feeRateSeed,
        uint256 salt
    ) public {
        uint256 makerAmount = _boundAmount(makerAmountSeed);
        // Fee rate above max (1000 bps = 10%)
        uint256 feeRate = bound(feeRateSeed, 1001, 10000);

        ICTFExchange.SignedOrder memory order = ICTFExchange.SignedOrder({
            salt: salt,
            maker: maker1,
            signer: maker1,
            taker: address(0),
            marketId: marketId,
            tokenId: yesTokenId,
            side: ICTFExchange.Side.BUY,
            makerAmount: makerAmount,
            takerAmount: makerAmount,
            expiration: block.timestamp + 1 hours,
            nonce: exchange.nonces(maker1),
            feeRateBps: feeRate,
            sigType: ICTFExchange.SignatureType.EOA,
            signature: new bytes(0)
        });

        bytes32 orderHash = exchange.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(maker1Key, orderHash);
        order.signature = abi.encodePacked(r, s, v);

        vm.prank(operator);
        vm.expectRevert(ICTFExchange.FeeTooHigh.selector);
        exchange.fillOrder(order, makerAmount);
    }
}
