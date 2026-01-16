/**
 * useBalances Hook
 *
 * Hook for balance management including fetching, deposits, and withdrawals.
 * Integrates with the backend API and SettlementVault contract.
 *
 * Requirements: 1.1, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3
 */

import { useState, useCallback, useMemo } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address, type Hex, erc20Abi } from 'viem';
import { fetchApi, ApiError, queryKeys } from '../../api';

// ============================================
// Types
// ============================================

/**
 * Token balance
 */
export interface TokenBalance {
  /** Available balance (not locked in orders) */
  available: string;
  /** Locked balance (in open orders) */
  locked: string;
  /** Total balance (available + locked) */
  total: string;
}

/**
 * User balances response from API
 */
interface BalancesResponse {
  address: string;
  balances: Record<string, TokenBalance>;
  nonce: string;
}

/**
 * Pending deposit status
 */
export interface PendingDeposit {
  txHash: string;
  amount: string;
  blockNumber: number;
  confirmations: number;
  requiredConfirmations: number;
  indexed: boolean;
}

/**
 * Deposits response from API
 */
interface DepositsResponse {
  address: string;
  pending: PendingDeposit[];
}

/**
 * Withdrawal proof
 */
export interface WithdrawalProof {
  epochId: number;
  amount: string;
  proof: string[];
}

/**
 * Withdrawals response from API
 */
interface WithdrawalsResponse {
  address: string;
  unclaimedEpochs: number[];
  proofs: WithdrawalProof[];
}

/**
 * Hook return type
 */
export interface UseBalancesReturn {
  /** User's token balances by token ID */
  balances: Map<string, TokenBalance>;
  /** User's current nonce */
  nonce: bigint;
  /** Pending deposits awaiting confirmation */
  pendingDeposits: PendingDeposit[];
  /** Epochs with unclaimed withdrawals */
  claimableEpochs: number[];
  /** Withdrawal proofs for unclaimed epochs */
  withdrawalProofs: WithdrawalProof[];
  /** Whether balances are loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Deposit USDC to the vault */
  deposit: (amount: bigint) => Promise<Hex>;
  /** Withdraw from an epoch using proof */
  withdraw: (epochId: number) => Promise<Hex>;
  /** Whether a deposit is in progress */
  isDepositing: boolean;
  /** Whether a withdrawal is in progress */
  isWithdrawing: boolean;
  /** Deposit error */
  depositError: Error | null;
  /** Withdrawal error */
  withdrawError: Error | null;
  /** Refetch balances */
  refetch: () => void;
  /** On-chain USDC balance */
  onChainUsdcBalance: bigint | undefined;
  /** On-chain vault deposit balance */
  onChainVaultBalance: bigint | undefined;
  /** Whether configuration is valid for blockchain operations */
  isConfigured: boolean;
  /** Missing configuration items */
  missingConfig: string[];
}

// ============================================
// Constants
// ============================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

/**
 * Get vault address from environment
 */
function getVaultAddress(): Address {
  const envAddress = import.meta.env.VITE_VAULT_ADDRESS;
  if (envAddress && envAddress !== ZERO_ADDRESS) {
    return envAddress as Address;
  }
  return ZERO_ADDRESS;
}

/**
 * Get USDC address from environment
 */
function getUsdcAddress(): Address {
  const envAddress = import.meta.env.VITE_USDC_ADDRESS;
  if (envAddress && envAddress !== ZERO_ADDRESS) {
    return envAddress as Address;
  }
  // Default to Polygon mainnet USDC
  return '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as Address;
}

/**
 * Check if an address is configured (not zero address)
 */
function isAddressConfigured(address: Address): boolean {
  return address !== ZERO_ADDRESS;
}

// ============================================
// Settlement Vault ABI (minimal for deposit/claim)
// ============================================

const settlementVaultAbi = [
  {
    type: 'function',
    name: 'deposit',
    inputs: [{ name: 'amount', type: 'uint256', internalType: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim',
    inputs: [
      { name: 'epochId', type: 'uint256', internalType: 'uint256' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
      { name: 'proof', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deposits',
    inputs: [{ name: 'user', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook for balance management
 *
 * @returns Balance state and management functions
 */
export function useBalances(): UseBalancesReturn {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();

  // Local state for errors
  const [depositError, setDepositError] = useState<Error | null>(null);
  const [withdrawError, setWithdrawError] = useState<Error | null>(null);

  // Contract addresses
  const vaultAddress = getVaultAddress();
  const usdcAddress = getUsdcAddress();

  // Check configuration
  const isVaultConfigured = isAddressConfigured(vaultAddress);
  const isUsdcConfigured = isAddressConfigured(usdcAddress);
  const isConfigured = isVaultConfigured && isUsdcConfigured;
  
  const missingConfig = useMemo(() => {
    const missing: string[] = [];
    if (!isVaultConfigured) missing.push('settlementVault');
    if (!isUsdcConfigured) missing.push('usdc');
    return missing;
  }, [isVaultConfigured, isUsdcConfigured]);

  // Contract write hooks
  const { writeContractAsync: writeApprove, isPending: isApproving } = useWriteContract();
  const { writeContractAsync: writeDeposit, isPending: isDepositPending, data: depositTxHash } = useWriteContract();
  const { writeContractAsync: writeClaim, isPending: isClaimPending, data: claimTxHash } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isDepositConfirming } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });
  const { isLoading: isClaimConfirming } = useWaitForTransactionReceipt({
    hash: claimTxHash,
  });

  // Read on-chain USDC balance
  const { data: onChainUsdcBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && isUsdcConfigured,
      staleTime: 10_000,
    },
  });

  // Read on-chain vault deposit balance
  const { data: onChainVaultBalance } = useReadContract({
    address: vaultAddress,
    abi: settlementVaultAbi,
    functionName: 'deposits',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && isConnected && isVaultConfigured,
      staleTime: 10_000,
    },
  });

  // Query for user's balances from backend
  const {
    data: balancesData,
    isLoading: isBalancesLoading,
    isError: isBalancesError,
    error: balancesError,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: queryKeys.trading.balances(address),
    queryFn: async () => {
      if (!address) return null;
      try {
        const response = await fetchApi<BalancesResponse>(`/api/balances/${address}`);
        return response;
      } catch (err) {
        // Log error but don't throw - backend may not be available
        console.warn('[useBalances] Failed to fetch balances from backend:', err);
        throw err;
      }
    },
    enabled: !!address && isConnected,
    staleTime: 5_000, // 5 seconds
    retry: 2,
  });

  // Query for pending deposits
  const {
    data: depositsData,
    isLoading: isDepositsLoading,
    refetch: refetchDeposits,
  } = useQuery({
    queryKey: queryKeys.trading.deposits(address),
    queryFn: async () => {
      if (!address) return null;
      try {
        const response = await fetchApi<DepositsResponse>(`/api/deposits/${address}`);
        return response;
      } catch (err) {
        // Indexer may not be configured - this is not a critical error
        console.debug('[useBalances] Deposits endpoint not available:', err);
        return null;
      }
    },
    enabled: !!address && isConnected,
    staleTime: 10_000, // 10 seconds
    retry: false, // Don't retry - endpoint may not exist
  });

  // Query for withdrawal proofs
  const {
    data: withdrawalsData,
    isLoading: isWithdrawalsLoading,
    refetch: refetchWithdrawals,
  } = useQuery({
    queryKey: queryKeys.trading.withdrawals(address),
    queryFn: async () => {
      if (!address) return null;
      try {
        const response = await fetchApi<WithdrawalsResponse>(`/api/withdrawals/${address}`);
        return response;
      } catch (err) {
        // Settlement service may not be configured - this is not a critical error
        console.debug('[useBalances] Withdrawals endpoint not available:', err);
        return null;
      }
    },
    enabled: !!address && isConnected,
    staleTime: 30_000, // 30 seconds
    retry: false, // Don't retry - endpoint may not exist
  });

  // Parse balances into Map
  const balances = useMemo(() => {
    const map = new Map<string, TokenBalance>();
    if (balancesData?.balances) {
      for (const [tokenId, balance] of Object.entries(balancesData.balances)) {
        map.set(tokenId, balance);
      }
    }
    return map;
  }, [balancesData?.balances]);

  // Get nonce
  const nonce = useMemo(() => {
    return balancesData?.nonce ? BigInt(balancesData.nonce) : 0n;
  }, [balancesData?.nonce]);

  // Get pending deposits
  const pendingDeposits = useMemo(() => {
    return depositsData?.pending || [];
  }, [depositsData?.pending]);

  // Get claimable epochs
  const claimableEpochs = useMemo(() => {
    return withdrawalsData?.unclaimedEpochs || [];
  }, [withdrawalsData?.unclaimedEpochs]);

  // Get withdrawal proofs
  const withdrawalProofs = useMemo(() => {
    return withdrawalsData?.proofs || [];
  }, [withdrawalsData?.proofs]);

  // Deposit function - calls SettlementVault.deposit
  const deposit = useCallback(
    async (amount: bigint): Promise<Hex> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      if (!isConfigured) {
        throw new ApiError(
          `Contract addresses not configured: ${missingConfig.join(', ')}`,
          'VALIDATION_ERROR',
          400
        );
      }

      setDepositError(null);

      try {
        console.log('[useBalances] Starting deposit flow:', {
          amount: amount.toString(),
          vaultAddress,
          usdcAddress,
        });

        // First, approve USDC spending
        console.log('[useBalances] Approving USDC...');
        await writeApprove({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, amount],
        });

        // Then deposit to vault
        console.log('[useBalances] Depositing to vault...');
        const txHash = await writeDeposit({
          address: vaultAddress,
          abi: settlementVaultAbi,
          functionName: 'deposit',
          args: [amount],
        });

        console.log('[useBalances] Deposit transaction submitted:', txHash);

        // Invalidate queries after deposit
        queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.trading.deposits(address) });

        return txHash;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Deposit failed');
        console.error('[useBalances] Deposit failed:', error);
        setDepositError(error);
        throw error;
      }
    },
    [address, isConfigured, missingConfig, usdcAddress, vaultAddress, writeApprove, writeDeposit, queryClient]
  );

  // Withdraw function - fetches proof and calls SettlementVault.claim
  const withdraw = useCallback(
    async (epochId: number): Promise<Hex> => {
      if (!address) {
        throw new ApiError('Wallet not connected', 'UNAUTHORIZED', 401);
      }

      if (!isVaultConfigured) {
        throw new ApiError(
          'Settlement vault address not configured',
          'VALIDATION_ERROR',
          400
        );
      }

      setWithdrawError(null);

      // Find the proof for this epoch from cached data
      let proof = withdrawalProofs.find((p) => p.epochId === epochId);
      
      // If not in cache, fetch from API
      if (!proof) {
        console.log('[useBalances] Fetching withdrawal proof from API...');
        try {
          const response = await fetchApi<{ proof: WithdrawalProof }>(
            `/api/settlement/proof/${epochId}/${address}`
          );
          proof = response.proof;
        } catch (err) {
          const error = err instanceof ApiError 
            ? err 
            : new ApiError(
                `Failed to fetch withdrawal proof for epoch ${epochId}`,
                'NOT_FOUND',
                404
              );
          setWithdrawError(error);
          throw error;
        }
      }

      if (!proof) {
        const error = new ApiError(
          `No withdrawal proof found for epoch ${epochId}`,
          'NOT_FOUND',
          404
        );
        setWithdrawError(error);
        throw error;
      }

      try {
        console.log('[useBalances] Claiming withdrawal:', {
          epochId,
          amount: proof.amount,
          proofLength: proof.proof.length,
        });

        const txHash = await writeClaim({
          address: vaultAddress,
          abi: settlementVaultAbi,
          functionName: 'claim',
          args: [
            BigInt(epochId),
            BigInt(proof.amount),
            proof.proof as Hex[],
          ],
        });

        console.log('[useBalances] Claim transaction submitted:', txHash);

        // Invalidate queries after withdrawal
        queryClient.invalidateQueries({ queryKey: queryKeys.trading.balances(address) });
        queryClient.invalidateQueries({ queryKey: queryKeys.trading.withdrawals(address) });

        return txHash;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Withdrawal failed');
        console.error('[useBalances] Withdrawal failed:', error);
        setWithdrawError(error);
        throw error;
      }
    },
    [address, isVaultConfigured, vaultAddress, withdrawalProofs, writeClaim, queryClient]
  );

  // Refetch all data
  const refetch = useCallback(() => {
    refetchBalances();
    refetchDeposits();
    refetchWithdrawals();
  }, [refetchBalances, refetchDeposits, refetchWithdrawals]);

  // Combined loading state
  const isLoading = isBalancesLoading || isDepositsLoading || isWithdrawalsLoading;
  const isDepositing = isApproving || isDepositPending || isDepositConfirming;
  const isWithdrawing = isClaimPending || isClaimConfirming;

  return useMemo(
    () => ({
      balances,
      nonce,
      pendingDeposits,
      claimableEpochs,
      withdrawalProofs,
      isLoading,
      isError: isBalancesError,
      error: balancesError,
      deposit,
      withdraw,
      isDepositing,
      isWithdrawing,
      depositError,
      withdrawError,
      refetch,
      onChainUsdcBalance: onChainUsdcBalance as bigint | undefined,
      onChainVaultBalance: onChainVaultBalance as bigint | undefined,
      isConfigured,
      missingConfig,
    }),
    [
      balances,
      nonce,
      pendingDeposits,
      claimableEpochs,
      withdrawalProofs,
      isLoading,
      isBalancesError,
      balancesError,
      deposit,
      withdraw,
      isDepositing,
      isWithdrawing,
      depositError,
      withdrawError,
      refetch,
      onChainUsdcBalance,
      onChainVaultBalance,
      isConfigured,
      missingConfig,
    ]
  );
}
