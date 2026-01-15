import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState, useMemo, useCallback } from 'react';
import { 
  debatesWithMarketQueryOptions,
  useQuickStance,
  useSession,
  useInfiniteDebates,
} from '../lib';
import { 
  SkeletonDebateRow, 
  SkeletonHeading, 
  SkeletonText, 
  MindChangeLeaderboard,
  DebateTabs,
  getPersistedTab,
  TrendingRail,
  InfiniteFeed,
  SeekingOpponentsSection,
  IndexThreeColumnLayout,
  useToast,
  useAuthModal,
  useNewDebateModal,
  PlusIcon,
  ChartIcon,
} from '../components';
import type { DebateTabType } from '../components';

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    const debatesWithMarket = await context.queryClient.ensureQueryData(
      debatesWithMarketQueryOptions
    );
    return { debatesWithMarket };
  },
  pendingComponent: HomePagePending,
  pendingMs: 200,
  component: HomePage,
  errorComponent: HomePageError,
});

function HomePage() {
  const { debatesWithMarket } = Route.useLoaderData();
  const { user } = useSession();
  const { showToast } = useToast();
  const { openSignIn } = useAuthModal();
  const isAuthenticated = !!user;
  
  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<DebateTabType>(() => {
    const persisted = getPersistedTab();
    // Reset to 'all' if user is not authenticated and tab requires auth
    if (persisted === 'my-debates' && !isAuthenticated) return 'all';
    return persisted;
  });

  // Track user stances locally for optimistic UI
  const [userStances, setUserStances] = useState<Record<string, number>>({});

  // Quick stance mutation using reusable hook from hooks.ts
  // TanStack Query v5: Replaces inline useMutation with centralized hook
  const quickStanceMutation = useQuickStance();

  // Handle quick stance from index
  const handleQuickStance = useCallback((debateId: string, side: 'support' | 'oppose') => {
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    quickStanceMutation.mutate(
      { debateId, side },
      {
        onSuccess: () => {
          // Update local state for optimistic UI
          setUserStances(prev => ({ ...prev, [debateId]: side === 'support' ? 75 : 25 }));
          showToast({ type: 'success', message: 'Position recorded!' });
        },
        onError: (error: Error) => {
          showToast({ type: 'error', message: error.message });
        },
      }
    );
  }, [isAuthenticated, openSignIn, quickStanceMutation, showToast]);

  // Filter debates based on active tab
  const filteredDebates = useMemo(() => {
    if (activeTab === 'my-debates' && user) {
      return debatesWithMarket.filter(d => 
        d.debate.supportDebaterId === user.id || 
        d.debate.opposeDebaterId === user.id
      );
    }
    return debatesWithMarket;
  }, [activeTab, debatesWithMarket, user]);

  // Count user's debates for tab badge
  const myDebatesCount = useMemo(() => {
    if (!user) return 0;
    return debatesWithMarket.filter(d => 
      d.debate.supportDebaterId === user.id || 
      d.debate.opposeDebaterId === user.id
    ).length;
  }, [debatesWithMarket, user]);

  // Mock sandbox data (would come from user profile in real app)
  const sandboxData = {
    debatesParticipated: myDebatesCount,
    sandboxCompleted: myDebatesCount >= 5,
  };

  return (
    <IndexThreeColumnLayout
      leftRail={
        <IndexLeftRail
          isAuthenticated={isAuthenticated}
          sandboxData={sandboxData}
          debates={debatesWithMarket}
          currentUserId={user?.id}
        />
      }
      centerContent={
        <IndexCenterContent
          filteredDebates={filteredDebates}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          myDebatesCount={myDebatesCount}
          isAuthenticated={isAuthenticated}
          userStances={userStances}
          onQuickStance={handleQuickStance}
        />
      }
      rightRail={
        <IndexRightRail debatesWithMarket={debatesWithMarket} />
      }
    />
  );
}

/**
 * Left Rail - Onboarding, Sandbox Progress, Seeking Opponents
 */
interface IndexLeftRailProps {
  isAuthenticated: boolean;
  sandboxData: {
    debatesParticipated: number;
    sandboxCompleted: boolean;
  };
  debates: ReturnType<typeof Route.useLoaderData>['debatesWithMarket'];
  currentUserId?: string;
}

function IndexLeftRail({ isAuthenticated, sandboxData, debates, currentUserId }: IndexLeftRailProps) {
  const { open: openNewDebate } = useNewDebateModal();
  
  return (
    <div className="space-y-4">
      {/* Quick Actions - Primary CTA */}
      <div className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper">
        <div className="px-4 py-3 border-b border-divider">
          <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
            <span className="text-accent">+</span>
            Quick Actions
          </h2>
        </div>
        <div className="p-3 space-y-2">
          <button 
            onClick={openNewDebate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-small hover:bg-accent-hover transition-colors shadow-paper"
          >
            <PlusIcon size="sm" decorative />
            Start a Debate
          </button>
          <Link 
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-accent hover:bg-page-bg rounded-small transition-colors"
          >
            <ChartIcon size="sm" decorative />
            Leaderboard
          </Link>
        </div>
      </div>

      {/* How It Works - Compact version */}
      <div className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper">
        <div className="px-4 py-3 border-b border-divider">
          <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
            <span className="text-accent">?</span>
            How It Works
          </h2>
        </div>
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">1</span>
            <span>Record your stance before reading</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">2</span>
            <span>Read structured arguments</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">3</span>
            <span>See if your mind changed</span>
          </div>
        </div>
      </div>

      {/* Seeking Opponents */}
      <SeekingOpponentsSection 
        debates={debates}
        currentUserId={currentUserId}
        maxCount={3}
      />

      {/* Sandbox progress for new users - compact */}
      {isAuthenticated && !sandboxData.sandboxCompleted && (
        <div className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper">
          <div className="px-4 py-3 border-b border-divider">
            <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
              <span className="text-support">◈</span>
              Your Progress
            </h2>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-secondary">Debates joined</span>
              <span className="font-semibold text-text-primary">{sandboxData.debatesParticipated}/5</span>
            </div>
            <div className="h-1.5 bg-page-bg rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-support/80 to-support rounded-full transition-all"
                style={{ width: `${Math.min(100, (sandboxData.debatesParticipated / 5) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-text-tertiary mt-2">Complete 5 debates to unlock full features</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Center Content - Header, Tabs, Infinite Feed
 * Requirements: All - Wire up new components
 */
interface IndexCenterContentProps {
  filteredDebates: ReturnType<typeof Route.useLoaderData>['debatesWithMarket'];
  activeTab: DebateTabType;
  onTabChange: (tab: DebateTabType) => void;
  myDebatesCount: number;
  isAuthenticated: boolean;
  userStances?: Record<string, number>;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
}

function IndexCenterContent({
  filteredDebates,
  activeTab,
  onTabChange,
  myDebatesCount,
  isAuthenticated,
  userStances = {},
  onQuickStance,
}: IndexCenterContentProps) {
  const { open: openNewDebate } = useNewDebateModal();
  
  // Use infinite debates hook for pagination
  // Requirements: 1.1, 1.2, 1.3 - Infinite scroll with cursor-based pagination
  // Note: 'watching' tab falls back to 'all' since infinite scroll doesn't support it yet
  const infiniteFilter = activeTab === 'watching' ? 'all' : activeTab;
  const {
    debates: infiniteDebates,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteDebates({
    filter: infiniteFilter,
  });

  // Use infinite debates if available, otherwise fall back to filtered debates
  const displayDebates = infiniteDebates.length > 0 ? infiniteDebates : filteredDebates;
  
  return (
    <div>
      {/* Header - Compact and prominent */}
      <header className="mb-4 flex items-baseline gap-3 border-b border-border-subtle pb-3">
        <h1 className="font-heading text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
          Debate Index
        </h1>
        <p className="text-xs text-text-tertiary hidden sm:block">
          Take a position • See what others think • Track mind changes
        </p>
      </header>

      {/* Trending section relocated to right rail - Requirements: 4.1 */}

      {/* Tabs */}
      <DebateTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        myDebatesCount={myDebatesCount}
        isAuthenticated={isAuthenticated}
      />

      {/* Infinite Feed - Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.4 */}
      <InfiniteFeed
        debates={displayDebates}
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isLoading}
        isError={isError}
        refetch={refetch}
        userStances={userStances}
        onQuickStance={onQuickStance}
        isAuthenticated={isAuthenticated}
      />

      {/* Mobile: New Debate CTA */}
      <div className="sm:hidden mt-4">
        <button
          onClick={openNewDebate}
          className="block w-full text-center px-4 py-3 bg-accent text-white text-body font-medium rounded-lg hover:bg-accent-hover transition-colors"
        >
          + Start a New Debate
        </button>
      </div>

      {/* Footer note */}
      <footer className="mt-10 pt-6 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          Track your stance before and after reading • See which arguments change minds
        </p>
      </footer>
    </div>
  );
}

/**
 * Right Rail - Trending, Most Persuasive, Platform Stats
 * Requirements: 4.1 - Relocate trending section to right rail
 */
interface IndexRightRailProps {
  debatesWithMarket: Array<{ debate: { status: string }; marketPrice: { mindChangeCount: number } | null }>;
}

function IndexRightRail({ debatesWithMarket }: IndexRightRailProps) {
  return (
    <div className="space-y-4">
      {/* Trending Rail - Requirements: 4.1, 4.2, 4.3, 4.4 */}
      <TrendingRail debates={debatesWithMarket as any} maxCount={5} />

      {/* Most Persuasive */}
      <div className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper">
        <div className="px-4 py-3 border-b border-divider">
          <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
            <span className="text-accent">★</span>
            Most Persuasive
          </h2>
        </div>
        <div className="p-3">
          <MindChangeLeaderboard limit={5} compact />
          <Link 
            to="/" 
            className="block mt-3 text-center text-xs text-accent hover:text-accent-hover font-medium"
          >
            View all rankings →
          </Link>
        </div>
      </div>

      {/* Platform stats */}
      <div className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper">
        <div className="px-4 py-3 border-b border-divider">
          <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
            <span className="text-text-tertiary">◈</span>
            Platform Stats
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Active debates</span>
            <span className="text-sm font-semibold text-text-primary">
              {debatesWithMarket.filter((d) => d.debate.status === 'active').length}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">Total debates</span>
            <span className="text-sm font-semibold text-text-primary">
              {debatesWithMarket.length}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-divider">
            <span className="text-sm text-text-secondary">Minds changed</span>
            <span className="text-sm font-bold text-accent">
              {debatesWithMarket.reduce((sum: number, d) => sum + (d.marketPrice?.mindChangeCount ?? 0), 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePagePending() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 sm:mb-10">
          <SkeletonHeading className="mb-3" width="12rem" />
          <SkeletonText lines={1} className="max-w-xs" />
        </header>

        <div className="bg-paper rounded-small border border-gray-100 shadow-paper">
          <div className="hidden sm:flex items-center gap-4 py-3 px-2 border-b border-gray-200 bg-page-bg/30">
            <div className="flex-1">
              <SkeletonText lines={1} width="5rem" height={12} />
            </div>
            <div className="w-16 flex-shrink-0">
              <SkeletonText lines={1} width="2rem" height={12} className="mx-auto" />
            </div>
            <div className="w-12 flex-shrink-0 hidden md:block">
              <SkeletonText lines={1} width="2.5rem" height={12} className="mx-auto" />
            </div>
            <div className="w-16 flex-shrink-0">
              <SkeletonText lines={1} width="3rem" height={12} className="ml-auto" />
            </div>
          </div>

          {[1, 2, 3, 4, 5].map((i) => (
            <SkeletonDebateRow key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePageError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center">
      <div className="bg-paper rounded-subtle shadow-sm p-8 text-center max-w-md mx-4">
        <h2 className="font-heading text-heading-2 text-text-primary mb-2">
          Unable to load debates
        </h2>
        <p className="text-body text-text-secondary mb-6">
          We couldn't load the debate list. This might be a temporary issue.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.invalidate()}
            className="px-4 py-2 bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-hairline text-text-primary rounded-subtle hover:bg-page-bg transition-colors"
          >
            Refresh Page
          </Link>
        </div>
      </div>
    </div>
  );
}
