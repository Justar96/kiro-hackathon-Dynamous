// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IOrderBook} from "./interfaces/IOrderBook.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

/**
 * @title OrderBook
 * @notice Central Limit Order Book for trading outcome tokens
 * @dev Implements price-time priority matching with escrow for orders
 *      Implements Ownable for admin functions and Pausable for emergency stops
 */
contract OrderBook is IOrderBook, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Minimum price in basis points ($0.01)
    uint256 public constant MIN_PRICE = 100;

    /// @notice Maximum price in basis points ($0.99)
    uint256 public constant MAX_PRICE = 9900;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ Immutable State ============

    /// @notice The Conditional Tokens Framework contract
    IConditionalTokens private immutable _conditionalTokens;

    /// @notice The collateral token (USDC)
    IERC20 private immutable _collateralToken;

    // ============ Mutable State ============

    /// @notice Next order ID counter
    uint256 private _nextOrderId;

    /// @notice Mapping from order ID to Order
    mapping(uint256 => Order) private _orders;

    /// @notice Mapping from user to their order IDs
    mapping(address => uint256[]) private _userOrderIds;

    /// @notice Mapping from marketId => tokenId => array of bid order IDs (sorted by price desc, time asc)
    mapping(bytes32 => mapping(uint256 => uint256[])) private _bidOrderIds;

    /// @notice Mapping from marketId => tokenId => array of ask order IDs (sorted by price asc, time asc)
    mapping(bytes32 => mapping(uint256 => uint256[])) private _askOrderIds;

    // ============ Constructor ============

    /**
     * @notice Create a new OrderBook
     * @param conditionalTokensAddr Address of the CTF contract
     * @param collateralTokenAddr Address of the collateral token (USDC)
     */
    constructor(address conditionalTokensAddr, address collateralTokenAddr) Ownable(msg.sender) {
        _conditionalTokens = IConditionalTokens(conditionalTokensAddr);
        _collateralToken = IERC20(collateralTokenAddr);
        _nextOrderId = 1; // Start from 1 so 0 can indicate "no order"
    }

    // ============ View Functions ============

    /// @inheritdoc IOrderBook
    function orders(uint256 orderId) external view override returns (Order memory) {
        return _orders[orderId];
    }

    /// @inheritdoc IOrderBook
    function nextOrderId() external view override returns (uint256) {
        return _nextOrderId;
    }

    /// @inheritdoc IOrderBook
    function conditionalTokens() external view override returns (address) {
        return address(_conditionalTokens);
    }

    /// @inheritdoc IOrderBook
    function collateralToken() external view override returns (address) {
        return address(_collateralToken);
    }

    /// @inheritdoc IOrderBook
    function getBestBid(bytes32 marketId, uint256 tokenId)
        external view override returns (uint256 price, uint256 quantity)
    {
        uint256[] storage bidIds = _bidOrderIds[marketId][tokenId];
        
        // Find first active bid (highest price)
        for (uint256 i = 0; i < bidIds.length; i++) {
            Order storage order = _orders[bidIds[i]];
            if (order.active && order.quantity > order.filled) {
                return (order.price, order.quantity - order.filled);
            }
        }
        return (0, 0);
    }

    /// @inheritdoc IOrderBook
    function getBestAsk(bytes32 marketId, uint256 tokenId)
        external view override returns (uint256 price, uint256 quantity)
    {
        uint256[] storage askIds = _askOrderIds[marketId][tokenId];
        
        // Find first active ask (lowest price)
        for (uint256 i = 0; i < askIds.length; i++) {
            Order storage order = _orders[askIds[i]];
            if (order.active && order.quantity > order.filled) {
                return (order.price, order.quantity - order.filled);
            }
        }
        return (0, 0);
    }

    /// @inheritdoc IOrderBook
    function getOrderBook(bytes32 marketId, uint256 tokenId, uint256 depth)
        external view override returns (Order[] memory bids, Order[] memory asks)
    {
        bids = _getActiveOrders(_bidOrderIds[marketId][tokenId], depth);
        asks = _getActiveOrders(_askOrderIds[marketId][tokenId], depth);
    }

    /// @inheritdoc IOrderBook
    function getUserOrders(address user) external view override returns (Order[] memory) {
        uint256[] storage orderIds = _userOrderIds[user];
        uint256 activeCount = 0;
        
        // Count active orders
        for (uint256 i = 0; i < orderIds.length; i++) {
            if (_orders[orderIds[i]].active) {
                activeCount++;
            }
        }
        
        // Build result array
        Order[] memory result = new Order[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < orderIds.length; i++) {
            if (_orders[orderIds[i]].active) {
                result[idx++] = _orders[orderIds[i]];
            }
        }
        
        return result;
    }

    // ============ Internal View Functions ============

    /// @notice Get active orders from an order ID array up to depth
    function _getActiveOrders(uint256[] storage orderIds, uint256 depth)
        internal view returns (Order[] memory)
    {
        uint256 count = 0;
        
        // First pass: count active orders up to depth
        for (uint256 i = 0; i < orderIds.length && count < depth; i++) {
            if (_orders[orderIds[i]].active && _orders[orderIds[i]].quantity > _orders[orderIds[i]].filled) {
                count++;
            }
        }
        
        // Second pass: build result
        Order[] memory result = new Order[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < orderIds.length && idx < count; i++) {
            Order storage order = _orders[orderIds[i]];
            if (order.active && order.quantity > order.filled) {
                result[idx++] = order;
            }
        }
        
        return result;
    }

    // ============ State-Changing Functions ============

    /// @inheritdoc IOrderBook
    function placeOrder(
        bytes32 marketId,
        uint256 tokenId,
        Side side,
        uint256 price,
        uint256 quantity
    ) external override nonReentrant whenNotPaused returns (uint256 orderId) {
        // Validate price bounds
        if (price < MIN_PRICE || price > MAX_PRICE) {
            revert InvalidPrice(price);
        }
        
        // Validate quantity
        if (quantity == 0) {
            revert InvalidQuantity();
        }

        // Create order
        orderId = _nextOrderId++;
        _orders[orderId] = Order({
            id: orderId,
            maker: msg.sender,
            marketId: marketId,
            tokenId: tokenId,
            side: side,
            price: price,
            quantity: quantity,
            filled: 0,
            timestamp: block.timestamp,
            active: true
        });

        // Escrow assets
        if (side == Side.BUY) {
            // Escrow collateral for buy orders
            // Cost = (price / 10000) * quantity
            uint256 collateralRequired = (price * quantity) / BPS_DENOMINATOR;
            _collateralToken.safeTransferFrom(msg.sender, address(this), collateralRequired);
        } else {
            // Escrow tokens for sell orders
            _conditionalTokens.safeTransferFrom(msg.sender, address(this), tokenId, quantity, "");
        }

        // Add to user's orders
        _userOrderIds[msg.sender].push(orderId);

        // Insert into sorted order book
        if (side == Side.BUY) {
            _insertBidOrder(marketId, tokenId, orderId);
        } else {
            _insertAskOrder(marketId, tokenId, orderId);
        }

        emit OrderPlaced(orderId, msg.sender, marketId, tokenId, side, price, quantity);

        // Try to match the order
        _matchOrders(marketId, tokenId);
    }

    /// @inheritdoc IOrderBook
    function cancelOrder(uint256 orderId) external override nonReentrant {
        Order storage order = _orders[orderId];
        
        // Check order exists
        if (order.id == 0) {
            revert OrderNotFound(orderId);
        }
        
        // Check order is active
        if (!order.active) {
            revert OrderNotActive(orderId);
        }
        
        // Check caller is the maker
        if (order.maker != msg.sender) {
            revert UnauthorizedCancellation(msg.sender, order.maker);
        }

        // Mark order as inactive
        order.active = false;

        // Return escrowed assets for unfilled portion
        uint256 unfilled = order.quantity - order.filled;
        if (unfilled > 0) {
            if (order.side == Side.BUY) {
                // Return collateral
                uint256 collateralToReturn = (order.price * unfilled) / BPS_DENOMINATOR;
                _collateralToken.safeTransfer(msg.sender, collateralToReturn);
            } else {
                // Return tokens
                _conditionalTokens.safeTransferFrom(address(this), msg.sender, order.tokenId, unfilled, "");
            }
        }

        emit OrderCancelled(orderId);
    }

    // ============ Internal Functions ============

    /// @notice Insert a bid order maintaining price-time priority (highest price first)
    function _insertBidOrder(bytes32 marketId, uint256 tokenId, uint256 orderId) internal {
        uint256[] storage bidIds = _bidOrderIds[marketId][tokenId];
        Order storage newOrder = _orders[orderId];
        
        // Find insertion point (maintain descending price order)
        uint256 insertIdx = bidIds.length;
        for (uint256 i = 0; i < bidIds.length; i++) {
            Order storage existingOrder = _orders[bidIds[i]];
            // Insert before orders with lower price, or same price but later timestamp
            if (newOrder.price > existingOrder.price ||
                (newOrder.price == existingOrder.price && newOrder.timestamp < existingOrder.timestamp)) {
                insertIdx = i;
                break;
            }
        }
        
        // Insert at position
        bidIds.push(orderId);
        for (uint256 i = bidIds.length - 1; i > insertIdx; i--) {
            bidIds[i] = bidIds[i - 1];
        }
        bidIds[insertIdx] = orderId;
    }

    /// @notice Insert an ask order maintaining price-time priority (lowest price first)
    function _insertAskOrder(bytes32 marketId, uint256 tokenId, uint256 orderId) internal {
        uint256[] storage askIds = _askOrderIds[marketId][tokenId];
        Order storage newOrder = _orders[orderId];
        
        // Find insertion point (maintain ascending price order)
        uint256 insertIdx = askIds.length;
        for (uint256 i = 0; i < askIds.length; i++) {
            Order storage existingOrder = _orders[askIds[i]];
            // Insert before orders with higher price, or same price but later timestamp
            if (newOrder.price < existingOrder.price ||
                (newOrder.price == existingOrder.price && newOrder.timestamp < existingOrder.timestamp)) {
                insertIdx = i;
                break;
            }
        }
        
        // Insert at position
        askIds.push(orderId);
        for (uint256 i = askIds.length - 1; i > insertIdx; i--) {
            askIds[i] = askIds[i - 1];
        }
        askIds[insertIdx] = orderId;
    }

    /// @notice Match orders in the order book
    function _matchOrders(bytes32 marketId, uint256 tokenId) internal {
        uint256[] storage bidIds = _bidOrderIds[marketId][tokenId];
        uint256[] storage askIds = _askOrderIds[marketId][tokenId];
        
        uint256 bidIdx = 0;
        uint256 askIdx = 0;
        
        while (bidIdx < bidIds.length && askIdx < askIds.length) {
            Order storage bidOrder = _orders[bidIds[bidIdx]];
            Order storage askOrder = _orders[askIds[askIdx]];
            
            // Skip inactive or fully filled orders
            if (!bidOrder.active || bidOrder.quantity <= bidOrder.filled) {
                bidIdx++;
                continue;
            }
            if (!askOrder.active || askOrder.quantity <= askOrder.filled) {
                askIdx++;
                continue;
            }
            
            // Check if orders can match (bid price >= ask price)
            if (bidOrder.price < askOrder.price) {
                break; // No more matches possible
            }
            
            // Execute match
            _executeTrade(bidOrder, askOrder);
            
            // Move to next order if current is fully filled
            if (bidOrder.quantity <= bidOrder.filled) {
                bidIdx++;
            }
            if (askOrder.quantity <= askOrder.filled) {
                askIdx++;
            }
        }
    }

    /// @notice Execute a trade between a bid and ask order
    function _executeTrade(Order storage bidOrder, Order storage askOrder) internal {
        // Calculate fill amount (minimum of remaining quantities)
        uint256 bidRemaining = bidOrder.quantity - bidOrder.filled;
        uint256 askRemaining = askOrder.quantity - askOrder.filled;
        uint256 fillAmount = bidRemaining < askRemaining ? bidRemaining : askRemaining;
        
        // Trade executes at the maker's price (the order that was in the book first)
        // If bid was placed first, use bid price; if ask was placed first, use ask price
        uint256 tradePrice = bidOrder.timestamp < askOrder.timestamp ? bidOrder.price : askOrder.price;
        
        // Calculate collateral amounts
        uint256 tradeCost = (tradePrice * fillAmount) / BPS_DENOMINATOR;
        uint256 bidEscrowed = (bidOrder.price * fillAmount) / BPS_DENOMINATOR;
        
        // Update fill amounts
        bidOrder.filled += fillAmount;
        askOrder.filled += fillAmount;
        
        // Mark orders as inactive if fully filled
        if (bidOrder.filled >= bidOrder.quantity) {
            bidOrder.active = false;
        }
        if (askOrder.filled >= askOrder.quantity) {
            askOrder.active = false;
        }
        
        // Transfer tokens from escrow to buyer
        _conditionalTokens.safeTransferFrom(address(this), bidOrder.maker, askOrder.tokenId, fillAmount, "");
        
        // Transfer collateral from escrow to seller
        _collateralToken.safeTransfer(askOrder.maker, tradeCost);
        
        // Refund excess collateral to buyer if trade price < bid price
        if (bidEscrowed > tradeCost) {
            _collateralToken.safeTransfer(bidOrder.maker, bidEscrowed - tradeCost);
        }
        
        // Emit events
        emit OrderFilled(bidOrder.id, askOrder.maker, fillAmount, tradePrice);
        emit OrderFilled(askOrder.id, bidOrder.maker, fillAmount, tradePrice);
        emit Trade(bidOrder.marketId, askOrder.tokenId, bidOrder.maker, askOrder.maker, tradePrice, fillAmount);
    }

    // ============ Admin Functions ============

    /// @notice Pause order placement (owner only)
    /// @dev When paused, placeOrder will revert but cancelOrder still works for withdrawals
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause order placement (owner only)
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ ERC-1155 Receiver ============

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x4e2312e0;
    }
}
