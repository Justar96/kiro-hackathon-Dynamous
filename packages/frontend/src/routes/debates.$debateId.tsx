import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useCallback, useMemo } from 'react';
import { debateDetailQueryOptions, userQueryOptions } from '../lib/queries';
import { 
  useMarket, 
  useUserStance, 
  useAfterStanceUnlock,
  useReadingProgress,
  useAuthToken,
  useAttributeImpact,
  useComments,
} from '../lib/hooks';
import { 
  useOptimisticStance, 
  useOptimisticComment 
} from '../lib/optimistic';
import { SSEProvider, useSSEComments } from '../lib';
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
} from '../components';
import type { NavSection, Citation } from '../components';
import type { StanceValue, User } from '@debate-platform/shared';
import { useQuery } from '@tanstack/react-query';

export const Route = createFileRoute('/debates/$debateId')({
  loader: async ({ context, params }) => {
    const debateDetail = await context.queryClient.ensureQueryData(
      debateDetailQueryOptions(params.debateId)
    );
    return { debateDetail };
  },
  pendingComponent: DebateViewPending,
  pendingMs: 200, // Minimum loading duration as per Requirements 4.6
  component: DebateViewWrapper,
});

/**
 * Wrapper component that provides SSE context for real-time updates.
 * Requirements: 9.1, 9.4
 */
function DebateViewWrapper() {
  const { debateId } = Route.useParams();
  
  return (
    <SSEProvider debateId={debateId}>
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
  const { debateDetail } = Route.useLoaderData();
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
  
  // Market data
  const { data: marketData } = useMarket(debateId);
  
  // User stance data
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
  
  // Impact attribution mutation
  const attributeImpact = useAttributeImpact();
  
  // Fetch debater user profiles
  const { data: supportDebater } = useQuery({
    ...userQueryOptions(debateDetail?.debate?.supportDebaterId || ''),
    enabled: !!debateDetail?.debate?.supportDebaterId,
  });
  
  const { data: opposeDebater } = useQuery({
    ...userQueryOptions(debateDetail?.debate?.opposeDebaterId || ''),
    enabled: !!debateDetail?.debate?.opposeDebaterId,
  });

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

  // Handle mind changed attribution
  const handleMindChanged = useCallback((argumentId: string) => {
    attributeImpact.mutate({ debateId, argumentId });
  }, [debateId, attributeImpact]);

  if (!debateDetail?.debate) {
    return <DebateNotFound />;
  }

  const { debate, rounds } = debateDetail;

  // Build TOC sections
  const tocSections: NavSection[] = useMemo(() => [
    { id: 'resolution', label: 'Resolution' },
    { id: 'round-1', label: 'Round 1: Openings', indent: 1 },
    { id: 'round-2', label: 'Round 2: Rebuttals', indent: 1 },
    { id: 'round-3', label: 'Round 3: Closings', indent: 1 },
    { id: 'outcome', label: 'Outcome' },
    { id: 'comments', label: 'Discussion' },
  ], []);

  // User stance values for margin rail
  const userStance = useMemo(() => ({
    before: stanceData?.stances?.pre?.supportValue,
    after: stanceData?.stances?.post?.supportValue,
  }), [stanceData]);

  // Market prices
  const supportPrice = marketData?.marketPrice?.supportPrice ?? 50;
  const opposePrice = marketData?.marketPrice?.opposePrice ?? 50;

  return (
    <ThreeColumnLayout
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
          onCitationHover={handleCitationHover}
          onMindChanged={handleMindChanged}
        />
      }
      rightMargin={
        <>
          <RightMarginRail
            debateId={debateId}
            supportPrice={supportPrice}
            opposePrice={opposePrice}
            dataPoints={marketData?.history || []}
            spikes={marketData?.spikes || []}
            userStance={userStance}
            debateStatus={debate.status}
            readingProgress={readingProgress}
            onBeforeStanceSubmit={token ? handleBeforeStanceSubmit : undefined}
            onAfterStanceSubmit={token ? handleAfterStanceSubmit : undefined}
            afterUnlocked={afterUnlocked}
            isSubmitting={isStancePending}
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
  debate: NonNullable<ReturnType<typeof Route.useLoaderData>['debateDetail']>['debate'];
  rounds: NonNullable<ReturnType<typeof Route.useLoaderData>['debateDetail']>['rounds'];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
}

function DebateDossierContent({
  debateId,
  debate,
  rounds,
  supportDebater,
  opposeDebater,
  currentUserId,
  onCitationHover,
  onMindChanged,
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

      {/* Debate Rounds */}
      {rounds.map((round: typeof rounds[number], index: number) => (
        <RoundSection
          key={round.id}
          round={round}
          roundNumber={(index + 1) as 1 | 2 | 3}
          supportArgument={round.supportArgument}
          opposeArgument={round.opposeArgument}
          supportAuthor={supportDebater}
          opposeAuthor={opposeDebater}
          onCitationHover={handleCitationHover}
          onMindChanged={onMindChanged}
        />
      ))}

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
  debate: NonNullable<ReturnType<typeof Route.useLoaderData>['debateDetail']>['debate'];
}

function OutcomeSection({ debate }: OutcomeSectionProps) {
  const isActive = debate.status === 'active';

  return (
    <section id="outcome" className="mt-12 pt-8 border-t border-gray-100 scroll-mt-8">
      <h2 className="font-heading text-heading-2 text-text-primary mb-4">
        Outcome
      </h2>
      
      {isActive ? (
        <div className="py-8 px-6 bg-gray-50 rounded-subtle text-center">
          <p className="text-body text-text-secondary">
            This debate is still in progress.
          </p>
          <p className="text-body-small text-text-tertiary mt-2">
            Currently in Round {debate.currentRound} · {debate.currentTurn === 'support' ? 'Support' : 'Oppose'}'s turn
          </p>
        </div>
      ) : (
        <div className="py-8 px-6 bg-gray-50 rounded-subtle">
          <p className="text-body text-text-primary text-center">
            Debate concluded on {formatDate(debate.concludedAt)}
          </p>
          {/* Final results would be displayed here */}
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
    <div className="min-h-screen bg-page-bg flex items-center justify-center">
      <div className="bg-paper rounded-subtle shadow-sm p-8 text-center max-w-md">
        <h2 className="font-heading text-heading-2 text-text-primary mb-2">
          Debate not found
        </h2>
        <p className="text-body text-text-secondary mb-6">
          The debate you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/"
          className="inline-block px-4 py-2 bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors"
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
 * Requirements: 4.1, 4.3
 */
function DebateViewPending() {
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="hidden lg:flex justify-center min-h-screen">
        {/* Left Rail Skeleton - TOC navigation */}
        <aside className="w-rail flex-shrink-0 sticky top-0 h-screen py-8 pr-6">
          <div className="space-y-2">
            <SkeletonText lines={1} width="5rem" className="mb-4" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </aside>

        {/* Center Paper Skeleton - Main content */}
        <main className="w-full max-w-paper flex-shrink-0 py-8">
          <div className="paper-surface min-h-full px-12 py-10">
            {/* Header skeleton - Resolution */}
            <div className="mb-8 pb-6 border-b border-gray-100">
              <SkeletonText lines={1} width="6rem" className="mb-3" />
              <SkeletonHeading className="mb-3" width="75%" />
              <SkeletonText lines={1} width="12rem" />
            </div>

            {/* Round skeletons - matching exact dimensions */}
            {[1, 2, 3].map((roundNum) => (
              <div key={roundNum} className="mb-12">
                {/* Round header */}
                <div className="mb-6 pb-3 border-b border-gray-100">
                  <SkeletonHeading className="mb-2" width="12rem" height={28} />
                  <SkeletonText lines={1} width="16rem" />
                </div>
                
                {/* Arguments - Support and Oppose */}
                <div className="space-y-8">
                  {/* Support argument */}
                  <SkeletonArgumentBlock />
                  
                  {/* Oppose argument */}
                  <SkeletonArgumentBlock />
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Right Margin Skeleton - Market data */}
        <aside className="w-margin flex-shrink-0 sticky top-0 h-screen py-8 pl-6">
          <SkeletonMarketData />
        </aside>
      </div>

      {/* Mobile skeleton */}
      <div className="lg:hidden pt-14 pb-20 px-4 py-6">
        <div className="paper-surface px-4 py-6">
          <SkeletonHeading className="mb-4" width="75%" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
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
