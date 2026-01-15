# Implementation Recommendations

## Overview

This document provides specific recommendations to enhance your thesis-app trading system with hybrid off-chain/on-chain capabilities based on production patterns from Polymarket and other hybrid exchanges.

---

## 1. Add EIP-712 Signed Orders

### 1.1 Order Struct Enhancement

Add to `contracts/src/interfaces/IOrderBook.sol`:

```solidity
// EIP-712 typed order for off-chain signing
struct SignedOrder {
    uint256 salt;           // Unique entropy
    address maker;          // Fund source
    address signer;         // Signature authority (can differ for AA wallets)
    address taker;          // 0x0 for public orders
    bytes32 marketId;       // Market identifier
    uint256 tokenId;        // CTF token ID
    Side side;              // BUY or SELL
    uint256 makerAmount;    // Amount offered
    uint256 takerAmount;    // Amount requested
    uint256 expiration;     // Order expiry
    uint256 nonce;          // Replay protection
    uint256 feeRateBps;     // Fee rate
    SignatureType sigType;  // EOA, PROXY, or SAFE
    bytes signature;        // The signature
}

enum SignatureType {
    EOA,
    POLY_PROXY,
    POLY_GNOSIS_SAFE
}
```

### 1.2 EIP-712 Domain and Type Hashes

```solidity
bytes32 public constant ORDER_TYPEHASH = keccak256(
    "Order(uint256 salt,address maker,address signer,address taker,bytes32 marketId,uint256 tokenId,uint8 side,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 sigType)"
);

bytes32 public immutable DOMAIN_SEPARATOR;

constructor(...) {
    DOMAIN_SEPARATOR = keccak256(
        abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("CTFExchange"),
            keccak256("1"),
            block.chainid,
            address(this)
        )
    );
}
```

---

## 2. Add Operator-Based Settlement

### 2.1 New CTFExchange Contract

Create `contracts/src/CTFExchange.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IConditionalTokens} from "./interfaces/IConditionalTokens.sol";

contract CTFExchange is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ============ State ============
    
    address public operator;
    IConditionalTokens public immutable ctf;
    IERC20 public immutable collateral;
    bytes32 public immutable DOMAIN_SEPARATOR;
    
    mapping(bytes32 => OrderStatus) public orderStatus;
    mapping(address => uint256) public nonces;
    mapping(uint256 => TokenInfo) public registry;
    
    struct OrderStatus {
        bool isFilledOrCancelled;
        uint256 remaining;
    }
    
    struct TokenInfo {
        uint256 complement;
        bytes32 conditionId;
    }

    // ============ Operator Functions ============
    
    /// @notice Fill a single signed order (operator only)
    function fillOrder(
        SignedOrder memory order,
        uint256 fillAmount
    ) external nonReentrant onlyOperator {
        _fillOrder(order, fillAmount, msg.sender);
    }
    
    /// @notice Match taker order against multiple maker orders
    function matchOrders(
        SignedOrder memory takerOrder,
        SignedOrder[] memory makerOrders,
        uint256 takerFillAmount,
        uint256[] memory makerFillAmounts
    ) external nonReentrant onlyOperator {
        // Validate taker order
        (uint256 taking, bytes32 orderHash) = _performOrderChecks(takerOrder, takerFillAmount);
        (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(takerOrder);
        
        // Transfer taker's maker asset to exchange
        _transfer(takerOrder.maker, address(this), makerAssetId, takerFillAmount);
        
        // Fill each maker order
        for (uint256 i = 0; i < makerOrders.length; i++) {
            _fillMakerOrder(takerOrder, makerOrders[i], makerFillAmounts[i]);
        }
        
        // Calculate final taking with any surplus
        taking = _updateTakingWithSurplus(taking, takerAssetId);
        
        // Calculate and charge fee
        uint256 fee = _calculateFee(takerOrder, taking, takerFillAmount);
        
        // Transfer proceeds to taker
        _transfer(address(this), takerOrder.maker, takerAssetId, taking - fee);
        
        // Refund any leftover
        uint256 refund = _getBalance(makerAssetId);
        if (refund > 0) {
            _transfer(address(this), takerOrder.maker, makerAssetId, refund);
        }
    }

    // ============ Internal Matching Logic ============
    
    function _fillMakerOrder(
        SignedOrder memory takerOrder,
        SignedOrder memory makerOrder,
        uint256 fillAmount
    ) internal {
        MatchType matchType = _deriveMatchType(takerOrder, makerOrder);
        
        (uint256 taking, bytes32 orderHash) = _performOrderChecks(makerOrder, fillAmount);
        (uint256 makerAssetId, uint256 takerAssetId) = _deriveAssetIds(makerOrder);
        
        // Transfer maker's asset to exchange
        _transfer(makerOrder.maker, address(this), makerAssetId, fillAmount);
        
        // Execute mint/merge if needed
        _executeMatchCall(fillAmount, taking, makerAssetId, takerAssetId, matchType);
        
        // Calculate fee and transfer proceeds
        uint256 fee = _calculateFee(makerOrder, taking, fillAmount);
        _transfer(address(this), makerOrder.maker, takerAssetId, taking - fee);
    }
    
    function _deriveMatchType(
        SignedOrder memory taker,
        SignedOrder memory maker
    ) internal pure returns (MatchType) {
        if (taker.side == Side.BUY && maker.side == Side.BUY) return MatchType.MINT;
        if (taker.side == Side.SELL && maker.side == Side.SELL) return MatchType.MERGE;
        return MatchType.COMPLEMENTARY;
    }
    
    function _executeMatchCall(
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 makerAssetId,
        uint256 takerAssetId,
        MatchType matchType
    ) internal {
        if (matchType == MatchType.MINT) {
            // Both buying - mint new tokens from collateral
            bytes32 conditionId = registry[takerAssetId].conditionId;
            uint256[] memory partition = new uint256[](2);
            partition[0] = 1;
            partition[1] = 2;
            ctf.splitPosition(collateral, bytes32(0), conditionId, partition, takingAmount);
        } else if (matchType == MatchType.MERGE) {
            // Both selling - merge tokens into collateral
            bytes32 conditionId = registry[makerAssetId].conditionId;
            uint256[] memory partition = new uint256[](2);
            partition[0] = 1;
            partition[1] = 2;
            ctf.mergePositions(collateral, bytes32(0), conditionId, partition, makingAmount);
        }
        // COMPLEMENTARY: no CTF interaction needed, just swap assets
    }

    // ============ Signature Validation ============
    
    function _validateSignature(
        bytes32 orderHash,
        SignedOrder memory order
    ) internal view returns (bool) {
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, orderHash)
        );
        
        address recovered = digest.recover(order.signature);
        
        if (order.sigType == SignatureType.EOA) {
            return recovered == order.maker && recovered == order.signer;
        }
        // Add PROXY and SAFE validation as needed
        return false;
    }
}
```

---

## 3. Add Batch Settlement with Merkle Proofs

### 3.1 Settlement Epoch Contract

Create `contracts/src/SettlementVault.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract SettlementVault {
    struct Epoch {
        bytes32 merkleRoot;
        uint256 timestamp;
        bool finalized;
    }
    
    mapping(uint256 => Epoch) public epochs;
    mapping(address => mapping(uint256 => bool)) public claimed;
    uint256 public currentEpoch;
    
    /// @notice Commit a new settlement epoch (operator only)
    function commitEpoch(bytes32 merkleRoot) external onlyOperator {
        currentEpoch++;
        epochs[currentEpoch] = Epoch({
            merkleRoot: merkleRoot,
            timestamp: block.timestamp,
            finalized: true
        });
    }
    
    /// @notice Withdraw using Merkle proof
    function withdrawWithProof(
        uint256 epochId,
        uint256 amount,
        bytes32[] calldata proof
    ) external {
        require(!claimed[msg.sender][epochId], "Already claimed");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(
            MerkleProof.verify(proof, epochs[epochId].merkleRoot, leaf),
            "Invalid proof"
        );
        
        claimed[msg.sender][epochId] = true;
        // Transfer funds...
    }
}
```

---

## 4. Off-Chain Components (TypeScript)

### 4.1 Order Signing Service

Create `packages/backend/src/services/orderSigner.ts`:

```typescript
import { ethers } from 'ethers';

const ORDER_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    'Order(uint256 salt,address maker,address signer,address taker,bytes32 marketId,uint256 tokenId,uint8 side,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 sigType)'
  )
);

interface Order {
  salt: bigint;
  maker: string;
  signer: string;
  taker: string;
  marketId: string;
  tokenId: bigint;
  side: number;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  sigType: number;
}

export async function signOrder(
  order: Order,
  signer: ethers.Signer,
  domainSeparator: string
): Promise<string> {
  const orderHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'uint256', 'address', 'address', 'address', 'bytes32', 'uint256', 'uint8', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint8'],
      [ORDER_TYPEHASH, order.salt, order.maker, order.signer, order.taker, order.marketId, order.tokenId, order.side, order.makerAmount, order.takerAmount, order.expiration, order.nonce, order.feeRateBps, order.sigType]
    )
  );

  const digest = ethers.keccak256(
    ethers.solidityPacked(
      ['string', 'bytes32', 'bytes32'],
      ['\x19\x01', domainSeparator, orderHash]
    )
  );

  return signer.signMessage(ethers.getBytes(digest));
}
```

### 4.2 Matching Engine

Create `packages/backend/src/services/matchingEngine.ts`:

```typescript
interface OrderBookEntry {
  orderId: string;
  order: SignedOrder;
  remainingAmount: bigint;
}

class MatchingEngine {
  private bids: Map<string, OrderBookEntry[]> = new Map(); // marketId -> sorted bids
  private asks: Map<string, OrderBookEntry[]> = new Map(); // marketId -> sorted asks
  private pendingSettlements: Trade[] = [];

  addOrder(order: SignedOrder): Trade[] {
    const trades: Trade[] = [];
    const marketKey = `${order.marketId}-${order.tokenId}`;

    if (order.side === Side.BUY) {
      // Try to match against asks
      const matchedTrades = this.matchAgainstAsks(order, marketKey);
      trades.push(...matchedTrades);
      
      // Add remaining to bids if not fully filled
      if (order.remainingAmount > 0n) {
        this.insertBid(marketKey, order);
      }
    } else {
      // Try to match against bids
      const matchedTrades = this.matchAgainstBids(order, marketKey);
      trades.push(...matchedTrades);
      
      if (order.remainingAmount > 0n) {
        this.insertAsk(marketKey, order);
      }
    }

    this.pendingSettlements.push(...trades);
    return trades;
  }

  private matchAgainstAsks(buyOrder: SignedOrder, marketKey: string): Trade[] {
    const trades: Trade[] = [];
    const asks = this.asks.get(marketKey) || [];

    for (const ask of asks) {
      if (buyOrder.remainingAmount === 0n) break;
      
      // Check if prices cross
      const buyPrice = (buyOrder.makerAmount * 10000n) / buyOrder.takerAmount;
      const askPrice = (ask.order.takerAmount * 10000n) / ask.order.makerAmount;
      
      if (buyPrice < askPrice) break; // No more matches possible

      // Execute trade
      const fillAmount = buyOrder.remainingAmount < ask.remainingAmount
        ? buyOrder.remainingAmount
        : ask.remainingAmount;

      trades.push({
        takerOrder: buyOrder,
        makerOrder: ask.order,
        fillAmount,
        price: askPrice, // Trade at maker's price
        timestamp: Date.now(),
      });

      buyOrder.remainingAmount -= fillAmount;
      ask.remainingAmount -= fillAmount;
    }

    // Remove fully filled asks
    this.asks.set(marketKey, asks.filter(a => a.remainingAmount > 0n));
    return trades;
  }

  // Batch settlement every N seconds or M trades
  async settleBatch(): Promise<void> {
    if (this.pendingSettlements.length === 0) return;

    const batch = this.pendingSettlements.splice(0, 100); // Max 100 per batch
    
    // Group by match type and submit to chain
    await this.submitSettlement(batch);
  }
}
```

### 4.3 Blockchain Indexer

Create `packages/backend/src/services/indexer.ts`:

```typescript
import { ethers } from 'ethers';

class BlockchainIndexer {
  private provider: ethers.Provider;
  private vaultContract: ethers.Contract;
  private lastProcessedBlock: number = 0;
  private confirmations: number = 20; // Polygon finality

  async processDeposits(): Promise<void> {
    const currentBlock = await this.provider.getBlockNumber();
    const safeBlock = currentBlock - this.confirmations;

    if (safeBlock <= this.lastProcessedBlock) return;

    const events = await this.vaultContract.queryFilter(
      this.vaultContract.filters.Deposit(),
      this.lastProcessedBlock + 1,
      safeBlock
    );

    for (const event of events) {
      const { user, amount } = event.args;
      
      // Credit off-chain ledger
      await this.ledger.credit(user, amount);
      
      console.log(`Credited ${amount} to ${user}`);
    }

    this.lastProcessedBlock = safeBlock;
  }

  // Handle chain reorgs
  async handleReorg(reorgDepth: number): Promise<void> {
    // Roll back ledger state to before reorg
    this.lastProcessedBlock -= reorgDepth;
    await this.ledger.rollbackToBlock(this.lastProcessedBlock);
    
    // Re-process from safe point
    await this.processDeposits();
  }
}
```

---

## 5. Risk Engine

Create `packages/backend/src/services/riskEngine.ts`:

```typescript
interface RiskLimits {
  maxOrderSize: bigint;
  maxExposure: bigint;
  maxOrdersPerMinute: number;
  maxWithdrawalPerDay: bigint;
}

class RiskEngine {
  private userLimits: Map<string, RiskLimits> = new Map();
  private orderCounts: Map<string, number[]> = new Map(); // user -> timestamps

  validateOrder(order: SignedOrder): { valid: boolean; reason?: string } {
    const limits = this.getUserLimits(order.maker);

    // Check order size
    if (order.makerAmount > limits.maxOrderSize) {
      return { valid: false, reason: 'Order size exceeds limit' };
    }

    // Check exposure
    const currentExposure = this.calculateExposure(order.maker);
    if (currentExposure + order.makerAmount > limits.maxExposure) {
      return { valid: false, reason: 'Exposure limit exceeded' };
    }

    // Check rate limiting
    const recentOrders = this.getRecentOrderCount(order.maker);
    if (recentOrders >= limits.maxOrdersPerMinute) {
      return { valid: false, reason: 'Rate limit exceeded' };
    }

    // Self-trade prevention
    if (this.wouldSelfTrade(order)) {
      return { valid: false, reason: 'Self-trade detected' };
    }

    return { valid: true };
  }

  validateWithdrawal(user: string, amount: bigint): { valid: boolean; reason?: string } {
    const limits = this.getUserLimits(user);
    const dailyWithdrawn = this.getDailyWithdrawalAmount(user);

    if (dailyWithdrawn + amount > limits.maxWithdrawalPerDay) {
      return { valid: false, reason: 'Daily withdrawal limit exceeded' };
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousWithdrawal(user, amount)) {
      return { valid: false, reason: 'Withdrawal flagged for review' };
    }

    return { valid: true };
  }
}
```

---

## 6. Implementation Priority

### Phase 1: Core Hybrid Infrastructure (Week 1-2)
1. Add EIP-712 order signing to contracts
2. Implement operator role and fillOrder
3. Create basic off-chain matching engine
4. Set up blockchain indexer for deposits

### Phase 2: Settlement Layer (Week 3-4)
1. Implement matchOrders with mint/merge
2. Add batch settlement with Merkle proofs
3. Create withdrawal proof mechanism
4. Implement reconciliation service

### Phase 3: Production Hardening (Week 5-6)
1. Add risk engine
2. Implement rate limiting
3. Add monitoring and alerting
4. Security audit preparation

---

## 7. Testing Checklist

- [ ] EIP-712 signature validation
- [ ] Order matching correctness
- [ ] Mint/merge scenarios
- [ ] Batch settlement gas optimization
- [ ] Merkle proof verification
- [ ] Reorg handling
- [ ] Rate limiting
- [ ] Self-trade prevention
- [ ] Withdrawal limits
- [ ] Fee calculation accuracy

---

*Document Version: 1.0*
*Last Updated: January 2026*
