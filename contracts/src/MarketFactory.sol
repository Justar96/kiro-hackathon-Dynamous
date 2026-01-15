// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IMarketFactory} from "./interfaces/IMarketFactory.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {Market} from "./Market.sol";
import {CTFHelpers} from "./libraries/CTFHelpers.sol";

/**
 * @title MarketFactory
 * @notice Factory contract for deploying and tracking prediction markets
 * @dev Uses CREATE2 for deterministic market addresses based on questionId
 *      Implements Ownable for admin functions and Pausable for emergency stops
 */
contract MarketFactory is IMarketFactory, ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Minimum initial liquidity required (10 USDC with 6 decimals)
    uint256 public constant MIN_INITIAL_LIQUIDITY = 10e6;

    // ============ Immutable State ============

    /// @notice The Conditional Tokens Framework contract
    IConditionalTokens private immutable _conditionalTokens;

    /// @notice The collateral token (USDC)
    IERC20 private immutable _collateralToken;

    /// @notice The oracle address for market resolution
    address public immutable override oracle;

    /// @notice The fee recipient address
    address public immutable override feeRecipient;

    // ============ Mutable State ============

    /// @notice Mapping from questionId to market address
    mapping(bytes32 => address) private _markets;

    /// @notice Array of all deployed market addresses
    address[] private _allMarkets;

    // ============ Constructor ============

    /**
     * @notice Create a new MarketFactory
     * @param _conditionalTokensAddr Address of the CTF contract
     * @param _collateralTokenAddr Address of the collateral token (USDC)
     * @param _oracle Address authorized to resolve markets
     * @param _feeRecipient Address to receive protocol fees
     */
    constructor(
        address _conditionalTokensAddr,
        address _collateralTokenAddr,
        address _oracle,
        address _feeRecipient
    ) Ownable(msg.sender) {
        _conditionalTokens = IConditionalTokens(_conditionalTokensAddr);
        _collateralToken = IERC20(_collateralTokenAddr);
        oracle = _oracle;
        feeRecipient = _feeRecipient;
    }

    // ============ View Functions ============

    /// @inheritdoc IMarketFactory
    function markets(bytes32 questionId) external view override returns (address) {
        return _markets[questionId];
    }

    /// @inheritdoc IMarketFactory
    function allMarkets() external view override returns (address[] memory) {
        return _allMarkets;
    }

    /// @inheritdoc IMarketFactory
    function marketCount() external view override returns (uint256) {
        return _allMarkets.length;
    }

    /// @inheritdoc IMarketFactory
    function minInitialLiquidity() external pure override returns (uint256) {
        return MIN_INITIAL_LIQUIDITY;
    }

    /// @inheritdoc IMarketFactory
    function conditionalTokens() external view override returns (address) {
        return address(_conditionalTokens);
    }

    /// @inheritdoc IMarketFactory
    function collateralToken() external view override returns (address) {
        return address(_collateralToken);
    }

    // ============ Market Creation ============

    /// @inheritdoc IMarketFactory
    function createMarket(
        string calldata question,
        string calldata resolutionCriteria,
        uint256 endTime,
        uint256 initialLiquidity
    ) external override nonReentrant whenNotPaused returns (address market) {
        // Validate inputs
        if (bytes(question).length == 0) revert EmptyQuestion();
        if (bytes(resolutionCriteria).length == 0) revert EmptyResolutionCriteria();
        if (endTime <= block.timestamp) revert InvalidEndDate(endTime, block.timestamp);
        if (initialLiquidity < MIN_INITIAL_LIQUIDITY) {
            revert InsufficientInitialLiquidity(initialLiquidity, MIN_INITIAL_LIQUIDITY);
        }

        // Generate unique question ID
        bytes32 questionId = CTFHelpers.generateQuestionId(msg.sender, question, endTime);

        // Check market doesn't already exist
        if (_markets[questionId] != address(0)) revert MarketAlreadyExists(questionId);

        // Deploy market using CREATE2 for deterministic address
        bytes32 salt = questionId;
        market = address(
            new Market{salt: salt}(
                address(_conditionalTokens),
                address(_collateralToken),
                oracle,
                feeRecipient,
                questionId,
                question,
                resolutionCriteria,
                endTime
            )
        );

        // Register market
        _markets[questionId] = market;
        _allMarkets.push(market);

        // Transfer initial liquidity from creator to this contract
        _collateralToken.safeTransferFrom(msg.sender, address(this), initialLiquidity);

        // Approve market to spend collateral
        _collateralToken.approve(market, initialLiquidity);

        // Mint initial tokens for creator via the market
        Market(market).mintTokens(initialLiquidity);

        // Transfer minted tokens to creator
        uint256 yesTokenId = Market(market).yesTokenId();
        uint256 noTokenId = Market(market).noTokenId();
        
        _conditionalTokens.safeTransferFrom(address(this), msg.sender, yesTokenId, initialLiquidity, "");
        _conditionalTokens.safeTransferFrom(address(this), msg.sender, noTokenId, initialLiquidity, "");

        emit MarketCreated(market, questionId, question, endTime, msg.sender);
    }

    // ============ Admin Functions ============

    /// @notice Pause market creation (owner only)
    /// @dev When paused, createMarket will revert
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause market creation (owner only)
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ ERC-1155 Receiver ============

    /// @notice Handle receipt of ERC-1155 tokens
    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    /// @notice Handle receipt of batch ERC-1155 tokens
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return this.onERC1155BatchReceived.selector;
    }

    /// @notice ERC-165 interface support
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC-165
            || interfaceId == 0x4e2312e0; // ERC-1155 Receiver
    }
}
