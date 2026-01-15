// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IOptimisticOracleV3
 * @notice Interface for UMA's Optimistic Oracle V3
 * @dev This interface is compatible with Solidity 0.8.x and provides the essential
 *      functions needed for prediction market resolution
 */
interface IOptimisticOracleV3 {
    // ============ Structs ============

    /// @notice Data structure for an assertion
    struct Assertion {
        address asserter;
        bool settled;
        bool settlementResolution;
        uint64 assertionTime;
        uint64 expirationTime;
        IERC20 currency;
        uint256 bond;
        bytes32 identifier;
        address callbackRecipient;
        address escalationManager;
        address caller;
        bytes32 domainId;
    }

    // ============ Events ============

    /// @dev Emitted when a new assertion is made
    event AssertionMade(
        bytes32 indexed assertionId,
        bytes32 domainId,
        bytes claim,
        address indexed asserter,
        address callbackRecipient,
        address escalationManager,
        address caller,
        uint64 expirationTime,
        IERC20 currency,
        uint256 bond,
        bytes32 indexed identifier
    );

    /// @dev Emitted when an assertion is disputed
    event AssertionDisputed(bytes32 indexed assertionId, address indexed caller, address indexed disputer);

    /// @dev Emitted when an assertion is settled
    event AssertionSettled(
        bytes32 indexed assertionId, address indexed bondRecipient, bool disputed, bool settlementResolution, address settleCaller
    );

    // ============ Core Functions ============

    /// @notice Assert a claim about the world
    /// @param claim The claim being asserted (encoded as bytes)
    /// @param asserter The account making the assertion
    /// @param callbackRecipient Address to receive settlement callbacks
    /// @param escalationManager Address of escalation manager (or address(0))
    /// @param liveness Time in seconds for the assertion to be disputed
    /// @param currency ERC-20 token for the bond
    /// @param bond Amount of currency to bond
    /// @param identifier Price identifier for the assertion
    /// @param domainId Domain identifier for the assertion
    /// @return assertionId Unique identifier for the assertion
    function assertTruth(
        bytes calldata claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);

    /// @notice Simplified assertion with default parameters
    /// @param claim The claim being asserted
    /// @param asserter The account making the assertion
    /// @return assertionId Unique identifier for the assertion
    function assertTruthWithDefaults(bytes calldata claim, address asserter)
        external
        returns (bytes32 assertionId);

    /// @notice Dispute an assertion
    /// @param assertionId The assertion to dispute
    /// @param disputer The account disputing the assertion
    function disputeAssertion(bytes32 assertionId, address disputer) external;

    /// @notice Settle an assertion after the liveness period
    /// @param assertionId The assertion to settle
    function settleAssertion(bytes32 assertionId) external;

    /// @notice Settle and get the result of an assertion
    /// @param assertionId The assertion to settle
    /// @return The settlement result (true if assertion was correct)
    function settleAndGetAssertionResult(bytes32 assertionId) external returns (bool);

    /// @notice Get the result of a settled assertion
    /// @param assertionId The assertion ID
    /// @return The settlement result
    function getAssertionResult(bytes32 assertionId) external view returns (bool);

    // ============ View Functions ============

    /// @notice Get assertion data
    /// @param assertionId The assertion ID
    /// @return The assertion struct
    function getAssertion(bytes32 assertionId) external view returns (Assertion memory);

    /// @notice Get the minimum bond amount for a currency
    /// @param currency The bond currency
    /// @return The minimum bond
    function getMinimumBond(address currency) external view returns (uint256);

    /// @notice Get the default liveness period
    /// @return The default liveness in seconds
    function defaultLiveness() external view returns (uint64);

    /// @notice Get the default currency for bonds
    /// @return The default currency address
    function defaultCurrency() external view returns (IERC20);

    /// @notice Get the default identifier
    /// @return The default identifier
    function defaultIdentifier() external view returns (bytes32);

    /// @notice Sync the oracle's parameters with the UMA ecosystem
    function syncUmaParams(bytes32 identifier, address currency) external;

    /// @notice Stamp an assertion with additional data
    /// @param assertionId The assertion ID
    /// @return The stamped assertion ID
    function stampAssertion(bytes32 assertionId) external view returns (bytes32);
}
