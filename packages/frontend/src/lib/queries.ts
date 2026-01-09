import { queryOptions } from '@tanstack/react-query';
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

// API base URL - uses proxy in development
const API_BASE = '';

/**
 * Fetch wrapper with basic error handling
 */
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
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
}

/**
 * Query options for fetching all debates
 */
export const debatesQueryOptions = queryOptions({
  queryKey: ['debates'] as const,
  queryFn: async (): Promise<Debate[]> => {
    const response = await fetchApi<DebatesResponse>('/api/debates');
    return response.debates;
  },
  staleTime: 1000 * 60 * 2, // 2 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
});

interface DebateDetailResponse {
  debate: Debate;
  rounds: (Round & {
    supportArgument: Argument | null;
    opposeArgument: Argument | null;
  })[];
}

/**
 * Query options for fetching a single debate by ID with rounds and arguments
 */
export const debateQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: ['debate', debateId] as const,
    queryFn: async (): Promise<Debate | null> => {
      try {
        const response = await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
        return response.debate;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate details with rounds
 */
export const debateDetailQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: ['debate', debateId, 'detail'] as const,
    queryFn: async (): Promise<DebateDetailResponse | null> => {
      try {
        return await fetchApi<DebateDetailResponse>(`/api/debates/${debateId}`);
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 30, // 30 seconds for more frequent updates
    enabled: !!debateId,
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
 */
export const marketQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: ['debate', debateId, 'market'] as const,
    queryFn: async (): Promise<MarketResponse | null> => {
      try {
        return await fetchApi<MarketResponse>(`/api/debates/${debateId}/market`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 15, // 15 seconds for real-time feel
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
 */
export const userStanceQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: ['debate', debateId, 'stance'] as const,
    queryFn: async (): Promise<StanceResponse | null> => {
      if (!token) return null;
      try {
        return await fetchApi<StanceResponse>(`/api/debates/${debateId}/stance`, {
          headers: getAuthHeader(token),
        });
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60, // 1 minute
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
 */
export const commentsQueryOptions = (debateId: string) =>
  queryOptions({
    queryKey: ['debate', debateId, 'comments'] as const,
    queryFn: async (): Promise<Comment[]> => {
      const response = await fetchApi<CommentsResponse>(`/api/debates/${debateId}/comments`);
      return response.comments;
    },
    staleTime: 1000 * 30, // 30 seconds
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
 */
export const reactionsQueryOptions = (argumentId: string, token?: string) =>
  queryOptions({
    queryKey: ['argument', argumentId, 'reactions'] as const,
    queryFn: async (): Promise<ReactionsResponse> => {
      return await fetchApi<ReactionsResponse>(`/api/arguments/${argumentId}/reactions`, {
        headers: getAuthHeader(token),
      });
    },
    staleTime: 1000 * 30, // 30 seconds
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
 */
export const currentUserQueryOptions = (token?: string) =>
  queryOptions({
    queryKey: ['currentUser'] as const,
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
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!token,
  });

interface UserResponse {
  user: User;
}

/**
 * Query options for fetching user by ID
 */
export const userQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['user', userId] as const,
    queryFn: async (): Promise<User | null> => {
      try {
        const response = await fetchApi<UserResponse>(`/api/users/${userId}`);
        return response.user;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
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
 */
export const userStatsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['user', userId, 'stats'] as const,
    queryFn: async (): Promise<UserStatsResponse['stats'] | null> => {
      try {
        const response = await fetchApi<UserStatsResponse>(`/api/users/${userId}/stats`);
        return response.stats;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!userId,
  });

interface UserDebatesResponse {
  debates: Debate[];
}

/**
 * Query options for fetching user's debate history
 */
export const userDebatesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['user', userId, 'debates'] as const,
    queryFn: async (): Promise<Debate[]> => {
      try {
        const response = await fetchApi<UserDebatesResponse>(`/api/users/${userId}/debates`);
        return response.debates;
      } catch {
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!userId,
  });

// ============================================================================
// Health Check
// ============================================================================

/**
 * Query options for API health check
 */
export const healthCheckQueryOptions = queryOptions({
  queryKey: ['health'] as const,
  queryFn: async () => {
    return fetchApi<{ status: string }>('/api/health');
  },
  staleTime: 1000 * 30, // 30 seconds
});
