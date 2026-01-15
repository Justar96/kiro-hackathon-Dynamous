/**
 * Comment Mutations
 * 
 * Mutation functions for comment-related API operations.
 */

import { mutateApi } from '../client';
import type { Comment } from '@debate-platform/shared';
import type {
  AddCommentInput,
  AddCommentResponse,
} from '../types';

/**
 * Add a comment to a debate
 */
export async function addComment(
  debateId: string,
  input: AddCommentInput,
  token: string
): Promise<Comment> {
  const response = await mutateApi<AddCommentResponse>(
    `/api/debates/${debateId}/comments`,
    'POST',
    input,
    token
  );
  return response.comment;
}
