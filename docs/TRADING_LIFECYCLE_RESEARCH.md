# Off-Chain + On-Chain Trading Lifecycle on Polygon

## Executive Summary

This document provides comprehensive research on hybrid trading architectures combining off-chain order matching with on-chain settlement, specifically for Polygon-based prediction markets. The architecture follows the proven model used by Polymarket and other production hybrid exchanges.

---

## 1. Hybrid Trading Architecture Overview

### 1.1 Model A: Off-Chain Matching + On-Chain Settlement (Recommended)

This is the most widely adopted architecture for production trading platforms:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │   Web    │  │  Mobile  │  │   API    │                          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
└───────┼─────────────┼─────────────┼─────────────────────────────────┘
        │             │             │
        ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OFF-CHAIN LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Order Service                              │   │
│  │  • EIP-712 Signature Validation                              │   │
│  │  • Nonce Management                                          │   │
│  │  • Balance Verification                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Matching Engine                             │   │
│  │  • Price-Time Priority CLOB                                  │   │
│  │  • Trade Generation                                          │   │
│  │  • Fee Calculation                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Trading Ledger                              │   │
│  │  • available_balance                                         │   │
│  │  • locked_balance (open orders)                              │   │
│  │  • Event-sourced, append-only                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    ON-CHAIN LAYER (Polygon)                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Vault Contract                              │   │
│  │  • User deposits (non-custodial)                             │   │
│  │  • Withdrawal proofs                                         │   │
│  │  • Settlement execution                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              CTF Exchange Contract                            │   │
│  │  • fillOrder() - Operator fills single order                 │   │
│  │  • matchOrders() - Match taker vs makers                     │   │
│  │  • Mint/Merge conditional tokens                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │           Conditional Tokens (ERC-1155)                       │   │
│  │  • splitPosition() - Collateral → YES + NO                   │   │
│  │  • mergePositions() - YES + NO → Collateral                  │   │
│  │  • redeemPositions() - Post-resolution payout                │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Benefits

| Aspect | Off-Chain | On-Chain |
|--------|-----------|----------|
| Speed | Sub-millisecond matching | ~2-5 second finality (Polygon) |
| Cost | Zero gas for order placement | Gas only for settlement |
| UX | CEX-like experience | Verifiable custody |
| Trust | Requires operator trust | Trustless settlement |

---

## 2. Complete Trading Lifecycle

### 2.1 Phase 1: Deposit (On-Chain)

```
User Wallet ──[USDC]──► Vault Contract ──[Event]──► Indexer ──► Off-Chain Ledger
```

**Steps:**
1. User sends USDC to Vault smart contract
2. Blockchain indexer monitors deposit events
3. After finality (~12 blocks on Ethereum, fewer on Polygon), off-chain ledger credits balance
4. User can now place orders

**Critical Considerations:**
- Deposit finality policy prevents double-spend attacks
- Chain reorganization handling required
- Polygon PoS: ~128 blocks for strong finality, but 12-20 blocks typically sufficient

### 2.2 Phase 2: Order Placement (Off-Chain)

**EIP-712 Signed Order Structure:**
```typescript
interface Order {
  salt: uint256;           // Unique entropy
  maker: address;          // Fund source
  signer: address;         // Signature authority
  taker: address;          // 0x0 for public orders
  tokenId: uint256;        // CTF ERC-1155 token ID
  makerAmount: uint256;    // Amount offered
  takerAmount: uint256;    // Amount requested
  expiration: uint256;     // Order expiry timestamp
  nonce: uint256;          // Replay protection
  feeRateBps: uint256;     // Fee rate in basis points
  side: Side;              // BUY or SELL
  signatureType: SignatureType;
  signature: bytes;
}
```

**Validation Steps:**
1. Verify EIP-712 signature authenticity
2. Check nonce correctness (prevents replay)
3. Verify balance availability in off-chain ledger
4. Risk engine checks (order size, exposure limits)
5. Lock corresponding balance

### 2.3 Phase 3: Order Matching (Off-Chain)

**Matching Engine Logic:**
```
For each incoming order:
  1. Check if crosses existing orders (bid >= ask)
  2. Match using price-time priority
  3. Generate trade events (fills)
  4. Update off-chain ledger immediately
  5. Queue settlement batch
```

**Price Crossing Rules:**
- BUY vs BUY: Prices sum to ≥ $1.00 → Mint new tokens
- SELL vs SELL: Prices sum to ≤ $1.00 → Merge tokens
- BUY vs SELL: Standard counterparty trade

### 2.4 Phase 4: Settlement (On-Chain)

**Method 1: Per-Trade Settlement**
- Each trade triggers on-chain transaction
- Simple but expensive and not scalable

**Method 2: Batch Settlement (Recommended)**
```
1. Accumulate trades over time window (e.g., 1-5 minutes)
2. Compute net balance changes per user
3. Build Merkle tree of balance deltas
4. Commit Merkle root on-chain as settlement epoch
5. Users can verify/withdraw using Merkle proofs
```

**Settlement Contract Functions:**
```solidity
// Single order fill (operator only)
function fillOrder(Order memory order, uint256 fillAmount) external;

// Match multiple orders (handles mint/merge)
function matchOrders(
    Order memory takerOrder,
    Order[] memory makerOrders,
    uint256 takerFillAmount,
    uint256[] memory makerFillAmounts
) external;
```

### 2.5 Phase 5: Withdrawal (Hybrid)

**Path A: Instant Withdrawal (Hot Liquidity)**
- Limited amounts with velocity rules
- Risk scoring based on behavior
- Time delays for large withdrawals
- Protected by multi-sig/MPC

**Path B: Trust-Minimized Withdrawal (Vault Proof)**
- User requests withdrawal
- System generates cryptographic proof (Merkle inclusion)
- Vault contract releases funds only if proof valid
- Works even if off-chain infrastructure compromised

---

## 3. Conditional Token Framework (CTF) Deep Dive

### 3.1 Token ID Calculation

```solidity
// Step 1: Compute conditionId
conditionId = keccak256(abi.encodePacked(oracle, questionId, outcomeSlotCount));

// Step 2: Compute collectionId for each outcome
// YES: indexSet = 1 (0b01)
// NO:  indexSet = 2 (0b10)
collectionId = keccak256(abi.encodePacked(conditionId, indexSet));

// Step 3: Compute positionId (ERC-1155 token ID)
positionId = uint256(keccak256(abi.encodePacked(collateralToken, collectionId)));
```

### 3.2 Core Operations

**Split Position (Mint Outcome Tokens):**
```
USDC ──► splitPosition() ──► YES tokens + NO tokens
```

**Merge Positions (Burn Outcome Tokens):**
```
YES tokens + NO tokens ──► mergePositions() ──► USDC
```

**Redeem Positions (Post-Resolution):**
```
Winning tokens ──► redeemPositions() ──► USDC (proportional to payout)
```

### 3.3 Fee Mechanism

Fees are calculated based on implied probability:
```
fee = baseRate × min(price, 1-price) × outcomeTokens
```

This means:
- Fees minimized when probability ≈ 50%
- Fees increase as probability approaches 0% or 100%
- Incentivizes balanced markets

---

## 4. Polygon-Specific Considerations

### 4.1 Network Characteristics

| Metric | Value |
|--------|-------|
| Block Time | ~2 seconds |
| Transaction Finality | ~5 seconds |
| Gas Fees | < $0.001 typical |
| TPS Capacity | ~7,000 |

### 4.2 Recommended Finality Settings

```typescript
const POLYGON_CONFIG = {
  depositConfirmations: 20,      // ~40 seconds
  settlementConfirmations: 12,   // ~24 seconds
  withdrawalConfirmations: 32,   // ~64 seconds (higher security)
};
```

### 4.3 RPC and Infrastructure

- Use dedicated RPC nodes (Chainstack, Alchemy, QuickNode)
- Implement fallback RPC providers
- Monitor for chain reorganizations
- Consider Polygon zkEVM for L1 security guarantees

---

## 5. Security Architecture

### 5.1 Must-Have Controls

1. **HSM/MPC Key Management**
   - Hot wallet keys in HSM or MPC/TSS
   - Never store private keys in plain memory

2. **Dedicated Signing Service**
   - Isolated from API/trading pods
   - Rate limiting on signing operations

3. **Contract & Token Allowlisting**
   - Strict allowlist for supported tokens
   - Prevent non-standard ERC-20 exploits

4. **Chain Reorg Handling**
   - Follow finality rules, not just confirmations
   - Graceful handling of reorganizations

5. **MEV-Aware Settlement**
   - Randomized batch timing
   - Consider private relays (Flashbots Protect)

6. **Continuous Reconciliation**
   - Off-chain ledger ↔ on-chain vault
   - Automatic alerts on mismatch
   - Withdrawal halt on discrepancy

### 5.2 Signature Types

```solidity
enum SignatureType {
    EOA,           // Standard ECDSA
    POLY_PROXY,    // Proxy wallet (AA)
    POLY_GNOSIS_SAFE  // Gnosis Safe multisig
}
```

---

## 6. Recommendations for Your Implementation

### 6.1 Current Architecture Analysis

Your existing contracts implement:
- ✅ ConditionalTokens (CTF) with split/merge/redeem
- ✅ OrderBook with price-time priority matching
- ✅ Market lifecycle management
- ✅ ERC-1155 token handling

### 6.2 Gaps to Address

1. **Off-Chain Order Signing (EIP-712)**
   - Currently orders are placed directly on-chain
   - Add signed order support for hybrid model

2. **Operator-Based Settlement**
   - Add operator role for batch settlement
   - Implement fillOrder/matchOrders pattern

3. **Batch Settlement**
   - Implement Merkle-based batch settlement
   - Reduce gas costs significantly

4. **Withdrawal Proofs**
   - Add proof-based withdrawal mechanism
   - Enable trust-minimized withdrawals

### 6.3 Suggested Enhancements

See `IMPLEMENTATION_RECOMMENDATIONS.md` for detailed code changes.

---

## 7. References

1. [Polymarket CLOB Documentation](https://docs.polymarket.com/developers/CLOB/introduction)
2. [Gnosis Conditional Token Framework](https://docs.gnosis.io/conditionaltokens/)
3. [EIP-712: Typed Structured Data Hashing](https://eips.ethereum.org/EIPS/eip-712)
4. [Polygon Network Documentation](https://polygon.technology/developers)
5. [Hybrid Exchange Architecture Guide](https://www.nadcab.com/blog/hybrid-crypto-exchange-architecture-guide)

---

*Document Version: 1.0*
*Last Updated: January 2026*
