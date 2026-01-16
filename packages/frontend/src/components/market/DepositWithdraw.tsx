/**
 * DepositWithdraw Component
 *
 * Handles deposit and withdrawal flows for hybrid CLOB trading.
 * Implements deposit flow with USDC approval and withdrawal flow with proof fetching.
 * Shows pending deposits and claimable amounts.
 *
 * Requirements: 1.1, 6.1, 6.3
 */

import { useState, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import {
  useBalances,
  type PendingDeposit,
  type WithdrawalProof,
} from '../../lib/hooks/trading/useBalances';
import {
  SpinnerIcon,
  CheckCircleIcon,
  WarningIcon,
  ClockIcon,
} from '../icons';

// ============================================
// Types
// ============================================

interface DepositWithdrawProps {
  /** Callback when deposit is successful */
  onDepositSuccess?: (txHash: string) => void;
  /** Callback when withdrawal is successful */
  onWithdrawSuccess?: (txHash: string) => void;
}

type ActiveTab = 'deposit' | 'withdraw';

// ============================================
// Constants
// ============================================

const USDC_DECIMALS = 6;
const REQUIRED_CONFIRMATIONS = 20;

// ============================================
// Helper Functions
// ============================================

/**
 * Parse USDC amount input to smallest units (6 decimals)
 */
function parseUsdcAmount(input: string): bigint | null {
  const num = parseFloat(input);
  if (isNaN(num) || num <= 0) return null;
  return BigInt(Math.round(num * 10 ** USDC_DECIMALS));
}

/**
 * Format USDC amount for display
 */
function formatUsdcAmount(amount: bigint | string): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount;
  const num = Number(value) / 10 ** USDC_DECIMALS;
  return `$${num.toFixed(2)}`;
}

/**
 * Format confirmation progress
 */
function formatConfirmations(current: number, required: number): string {
  return `${current}/${required} confirmations`;
}

/**
 * Truncate transaction hash for display
 */
function truncateTxHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

// ============================================
// Sub-Components
// ============================================

/**
 * Pending deposit item
 */
function PendingDepositItem({ deposit }: { deposit: PendingDeposit }) {
  const progress = Math.min(
    100,
    (deposit.confirmations / deposit.requiredConfirmations) * 100
  );
  const isComplete = deposit.indexed;

  return (
    <div className="p-3 bg-paper-aged rounded-subtle border border-divider">
      <div className="flex items-center justify-between mb-2">
        <span className="text-body-small font-medium">
          {formatUsdcAmount(deposit.amount)}
        </span>
        {isComplete ? (
          <span className="flex items-center gap-1 text-support text-caption">
            <CheckCircleIcon className="w-4 h-4" />
            Credited
          </span>
        ) : (
          <span className="flex items-center gap-1 text-accent text-caption">
            <ClockIcon className="w-4 h-4" />
            Pending
          </span>
        )}
      </div>
      
      {!isComplete && (
        <>
          <div className="w-full bg-divider rounded-full h-1.5 mb-1">
            <div
              className="bg-accent h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-caption text-text-tertiary">
            {formatConfirmations(deposit.confirmations, deposit.requiredConfirmations)}
          </div>
        </>
      )}
      
      <a
        href={`https://polygonscan.com/tx/${deposit.txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-caption text-accent hover:underline typewriter"
      >
        {truncateTxHash(deposit.txHash)}
      </a>
    </div>
  );
}

/**
 * Claimable epoch item
 */
function ClaimableEpochItem({
  proof,
  onClaim,
  isClaiming,
}: {
  proof: WithdrawalProof;
  onClaim: () => void;
  isClaiming: boolean;
}) {
  return (
    <div className="p-3 bg-paper-aged rounded-subtle border border-divider">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-body-small font-medium">
            {formatUsdcAmount(proof.amount)}
          </span>
          <span className="text-caption text-text-tertiary ml-2">
            Epoch #{proof.epochId}
          </span>
        </div>
        <button
          onClick={onClaim}
          disabled={isClaiming}
          className="px-3 py-1.5 bg-support text-white text-body-small font-medium rounded-subtle hover:bg-support/90 disabled:bg-text-tertiary disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isClaiming && <SpinnerIcon className="w-3 h-3 animate-spin" />}
          Claim
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function DepositWithdraw({
  onDepositSuccess,
  onWithdrawSuccess,
}: DepositWithdrawProps) {
  const { isConnected } = useAccount();
  const {
    balances,
    pendingDeposits,
    claimableEpochs,
    withdrawalProofs,
    deposit,
    withdraw,
    isDepositing,
    isWithdrawing,
    depositError,
    withdrawError,
    refetch,
  } = useBalances();

  // Form state
  const [activeTab, setActiveTab] = useState<ActiveTab>('deposit');
  const [depositAmount, setDepositAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Get USDC balance (token ID 0)
  const usdcBalance = useMemo(() => {
    const balance = balances.get('0');
    return balance ? BigInt(balance.available) : 0n;
  }, [balances]);

  // Calculate total claimable amount
  const totalClaimable = useMemo(() => {
    return withdrawalProofs.reduce(
      (sum, proof) => sum + BigInt(proof.amount),
      0n
    );
  }, [withdrawalProofs]);

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    const amount = parseUsdcAmount(depositAmount);
    if (!amount) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      const txHash = await deposit(amount);
      setSuccess(`Deposit submitted! Transaction: ${truncateTxHash(txHash)}`);
      setDepositAmount('');
      onDepositSuccess?.(txHash);
      
      // Refresh data after a short delay
      setTimeout(() => refetch(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    }
  }, [isConnected, depositAmount, deposit, onDepositSuccess, refetch]);

  // Handle withdrawal
  const handleWithdraw = useCallback(
    async (epochId: number) => {
      setError(null);
      setSuccess(null);

      if (!isConnected) {
        setError('Please connect your wallet');
        return;
      }

      try {
        const txHash = await withdraw(epochId);
        setSuccess(`Withdrawal submitted! Transaction: ${truncateTxHash(txHash)}`);
        onWithdrawSuccess?.(txHash);
        
        // Refresh data after a short delay
        setTimeout(() => refetch(), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Withdrawal failed');
      }
    },
    [isConnected, withdraw, onWithdrawSuccess, refetch]
  );

  return (
    <div className="dossier-card rounded-subtle p-5 pt-8 relative">
      <span className="folder-tab">Funds</span>

      {/* Tab Selector */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            setActiveTab('deposit');
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
            activeTab === 'deposit'
              ? 'bg-support text-white'
              : 'bg-paper-aged text-text-secondary hover:bg-divider'
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => {
            setActiveTab('withdraw');
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 py-2 rounded-subtle font-medium transition-colors ${
            activeTab === 'withdraw'
              ? 'bg-accent text-white'
              : 'bg-paper-aged text-text-secondary hover:bg-divider'
          }`}
        >
          Withdraw
          {claimableEpochs.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-caption">
              {claimableEpochs.length}
            </span>
          )}
        </button>
      </div>

      {/* Current Balance */}
      <div className="bg-paper-aged p-3 rounded-subtle border border-divider mb-4">
        <div className="text-caption text-text-tertiary mb-1">Available Balance</div>
        <div className="text-heading-3 font-bold text-text-primary typewriter">
          {formatUsdcAmount(usdcBalance)}
        </div>
      </div>

      {/* Deposit Tab */}
      {activeTab === 'deposit' && (
        <div className="space-y-4">
          {/* Amount Input */}
          <div>
            <label className="block text-body-small font-medium text-text-primary mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="100.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 bg-paper border border-divider rounded-subtle focus:outline-none focus:ring-2 focus:ring-accent text-text-primary typewriter"
              disabled={isDepositing}
            />
          </div>

          {/* Deposit Button */}
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !isConnected || !depositAmount}
            className="w-full py-3 bg-support text-white rounded-subtle font-medium hover:bg-support/90 disabled:bg-text-tertiary disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isDepositing && <SpinnerIcon className="w-4 h-4 animate-spin" />}
            {!isConnected
              ? 'Connect Wallet'
              : isDepositing
              ? 'Depositing...'
              : 'Deposit USDC'}
          </button>

          {/* Pending Deposits */}
          {pendingDeposits.length > 0 && (
            <div>
              <h4 className="text-body-small font-medium text-text-primary mb-2">
                Pending Deposits
              </h4>
              <div className="space-y-2">
                {pendingDeposits.map((deposit) => (
                  <PendingDepositItem key={deposit.txHash} deposit={deposit} />
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="text-caption text-text-tertiary">
            <p>
              Deposits require {REQUIRED_CONFIRMATIONS} block confirmations before
              being credited to your trading balance.
            </p>
          </div>
        </div>
      )}

      {/* Withdraw Tab */}
      {activeTab === 'withdraw' && (
        <div className="space-y-4">
          {/* Total Claimable */}
          {totalClaimable > 0n && (
            <div className="bg-support/10 p-3 rounded-subtle border border-support/30">
              <div className="text-caption text-support mb-1">Total Claimable</div>
              <div className="text-heading-3 font-bold text-support typewriter">
                {formatUsdcAmount(totalClaimable)}
              </div>
            </div>
          )}

          {/* Claimable Epochs */}
          {withdrawalProofs.length > 0 ? (
            <div>
              <h4 className="text-body-small font-medium text-text-primary mb-2">
                Available Withdrawals
              </h4>
              <div className="space-y-2">
                {withdrawalProofs.map((proof) => (
                  <ClaimableEpochItem
                    key={proof.epochId}
                    proof={proof}
                    onClaim={() => handleWithdraw(proof.epochId)}
                    isClaiming={isWithdrawing}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-text-tertiary">
              <ClockIcon className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-body-small">No withdrawals available</p>
              <p className="text-caption mt-1">
                Trade to accumulate settlement balances
              </p>
            </div>
          )}

          {/* Info */}
          <div className="text-caption text-text-tertiary">
            <p>
              Withdrawals are processed through settlement epochs. Each epoch
              contains a Merkle proof that allows you to claim your funds
              directly from the smart contract.
            </p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 p-3 bg-support/10 border border-support/30 rounded-subtle flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-support" />
          <span className="text-body-small text-support">{success}</span>
        </div>
      )}

      {/* Error Message */}
      {(error || depositError || withdrawError) && (
        <div className="mt-4 p-3 bg-oppose/10 border border-oppose/30 rounded-subtle flex items-start gap-2">
          <WarningIcon className="w-5 h-5 text-oppose flex-shrink-0 mt-0.5" />
          <span className="text-body-small text-oppose">
            {error || depositError?.message || withdrawError?.message}
          </span>
        </div>
      )}

      {/* Wallet Connection Warning */}
      {!isConnected && (
        <p className="mt-4 text-center text-caption text-text-tertiary italic">
          Connect your wallet to manage funds
        </p>
      )}
    </div>
  );
}
