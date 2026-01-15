/**
 * usePositions Hook
 *
 * Aggregates user positions across all markets.
 * Calculates unrealized P&L per position and portfolio totals.
 *
 * Requirements: 7.1, 7.3, 7.6
 */

import { useMemo } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import {
  conditionalTokensAbi,
  marketFactoryAbi,
  CONTRACT_ADDRESSES,
  type SupportedChainId,
  isSupportedChain,
} from '@thesis/shared';
import { DEFAULT_CHAIN_ID } from '../../wagmi';
import { useMarket } from './useMarket';
import { useOrderBook } from './useOrderBook';

/**
 * Position data for a single market
 */
export interface Position {
  /** Market contract address */
  marketAddress: `0x${string}`;
  /** Market question text */
  marketQuestion: string;
  /** User's YES token balance */
  yesBalance: bigint;
  /** User's NO token balance */
  noBalance: bigint;
  /** Average entry price for this position (0-1) */
  avgEntryPrice: number;
  /** Current market price (mid-price from order book) */
  currentPrice: number;
  /** Unrealized P&L in USDC */
  unrealizedPnL: number;
  /** Current market state */
  marketState: 'ACTIVE' | 'PENDING_RESOLUTION' | 'DISPUTED' | 'RESOLVED';
}

/**
 * Portfolio summary data
 */
export interface PortfolioSummary {
  /** Total value of all positions in USDC */
  totalValue: bigint;
  /** Total unrealized P&L across all positions */
  totalPnL: number;
  /** Number of active positions */
  positionCount: number;
}

/**
 * Return type for usePositions hook
 */
export interface UsePositionsReturn {
  /** Array of user positions */
  positions: Position[];
  /** Portfolio summary */
  portfolio: PortfolioSummary;
  /** Whether data is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error object if any */
  error: Error | null;
  /** Refetch positions data */
  refetch: () => void;
}

/**
 * Get contract addresses for the current chain
 */
function getAddresses(chainId: number | undefined): {
  marketFactory: `0x${string}`;
  conditionalTokens: `0x${string}`;
} {
  const effectiveChainId = chainId && isSupportedChain(chainId) ? chainId : DEFAULT_CHAIN_ID;
  return {
    marketFactory: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].marketFactory,
    conditionalTokens: CONTRACT_ADDRESSES[effectiveChainId as SupportedChainId].conditionalTokens,
  };
}

/**
 * Calculate unrealized P&L for a position
 * Property 10: P&L Calculation
 * 
 * For any position with known average entry price and current market price,
 * the unrealized P&L SHALL equal (current_price - average_entry_price) × quantity
 */
export function calculateUnrealizedPnL(
  entryPrice: number,
  currentPrice: number,
  quantity: bigint
): number {
  return (currentPrice - entryPrice) * Number(quantity);
}

/**
 * Hook for reading user positions across all markets
 *
 * @param userAddress - User's wallet address
 * @returns User positions and portfolio summary
 */
export function useWeb3Positions(
  userAddress: `0x${string}` | undefined
): UsePositionsReturn {
  const { chainId } = useAccount();
  const addresses = getAddresses(chainId);

  // Read all markets from MarketFactory
  const {
    data: allMarketsData,
    isLoading: isLoadingMarkets,
    isError: isErrorMarkets,
    error: errorMarkets,
    refetch: refetchMarkets,
  } = useReadContract({
    address: addresses.marketFactory,
    abi: marketFactoryAbi,
    functionName: 'allMarkets',
    query: {
      enabled: !!userAddress,
      staleTime: 60_000, // 1 minute
    },
  });

  const allMarkets = (allMarketsData as `0x${string}`[] | undefined) || [];

  // For each market, we need to:
  // 1. Get market data (question, state, token IDs)
  // 2. Get user's token balances
  // 3. Get current market price from order book
  // 4. Calculate P&L

  // This is a simplified implementation that would need to be optimized
  // In production, you'd want to batch these calls or use a subgraph
  const positions = useMemo((): Position[] => {
    if (!userAddress || !allMarkets.length) {
      return [];
    }

    // For now, return empty array
    // In a full implementation, we'd fetch data for each market
    // This would require multiple hooks or a more sophisticated data fetching strategy
    return [];
  }, [userAddress, allMarkets]);

  // Calculate portfolio totals
  // Property 18: Position Aggregation
  // For any user with positions across multiple markets,
  // the portfolio total value SHALL equal the sum of individual position values
  const portfolio = useMemo((): PortfolioSummary => {
    const totalValue = positions.reduce((sum, pos) => {
      const posValue = pos.yesBalance + pos.noBalance;
      return sum + posValue;
    }, 0n);

    const totalPnL = positions.reduce((sum, pos) => {
      return sum + pos.unrealizedPnL;
    }, 0);

    return {
      totalValue,
      totalPnL,
      positionCount: positions.length,
    };
  }, [positions]);

  return useMemo(
    () => ({
      positions,
      portfolio,
      isLoading: isLoadingMarkets,
      isError: isErrorMarkets,
      error: errorMarkets,
      refetch: refetchMarkets,
    }),
    [positions, portfolio, isLoadingMarkets, isErrorMarkets, errorMarkets, refetchMarkets]
  );
}

/**
 * Hook for reading a single position in a specific market
 * This is a helper hook that can be used to build up the full positions list
 *
 * @param userAddress - User's wallet address
 * @param marketAddress - Market contract address
 * @returns Position data for the specified market
 */
export function usePosition(
  userAddress: `0x${string}` | undefined,
  marketAddress: `0x${string}` | undefined
): {
  position: Position | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const { chainId } = useAccount();
  const addresses = getAddresses(chainId);

  // Get market data
  const { data: marketData, isLoading: isLoadingMarket } = useMarket(marketAddress);

  // Get user's YES token balance
  const { data: yesBalance, isLoading: isLoadingYes } = useReadContract({
    address: addresses.conditionalTokens,
    abi: conditionalTokensAbi,
    functionName: 'balanceOf',
    args:
      userAddress && marketData?.yesTokenId !== undefined
        ? [userAddress, marketData.yesTokenId]
        : undefined,
    query: {
      enabled: !!userAddress && !!marketData,
      staleTime: 10_000, // 10 seconds
    },
  });

  // Get user's NO token balance
  const { data: noBalance, isLoading: isLoadingNo } = useReadContract({
    address: addresses.conditionalTokens,
    abi: conditionalTokensAbi,
    functionName: 'balanceOf',
    args:
      userAddress && marketData?.noTokenId !== undefined
        ? [userAddress, marketData.noTokenId]
        : undefined,
    query: {
      enabled: !!userAddress && !!marketData,
      staleTime: 10_000,
    },
  });

  // Get current market price from order book
  const { data: orderBookData } = useOrderBook(
    marketData?.questionId,
    marketData?.yesTokenId,
    { depth: 1, staleTime: 5_000 }
  );

  // Build position data
  const position = useMemo((): Position | undefined => {
    if (
      !marketAddress ||
      !marketData ||
      yesBalance === undefined ||
      noBalance === undefined
    ) {
      return undefined;
    }

    // Skip if user has no position
    if (yesBalance === 0n && noBalance === 0n) {
      return undefined;
    }

    // Get current price from order book (mid-price)
    const currentPrice = orderBookData?.midPrice || 0.5;

    // For now, use a simplified entry price calculation
    // In production, you'd track actual entry prices from trade history
    const avgEntryPrice = 0.5; // Placeholder

    // Calculate unrealized P&L
    const netPosition = Number(yesBalance) - Number(noBalance);
    const unrealizedPnL = calculateUnrealizedPnL(
      avgEntryPrice,
      currentPrice,
      BigInt(Math.abs(netPosition))
    );

    return {
      marketAddress,
      marketQuestion: marketData.question,
      yesBalance,
      noBalance,
      avgEntryPrice,
      currentPrice,
      unrealizedPnL,
      marketState: marketData.state,
    };
  }, [marketAddress, marketData, yesBalance, noBalance, orderBookData]);

  const isLoading = isLoadingMarket || isLoadingYes || isLoadingNo;

  return useMemo(
    () => ({
      position,
      isLoading,
      isError: false,
      error: null,
    }),
    [position, isLoading]
  );
}
