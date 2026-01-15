import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { XIcon } from '../icons';

const ONBOARDING_DISMISSED_KEY = 'thesis-onboarding-dismissed';

interface OnboardingBannerProps {
  onDismiss?: () => void;
}

/**
 * OnboardingBanner - First-time visitor welcome with quick explanation
 * Dismissible and persisted in localStorage
 */
export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
    setIsDismissed(dismissed === 'true');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  return (
    <section className="bg-gradient-to-br from-blue-50/80 via-white to-purple-50/50 rounded-xl border border-gray-200/80 p-5 sm:p-6 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <span className="text-lg">💡</span>
            </div>
            <h2 className="font-semibold text-lg text-gray-900">
              Welcome to Thesis
            </h2>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            A place where minds change through structured reasoning, not shouting matches.
          </p>
          
          {/* How it works - 3 steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <div className="flex items-start gap-2.5 p-2.5 bg-white/60 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">1</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Record your stance</p>
                <p className="text-xs text-gray-400">Before reading arguments</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 bg-white/60 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">2</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">Read the debate</p>
                <p className="text-xs text-gray-400">3 rounds of arguments</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 p-2.5 bg-white/60 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">3</span>
              <div>
                <p className="text-xs font-semibold text-gray-700">See if you changed</p>
                <p className="text-xs text-gray-400">Track persuasion impact</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/debates/new"
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors shadow-sm"
            >
              Start a Debate
            </Link>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
        
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-500 transition-colors rounded-full hover:bg-gray-100"
          aria-label="Dismiss welcome banner"
        >
          <XIcon size="sm" decorative />
        </button>
      </div>
    </section>
  );
}

/**
 * Reset onboarding banner (for testing)
 */
export function resetOnboardingBanner() {
  localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
}

export default OnboardingBanner;
