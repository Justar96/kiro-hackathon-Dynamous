import { ethers } from "ethers";
import type { Trade } from "../types";
import { MerkleTree } from "./merkleTree";

interface SettlementBatch {
  epochId: number;
  trades: Trade[];
  balanceDeltas: Map<string, bigint>;
  merkleRoot: string;
  proofs: Map<string, { amount: bigint; proof: string[] }>;
  timestamp: number;
}

export class SettlementService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private vaultAddress: string;
  private exchangeAddress: string;

  private pendingTrades: Trade[] = [];
  private currentEpoch = 0;
  private settlementHistory: SettlementBatch[] = [];

  // Vault ABI (minimal)
  private static VAULT_ABI = [
    "function commitEpoch(bytes32 merkleRoot, uint256 totalAmount) external",
    "function currentEpoch() view returns (uint256)",
  ];

  // Exchange ABI (minimal)
  private static EXCHANGE_ABI = [
    "function matchOrders(tuple(uint256 salt, address maker, address signer, address taker, bytes32 marketId, uint256 tokenId, uint8 side, uint256 makerAmount, uint256 takerAmount, uint256 expiration, uint256 nonce, uint256 feeRateBps, uint8 sigType, bytes signature) takerOrder, tuple(uint256 salt, address maker, address signer, address taker, bytes32 marketId, uint256 tokenId, uint8 side, uint256 makerAmount, uint256 takerAmount, uint256 expiration, uint256 nonce, uint256 feeRateBps, uint8 sigType, bytes signature)[] makerOrders, uint256 takerFillAmount, uint256[] makerFillAmounts) external",
  ];

  constructor(
    rpcUrl: string,
    privateKey: string,
    vaultAddress: string,
    exchangeAddress: string
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.vaultAddress = vaultAddress;
    this.exchangeAddress = exchangeAddress;
  }

  addTrades(trades: Trade[]): void {
    this.pendingTrades.push(...trades);
  }

  getPendingCount(): number {
    return this.pendingTrades.length;
  }

  /// @notice Create settlement batch from pending trades
  async createBatch(): Promise<SettlementBatch | null> {
    if (this.pendingTrades.length === 0) return null;

    const trades = this.pendingTrades.splice(0, 100); // Max 100 per batch
    const balanceDeltas = this.computeBalanceDeltas(trades);

    // Build Merkle tree from positive balances (amounts owed to users)
    const entries = Array.from(balanceDeltas.entries())
      .filter(([_, amount]) => amount > 0n)
      .map(([address, amount]) => ({ address, amount }));

    if (entries.length === 0) {
      return null;
    }

    const tree = new MerkleTree(entries);
    const merkleRoot = tree.getRoot();

    // Generate proofs for each user
    const proofs = new Map<string, { amount: bigint; proof: string[] }>();
    for (const entry of entries) {
      const { proof } = tree.getProof(entry.address, entry.amount);
      proofs.set(entry.address, { amount: entry.amount, proof });
    }

    const batch: SettlementBatch = {
      epochId: ++this.currentEpoch,
      trades,
      balanceDeltas,
      merkleRoot,
      proofs,
      timestamp: Date.now(),
    };

    this.settlementHistory.push(batch);
    return batch;
  }

  /// @notice Commit batch to on-chain vault
  async commitBatch(batch: SettlementBatch): Promise<string> {
    const vault = new ethers.Contract(
      this.vaultAddress,
      SettlementService.VAULT_ABI,
      this.signer
    );

    const totalAmount = Array.from(batch.balanceDeltas.values())
      .filter((v) => v > 0n)
      .reduce((a, b) => a + b, 0n);

    const tx = await vault.commitEpoch(batch.merkleRoot, totalAmount);
    const receipt = await tx.wait();

    return receipt.hash;
  }

  /// @notice Compute net balance changes from trades
  private computeBalanceDeltas(trades: Trade[]): Map<string, bigint> {
    const deltas = new Map<string, bigint>();

    for (const trade of trades) {
      const cost = (trade.price * trade.amount) / 10n ** 18n;

      // Buyer pays collateral, receives tokens
      const buyerDelta = deltas.get(trade.maker) || 0n;
      deltas.set(trade.maker, buyerDelta - cost);

      // Seller receives collateral, pays tokens
      const sellerDelta = deltas.get(trade.taker) || 0n;
      deltas.set(trade.taker, sellerDelta + cost);
    }

    return deltas;
  }

  /// @notice Get proof for user to claim from epoch
  getProof(
    epochId: number,
    user: string
  ): { amount: bigint; proof: string[] } | null {
    const batch = this.settlementHistory.find((b) => b.epochId === epochId);
    if (!batch) return null;

    return batch.proofs.get(user.toLowerCase()) || null;
  }

  /// @notice Get all unclaimed epochs for user
  getUnclaimedEpochs(user: string): number[] {
    return this.settlementHistory
      .filter((b) => b.proofs.has(user.toLowerCase()))
      .map((b) => b.epochId);
  }
}
