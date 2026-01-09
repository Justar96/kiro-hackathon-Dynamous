import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useSession } from '../lib/useSession';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createDebate } from '../lib/mutations';

export const Route = createFileRoute('/debates/new')({
  component: NewDebatePage,
});

/**
 * Debate creation form with resolution input and side selection
 * Requirements: 1.1, 1.2, 15.3
 */
function NewDebatePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [resolution, setResolution] = useState('');
  const [side, setSide] = useState<'support' | 'oppose'>('support');
  const [error, setError] = useState<string | null>(null);

  const createDebateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Authentication required');
      
      // Use the Neon Auth user ID as the token (our backend uses this for auth)
      const token = user.id;
      if (!token) throw new Error('Unable to get authentication token');
      
      return createDebate({ resolution, creatorSide: side }, token);
    },
    onSuccess: (debate) => {
      queryClient.invalidateQueries({ queryKey: ['debates'] });
      navigate({ to: '/debates/$debateId', params: { debateId: debate.id } });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Require authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-6 sm:p-8 text-center">
            <h1 className="font-heading text-xl sm:text-heading-2 text-text-primary">
              Sign in to create a debate
            </h1>
            <p className="mt-3 text-body-small sm:text-body text-text-secondary">
              You need to be signed in to start a new debate.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                to="/auth/$pathname"
                params={{ pathname: 'sign-in' }}
                className="px-4 py-2 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors active:bg-text-primary/80"
              >
                Sign In
              </Link>
              <Link
                to="/auth/$pathname"
                params={{ pathname: 'sign-up' }}
                className="px-4 py-2 border border-black/[0.08] text-text-primary text-body-small font-medium rounded-subtle hover:bg-page-bg transition-colors active:bg-page-bg/80"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const charCount = resolution.length;
  const isValid = charCount > 0 && charCount <= 500;
  const isSubmitting = createDebateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!isValid) {
      setError('Resolution must be between 1 and 500 characters');
      return;
    }
    
    createDebateMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-paper mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Back link */}
        <nav className="mb-6 sm:mb-8">
          <Link 
            to="/" 
            className="text-text-secondary hover:text-text-primary text-body-small transition-colors"
          >
            ← Back to Index
          </Link>
        </nav>

        {/* Header */}
        <header className="mb-6 sm:mb-8">
          <h1 className="font-heading text-2xl sm:text-heading-1 text-text-primary">
            New Debate
          </h1>
          <p className="mt-2 text-body-small sm:text-body text-text-secondary">
            Create a resolution for structured debate
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-paper rounded-small border border-black/[0.08] shadow-paper p-4 sm:p-6">
          {/* Resolution Input */}
          <div className="mb-5 sm:mb-6">
            <label 
              htmlFor="resolution" 
              className="block text-label uppercase tracking-wider text-text-secondary mb-2"
            >
              Resolution
            </label>
            <textarea
              id="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Enter a clear, debatable claim (e.g., 'Remote work reduces productivity for most teams')"
              className="w-full px-3 sm:px-4 py-3 border border-black/[0.08] rounded-subtle text-body-small sm:text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              rows={4}
              maxLength={500}
              disabled={isSubmitting}
            />
            <div className="mt-2 flex items-start sm:items-center justify-between gap-2">
              <p className="text-caption text-text-tertiary flex-1">
                A good resolution is specific, debatable, and takes a clear position.
              </p>
              <span className={`text-caption flex-shrink-0 ${charCount > 500 ? 'text-oppose' : 'text-text-tertiary'}`}>
                {charCount}/500
              </span>
            </div>
          </div>

          {/* Side Selection */}
          <div className="mb-5 sm:mb-6">
            <label className="block text-label uppercase tracking-wider text-text-secondary mb-3">
              Your Position
            </label>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setSide('support')}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-3 rounded-subtle border transition-colors active:scale-[0.98] ${
                  side === 'support'
                    ? 'bg-support/10 border-support text-support'
                    : 'border-black/[0.08] text-text-secondary hover:border-support/50'
                }`}
              >
                <span className="block text-label uppercase tracking-wider mb-1">For</span>
                <span className="block text-body-small">Support the resolution</span>
              </button>
              <button
                type="button"
                onClick={() => setSide('oppose')}
                disabled={isSubmitting}
                className={`flex-1 px-4 py-3 rounded-subtle border transition-colors active:scale-[0.98] ${
                  side === 'oppose'
                    ? 'bg-oppose/10 border-oppose text-oppose'
                    : 'border-black/[0.08] text-text-secondary hover:border-oppose/50'
                }`}
              >
                <span className="block text-label uppercase tracking-wider mb-1">Against</span>
                <span className="block text-body-small">Oppose the resolution</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 px-4 py-3 bg-oppose/10 border border-oppose/20 rounded-subtle">
              <p className="text-body-small text-oppose">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-3">
            <Link
              to="/"
              className="px-4 py-2 text-text-secondary text-body-small font-medium hover:text-text-primary transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-6 py-2 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Debate'}
            </button>
          </div>
        </form>

        {/* Info Section */}
        <section className="mt-8 text-center">
          <p className="text-caption text-text-tertiary">
            After creating, another user can join to argue the opposing side.
            <br />
            The debate will proceed through three rounds: Opening, Rebuttal, and Closing.
          </p>
        </section>
      </div>
    </div>
  );
}
