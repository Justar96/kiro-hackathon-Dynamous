/**
 * Debate Mutations
 * 
 * Mutation functions for debate-related API operations.
 */

import { mutateApi } from '../client';
import type { Debate } from '@thesis/shared';
import type {
  CreateDebateInput,
  CreateDebateResponse,
  JoinDebateResponse,
} from '../types';

/**
 * Create a new debate
 */
export async function createDebate(
  input: CreateDebateInput,
  token: string
): Promise<Debate> {
  const response = await mutateApi<CreateDebateResponse>(
    '/api/debates',
    'POST',
    input,
    token
  );
  return response.debate;
}

/**
 * Join a debate as the oppose debater
 */
export async function joinDebate(
  debateId: string,
  token: string
): Promise<Debate> {
  const response = await mutateApi<JoinDebateResponse>(
    `/api/debates/${debateId}/join`,
    'POST',
    {},
    token
  );
  return response.debate;
}
