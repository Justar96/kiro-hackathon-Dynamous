/**
 * Steelman Mutations
 * 
 * Mutation functions for steelman gate-related API operations.
 */

import { mutateApi } from '../client';
import type {
  SubmitSteelmanInput,
  ReviewSteelmanInput,
  SteelmanResponse,
} from '../types';

/**
 * Submit a steelman of opponent's argument.
 * Required before submitting rebuttal (round 2) or closing (round 3).
 */
export async function submitSteelman(
  debateId: string,
  input: SubmitSteelmanInput,
  token: string
): Promise<SteelmanResponse['steelman']> {
  const response = await mutateApi<SteelmanResponse>(
    `/api/debates/${debateId}/steelman`,
    'POST',
    input,
    token
  );
  return response.steelman;
}

/**
 * Approve or reject a steelman as the opponent.
 */
export async function reviewSteelman(
  steelmanId: string,
  input: ReviewSteelmanInput,
  token: string
): Promise<SteelmanResponse['steelman']> {
  const response = await mutateApi<SteelmanResponse>(
    `/api/steelmans/${steelmanId}/review`,
    'POST',
    input,
    token
  );
  return response.steelman;
}

/**
 * Delete a rejected steelman to resubmit.
 */
export async function deleteSteelman(
  steelmanId: string,
  token: string
): Promise<boolean> {
  const response = await mutateApi<{ success: boolean }>(
    `/api/steelmans/${steelmanId}`,
    'DELETE',
    {},
    token
  );
  return response.success;
}
