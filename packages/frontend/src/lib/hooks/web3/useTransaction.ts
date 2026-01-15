/**
 * useTransaction Hook
 *
 * Provides a reusable hook for tracking transaction states across the application.
 * Handles pending_signature, pending_confirmation, confirmed, and failed states.
 * Integrates with the contract error parser for user-friendly error messages.
 *
 * Requirements: 10.3
 */

import { useState, useCallback, useMemo } from 'react';
import { useWaitForTransactionReceipt, useChainId } from 'wagmi';
import type { TransactionReceipt } from 'viem';
import { parseContractError, type ContractError } from '../../errors';
import { POLYGON_CHAIN_ID, POLYGON_AMOY_CHAIN_ID } from '../../wagmi';

/**
 * Transaction state union type
 */
export type TransactionState =
  | { status: 'idle' }
  | { status: 'pending_signature' }
  | { status: 'pending_confirmation'; hash: `0x${string}` }
  | { status: 'confirmed'; hash: `0x${string}`; receipt: TransactionReceipt }
  | { status: 'failed'; error: ContractError };

/**
 * Transaction status type
 */
export type TransactionStatus = TransactionState['status'];

/**
 * Return type for useTransaction hook
 */
export interface UseTransactionReturn {
  /**
   * Current transaction state
   */
  state: TransactionState;

  /**
   * Execute a transaction with automatic state tracking
   *
   * @param writeFn - Function that initiates the transaction and returns the hash
   * @returns Transaction receipt on success
   */
  execute: (writeFn: () => Promise<`0x${string}`>) => Promise<TransactionReceipt>;

  /**
   * Reset the transaction state to idle
   */
  reset: () => void;

  /**
   * Whether a transaction is currently in progress
   */
  isLoading: boolean;

  /**
   * Whether the transaction is waiting for user signature
   */
  isPendingSignature: boolean;

  /**
   * Whether the transaction is waiting for confirmation
   */
  isPendingConfirmation: boolean;

  /**
   * Whether the transaction was confirmed
   */
  isConfirmed: boolean;

  /**
   * Whether the transaction failed
   */
  isFailed: boolean;

  /**
   * Transaction hash (if available)
   */
  hash: `0x${string}` | undefined;

  /**
   * Transaction receipt (if confirmed)
   */
  receipt: TransactionReceipt | undefined;

  /**
   * Error (if failed)
   */
  error: ContractError | undefined;

  /**
   * Get block explorer URL for the transaction
   */
  getExplorerUrl: () => string | undefined;
}

/**
 * Get block explorer URL for a transaction hash
 */
function getBlockExplorerUrl(chainId: number | undefined, hash: `0x${string}`): string {
  switch (chainId) {
    case POLYGON_CHAIN_ID:
      return `https://polygonscan.com/tx/${hash}`;
    case POLYGON_AMOY_CHAIN_ID:
      return `https://amoy.polygonscan.com/tx/${hash}`;
    default:
      return `https://polygonscan.com/tx/${hash}`;
  }
}

/**
 * Hook for tracking transaction states
 *
 * Provides a consistent way to track transaction progress across the application,
 * with automatic error parsing and block explorer link generation.
 *
 * @example
 * ```tsx
 * const { state, execute, reset, isLoading, getExplorerUrl } = useTransaction();
 *
 * const handleSubmit = async () => {
 *   try {
 *     const receipt = await execute(() =>
 *       writeContract({
 *         address: contractAddress,
 *         abi: contractAbi,
 *         functionName: 'someFunction',
 *         args: [arg1, arg2],
 *       })
 *     );
 *     console.log('Transaction confirmed:', receipt);
 *   } catch (error) {
 *     console.error('Transaction failed:', state.error);
 *   }
 * };
 * ```
 */
export function useTransaction(): UseTransactionReturn {
  const chainId = useChainId();
  const [state, setState] = useState<TransactionState>({ status: 'idle' });
  const [currentHash, setCurrentHash] = useState<`0x${string}` | undefined>();

  // Wait for transaction receipt
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: currentHash,
    query: {
      enabled: !!currentHash && state.status === 'pending_confirmation',
    },
  });

  // Update state when receipt is received
  useMemo(() => {
    if (receipt && state.status === 'pending_confirmation' && currentHash) {
      setState({
        status: 'confirmed',
        hash: currentHash,
        receipt,
      });
    }
  }, [receipt, state.status, currentHash]);

  /**
   * Execute a transaction with automatic state tracking
   */
  const execute = useCallback(
    async (writeFn: () => Promise<`0x${string}`>): Promise<TransactionReceipt> => {
      try {
        // Step 1: Waiting for signature
        setState({ status: 'pending_signature' });

        // Step 2: Get transaction hash
        const hash = await writeFn();
        setCurrentHash(hash);
        setState({ status: 'pending_confirmation', hash });

        // Step 3: Wait for receipt
        // The receipt will be picked up by useWaitForTransactionReceipt
        // We need to poll for it here to return from this function
        return new Promise((resolve, reject) => {
          const checkReceipt = () => {
            // Check if we have a receipt in state
            if (receipt && currentHash === hash) {
              resolve(receipt);
              return;
            }

            // Check current state
            const currentState = state;
            if (currentState.status === 'confirmed' && currentState.hash === hash) {
              resolve(currentState.receipt);
              return;
            }

            if (currentState.status === 'failed') {
              reject(currentState.error);
              return;
            }

            // Keep polling
            setTimeout(checkReceipt, 500);
          };

          // Start polling after a short delay to allow state to update
          setTimeout(checkReceipt, 1000);
        });
      } catch (error) {
        const parsed = parseContractError(error);
        setState({ status: 'failed', error: parsed });
        throw error;
      }
    },
    [receipt, state, currentHash]
  );

  /**
   * Reset transaction state
   */
  const reset = useCallback(() => {
    setState({ status: 'idle' });
    setCurrentHash(undefined);
  }, []);

  /**
   * Get block explorer URL for current transaction
   */
  const getExplorerUrl = useCallback(() => {
    if (!currentHash) return undefined;
    return getBlockExplorerUrl(chainId, currentHash);
  }, [chainId, currentHash]);

  // Derived state
  const isLoading = state.status === 'pending_signature' || state.status === 'pending_confirmation';
  const isPendingSignature = state.status === 'pending_signature';
  const isPendingConfirmation = state.status === 'pending_confirmation';
  const isConfirmed = state.status === 'confirmed';
  const isFailed = state.status === 'failed';

  const hash = state.status === 'pending_confirmation' || state.status === 'confirmed'
    ? state.hash
    : undefined;

  const txReceipt = state.status === 'confirmed' ? state.receipt : undefined;
  const error = state.status === 'failed' ? state.error : undefined;

  return useMemo(
    () => ({
      state,
      execute,
      reset,
      isLoading,
      isPendingSignature,
      isPendingConfirmation,
      isConfirmed,
      isFailed,
      hash,
      receipt: txReceipt,
      error,
      getExplorerUrl,
    }),
    [
      state,
      execute,
      reset,
      isLoading,
      isPendingSignature,
      isPendingConfirmation,
      isConfirmed,
      isFailed,
      hash,
      txReceipt,
      error,
      getExplorerUrl,
    ]
  );
}

/**
 * Helper to get a human-readable status message
 */
export function getTransactionStatusMessage(state: TransactionState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'pending_signature':
      return 'Please confirm the transaction in your wallet...';
    case 'pending_confirmation':
      return 'Transaction submitted. Waiting for confirmation...';
    case 'confirmed':
      return 'Transaction confirmed!';
    case 'failed':
      return state.error.message;
  }
}

/**
 * Helper to check if a transaction can be retried
 */
export function canRetryTransaction(state: TransactionState): boolean {
  if (state.status !== 'failed') return false;
  // User rejections can always be retried
  if (state.error.code === 'USER_REJECTED') return true;
  // Network errors can be retried
  if (state.error.code === 'NETWORK_ERROR') return true;
  // Check if the error is recoverable
  const nonRecoverableCodes = [
    'MARKET_ALREADY_RESOLVED',
    'ALREADY_REDEEMED',
    'MARKET_ALREADY_EXISTS',
    'UNAUTHORIZED_ORACLE',
    'UNAUTHORIZED_CANCELLATION',
  ];
  return !nonRecoverableCodes.includes(state.error.code);
}
