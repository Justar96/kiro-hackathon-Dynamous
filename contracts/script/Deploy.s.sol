// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {CTFExchange} from "../src/CTFExchange.sol";
import {Vault} from "../src/Vault.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {MarketFactory} from "../src/MarketFactory.sol";

/**
 * @title Deploy
 * @notice Deployment script for the hybrid prediction market
 * @dev Run with: forge script script/Deploy.s.sol:Deploy --rpc-url polygon --broadcast --verify
 */
contract Deploy is Script {
    // Polygon Mainnet USDC
    address constant USDC_POLYGON = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ConditionalTokens
        ConditionalTokens ctf = new ConditionalTokens();
        console.log("ConditionalTokens:", address(ctf));

        // 2. Deploy Vault (simple deposits)
        Vault vault = new Vault(USDC_POLYGON, deployer);
        console.log("Vault:", address(vault));

        // 3. Deploy SettlementVault (Merkle-based)
        SettlementVault settlementVault = new SettlementVault(USDC_POLYGON, deployer);
        console.log("SettlementVault:", address(settlementVault));

        // 4. Deploy CTFExchange
        CTFExchange exchange = new CTFExchange(USDC_POLYGON, address(ctf), deployer);
        console.log("CTFExchange:", address(exchange));

        // 5. Deploy MarketFactory
        MarketFactory factory = new MarketFactory(address(ctf), USDC_POLYGON, deployer, deployer);
        console.log("MarketFactory:", address(factory));

        vm.stopBroadcast();
    }
}


