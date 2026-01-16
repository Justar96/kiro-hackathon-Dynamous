// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CTFExchange} from "../src/CTFExchange.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockGnosisSafe} from "./mocks/MockGnosisSafe.sol";
import {MockProxyWallet} from "./mocks/MockProxyWallet.sol";
import {ICTFExchange} from "../src/interfaces/ICTFExchange.sol";

/**
 * @title CTFExchangeMultiSigTest
 * @notice Unit tests for multi-signature validation in CTFExchange
 * @dev Validates Requirements 13.1, 13.2, 13.3
 */
contract CTFExchangeMultiSigTest is Test {
    CTFExchange public exchange;
    ConditionalTokens public ctf;
    MockERC20 public usdc;
    MockGnosisSafe public gnosisSafe;
    MockProxyWallet public proxyWallet;

    address public owner = address(this);
    address public operator = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);

    bytes32 public conditionId;
    uint256 public yesTokenId;
    uint256 public noTokenId;

    function setUp() public {
        // Deploy contracts
        usdc = new MockERC20("USDC", "USDC", 6);
        ctf = new ConditionalTokens();
        exchange = new CTFExchange(address(usdc), address(ctf), operator);

        // Prepare a condition
        bytes32 questionId = keccak256("Will ETH reach $10k?");
        ctf.prepareCondition(address(this), questionId, 2);
        conditionId = ctf.getConditionId(address(this), questionId, 2);

        // Calculate token IDs
        bytes32 yesCollectionId = ctf.getCollectionId(bytes32(0), conditionId, 1);
        bytes32 noCollectionId = ctf.getCollectionId(bytes32(0), conditionId, 2);
        yesTokenId = ctf.getPositionId(usdc, yesCollectionId);
        noTokenId = ctf.getPositionId(usdc, noCollectionId);

        // Register tokens
        exchange.registerToken(yesTokenId, noTokenId, conditionId);

        // Deploy mock multi-sig wallets
        address[] memory owners = new address[](2);
        owners[0] = alice;
        owners[1] = bob;
        gnosisSafe = new MockGnosisSafe(owners, 2);
        proxyWallet = new MockProxyWallet(alice);

        // Fund wallets
        usdc.mint(address(gnosisSafe), 1000e6);
        usdc.mint(address(proxyWallet), 1000e6);

        // Approve exchange from wallets
        vm.prank(address(gnosisSafe));
        usdc.approve(address(exchange), type(uint256).max);
        vm.prank(address(proxyWallet));
        usdc.approve(address(exchange), type(uint256).max);
    }

    // ============ Gnosis Safe Tests ============

    function test_gnosisSafe_validSignature() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(gnosisSafe),
            address(gnosisSafe),
            ICTFExchange.SignatureType.POLY_GNOSIS_SAFE
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Set the signature as valid in the mock
        gnosisSafe.setValidSignature(orderHash, true);
        
        // Should not revert
        exchange.validateOrderSignature(orderHash, order);
    }

    function test_gnosisSafe_invalidSignature() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(gnosisSafe),
            address(gnosisSafe),
            ICTFExchange.SignatureType.POLY_GNOSIS_SAFE
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Signature is not set as valid (default false)
        vm.expectRevert(ICTFExchange.InvalidSignature.selector);
        exchange.validateOrderSignature(orderHash, order);
    }

    function test_gnosisSafe_revertingContract() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(gnosisSafe),
            address(gnosisSafe),
            ICTFExchange.SignatureType.POLY_GNOSIS_SAFE
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Make the Safe revert
        gnosisSafe.setShouldRevert(true);
        
        vm.expectRevert(ICTFExchange.InvalidSignature.selector);
        exchange.validateOrderSignature(orderHash, order);
    }

    // ============ Proxy Wallet Tests ============

    function test_proxyWallet_validSignature() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(proxyWallet),
            address(proxyWallet),
            ICTFExchange.SignatureType.POLY_PROXY
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Set the signature as valid in the mock
        proxyWallet.setValidSignature(orderHash, true);
        
        // Should not revert
        exchange.validateOrderSignature(orderHash, order);
    }

    function test_proxyWallet_invalidSignature() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(proxyWallet),
            address(proxyWallet),
            ICTFExchange.SignatureType.POLY_PROXY
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Signature is not set as valid (default false)
        vm.expectRevert(ICTFExchange.InvalidSignature.selector);
        exchange.validateOrderSignature(orderHash, order);
    }

    function test_proxyWallet_revertingContract() public {
        ICTFExchange.SignedOrder memory order = _createOrder(
            address(proxyWallet),
            address(proxyWallet),
            ICTFExchange.SignatureType.POLY_PROXY
        );
        
        bytes32 orderHash = exchange.hashOrder(order);
        
        // Make the proxy revert
        proxyWallet.setShouldRevert(true);
        
        vm.expectRevert(ICTFExchange.InvalidSignature.selector);
        exchange.validateOrderSignature(orderHash, order);
    }

    // ============ Fee Withdrawal Tests ============

    function test_withdrawFees_collateral() public {
        // Fund exchange with fees
        usdc.mint(address(exchange), 100e6);
        
        uint256 balanceBefore = usdc.balanceOf(alice);
        
        exchange.withdrawFees(address(usdc), 50e6, alice);
        
        assertEq(usdc.balanceOf(alice), balanceBefore + 50e6);
    }

    function test_withdrawFees_zeroAddress() public {
        usdc.mint(address(exchange), 100e6);
        
        exchange.withdrawFees(address(0), 50e6, alice);
        
        // Should withdraw collateral when token is address(0)
        assertEq(usdc.balanceOf(alice), 50e6);
    }

    function test_withdrawFees_onlyOwner() public {
        usdc.mint(address(exchange), 100e6);
        
        vm.prank(alice);
        vm.expectRevert();
        exchange.withdrawFees(address(usdc), 50e6, alice);
    }

    // ============ Cancel All Orders Tests ============

    function test_cancelAllOrders() public {
        uint256 nonceBefore = exchange.nonces(alice);
        
        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit ICTFExchange.AllOrdersCancelled(alice, nonceBefore + 1);
        exchange.cancelAllOrders();
        
        assertEq(exchange.nonces(alice), nonceBefore + 1);
    }

    function test_cancelAllOrders_invalidatesOrders() public {
        // Create an order with current nonce
        uint256 currentNonce = exchange.nonces(alice);
        assertTrue(exchange.isValidNonce(alice, currentNonce));
        
        // Cancel all orders
        vm.prank(alice);
        exchange.cancelAllOrders();
        
        // Old nonce should be invalid
        assertFalse(exchange.isValidNonce(alice, currentNonce));
        // New nonce should be valid
        assertTrue(exchange.isValidNonce(alice, currentNonce + 1));
    }

    // ============ Helper Functions ============

    function _createOrder(
        address maker,
        address signer,
        ICTFExchange.SignatureType sigType
    ) internal view returns (ICTFExchange.SignedOrder memory) {
        return ICTFExchange.SignedOrder({
            salt: uint256(keccak256(abi.encodePacked(block.timestamp))),
            maker: maker,
            signer: signer,
            taker: address(0),
            marketId: keccak256("test-market"),
            tokenId: yesTokenId,
            side: ICTFExchange.Side.BUY,
            makerAmount: 100e6,
            takerAmount: 200e18,
            expiration: block.timestamp + 1 hours,
            nonce: 0,
            feeRateBps: 100,
            sigType: sigType,
            signature: new bytes(65) // Dummy signature
        });
    }
}
