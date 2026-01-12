import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { leaderboardQueryOptions, type TopArgument } from '../../lib/queries';

interface MindChangeLeaderboardProps {
  limit?: number;
  compact?: boolean;
}

/**
 * Displays top arguments that changed the most minds.
 * Social proof that debates actually work.
 */
export function MindChangeLeaderboard({ limit = 5, compact = false }: MindChangeLeaderboardProps) {
  const { data: arguments_ = [], isLoading } = useQuery(leaderboardQueryOptions(limit));

  if (isLoading) {
    return <LeaderboardSkeleton count={limit} compact={compact} />;
  }

  if (arguments_.length === 0) {
    return (
      <div className="text-center py-3 text-gray-400 text-sm">
        No persuasive arguments yet
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {arguments_.map((arg, index) => (
        <LeaderboardRow key={arg.id} argument={arg} rank={index + 1} compact={compact} />
      ))}
    </div>
  );
}

function LeaderboardRow({ 
  argument, 
  rank, 
  compact 
}: { 
  argument: TopArgument; 
  rank: number; 
  compact: boolean;
}) {
  const impactLabel = argument.impactScore > 0 
    ? `+${argument.impactScore.toFixed(1)}` 
    : argument.impactScore.toFixed(1);

  if (compact) {
    return (
      <Link
        to="/debates/$debateId"
        params={{ debateId: argument.debateId }}
        className="flex items-center gap-2 p-2 -mx-2 rounded-subtle hover:bg-page-bg transition-colors"
      >
        <span className="w-5 h-5 flex items-center justify-center text-caption text-text-tertiary">
          {rank}
        </span>
        <span className={`text-caption font-medium ${argument.side === 'support' ? 'text-support' : 'text-oppose'}`}>
          Δ{impactLabel}
        </span>
        <span className="flex-1 text-body-small text-text-primary truncate">
          {argument.content}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: argument.debateId }}
      className="block p-3 rounded-subtle border border-hairline hover:border-black/[0.12] transition-colors"
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-page-bg text-caption font-medium text-text-secondary">
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* Impact score */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold ${argument.side === 'support' ? 'text-support' : 'text-oppose'}`}>
              Δ {impactLabel}
            </span>
            <span className="text-caption text-text-tertiary">
              minds changed
            </span>
          </div>

          {/* Argument preview */}
          <p className="text-body-small text-text-primary line-clamp-2 mb-2">
            "{argument.content}"
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 text-caption text-text-tertiary">
            <span>by {argument.authorUsername}</span>
            <span>•</span>
            <span className="truncate">{argument.resolution.substring(0, 50)}...</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LeaderboardSkeleton({ count, compact }: { count: number; compact: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`animate-pulse ${compact ? 'h-8' : 'h-20'} bg-page-bg rounded-subtle`} 
        />
      ))}
    </div>
  );
}

export default MindChangeLeaderboard;
