// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMarketFactory
 * @notice Interface for the MarketFactory contract
 * @dev Deploys and tracks all prediction markets
 */
interface IMarketFactory {
    // ============ Events ============

    /// @dev Emitted when a new market is created
    event MarketCreated(
        address indexed market,
        bytes32 indexed questionId,
        string question,
        uint256 endTime,
        address creator
    );

    // ============ Errors ============

    error InvalidEndDate(uint256 endDate, uint256 currentTime);
    error InsufficientInitialLiquidity(uint256 provided, uint256 minimum);
    error MarketAlreadyExists(bytes32 questionId);
    error EmptyQuestion();
    error EmptyResolutionCriteria();

    // ============ View Functions ============

    /// @notice Get the market address for a given question ID
    /// @param questionId The unique question identifier
    /// @return The market contract address (address(0) if not found)
    function markets(bytes32 questionId) external view returns (address);

    /// @notice Get all deployed market addresses
    /// @return Array of all market addresses
    function allMarkets() external view returns (address[] memory);

    /// @notice Get the number of deployed markets
    /// @return The total number of markets
    function marketCount() external view returns (uint256);

    /// @notice Get the ConditionalTokens contract address
    /// @return The ConditionalTokens contract address
    function conditionalTokens() external view returns (address);

    /// @notice Get the collateral token address (USDC)
    /// @return The collateral token address
    function collateralToken() external view returns (address);

    /// @notice Get the oracle address
    /// @return The oracle address
    function oracle() external view returns (address);

    /// @notice Get the fee recipient address
    /// @return The fee recipient address
    function feeRecipient() external view returns (address);

    /// @notice Get the minimum initial liquidity required
    /// @return The minimum liquidity in collateral token units
    function minInitialLiquidity() external view returns (uint256);

    // ============ State-Changing Functions ============

    /// @notice Create a new prediction market
    /// @param question The market question text
    /// @param resolutionCriteria The resolution criteria description
    /// @param endTime The market end time (must be in the future)
    /// @param initialLiquidity The initial liquidity to provide (must meet minimum)
    /// @return market The address of the newly created market
    function createMarket(
        string calldata question,
        string calldata resolutionCriteria,
        uint256 endTime,
        uint256 initialLiquidity
    ) external returns (address market);
}
