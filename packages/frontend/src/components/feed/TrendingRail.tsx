import { Link } from '@tanstack/react-router';

interface TrendingItem {
  id: string;
  question: string;
  yesPercent: number;
  volume?: string;
}

export interface TrendingRailProps {
  items: TrendingItem[];
  maxCount?: number;
}

/**
 * Compact trending markets list for right rail.
 */
export function TrendingRail({ items, maxCount = 5 }: TrendingRailProps) {
  const trending = items.slice(0, maxCount);

  if (trending.length === 0) return null;

  return (
    <section 
      className="bg-paper rounded-small border border-divider overflow-hidden shadow-paper"
      aria-labelledby="trending-rail-heading"
    >
      <div className="px-4 py-3 border-b border-divider">
        <h2 
          id="trending-rail-heading"
          className="small-caps text-label text-text-secondary flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" aria-hidden="true" />
          Trending Now
        </h2>
      </div>
      
      <ul className="divide-y divide-divider">
        {trending.map((item, index) => (
          <li key={item.id}>
            <Link
              to="/markets/$marketId"
              params={{ marketId: item.id }}
              className="group flex items-start gap-3 px-4 py-3 min-h-[44px] hover:bg-page-bg/50 active:bg-page-bg transition-colors"
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">
                {index + 1}
              </span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary leading-snug line-clamp-2 group-hover:text-accent transition-colors">
                  {item.question}
                </p>
                
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-support font-medium">
                    {item.yesPercent}% Yes
                  </span>
                  {item.volume && (
                    <span className="text-xs text-text-tertiary">
                      {item.volume}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
