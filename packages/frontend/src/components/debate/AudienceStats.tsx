import { useQuery } from '@tanstack/react-query';
import { stanceStatsQueryOptions } from '../../lib/queries';

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
    <div className="space-y-3">
      {/* Main delta display */}
      <div>
        <div className="text-label uppercase tracking-wider text-text-tertiary mb-1">
          Audience Shift
        </div>
        <div className={`text-xl font-semibold ${deltaColor}`}>
          Δ {deltaSign}{stats.avgDelta}
        </div>
      </div>

      {/* Stats breakdown */}
      <div className="grid grid-cols-2 gap-2 text-caption">
        <div>
          <span className="text-text-tertiary">Before:</span>{' '}
          <span className="text-text-primary">{stats.avgPreStance}%</span>
        </div>
        <div>
          <span className="text-text-tertiary">After:</span>{' '}
          <span className="text-text-primary">{stats.avgPostStance}%</span>
        </div>
      </div>

      {/* Mind changed count */}
      <div className="pt-2 border-t border-hairline">
        <span className="text-caption text-text-tertiary">
          {stats.mindChangedCount} of {stats.totalVoters} changed their mind
        </span>
      </div>
    </div>
  );
}

export default AudienceStats;
