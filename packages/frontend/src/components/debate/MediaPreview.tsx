/**
 * MediaPreview Component
 * 
 * Displays previews for different types of media attachments:
 * - Images: Thumbnail with lightbox capability
 * - YouTube videos: Embedded thumbnail with play indicator
 * - Web links: Card with title, description, and thumbnail
 * - Documents: File icon with name and size
 * 
 * Requirements: 2.4 - Display inline previews within argument blocks
 */

import { useCallback } from 'react';
import type { MediaAttachment, YouTubePreview, UrlPreview } from '@thesis/shared';

// ============================================================================
// Types
// ============================================================================

export interface MediaPreviewProps {
  /** Media attachment to display */
  media: MediaAttachment | YouTubePreview | UrlPreview | PendingMedia;
  /** Whether to show remove button */
  removable?: boolean;
  /** Callback when remove button is clicked */
  onRemove?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

/** Pending media before it's uploaded */
export interface PendingMedia {
  id: string;
  type: 'file' | 'youtube' | 'link';
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  file?: File;
  isUploading?: boolean;
  error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Format file size for display */
function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Get file extension from MIME type or URL */
function getFileExtension(mimeType?: string | null, url?: string): string {
  if (mimeType) {
    const ext = mimeType.split('/')[1]?.toUpperCase();
    if (ext === 'VND.OPENXMLFORMATS-OFFICEDOCUMENT.WORDPROCESSINGML.DOCUMENT') return 'DOCX';
    if (ext === 'MSWORD') return 'DOC';
    return ext || 'FILE';
  }
  if (url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1]?.toUpperCase() || 'FILE';
  }
  return 'FILE';
}

/** Check if media is an image */
function isImage(media: MediaPreviewProps['media']): boolean {
  if ('mimeType' in media && media.mimeType) {
    return media.mimeType.startsWith('image/');
  }
  if ('type' in media && media.type === 'file') {
    return false; // Can't determine without mimeType
  }
  return false;
}

/** Check if media is a YouTube video */
function isYouTube(media: MediaPreviewProps['media']): media is YouTubePreview {
  return 'videoId' in media;
}

/** Check if media is a URL preview */
function isUrlPreview(media: MediaPreviewProps['media']): media is UrlPreview {
  return 'siteName' in media || ('type' in media && media.type === 'link');
}

/** Check if media is a document */
function isDocument(media: MediaPreviewProps['media']): boolean {
  if ('mimeType' in media && media.mimeType) {
    return (
      media.mimeType === 'application/pdf' ||
      media.mimeType === 'application/msword' ||
      media.mimeType.includes('wordprocessingml')
    );
  }
  return false;
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Remove button for media items */
function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute -top-2 -right-2 w-11 h-11 bg-white border border-gray-200 rounded-full shadow-sm flex items-center justify-center hover:bg-gray-50 hover:border-gray-300 motion-safe:transition-colors motion-reduce:transition-none z-10"
      aria-label="Remove attachment"
    >
      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/** Loading spinner overlay */
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg" role="status" aria-label="Uploading">
      <svg className="w-5 h-5 text-accent motion-safe:animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}

/** Error overlay */
function ErrorOverlay({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center rounded-lg p-2">
      <span className="text-xs text-red-600 text-center">{message}</span>
    </div>
  );
}

// ============================================================================
// Preview Components by Type
// ============================================================================

/** Image preview with thumbnail */
function ImagePreview({ 
  media, 
  size 
}: { 
  media: MediaPreviewProps['media']; 
  size: 'sm' | 'md' | 'lg';
}) {
  const url = 'thumbnailUrl' in media && media.thumbnailUrl ? media.thumbnailUrl : ('url' in media ? media.url : '');
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <div className={`${sizeClasses[size]} rounded-lg overflow-hidden bg-gray-100`}>
      <img
        src={url}
        alt={('title' in media && media.title) || 'Image attachment'}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

/** YouTube video preview */
function YouTubeVideoPreview({ 
  media, 
  size 
}: { 
  media: YouTubePreview; 
  size: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-32 h-20',
    md: 'w-48 h-28',
    lg: 'w-64 h-36',
  };

  return (
    <a
      href={`https://www.youtube.com/watch?v=${media.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${sizeClasses[size]} min-h-[44px] relative rounded-lg overflow-hidden bg-gray-100 block group`}
      aria-label={`Watch YouTube video: ${media.title || 'Video'}`}
    >
      <img
        src={media.thumbnailUrl}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 motion-safe:transition-colors motion-reduce:transition-none">
        <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg" aria-hidden="true">
          <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* Title overlay */}
      {media.title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="text-xs text-white truncate">{media.title}</p>
        </div>
      )}
    </a>
  );
}

/** Web link preview card */
function LinkPreview({ 
  media, 
  size 
}: { 
  media: UrlPreview | PendingMedia; 
  size: 'sm' | 'md' | 'lg';
}) {
  const url = 'url' in media ? media.url : '';
  const title = ('title' in media && media.title) || url;
  const description = 'description' in media ? media.description : null;
  const thumbnailUrl = 'thumbnailUrl' in media ? media.thumbnailUrl : null;
  const siteName = 'siteName' in media ? media.siteName : null;

  const sizeClasses = {
    sm: 'max-w-[200px]',
    md: 'max-w-[280px]',
    lg: 'max-w-[360px]',
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${sizeClasses[size]} min-h-[44px] flex flex-col rounded-lg border border-gray-200 overflow-hidden bg-white hover:border-gray-300 hover:shadow-sm motion-safe:transition-all motion-reduce:transition-none`}
      aria-label={`Open link: ${title}`}
    >
      {thumbnailUrl && (
        <div className="w-full h-24 bg-gray-100">
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-3 flex-1">
        <p className="text-sm font-medium text-text-primary line-clamp-2">{title}</p>
        {description && (
          <p className="text-xs text-text-secondary mt-1 line-clamp-2">{description}</p>
        )}
        {siteName && (
          <p className="text-xs text-text-tertiary mt-2 truncate">{siteName}</p>
        )}
      </div>
    </a>
  );
}

/** Document/file preview */
function DocumentPreview({ 
  media, 
  size 
}: { 
  media: MediaPreviewProps['media']; 
  size: 'sm' | 'md' | 'lg';
}) {
  const mimeType = 'mimeType' in media ? media.mimeType : null;
  const fileSize = 'fileSize' in media ? media.fileSize : null;
  const title = ('title' in media && media.title) || 'Document';
  const url = 'url' in media ? media.url : '';
  const extension = getFileExtension(mimeType, url);

  const sizeClasses = {
    sm: 'w-32',
    md: 'w-40',
    lg: 'w-48',
  };

  // Icon colors based on file type
  const iconColors: Record<string, string> = {
    PDF: 'text-red-500 bg-red-50',
    DOC: 'text-blue-500 bg-blue-50',
    DOCX: 'text-blue-500 bg-blue-50',
  };
  const iconColor = iconColors[extension] || 'text-gray-500 bg-gray-50';

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${sizeClasses[size]} min-h-[44px] flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm motion-safe:transition-all motion-reduce:transition-none`}
      aria-label={`Open document: ${title}`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconColor}`} aria-hidden="true">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{title}</p>
        <p className="text-xs text-text-tertiary">
          {extension}
          {fileSize ? ` · ${formatFileSize(fileSize)}` : ''}
        </p>
      </div>
    </a>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaPreview({
  media,
  removable = false,
  onRemove,
  size = 'md',
  className = '',
}: MediaPreviewProps) {
  const handleRemove = useCallback(() => {
    onRemove?.();
  }, [onRemove]);

  const isUploading = 'isUploading' in media && media.isUploading;
  const error = 'error' in media ? media.error : undefined;

  // Determine which preview to render
  let preview: React.ReactNode;

  if (isYouTube(media)) {
    preview = <YouTubeVideoPreview media={media} size={size} />;
  } else if (isUrlPreview(media)) {
    preview = <LinkPreview media={media as UrlPreview | PendingMedia} size={size} />;
  } else if (isImage(media)) {
    preview = <ImagePreview media={media} size={size} />;
  } else if (isDocument(media)) {
    preview = <DocumentPreview media={media} size={size} />;
  } else {
    // Default to document preview for unknown types
    preview = <DocumentPreview media={media} size={size} />;
  }

  return (
    <div className={`relative inline-block ${className}`}>
      {preview}
      {removable && onRemove && <RemoveButton onClick={handleRemove} />}
      {isUploading && <LoadingOverlay />}
      {error && <ErrorOverlay message={error} />}
    </div>
  );
}

export default MediaPreview;
