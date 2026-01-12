import { useState, useCallback } from 'react';
import type { MarketDataPoint, StanceSpike, StanceValue } from '@debate-platform/shared';
import { AudienceStats } from '../debate/AudienceStats';

interface RightMarginRailProps {
  debateId: string;
  supportPrice: number;
  opposePrice: number;
  dataPoints?: MarketDataPoint[];
  spikes?: StanceSpike[];
  userStance?: { before?: number; after?: number };
  debateStatus: 'active' | 'concluded';
  readingProgress: number;
  onBeforeStanceSubmit?: (stance: StanceValue) => void;
  onAfterStanceSubmit?: (stance: StanceValue) => void;
  afterUnlocked?: boolean;
  isSubmitting?: boolean;
  /** Whether user is logged in - shows AudienceStats for spectators */
  isAuthenticated?: boolean;
}

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
      {/* Support/Oppose Meter */}
      <div className="space-y-1.5">
        <h3 className="label-text">Market Position</h3>
        <div className="space-y-1">
          <div className="flex justify-between text-body-small">
            <span className="text-support font-medium">{supportPrice}%</span>
            <span className="text-oppose font-medium">{opposePrice}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-support transition-all duration-300"
              style={{ width: `${supportPrice}%` }}
            />
            <div 
              className="h-full bg-oppose transition-all duration-300"
              style={{ width: `${opposePrice}%` }}
            />
          </div>
          <div className="flex justify-between text-caption">
            <span>Support</span>
            <span>Oppose</span>
          </div>
        </div>
      </div>

      {/* Sparkline Chart */}
      {dataPoints.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="label-text">Trend</h3>
          <MiniSparkline dataPoints={dataPoints} />
        </div>
      )}

      {/* Before Stance - only for authenticated users */}
      {isAuthenticated ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="label-text">Before</h3>
            {beforeLocked && (
              <span className="text-support text-xs animate-check">✓</span>
            )}
          </div>
          {beforeLocked ? (
            <div className="flex items-center gap-2 animate-lock rounded-sm p-1 -m-1">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-text-secondary transition-all"
                  style={{ width: `${userStance?.before}%` }}
                />
              </div>
              <span className="text-caption w-8 text-right">{userStance?.before}%</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <MiniSlider 
                value={beforeValue} 
                onChange={setBeforeValue}
                disabled={isSubmitting}
              />
              <MiniConfidence 
                value={beforeConfidence} 
                onChange={setBeforeConfidence}
                disabled={isSubmitting}
              />
              <button
                onClick={handleBeforeSubmit}
                disabled={isSubmitting}
                className="w-full py-1.5 text-xs bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Lock In'}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Audience Stats for spectators */
        <div className="space-y-1.5">
          <AudienceStats debateId={debateId} />
          <p className="text-caption text-text-tertiary italic pt-2">
            Sign in to track your own stance
          </p>
        </div>
      )}

      {/* After Stance - only for authenticated users */}
      {isAuthenticated && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <h3 className="label-text">After</h3>
            {delta !== null && (
              <span className={`text-xs font-medium animate-delta ${delta > 0 ? 'text-support' : delta < 0 ? 'text-oppose' : 'text-text-secondary'}`}>
                Δ {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>
          {!beforeLocked ? (
            <p className="text-caption italic">Record your Before stance first</p>
          ) : !afterUnlocked ? (
            <p className="text-caption italic">Keep reading to unlock</p>
          ) : userStance?.after !== undefined ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all"
                    style={{ width: `${userStance.after}%` }}
                  />
                </div>
                <span className="text-caption w-8 text-right">{userStance.after}%</span>
              </div>
              {/* Allow updating after stance */}
              <button
                onClick={() => onAfterStanceSubmit?.({ supportValue: afterValue, confidence: afterConfidence })}
                className="w-full py-1 text-xs text-accent hover:underline"
              >
                Update
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <MiniSlider 
                value={afterValue} 
                onChange={setAfterValue}
                disabled={isSubmitting}
              />
              <MiniConfidence 
                value={afterConfidence} 
                onChange={setAfterConfidence}
                disabled={isSubmitting}
              />
              <button
                onClick={handleAfterSubmit}
                disabled={isSubmitting}
                className="w-full py-1.5 text-xs bg-accent text-white rounded-subtle hover:bg-accent-hover transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Record'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reading Progress */}
      <div className="space-y-1.5">
        <h3 className="label-text">Progress</h3>
        <div className="relative h-20 w-1 bg-gray-100 rounded-full mx-auto">
          <div 
            className="absolute bottom-0 left-0 right-0 bg-accent rounded-full transition-all duration-300"
            style={{ height: `${readingProgress}%` }}
          />
        </div>
        <p className="text-caption text-center">{Math.round(readingProgress)}%</p>
      </div>

      {/* Debate Status */}
      <div className="pt-3 border-t border-hairline">
        <span className={`label-text ${debateStatus === 'active' ? 'text-support' : 'text-text-secondary'}`}>
          {debateStatus === 'active' ? '● Live' : '○ Concluded'}
        </span>
      </div>
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
  const height = 40;
  const padding = 4;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="w-full">
      <polyline
        points={points}
        fill="none"
        stroke="#059669"
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
    <div className="relative">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
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
        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-accent rounded-full shadow-sm pointer-events-none"
        style={{ left: `calc(${value}% - 6px)` }}
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
    <div className="flex gap-1 justify-center">
      {[1, 2, 3, 4, 5].map((level) => (
        <button
          key={level}
          onClick={() => onChange(level)}
          disabled={disabled}
          className={`w-5 h-5 rounded-full text-xs transition-colors ${
            value === level 
              ? 'bg-accent text-white' 
              : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
          } disabled:opacity-50`}
          title={`Confidence: ${level}`}
        >
          {level}
        </button>
      ))}
    </div>
  );
}

export default RightMarginRail;
