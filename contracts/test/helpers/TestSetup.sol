// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/**
 * @title TestSetup
 * @notice Base test contract with common setup for all prediction market tests
 * @dev Provides test accounts, constants, and helper functions
 */
abstract contract TestSetup is Test {
    // Test accounts
    address public deployer;
    address public oracle;
    address public user1;
    address public user2;
    address public user3;
    address public marketCreator;
    address public feeRecipient;

    // Common constants matching design spec
    uint256 constant INITIAL_BALANCE = 1_000_000e6; // 1M USDC (6 decimals)
    uint256 constant MIN_COLLATERAL = 10e6; // 10 USDC - minimum initial liquidity
    uint256 constant MAX_COLLATERAL = 100_000e6; // 100K USDC
    uint256 constant PROTOCOL_FEE_BPS = 200; // 2% fee
    uint256 constant DISPUTE_PERIOD = 24 hours;
    
    // Price bounds (in basis points: 1-9999 = $0.0001-$0.9999)
    uint256 constant MIN_PRICE_BPS = 100; // $0.01
    uint256 constant MAX_PRICE_BPS = 9900; // $0.99
    
    // USDC decimals
    uint256 constant USDC_DECIMALS = 6;

    function setUp() public virtual {
        // Create test accounts with labels for better trace output
        deployer = makeAddr("deployer");
        oracle = makeAddr("oracle");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        marketCreator = makeAddr("marketCreator");
        feeRecipient = makeAddr("feeRecipient");

        // Fund accounts with ETH for gas
        vm.deal(deployer, 100 ether);
        vm.deal(oracle, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
        vm.deal(marketCreator, 100 ether);
        vm.deal(feeRecipient, 100 ether);
    }

    /// @notice Helper to create a unique question ID from a question string
    function createQuestionId(string memory question) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(question));
    }

    /// @notice Helper to advance block timestamp
    function advanceTime(uint256 seconds_) internal {
        vm.warp(block.timestamp + seconds_);
    }

    /// @notice Helper to advance block number
    function advanceBlocks(uint256 blocks) internal {
        vm.roll(block.number + blocks);
    }

    /// @notice Helper to convert price from decimal (0.01-0.99) to basis points (100-9900)
    function priceToBasisPoints(uint256 pricePercent) internal pure returns (uint256) {
        return pricePercent * 100;
    }

    /// @notice Helper to convert basis points to price decimal
    function basisPointsToPrice(uint256 bps) internal pure returns (uint256) {
        return bps / 100;
    }

    /// @notice Helper to convert USDC amount to units (6 decimals)
    function toUsdcUnits(uint256 amount) internal pure returns (uint256) {
        return amount * 10 ** USDC_DECIMALS;
    }

    /// @notice Helper to convert USDC units to amount
    function fromUsdcUnits(uint256 units) internal pure returns (uint256) {
        return units / 10 ** USDC_DECIMALS;
    }

    /// @notice Helper to calculate expected payout after protocol fee
    function calculatePayoutAfterFee(uint256 amount) internal pure returns (uint256) {
        return amount * (10000 - PROTOCOL_FEE_BPS) / 10000;
    }

    /// @notice Helper to get a future timestamp
    function futureTimestamp(uint256 daysFromNow) internal view returns (uint256) {
        return block.timestamp + (daysFromNow * 1 days);
    }

    /// @notice Helper to bound a fuzz input to valid collateral range
    function boundCollateral(uint256 amount) internal pure returns (uint256) {
        return bound(amount, MIN_COLLATERAL, MAX_COLLATERAL);
    }

    /// @notice Helper to bound a fuzz input to valid price range (basis points)
    function boundPrice(uint256 price) internal pure returns (uint256) {
        return bound(price, MIN_PRICE_BPS, MAX_PRICE_BPS);
    }
}
