import type { UserBalance } from "../types";

interface ReconciliationResult {
  user: string;
  tokenId: bigint;
  offChain: UserBalance;
  onChain: bigint;
  discrepancy: bigint;
  status: "ok" | "mismatch" | "error";
}

export class ReconciliationService {
  private lastReconciliation: Map<string, ReconciliationResult[]> = new Map();
  private discrepancies: ReconciliationResult[] = [];

  /// @notice Compare off-chain ledger with on-chain balances
  async reconcile(
    offChainBalances: Map<string, Map<bigint, UserBalance>>,
    getOnChainBalance: (user: string, tokenId: bigint) => Promise<bigint>
  ): Promise<ReconciliationResult[]> {
    const results: ReconciliationResult[] = [];

    for (const [user, tokenBalances] of offChainBalances) {
      for (const [tokenId, offChain] of tokenBalances) {
        try {
          const onChain = await getOnChainBalance(user, tokenId);
          const totalOffChain = offChain.available + offChain.locked;
          const discrepancy = totalOffChain - onChain;

          const result: ReconciliationResult = {
            user,
            tokenId,
            offChain,
            onChain,
            discrepancy,
            status: discrepancy === 0n ? "ok" : "mismatch",
          };

          results.push(result);

          if (discrepancy !== 0n) {
            this.discrepancies.push(result);
          }
        } catch (error) {
          results.push({
            user,
            tokenId,
            offChain,
            onChain: 0n,
            discrepancy: 0n,
            status: "error",
          });
        }
      }
    }

    this.lastReconciliation.set(new Date().toISOString(), results);
    return results;
  }

  /// @notice Check if system is in sync
  isHealthy(): boolean {
    return this.discrepancies.length === 0;
  }

  /// @notice Get all discrepancies
  getDiscrepancies(): ReconciliationResult[] {
    return [...this.discrepancies];
  }

  /// @notice Clear discrepancies after resolution
  clearDiscrepancies(): void {
    this.discrepancies = [];
  }

  /// @notice Get summary stats
  getStats(): {
    totalChecks: number;
    discrepancies: number;
    lastRun: string | null;
  } {
    const keys = Array.from(this.lastReconciliation.keys());
    const lastRun = keys.length > 0 ? keys[keys.length - 1] : null;
    const lastResults = lastRun ? this.lastReconciliation.get(lastRun) : [];

    return {
      totalChecks: lastResults?.length || 0,
      discrepancies: this.discrepancies.length,
      lastRun,
    };
  }
}
