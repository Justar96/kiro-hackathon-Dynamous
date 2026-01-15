/**
 * Reaction Mutations
 * 
 * Mutation functions for reaction-related API operations.
 */

import { mutateApi } from '../client';
import type {
  AddReactionInput,
  AddReactionResponse,
  RemoveReactionResponse,
} from '../types';

/**
 * Add a reaction to an argument
 */
export async function addReaction(
  argumentId: string,
  input: AddReactionInput,
  token: string
): Promise<AddReactionResponse['reaction']> {
  const response = await mutateApi<AddReactionResponse>(
    `/api/arguments/${argumentId}/react`,
    'POST',
    input,
    token
  );
  return response.reaction;
}

/**
 * Remove a reaction from an argument
 */
export async function removeReaction(
  argumentId: string,
  type: 'agree' | 'strong_reasoning',
  token: string
): Promise<boolean> {
  const response = await mutateApi<RemoveReactionResponse>(
    `/api/arguments/${argumentId}/react`,
    'DELETE',
    { type },
    token
  );
  return response.success;
}
