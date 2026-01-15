// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IMarket} from "./interfaces/IMarket.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";
import {CTFHelpers} from "./libraries/CTFHelpers.sol";

/**
 * @title Market
 * @notice Individual prediction market contract for binary outcomes
 * @dev Manages market lifecycle, token minting/redemption, and settlement
 *      Uses Gnosis CTF for outcome token management
 */
contract Market is IMarket, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Protocol fee in basis points (2% = 200 bps)
    uint256 public constant PROTOCOL_FEE_BPS = 200;

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Dispute period duration (24 hours)
    uint256 public constant DISPUTE_PERIOD = 24 hours;

    // ============ Immutable State ============

    /// @notice The Conditional Tokens Framework contract
    IConditionalTokens public immutable conditionalTokens;

    /// @notice The collateral token (USDC)
    IERC20 public immutable collateralToken;

    /// @notice The oracle address authorized to propose resolutions
    address public immutable oracle;

    /// @notice The fee recipient address
    address public immutable feeRecipient;

    /// @notice Unique identifier for this market's question
    bytes32 public immutable override questionId;

    /// @notice The condition ID in the CTF
    bytes32 public immutable conditionId;

    /// @notice The market end time (after which resolution can begin)
    uint256 public immutable override endTime;

    /// @notice YES token position ID in CTF
    uint256 public immutable override yesTokenId;

    /// @notice NO token position ID in CTF
    uint256 public immutable override noTokenId;

    // ============ Mutable State ============

    /// @notice The market question text
    string private _question;

    /// @notice The resolution criteria
    string private _resolutionCriteria;

    /// @notice Current market state
    State public override state;

    /// @notice Resolved outcome (only valid when state == RESOLVED)
    Outcome public override outcome;

    /// @notice Timestamp when resolution was proposed
    uint256 public override resolutionTime;

    /// @notice End of dispute period
    uint256 public override disputeEndTime;

    /// @notice Proposed outcome during dispute period
    Outcome private _proposedOutcome;

    /// @notice Tracks if user has redeemed winnings
    mapping(address => bool) public hasRedeemed;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    // ============ Errors ============

    error MarketNotActive();
    error MarketNotPendingResolution();
    error MarketNotDisputed();
    error MarketNotResolved();
    error MarketAlreadyResolved();
    error MarketEndTimeNotReached();
    error DisputePeriodNotEnded();
    error DisputePeriodEnded();
    error InvalidOutcome();
    error UnauthorizedOracle();
    error InsufficientTokenBalance(uint256 required, uint256 available);
    error TokenAmountMismatch(uint256 yesAmount, uint256 noAmount);
    error ZeroAmount();
    error AlreadyRedeemed();
    error NoWinningTokens();
    error InvalidEndTime();


    // ============ Constructor ============

    /**
     * @notice Create a new prediction market
     * @param _conditionalTokens Address of the CTF contract
     * @param _collateralToken Address of the collateral token (USDC)
     * @param _oracle Address authorized to propose resolutions
     * @param _feeRecipient Address to receive protocol fees
     * @param _questionId Unique identifier for this market
     * @param _questionText The market question
     * @param _resolutionCriteriaText Resolution criteria description
     * @param _endTime Market end time
     */
    constructor(
        address _conditionalTokens,
        address _collateralToken,
        address _oracle,
        address _feeRecipient,
        bytes32 _questionId,
        string memory _questionText,
        string memory _resolutionCriteriaText,
        uint256 _endTime
    ) {
        if (_endTime <= block.timestamp) revert InvalidEndTime();

        conditionalTokens = IConditionalTokens(_conditionalTokens);
        collateralToken = IERC20(_collateralToken);
        oracle = _oracle;
        feeRecipient = _feeRecipient;
        questionId = _questionId;
        _question = _questionText;
        _resolutionCriteria = _resolutionCriteriaText;
        endTime = _endTime;

        // Compute condition ID (this market is the oracle for the CTF condition)
        conditionId = CTFHelpers.getConditionId(address(this), _questionId, CTFHelpers.BINARY_OUTCOME_COUNT);

        // Compute position IDs
        yesTokenId = CTFHelpers.getYesPositionId(collateralToken, conditionId);
        noTokenId = CTFHelpers.getNoPositionId(collateralToken, conditionId);

        // Prepare the condition in CTF
        conditionalTokens.prepareCondition(address(this), _questionId, CTFHelpers.BINARY_OUTCOME_COUNT);

        // Set initial state
        state = State.ACTIVE;
        outcome = Outcome.UNRESOLVED;

        emit StateChanged(State.ACTIVE);
    }

    // ============ View Functions ============

    /// @inheritdoc IMarket
    function question() external view override returns (string memory) {
        return _question;
    }

    /// @inheritdoc IMarket
    function resolutionCriteria() external view override returns (string memory) {
        return _resolutionCriteria;
    }

    // ============ Token Minting/Redemption ============

    /// @inheritdoc IMarket
    function mintTokens(uint256 collateralAmount) external override nonReentrant {
        if (state != State.ACTIVE) revert MarketNotActive();
        if (collateralAmount == 0) revert ZeroAmount();

        // Transfer collateral from user to this contract
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Approve CTF to spend collateral
        collateralToken.approve(address(conditionalTokens), collateralAmount);

        // Split position: collateral -> YES + NO tokens
        uint256[] memory partition = CTFHelpers.getBinaryPartition();
        conditionalTokens.splitPosition(
            collateralToken,
            bytes32(0), // parentCollectionId (root)
            conditionId,
            partition,
            collateralAmount
        );

        // Transfer outcome tokens to user
        conditionalTokens.safeTransferFrom(address(this), msg.sender, yesTokenId, collateralAmount, "");
        conditionalTokens.safeTransferFrom(address(this), msg.sender, noTokenId, collateralAmount, "");

        emit TokensMinted(msg.sender, collateralAmount);
    }

    /// @inheritdoc IMarket
    function redeemTokens(uint256 amount) external override nonReentrant {
        if (state != State.ACTIVE) revert MarketNotActive();
        if (amount == 0) revert ZeroAmount();

        // Check user has sufficient balance of both tokens
        uint256 yesBalance = conditionalTokens.balanceOf(msg.sender, yesTokenId);
        uint256 noBalance = conditionalTokens.balanceOf(msg.sender, noTokenId);

        if (yesBalance < amount) revert InsufficientTokenBalance(amount, yesBalance);
        if (noBalance < amount) revert InsufficientTokenBalance(amount, noBalance);

        // Transfer tokens from user to this contract
        conditionalTokens.safeTransferFrom(msg.sender, address(this), yesTokenId, amount, "");
        conditionalTokens.safeTransferFrom(msg.sender, address(this), noTokenId, amount, "");

        // Merge positions: YES + NO tokens -> collateral
        uint256[] memory partition = CTFHelpers.getBinaryPartition();
        conditionalTokens.mergePositions(
            collateralToken,
            bytes32(0), // parentCollectionId (root)
            conditionId,
            partition,
            amount
        );

        // Transfer collateral back to user
        collateralToken.safeTransfer(msg.sender, amount);

        emit TokensRedeemed(msg.sender, amount, amount);
    }


    // ============ Resolution Functions ============

    /// @inheritdoc IMarket
    function proposeResolution(Outcome _outcome) external override nonReentrant {
        if (msg.sender != oracle) revert UnauthorizedOracle();
        if (block.timestamp < endTime) revert MarketEndTimeNotReached();
        if (state != State.ACTIVE && state != State.DISPUTED) revert MarketNotActive();
        if (_outcome == Outcome.UNRESOLVED) revert InvalidOutcome();

        // Update state
        _proposedOutcome = _outcome;
        resolutionTime = block.timestamp;
        disputeEndTime = block.timestamp + DISPUTE_PERIOD;
        state = State.PENDING_RESOLUTION;

        emit StateChanged(State.PENDING_RESOLUTION);
        emit ResolutionProposed(_outcome, msg.sender);
    }

    /// @inheritdoc IMarket
    function disputeResolution() external override nonReentrant {
        if (state != State.PENDING_RESOLUTION) revert MarketNotPendingResolution();
        if (block.timestamp >= disputeEndTime) revert DisputePeriodEnded();

        // Update state to disputed
        state = State.DISPUTED;

        emit StateChanged(State.DISPUTED);
        emit ResolutionDisputed(msg.sender);
    }

    /// @inheritdoc IMarket
    function finalizeResolution() external override nonReentrant {
        if (state != State.PENDING_RESOLUTION) revert MarketNotPendingResolution();
        if (block.timestamp < disputeEndTime) revert DisputePeriodNotEnded();

        // Finalize the outcome
        outcome = _proposedOutcome;
        state = State.RESOLVED;

        // Report payouts to CTF
        _reportPayoutsToCTF();

        emit StateChanged(State.RESOLVED);
        emit MarketResolved(outcome);
    }

    /// @notice Internal function to report payouts to CTF based on outcome
    function _reportPayoutsToCTF() internal {
        uint256[] memory payouts = new uint256[](2);

        if (outcome == Outcome.YES) {
            // YES wins: payout [1, 0]
            payouts[0] = 1;
            payouts[1] = 0;
        } else if (outcome == Outcome.NO) {
            // NO wins: payout [0, 1]
            payouts[0] = 0;
            payouts[1] = 1;
        } else if (outcome == Outcome.INVALID) {
            // Invalid: 50/50 payout [1, 1]
            payouts[0] = 1;
            payouts[1] = 1;
        }

        // Report to CTF (this contract is the oracle)
        conditionalTokens.reportPayouts(questionId, payouts);
    }

    // ============ Settlement Functions ============

    /// @inheritdoc IMarket
    function redeemWinnings() external override nonReentrant {
        if (state != State.RESOLVED) revert MarketNotResolved();
        if (hasRedeemed[msg.sender]) revert AlreadyRedeemed();

        uint256 yesBalance = conditionalTokens.balanceOf(msg.sender, yesTokenId);
        uint256 noBalance = conditionalTokens.balanceOf(msg.sender, noTokenId);

        if (yesBalance == 0 && noBalance == 0) revert NoWinningTokens();

        uint256 grossPayout = 0;
        Outcome winningTokenType;

        if (outcome == Outcome.YES) {
            // YES holders get full payout (1.00 per token)
            if (yesBalance > 0) {
                grossPayout = yesBalance;
                winningTokenType = Outcome.YES;
                // Transfer YES tokens from user to this contract for burning
                conditionalTokens.safeTransferFrom(msg.sender, address(this), yesTokenId, yesBalance, "");
            }
        } else if (outcome == Outcome.NO) {
            // NO holders get full payout (1.00 per token)
            if (noBalance > 0) {
                grossPayout = noBalance;
                winningTokenType = Outcome.NO;
                // Transfer NO tokens from user to this contract for burning
                conditionalTokens.safeTransferFrom(msg.sender, address(this), noTokenId, noBalance, "");
            }
        } else if (outcome == Outcome.INVALID) {
            // Both YES and NO holders get 50% each (0.50 per token)
            // Transfer all tokens from user to this contract
            if (yesBalance > 0) {
                conditionalTokens.safeTransferFrom(msg.sender, address(this), yesTokenId, yesBalance, "");
            }
            if (noBalance > 0) {
                conditionalTokens.safeTransferFrom(msg.sender, address(this), noTokenId, noBalance, "");
            }
            // Each token is worth 0.50, so total value = totalTokens * 0.5
            grossPayout = (yesBalance + noBalance) / 2;
            winningTokenType = Outcome.INVALID;
        }

        hasRedeemed[msg.sender] = true;

        if (grossPayout > 0) {
            // Redeem from CTF to get collateral to this contract
            _redeemAllFromCTF();
            
            // Calculate payout after fee
            uint256 netPayout = _calculatePayoutAfterFee(grossPayout);
            
            // Transfer net payout to user
            collateralToken.safeTransfer(msg.sender, netPayout);
            emit WinningsRedeemed(msg.sender, winningTokenType, netPayout);
        }
    }

    /// @notice Calculate payout after deducting protocol fee
    /// @param amount Gross amount before fee
    /// @return Net amount after fee deduction
    function _calculatePayoutAfterFee(uint256 amount) internal returns (uint256) {
        uint256 fee = (amount * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        totalFeesCollected += fee;
        return amount - fee;
    }

    /// @notice Redeem all positions held by this contract from CTF
    function _redeemAllFromCTF() internal {
        uint256 yesBalance = conditionalTokens.balanceOf(address(this), yesTokenId);
        uint256 noBalance = conditionalTokens.balanceOf(address(this), noTokenId);

        uint256[] memory indexSets = new uint256[](2);
        indexSets[0] = CTFHelpers.YES_INDEX_SET;
        indexSets[1] = CTFHelpers.NO_INDEX_SET;

        // Only redeem if we have tokens
        if (yesBalance > 0 || noBalance > 0) {
            conditionalTokens.redeemPositions(
                collateralToken,
                bytes32(0), // parentCollectionId (root)
                conditionId,
                indexSets
            );
        }
    }

    // ============ Admin Functions ============

    /// @notice Withdraw collected fees to fee recipient
    function withdrawFees() external {
        uint256 fees = totalFeesCollected;
        if (fees > 0) {
            totalFeesCollected = 0;
            collateralToken.safeTransfer(feeRecipient, fees);
        }
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
