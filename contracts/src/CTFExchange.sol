// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ICTFExchange} from "./interfaces/ICTFExchange.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

/**
 * @title CTFExchange
 * @notice Hybrid off-chain/on-chain exchange for Conditional Token Framework
 * @dev Implements EIP-712 signed orders with operator-based settlement
 *      Based on Polymarket's CTFExchange architecture
 */
contract CTFExchange is ICTFExchange, EIP712, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============ Constants ============

    /// @notice Maximum fee rate (10% = 1000 bps)
    uint256 private constant MAX_FEE_RATE_BPS = 1000;

    /// @notice Precision for price calculations
    uint256 private constant ONE = 1e18;

    /// @notice Basis points divisor
    uint256 private constant BPS_DIVISOR = 10000;

    /// @notice EIP-712 order typehash
    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(uint256 salt,address maker,address signer,address taker,bytes32 marketId,uint256 tokenId,uint8 side,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 sigType)"
    );

    /// @notice Parent collection ID (always 0 for root)
    bytes32 public constant PARENT_COLLECTION_ID = bytes32(0);

    // ============ Immutable State ============

    /// @notice The collateral token (USDC)
    IERC20 private immutable _collateral;

    /// @notice The Conditional Tokens Framework contract
    IConditionalTokens private immutable _ctf;

    // ============ Mutable State ============

    /// @notice The operator address (can fill/match orders)
    address private _operator;

    /// @notice Whether the exchange is paused
    bool private _paused;

    /// @notice Order status tracking
    mapping(bytes32 => OrderStatus) private _orderStatus;

    /// @notice User nonces for replay protection
    mapping(address => uint256) private _nonces;

    /// @notice Token registry (tokenId => TokenInfo)
    mapping(uint256 => TokenInfo) private _registry;

    // ============ Constructor ============

    constructor(
        address collateralAddr,
        address ctfAddr,
        address operatorAddr
    ) EIP712("CTFExchange", "1") Ownable(msg.sender) {
        _collateral = IERC20(collateralAddr);
        _ctf = IConditionalTokens(ctfAddr);
        _operator = operatorAddr;
    }

    // ============ Modifiers ============

    modifier onlyOperator() {
        if (msg.sender != _operator) revert NotOperator();
        _;
    }

    modifier notPaused() {
        if (_paused) revert Paused();
        _;
    }

    // ============ View Functions ============

    /// @inheritdoc ICTFExchange
    function getOrderStatus(bytes32 orderHash) external view override returns (OrderStatus memory) {
        return _orderStatus[orderHash];
    }

    /// @inheritdoc ICTFExchange
    function nonces(address user) external view override returns (uint256) {
        return _nonces[user];
    }

    /// @inheritdoc ICTFExchange
    function isValidNonce(address user, uint256 nonce) public view override returns (bool) {
        return _nonces[user] == nonce;
    }

    /// @inheritdoc ICTFExchange
    function registry(uint256 tokenId) external view override returns (TokenInfo memory) {
        return _registry[tokenId];
    }

    /// @inheritdoc ICTFExchange
    function getComplement(uint256 tokenId) public view override returns (uint256) {
        validateTokenId(tokenId);
        return _registry[tokenId].complement;
    }

    /// @inheritdoc ICTFExchange
    function getConditionId(uint256 tokenId) public view override returns (bytes32) {
        return _registry[tokenId].conditionId;
    }

    /// @inheritdoc ICTFExchange
    function validateTokenId(uint256 tokenId) public view override {
        if (_registry[tokenId].complement == 0) revert InvalidTokenId();
    }

    /// @inheritdoc ICTFExchange
    function validateComplement(uint256 token, uint256 complement) public view override {
        if (getComplement(token) != complement) revert InvalidComplement();
    }

    /// @inheritdoc ICTFExchange
    function getMaxFeeRate() public pure override returns (uint256) {
        return MAX_FEE_RATE_BPS;
    }

    /// @inheritdoc ICTFExchange
    function getCollateral() public view override returns (address) {
        return address(_collateral);
    }

    /// @inheritdoc ICTFExchange
    function getCtf() public view override returns (address) {
        return address(_ctf);
    }

    /// @inheritdoc ICTFExchange
    function getOperator() public view override returns (address) {
        return _operator;
    }

    /// @inheritdoc ICTFExchange
    function hashOrder(SignedOrder memory order) public view override returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.salt,
                    order.maker,
                    order.signer,
                    order.taker,
                    order.marketId,
                    order.tokenId,
                    order.side,
                    order.makerAmount,
                    order.takerAmount,
                    order.expiration,
                    order.nonce,
                    order.feeRateBps,
                    order.sigType
                )
            )
        );
    }

    /// @inheritdoc ICTFExchange
    function validateOrderSignature(bytes32 orderHash, SignedOrder memory order) public view override {
        if (!_isValidSignature(order.signer, order.maker, orderHash, order.signature, order.sigType)) {
            revert InvalidSignature();
        }
    }

    // ============ Operator Functions ============

    /// @inheritdoc ICTFExchange
    function fillOrder(SignedOrder memory order, uint256 fillAmount) 
        external override nonReentrant onlyOperator notPaused 
    {
        _fillOrder(order, fillAmount, msg.sender);
    }

    /// @inheritdoc ICTFExchange
    function matchOrders(
        SignedOrder memory takerOrder,
        SignedOrder[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) external override nonReentrant onlyOperator notPaused {
        _matchOrders(takerOrder, makerOrders, takerFillAmount, makerFillAmounts);
    }

    // ============ User Functions ============

    /// @inheritdoc ICTFExchange
    function cancelOrder(SignedOrder memory order) external override {
        _cancelOrder(order);
    }

    /// @inheritdoc ICTFExchange
    function cancelOrders(SignedOrder[] memory orders) external override {
        for (uint256 i = 0; i < orders.length; i++) {
            _cancelOrder(orders[i]);
        }
    }

    /// @inheritdoc ICTFExchange
    function incrementNonce() external override {
        _nonces[msg.sender]++;
    }

    // ============ Admin Functions ============

    /// @inheritdoc ICTFExchange
    function registerToken(uint256 token, uint256 complement, bytes32 conditionId) 
        external override onlyOwner 
    {
        _registry[token] = TokenInfo({complement: complement, conditionId: conditionId});
        _registry[complement] = TokenInfo({complement: token, conditionId: conditionId});
        
        emit TokenRegistered(token, complement, conditionId);
        emit TokenRegistered(complement, token, conditionId);
    }

    /// @inheritdoc ICTFExchange
    function setOperator(address newOperator) external override onlyOwner {
        _operator = newOperator;
    }

    /// @inheritdoc ICTFExchange
    function pause() external override onlyOwner {
        _paused = true;
    }

    /// @inheritdoc ICTFExchange
    function unpause() external override onlyOwner {
        _paused = false;
    }

    // ============ Internal Functions ============

    function _fillOrder(SignedOrder memory order, uint256 fillAmount, address to) internal {
        uint256 making = fillAmount;
        (uint256 taking, bytes32 orderHash) = _performOrderChecks(order, making);

        uint256 fee = _calculateFee(
            order.feeRateBps,
            order.side == Side.BUY ? taking : making,
            order.makerAmount,
            order.takerAmount,
            order.side
        );

        (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(order);

        // Transfer proceeds minus fees from operator to order maker
        _transfer(msg.sender, order.maker, takerAssetId, taking - fee);

        // Transfer making amount from order maker to `to`
        _transfer(order.maker, to, makerAssetId, making);

        emit OrderFilled(orderHash, order.maker, msg.sender, makerAssetId, takerAssetId, making, taking, fee);
    }

    function _matchOrders(
        SignedOrder memory takerOrder,
        SignedOrder[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) internal {
        uint256 making = takerFillAmount;
        (uint256 taking, bytes32 orderHash) = _performOrderChecks(takerOrder, making);
        (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(takerOrder);

        // Transfer taker's maker asset to exchange
        _transfer(takerOrder.maker, address(this), makerAssetId, making);

        // Fill maker orders
        for (uint256 i = 0; i < makerOrders.length; i++) {
            _fillMakerOrder(takerOrder, makerOrders[i], makerFillAmounts[i]);
        }

        // Update taking with any surplus
        taking = _updateTakingWithSurplus(taking, takerAssetId);

        uint256 fee = _calculateFee(
            takerOrder.feeRateBps,
            takerOrder.side == Side.BUY ? taking : making,
            making,
            taking,
            takerOrder.side
        );

        // Transfer proceeds to taker
        _transfer(address(this), takerOrder.maker, takerAssetId, taking - fee);

        // Charge fee to operator
        if (fee > 0) {
            _transfer(address(this), msg.sender, takerAssetId, fee);
            emit FeeCharged(msg.sender, takerAssetId, fee);
        }

        // Refund leftover
        uint256 refund = _getBalance(makerAssetId);
        if (refund > 0) {
            _transfer(address(this), takerOrder.maker, makerAssetId, refund);
        }

        emit OrderFilled(orderHash, takerOrder.maker, address(this), makerAssetId, takerAssetId, making, taking, fee);
        emit OrdersMatched(orderHash, takerOrder.maker, makerAssetId, takerAssetId, making, taking);
    }

    function _fillMakerOrder(
        SignedOrder memory takerOrder,
        SignedOrder memory makerOrder,
        uint256 fillAmount
    ) internal {
        MatchType matchType = _deriveMatchType(takerOrder, makerOrder);
        _validateTakerAndMaker(takerOrder, makerOrder, matchType);

        uint256 making = fillAmount;
        (uint256 taking, bytes32 orderHash) = _performOrderChecks(makerOrder, making);

        uint256 fee = _calculateFee(
            makerOrder.feeRateBps,
            makerOrder.side == Side.BUY ? taking : making,
            makerOrder.makerAmount,
            makerOrder.takerAmount,
            makerOrder.side
        );

        (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(makerOrder);

        // Transfer maker's asset to exchange
        _transfer(makerOrder.maker, address(this), makerAssetId, making);

        // Execute mint/merge if needed
        _executeMatchCall(making, taking, makerAssetId, takerAssetId, matchType);

        // Verify we have enough tokens
        if (_getBalance(takerAssetId) < taking) revert TooLittleTokensReceived();

        // Transfer proceeds to maker
        _transfer(address(this), makerOrder.maker, takerAssetId, taking - fee);

        // Charge fee
        if (fee > 0) {
            _transfer(address(this), msg.sender, takerAssetId, fee);
            emit FeeCharged(msg.sender, takerAssetId, fee);
        }

        emit OrderFilled(orderHash, makerOrder.maker, takerOrder.maker, makerAssetId, takerAssetId, making, taking, fee);
    }

    function _cancelOrder(SignedOrder memory order) internal {
        if (order.maker != msg.sender) revert NotOwner();

        bytes32 orderHash = hashOrder(order);
        OrderStatus storage status = _orderStatus[orderHash];
        
        if (status.isFilledOrCancelled) revert OrderFilledOrCancelled();
        status.isFilledOrCancelled = true;

        emit OrderCancelled(orderHash);
    }

    function _performOrderChecks(SignedOrder memory order, uint256 making)
        internal returns (uint256 taking, bytes32 orderHash)
    {
        _validateTaker(order.taker);
        orderHash = hashOrder(order);
        _validateOrder(orderHash, order);
        taking = _calculateTakingAmount(making, order.makerAmount, order.takerAmount);
        _updateOrderStatus(orderHash, order, making);
    }

    function _validateTaker(address taker) internal view {
        if (taker != address(0) && taker != msg.sender) revert NotTaker();
    }

    function _validateOrder(bytes32 orderHash, SignedOrder memory order) internal view {
        if (order.expiration > 0 && order.expiration < block.timestamp) revert OrderExpired();
        validateOrderSignature(orderHash, order);
        if (order.feeRateBps > getMaxFeeRate()) revert FeeTooHigh();
        validateTokenId(order.tokenId);
        if (_orderStatus[orderHash].isFilledOrCancelled) revert OrderFilledOrCancelled();
        if (!isValidNonce(order.maker, order.nonce)) revert InvalidNonce();
    }

    function _updateOrderStatus(bytes32 orderHash, SignedOrder memory order, uint256 makingAmount) internal {
        OrderStatus storage status = _orderStatus[orderHash];
        uint256 remaining = status.remaining == 0 ? order.makerAmount : status.remaining;
        
        if (makingAmount > remaining) revert MakingGtRemaining();
        remaining -= makingAmount;
        
        if (remaining == 0) status.isFilledOrCancelled = true;
        status.remaining = remaining;
    }

    function _deriveAssetIds(SignedOrder memory order) internal pure returns (uint256 makerAssetId, uint256 takerAssetId) {
        if (order.side == Side.BUY) return (0, order.tokenId);
        return (order.tokenId, 0);
    }

    function _deriveMatchType(SignedOrder memory takerOrder, SignedOrder memory makerOrder) 
        internal pure returns (MatchType) 
    {
        if (takerOrder.side == Side.BUY && makerOrder.side == Side.BUY) return MatchType.MINT;
        if (takerOrder.side == Side.SELL && makerOrder.side == Side.SELL) return MatchType.MERGE;
        return MatchType.COMPLEMENTARY;
    }

    function _validateTakerAndMaker(
        SignedOrder memory takerOrder,
        SignedOrder memory makerOrder,
        MatchType matchType
    ) internal view {
        if (!_isCrossing(takerOrder, makerOrder)) revert NotCrossing();

        if (matchType == MatchType.COMPLEMENTARY) {
            if (takerOrder.tokenId != makerOrder.tokenId) revert MismatchedTokenIds();
        } else {
            validateComplement(takerOrder.tokenId, makerOrder.tokenId);
        }
    }

    function _isCrossing(SignedOrder memory a, SignedOrder memory b) internal pure returns (bool) {
        if (a.takerAmount == 0 || b.takerAmount == 0) return true;

        uint256 priceA = _calculatePrice(a.makerAmount, a.takerAmount, a.side);
        uint256 priceB = _calculatePrice(b.makerAmount, b.takerAmount, b.side);

        if (a.side == Side.BUY) {
            if (b.side == Side.BUY) return priceA + priceB >= ONE;
            return priceA >= priceB;
        }
        if (b.side == Side.BUY) return priceB >= priceA;
        return priceA + priceB <= ONE;
    }

    function _calculatePrice(uint256 makerAmount, uint256 takerAmount, Side side) internal pure returns (uint256) {
        if (side == Side.BUY) return takerAmount != 0 ? makerAmount * ONE / takerAmount : 0;
        return makerAmount != 0 ? takerAmount * ONE / makerAmount : 0;
    }

    function _calculateTakingAmount(uint256 makingAmount, uint256 makerAmount, uint256 takerAmount) 
        internal pure returns (uint256) 
    {
        if (makerAmount == 0) return 0;
        return makingAmount * takerAmount / makerAmount;
    }

    function _calculateFee(
        uint256 feeRateBps,
        uint256 outcomeTokens,
        uint256 makerAmount,
        uint256 takerAmount,
        Side side
    ) internal pure returns (uint256 fee) {
        if (feeRateBps > 0) {
            uint256 price = _calculatePrice(makerAmount, takerAmount, side);
            if (price > 0 && price <= ONE) {
                uint256 minPrice = price < ONE - price ? price : ONE - price;
                if (side == Side.BUY) {
                    fee = (feeRateBps * minPrice * outcomeTokens) / (price * BPS_DIVISOR);
                } else {
                    fee = feeRateBps * minPrice * outcomeTokens / (BPS_DIVISOR * ONE);
                }
            }
        }
    }

    function _executeMatchCall(
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 makerAssetId,
        uint256 takerAssetId,
        MatchType matchType
    ) internal {
        if (matchType == MatchType.COMPLEMENTARY) return;

        uint256[] memory partition = new uint256[](2);
        partition[0] = 1;
        partition[1] = 2;

        if (matchType == MatchType.MINT) {
            bytes32 conditionId = getConditionId(takerAssetId);
            _collateral.approve(address(_ctf), takingAmount);
            _ctf.splitPosition(_collateral, PARENT_COLLECTION_ID, conditionId, partition, takingAmount);
        } else {
            bytes32 conditionId = getConditionId(makerAssetId);
            _ctf.mergePositions(_collateral, PARENT_COLLECTION_ID, conditionId, partition, makingAmount);
        }
    }

    function _updateTakingWithSurplus(uint256 minimumAmount, uint256 tokenId) internal returns (uint256) {
        uint256 actualAmount = _getBalance(tokenId);
        if (actualAmount < minimumAmount) revert TooLittleTokensReceived();
        return actualAmount;
    }

    function _transfer(address from, address to, uint256 id, uint256 value) internal {
        if (id == 0) {
            _transferCollateral(from, to, value);
        } else {
            _transferCTF(from, to, id, value);
        }
    }

    function _transferCollateral(address from, address to, uint256 value) internal {
        if (from == address(this)) {
            _collateral.safeTransfer(to, value);
        } else {
            _collateral.safeTransferFrom(from, to, value);
        }
    }

    function _transferCTF(address from, address to, uint256 id, uint256 value) internal {
        _ctf.safeTransferFrom(from, to, id, value, "");
    }

    function _getBalance(uint256 tokenId) internal view returns (uint256) {
        if (tokenId == 0) return _collateral.balanceOf(address(this));
        return _ctf.balanceOf(address(this), tokenId);
    }

    function _isValidSignature(
        address signer,
        address maker,
        bytes32 structHash,
        bytes memory signature,
        SignatureType sigType
    ) internal pure returns (bool) {
        if (sigType == SignatureType.EOA) {
            return signer == maker && ECDSA.recover(structHash, signature) == signer;
        }
        // TODO: Add POLY_PROXY and POLY_GNOSIS_SAFE validation
        return false;
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
