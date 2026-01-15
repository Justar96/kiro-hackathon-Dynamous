/**
 * Health Check Query Options
 * 
 * TanStack Query options for API health monitoring.
 */

import { queryOptions } from '@tanstack/react-query';
import { fetchApi } from '../client';
import { queryKeys } from '../queryKeys';
import { CACHE_STRATEGIES } from '../cache';

/**
 * Query options for API health check
 * Uses 'frequent' cache strategy for health monitoring
 */
export const healthCheckQueryOptions = queryOptions({
  queryKey: queryKeys.health,
  queryFn: async () => {
    return fetchApi<{ status: string }>('/api/health');
  },
  ...CACHE_STRATEGIES.frequent,
});
