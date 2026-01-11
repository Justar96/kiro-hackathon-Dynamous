import type { Debate, MarketPrice } from '@debate-platform/shared';
import { DebateIndexRow } from './DebateIndexRow';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

interface DebateIndexListProps {
  debates: DebateWithMarket[];
  emptyMessage?: string;
}

/**
 * DebateIndexList displays debates as an index/reading list with library catalog aesthetic.
 * No comment previews, no thumbnails, no emoji reactions - just calm typography and generous spacing.
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */
export function DebateIndexList({ debates, emptyMessage = 'No debates yet.' }: DebateIndexListProps) {
  if (debates.length === 0) {
    return (
      <div className="bg-paper rounded-small border border-gray-100 p-8 sm:p-12 text-center">
        <p className="text-body text-text-secondary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-paper rounded-small border border-gray-100 shadow-paper">
      {/* Header row - hidden on mobile */}
      <div className="hidden sm:flex items-center gap-4 py-3 px-2 border-b border-gray-200 bg-page-bg/30">
        <div className="flex-1 min-w-0">
          <span className="text-label text-text-tertiary uppercase">Resolution</span>
        </div>
        <div className="w-16 flex-shrink-0 text-center">
          <span className="text-label text-text-tertiary uppercase">S/O</span>
        </div>
        <div className="w-12 flex-shrink-0 text-center hidden md:block">
          <span className="text-label text-text-tertiary uppercase">Trend</span>
        </div>
        <div className="w-16 flex-shrink-0 text-right">
          <span className="text-label text-text-tertiary uppercase">Minds</span>
        </div>
      </div>

      {/* Debate rows */}
      <div className="divide-y divide-gray-50">
        {debates.map(({ debate, marketPrice }) => (
          <DebateIndexRow 
            key={debate.id} 
            debate={debate} 
            marketPrice={marketPrice}
          />
        ))}
      </div>
    </div>
  );
}

export default DebateIndexList;
