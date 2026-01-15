// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CTFExchange} from "../src/CTFExchange.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ICTFExchange} from "../src/interfaces/ICTFExchange.sol";

contract CTFExchangeTest is Test {
    CTFExchange public exchange;
    ConditionalTokens public ctf;
    MockERC20 public usdc;

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

        // Fund users
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);

        // Approve exchange
        vm.prank(alice);
        usdc.approve(address(exchange), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(exchange), type(uint256).max);
    }

    function test_registerToken() public view {
        ICTFExchange.TokenInfo memory info = exchange.registry(yesTokenId);
        assertEq(info.complement, noTokenId);
        assertEq(info.conditionId, conditionId);
    }

    function test_getComplement() public view {
        assertEq(exchange.getComplement(yesTokenId), noTokenId);
        assertEq(exchange.getComplement(noTokenId), yesTokenId);
    }

    function test_validateTokenId() public view {
        exchange.validateTokenId(yesTokenId);
        exchange.validateTokenId(noTokenId);
    }

    function test_validateTokenId_reverts() public {
        vm.expectRevert(ICTFExchange.InvalidTokenId.selector);
        exchange.validateTokenId(999);
    }

    function test_setOperator() public {
        address newOperator = address(0x999);
        exchange.setOperator(newOperator);
        assertEq(exchange.getOperator(), newOperator);
    }

    function test_pause() public {
        exchange.pause();
        // Would need to test that operations revert when paused
    }

    function test_incrementNonce() public {
        assertEq(exchange.nonces(alice), 0);
        
        vm.prank(alice);
        exchange.incrementNonce();
        
        assertEq(exchange.nonces(alice), 1);
    }
}
