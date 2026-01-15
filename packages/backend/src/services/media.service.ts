import { eq } from 'drizzle-orm';
import { db } from '../db';
import { mediaAttachments } from '../db/schema';
import {
  MediaAttachment,
  UrlPreview,
  YouTubePreview,
  CreateMediaAttachmentInput,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE,
  AcceptedFileType,
} from '@thesis/shared';

// Validation result type
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// File info for validation (mimics File interface for testing)
export interface FileInfo {
  size: number;
  type: string;
  name?: string;
}

export class MediaService {
  /**
   * Validate file type and size
   * Property 4: File Upload Size Validation
   * - IF file size is ≤ 10MB AND MIME type is in accepted list, THEN upload SHALL succeed
   * - OTHERWISE it SHALL be rejected with appropriate error message
   */
  validateFile(file: FileInfo): ValidationResult {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit. Please compress or choose a smaller file.`,
      };
    }

    // Check file type
    if (!ACCEPTED_FILE_TYPES.includes(file.type as AcceptedFileType)) {
      return {
        valid: false,
        error: 'This file type is not supported. Accepted: images, PDFs, documents.',
      };
    }

    return { valid: true };
  }

  /**
   * Upload a file attachment for an argument (stub for file storage integration)
   * Returns MediaAttachment on success
   */
  async uploadFile(
    file: FileInfo,
    argumentId: string,
    userId: string
  ): Promise<MediaAttachment> {
    // Validate file first
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate unique ID
    const id = crypto.randomUUID();
    
    // Stub: In production, this would upload to file storage (S3, etc.)
    // For now, we create a placeholder URL
    const url = `https://storage.example.com/uploads/${id}/${file.name || 'file'}`;
    
    // Create media attachment record
    const [attachment] = await db
      .insert(mediaAttachments)
      .values({
        id,
        argumentId,
        type: 'file',
        url,
        mimeType: file.type,
        fileSize: file.size,
        title: file.name || null,
      })
      .returning();

    return {
      id: attachment.id,
      argumentId: attachment.argumentId,
      type: attachment.type as 'file' | 'youtube' | 'link',
      url: attachment.url,
      thumbnailUrl: attachment.thumbnailUrl,
      title: attachment.title,
      description: attachment.description,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
    };
  }


  /**
   * Parse YouTube URL and extract video metadata
   * Property 5: YouTube URL Parsing Round-Trip
   * - For any valid YouTube URL, parsing SHALL extract a videoId
   * - The extracted videoId SHALL be usable to reconstruct a valid YouTube URL
   */
  parseYouTubeUrl(url: string): YouTubePreview | null {
    // First, validate that the URL uses http:// or https:// protocol
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return null;
      }
    } catch {
      // Invalid URL format
      return null;
    }

    // Match various YouTube URL formats:
    // - https://www.youtube.com/watch?v=VIDEO_ID
    // - https://youtube.com/watch?v=VIDEO_ID
    // - https://youtu.be/VIDEO_ID
    // - https://www.youtube.com/embed/VIDEO_ID
    // - https://www.youtube.com/v/VIDEO_ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        return {
          videoId,
          title: 'YouTube Video', // Placeholder - would fetch from YouTube API in production
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          channelName: null,
          duration: null,
        };
      }
    }

    return null;
  }

  /**
   * Check if a URL is a valid YouTube URL
   */
  isYouTubeUrl(url: string): boolean {
    return this.parseYouTubeUrl(url) !== null;
  }

  /**
   * Parse a web URL and fetch Open Graph metadata
   * Property 6: Web URL Preview Structure
   * - For any valid HTTP/HTTPS URL, the preview response SHALL contain
   *   at minimum a title field (possibly empty string) and the original URL
   */
  async parseUrl(url: string): Promise<UrlPreview> {
    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      throw new Error('Could not fetch preview for this URL.');
    }

    // In production, this would fetch the page and parse Open Graph tags
    // For now, return a basic preview structure
    try {
      // Stub implementation - in production would use fetch + cheerio/jsdom
      // to extract og:title, og:description, og:image, etc.
      return {
        url,
        title: '', // Would be extracted from og:title or <title>
        description: '',
        thumbnailUrl: null,
        siteName: parsedUrl.hostname,
        type: 'other',
      };
    } catch {
      throw new Error('Could not fetch preview for this URL.');
    }
  }

  /**
   * Get all media attachments for an argument
   */
  async getArgumentMedia(argumentId: string): Promise<MediaAttachment[]> {
    const attachments = await db
      .select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.argumentId, argumentId));

    return attachments.map((a) => ({
      id: a.id,
      argumentId: a.argumentId,
      type: a.type as 'file' | 'youtube' | 'link',
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      title: a.title,
      description: a.description,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      createdAt: a.createdAt,
    }));
  }

  /**
   * Create a media attachment record (for YouTube and link previews)
   */
  async createMediaAttachment(
    input: CreateMediaAttachmentInput
  ): Promise<MediaAttachment> {
    const id = crypto.randomUUID();

    const [attachment] = await db
      .insert(mediaAttachments)
      .values({
        id,
        argumentId: input.argumentId,
        type: input.type,
        url: input.url,
        thumbnailUrl: input.thumbnailUrl ?? null,
        title: input.title ?? null,
        description: input.description ?? null,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
      })
      .returning();

    return {
      id: attachment.id,
      argumentId: attachment.argumentId,
      type: attachment.type as 'file' | 'youtube' | 'link',
      url: attachment.url,
      thumbnailUrl: attachment.thumbnailUrl,
      title: attachment.title,
      description: attachment.description,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      createdAt: attachment.createdAt,
    };
  }
}

// Export singleton instance
export const mediaService = new MediaService();
