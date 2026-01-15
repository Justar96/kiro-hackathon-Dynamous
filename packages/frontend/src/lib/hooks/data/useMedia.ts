/**
 * Media Data Hooks
 * 
 * Hooks for media upload and URL preview operations.
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from './useAuthToken';
import { queryKeys, mutationKeys, requireAuthToken } from '../../api';
import { uploadArgumentMedia, getUrlPreview } from '../../api';
import type { MediaAttachment } from '@thesis/shared';

/**
 * Upload media attachment for an argument.
 * Requirements: 2.1, 2.5 - Validate file, store, return MediaAttachment
 */
export function useMediaUpload() {
  const queryClient = useQueryClient();
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.media.upload(),
    mutationFn: ({
      argumentId,
      file,
    }: {
      argumentId: string;
      file: File;
      debateId: string;
    }): Promise<MediaAttachment> => {
      const authToken = requireAuthToken(token);
      return uploadArgumentMedia(argumentId, file, authToken);
    },
    onSuccess: (_, { debateId }) => {
      // Invalidate debate detail to refresh argument media
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.detail(debateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.debates.full(debateId) });
    },
  });
}

/**
 * Get URL preview (YouTube or web link).
 * Requirements: 2.2, 2.3 - Parse URL, return UrlPreview or YouTubePreview
 */
export function useUrlPreview() {
  const token = useAuthToken();

  return useMutation({
    mutationKey: mutationKeys.media.preview(),
    mutationFn: ({ url }: { url: string }) => {
      const authToken = requireAuthToken(token);
      return getUrlPreview(url, authToken);
    },
  });
}
