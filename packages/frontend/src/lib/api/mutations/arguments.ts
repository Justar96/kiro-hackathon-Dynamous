/**
 * Argument Mutations
 * 
 * Mutation functions for argument-related API operations.
 */

import { mutateApi } from '../client';
import type { Argument } from '@debate-platform/shared';
import type {
  SubmitArgumentInput,
  SubmitArgumentResponse,
  MindChangedResponse,
} from '../types';

/**
 * Submit an argument in a debate
 */
export async function submitArgument(
  debateId: string,
  input: SubmitArgumentInput,
  token: string
): Promise<Argument> {
  const response = await mutateApi<SubmitArgumentResponse>(
    `/api/debates/${debateId}/arguments`,
    'POST',
    input,
    token
  );
  return response.argument;
}

/**
 * Mark that a specific argument changed your mind.
 * Per original vision: "This changed my mind" button for explicit impact attribution.
 */
export async function markMindChanged(
  argumentId: string,
  token: string
): Promise<MindChangedResponse> {
  return await mutateApi<MindChangedResponse>(
    `/api/arguments/${argumentId}/mind-changed`,
    'POST',
    {},
    token
  );
}
