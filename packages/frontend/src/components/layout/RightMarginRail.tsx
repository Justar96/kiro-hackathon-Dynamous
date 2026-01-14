import { useState, useCallback } from 'react';
import type { MarketDataPoint, StanceValue } from '@debate-platform/shared';
import { AudienceStats } from '../debate/AudienceStats';
import { Skeleton } from '../common/Skeleton';

interface RightMarginRailProps {
  debateId: string;
  supportPrice: number;
  opposePrice: number;
  dataPoints?: MarketDataPoint[];
  userStance?: { before?: number; after?: number };
  debateStatus: 'active' | 'concluded';
  readingProgress: number;
  onBeforeStanceSubmit?: (stance: StanceValue) => void;
  onAfterStanceSubmit?: (stance: StanceValue) => void;
  afterUnlocked?: boolean;
  isSubmitting?: boolean;
  /** Whether user is logged in - shows AudienceStats for spectators */
  isAuthenticated?: boolean;
  /** Whether market data is still loading */
  isLoadingMarketData?: boolean;
}

/**
 * RightMarginRail - Consolidated market data and user stance dashboard
 * 
 * Design improvements:
 * - Removed redundant section navigation (left rail handles this)
 * - Unified visual hierarchy with clear sections
 * - Compact market meter with improved readability
 * - Better progress visualization
 * - Cleaner stance input UI
 */
export function RightMarginRail({
  debateId,
  supportPrice,
  opposePrice,
  dataPoints = [],
  userStance,
  debateStatus,
  readingProgress,
  onBeforeStanceSubmit,
  onAfterStanceSubmit,
  afterUnlocked = false,
  isSubmitting = false,
  isAuthenticated = false,
  isLoadingMarketData = false,
}: RightMarginRailProps) {
  const [beforeValue, setBeforeValue] = useState(userStance?.before ?? 50);
  const [afterValue, setAfterValue] = useState(userStance?.after ?? 50);
  const [beforeConfidence, setBeforeConfidence] = useState(3);
  const [afterConfidence, setAfterConfidence] = useState(3);

  const beforeLocked = userStance?.before !== undefined;
  const delta = beforeLocked && userStance?.after !== undefined && userStance?.before !== undefined
    ? userStance.after - userStance.before 
    : null;

  const handleBeforeSubmit = useCallback(() => {
    onBeforeStanceSubmit?.({ supportValue: beforeValue, confidence: beforeConfidence });
  }, [beforeValue, beforeConfidence, onBeforeStanceSubmit]);

  const handleAfterSubmit = useCallback(() => {
    onAfterStanceSubmit?.({ supportValue: afterValue, confidence: afterConfidence });
  }, [afterValue, afterConfidence, onAfterStanceSubmit]);

  return (
    <div className="space-y-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <span className={`
          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
          ${debateStatus === 'active' 
            ? 'bg-green-500/10 text-green-600' 
            : 'bg-gray-500/10 text-text-secondary'
          }
        `}>
          <span className={`w-1.5 h-1.5 rounded-full ${debateStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          {debateStatus === 'active' ? 'Live' : 'Concluded'}
        </span>
        
        {/* Reading Progress - Compact */}
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-divider rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${readingProgress}%` }}
            />
          </div>
          <span className="text-xs text-text-tertiary tabular-nums">{Math.round(readingProgress)}%</span>
        </div>
      </div>

      {/* Stance Breakdown - Redesigned */}
      <div className="bg-page-bg/80 rounded-small border border-divider p-4 space-y-3 shadow-paper">
        <div className="flex items-center justify-between pb-2 border-b border-divider">
          <h3 className="small-caps text-label text-text-secondary">Stance</h3>
          {isLoadingMarketData && <Skeleton className="h-3 w-12" />}
        </div>
        
        {/* Support/Oppose Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-support tabular-nums">{supportPrice}</span>
              <span className="text-xs text-support">%</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-oppose tabular-nums">{opposePrice}</span>
              <span className="text-xs text-oppose">%</span>
            </div>
          </div>
          
          <div className="relative h-2.5 bg-divider rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full bg-support transition-all duration-500 ease-out"
              style={{ width: `${supportPrice}%` }}
            />
            <div 
              className="absolute right-0 top-0 h-full bg-oppose transition-all duration-500 ease-out"
              style={{ width: `${opposePrice}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-text-tertiary">
            <span>Support</span>
            <span>Oppose</span>
          </div>
        </div>

        {/* Sparkline Chart */}
        {!isLoadingMarketData && dataPoints.length > 1 && (
          <div className="pt-2 border-t border-divider">
            <MiniSparkline dataPoints={dataPoints} />
          </div>
        )}
      </div>

      {/* User Stance Section */}
      {isAuthenticated ? (
        <div className="space-y-4">
          {/* Before Stance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Your Stance — Before
              </h3>
              {beforeLocked && (
                <span className="text-xs text-green-600">Locked</span>
              )}
            </div>
            
            {beforeLocked ? (
              <LockedStanceDisplay value={userStance?.before ?? 50} />
            ) : (
              <StanceInput
                value={beforeValue}
                confidence={beforeConfidence}
                onValueChange={setBeforeValue}
                onConfidenceChange={setBeforeConfidence}
                onSubmit={handleBeforeSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Lock In"
              />
            )}
          </div>

          {/* After Stance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide">
                Your Stance — After
              </h3>
              {delta !== null && (
                <span className={`text-xs font-medium ${delta > 0 ? 'text-support' : delta < 0 ? 'text-oppose' : 'text-text-secondary'}`}>
                  {delta > 0 ? '+' : ''}{delta}%
                </span>
              )}
            </div>
            
            {!beforeLocked ? (
              <p className="text-xs text-text-tertiary italic py-2">Record your initial stance first</p>
            ) : !afterUnlocked ? (
              <div className="py-2">
                <p className="text-xs text-text-tertiary italic">Keep reading to unlock</p>
                <div className="mt-2 h-1 bg-divider rounded-full overflow-hidden">
                  <div className="h-full bg-accent/30 transition-all" style={{ width: `${Math.min(readingProgress * 2, 100)}%` }} />
                </div>
              </div>
            ) : userStance?.after !== undefined ? (
              <div className="space-y-2">
                <LockedStanceDisplay value={userStance.after} />
                <button
                  onClick={() => onAfterStanceSubmit?.({ supportValue: afterValue, confidence: afterConfidence })}
                  className="text-xs text-accent hover:underline"
                >
                  Update stance
                </button>
              </div>
            ) : (
              <StanceInput
                value={afterValue}
                confidence={afterConfidence}
                onValueChange={setAfterValue}
                onConfidenceChange={setAfterConfidence}
                onSubmit={handleAfterSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Record"
              />
            )}
          </div>
        </div>
      ) : (
        /* Spectator View */
        <div className="space-y-3">
          <AudienceStats debateId={debateId} />
          <p className="text-xs text-text-tertiary text-center py-2 border-t border-hairline">
            Sign in to track your stance
          </p>
        </div>
      )}
    </div>
  );
}

/** Displays a locked stance value with visual indicator */
function LockedStanceDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-3 p-2 bg-page-bg/50 rounded-lg">
      <div className="flex-1 h-2 bg-divider rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums w-10 text-right">{value}%</span>
    </div>
  );
}

/** Stance input component with slider and confidence */
function StanceInput({
  value,
  confidence,
  onValueChange,
  onConfidenceChange,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  value: number;
  confidence: number;
  onValueChange: (v: number) => void;
  onConfidenceChange: (v: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-3 p-3 bg-page-bg/50 rounded-small border border-divider">
      {/* Slider */}
      <div className="space-y-1">
        <MiniSlider value={value} onChange={onValueChange} disabled={isSubmitting} />
        <div className="flex justify-between text-xs text-text-tertiary">
          <span>Support</span>
          <span className="font-medium text-text-primary">{value}%</span>
          <span>Oppose</span>
        </div>
      </div>
      
      {/* Confidence */}
      <div className="space-y-1">
        <label className="text-xs text-text-tertiary">Confidence</label>
        <MiniConfidence value={confidence} onChange={onConfidenceChange} disabled={isSubmitting} />
      </div>
      
      {/* Submit */}
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="w-full py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : submitLabel}
      </button>
    </div>
  );
}

// Mini Sparkline for margin display
function MiniSparkline({ dataPoints }: { dataPoints: MarketDataPoint[] }) {
  if (dataPoints.length < 2) return null;

  const values = dataPoints.map(dp => dp.supportPrice);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 160;
  const height = 32;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  const latestValue = values[values.length - 1];
  const firstValue = values[0];
  const trendDirection = latestValue >= firstValue ? 'upward' : 'downward';
  const trendPercent = Math.abs(latestValue - firstValue).toFixed(1);

  return (
    <svg 
      width={width} 
      height={height} 
      className="w-full"
      role="img"
      aria-label={`Price trend: ${trendDirection} ${trendPercent}%`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="#2D8A6E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Mini Slider for margin display
function MiniSlider({ 
  value, 
  onChange, 
  disabled = false 
}: { 
  value: number; 
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative py-1">
      <div className="h-2 bg-divider rounded-full overflow-hidden">
        <div 
          className="h-full bg-accent transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-accent rounded-full shadow-sm pointer-events-none"
        style={{ left: `calc(${value}% - 8px)` }}
      />
    </div>
  );
}

// Mini Confidence selector for margin display
function MiniConfidence({ 
  value, 
  onChange,
  disabled = false 
}: { 
  value: number; 
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5 justify-center">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          disabled={disabled}
          className={`
            w-6 h-6 rounded-full text-xs font-medium transition-all
            ${value === level 
              ? 'bg-accent text-white scale-110' 
              : 'bg-divider text-text-secondary hover:bg-divider/80'
            } 
            disabled:opacity-50
          `}
          title={`Confidence: ${level}`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

export default RightMarginRail;
