// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IOptimisticOracleV3CallbackRecipient
 * @notice Interface for contracts that receive callbacks from UMA's Optimistic Oracle V3
 * @dev Implement this interface to receive assertion resolution callbacks
 */
interface IOptimisticOracleV3CallbackRecipient {
    /// @notice Callback for when an assertion is resolved
    /// @param assertionId The ID of the resolved assertion
    /// @param assertedTruthfully Whether the assertion was resolved as true
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external;

    /// @notice Callback for when an assertion is disputed
    /// @param assertionId The ID of the disputed assertion
    function assertionDisputedCallback(bytes32 assertionId) external;
}
