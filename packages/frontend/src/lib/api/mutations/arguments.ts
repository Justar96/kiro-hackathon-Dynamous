/**
 * Argument Mutations
 * 
 * Mutation functions for argument-related API operations.
 */

import { mutateApi, API_BASE, getAuthHeader } from '../client';
import type { Argument, MediaAttachment } from '@thesis/shared';
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

/**
 * Upload media attachment for an argument.
 * Requirements: 2.1, 2.5 - Validate file, store, return MediaAttachment
 */
export async function uploadArgumentMedia(
  argumentId: string,
  file: File,
  token: string
): Promise<MediaAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE}/api/arguments/${argumentId}/media`, {
    method: 'POST',
    headers: getAuthHeader(token),
    body: formData,
  });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorBody.error || 'Upload failed');
  }
  
  const data = await response.json();
  return data.attachment;
}

/**
 * Get URL preview (YouTube or web link).
 * Requirements: 2.2, 2.3 - Parse URL, return UrlPreview or YouTubePreview
 */
export async function getUrlPreview(
  url: string,
  token: string
): Promise<{ type: 'youtube' | 'link'; preview: unknown }> {
  return await mutateApi<{ type: 'youtube' | 'link'; preview: unknown }>(
    '/api/media/preview',
    'POST',
    { url },
    token
  );
}
