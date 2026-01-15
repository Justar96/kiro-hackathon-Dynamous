// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

/**
 * @title Deploy
 * @notice Deployment script for the prediction market contracts
 * @dev Run with: forge script script/Deploy.s.sol:Deploy --rpc-url polygon --broadcast --verify
 */
contract Deploy is Script {
    // Polygon Mainnet addresses
    address constant USDC_POLYGON = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;
    
    // Polygon Amoy Testnet addresses (for testing)
    address constant USDC_AMOY = address(0); // Deploy mock USDC for testnet

    // Deployment parameters
    uint256 constant PROTOCOL_FEE_BPS = 200; // 2%
    uint256 constant MIN_INITIAL_LIQUIDITY = 10e6; // 10 USDC (6 decimals)
    uint256 constant DISPUTE_PERIOD = 24 hours;

    // Deployed contract addresses (set after deployment)
    address public conditionalTokens;
    address public orderBook;
    address public marketFactory;

    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // TODO: Deploy contracts in order:
        // 1. ConditionalTokens (ERC-1155 for outcome tokens)
        // 2. OrderBook (CLOB for trading)
        // 3. MarketFactory (creates individual markets)
        
        // Example deployment (uncomment when contracts are ready):
        // conditionalTokens = address(new ConditionalTokens());
        // console.log("ConditionalTokens deployed at:", conditionalTokens);
        
        // orderBook = address(new OrderBook(conditionalTokens, USDC_POLYGON));
        // console.log("OrderBook deployed at:", orderBook);
        
        // marketFactory = address(new MarketFactory(
        //     conditionalTokens,
        //     USDC_POLYGON,
        //     orderBook,
        //     PROTOCOL_FEE_BPS,
        //     MIN_INITIAL_LIQUIDITY,
        //     DISPUTE_PERIOD
        // ));
        // console.log("MarketFactory deployed at:", marketFactory);

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("Network: Polygon");
        console.log("USDC:", USDC_POLYGON);
        // console.log("ConditionalTokens:", conditionalTokens);
        // console.log("OrderBook:", orderBook);
        // console.log("MarketFactory:", marketFactory);
    }
}

/**
 * @title DeployTestnet
 * @notice Deployment script for testnet with mock tokens
 * @dev Run with: forge script script/Deploy.s.sol:DeployTestnet --rpc-url polygon_amoy --broadcast
 */
contract DeployTestnet is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        // TODO: Deploy mock USDC for testnet
        // TODO: Deploy all contracts with mock USDC

        vm.stopBroadcast();
    }
}
