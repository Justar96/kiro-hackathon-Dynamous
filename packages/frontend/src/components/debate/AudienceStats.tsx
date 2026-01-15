import { useQuery } from '@tanstack/react-query';
import { stanceStatsQueryOptions } from '../../lib';

interface AudienceStatsProps {
  debateId: string;
}

/**
 * Shows aggregate audience stance changes.
 * Visible to all users (including non-logged-in spectators).
 * Social proof that minds actually change.
 */
export function AudienceStats({ debateId }: AudienceStatsProps) {
  const { data: stats, isLoading } = useQuery(stanceStatsQueryOptions(debateId));

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-24 bg-page-bg rounded" />
        <div className="h-8 w-16 bg-page-bg rounded" />
      </div>
    );
  }

  if (!stats || stats.totalVoters === 0) {
    return (
      <div className="text-caption text-text-tertiary italic">
        No audience votes yet
      </div>
    );
  }

  const deltaSign = stats.avgDelta > 0 ? '+' : '';
  const deltaColor = stats.avgDelta > 0 
    ? 'text-support' 
    : stats.avgDelta < 0 
      ? 'text-oppose' 
      : 'text-text-secondary';

  return (
    <div className="space-y-2">
      {/* Header with delta */}
      <div className="flex items-baseline justify-between">
        <span className="text-caption text-text-tertiary uppercase tracking-wide">Persuasion</span>
        <span className={`text-lg font-semibold ${deltaColor}`}>
          {deltaSign}{stats.avgDelta}%
        </span>
      </div>

      {/* Before/After inline */}
      <div className="flex items-center gap-3 text-caption">
        <span className="text-text-tertiary">{stats.avgPreStance}%</span>
        <span className="text-text-tertiary">→</span>
        <span className="text-text-primary font-medium">{stats.avgPostStance}%</span>
      </div>

      {/* Mind changed count */}
      <div className="text-caption text-text-tertiary">
        {stats.mindChangedCount}/{stats.totalVoters} {stats.mindChangedCount === 1 ? 'mind' : 'minds'} changed
      </div>
    </div>
  );
}

export default AudienceStats;
