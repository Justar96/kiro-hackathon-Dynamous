// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMarket
 * @notice Interface for individual prediction market contracts
 * @dev Each market represents a binary question with YES/NO outcomes
 */
interface IMarket {
    // ============ Enums ============

    /// @notice Market lifecycle states
    enum State {
        ACTIVE,             // Market is open for trading
        PENDING_RESOLUTION, // End time passed, awaiting oracle resolution
        DISPUTED,           // Resolution has been disputed
        RESOLVED            // Final outcome determined
    }

    /// @notice Possible market outcomes
    enum Outcome {
        UNRESOLVED, // Not yet resolved
        YES,        // YES outcome won
        NO,         // NO outcome won
        INVALID     // Market declared invalid (50/50 redemption)
    }

    // ============ Events ============

    /// @dev Emitted when market state changes
    event StateChanged(State indexed newState);

    /// @dev Emitted when a resolution is proposed by the oracle
    event ResolutionProposed(Outcome indexed outcome, address proposer);

    /// @dev Emitted when a resolution is disputed
    event ResolutionDisputed(address disputer);

    /// @dev Emitted when market is finally resolved
    event MarketResolved(Outcome indexed outcome);

    /// @dev Emitted when tokens are minted from collateral
    event TokensMinted(address indexed user, uint256 amount);

    /// @dev Emitted when equal YES/NO tokens are redeemed for collateral
    event TokensRedeemed(address indexed user, uint256 yesAmount, uint256 noAmount);

    /// @dev Emitted when winning tokens are redeemed after resolution
    event WinningsRedeemed(address indexed user, Outcome tokenType, uint256 payout);

    // ============ View Functions ============

    /// @notice Get the unique question ID for this market
    function questionId() external view returns (bytes32);

    /// @notice Get the market question text
    function question() external view returns (string memory);

    /// @notice Get the resolution criteria
    function resolutionCriteria() external view returns (string memory);

    /// @notice Get the market end time
    function endTime() external view returns (uint256);

    /// @notice Get the current market state
    function state() external view returns (State);

    /// @notice Get the resolved outcome (only valid after resolution)
    function outcome() external view returns (Outcome);

    /// @notice Get the time when resolution was proposed
    function resolutionTime() external view returns (uint256);

    /// @notice Get the end of the dispute period
    function disputeEndTime() external view returns (uint256);

    /// @notice Get the YES token position ID
    function yesTokenId() external view returns (uint256);

    /// @notice Get the NO token position ID
    function noTokenId() external view returns (uint256);

    // ============ State-Changing Functions ============

    /// @notice Mint YES and NO tokens by depositing collateral
    /// @param collateralAmount Amount of collateral to deposit
    function mintTokens(uint256 collateralAmount) external;

    /// @notice Redeem equal amounts of YES and NO tokens for collateral
    /// @param amount Amount of each token to redeem
    function redeemTokens(uint256 amount) external;

    /// @notice Propose a resolution outcome (oracle only)
    /// @param _outcome The proposed outcome
    function proposeResolution(Outcome _outcome) external;

    /// @notice Dispute the proposed resolution
    function disputeResolution() external;

    /// @notice Finalize the resolution after dispute period
    function finalizeResolution() external;

    /// @notice Redeem winning tokens for collateral after resolution
    function redeemWinnings() external;
}
