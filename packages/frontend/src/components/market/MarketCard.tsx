import { Link } from '@tanstack/react-router';

interface MarketCardProps {
  marketId: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: string;
  liquidity: string;
  endDate: string;
  category?: string;
}

export function MarketCard({
  marketId,
  question,
  yesPrice,
  noPrice,
  endDate,
  category,
}: MarketCardProps) {
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = Math.round(noPrice * 100);

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
        <span className="text-[10px] text-text-tertiary typewriter">$1.2k vol</span>
      </div>
    </Link>
  );
}
