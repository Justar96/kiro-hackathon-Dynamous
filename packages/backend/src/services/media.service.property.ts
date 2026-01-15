import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { MediaService, type FileInfo } from './media.service';
import { ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from '@debate-platform/shared';

/**
 * Feature: debate-lifecycle-ux, Property 4: File Upload Size Validation
 * Validates: Requirements 2.1, 2.5, 2.6
 * 
 * For any file upload, IF the file size is ≤ 10MB AND the MIME type is in the accepted list,
 * THEN the upload SHALL succeed; OTHERWISE it SHALL be rejected with an appropriate error message.
 */

const mediaService = new MediaService();

// Arbitrary for generating valid file info (within size limit and accepted type)
const validFileArbitrary = fc.record({
  size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
  type: fc.constantFrom(...ACCEPTED_FILE_TYPES),
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

// Arbitrary for generating files that exceed size limit
const oversizedFileArbitrary = fc.record({
  size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 10 }),
  type: fc.constantFrom(...ACCEPTED_FILE_TYPES),
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

// Arbitrary for generating files with invalid MIME types
const invalidTypeFileArbitrary = fc.record({
  size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
  type: fc.constantFrom(
    'application/x-executable',
    'application/x-msdownload',
    'text/html',
    'application/javascript',
    'video/mp4',
    'audio/mpeg',
    'application/zip',
    'application/x-rar-compressed'
  ),
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

describe('MediaService Property Tests', () => {
  /**
   * Property 4: File Upload Size Validation
   * For any file with valid size (≤ 10MB) AND valid MIME type, validation SHALL succeed.
   * Validates: Requirements 2.1, 2.5, 2.6
   */
  it('Property 4: Valid files (size ≤ 10MB and accepted type) should pass validation', () => {
    fc.assert(
      fc.property(validFileArbitrary, (file: FileInfo) => {
        const result = mediaService.validateFile(file);
        
        // Property: Valid files must pass validation
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (size rejection): Files exceeding 10MB should be rejected
   * Validates: Requirements 2.1, 2.5
   */
  it('Property 4: Files exceeding 10MB should be rejected with size error', () => {
    fc.assert(
      fc.property(oversizedFileArbitrary, (file: FileInfo) => {
        const result = mediaService.validateFile(file);
        
        // Property: Oversized files must be rejected
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('10MB limit');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (type rejection): Files with unsupported MIME types should be rejected
   * Validates: Requirements 2.6
   */
  it('Property 4: Files with unsupported MIME types should be rejected with type error', () => {
    fc.assert(
      fc.property(invalidTypeFileArbitrary, (file: FileInfo) => {
        const result = mediaService.validateFile(file);
        
        // Property: Invalid type files must be rejected
        expect(result.valid).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.error).toContain('not supported');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (boundary): Files at exactly 10MB should pass validation
   * Edge case for boundary testing
   */
  it('Property 4: Files at exactly 10MB boundary should pass validation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_FILE_TYPES),
        (mimeType) => {
          const file: FileInfo = {
            size: MAX_FILE_SIZE, // Exactly 10MB
            type: mimeType,
          };
          const result = mediaService.validateFile(file);
          
          // Property: Files at exactly the limit should pass
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4 (just over boundary): Files at 10MB + 1 byte should fail
   * Edge case for boundary testing
   */
  it('Property 4: Files at 10MB + 1 byte should fail validation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_FILE_TYPES),
        (mimeType) => {
          const file: FileInfo = {
            size: MAX_FILE_SIZE + 1, // Just over 10MB
            type: mimeType,
          };
          const result = mediaService.validateFile(file);
          
          // Property: Files just over the limit should fail
          expect(result.valid).toBe(false);
          expect(result.error).toContain('10MB limit');
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: debate-lifecycle-ux, Property 5: YouTube URL Parsing Round-Trip
 * Validates: Requirements 2.2
 * 
 * For any valid YouTube URL (matching youtube.com/watch?v= or youtu.be/ patterns),
 * parsing SHALL extract a videoId, and the extracted videoId SHALL be usable
 * to reconstruct a valid YouTube URL.
 */

// Arbitrary for generating valid YouTube video IDs (11 characters, alphanumeric + _ and -)
const youtubeVideoIdArbitrary = fc.stringOf(
  fc.constantFrom(
    ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')
  ),
  { minLength: 11, maxLength: 11 }
);

// Arbitrary for generating valid YouTube URLs in various formats
const youtubeUrlArbitrary = fc.tuple(
  youtubeVideoIdArbitrary,
  fc.constantFrom(
    'https://www.youtube.com/watch?v=',
    'https://youtube.com/watch?v=',
    'https://youtu.be/',
    'https://www.youtube.com/embed/',
    'https://www.youtube.com/v/'
  )
).map(([videoId, prefix]) => ({ url: `${prefix}${videoId}`, videoId }));

// Arbitrary for generating invalid YouTube URLs
const invalidYoutubeUrlArbitrary = fc.constantFrom(
  'https://vimeo.com/123456789',
  'https://dailymotion.com/video/x123456',
  'https://example.com/video',
  'not-a-url',
  'https://youtube.com/channel/UCxxx',
  'https://youtube.com/playlist?list=PLxxx',
  'ftp://youtube.com/watch?v=abc123def45',
);

describe('MediaService YouTube URL Property Tests', () => {
  /**
   * Property 5: YouTube URL Parsing Round-Trip
   * For any valid YouTube URL, parsing SHALL extract a videoId.
   * Validates: Requirements 2.2
   */
  it('Property 5: Valid YouTube URLs should be parsed and extract videoId', () => {
    fc.assert(
      fc.property(youtubeUrlArbitrary, ({ url, videoId }) => {
        const result = mediaService.parseYouTubeUrl(url);
        
        // Property: Valid YouTube URLs must be parsed successfully
        expect(result).not.toBeNull();
        expect(result!.videoId).toBe(videoId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (round-trip): Extracted videoId can reconstruct a valid thumbnail URL
   * Validates: Requirements 2.2
   */
  it('Property 5: Extracted videoId should produce valid thumbnail URL', () => {
    fc.assert(
      fc.property(youtubeUrlArbitrary, ({ url, videoId }) => {
        const result = mediaService.parseYouTubeUrl(url);
        
        // Property: Thumbnail URL should contain the videoId
        expect(result).not.toBeNull();
        expect(result!.thumbnailUrl).toContain(videoId);
        expect(result!.thumbnailUrl).toMatch(/^https:\/\/img\.youtube\.com\/vi\//);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (structure): Parsed result should have required fields
   * Validates: Requirements 2.2
   */
  it('Property 5: Parsed YouTube preview should have required structure', () => {
    fc.assert(
      fc.property(youtubeUrlArbitrary, ({ url }) => {
        const result = mediaService.parseYouTubeUrl(url);
        
        // Property: Result must have all required fields
        expect(result).not.toBeNull();
        expect(result).toHaveProperty('videoId');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('thumbnailUrl');
        expect(typeof result!.videoId).toBe('string');
        expect(typeof result!.title).toBe('string');
        expect(typeof result!.thumbnailUrl).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5 (invalid URLs): Invalid YouTube URLs should return null
   * Validates: Requirements 2.2
   */
  it('Property 5: Invalid YouTube URLs should return null', () => {
    fc.assert(
      fc.property(invalidYoutubeUrlArbitrary, (url) => {
        const result = mediaService.parseYouTubeUrl(url);
        
        // Property: Invalid URLs must return null
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Feature: debate-lifecycle-ux, Property 6: Web URL Preview Structure
 * Validates: Requirements 2.3
 * 
 * For any valid HTTP/HTTPS URL, the preview response SHALL contain
 * at minimum a title field (possibly empty string) and the original URL.
 */

// Arbitrary for generating valid HTTP/HTTPS URLs
const validWebUrlArbitrary = fc.tuple(
  fc.constantFrom('http://', 'https://'),
  fc.webUrl({ withFragments: false, withQueryParameters: false })
).map(([protocol, url]) => {
  // webUrl generates full URLs, we need to ensure protocol matches
  const urlWithoutProtocol = url.replace(/^https?:\/\//, '');
  return `${protocol}${urlWithoutProtocol}`;
});

// Simpler arbitrary for valid domains
const validDomainUrlArbitrary = fc.tuple(
  fc.constantFrom('http://', 'https://'),
  fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 3, maxLength: 20 }),
  fc.constantFrom('.com', '.org', '.net', '.io', '.dev')
).map(([protocol, domain, tld]) => `${protocol}${domain}${tld}`);

// Arbitrary for invalid URLs
const invalidUrlArbitrary = fc.constantFrom(
  'not-a-url',
  'ftp://example.com',
  'file:///path/to/file',
  'javascript:alert(1)',
  'data:text/html,<h1>Hello</h1>',
  '',
  '   ',
);

describe('MediaService URL Preview Property Tests', () => {
  /**
   * Property 6: Web URL Preview Structure
   * For any valid HTTP/HTTPS URL, the preview SHALL contain title and original URL.
   * Validates: Requirements 2.3
   */
  it('Property 6: Valid URLs should return preview with title and original URL', async () => {
    await fc.assert(
      fc.asyncProperty(validDomainUrlArbitrary, async (url) => {
        const result = await mediaService.parseUrl(url);
        
        // Property: Preview must contain title (possibly empty) and original URL
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('url');
        expect(result.url).toBe(url);
        expect(typeof result.title).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (structure): Preview should have all required fields
   * Validates: Requirements 2.3
   */
  it('Property 6: URL preview should have complete structure', async () => {
    await fc.assert(
      fc.asyncProperty(validDomainUrlArbitrary, async (url) => {
        const result = await mediaService.parseUrl(url);
        
        // Property: Preview must have all required fields
        expect(result).toHaveProperty('url');
        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('thumbnailUrl');
        expect(result).toHaveProperty('siteName');
        expect(result).toHaveProperty('type');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (invalid URLs): Invalid URLs should throw error
   * Validates: Requirements 2.3
   */
  it('Property 6: Invalid URLs should throw error', async () => {
    await fc.assert(
      fc.asyncProperty(invalidUrlArbitrary, async (url) => {
        // Property: Invalid URLs must throw
        await expect(mediaService.parseUrl(url)).rejects.toThrow('Could not fetch preview for this URL.');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6 (siteName extraction): siteName should be extracted from hostname
   * Validates: Requirements 2.3
   */
  it('Property 6: siteName should be extracted from URL hostname', async () => {
    await fc.assert(
      fc.asyncProperty(validDomainUrlArbitrary, async (url) => {
        const result = await mediaService.parseUrl(url);
        const parsedUrl = new URL(url);
        
        // Property: siteName should match the hostname
        expect(result.siteName).toBe(parsedUrl.hostname);
      }),
      { numRuns: 100 }
    );
  });
});
