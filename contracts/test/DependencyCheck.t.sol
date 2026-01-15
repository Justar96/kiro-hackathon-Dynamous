// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

// OpenZeppelin imports - verify access control and security
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Custom interfaces for Gnosis CTF and UMA Oracle (Solidity 0.8.x compatible)
import {IConditionalTokens} from "../src/interfaces/IConditionalTokens.sol";
import {IOptimisticOracleV3} from "../src/interfaces/IOptimisticOracleV3.sol";
import {IOptimisticOracleV3CallbackRecipient} from "../src/interfaces/IOptimisticOracleV3CallbackRecipient.sol";

// Helper libraries
import {CTFHelpers} from "../src/libraries/CTFHelpers.sol";

/**
 * @title DependencyCheck
 * @notice Simple test to verify all dependencies are properly installed and accessible
 */
contract DependencyCheck is Test {
    function test_OpenZeppelinImports() public pure {
        // If this compiles, OpenZeppelin is properly installed
        assertTrue(true, "OpenZeppelin imports successful");
    }

    function test_ConditionalTokensInterface() public pure {
        // Verify IConditionalTokens interface compiles
        // The interface selector should be non-zero
        bytes4 selector = IConditionalTokens.prepareCondition.selector;
        assertTrue(selector != bytes4(0), "IConditionalTokens interface valid");
    }

    function test_OptimisticOracleInterface() public pure {
        // Verify IOptimisticOracleV3 interface compiles
        bytes4 selector = IOptimisticOracleV3.assertTruth.selector;
        assertTrue(selector != bytes4(0), "IOptimisticOracleV3 interface valid");
    }

    function test_CTFHelpers() public pure {
        // Test CTFHelpers library functions
        bytes32 conditionId = CTFHelpers.getConditionId(address(1), bytes32(uint256(1)), 2);
        assertTrue(conditionId != bytes32(0), "CTFHelpers.getConditionId works");

        bytes32 collectionId = CTFHelpers.getCollectionId(bytes32(0), conditionId, 1);
        assertTrue(collectionId != bytes32(0), "CTFHelpers.getCollectionId works");

        uint256[] memory partition = CTFHelpers.getBinaryPartition();
        assertEq(partition.length, 2, "Binary partition has 2 elements");
        assertEq(partition[0], CTFHelpers.YES_INDEX_SET, "First element is YES");
        assertEq(partition[1], CTFHelpers.NO_INDEX_SET, "Second element is NO");
    }

    function test_AccessControlImport() public pure {
        // Verify AccessControl compiles
        assertTrue(true, "AccessControl import successful");
    }
}
