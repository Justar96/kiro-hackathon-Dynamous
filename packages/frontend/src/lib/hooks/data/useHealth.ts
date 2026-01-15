/**
 * Health Check Hook
 * 
 * Hook for checking API health status.
 */

import { useQuery } from '@tanstack/react-query';
import { healthCheckQueryOptions } from '../../api';

/**
 * Check API health
 */
export function useHealthCheck() {
  return useQuery(healthCheckQueryOptions);
}
