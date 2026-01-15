/**
 * API Client Module
 * 
 * Centralized API client with structured error handling and auth helpers.
 * This is the foundation for all API communication.
 * 
 * TanStack Query v5 Best Practices:
 * - Typed errors for better error handling in components
 * - Consistent auth header handling
 * - Request cancellation support via AbortController
 * - Interceptor pattern for cross-cutting concerns
 * 
 * @module api/client
 */

// ============================================================================
// Configuration
// ============================================================================

/** API base URL - uses proxy in development */
export const API_BASE = '';

/** Default timeout for API requests (30 seconds) */
export const DEFAULT_TIMEOUT = 30_000;

// ============================================================================
// API Error Types
// ============================================================================

/**
 * API error codes for structured error handling.
 * Use these codes to determine appropriate UI responses.
 */
export type ApiErrorCode = 
  | 'NETWORK_ERROR'    // Network failure, no response received
  | 'TIMEOUT'          // Request timed out
  | 'ABORTED'          // Request was cancelled
  | 'UNAUTHORIZED'     // 401 - Auth required or token expired
  | 'FORBIDDEN'        // 403 - Insufficient permissions
  | 'NOT_FOUND'        // 404 - Resource doesn't exist
  | 'VALIDATION_ERROR' // 422 - Invalid input data
  | 'CONFLICT'         // 409 - Resource conflict (e.g., duplicate)
  | 'RATE_LIMITED'     // 429 - Too many requests
  | 'SERVER_ERROR'     // 5xx - Server-side error
  | 'UNKNOWN';         // Unexpected error

/**
 * Error response body structure from the API.
 */
interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: Record<string, unknown>;
  code?: string;
}

/**
 * Typed API Error class for structured error handling.
 * Enables components to handle different error types appropriately.
 * 
 * @example
 * ```typescript
 * try {
 *   await fetchApi('/api/debates');
 * } catch (error) {
 *   if (error instanceof ApiError) {
 *     if (error.requiresAuth) {
 *       // Redirect to login
 *     } else if (error.isRetryable) {
 *       // Show retry button
 *     }
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ApiErrorCode,
    status: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.timestamp = new Date();
    
    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /** Check if error is retryable (network issues, server errors, timeouts) */
  get isRetryable(): boolean {
    return (
      this.code === 'NETWORK_ERROR' || 
      this.code === 'SERVER_ERROR' || 
      this.code === 'TIMEOUT'
    );
  }

  /** Check if error requires authentication */
  get requiresAuth(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  /** Check if request was cancelled (user navigation, component unmount) */
  get wasCancelled(): boolean {
    return this.code === 'ABORTED';
  }

  /** Check if it's a client-side validation error */
  get isValidationError(): boolean {
    return this.code === 'VALIDATION_ERROR';
  }

  /** Get user-friendly error message */
  get userMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'Unable to connect. Please check your internet connection.';
      case 'TIMEOUT':
        return 'Request timed out. Please try again.';
      case 'ABORTED':
        return 'Request was cancelled.';
      case 'UNAUTHORIZED':
        return 'Please sign in to continue.';
      case 'FORBIDDEN':
        return 'You don\'t have permission to perform this action.';
      case 'NOT_FOUND':
        return 'The requested resource was not found.';
      case 'VALIDATION_ERROR':
        return this.message || 'Please check your input and try again.';
      case 'CONFLICT':
        return 'A conflict occurred. The resource may have been modified.';
      case 'RATE_LIMITED':
        return 'Too many requests. Please wait a moment and try again.';
      case 'SERVER_ERROR':
        return 'Something went wrong on our end. Please try again later.';
      default:
        return this.message || 'An unexpected error occurred.';
    }
  }

  /** Create ApiError from HTTP response status and body */
  static fromResponse(status: number, errorBody?: ApiErrorBody): ApiError {
    const message = errorBody?.error || errorBody?.message || `API Error: ${status}`;
    const details = errorBody?.details;

    const statusToCode: Record<number, ApiErrorCode> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
    };

    // Check for specific status codes
    if (statusToCode[status]) {
      return new ApiError(message, statusToCode[status], status, details);
    }

    // Server errors (5xx)
    if (status >= 500 && status < 600) {
      return new ApiError(message, 'SERVER_ERROR', status, details);
    }

    return new ApiError(message, 'UNKNOWN', status, details);
  }

  /** Create ApiError from network failure */
  static networkError(originalError?: Error): ApiError {
    return new ApiError(
      originalError?.message || 'Network request failed',
      'NETWORK_ERROR',
      0,
      { originalError: originalError?.message }
    );
  }

  /** Create ApiError from timeout */
  static timeoutError(timeoutMs: number): ApiError {
    return new ApiError(
      `Request timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      0,
      { timeout: timeoutMs }
    );
  }

  /** Create ApiError from abort signal */
  static abortedError(): ApiError {
    return new ApiError('Request was aborted', 'ABORTED', 0);
  }

  /** Type guard to check if an error is an ApiError */
  static isApiError(error: unknown): error is ApiError {
    return error instanceof ApiError;
  }
}

// ============================================================================
// Request Configuration Types
// ============================================================================

/**
 * Extended request options for API calls.
 */
export interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Skip JSON parsing of response (for non-JSON endpoints) */
  skipJsonParse?: boolean;
}

/**
 * Mutation request options.
 */
export interface MutateApiOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** AbortSignal for request cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// Internal Helpers
// ============================================================================

/** Merge headers safely (supports Headers, arrays, and objects). */
function mergeHeaders(
  base: HeadersInit,
  extra?: HeadersInit
): Headers {
  const headers = new Headers(base);
  if (extra) {
    new Headers(extra).forEach((value, key) => headers.set(key, value));
  }
  return headers;
}

/** Parse a response body safely into JSON or text, without double-reading. */
async function parseResponseBody<T>(
  response: Response,
  skipJsonParse?: boolean
): Promise<T> {
  if (response.status === 204 || skipJsonParse) {
    return undefined as T;
  }

  const text = await response.text().catch(() => '');
  if (!text) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Fall through to return raw text
    }
  }

  return text as unknown as T;
}

/** Parse error response body safely into a standard shape. */
async function parseErrorBody(response: Response): Promise<ApiErrorBody> {
  const text = await response.text().catch(() => '');
  if (!text) {
    return { error: response.statusText };
  }

  try {
    return JSON.parse(text) as ApiErrorBody;
  } catch {
    return { error: text };
  }
}

// ============================================================================
// API Fetch Utilities
// ============================================================================

/**
 * Fetch wrapper with structured error handling, timeout support, and cancellation.
 * 
 * TanStack Query v5 Best Practice: 
 * - Typed errors for better error handling in components
 * - Supports AbortController for query cancellation
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const data = await fetchApi<DebatesResponse>('/api/debates');
 * 
 * // With auth header
 * const data = await fetchApi<UserResponse>('/api/user', {
 *   headers: getAuthHeader(token)
 * });
 * 
 * // With timeout and cancellation
 * const controller = new AbortController();
 * const data = await fetchApi<Debate>('/api/debates/123', {
 *   signal: controller.signal,
 *   timeout: 10000
 * });
 * ```
 */
export async function fetchApi<T>(
  endpoint: string, 
  options?: FetchApiOptions
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, skipJsonParse = false, ...fetchOptions } = options || {};
  
  // Create timeout controller if no signal provided
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
  
  // Combine signals if external signal is provided
  const signal = options?.signal 
    ? combineAbortSignals(options.signal, timeoutController.signal)
    : timeoutController.signal;

  let response: Response;
  
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      signal,
      headers: mergeHeaders(
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        fetchOptions.headers
      ),
    });
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      // Check if it was our timeout or external cancellation
      if (timeoutController.signal.aborted && !options?.signal?.aborted) {
        throw ApiError.timeoutError(timeout);
      }
      throw ApiError.abortedError();
    }
    
    // Network error (no response)
    throw ApiError.networkError(error instanceof Error ? error : undefined);
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw ApiError.fromResponse(response.status, errorBody);
  }

  return parseResponseBody<T>(response, skipJsonParse);
}

/**
 * Fetch wrapper for mutations with consistent error handling.
 * Uses the same ApiError class as fetchApi for consistency.
 * 
 * @example
 * ```typescript
 * // Create a debate
 * const debate = await mutateApi<CreateDebateResponse>(
 *   '/api/debates',
 *   'POST',
 *   { resolution: 'AI will replace most jobs' },
 *   token
 * );
 * 
 * // Delete with cancellation support
 * const result = await mutateApi<void>(
 *   '/api/debates/123',
 *   'DELETE',
 *   undefined,
 *   token,
 *   { signal: controller.signal }
 * );
 * ```
 */
export async function mutateApi<T, TInput = unknown>(
  endpoint: string, 
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: TInput,
  token?: string,
  options?: MutateApiOptions
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, signal: externalSignal } = options || {};
  
  // Create timeout controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeout);
  
  // Combine signals if external signal is provided
  const signal = externalSignal 
    ? combineAbortSignals(externalSignal, timeoutController.signal)
    : timeoutController.signal;

  const headers = mergeHeaders(
    {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    token ? getAuthHeader(token) : undefined
  );

  let response: Response;
  
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/cancellation
    if (error instanceof Error && error.name === 'AbortError') {
      if (timeoutController.signal.aborted && !externalSignal?.aborted) {
        throw ApiError.timeoutError(timeout);
      }
      throw ApiError.abortedError();
    }
    
    // Network error
    throw ApiError.networkError(error instanceof Error ? error : undefined);
  } finally {
    clearTimeout(timeoutId);
  }
  
  if (!response.ok) {
    const errorBody = await parseErrorBody(response);
    throw ApiError.fromResponse(response.status, errorBody);
  }

  return parseResponseBody<T>(response);
}

// ============================================================================
// Auth Utilities
// ============================================================================

/**
 * Get authorization header from token.
 * Returns empty object if no token provided for easy spreading.
 * 
 * @example
 * ```typescript
 * const data = await fetchApi('/api/user', {
 *   headers: getAuthHeader(token)
 * });
 * ```
 */
export function getAuthHeader(token?: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Require an auth token for protected operations.
 * Throws ApiError with UNAUTHORIZED to keep error handling consistent.
 */
export function requireAuthToken(token?: string | null): string {
  if (!token) {
    throw new ApiError('Authentication required', 'UNAUTHORIZED', 401);
  }
  return token;
}

/**
 * Check if a token appears to be expired (basic JWT check).
 * Note: This is a client-side heuristic; server validates the actual token.
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    if (!exp) return false;
    // Add 30 second buffer for clock skew
    return Date.now() >= (exp * 1000) - 30000;
  } catch {
    return false;
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Combine multiple AbortSignals into one.
 * The resulting signal will abort when any of the input signals abort.
 */
function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  
  return controller.signal;
}

/**
 * Create an abort controller with timeout.
 * Useful for creating cancellable requests with automatic timeout.
 * 
 * @example
 * ```typescript
 * const { signal, cancel } = createAbortControllerWithTimeout(5000);
 * try {
 *   await fetchApi('/api/slow-endpoint', { signal });
 * } catch (e) {
 *   if (ApiError.isApiError(e) && e.code === 'TIMEOUT') {
 *     console.log('Request timed out');
 *   }
 * }
 * // Or manually cancel
 * cancel();
 * ```
 */
export function createAbortControllerWithTimeout(timeoutMs: number): {
  signal: AbortSignal;
  cancel: () => void;
  controller: AbortController;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  return {
    signal: controller.signal,
    cancel: () => {
      clearTimeout(timeoutId);
      controller.abort();
    },
    controller,
  };
}
