/**
 * Debate Data Hooks
 * 
 * Hooks for fetching and mutating debate data.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import {
  queryKeys,
  debatesQueryOptions,
  debateQueryOptions,
  debateDetailQueryOptions,
  debateFullQueryOptions,
} from '../../api';
import { createDebate, joinDebate, submitArgument } from '../../api';
import { mutationKeys } from '../../api';

/**
 * Fetch all debates
 */
export function useDebates() {
  return useQuery(debatesQueryOptions);
}

/**
 * Fetch a single debate by ID
 */
export function useDebate(debateId: string) {
  return useQuery(debateQueryOptions(debateId));
}

/**
 * Fetch debate details with rounds and arguments
 */
export function useDebateDetail(debateId: string) {
  return useQuery(debateDetailQueryOptions(debateId));
}

/**
 * Fetch debate with ALL related data (debate, rounds, debaters, market) in one request.
 * Use this for the debate detail page to minimize API calls.
 */
export function useDebateFull(debateId: string) {
  const token = useAuthToken();
  return useQuery(debateFullQueryOptions(debateId, token));
}

/**
 * Create a new debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useCreateDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.debates.create(),
    mutationFn: (input: { resolution: string; creatorSide?: 'support' | 'oppose' }) => {
      if (!token) throw new Error('Authentication required');
      return createDebate(input, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Join a debate as oppose debater
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useJoinDebate() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'debates', 'join'] as const,
    mutationFn: (debateId: string) => {
      if (!token) throw new Error('Authentication required');
      return joinDebate(debateId, token);
    },
    onSuccess: (_, debateId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.all });
    },
  });
}

/**
 * Submit an argument in a debate
 * TanStack Query v5: Added mutationKey for tracking via useMutationState
 */
export function useSubmitArgument() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: ['mutations', 'arguments', 'submit'] as const,
    mutationFn: ({ debateId, content }: { debateId: string; content: string }) => {
      if (!token) throw new Error('Authentication required');
      return submitArgument(debateId, { content }, token);
    },
    onSuccess: (_, { debateId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}
