import { SANDBOX_DEBATES_REQUIRED } from '@debate-platform/shared';

interface SandboxProgressProps {
  debatesParticipated: number;
  sandboxCompleted: boolean;
}

/**
 * SandboxProgress - Shows progress toward full voting weight
 * Explains sandbox mode and celebrates milestones
 */
export function SandboxProgress({ debatesParticipated, sandboxCompleted }: SandboxProgressProps) {
  if (sandboxCompleted) return null;

  const progress = Math.min(debatesParticipated, SANDBOX_DEBATES_REQUIRED);
  const percentage = (progress / SANDBOX_DEBATES_REQUIRED) * 100;
  const remaining = SANDBOX_DEBATES_REQUIRED - progress;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-xl p-4 mb-5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <span className="text-base">🌱</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-amber-900">
              Sandbox Mode
            </p>
            <span className="px-1.5 py-0.5 bg-amber-200/60 text-amber-700 text-[10px] font-semibold rounded uppercase">
              {remaining} left
            </span>
          </div>
          <p className="text-xs text-amber-700/80 mb-2.5">
            Complete {remaining} more debate{remaining !== 1 ? 's' : ''} for full voting weight (currently 50%)
          </p>
          
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-amber-200/80 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-amber-600">
              {progress}/{SANDBOX_DEBATES_REQUIRED}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SandboxProgress;
