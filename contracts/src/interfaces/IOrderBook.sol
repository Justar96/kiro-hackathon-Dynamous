// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IOrderBook
 * @notice Interface for the Central Limit Order Book contract
 * @dev Manages order placement, matching, and cancellation for outcome tokens
 */
interface IOrderBook {
    // ============ Enums ============

    /// @notice Order side (buy or sell)
    enum Side {
        BUY,
        SELL
    }

    // ============ Structs ============

    /// @notice Order data structure
    struct Order {
        uint256 id;
        address maker;
        bytes32 marketId;
        uint256 tokenId;
        Side side;
        uint256 price;      // In basis points (100-9900 = $0.01-$0.99)
        uint256 quantity;
        uint256 filled;
        uint256 timestamp;
        bool active;
    }

    // ============ Events ============

    /// @dev Emitted when a new order is placed
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        bytes32 indexed marketId,
        uint256 tokenId,
        Side side,
        uint256 price,
        uint256 quantity
    );

    /// @dev Emitted when an order is filled (partially or fully)
    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 fillAmount,
        uint256 fillPrice
    );

    /// @dev Emitted when an order is cancelled
    event OrderCancelled(uint256 indexed orderId);

    /// @dev Emitted when a trade is executed
    event Trade(
        bytes32 indexed marketId,
        uint256 indexed tokenId,
        address buyer,
        address seller,
        uint256 price,
        uint256 quantity
    );

    // ============ Errors ============

    error InvalidPrice(uint256 price);
    error InvalidQuantity();
    error OrderNotFound(uint256 orderId);
    error OrderNotActive(uint256 orderId);
    error UnauthorizedCancellation(address caller, address maker);
    error InsufficientCollateral(uint256 required, uint256 available);
    error InsufficientTokenBalance(uint256 required, uint256 available);
    error MarketPaused();
    error InvalidMarket();

    // ============ View Functions ============

    /// @notice Get an order by ID
    function orders(uint256 orderId) external view returns (Order memory);

    /// @notice Get the best bid price and quantity for a market/token
    function getBestBid(bytes32 marketId, uint256 tokenId) 
        external view returns (uint256 price, uint256 quantity);

    /// @notice Get the best ask price and quantity for a market/token
    function getBestAsk(bytes32 marketId, uint256 tokenId) 
        external view returns (uint256 price, uint256 quantity);

    /// @notice Get the order book depth for a market/token
    function getOrderBook(bytes32 marketId, uint256 tokenId, uint256 depth)
        external view returns (Order[] memory bids, Order[] memory asks);

    /// @notice Get all active orders for a user
    function getUserOrders(address user) external view returns (Order[] memory);

    /// @notice Get the next order ID
    function nextOrderId() external view returns (uint256);

    /// @notice Get the conditional tokens contract address
    function conditionalTokens() external view returns (address);

    /// @notice Get the collateral token address
    function collateralToken() external view returns (address);

    // ============ State-Changing Functions ============

    /// @notice Place a new order
    /// @param marketId The market identifier
    /// @param tokenId The outcome token ID (YES or NO)
    /// @param side BUY or SELL
    /// @param price Price in basis points (100-9900)
    /// @param quantity Amount of tokens
    /// @return orderId The ID of the created order
    function placeOrder(
        bytes32 marketId,
        uint256 tokenId,
        Side side,
        uint256 price,
        uint256 quantity
    ) external returns (uint256 orderId);

    /// @notice Cancel an existing order
    /// @param orderId The order ID to cancel
    function cancelOrder(uint256 orderId) external;
}
