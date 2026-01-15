// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ISettlementVault} from "./interfaces/ISettlementVault.sol";

/**
 * @title SettlementVault
 * @author Thesis App
 * @notice Merkle-based batch settlement vault for gas-efficient withdrawals
 * @dev Users deposit collateral, operator commits settlement epochs with Merkle roots,
 *      users withdraw by providing Merkle proofs of their balances
 */
contract SettlementVault is ISettlementVault, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ State ============

    /// @notice The collateral token (e.g., USDC)
    IERC20 public immutable collateral;
    
    /// @inheritdoc ISettlementVault
    address public operator;
    
    /// @inheritdoc ISettlementVault
    uint256 public currentEpoch;
    
    /// @notice Epoch data by ID
    mapping(uint256 => Epoch) private _epochs;
    
    /// @notice Claim status: user => epochId => claimed
    mapping(address => mapping(uint256 => bool)) private _claimed;
    
    /// @inheritdoc ISettlementVault
    mapping(address => uint256) public deposits;

    // ============ Constructor ============

    /**
     * @notice Initialize the settlement vault
     * @param collateral_ The collateral token address
     * @param operator_ The initial operator address
     */
    constructor(address collateral_, address operator_) Ownable(msg.sender) {
        collateral = IERC20(collateral_);
        operator = operator_;
    }

    // ============ Modifiers ============

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // ============ User Functions ============

    /// @inheritdoc ISettlementVault
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        
        emit Deposit(msg.sender, amount);
    }

    /// @inheritdoc ISettlementVault
    function claim(
        uint256 epochId,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (_claimed[msg.sender][epochId]) revert AlreadyClaimed();
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, _epochs[epochId].merkleRoot, leaf)) {
            revert InvalidProof();
        }
        
        _claimed[msg.sender][epochId] = true;
        collateral.safeTransfer(msg.sender, amount);
        
        emit Claimed(msg.sender, epochId, amount);
    }

    // ============ Operator Functions ============

    /// @inheritdoc ISettlementVault
    function commitEpoch(bytes32 merkleRoot, uint256 totalAmount) external onlyOperator {
        currentEpoch++;
        _epochs[currentEpoch] = Epoch({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            totalAmount: totalAmount
        });
        
        emit EpochCommitted(currentEpoch, merkleRoot, totalAmount);
    }

    /// @inheritdoc ISettlementVault
    function deductDeposit(address user, uint256 amount) external onlyOperator {
        if (deposits[user] < amount) revert InsufficientDeposit();
        deposits[user] -= amount;
    }

    /// @inheritdoc ISettlementVault
    function creditDeposit(address user, uint256 amount) external onlyOperator {
        deposits[user] += amount;
    }

    // ============ Admin Functions ============

    /// @inheritdoc ISettlementVault
    function setOperator(address operator_) external onlyOwner {
        operator = operator_;
    }

    // ============ View Functions ============

    /// @inheritdoc ISettlementVault
    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        return _epochs[epochId];
    }

    /// @inheritdoc ISettlementVault
    function hasClaimed(address user, uint256 epochId) external view returns (bool) {
        return _claimed[user][epochId];
    }

    /// @notice Legacy getter for epochs mapping
    function epochs(uint256 epochId) external view returns (bytes32, uint256, uint256) {
        Epoch memory e = _epochs[epochId];
        return (e.merkleRoot, e.timestamp, e.totalAmount);
    }

    /// @notice Legacy getter for claimed mapping
    function claimed(address user, uint256 epochId) external view returns (bool) {
        return _claimed[user][epochId];
    }
}
