// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ConditionalTokens} from "../src/ConditionalTokens.sol";
import {CTFExchange} from "../src/CTFExchange.sol";
import {SettlementVault} from "../src/SettlementVault.sol";
import {MarketFactory} from "../src/MarketFactory.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";

/**
 * @title DeployLocal
 * @notice Deployment script for local development on Anvil
 * @dev Deploys all contracts and funds test accounts
 *      Run with: forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://localhost:8545 --broadcast
 */
contract DeployLocal is Script {
    // ============ Constants ============

    /// @notice Amount of USDC to fund each test account (10,000 USDC with 6 decimals)
    uint256 public constant USDC_FUND_AMOUNT = 10_000e6;

    /// @notice Amount of native tokens (ETH) to fund each test account (10 ETH)
    uint256 public constant NATIVE_FUND_AMOUNT = 10 ether;

    /// @notice Number of test accounts to fund
    uint256 public constant NUM_TEST_ACCOUNTS = 5;

    // ============ Deployed Contracts ============

    MockERC20 public usdc;
    ConditionalTokens public conditionalTokens;
    CTFExchange public ctfExchange;
    SettlementVault public settlementVault;
    MarketFactory public marketFactory;

    // ============ Test Accounts ============

    /// @notice Anvil's default test accounts (derived from mnemonic)
    address[5] public testAccounts = [
        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, // Account 0
        0x70997970C51812dc3A010C7d01b50e0d17dc79C8, // Account 1
        0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, // Account 2
        0x90F79bf6EB2c4f870365E785982E1f101E93b906, // Account 3
        0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65  // Account 4
    ];

    // ============ Main Entry Point ============

    function run() external returns (
        address usdcAddr,
        address ctfAddr,
        address exchangeAddr,
        address vaultAddr,
        address factoryAddr
    ) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== DeployLocal: Starting deployment ===");
        console.log("Deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockERC20 (USDC)
        usdc = new MockERC20("USD Coin", "USDC", 6);
        console.log("MockERC20 (USDC):", address(usdc));

        // 2. Deploy ConditionalTokens
        conditionalTokens = new ConditionalTokens();
        console.log("ConditionalTokens:", address(conditionalTokens));

        // 3. Deploy CTFExchange
        ctfExchange = new CTFExchange(address(usdc), address(conditionalTokens), deployer);
        console.log("CTFExchange:", address(ctfExchange));

        // 4. Deploy SettlementVault
        settlementVault = new SettlementVault(address(usdc), deployer);
        console.log("SettlementVault:", address(settlementVault));

        // 5. Deploy MarketFactory
        marketFactory = new MarketFactory(
            address(conditionalTokens),
            address(usdc),
            deployer, // oracle
            deployer  // feeRecipient
        );
        console.log("MarketFactory:", address(marketFactory));

        // 6. Fund test accounts
        fundTestAccounts();

        // 7. Verify deployments
        verifyDeployments();

        vm.stopBroadcast();

        // Output JSON format for easy parsing
        _outputJson();

        return (
            address(usdc),
            address(conditionalTokens),
            address(ctfExchange),
            address(settlementVault),
            address(marketFactory)
        );
    }

    // ============ Test Account Funding ============

    /**
     * @notice Fund test accounts with USDC and native tokens
     * @dev Mints USDC and sends ETH to each test account
     */
    function fundTestAccounts() public {
        console.log("=== Funding test accounts ===");

        for (uint256 i = 0; i < NUM_TEST_ACCOUNTS; i++) {
            address account = testAccounts[i];

            // Mint USDC to test account
            usdc.mint(account, USDC_FUND_AMOUNT);
            console.log("Funded account", i, "with USDC:", account);

            // Fund with native tokens (ETH) if needed
            // Note: Anvil accounts already have ETH, but we ensure they have enough
            if (account.balance < NATIVE_FUND_AMOUNT) {
                (bool success,) = account.call{value: NATIVE_FUND_AMOUNT - account.balance}("");
                if (success) {
                    console.log("Funded account", i, "with ETH");
                }
            }
        }

        console.log("Test accounts funded successfully");
    }

    // ============ Deployment Verification ============

    /**
     * @notice Verify all contracts are deployed correctly
     * @dev Calls view functions on each contract to ensure they're functional
     */
    function verifyDeployments() public view {
        console.log("=== Verifying deployments ===");

        // Verify USDC
        require(bytes(usdc.name()).length > 0, "USDC: name() failed");
        require(bytes(usdc.symbol()).length > 0, "USDC: symbol() failed");
        require(usdc.decimals() == 6, "USDC: decimals() mismatch");
        console.log("USDC verified: name =", usdc.name(), ", symbol =", usdc.symbol());

        // Verify ConditionalTokens (check bytecode exists)
        require(address(conditionalTokens).code.length > 0, "ConditionalTokens: no bytecode");
        console.log("ConditionalTokens verified: bytecode deployed");

        // Verify CTFExchange
        require(ctfExchange.getCollateral() == address(usdc), "CTFExchange: collateral mismatch");
        require(ctfExchange.getCtf() == address(conditionalTokens), "CTFExchange: CTF mismatch");
        require(ctfExchange.getOperator() != address(0), "CTFExchange: operator not set");
        console.log("CTFExchange verified: collateral =", ctfExchange.getCollateral());

        // Verify SettlementVault
        require(address(settlementVault.collateral()) == address(usdc), "SettlementVault: collateral mismatch");
        require(settlementVault.operator() != address(0), "SettlementVault: operator not set");
        console.log("SettlementVault verified: collateral =", address(settlementVault.collateral()));

        // Verify MarketFactory
        require(marketFactory.conditionalTokens() == address(conditionalTokens), "MarketFactory: CTF mismatch");
        require(marketFactory.collateralToken() == address(usdc), "MarketFactory: collateral mismatch");
        require(marketFactory.oracle() != address(0), "MarketFactory: oracle not set");
        console.log("MarketFactory verified: CTF =", marketFactory.conditionalTokens());

        // Verify test accounts have USDC
        for (uint256 i = 0; i < NUM_TEST_ACCOUNTS; i++) {
            require(usdc.balanceOf(testAccounts[i]) >= USDC_FUND_AMOUNT, "Test account USDC balance too low");
        }
        console.log("Test account balances verified");

        console.log("=== All deployments verified successfully ===");
    }

    // ============ JSON Output ============

    /**
     * @notice Output deployed addresses in JSON format
     * @dev Useful for parsing by shell scripts
     */
    function _outputJson() internal view {
        console.log("");
        console.log("=== Deployed Addresses (JSON) ===");
        console.log("{");
        console.log('  "usdc": "%s",', address(usdc));
        console.log('  "conditionalTokens": "%s",', address(conditionalTokens));
        console.log('  "ctfExchange": "%s",', address(ctfExchange));
        console.log('  "settlementVault": "%s",', address(settlementVault));
        console.log('  "marketFactory": "%s"', address(marketFactory));
        console.log("}");
        console.log("");
        console.log("=== Environment Variables ===");
        console.log("USDC_ADDRESS=%s", address(usdc));
        console.log("CTF_ADDRESS=%s", address(conditionalTokens));
        console.log("EXCHANGE_ADDRESS=%s", address(ctfExchange));
        console.log("VAULT_ADDRESS=%s", address(settlementVault));
        console.log("MARKET_FACTORY_ADDRESS=%s", address(marketFactory));
    }
}
