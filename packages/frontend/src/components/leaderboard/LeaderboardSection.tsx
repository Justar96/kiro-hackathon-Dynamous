import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leaderboardQueryOptions, topUsersQueryOptions, type TopUser } from '../../lib/queries';
import { TopArgumentCard, TopUserCard } from './TopCards';

interface LeaderboardSectionProps {
  maxItems?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

/**
 * LeaderboardSection - Contains both Top Arguments and Top Users leaderboards
 * Requirements: Index Page Improvement 3 - Leaderboard Section
 */
export function LeaderboardSection({ 
  maxItems = 5, 
  collapsible = false,
  defaultCollapsed = false,
}: LeaderboardSectionProps) {
  const [isArgumentsCollapsed, setArgumentsCollapsed] = useState(defaultCollapsed);
  const [isUsersCollapsed, setUsersCollapsed] = useState(defaultCollapsed);

  return (
    <div className="space-y-6">
      <TopArgumentsSection 
        limit={maxItems} 
        collapsible={collapsible}
        isCollapsed={isArgumentsCollapsed}
        onToggle={() => setArgumentsCollapsed(!isArgumentsCollapsed)}
      />
      <TopUsersSection 
        limit={maxItems} 
        collapsible={collapsible}
        isCollapsed={isUsersCollapsed}
        onToggle={() => setUsersCollapsed(!isUsersCollapsed)}
      />
    </div>
  );
}

interface TopArgumentsSectionProps {
  limit: number;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

/**
 * TopArgumentsSection - Standalone component for top arguments leaderboard
 */
export function TopArgumentsSection({ 
  limit, 
  collapsible = false,
  isCollapsed = false,
  onToggle,
  compact = false,
}: TopArgumentsSectionProps) {
  const { data: arguments_ = [], isLoading } = useQuery(leaderboardQueryOptions(limit));

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
      <button
        type="button"
        className={`
          w-full flex items-center justify-between px-4 py-3 text-left bg-gradient-to-r from-amber-50/50 to-transparent border-b border-gray-100
          ${collapsible ? 'cursor-pointer hover:from-amber-50 transition-colors' : 'cursor-default'}
        `}
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        aria-expanded={collapsible ? !isCollapsed : undefined}
      >
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <span className="text-amber-500">★</span>
          Top Arguments
        </h3>
        {collapsible && (
          <span className={`text-gray-400 transition-transform text-xs ${isCollapsed ? '' : 'rotate-180'}`}>
            ▼
          </span>
        )}
      </button>
      
      {(!collapsible || !isCollapsed) && (
        <div className="p-3">
          {isLoading ? (
            <LeaderboardSkeleton count={limit} compact={compact} />
          ) : arguments_.length === 0 ? (
            <p className="text-center py-4 text-sm text-gray-400">
              No arguments yet
            </p>
          ) : (
            <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
              {arguments_.map((arg, index) => (
                <TopArgumentCard 
                  key={arg.id} 
                  argument={arg} 
                  rank={index + 1} 
                  compact={compact}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TopUsersSectionProps {
  limit: number;
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

/**
 * TopUsersSection - Standalone component for top users leaderboard
 */
export function TopUsersSection({ 
  limit, 
  collapsible = false,
  isCollapsed = false,
  onToggle,
  compact = false,
}: TopUsersSectionProps) {
  const { data: users = [], isLoading } = useQuery(topUsersQueryOptions(limit));

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 overflow-hidden">
      <button
        type="button"
        className={`
          w-full flex items-center justify-between px-4 py-3 text-left bg-gradient-to-r from-blue-50/50 to-transparent border-b border-gray-100
          ${collapsible ? 'cursor-pointer hover:from-blue-50 transition-colors' : 'cursor-default'}
        `}
        onClick={collapsible ? onToggle : undefined}
        disabled={!collapsible}
        aria-expanded={collapsible ? !isCollapsed : undefined}
      >
        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <span className="text-blue-500">◆</span>
          Top Debaters
        </h3>
        {collapsible && (
          <span className={`text-gray-400 transition-transform text-xs ${isCollapsed ? '' : 'rotate-180'}`}>
            ▼
          </span>
        )}
      </button>
      
      {(!collapsible || !isCollapsed) && (
        <div className="p-3">
          {isLoading ? (
            <LeaderboardSkeleton count={limit} compact={compact} />
          ) : users.length === 0 ? (
            <p className="text-center py-4 text-sm text-gray-400">
              No users yet
            </p>
          ) : (
            <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
              {users.map((user: TopUser, index: number) => (
                <TopUserCard 
                  key={user.id} 
                  user={user} 
                  rank={index + 1} 
                  compact={compact}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LeaderboardSkeleton({ count, compact }: { count: number; compact: boolean }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className={`animate-pulse ${compact ? 'h-8' : 'h-16'} bg-page-bg rounded-subtle`} 
        />
      ))}
    </div>
  );
}

export default LeaderboardSection;
