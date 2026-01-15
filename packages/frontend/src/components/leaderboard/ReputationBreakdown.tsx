/**
 * ReputationBreakdown Component
 * 
 * Displays a user's reputation score with factor breakdown, recent changes,
 * and optional rank/percentile information.
 * 
 * Requirements: 4.1 - Display overall score with factor breakdown
 */

import { useQuery } from '@tanstack/react-query';
import { queryOptions } from '@tanstack/react-query';
import { fetchApi } from '../../lib/api/client';
import { queryKeys } from '../../lib/api/queryKeys';
import { CACHE_STRATEGIES } from '../../lib/api/cache';
import type { ReputationBreakdown as ReputationBreakdownType } from '@thesis/shared';
import { Skeleton } from '../common';

// ============================================================================
// Query Options
// ============================================================================

interface ReputationBreakdownResponse {
  breakdown: ReputationBreakdownType;
}

export const reputationBreakdownQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: [...queryKeys.users.detail(userId), 'reputation'] as const,
    queryFn: async (): Promise<ReputationBreakdownType | null> => {
      if (!userId) return null;
      try {
        const response = await fetchApi<ReputationBreakdownResponse>(
          `/api/users/${userId}/reputation`
        );
        return response.breakdown;
      } catch {
        return null;
      }
    },
    ...CACHE_STRATEGIES.static,
    enabled: !!userId,
  });

// ============================================================================
// Hook
// ============================================================================

export function useReputationBreakdown(userId: string) {
  return useQuery(reputationBreakdownQueryOptions(userId));
}

// ============================================================================
// Component Props
// ============================================================================

export interface ReputationBreakdownProps {
  /** User ID to fetch reputation for */
  userId: string;
  /** Whether to show recent changes section */
  showRecentChanges?: boolean;
  /** Whether to show rank/percentile if available */
  showRank?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

// ============================================================================
// Factor Bar Component
// ============================================================================

interface FactorBarProps {
  name: string;
  value: number;
  weight: number;
  contribution: number;
}

function FactorBar({ name, value, weight, contribution }: FactorBarProps) {
  // Calculate bar width as percentage (value is 0-100)
  const barWidth = Math.min(100, Math.max(0, value));
  
  return (
    <div className="space-y-1" role="listitem">
      <div className="flex items-center justify-between text-caption">
        <span className="text-text-secondary">{name}</span>
        <span className="text-text-tertiary" aria-hidden="true">
          {value.toFixed(0)} × {(weight * 100).toFixed(0)}% = {contribution}
        </span>
      </div>
      <div className="h-2 bg-page-bg rounded-full overflow-hidden">
        <div
          className="h-full bg-accent motion-safe:transition-all motion-safe:duration-300 motion-reduce:transition-none"
          style={{ width: `${barWidth}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${name}: ${value.toFixed(0)} out of 100, contributing ${contribution} points`}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Recent Change Row Component
// ============================================================================

interface RecentChangeRowProps {
  date: Date;
  change: number;
  reason: string;
}

function RecentChangeRow({ date, change, reason }: RecentChangeRowProps) {
  const isPositive = change > 0;
  const changeSign = isPositive ? '+' : '';
  const changeColor = isPositive ? 'text-support' : change < 0 ? 'text-oppose' : 'text-text-secondary';
  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  return (
    <div 
      className="flex items-center justify-between py-2 border-b border-hairline last:border-0 min-h-[44px]"
      role="listitem"
      aria-label={`${reason}: ${changeSign}${change.toFixed(1)} points on ${formattedDate}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-body-small text-text-primary truncate">{reason}</p>
        <p className="text-caption text-text-tertiary">
          {formattedDate}
        </p>
      </div>
      <span className={`text-body-small font-medium ${changeColor} ml-3`} aria-hidden="true">
        {changeSign}{change.toFixed(1)}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ReputationBreakdown({
  userId,
  showRecentChanges = true,
  showRank = true,
  className = '',
  'data-testid': testId,
}: ReputationBreakdownProps) {
  const { data: breakdown, isLoading, error } = useReputationBreakdown(userId);

  if (isLoading) {
    return <ReputationBreakdownSkeleton className={className} data-testid={testId} />;
  }

  if (error || !breakdown) {
    return (
      <div 
        className={`bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6 ${className}`}
        data-testid={testId}
        role="region"
        aria-label="Reputation breakdown"
      >
        <p className="text-body-small text-text-tertiary text-center">
          Unable to load reputation breakdown
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`bg-paper rounded-small border border-black/[0.08] shadow-paper ${className}`}
      data-testid={testId}
      role="region"
      aria-label="Reputation breakdown"
    >
      {/* Header with Overall Score */}
      <div className="p-4 sm:p-6 border-b border-hairline">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-label uppercase tracking-wider text-text-secondary" id="reputation-heading">
            Reputation Breakdown
          </h2>
          {showRank && breakdown.rank !== undefined && (
            <span 
              className="min-h-[44px] min-w-[44px] flex items-center justify-center px-2 py-1 bg-accent/10 text-accent text-caption font-medium rounded-subtle"
              data-testid={testId ? `${testId}-rank` : undefined}
              aria-label={`Rank number ${breakdown.rank}`}
            >
              Rank #{breakdown.rank}
            </span>
          )}
        </div>
        
        <div className="flex items-baseline gap-3">
          <span 
            className="text-3xl sm:text-4xl font-heading font-semibold text-text-primary"
            data-testid={testId ? `${testId}-overall` : undefined}
            aria-label={`Overall reputation score: ${breakdown.overall} out of 1000`}
          >
            {breakdown.overall}
          </span>
          <span className="text-body-small text-text-tertiary" aria-hidden="true">/ 1000</span>
          {showRank && breakdown.percentile !== undefined && (
            <span 
              className="text-body-small text-text-secondary ml-auto"
              data-testid={testId ? `${testId}-percentile` : undefined}
              aria-label={`Top ${(100 - breakdown.percentile).toFixed(0)} percent of users`}
            >
              Top {(100 - breakdown.percentile).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="p-4 sm:p-6 border-b border-hairline">
        <h3 className="text-caption uppercase tracking-wider text-text-tertiary mb-4" id="factors-heading">
          Score Factors
        </h3>
        <div 
          className="space-y-4"
          data-testid={testId ? `${testId}-factors` : undefined}
          role="list"
          aria-labelledby="factors-heading"
        >
          {breakdown.factors.map((factor: ReputationBreakdownType['factors'][number]) => (
            <FactorBar
              key={factor.name}
              name={factor.name}
              value={factor.value}
              weight={factor.weight}
              contribution={factor.contribution}
            />
          ))}
        </div>
      </div>

      {/* Recent Changes */}
      {showRecentChanges && breakdown.recentChanges.length > 0 && (
        <div className="p-4 sm:p-6">
          <h3 className="text-caption uppercase tracking-wider text-text-tertiary mb-3" id="changes-heading">
            Recent Changes
          </h3>
          <div 
            data-testid={testId ? `${testId}-changes` : undefined}
            role="list"
            aria-labelledby="changes-heading"
          >
            {breakdown.recentChanges.slice(0, 5).map((change: ReputationBreakdownType['recentChanges'][number], index: number) => (
              <RecentChangeRow
                key={`${change.date}-${index}`}
                date={change.date}
                change={change.change}
                reason={change.reason}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for recent changes */}
      {showRecentChanges && breakdown.recentChanges.length === 0 && (
        <div className="p-4 sm:p-6">
          <h3 className="text-caption uppercase tracking-wider text-text-tertiary mb-3">
            Recent Changes
          </h3>
          <p className="text-body-small text-text-tertiary">
            No recent reputation changes
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Skeleton Component
// ============================================================================

interface ReputationBreakdownSkeletonProps {
  className?: string;
  'data-testid'?: string;
}

function ReputationBreakdownSkeleton({ 
  className = '',
  'data-testid': testId,
}: ReputationBreakdownSkeletonProps) {
  return (
    <div 
      className={`bg-paper rounded-small border border-black/[0.08] shadow-paper ${className}`}
      data-testid={testId}
    >
      {/* Header skeleton */}
      <div className="p-4 sm:p-6 border-b border-hairline">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-baseline gap-3">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      {/* Factors skeleton */}
      <div className="p-4 sm:p-6 border-b border-hairline">
        <Skeleton className="h-3 w-24 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent changes skeleton */}
      <div className="p-4 sm:p-6">
        <Skeleton className="h-3 w-28 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="flex-1">
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-10 ml-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReputationBreakdown;
