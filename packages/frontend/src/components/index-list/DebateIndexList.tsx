import type { Debate, MarketPrice } from '@debate-platform/shared';
import { DebateIndexRow } from './DebateIndexRow';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

interface UserStances {
  [debateId: string]: number | null;
}

interface DebateIndexListProps {
  debates: DebateWithMarket[];
  emptyMessage?: string;
  userStances?: UserStances;
  onQuickStance?: (debateId: string, side: 'support' | 'oppose') => void;
  isAuthenticated?: boolean;
}

/**
 * DebateIndexList - Polymarket-style debate listing with quick stance.
 * Paper-clean aesthetic with market sentiment display.
 */
export function DebateIndexList({ 
  debates, 
  emptyMessage = 'No debates yet.',
  userStances = {},
  onQuickStance,
  isAuthenticated = false,
}: DebateIndexListProps) {
  if (debates.length === 0) {
    return (
      <div className="bg-paper rounded-small border border-gray-100 p-8 sm:p-12 text-center">
        <p className="text-body text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-small border border-gray-100 shadow-paper overflow-hidden">
      {/* Header row - refined paper aesthetic */}
      <div className="hidden sm:flex items-center gap-3 py-2.5 px-3 border-b border-divider bg-page-bg/50">
        <div className="w-10 flex-shrink-0 text-center">
          <span className="small-caps text-[10px] text-text-tertiary">%</span>
        </div>
        <div className="flex-1 min-w-0">
          <span className="small-caps text-[10px] text-text-tertiary">Resolution</span>
        </div>
        <div className="w-20 flex-shrink-0 text-center">
          <span className="small-caps text-[10px] text-text-tertiary">Position</span>
        </div>
        <div className="w-6 flex-shrink-0" />
      </div>

      {/* Debate rows with staggered fade-in animation */}
      <div>
        {debates.map(({ debate, marketPrice }, index) => (
          <div 
            key={debate.id}
            className="animate-fadeIn"
            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
          >
            <DebateIndexRow 
              debate={debate} 
              marketPrice={marketPrice}
              userStance={userStances[debate.id]}
              onQuickStance={onQuickStance}
              isAuthenticated={isAuthenticated}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default DebateIndexList;
