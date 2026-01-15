import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import type { Debate, MarketPrice } from '@thesis/shared';
import { useAuthModal } from '../auth';

interface DebateWithMarket {
  debate: Debate;
  marketPrice?: MarketPrice | null;
}

interface QuickStanceWidgetProps {
  debates: DebateWithMarket[];
  isAuthenticated: boolean;
  onStanceSubmit?: (debateId: string, value: number) => void;
}

/**
 * QuickStanceWidget - Low-friction entry point for new users
 * Shows a random active debate and lets users cast a quick stance
 */
export function QuickStanceWidget({ debates, isAuthenticated, onStanceSubmit }: QuickStanceWidgetProps) {
  const { openSignIn } = useAuthModal();
  const [stanceValue, setStanceValue] = useState(50);
  const [submitted, setSubmitted] = useState(false);

  // Pick a random active debate
  const activeDebates = debates.filter(d => d.debate.status === 'active' && d.debate.opposeDebaterId);
  const randomDebate = activeDebates.length > 0 
    ? activeDebates[Math.floor(Math.random() * activeDebates.length)]
    : null;

  if (!randomDebate) return null;

  const handleSubmit = () => {
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    onStanceSubmit?.(randomDebate.debate.id, stanceValue);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-gradient-to-r from-accent/5 to-support/5 rounded-small border border-accent/20 p-4 mb-6">
        <div className="text-center">
          <span className="text-2xl mb-2 block">✓</span>
          <p className="text-body text-text-primary font-medium">Stance recorded!</p>
          <Link 
            to="/debates/$debateId" 
            params={{ debateId: randomDebate.debate.id }}
            className="text-accent hover:underline text-body-small mt-1 inline-block"
          >
            Read the full debate →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="bg-gradient-to-r from-accent/5 to-support/5 rounded-small border border-accent/20 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎯</span>
        <h2 className="text-label uppercase tracking-wider text-text-secondary">
          Quick Stance
        </h2>
      </div>
      
      <p className="text-body text-text-primary font-medium mb-4 line-clamp-2">
        "{randomDebate.debate.resolution}"
      </p>
      
      {/* Stance slider */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max="100"
          value={stanceValue}
          onChange={(e) => setStanceValue(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-accent"
        />
        <div className="flex justify-between text-caption text-text-tertiary mt-1">
          <span className="text-oppose">Strongly Disagree</span>
          <span className="text-support">Strongly Agree</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-body-small text-text-secondary">
          Your stance: <strong className={stanceValue > 50 ? 'text-support' : stanceValue < 50 ? 'text-oppose' : 'text-text-primary'}>
            {stanceValue > 60 ? 'Agree' : stanceValue < 40 ? 'Disagree' : 'Neutral'}
          </strong>
        </span>
        <button
          onClick={handleSubmit}
          className="px-4 py-2 bg-accent text-white text-body-small font-medium rounded-subtle hover:bg-accent-hover transition-colors"
        >
          {isAuthenticated ? 'Submit & See Results' : 'Sign in to Submit'}
        </button>
      </div>
    </section>
  );
}

export default QuickStanceWidget;
