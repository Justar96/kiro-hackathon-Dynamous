// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICTFExchange
 * @notice Interface for the hybrid off-chain/on-chain CTF Exchange
 * @dev Implements EIP-712 signed orders with operator-based settlement
 */
interface ICTFExchange {
    // ============ Enums ============

    /// @notice Order side
    enum Side {
        BUY,
        SELL
    }

    /// @notice Signature type for order authentication
    enum SignatureType {
        EOA,            // Standard ECDSA signature
        POLY_PROXY,     // Polymarket proxy wallet
        POLY_GNOSIS_SAFE // Gnosis Safe multisig
    }

    /// @notice Match type for order pairing
    enum MatchType {
        COMPLEMENTARY,  // BUY vs SELL - standard swap
        MINT,           // BUY vs BUY - mint new tokens
        MERGE           // SELL vs SELL - merge tokens
    }

    // ============ Structs ============

    /// @notice EIP-712 signed order structure
    struct SignedOrder {
        uint256 salt;           // Unique entropy for order
        address maker;          // Address providing funds
        address signer;         // Address that signed (can differ for AA wallets)
        address taker;          // Specific taker or 0x0 for public
        bytes32 marketId;       // Market identifier
        uint256 tokenId;        // CTF ERC-1155 token ID
        Side side;              // BUY or SELL
        uint256 makerAmount;    // Amount maker is offering
        uint256 takerAmount;    // Amount maker wants in return
        uint256 expiration;     // Order expiry timestamp
        uint256 nonce;          // Replay protection
        uint256 feeRateBps;     // Fee rate in basis points
        SignatureType sigType;  // Signature type
        bytes signature;        // The signature
    }

    /// @notice Order status tracking
    struct OrderStatus {
        bool isFilledOrCancelled;
        uint256 remaining;
    }

    /// @notice Token registry entry
    struct TokenInfo {
        uint256 complement;     // Complement token ID (YES <-> NO)
        bytes32 conditionId;    // CTF condition ID
    }

    // ============ Events ============

    /// @dev Emitted when an order is filled
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makerAssetId,
        uint256 takerAssetId,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled,
        uint256 fee
    );

    /// @dev Emitted when orders are matched
    event OrdersMatched(
        bytes32 indexed takerOrderHash,
        address indexed takerMaker,
        uint256 makerAssetId,
        uint256 takerAssetId,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled
    );

    /// @dev Emitted when an order is cancelled
    event OrderCancelled(bytes32 indexed orderHash);

    /// @dev Emitted when fee is charged
    event FeeCharged(address indexed receiver, uint256 tokenId, uint256 fee);

    /// @dev Emitted when a token is registered
    event TokenRegistered(
        uint256 indexed token,
        uint256 indexed complement,
        bytes32 indexed conditionId
    );

    /// @dev Emitted when fees are withdrawn
    event FeesWithdrawn(address indexed token, uint256 amount, address indexed to);

    /// @dev Emitted when all orders are cancelled via nonce increment
    event AllOrdersCancelled(address indexed maker, uint256 newNonce);

    // ============ Errors ============

    error InvalidSignature();
    error OrderExpired();
    error OrderFilledOrCancelled();
    error InvalidNonce();
    error FeeTooHigh();
    error InvalidTokenId();
    error InvalidComplement();
    error NotOperator();
    error NotOwner();
    error NotTaker();
    error NotCrossing();
    error MismatchedTokenIds();
    error MakingGtRemaining();
    error TooLittleTokensReceived();
    error Paused();

    // ============ View Functions ============

    /// @notice Get the order status
    function getOrderStatus(bytes32 orderHash) external view returns (OrderStatus memory);

    /// @notice Get the current nonce for a user
    function nonces(address user) external view returns (uint256);

    /// @notice Check if a nonce is valid
    function isValidNonce(address user, uint256 nonce) external view returns (bool);

    /// @notice Get token info from registry
    function registry(uint256 tokenId) external view returns (TokenInfo memory);

    /// @notice Get the complement token ID
    function getComplement(uint256 tokenId) external view returns (uint256);

    /// @notice Get the condition ID for a token
    function getConditionId(uint256 tokenId) external view returns (bytes32);

    /// @notice Validate a token ID is registered
    function validateTokenId(uint256 tokenId) external view;

    /// @notice Validate complement relationship
    function validateComplement(uint256 token, uint256 complement) external view;

    /// @notice Get the maximum fee rate
    function getMaxFeeRate() external pure returns (uint256);

    /// @notice Get the collateral token address
    function getCollateral() external view returns (address);

    /// @notice Get the CTF contract address
    function getCtf() external view returns (address);

    /// @notice Get the operator address
    function getOperator() external view returns (address);

    /// @notice Compute the hash of an order
    function hashOrder(SignedOrder memory order) external view returns (bytes32);

    /// @notice Validate an order signature
    function validateOrderSignature(bytes32 orderHash, SignedOrder memory order) external view;

    // ============ Operator Functions ============

    /// @notice Fill a single order (operator only)
    /// @param order The signed order to fill
    /// @param fillAmount Amount to fill in terms of maker amount
    function fillOrder(SignedOrder memory order, uint256 fillAmount) external;

    /// @notice Match a taker order against multiple maker orders (operator only)
    /// @param takerOrder The taker's signed order
    /// @param makerOrders Array of maker signed orders
    /// @param takerFillAmount Amount to fill on taker order
    /// @param makerFillAmounts Array of amounts to fill on maker orders
    function matchOrders(
        SignedOrder memory takerOrder,
        SignedOrder[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) external;

    // ============ User Functions ============

    /// @notice Cancel an order on-chain
    /// @param order The order to cancel
    function cancelOrder(SignedOrder memory order) external;

    /// @notice Cancel multiple orders on-chain
    /// @param orders Array of orders to cancel
    function cancelOrders(SignedOrder[] memory orders) external;

    /// @notice Increment nonce to invalidate all orders with current nonce
    function incrementNonce() external;

    /// @notice Cancel all orders by incrementing nonce (emits AllOrdersCancelled event)
    function cancelAllOrders() external;

    // ============ Admin Functions ============

    /// @notice Register a token pair for trading
    /// @param token The token ID
    /// @param complement The complement token ID
    /// @param conditionId The CTF condition ID
    function registerToken(uint256 token, uint256 complement, bytes32 conditionId) external;

    /// @notice Set the operator address
    /// @param newOperator The new operator address
    function setOperator(address newOperator) external;

    /// @notice Pause the exchange
    function pause() external;

    /// @notice Unpause the exchange
    function unpause() external;

    /// @notice Withdraw accumulated fees (owner only)
    /// @param token The token address to withdraw (0 for collateral, or CTF token ID)
    /// @param amount The amount to withdraw
    /// @param to The recipient address
    function withdrawFees(address token, uint256 amount, address to) external;
}
