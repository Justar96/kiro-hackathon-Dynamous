/**
 * Market Data Hook
 * 
 * Hook for fetching market/prediction data for a debate.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { marketQueryOptions } from '../../api';

/**
 * Fetch market data for a debate
 */
export function useMarket(debateId: string) {
  const token = useAuthToken();
  return useQuery(marketQueryOptions(debateId, token));
}
