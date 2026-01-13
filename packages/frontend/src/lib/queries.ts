import { queryOptions, keepPreviousData, infiniteQueryOptions } from '@tanstack/react-query';
import type {
  Debate,
  User,
  Round,
  Argument,
  Stance,
  Comment,
  MarketPrice,
  MarketDataPoint,
  StanceSpike,
  ReactionCounts,
  PersuasionDelta,
} from '@debate-platform/shared';
import { CACHE_STRATEGIES } from './cacheStrategies';

// API base URL - uses proxy in development
const API_BASE = '';

// ============================================================================
// Typed API Error Class
// TanStack Query v5 Best Practice: Structured error handling with typed errors
// ============================================================================

/**
 * API error codes for structured error handling
 */
export type ApiErrorCode = 
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

/**
 * Typed API Error class for structured error handling
 * Allows components to handle different error types appropriately
 */
export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;

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
  }

  /**
   * Check if error is retryable (network issues, server errors)
   */
  get isRetryable(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'SERVER_ERROR';
  }

  /**
   * Check if error requires authentication
   */
  get requiresAuth(): boolean {
    return this.code === 'UNAUTHORIZED';
  }

  /**
   * Create ApiError from HTTP response
   */
  static fromResponse(status: number, errorBody?: { error?: string; details?: Record<string, unknown> }): ApiError {
    const message = errorBody?.error || `API Error: ${status}`;
    const details = errorBody?.details;

    switch (status) {
      case 401:
        return new ApiError(message, 'UNAUTHORIZED', status, details);
      case 403:
        return new ApiError(message, 'FORBIDDEN', status, details);
      case 404:
        return new ApiError(message, 'NOT_FOUND', status, details);
      case 422:
        return new ApiError(message, 'VALIDATION_ERROR', status, details);
      case 429:
        return new ApiError(message, 'RATE_LIMITED', status, details);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ApiError(message, 'SERVER_ERROR', status, details);
      default:
        return new ApiError(message, 'UNKNOWN', status, details);
    }
  }

  /**
   * Create ApiError from network failure
   */
  static networkError(originalError?: Error): ApiError {
    return new ApiError(
      originalError?.message || 'Network request failed',
      'NETWORK_ERROR',
      0,
      { originalError: originalError?.message }
    );
  }
}

// ============================================================================
// Query Key Factories (TanStack Best Practice)
// https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
// ============================================================================

export const queryKeys = {
  // Debates
  debates: {
    all: ['debates'] as const,
    lists: () => [...queryKeys.debates.all, 'list'] as const,
    withMarket: () => [...queryKeys.debates.all, 'withMarket'] as const,
    detail: (id: string) => [...queryKeys.debates.all, 'detail', id] as const,
    full: (id: string) => [...queryKeys.debates.all, 'full', id] as const,
  },
  // Market
  market: {
    byDebate: (debateId: string) => ['market', debateId] as const,
  },
  // Stances
  stances: {
    byDebate: (debateId: string) => ['stances', debateId] as const,
  },
  // Comments
  comments: {
    byDebate: (debateId: string) => ['comments', debateId] as const,
  },
  // Arguments
  arguments: {
    reactions: (argumentId: string) => ['arguments', argumentId, 'reactions'] as const,
  },
  // Users
  users: {
    current: () => ['users', 'current'] as const,
    detail: (id: string) => ['users', id] as const,
    stats: (id: string) => ['users', id, 'stats'] as const,
    debates: (id: string) => ['users', id, 'debates'] as const,
  },
  // Leaderboard
  leaderboard: {
    arguments: () => ['leaderboard', 'arguments'] as const,
    users: () => ['leaderboard', 'users'] as const,
  },
  // Stance Stats (public)
  stanceStats: {
    byDebate: (debateId: string) => ['stanceStats', debateId] as const,
  },
  // Steelman Gate
  steelman: {
    status: (debateId: string, round: number) => ['steelman', debateId, 'status', round] as const,
    pending: (debateId: string) => ['steelman', debateId, 'pending'] as const,
  },
  // Health
  health: ['health'] as const,
} as const;

/**
 * Fetch wrapper with structured error handling using ApiError
 * TanStack Query v5 Best Practice: Typed errors for better error handling in components
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  let response: Response;
  
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (error) {
    // Network error (no response)
    throw ApiError.networkError(error instanceof Error ? error : undefined);
  }
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw ApiError.fromResponse(response.status, errorBody);
  }
  
  return response.json();
}

/**
 * Get auth header from Stack Auth token
 */
function getAuthHeader(token?: string): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ============================================================================
// Debate Queries
// ============================================================================

interface DebatesResponse {
  debates: Debate[];
  includesMarket?: boolean;
}

interface DebatesWithMarketResponse {
  debates: Array<{ debate: Debate; marketPrice: MarketPrice | null }>;
  includesMarket: true;
}

/**
 * Query options for fetching all debates (without market data)
 * Uses 'standard' cache strategy for list views
 */
export const debatesQueryOptions = queryOptions({
  queryKey: queryKeys.debates.lists(),
  queryFn: async (): Promise<Debate[]> => {
    const response = await fetchApi<DebatesResponse>('/api/debates');
    return response.debates;
  },
  ...CACHE_STRATEGIES.standard,
  placeholderData: keepPreviousData,
});

/**
 * Query options for fetching all debates WITH market data in a single request.
 * Eliminates N+1 queries on the index page.
 * Uses 'frequent' cache strategy since market data changes more often
 */
export const debatesWithMarketQueryOptions = queryOptions({
  queryKey: queryKeys.debates.withMarket(),
  queryFn: async (): Promise<Array<{ debate: Debate; marketPrice: MarketPrice | null }>> => {
    const response = await fetchApi<DebatesWithMarketResponse>('/api/debates?includeMarket=true');
    return response.debates;
  },
  ...CACHE_STRATEGIES.frequent,
  placeholderData: keepPreviousData,
  // Sort by most recent activity (active debates first, then by creation time)
  select: (data) => [...data].sort((a, b) => {
    // Active debates come first
    if (a.debate.status === 'active' && b.debate.status !== 'active') return -1;
    if (b.debate.status === 'active' && a.debate.status !== 'active') return 1;
    // Then sort by createdAt (most recent first)
    const aTime = new Date(a.debate.createdAt).getTime();
    const bTime = new Date(b.debate.createdAt).getTime();
    return bTime - aTime;
  }),
});

interface DebateDetailResponse {
  debate: Debate;
  rounds: (Round & {
    supportArgument: Argument | null;
    opposeArgument: Argument | null;
  })[];
  debaters?: {
    support: User | null;
    oppose: User | null;
  };
  market?: {
    marketPrice: MarketPrice;
    history: MarketDataPoint[];
    spikes: StanceSpike[];
  } | null;
  marketBlocked?: boolean;
}

/**
 * Query options for fetching a single debate by ID with rounds and arguments
 * Uses 'standard' cache strategy for detail views
 * @deprecated Use debateFullQueryOptions for comprehensive data fetching
 */
export const debateQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.debates.detail(debateId),
    queryFn: async (): Promise<Debate | null> => {
      if (!debateId) return null;
      try {
        const response = await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
        return response.debate;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.standard,
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate details with rounds
 * Uses 'frequent' cache strategy for active debate content
 * @deprecated Use debateFullQueryOptions for comprehensive data fetching
 */
export const debateDetailQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: [...queryKeys.debates.detail(debateId), 'rounds'] as const,
    queryFn: async (): Promise<DebateDetailResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate with ALL related data in a single request.
 * Includes: debate, rounds, arguments, debater profiles, and market data.
 * This eliminates multiple round-trips on the debate detail page.
 * Uses 'frequent' cache strategy for active debate content
 *
 * TanStack Query v5 Best Practice: Auth state included in query key to prevent
 * cache collision between authenticated and anonymous users when response varies.
 */
export const debateFullQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    // Include auth flag in key since response may vary (e.g., marketBlocked for non-auth)
    queryKey: [...queryKeys.debates.full(debateId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<DebateDetailResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<DebateDetailResponse>(
          `/api/debates/${debateId}?includeDebaters=true&includeMarket=true`,
          { headers: getAuthHeader(token) }
        );
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
    placeholderData: keepPreviousData,
  });

// ============================================================================
// Market Queries
// ============================================================================

interface MarketResponse {
  marketPrice: MarketPrice;
  history: MarketDataPoint[];
  spikes: StanceSpike[];
}

/**
 * Query options for fetching market data for a debate
 * Uses 'realtime' cache strategy for live market data
 * TanStack Query v5 Best Practice: Auth state included in query key
 */
export const marketQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: [...queryKeys.market.byDebate(debateId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<MarketResponse | null> => {
      if (!debateId) return null;
      try {
        return await fetchApi<MarketResponse>(`/api/debates/${debateId}/market`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.realtime,
    enabled: !!debateId,
  });

// ============================================================================
// Stance Queries
// ============================================================================

interface StanceResponse {
  stances: {
    pre: Stance | null;
    post: Stance | null;
  };
  delta: PersuasionDelta | null;
}

/**
 * Query options for fetching user's stances for a debate
 * Uses 'frequent' cache strategy for user-specific data
 */
export const userStanceQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.stances.byDebate(debateId),
    queryFn: async (): Promise<StanceResponse | null> => {
      if (!token || !debateId) return null;
      try {
        return await fetchApi<StanceResponse>(`/api/debates/${debateId}/stance`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId && !!token,
  });

// ============================================================================
// Comment Queries
// ============================================================================

interface CommentsResponse {
  comments: Comment[];
}

/**
 * Query options for fetching comments for a debate
 * Uses 'frequent' cache strategy for user-generated content
 */
export const commentsQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.comments.byDebate(debateId),
    queryFn: async (): Promise<Comment[]> => {
      if (!debateId) return [];
      const response = await fetchApi<CommentsResponse>(`/api/debates/${debateId}/comments`);
      return response.comments;
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
    // Sort comments by creation time (oldest first for natural reading order)
    select: (data) => [...data].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    }),
  });

/**
 * Paginated response for infinite comments
 */
interface PaginatedCommentsResponse {
  comments: Comment[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

/**
 * Infinite query options for fetching paginated comments.
 * TanStack Query v5 Best Practice: Use infiniteQueryOptions for paginated data.
 * 
 * This enables "load more" functionality for debates with many comments.
 * Uses cursor-based pagination for efficient loading.
 * 
 * @param debateId - The debate ID to fetch comments for
 * @param pageSize - Number of comments per page (default: 20)
 */
export const commentsInfiniteQueryOptions = (debateId: string, pageSize: number = 20) =>
  infiniteQueryOptions({
    queryKey: [...queryKeys.comments.byDebate(debateId), 'infinite'] as const,
    queryFn: async ({ pageParam }): Promise<PaginatedCommentsResponse> => {
      if (!debateId) {
        return { comments: [], nextCursor: null, hasMore: false, totalCount: 0 };
      }
      
      const params = new URLSearchParams({
        limit: String(pageSize),
      });
      
      if (pageParam) {
        params.set('cursor', pageParam);
      }
      
      try {
        const response = await fetchApi<PaginatedCommentsResponse>(
          `/api/debates/${debateId}/comments?${params.toString()}`
        );
        return response;
      } catch {
        // Fallback for non-paginated API - return all comments as first page
        const response = await fetchApi<CommentsResponse>(
          `/api/debates/${debateId}/comments`
        );
        return {
          comments: response.comments,
          nextCursor: null,
          hasMore: false,
          totalCount: response.comments.length,
        };
      }
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });

// ============================================================================
// Reaction Queries
// ============================================================================

interface ReactionsResponse {
  counts: ReactionCounts;
  userReactions: {
    agree: boolean;
    strongReasoning: boolean;
  } | null;
}

/**
 * Query options for fetching reactions for an argument
 * Uses 'frequent' cache strategy for interactive content
 * TanStack Query v5 Best Practice: Auth state included since userReactions varies by user
 */
export const reactionsQueryOptions = (argumentId: string, token?: string) =>
  queryOptions({
    queryKey: [...queryKeys.arguments.reactions(argumentId), token ? 'auth' : 'anon'] as const,
    queryFn: async (): Promise<ReactionsResponse> => {
      return await fetchApi<ReactionsResponse>(`/api/arguments/${argumentId}/reactions`, {
        headers: getAuthHeader(token),
      });
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!argumentId,
  });

// ============================================================================
// User Queries
// ============================================================================

interface CurrentUserResponse {
  user: User;
  stats: {
    totalDebates: number;
    debatesAsSupport: number;
    debatesAsOppose: number;
    totalVotes: number;
    averageDelta: number;
  };
}

/**
 * Query options for fetching current user profile
 * Uses 'static' cache strategy for user profile data
 */
export const currentUserQueryOptions = (token?: string) =>
  queryOptions({
    queryKey: queryKeys.users.current(),
    queryFn: async (): Promise<CurrentUserResponse | null> => {
      if (!token) return null;
      try {
        return await fetchApi<CurrentUserResponse>('/api/users/me', {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!token,
  });

interface UserResponse {
  user: User;
}

/**
 * Query options for fetching user by ID
 * Uses 'static' cache strategy for user profile data
 */
export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.detail(userId),
    queryFn: async (): Promise<User | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<UserResponse>(`/api/users/${userId}`);
        return response.user;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });

interface UserStatsResponse {
  stats: {
    totalDebates: number;
    debatesAsSupport: number;
    debatesAsOppose: number;
    totalVotes: number;
    averageDelta: number;
  };
}

/**
 * Query options for fetching user statistics
 * Uses 'static' cache strategy for user stats
 */
export const userStatsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.stats(userId),
    queryFn: async (): Promise<UserStatsResponse['stats'] | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<UserStatsResponse>(`/api/users/${userId}/stats`);
        return response.stats;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });

interface UserDebatesResponse {
  debates: Debate[];
}

/**
 * Query options for fetching user's debate history
 * Uses 'static' cache strategy for user history
 */
export const userDebatesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.users.debates(userId),
    queryFn: async (): Promise<Debate[]> => {
      if (!userId) return [];
      try {
        const response = await fetchApi<UserDebatesResponse>(`/api/users/${userId}/debates`);
        return response.debates;
      } catch {
        return [];
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
    placeholderData: keepPreviousData,
    // Sort by most recent participation
    select: (data) => [...data].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    }),
  });

// ============================================================================
// Health Check
// ============================================================================

/**
 * Query options for API health check
 * Uses 'frequent' cache strategy for health monitoring
 */
export const healthCheckQueryOptions = queryOptions({
  queryKey: queryKeys.health,
  queryFn: async () => {
    return fetchApi<{ status: string }>('/api/health');
  },
  ...CACHE_STRATEGIES.frequent,
});

// ============================================================================
// Leaderboard Queries (Public)
// ============================================================================

export interface TopArgument {
  id: string;
  content: string;
  side: 'support' | 'oppose';
  impactScore: number;
  debateId: string;
  resolution: string;
  authorUsername: string;
}

/**
 * Query options for fetching top persuasive arguments
 * Uses 'static' cache strategy for leaderboard data
 */
export const leaderboardQueryOptions = (limit: number = 10) =>
  queryOptions({
    queryKey: queryKeys.leaderboard.arguments(),
    queryFn: async (): Promise<TopArgument[]> => {
      const response = await fetchApi<{ arguments: TopArgument[] }>(`/api/leaderboard/arguments?limit=${limit}`);
      return response.arguments;
    },
    ...CACHE_STRATEGIES.static,
  });

// ============================================================================
// Top Users Leaderboard Queries (Public)
// ============================================================================

export interface TopUser {
  id: string;
  username: string;
  reputationScore: number;
  predictionAccuracy: number;
  debatesParticipated: number;
  sandboxCompleted: boolean;
  totalImpact?: number;
}

/**
 * Query options for fetching top users by reputation
 * Uses 'stable' cache strategy for rarely changing leaderboard
 */
export const topUsersQueryOptions = (limit: number = 10) =>
  queryOptions({
    queryKey: queryKeys.leaderboard.users(),
    queryFn: async (): Promise<TopUser[]> => {
      const response = await fetchApi<{ users: TopUser[] }>(`/api/leaderboard/users?limit=${limit}`);
      return response.users;
    },
    ...CACHE_STRATEGIES.stable,
  });

// ============================================================================
// Stance Stats Queries (Public - for spectators)
// ============================================================================

export interface StanceStats {
  totalVoters: number;
  avgPreStance: number;
  avgPostStance: number;
  avgDelta: number;
  mindChangedCount: number;
}

/**
 * Query options for fetching aggregate stance stats (public)
 * Uses 'frequent' cache strategy for live stats
 */
export const stanceStatsQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: queryKeys.stanceStats.byDebate(debateId),
    queryFn: async (): Promise<StanceStats> => {
      return fetchApi<StanceStats>(`/api/debates/${debateId}/stance-stats`);
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId,
  });


// ============================================================================
// Steelman Gate Queries
// ============================================================================

export interface SteelmanStatus {
  canSubmit: boolean;
  reason?: string;
  requiresSteelman: boolean;
  steelmanStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  steelman?: {
    id: string;
    content: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason: string | null;
  } | null;
}

export interface PendingSteelman {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  authorId: string;
  targetArgumentId: string;
  content: string;
  status: 'pending';
  createdAt: string;
}

/**
 * Query options for checking steelman gate status
 * Uses 'frequent' cache strategy for gate status checks
 */
export const steelmanStatusQueryOptions = (debateId: string, roundNumber: number, token?: string) =>
  queryOptions({
    queryKey: queryKeys.steelman.status(debateId, roundNumber),
    queryFn: async (): Promise<SteelmanStatus> => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetchApi<SteelmanStatus>(
        `/api/debates/${debateId}/steelman/status?round=${roundNumber}`,
        { headers }
      );
    },
    ...CACHE_STRATEGIES.frequent,
    enabled: !!debateId && !!token && roundNumber > 1,
  });

/**
 * Query options for fetching pending steelmans to review
 * Uses 'realtime' cache strategy for pending reviews
 */
export const pendingSteelmansQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.steelman.pending(debateId),
    queryFn: async (): Promise<PendingSteelman[]> => {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetchApi<{ pending: PendingSteelman[] }>(
        `/api/debates/${debateId}/steelman/pending`,
        { headers }
      );
      return response.pending;
    },
    ...CACHE_STRATEGIES.realtime,
    enabled: !!debateId && !!token,
  });
