/**
 * MediaUploader Component
 * 
 * Provides file upload with drag-and-drop support and URL paste detection
 * for YouTube videos and web links.
 * 
 * Requirements:
 * - 2.1: Accept file uploads (images, PDFs, documents up to 10MB)
 * - 2.2: Auto-detect and preview YouTube URLs
 * - 2.3: Auto-detect and preview web URLs
 * - 2.4: Display inline previews for attached media
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ACCEPTED_FILE_TYPES, 
  MAX_FILE_SIZE,
  type YouTubePreview,
} from '@thesis/shared';
import { MediaPreview, type PendingMedia } from './MediaPreview';

// ============================================================================
// Types
// ============================================================================

export interface MediaUploaderProps {
  /** Callback when media is added */
  onMediaAdded: (media: PendingMedia) => void;
  /** Callback when media is removed */
  onMediaRemoved?: (mediaId: string) => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
  /** Maximum number of files allowed */
  maxFiles?: number;
  /** Currently attached media items */
  attachedMedia?: PendingMedia[];
  /** Whether the uploader is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
];

const URL_PATTERN = /^https?:\/\/[^\s]+$/i;

// ============================================================================
// Helper Functions
// ============================================================================

/** Generate a unique ID for pending media */
function generateId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Parse YouTube URL and extract video ID */
function parseYouTubeUrl(url: string): YouTubePreview | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return {
        videoId,
        title: 'YouTube Video',
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        channelName: null,
        duration: null,
      };
    }
  }
  return null;
}

/** Check if URL is a YouTube URL */
function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some(pattern => pattern.test(url));
}

/** Validate file type and size */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit. Please compress or choose a smaller file.`,
    };
  }

  if (!ACCEPTED_FILE_TYPES.includes(file.type as typeof ACCEPTED_FILE_TYPES[number])) {
    return {
      valid: false,
      error: 'This file type is not supported. Accepted: images, PDFs, documents.',
    };
  }

  return { valid: true };
}

/** Create object URL for file preview */
function createFilePreview(file: File): string {
  return URL.createObjectURL(file);
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Drop zone visual indicator */
function DropZone({ 
  isDragging, 
  disabled,
  onClick,
}: { 
  isDragging: boolean; 
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Upload files by clicking or dropping"
      aria-describedby="dropzone-description"
      className={`
        w-full min-h-[88px] p-4 rounded-lg border-2 border-dashed transition-all
        flex flex-col items-center justify-center gap-2
        motion-safe:transition-colors motion-reduce:transition-none
        ${isDragging 
          ? 'border-accent bg-accent/5' 
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <svg 
        className={`w-6 h-6 ${isDragging ? 'text-accent' : 'text-gray-400'}`} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor"
        aria-hidden="true"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={1.5} 
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
        />
      </svg>
      <div className="text-center" id="dropzone-description">
        <p className="text-sm text-text-secondary">
          {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
        </p>
        <p className="text-xs text-text-tertiary mt-1">
          Images, PDFs, documents up to 10MB
        </p>
      </div>
    </button>
  );
}

/** URL input for pasting links */
function UrlInput({
  onUrlSubmit,
  disabled,
}: {
  onUrlSubmit: (url: string) => void;
  disabled: boolean;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) return;
    
    if (!URL_PATTERN.test(trimmedUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    onUrlSubmit(trimmedUrl);
    setUrl('');
    setError(null);
  }, [url, onUrlSubmit]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text').trim();
    if (URL_PATTERN.test(pastedText)) {
      e.preventDefault();
      onUrlSubmit(pastedText);
      setUrl('');
      setError(null);
    }
  }, [onUrlSubmit]);

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" role="search" aria-label="Add URL">
      <div className="flex-1">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          onPaste={handlePaste}
          placeholder="Paste YouTube or web link..."
          disabled={disabled}
          aria-label="URL to add as evidence"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? 'url-error' : undefined}
          className={`
            w-full min-h-[44px] px-3 py-2 text-sm
            border rounded-lg
            focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent
            disabled:opacity-50 disabled:cursor-not-allowed
            motion-safe:transition-colors motion-reduce:transition-none
            ${error ? 'border-red-300' : 'border-gray-200'}
          `}
        />
        {error && (
          <p id="url-error" className="text-xs text-red-500 mt-1" role="alert">{error}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={disabled || !url.trim()}
        aria-label="Add URL"
        className="min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium text-accent border border-accent rounded-lg hover:bg-accent/5 disabled:opacity-50 disabled:cursor-not-allowed motion-safe:transition-colors motion-reduce:transition-none"
      >
        Add
      </button>
    </form>
  );
}

/** Media preview list */
function MediaList({
  media,
  onRemove,
}: {
  media: PendingMedia[];
  onRemove: (id: string) => void;
}) {
  if (media.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 mt-3">
      {media.map((item) => (
        <MediaPreview
          key={item.id}
          media={item}
          removable
          onRemove={() => onRemove(item.id)}
          size="sm"
        />
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function MediaUploader({
  onMediaAdded,
  onMediaRemoved,
  onError,
  maxFiles = 5,
  attachedMedia = [],
  disabled = false,
  className = '',
}: MediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const canAddMore = attachedMedia.length < maxFiles;

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachedMedia.forEach((media) => {
        if (media.url.startsWith('blob:')) {
          URL.revokeObjectURL(media.url);
        }
      });
    };
  }, []);

  // Handle file selection
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = maxFiles - attachedMedia.length;
    const filesToProcess = fileArray.slice(0, remainingSlots);

    if (fileArray.length > remainingSlots) {
      onError?.(`Maximum ${maxFiles} files allowed. Only first ${remainingSlots} will be added.`);
    }

    filesToProcess.forEach((file) => {
      const validation = validateFile(file);
      
      if (!validation.valid) {
        onError?.(validation.error || 'Invalid file');
        return;
      }

      const previewUrl = createFilePreview(file);
      const isImage = file.type.startsWith('image/');

      const pendingMedia: PendingMedia = {
        id: generateId(),
        type: 'file',
        url: previewUrl,
        thumbnailUrl: isImage ? previewUrl : null,
        title: file.name,
        mimeType: file.type,
        fileSize: file.size,
        file,
        isUploading: false,
      };

      onMediaAdded(pendingMedia);
    });
  }, [attachedMedia.length, maxFiles, onMediaAdded, onError]);

  // Handle URL submission
  const handleUrlSubmit = useCallback((url: string) => {
    if (!canAddMore) {
      onError?.(`Maximum ${maxFiles} files allowed.`);
      return;
    }

    // Check if it's a YouTube URL
    if (isYouTubeUrl(url)) {
      const youtubePreview = parseYouTubeUrl(url);
      if (youtubePreview) {
        const pendingMedia: PendingMedia = {
          id: generateId(),
          type: 'youtube',
          url: `https://www.youtube.com/watch?v=${youtubePreview.videoId}`,
          thumbnailUrl: youtubePreview.thumbnailUrl,
          title: youtubePreview.title,
          description: null,
          mimeType: null,
          fileSize: null,
        };
        onMediaAdded(pendingMedia);
        return;
      }
    }

    // Treat as web link
    const pendingMedia: PendingMedia = {
      id: generateId(),
      type: 'link',
      url,
      thumbnailUrl: null,
      title: url,
      description: null,
      mimeType: null,
      fileSize: null,
      isUploading: true, // Will fetch preview
    };
    onMediaAdded(pendingMedia);
  }, [canAddMore, maxFiles, onMediaAdded, onError]);

  // Handle media removal
  const handleRemove = useCallback((mediaId: string) => {
    const media = attachedMedia.find((m) => m.id === mediaId);
    if (media?.url.startsWith('blob:')) {
      URL.revokeObjectURL(media.url);
    }
    onMediaRemoved?.(mediaId);
  }, [attachedMedia, onMediaRemoved]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (disabled || !canAddMore) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  }, [disabled, canAddMore, handleFiles]);

  // Click to open file picker
  const handleClick = useCallback(() => {
    if (!disabled && canAddMore) {
      fileInputRef.current?.click();
    }
  }, [disabled, canAddMore]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }, [handleFiles]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES.join(',')}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || !canAddMore}
      />

      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <DropZone 
            isDragging={isDragging} 
            disabled={disabled || !canAddMore}
            onClick={handleClick}
          />
        </div>
      )}

      {/* URL input */}
      {canAddMore && (
        <UrlInput 
          onUrlSubmit={handleUrlSubmit} 
          disabled={disabled || !canAddMore}
        />
      )}

      {/* Attached media preview */}
      <MediaList 
        media={attachedMedia} 
        onRemove={handleRemove}
      />

      {/* File count indicator */}
      {attachedMedia.length > 0 && (
        <p className="text-xs text-text-tertiary">
          {attachedMedia.length} of {maxFiles} attachments
        </p>
      )}
    </div>
  );
}

export default MediaUploader;
