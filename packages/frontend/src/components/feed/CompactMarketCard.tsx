import { Link } from '@tanstack/react-router';

export interface CompactMarketCardProps {
  marketId: string;
  question: string;
  yesPercent: number;
  endDate: string;
  category?: string;
  volume?: string;
}

/**
 * Compact Reddit-style card for market feed.
 * Shows question, status bar, and quick action buttons.
 */
export function CompactMarketCard({
  marketId,
  question,
  yesPercent,
  endDate,
  category,
  volume = '$0',
}: CompactMarketCardProps) {
  const noPercent = 100 - yesPercent;

  return (
    <Link
      to="/markets/$marketId"
      params={{ marketId }}
      className="group block dossier-card rounded-subtle p-4 hover:shadow-elevated transition-all h-full"
    >
      {/* Category */}
      {category && (
        <span className="small-caps text-[10px] text-text-tertiary tracking-wider">{category}</span>
      )}
      
      {/* Question */}
      <h3 className="font-heading text-body text-text-primary leading-snug group-hover:text-accent transition-colors mt-1 mb-4 line-clamp-3">
        {question}
      </h3>

      {/* Market Bar */}
      <div className="mb-4">
        <div className="h-2 bg-divider rounded-full overflow-hidden flex">
          <div className="bg-support transition-all duration-300" style={{ width: `${yesPercent}%` }} />
          <div className="bg-oppose transition-all duration-300" style={{ width: `${noPercent}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[11px] text-support font-medium">Yes {yesPercent}%</span>
          <span className="text-[11px] text-oppose font-medium">No {noPercent}%</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button 
          onClick={(e) => { e.preventDefault(); }}
          className="flex-1 py-2 bg-support/10 border border-support/30 rounded-subtle text-support text-body-small font-medium hover:bg-support/20 transition-colors"
        >
          Yes {yesPercent}¢
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); }}
          className="flex-1 py-2 bg-oppose/10 border border-oppose/30 rounded-subtle text-oppose text-body-small font-medium hover:bg-oppose/20 transition-colors"
        >
          No {noPercent}¢
        </button>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-divider flex justify-between items-center">
        <span className="text-[10px] text-text-tertiary">{endDate}</span>
        <span className="text-[10px] text-text-tertiary typewriter">{volume} vol</span>
      </div>
    </Link>
  );
}
