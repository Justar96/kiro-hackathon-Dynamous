/**
 * Stance Mutations
 * 
 * Mutation functions for stance-related API operations.
 */

import { mutateApi } from '../client';
import type { Stance } from '@thesis/shared';
import type {
  RecordStanceInput,
  QuickStanceInput,
  RecordPreStanceResponse,
  RecordPostStanceResponse,
  QuickStanceResponse,
  AttributeImpactInput,
  AttributeImpactResponse,
} from '../types';

/**
 * Record pre-read stance for a debate
 */
export async function recordPreStance(
  debateId: string,
  input: RecordStanceInput,
  token: string
): Promise<Stance> {
  const response = await mutateApi<RecordPreStanceResponse>(
    `/api/debates/${debateId}/stance/pre`,
    'POST',
    input,
    token
  );
  return response.stance;
}

/**
 * Record post-read stance for a debate
 */
export async function recordPostStance(
  debateId: string,
  input: RecordStanceInput,
  token: string
): Promise<RecordPostStanceResponse> {
  return await mutateApi<RecordPostStanceResponse>(
    `/api/debates/${debateId}/stance/post`,
    'POST',
    input,
    token
  );
}

/**
 * Quick stance from index page - simplified support/oppose
 */
export async function recordQuickStance(
  debateId: string,
  input: QuickStanceInput,
  token: string
): Promise<QuickStanceResponse> {
  return await mutateApi<QuickStanceResponse>(
    `/api/debates/${debateId}/stance/quick`,
    'POST',
    input,
    token
  );
}

/**
 * Attribute mind-change impact to a specific argument.
 * This updates the lastArgumentSeen field on the user's post-stance.
 * Requirements: 13.1
 */
export async function attributeImpact(
  debateId: string,
  input: AttributeImpactInput,
  token: string
): Promise<AttributeImpactResponse> {
  return await mutateApi<AttributeImpactResponse>(
    `/api/debates/${debateId}/attribute-impact`,
    'POST',
    input,
    token
  );
}
