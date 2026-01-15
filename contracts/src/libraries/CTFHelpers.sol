// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CTFHelpers
 * @notice Helper functions for Gnosis Conditional Token Framework operations
 * @dev Provides pure functions for computing condition IDs, collection IDs, and position IDs
 *      These match the calculations in the original CTF contract
 */
library CTFHelpers {
    /// @notice Binary outcome partition for YES/NO markets
    /// @dev Index set 1 (0b01) = YES outcome, Index set 2 (0b10) = NO outcome
    uint256 internal constant YES_INDEX_SET = 1; // 0b01
    uint256 internal constant NO_INDEX_SET = 2; // 0b10
    uint256 internal constant BINARY_OUTCOME_COUNT = 2;

    /// @notice Compute a condition ID from its components
    /// @param oracle The oracle address that will resolve the condition
    /// @param questionId The unique question identifier
    /// @param outcomeSlotCount Number of possible outcomes
    /// @return The condition ID (keccak256 hash)
    function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));
    }

    /// @notice Compute a collection ID from parent and condition
    /// @param parentCollectionId Parent collection (bytes32(0) for root)
    /// @param conditionId The condition ID
    /// @param indexSet The index set for this collection
    /// @return The collection ID
    function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(parentCollectionId, conditionId, indexSet));
    }

    /// @notice Compute a position ID (ERC-1155 token ID)
    /// @param collateralToken The collateral token address
    /// @param collectionId The collection ID
    /// @return The position ID
    function getPositionId(IERC20 collateralToken, bytes32 collectionId) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
    }

    /// @notice Get the YES token position ID for a binary market
    /// @param collateralToken The collateral token
    /// @param conditionId The condition ID
    /// @return The YES token position ID
    function getYesPositionId(IERC20 collateralToken, bytes32 conditionId) internal pure returns (uint256) {
        bytes32 collectionId = getCollectionId(bytes32(0), conditionId, YES_INDEX_SET);
        return getPositionId(collateralToken, collectionId);
    }

    /// @notice Get the NO token position ID for a binary market
    /// @param collateralToken The collateral token
    /// @param conditionId The condition ID
    /// @return The NO token position ID
    function getNoPositionId(IERC20 collateralToken, bytes32 conditionId) internal pure returns (uint256) {
        bytes32 collectionId = getCollectionId(bytes32(0), conditionId, NO_INDEX_SET);
        return getPositionId(collateralToken, collectionId);
    }

    /// @notice Get the binary partition array for splitting/merging
    /// @return partition Array containing [YES_INDEX_SET, NO_INDEX_SET]
    function getBinaryPartition() internal pure returns (uint256[] memory partition) {
        partition = new uint256[](2);
        partition[0] = YES_INDEX_SET;
        partition[1] = NO_INDEX_SET;
    }

    /// @notice Generate a question ID from market parameters
    /// @param creator The market creator address
    /// @param question The market question string
    /// @param endTime The market end time
    /// @return The question ID
    function generateQuestionId(address creator, string memory question, uint256 endTime)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(creator, question, endTime));
    }
}
