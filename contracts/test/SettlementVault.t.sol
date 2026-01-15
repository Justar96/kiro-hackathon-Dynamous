// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {ISettlementVault} from "../src/interfaces/ISettlementVault.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract SettlementVaultTest is Test {
    SettlementVault public vault;
    MockERC20 public usdc;

    address public owner = address(this);
    address public operator = address(0x1);
    address public alice = address(0x2);
    address public bob = address(0x3);

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        vault = new SettlementVault(address(usdc), operator);

        // Fund users
        usdc.mint(alice, 1000e6);
        usdc.mint(bob, 1000e6);
        usdc.mint(address(vault), 10000e6); // Fund vault for claims

        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(alice);
        vault.deposit(100e6);

        assertEq(vault.deposits(alice), 100e6);
        assertEq(usdc.balanceOf(alice), 900e6);
    }

    function test_deposit_reverts_zero() public {
        vm.prank(alice);
        vm.expectRevert(ISettlementVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_commitEpoch() public {
        bytes32 root = keccak256("test root");
        
        vm.prank(operator);
        vault.commitEpoch(root, 1000e6);

        assertEq(vault.currentEpoch(), 1);
        
        ISettlementVault.Epoch memory epoch = vault.getEpoch(1);
        assertEq(epoch.merkleRoot, root);
        assertEq(epoch.totalAmount, 1000e6);
    }

    function test_commitEpoch_onlyOperator() public {
        vm.prank(alice);
        vm.expectRevert(ISettlementVault.NotOperator.selector);
        vault.commitEpoch(bytes32(0), 0);
    }

    function test_claim_withValidProof() public {
        // Create a simple Merkle tree with one leaf
        // leaf = keccak256(abi.encodePacked(alice, 100e6))
        bytes32 leaf = keccak256(abi.encodePacked(alice, uint256(100e6)));
        bytes32 root = leaf; // Single leaf tree
        
        vm.prank(operator);
        vault.commitEpoch(root, 100e6);

        uint256 balanceBefore = usdc.balanceOf(alice);
        
        vm.prank(alice);
        vault.claim(1, 100e6, new bytes32[](0)); // Empty proof for single leaf

        assertEq(usdc.balanceOf(alice), balanceBefore + 100e6);
        assertTrue(vault.hasClaimed(alice, 1));
    }

    function test_claim_reverts_alreadyClaimed() public {
        bytes32 leaf = keccak256(abi.encodePacked(alice, uint256(100e6)));
        
        vm.prank(operator);
        vault.commitEpoch(leaf, 100e6);

        vm.prank(alice);
        vault.claim(1, 100e6, new bytes32[](0));

        vm.prank(alice);
        vm.expectRevert(ISettlementVault.AlreadyClaimed.selector);
        vault.claim(1, 100e6, new bytes32[](0));
    }

    function test_claim_reverts_invalidProof() public {
        bytes32 root = keccak256("some root");
        
        vm.prank(operator);
        vault.commitEpoch(root, 100e6);

        vm.prank(alice);
        vm.expectRevert(ISettlementVault.InvalidProof.selector);
        vault.claim(1, 100e6, new bytes32[](0));
    }

    function test_deductDeposit() public {
        vm.prank(alice);
        vault.deposit(100e6);

        vm.prank(operator);
        vault.deductDeposit(alice, 30e6);

        assertEq(vault.deposits(alice), 70e6);
    }

    function test_deductDeposit_reverts_insufficient() public {
        vm.prank(alice);
        vault.deposit(100e6);

        vm.prank(operator);
        vm.expectRevert(ISettlementVault.InsufficientDeposit.selector);
        vault.deductDeposit(alice, 200e6);
    }

    function test_creditDeposit() public {
        vm.prank(operator);
        vault.creditDeposit(alice, 50e6);

        assertEq(vault.deposits(alice), 50e6);
    }

    function test_setOperator() public {
        address newOperator = address(0x999);
        vault.setOperator(newOperator);
        assertEq(vault.operator(), newOperator);
    }
}
