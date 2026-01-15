import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi, mutateApi, getAuthHeader } from '../../api/client';
import { useAuthToken } from './useAuthToken';

export interface Market {
  id: string;
  questionId: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  liquidity: string;
  endDate: string;
  resolved: boolean;
  outcome?: boolean;
}

export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      return fetchApi<Market[]>('/api/markets');
    },
  });
}

export function useMarket(marketId: string) {
  return useQuery({
    queryKey: ['markets', marketId],
    queryFn: async () => {
      return fetchApi<Market>(`/api/markets/${marketId}`);
    },
    enabled: !!marketId,
  });
}

export function useCreateMarket() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: async (data: {
      question: string;
      category: string;
      endDate: string;
      initialLiquidity: number;
    }) => {
      return mutateApi<Market>('/api/markets', 'POST', data, token ?? undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    },
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationFn: async (data: {
      marketId: string;
      side: 'yes' | 'no';
      amount: number;
    }) => {
      return mutateApi(`/api/markets/${data.marketId}/orders`, 'POST', {
        side: data.side,
        amount: data.amount,
      }, token ?? undefined);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['markets', variables.marketId] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
    },
  });
}

export function usePositions() {
  const token = useAuthToken();
  
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      return fetchApi('/api/positions', {
        headers: getAuthHeader(token),
      });
    },
  });
}
