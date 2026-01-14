import { createFileRoute, Link, useRouter } from '@tanstack/react-router';
import { useState, useCallback, useMemo } from 'react';
import { debateFullQueryOptions } from '../lib/queries';
import { 
  useUserStance, 
  useAfterStanceUnlock,
  useReadingProgress,
  useAuthToken,
  useMindChanged,
  useComments,
  useSubmitArgument,
  useSteelmanStatus,
  usePendingSteelmans,
  useSubmitSteelman,
  useReviewSteelman,
  useDeleteSteelman,
} from '../lib/hooks';
import { 
  useOptimisticStance, 
  useOptimisticComment 
} from '../lib/optimistic';
import { SSEProvider, useSSEComments, useSSEMarket, useSSEArguments, useSSERound, useSSEReactions, useSSESteelman } from '../lib';
import {
  ThreeColumnLayout,
  LeftNavRail,
  RightMarginRail,
  DossierHeader,
  RoundSection,
  SourceCard,
  SourceCardContainer,
  useSourceCardState,
  SpectatorComments,
  Skeleton,
  SkeletonHeading,
  SkeletonText,
  SkeletonArgumentBlock,
  SkeletonMarketData,
  ConnectionStatus,
  useToast,
  createUnifiedTocSections,
  HorizontalDivider,
} from '../components';
import type { NavSection, Citation, SteelmanData, PendingReview } from '../components';
import type { StanceValue, User, Argument } from '@debate-platform/shared';

export const Route = createFileRoute('/debates/$debateId')({
  loader: async ({ context, params }) => {
    // Get token from context if available for authenticated requests
    const token = undefined; // Token will be used in component via useAuthToken

    // Fetch debate with ALL related data in a single request
    // Errors will be caught by errorComponent
    const debateData = await context.queryClient.ensureQueryData(
      debateFullQueryOptions(params.debateId, token)
    );
    return { debateData };
  },
  pendingComponent: DebateViewPending,
  pendingMs: 200, // Minimum loading duration as per Requirements 4.6
  component: DebateViewWrapper,
  errorComponent: DebateViewError,
});

/**
 * Wrapper component that provides SSE context for real-time updates.
 * Requirements: 9.1, 9.4, 8.3
 */
function DebateViewWrapper() {
  const { debateId } = Route.useParams();
  const router = useRouter();
  
  // Invalidate queries on SSE reconnection (Requirement 8.3)
  const handleReconnect = useCallback(() => {
    // Invalidate debate data to fetch fresh state after reconnection
    router.invalidate();
  }, [router]);
  
  return (
    <SSEProvider debateId={debateId} onReconnect={handleReconnect}>
      <DebateView />
      <ConnectionStatus />
    </SSEProvider>
  );
}

/**
 * DebateView page with dossier structure.
 * Uses ThreeColumnLayout with TOC navigation, paper content, and margin data.
 * Uses optimistic updates for stance recording and comments.
 * 
 * Requirements: 3.1, 3.3, 10.1, 10.2
 */
function DebateView() {
  const { debateData } = Route.useLoaderData();
  const { debateId } = Route.useParams();
  const token = useAuthToken();
  const { showToast } = useToast();
  
  // Active section for TOC highlighting
  const [activeSection, setActiveSection] = useState('resolution');
  
  // Source card hover state
  const { hoveredSource, sourcePosition, handleCitationHover } = useSourceCardState();
  
  // Scroll-based After stance unlock
  const { afterUnlocked } = useAfterStanceUnlock('round-2');
  
  // Reading progress tracking
  const readingProgress = useReadingProgress();
  
  // User stance data (still separate - user-specific)
  const { data: stanceData } = useUserStance(debateId);
  
  // Optimistic stance mutations (Requirements: 3.1)
  const { recordStance, isPending: isStancePending } = useOptimisticStance({
    debateId,
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Stance recorded successfully!',
      });
    },
    onError: (error) => {
      showToast({
        type: 'error',
        message: error.message || 'Failed to record stance. Please try again.',
      });
    },
  });
  
  // Impact attribution mutation - "This changed my mind" button
  const mindChangedMutation = useMindChanged();
  
  // Argument submission mutation
  // Requirements: 7.1, 7.3 - Argument submission integration
  const submitArgumentMutation = useSubmitArgument();

  // Real-time SSE subscriptions for live updates
  // Requirements: 2.3, 2.4, 2.5 - Market price updates
  useSSEMarket(debateId);
  
  // Requirements: 3.3, 3.4, 3.6 - Argument updates with highlight animation
  const { newArgumentId } = useSSEArguments(debateId, token);
  
  // Requirements: 5.3, 5.4, 5.6 - Round transition updates with toast notifications
  useSSERound(debateId, token);
  
  // Requirements: 4.3, 4.5 - Reaction count updates
  useSSEReactions(debateId);
  
  // Steelman Gate hooks
  const currentRound = debateData?.debate?.currentRound ?? 1;
  
  // Requirements: 10.4, 10.5, 10.6 - Steelman status updates
  useSSESteelman(debateId, currentRound, undefined, token);

  const { data: steelmanStatusData } = useSteelmanStatus(debateId, currentRound);
  const { data: pendingReviewsData } = usePendingSteelmans(debateId);
  const submitSteelmanMutation = useSubmitSteelman();
  const reviewSteelmanMutation = useReviewSteelman();
  const deleteSteelmanMutation = useDeleteSteelman();
  
  // Extract debaters from consolidated response (no separate queries needed)
  const supportDebater = debateData?.debaters?.support ?? null;
  const opposeDebater = debateData?.debaters?.oppose ?? null;

  // Handle section click from TOC
  const handleSectionClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  // Handle active section change from scroll
  const handleActiveSectionChange = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
  }, []);

  // Handle before stance submission with optimistic update
  const handleBeforeStanceSubmit = useCallback((stance: StanceValue) => {
    recordStance('pre', stance);
  }, [recordStance]);

  // Handle after stance submission with optimistic update
  const handleAfterStanceSubmit = useCallback((stance: StanceValue) => {
    recordStance('post', stance);
  }, [recordStance]);

  // Handle mind changed attribution - "This changed my mind" button
  const handleMindChanged = useCallback((argumentId: string) => {
    mindChangedMutation.mutate(argumentId, {
      onSuccess: () => {
        showToast({
          type: 'success',
          message: 'Impact attributed! This argument changed minds.',
        });
      },
      onError: (error) => {
        showToast({
          type: 'error',
          message: error.message || 'Failed to attribute impact.',
        });
      },
    });
  }, [mindChangedMutation, showToast]);

  // Handle argument submission
  // Requirements: 7.1, 7.3 - Argument submission within unified round view
  const handleArgumentSubmit = useCallback((content: string) => {
    submitArgumentMutation.mutate(
      { debateId, content },
      {
        onSuccess: () => {
          showToast({
            type: 'success',
            message: 'Argument submitted successfully!',
          });
        },
        onError: (error) => {
          showToast({
            type: 'error',
            message: error.message || 'Failed to submit argument. Please try again.',
          });
        },
      }
    );
  }, [debateId, submitArgumentMutation, showToast]);

  // Steelman Gate handlers
  const handleSteelmanSubmit = useCallback((targetArgumentId: string, content: string) => {
    submitSteelmanMutation.mutate(
      { debateId, roundNumber: currentRound as 2 | 3, targetArgumentId, content },
      {
        onSuccess: () => {
          showToast({ type: 'success', message: 'Steelman submitted! Waiting for opponent review.' });
        },
        onError: (error) => {
          showToast({ type: 'error', message: error.message || 'Failed to submit steelman.' });
        },
      }
    );
  }, [debateId, currentRound, submitSteelmanMutation, showToast]);

  const handleSteelmanReview = useCallback((steelmanId: string, approved: boolean, reason?: string) => {
    reviewSteelmanMutation.mutate(
      { steelmanId, approved, rejectionReason: reason },
      {
        onSuccess: () => {
          showToast({ 
            type: 'success', 
            message: approved ? 'Steelman approved!' : 'Steelman rejected. They can revise.' 
          });
        },
        onError: (error) => {
          showToast({ type: 'error', message: error.message || 'Failed to review steelman.' });
        },
      }
    );
  }, [reviewSteelmanMutation, showToast]);

  const handleSteelmanDelete = useCallback((steelmanId: string) => {
    deleteSteelmanMutation.mutate(steelmanId, {
      onSuccess: () => {
        showToast({ type: 'success', message: 'Steelman deleted. You can submit a new one.' });
      },
      onError: (error) => {
        showToast({ type: 'error', message: error.message || 'Failed to delete steelman.' });
      },
    });
  }, [deleteSteelmanMutation, showToast]);

  if (!debateData?.debate) {
    return <DebateNotFound />;
  }

  const { debate, rounds, market } = debateData;

  // Build TOC sections - unified structure with single "Debate Rounds" entry
  // Requirements: 8.1, 8.2, 8.3
  const tocSections: NavSection[] = useMemo(() => 
    createUnifiedTocSections(debate.currentRound),
    [debate.currentRound]
  );

  // User stance values for margin rail
  const userStance = useMemo(() => ({
    before: stanceData?.stances?.pre?.supportValue,
    after: stanceData?.stances?.post?.supportValue,
  }), [stanceData]);

  // Market prices from consolidated response
  const supportPrice = market?.marketPrice?.supportPrice ?? 50;
  const opposePrice = market?.marketPrice?.opposePrice ?? 50;

  return (
    <ThreeColumnLayout
      marketPreview={{
        forPercent: Math.round(supportPrice),
        againstPercent: Math.round(opposePrice),
      }}
      leftRail={
        <LeftNavRail
          sections={tocSections}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          onActiveSectionChange={handleActiveSectionChange}
        />
      }
      centerPaper={
        <DebateDossierContent
          debateId={debateId}
          debate={debate}
          rounds={rounds}
          supportDebater={supportDebater}
          opposeDebater={opposeDebater}
          currentUserId={token}
          newArgumentId={newArgumentId}
          onCitationHover={handleCitationHover}
          onMindChanged={handleMindChanged}
          onArgumentSubmit={handleArgumentSubmit}
          isArgumentSubmitting={submitArgumentMutation.isPending}
          steelmanData={steelmanStatusData as SteelmanData | undefined}
          pendingReviews={pendingReviewsData as PendingReview[] | undefined}
          onSteelmanSubmit={handleSteelmanSubmit}
          onSteelmanReview={handleSteelmanReview}
          onSteelmanDelete={handleSteelmanDelete}
          isSteelmanSubmitting={submitSteelmanMutation.isPending || reviewSteelmanMutation.isPending}
        />
      }
      rightMargin={
        <>
          <RightMarginRail
            debateId={debateId}
            supportPrice={supportPrice}
            opposePrice={opposePrice}
            dataPoints={market?.history || []}
            userStance={userStance}
            debateStatus={debate.status}
            readingProgress={readingProgress}
            onBeforeStanceSubmit={token ? handleBeforeStanceSubmit : undefined}
            onAfterStanceSubmit={token ? handleAfterStanceSubmit : undefined}
            afterUnlocked={afterUnlocked}
            isSubmitting={isStancePending}
            isAuthenticated={!!token}
          />
          {/* Source card displayed in margin on citation hover */}
          {hoveredSource && (
            <SourceCardContainer position={sourcePosition}>
              <SourceCard source={hoveredSource} />
            </SourceCardContainer>
          )}
        </>
      }
    />
  );
}

/**
 * Main dossier content for the center paper area.
 */
interface DebateDossierContentProps {
  debateId: string;
  debate: NonNullable<ReturnType<typeof Route.useLoaderData>['debateData']>['debate'];
  rounds: NonNullable<ReturnType<typeof Route.useLoaderData>['debateData']>['rounds'];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  newArgumentId?: string | null;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  isArgumentSubmitting?: boolean;
  // Steelman Gate props
  steelmanData?: SteelmanData;
  pendingReviews?: PendingReview[];
  onSteelmanSubmit?: (targetArgumentId: string, content: string) => void;
  onSteelmanReview?: (steelmanId: string, approved: boolean, reason?: string) => void;
  onSteelmanDelete?: (steelmanId: string) => void;
  isSteelmanSubmitting?: boolean;
}

function DebateDossierContent({
  debateId,
  debate,
  rounds,
  supportDebater,
  opposeDebater,
  currentUserId,
  newArgumentId,
  onCitationHover,
  onMindChanged,
  onArgumentSubmit,
  isArgumentSubmitting,
  steelmanData,
  pendingReviews,
  onSteelmanSubmit,
  onSteelmanReview,
  onSteelmanDelete,
  isSteelmanSubmitting,
}: DebateDossierContentProps) {
  // Comments data
  const { data: comments = [] } = useComments(debateId);
  const { showToast } = useToast();
  
  // Optimistic comment mutation (Requirements: 3.3)
  const { addComment, isPending: isCommentPending } = useOptimisticComment({
    debateId,
    userId: currentUserId,
    onSuccess: () => {
      showToast({
        type: 'success',
        message: 'Comment posted!',
      });
    },
    onError: (error) => {
      showToast({
        type: 'error',
        message: error.message || 'Failed to post comment. Please try again.',
      });
    },
  });

  // Subscribe to real-time comment updates via SSE
  // Requirements: 9.2
  useSSEComments(debateId);

  // Build user map for comments
  const usersMap = useMemo(() => {
    const map = new Map<string, User>();
    if (supportDebater) map.set(supportDebater.id, supportDebater);
    if (opposeDebater) map.set(opposeDebater.id, opposeDebater);
    return map;
  }, [supportDebater, opposeDebater]);

  // Build arguments structure for RoundSection
  // Requirements: 1.1 - RoundSection needs arguments indexed by round number and side
  const roundArguments = useMemo(() => {
    const args: { [roundNumber: number]: { support?: Argument | null; oppose?: Argument | null } } = {};
    rounds.forEach((round: typeof rounds[number], index: number) => {
      const roundNumber = index + 1;
      args[roundNumber] = {
        support: round.supportArgument || null,
        oppose: round.opposeArgument || null,
      };
    });
    return args;
  }, [rounds]);

  // Handle adding a comment with optimistic update
  const handleAddComment = useCallback((content: string, parentId?: string | null) => {
    addComment(content, parentId);
  }, [addComment]);

  // Convert citation hover to source hover format
  const handleCitationHover = useCallback((citation: Citation | null, position: { top: number }) => {
    if (onCitationHover) {
      onCitationHover(citation, position);
    }
  }, [onCitationHover]);

  return (
    <article className="debate-dossier">
      {/* Resolution Header */}
      <DossierHeader debate={debate} />

      {/* Unified Debate Rounds Section */}
      {/* Requirements: 1.1, 3.1, 3.2, 3.5, 8.1, 8.2 - Single unified component with seamless integration and sticky progress */}
      <RoundSection
        debate={debate}
        rounds={rounds}
        supportDebater={supportDebater}
        opposeDebater={opposeDebater}
        currentUserId={currentUserId}
        arguments={roundArguments}
        variant="seamless"
        sticky
        highlightArgumentId={newArgumentId}
        onCitationHover={handleCitationHover}
        onMindChanged={onMindChanged}
        onArgumentSubmit={onArgumentSubmit}
        isSubmitting={isArgumentSubmitting}
        steelmanData={steelmanData}
        pendingReviews={pendingReviews}
        onSteelmanSubmit={onSteelmanSubmit}
        onSteelmanReview={onSteelmanReview}
        onSteelmanDelete={onSteelmanDelete}
        isSteelmanSubmitting={isSteelmanSubmitting}
      />

      {/* Outcome Section */}
      <OutcomeSection debate={debate} />

      {/* Spectator Comments Section */}
      <SpectatorComments
        debateId={debateId}
        comments={comments}
        users={usersMap}
        currentUserId={currentUserId}
        onAddComment={handleAddComment}
        isSubmitting={isCommentPending}
      />
    </article>
  );
}

/**
 * Outcome section showing debate results.
 */
interface OutcomeSectionProps {
  debate: NonNullable<ReturnType<typeof Route.useLoaderData>['debateData']>['debate'];
}

function OutcomeSection({ debate }: OutcomeSectionProps) {
  const isActive = debate.status === 'active';

  return (
    <section id="outcome" className="scroll-mt-8">
      {/* Horizontal divider before outcome section */}
      <HorizontalDivider spacing="lg" />
      
      <h2 className="font-heading text-heading-2 text-text-primary mb-4">
        Outcome
      </h2>
      
      {isActive ? (
        <div className="py-6 px-4 bg-page-bg/50 border border-divider rounded-lg text-center shadow-paper">
          <p className="text-body text-text-secondary">
            This debate is still in progress.
          </p>
          <p className="text-body-small text-text-tertiary mt-1">
            Currently in Round {debate.currentRound} · {debate.currentTurn === 'support' ? 'Support' : 'Oppose'}'s turn
          </p>
        </div>
      ) : (
        <div className="py-6 px-4 bg-page-bg/50 border border-divider rounded-lg shadow-paper">
          <p className="text-body text-text-primary text-center">
            Debate concluded on {formatDate(debate.concludedAt)}
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Debate not found state.
 */
function DebateNotFound() {
  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="bg-paper border border-divider rounded-lg shadow-paper p-8 text-center max-w-md w-full">
        <h2 className="font-heading text-heading-2 text-text-primary mb-3">
          Debate not found
        </h2>
        <p className="text-body text-text-secondary mb-6">
          The debate you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for debate view.
 * Uses enhanced skeleton components matching paper-clean aesthetic.
 * Updated to match unified round section structure.
 * Requirements: 4.1, 4.3
 */
function DebateViewPending() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="hidden lg:flex justify-center min-h-screen pt-6">
        {/* Left Rail Skeleton - TOC navigation */}
        <aside className="w-rail flex-shrink-0 sticky top-6 h-[calc(100vh-1.5rem)] pr-6 pt-6">
          <div className="space-y-2">
            <SkeletonText lines={1} width="5rem" className="mb-3" />
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </aside>

        {/* Center Paper Skeleton - Main content */}
        <main className="w-full max-w-paper flex-shrink-0 pb-6">
          <div className="paper-surface min-h-full px-10 py-6">
            {/* Header skeleton - Resolution */}
            <div className="mb-4 pb-4 border-b border-divider">
              <SkeletonText lines={1} width="6rem" className="mb-2" />
              <SkeletonHeading className="mb-2" width="75%" />
              <SkeletonText lines={1} width="12rem" />
            </div>

            {/* Unified Round Section skeleton */}
            <div className="mb-8 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
              </div>
              
              <div className="flex gap-2 border-b border-divider pb-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-24 rounded-lg" />
                ))}
              </div>
              
              <div className="pt-3">
                <div className="mb-4 pb-2 border-b border-divider">
                  <SkeletonHeading className="mb-2" width="12rem" height={28} />
                  <SkeletonText lines={1} width="16rem" />
                </div>
                
                <div className="space-y-4">
                  <SkeletonArgumentBlock />
                  <SkeletonArgumentBlock />
                </div>
              </div>
            </div>

            {/* Outcome section skeleton */}
            <div className="mb-6 pt-6 border-t border-divider">
              <SkeletonHeading className="mb-3" width="8rem" height={24} />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        </main>

        {/* Right Margin Skeleton - Market data */}
        <aside className="w-margin flex-shrink-0 sticky top-6 h-[calc(100vh-1.5rem)] pl-6 pt-6">
          <SkeletonMarketData />
        </aside>
      </div>

      {/* Mobile skeleton */}
      <div className="lg:hidden pt-14 pb-20 px-4 py-4">
        <div className="paper-surface px-4 py-4">
          <SkeletonHeading className="mb-3" width="75%" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Error component for the debate view page.
 * Displays user-friendly error message with retry option.
 */
function DebateViewError() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="bg-paper border border-divider rounded-lg shadow-paper p-8 text-center max-w-md w-full">
        <h2 className="font-heading text-heading-2 text-text-primary mb-3">
          Unable to load debate
        </h2>
        <p className="text-body text-text-secondary mb-6">
          We couldn't load this debate. It may have been removed or there was a connection issue.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.invalidate()}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors"
          >
            Try Again
          </button>
          <Link
            to="/"
            className="px-4 py-2 border border-divider text-text-primary text-sm font-medium rounded-small hover:bg-page-bg transition-colors"
          >
            Back to Index
          </Link>
        </div>
      </div>
    </div>
  );
}
