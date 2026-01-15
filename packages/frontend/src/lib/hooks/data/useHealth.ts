/**
 * Health Check Hook
 */

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../../api';

export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchApi<{ status: string }>('/health'),
    staleTime: 30000,
  });
}
