import { ethers } from "ethers";

interface DepositEvent {
  user: string;
  amount: bigint;
  blockNumber: number;
  txHash: string;
}

interface WithdrawalEvent {
  user: string;
  amount: bigint;
  blockNumber: number;
  txHash: string;
}

export class BlockchainIndexer {
  private provider: ethers.Provider;
  private vaultAddress: string;
  private lastProcessedBlock: number = 0;
  private confirmations: number;

  // Callbacks
  private onDeposit?: (event: DepositEvent) => void;
  private onWithdrawal?: (event: WithdrawalEvent) => void;

  // Vault ABI (minimal)
  private static VAULT_ABI = [
    "event Deposit(address indexed user, uint256 amount)",
    "event Withdrawal(address indexed user, uint256 amount)",
  ];

  constructor(
    rpcUrl: string,
    vaultAddress: string,
    confirmations: number = 20
  ) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.vaultAddress = vaultAddress;
    this.confirmations = confirmations;
  }

  setDepositHandler(handler: (event: DepositEvent) => void): void {
    this.onDeposit = handler;
  }

  setWithdrawalHandler(handler: (event: WithdrawalEvent) => void): void {
    this.onWithdrawal = handler;
  }

  async start(fromBlock?: number): Promise<void> {
    if (fromBlock !== undefined) {
      this.lastProcessedBlock = fromBlock;
    } else {
      this.lastProcessedBlock = await this.provider.getBlockNumber();
    }

    // Poll every 2 seconds (Polygon block time)
    setInterval(() => this.poll(), 2000);
  }

  private async poll(): Promise<void> {
    try {
      const currentBlock = await this.provider.getBlockNumber();
      const safeBlock = currentBlock - this.confirmations;

      if (safeBlock <= this.lastProcessedBlock) return;

      await this.processBlocks(this.lastProcessedBlock + 1, safeBlock);
      this.lastProcessedBlock = safeBlock;
    } catch (error) {
      console.error("Indexer poll error:", error);
    }
  }

  private async processBlocks(fromBlock: number, toBlock: number): Promise<void> {
    const vault = new ethers.Contract(
      this.vaultAddress,
      BlockchainIndexer.VAULT_ABI,
      this.provider
    );

    // Process deposits
    const depositFilter = vault.filters.Deposit();
    const depositLogs = await vault.queryFilter(depositFilter, fromBlock, toBlock);

    for (const log of depositLogs) {
      const parsed = vault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && this.onDeposit) {
        this.onDeposit({
          user: parsed.args[0],
          amount: parsed.args[1],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        });
      }
    }

    // Process withdrawals
    const withdrawalFilter = vault.filters.Withdrawal();
    const withdrawalLogs = await vault.queryFilter(withdrawalFilter, fromBlock, toBlock);

    for (const log of withdrawalLogs) {
      const parsed = vault.interface.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
      if (parsed && this.onWithdrawal) {
        this.onWithdrawal({
          user: parsed.args[0],
          amount: parsed.args[1],
          blockNumber: log.blockNumber,
          txHash: log.transactionHash,
        });
      }
    }
  }

  getLastProcessedBlock(): number {
    return this.lastProcessedBlock;
  }
}
