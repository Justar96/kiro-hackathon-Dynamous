import type { MarketPrice } from '@debate-platform/shared';

interface InlineQuickStanceProps {
  debateId: string;
  marketPrice?: MarketPrice | null;
  userStance?: number | null;
  onStance?: (debateId: string, side: 'support' | 'oppose') => void;
  disabled?: boolean;
}

/**
 * Inline quick stance for debate rows - Polymarket-style Yes/No.
 * Paper-clean aesthetic, minimal footprint.
 */
export function InlineQuickStance({
  debateId,
  marketPrice,
  userStance,
  onStance,
  disabled = false,
}: InlineQuickStanceProps) {
  const supportPercent = marketPrice?.supportPrice ?? 50;
  const opposePercent = marketPrice?.opposePrice ?? 50;
  const hasVoted = userStance !== null && userStance !== undefined;

  const handleClick = (e: React.MouseEvent, side: 'support' | 'oppose') => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && onStance) {
      onStance(debateId, side);
    }
  };

  // User already voted - show their position
  if (hasVoted) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-14 h-1.5 bg-divider rounded-full overflow-hidden flex">
          <div className="bg-support" style={{ width: `${supportPercent}%` }} />
          <div className="bg-oppose" style={{ width: `${opposePercent}%` }} />
        </div>
        <span className={`text-[10px] font-medium ${userStance! > 50 ? 'text-support' : 'text-oppose'}`}>
          ✓
        </span>
      </div>
    );
  }

  // Quick vote buttons
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={(e) => handleClick(e, 'support')}
        disabled={disabled}
        className="px-1.5 py-0.5 text-[10px] font-medium text-support bg-support/10 hover:bg-support/20 rounded transition-colors disabled:opacity-50"
        title="Support"
      >
        {supportPercent.toFixed(0)}%
      </button>
      <button
        onClick={(e) => handleClick(e, 'oppose')}
        disabled={disabled}
        className="px-1.5 py-0.5 text-[10px] font-medium text-oppose bg-oppose/10 hover:bg-oppose/20 rounded transition-colors disabled:opacity-50"
        title="Oppose"
      >
        {opposePercent.toFixed(0)}%
      </button>
    </div>
  );
}

export default InlineQuickStance;
