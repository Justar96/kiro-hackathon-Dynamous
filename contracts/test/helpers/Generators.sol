// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/**
 * @title Generators
 * @notice Helper contract for generating bounded random values in fuzz tests
 * @dev Used for property-based testing with realistic input constraints
 */
abstract contract Generators is Test {
    // Collateral bounds
    uint256 constant GEN_MIN_COLLATERAL = 10e6; // 10 USDC
    uint256 constant GEN_MAX_COLLATERAL = 1_000_000e6; // 1M USDC

    // Price bounds (basis points)
    uint256 constant GEN_MIN_PRICE = 100; // $0.01
    uint256 constant GEN_MAX_PRICE = 9900; // $0.99

    // Quantity bounds
    uint256 constant GEN_MIN_QUANTITY = 1e6; // 1 token
    uint256 constant GEN_MAX_QUANTITY = 100_000e6; // 100K tokens

    // Time bounds
    uint256 constant GEN_MIN_DURATION = 1 hours;
    uint256 constant GEN_MAX_DURATION = 365 days;

    /// @notice Generate a valid collateral amount
    function genCollateral(uint256 seed) internal pure returns (uint256) {
        return bound(seed, GEN_MIN_COLLATERAL, GEN_MAX_COLLATERAL);
    }

    /// @notice Generate a valid price in basis points
    function genPrice(uint256 seed) internal pure returns (uint256) {
        return bound(seed, GEN_MIN_PRICE, GEN_MAX_PRICE);
    }

    /// @notice Generate a valid order quantity
    function genQuantity(uint256 seed) internal pure returns (uint256) {
        return bound(seed, GEN_MIN_QUANTITY, GEN_MAX_QUANTITY);
    }

    /// @notice Generate a valid market duration
    function genDuration(uint256 seed) internal pure returns (uint256) {
        return bound(seed, GEN_MIN_DURATION, GEN_MAX_DURATION);
    }

    /// @notice Generate a valid end time (future timestamp)
    function genEndTime(uint256 seed) internal view returns (uint256) {
        uint256 duration = genDuration(seed);
        return block.timestamp + duration;
    }

    /// @notice Generate a random address (non-zero)
    function genAddress(uint256 seed) internal pure returns (address) {
        address addr = address(uint160(uint256(keccak256(abi.encodePacked(seed)))));
        // Ensure non-zero address
        if (addr == address(0)) {
            addr = address(1);
        }
        return addr;
    }

    /// @notice Generate a random question ID
    function genQuestionId(uint256 seed) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked("Question", seed));
    }

    /// @notice Generate complementary prices (YES + NO = 1.00)
    /// @return yesPrice Price for YES token in basis points
    /// @return noPrice Price for NO token in basis points (10000 - yesPrice)
    function genComplementaryPrices(uint256 seed) internal pure returns (uint256 yesPrice, uint256 noPrice) {
        yesPrice = genPrice(seed);
        noPrice = 10000 - yesPrice;
    }

    /// @notice Generate an array of random addresses
    function genAddresses(uint256 seed, uint256 count) internal pure returns (address[] memory) {
        address[] memory addresses = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            addresses[i] = genAddress(uint256(keccak256(abi.encodePacked(seed, i))));
        }
        return addresses;
    }

    /// @notice Generate an array of random collateral amounts
    function genCollateralAmounts(uint256 seed, uint256 count) internal pure returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            amounts[i] = genCollateral(uint256(keccak256(abi.encodePacked(seed, i))));
        }
        return amounts;
    }
}
