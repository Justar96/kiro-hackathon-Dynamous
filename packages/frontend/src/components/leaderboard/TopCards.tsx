import { Link } from '@tanstack/react-router';

// Re-use TopArgument type from queries
export interface TopArgument {
  id: string;
  content: string;
  side: 'support' | 'oppose';
  impactScore: number;
  debateId: string;
  resolution: string;
  authorUsername: string;
}

export interface TopUser {
  id: string;
  username: string;
  reputationScore: number;
  predictionAccuracy: number;
  debatesParticipated: number;
  sandboxCompleted: boolean;
  totalImpact?: number;
}

interface TopArgumentCardProps {
  argument: TopArgument;
  rank: number;
  compact?: boolean;
}

/**
 * TopArgumentCard - Displays a top-ranked argument with impact score
 * Requirements: Index Page Improvement 3A - Top Arguments
 */
export function TopArgumentCard({ argument, rank, compact = false }: TopArgumentCardProps) {
  const impactLabel = argument.impactScore > 0 
    ? `+${argument.impactScore.toFixed(1)}` 
    : argument.impactScore.toFixed(1);
  
  // Medal colors for top 3
  const rankStyles = {
    1: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🥇' },
    2: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🥈' },
    3: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🥉' },
  };
  const rankStyle = rankStyles[rank as 1 | 2 | 3] || { bg: 'bg-gray-50', text: 'text-gray-500', icon: null };

  if (compact) {
    return (
      <Link
        to="/debates/$debateId"
        params={{ debateId: argument.debateId }}
        className="flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        <span className={`w-5 h-5 flex items-center justify-center text-xs font-semibold rounded-full ${rankStyle.bg} ${rankStyle.text}`}>
          {rank}
        </span>
        <span className={`text-xs font-semibold ${argument.side === 'support' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {impactLabel}
        </span>
        <span className="flex-1 text-sm text-gray-700 truncate group-hover:text-gray-900">
          {argument.content}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/debates/$debateId"
      params={{ debateId: argument.debateId }}
      className="block p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${rankStyle.bg} ${rankStyle.text}`}>
          {rankStyle.icon || rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* Impact score */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-bold ${argument.side === 'support' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {impactLabel}
            </span>
            <span className="text-xs text-gray-400">
              minds changed
            </span>
          </div>

          {/* Argument preview */}
          <p className="text-sm text-gray-700 line-clamp-2 mb-2 leading-relaxed">
            "{argument.content}"
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="font-medium text-gray-500">@{argument.authorUsername}</span>
            <span>in</span>
            <span className="truncate">{argument.resolution.substring(0, 40)}...</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

interface TopUserCardProps {
  user: TopUser;
  rank: number;
  compact?: boolean;
}

/**
 * TopUserCard - Displays a top-ranked user with reputation stats
 * Requirements: Index Page Improvement 3B - Top Users
 */
export function TopUserCard({ user, rank, compact = false }: TopUserCardProps) {
  // Medal colors for top 3
  const rankStyles = {
    1: { bg: 'bg-amber-100', text: 'text-amber-700', icon: '🥇' },
    2: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🥈' },
    3: { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🥉' },
  };
  const rankStyle = rankStyles[rank as 1 | 2 | 3] || { bg: 'bg-gray-50', text: 'text-gray-500', icon: null };

  if (compact) {
    return (
      <Link
        to="/users/$userId"
        params={{ userId: user.id }}
        className="flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        <span className={`w-5 h-5 flex items-center justify-center text-xs font-semibold rounded-full ${rankStyle.bg} ${rankStyle.text}`}>
          {rank}
        </span>
        <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900">
          @{user.username}
        </span>
        <span className="text-xs text-blue-600 font-semibold ml-auto">
          +{user.reputationScore.toFixed(0)}
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/users/$userId"
      params={{ userId: user.id }}
      className="block p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50/50 transition-all"
    >
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold ${rankStyle.bg} ${rankStyle.text}`}>
          {rankStyle.icon || rank}
        </div>

        <div className="flex-1 min-w-0">
          {/* Username */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-800">
              @{user.username}
            </span>
            {!user.sandboxCompleted && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                Sandbox
              </span>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-blue-600">+{user.reputationScore.toFixed(0)}</span>
              <span className="text-gray-400">rep</span>
            </span>
            <span className="text-gray-300">|</span>
            <span>
              {user.predictionAccuracy.toFixed(0)}% accuracy
            </span>
            <span className="text-gray-300">|</span>
            <span>
              {user.debatesParticipated} debates
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default TopArgumentCard;
