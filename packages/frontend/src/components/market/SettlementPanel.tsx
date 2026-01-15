/**
 * SettlementPanel Component
 *
 * Displays resolution status and allows users to claim winnings.
 * Uses useMarketActions hook for on-chain settlement.
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import { useState, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useMarketActions } from '../../lib/hooks/web3/useMarketActions';
import { useTokenBalances } from '../../lib/hooks/web3/useTokenBalances';
import { fromUsdcUnits } from '../../lib/utils/price';
import { parseContractError, getSuggestedAction } from '../../lib/errors';
import { SpinnerIcon, CheckCircleIcon, WarningIcon, ClockIcon } from '../icons';
import type { MarketOutcome, MarketState } from '../../lib/hooks/web3/useMarket';

interface SettlementPanelProps {
  /** Market contract address */
  marketAddress: `0x${string}`;
  /** Current market state */
  marketState: MarketState;
  /** Market outcome (if resolved) */
  outcome: MarketOutcome;
  /** YES token ID */
  yesTokenId: bigint;
  /** NO token ID */
  noTokenId: bigint;
  /** Resolution time (if resolved) */
  resolutionTime?: Date | null;
  /** Dispute end time (if in dispute period) */
  disputeEndTime?: Date | null;
}

const PROTOCOL_FEE_PERCENT = 2; // 2% fee

export function SettlementPanel({
  marketAddress,
  marketState,
  outcome,
  yesTokenId,
  noTokenId,
  resolutionTime,
  disputeEndTime,
}: SettlementPanelProps) {
  const { address, isConnected } = useAccount();
  const marketActions = useMarketActions(marketAddress);
  const { yesBalance, noBalance } = useTokenBalances({ yesTokenId, noTokenId });

  const [error, setError] = useState<string | null>(null);

  // Calculate payout based on outcome
  const payoutInfo = useMemo(() => {
    if (outcome === 'UNRESOLVED') {
      return null;
    }

    const yesBalanceNum = fromUsdcUnits(yesBalance);
    const noBalanceNum = fromUsdcUnits(noBalance);

    if (outcome === 'INVALID') {
      // 50/50 split for invalid markets
      const totalTokens = yesBalanceNum + noBalanceNum;
      const grossPayout = totalTokens * 0.5;
      const fee = grossPayout * (PROTOCOL_FEE_PERCENT / 100);
      const netPayout = grossPayout - fee;

      return {
        winningTokens: totalTokens,
        tokenType: 'ALL' as const,
        grossPayout,
        fee,
        netPayout,
        hasWinnings: totalTokens > 0,
      };
    }

    // YES or NO outcome
    const isYesWinner = outcome === 'YES';
    const winningBalance = isYesWinner ? yesBalanceNum : noBalanceNum;
    const grossPayout = winningBalance; // 1 USDC per winning token
    const fee = grossPayout * (PROTOCOL_FEE_PERCENT / 100);
    const netPayout = grossPayout - fee;

    return {
      winningTokens: winningBalance,
      tokenType: isYesWinner ? 'YES' : 'NO',
      grossPayout,
      fee,
      netPayout,
      hasWinnings: winningBalance > 0,
    };
  }, [outcome, yesBalance, noBalance]);

  // Handle claim winnings
  const handleClaimWinnings = async () => {
    setError(null);

    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!payoutInfo?.hasWinnings) {
      setError('No winnings to claim');
      return;
    }

    try {
      await marketActions.redeemWinnings();
    } catch (err) {
      const parsed = parseContractError(err);
      const suggestion = getSuggestedAction(parsed);
      setError(suggestion ? `${parsed.message}. ${suggestion}` : parsed.message);
    }
  };

  // Get transaction status message
  const getStatusMessage = () => {
    switch (marketActions.transactionState.status) {
      case 'pending_signature':
        return 'Please confirm the transaction in your wallet...';
      case 'pending_confirmation':
        return 'Claiming winnings. Waiting for confirmation...';
      case 'confirmed':
        return 'Winnings claimed successfully!';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();
  const isSubmitting = marketActions.isLoading;

  // Not resolved yet
  if (marketState !== 'RESOLVED') {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Settlement</h3>
        
        {marketState === 'ACTIVE' && (
          <div className="text-center py-6">
            <ClockIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Market is still active</p>
            <p className="text-sm text-gray-500 mt-1">
              Settlement will be available after the market is resolved
            </p>
          </div>
        )}

        {marketState === 'PENDING_RESOLUTION' && (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-gray-600">Awaiting resolution</p>
            <p className="text-sm text-gray-500 mt-1">
              The oracle is processing the market outcome
            </p>
            {disputeEndTime && (
              <p className="text-xs text-gray-400 mt-2">
                Dispute period ends: {disputeEndTime.toLocaleString()}
              </p>
            )}
          </div>
        )}

        {marketState === 'DISPUTED' && (
          <div className="text-center py-6">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <WarningIcon className="w-6 h-6 text-orange-600" />
            </div>
            <p className="text-gray-600">Resolution disputed</p>
            <p className="text-sm text-gray-500 mt-1">
              The market resolution is being arbitrated
            </p>
          </div>
        )}
      </div>
    );
  }

  // Resolved - show settlement UI
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Settlement</h3>

      {/* Resolution Info */}
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircleIcon className="w-5 h-5 text-green-500" />
          <span className="font-medium">Market Resolved</span>
        </div>
        <div className="text-sm text-gray-600">
          <span>Outcome: </span>
          <span className={`font-medium ${
            outcome === 'YES' ? 'text-green-600' :
            outcome === 'NO' ? 'text-red-600' :
            'text-gray-600'
          }`}>
            {outcome}
          </span>
        </div>
        {resolutionTime && (
          <div className="text-xs text-gray-500 mt-1">
            Resolved: {resolutionTime.toLocaleString()}
          </div>
        )}
      </div>

      {/* User's Position */}
      {isConnected && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Your Position</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-50 rounded p-2">
              <span className="text-gray-600">YES tokens:</span>
              <span className="ml-2 font-medium text-green-700">
                {fromUsdcUnits(yesBalance).toFixed(2)}
              </span>
            </div>
            <div className="bg-red-50 rounded p-2">
              <span className="text-gray-600">NO tokens:</span>
              <span className="ml-2 font-medium text-red-700">
                {fromUsdcUnits(noBalance).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Payout Breakdown */}
      {payoutInfo && payoutInfo.hasWinnings && (
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Payout Breakdown</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">
                Winning tokens ({payoutInfo.tokenType})
              </span>
              <span className="font-medium">{payoutInfo.winningTokens.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gross payout</span>
              <span className="font-medium">${payoutInfo.grossPayout.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Protocol fee ({PROTOCOL_FEE_PERCENT}%)</span>
              <span>-${payoutInfo.fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-blue-200">
              <span className="font-medium text-blue-800">Net payout</span>
              <span className="font-bold text-blue-800">${payoutInfo.netPayout.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* No Winnings Message */}
      {payoutInfo && !payoutInfo.hasWinnings && (
        <div className="text-center py-4 text-gray-500">
          <p>You have no winning tokens to claim</p>
        </div>
      )}

      {/* Transaction Status */}
      {statusMessage && (
        <div className={`p-3 rounded-lg flex items-center gap-2 mb-4 ${
          marketActions.transactionState.status === 'confirmed'
            ? 'bg-green-50 text-green-700'
            : 'bg-blue-50 text-blue-700'
        }`}>
          {marketActions.transactionState.status === 'confirmed' ? (
            <CheckCircleIcon className="w-5 h-5" />
          ) : (
            <SpinnerIcon className="w-5 h-5 animate-spin" />
          )}
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Transaction Hash Link */}
      {marketActions.transactionState.status === 'pending_confirmation' && (
        <div className="text-xs text-gray-500 mb-4">
          Transaction:{' '}
          <a
            href={`https://amoy.polygonscan.com/tx/${marketActions.transactionState.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-mono"
          >
            {marketActions.transactionState.hash.slice(0, 10)}...
          </a>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 mb-4">
          <WarningIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Claim Button */}
      {payoutInfo?.hasWinnings && (
        <button
          onClick={handleClaimWinnings}
          disabled={isSubmitting || !isConnected || marketActions.transactionState.status === 'confirmed'}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting && <SpinnerIcon className="w-4 h-4 animate-spin" />}
          {marketActions.transactionState.status === 'confirmed'
            ? 'Winnings Claimed!'
            : isSubmitting
            ? 'Claiming...'
            : `Claim $${payoutInfo.netPayout.toFixed(2)}`}
        </button>
      )}

      {/* Connect Wallet Message */}
      {!isConnected && (
        <p className="text-center text-sm text-amber-600 mt-2">
          Connect your wallet to claim winnings
        </p>
      )}
    </div>
  );
}
