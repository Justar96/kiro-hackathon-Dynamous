import { queryOptions, keepPreviousData } from '@tanstack/react-query';
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
  // Health
  health: ['health'] as const,
} as const;

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
  includesMarket?: boolean;
}

interface DebatesWithMarketResponse {
  debates: Array<{ debate: Debate; marketPrice: MarketPrice | null }>;
  includesMarket: true;
}

/**
 * Query options for fetching all debates (without market data)
 */
export const debatesQueryOptions = queryOptions({
  queryKey: queryKeys.debates.lists(),
  queryFn: async (): Promise<Debate[]> => {
    const response = await fetchApi<DebatesResponse>('/api/debates');
    return response.debates;
  },
  staleTime: 1000 * 60 * 2, // 2 minutes
  gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
  placeholderData: keepPreviousData, // Keep previous data while refetching
});

/**
 * Query options for fetching all debates WITH market data in a single request.
 * Eliminates N+1 queries on the index page.
 */
export const debatesWithMarketQueryOptions = queryOptions({
  queryKey: queryKeys.debates.withMarket(),
  queryFn: async (): Promise<Array<{ debate: Debate; marketPrice: MarketPrice | null }>> => {
    const response = await fetchApi<DebatesWithMarketResponse>('/api/debates?includeMarket=true');
    return response.debates;
  },
  staleTime: 1000 * 60, // 1 minute (was 30 sec - too aggressive for list page)
  gcTime: 1000 * 60 * 5, // 5 minutes garbage collection
  placeholderData: keepPreviousData, // Smooth transitions
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
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate details with rounds
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
    staleTime: 1000 * 60, // 1 minute (was 30 sec)
    enabled: !!debateId,
  });

/**
 * Query options for fetching debate with ALL related data in a single request.
 * Includes: debate, rounds, arguments, debater profiles, and market data.
 * This eliminates multiple round-trips on the debate detail page.
 *
 * Note: Token is passed via headers, not query key - prevents cache fragmentation
 */
export const debateFullQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.debates.full(debateId),
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
    staleTime: 1000 * 30, // 30 seconds (was 15 sec - too aggressive)
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
 */
export const marketQueryOptions = (debateId: string, token?: string) =>
  queryOptions({
    queryKey: queryKeys.market.byDebate(debateId),
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
    queryKey: queryKeys.comments.byDebate(debateId),
    queryFn: async (): Promise<Comment[]> => {
      if (!debateId) return [];
      const response = await fetchApi<CommentsResponse>(`/api/debates/${debateId}/comments`);
      return response.comments;
    },
    staleTime: 1000 * 30, // 30 seconds
    enabled: !!debateId,
    // Sort comments by creation time (oldest first for natural reading order)
    select: (data) => [...data].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    }),
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
    queryKey: queryKeys.arguments.reactions(argumentId),
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
    staleTime: 1000 * 60 * 5, // 5 minutes
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
 */
export const healthCheckQueryOptions = queryOptions({
  queryKey: queryKeys.health,
  queryFn: async () => {
    return fetchApi<{ status: string }>('/api/health');
  },
  staleTime: 1000 * 30, // 30 seconds
  gcTime: 1000 * 60, // 1 minute
});
