/**
 * User Data Hooks
 * 
 * Hooks for fetching user profile and stats data.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { 
  currentUserQueryOptions, 
  userQueryOptions, 
  userStatsQueryOptions,
  reputationBreakdownQueryOptions,
} from '../../api';

/**
 * Fetch current authenticated user with stats
 */
export function useCurrentUser() {
  const token = useAuthToken();
  return useQuery(currentUserQueryOptions(token));
}

/**
 * Fetch user by ID
 */
export function useUserProfile(userId: string) {
  return useQuery(userQueryOptions(userId));
}

/**
 * Fetch user statistics
 */
export function useUserStats(userId: string) {
  return useQuery(userStatsQueryOptions(userId));
}

/**
 * Fetch user reputation breakdown
 * Requirement 4.1 - Return ReputationBreakdown for user profile
 */
export function useReputationBreakdown(userId: string) {
  return useQuery(reputationBreakdownQueryOptions(userId));
}
