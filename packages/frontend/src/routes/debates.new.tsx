import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  useSession, 
  createDebate, 
  useFormValidation, 
  required, 
  maxLength, 
  DEBATE_TEMPLATES, 
  getRandomTopic 
} from '../lib';
import { FormField } from '../components/common/FormField';
import { useAuthModal, useToast } from '../components';

export const Route = createFileRoute('/debates/new')({
  component: NewDebatePage,
});

/**
 * Debate creation form with resolution input and side selection
 * Uses FormField component with validation and character count
 * Uses auth modal for unauthenticated users
 * Requirements: 1.1, 1.2, 1.5, 2.2, 7.1, 7.3, 7.5, 15.3
 */
function NewDebatePage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openSignIn, openSignUp } = useAuthModal();
  const { showToast } = useToast();
  
  const [side, setSide] = useState<'support' | 'oppose'>('support');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form validation with useFormValidation hook
  const form = useFormValidation({
    resolution: {
      initialValue: '',
      rules: [
        required('Resolution is required'),
        maxLength(500, 'Resolution must be 500 characters or less'),
      ],
    },
  });

  const createDebateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Authentication required');
      
      // Use the Neon Auth user ID as the token (our backend uses this for auth)
      const token = user.id;
      if (!token) throw new Error('Unable to get authentication token');
      
      return createDebate({ resolution: form.values.resolution, creatorSide: side }, token);
    },
    onSuccess: (debate) => {
      queryClient.invalidateQueries({ queryKey: ['debates'] });
      showToast({
        type: 'success',
        message: 'Debate created successfully!',
      });
      navigate({ to: '/debates/$debateId', params: { debateId: debate.id } });
    },
    onError: (err: Error) => {
      setSubmitError(err.message);
      showToast({
        type: 'error',
        message: err.message || 'Failed to create debate. Please try again.',
      });
    },
  });

  const isSubmitting = createDebateMutation.isPending;
  const resolutionProps = form.getFieldProps('resolution');

  // All hooks must be called before any early returns
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    // Validate all fields before submission (Requirements 7.3)
    if (!form.validateAll()) {
      return;
    }
    
    createDebateMutation.mutate();
  }, [form, createDebateMutation]);

  // Require authentication - show auth modal buttons instead of links
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
              <button
                onClick={() => openSignIn()}
                className="px-4 py-2 bg-text-primary text-paper text-body-small font-medium rounded-subtle hover:bg-text-primary/90 transition-colors active:bg-text-primary/80"
              >
                Sign In
              </button>
              <button
                onClick={() => openSignUp()}
                className="px-4 py-2 border border-black/[0.08] text-text-primary text-body-small font-medium rounded-subtle hover:bg-page-bg transition-colors active:bg-page-bg/80"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          {/* Resolution Input - Using FormField component (Requirements 7.1, 7.5) */}
          <div className="mb-5 sm:mb-6">
            <FormField
              name="resolution"
              label="Resolution"
              type="textarea"
              value={resolutionProps.value}
              onChange={resolutionProps.onChange}
              onBlur={resolutionProps.onBlur}
              error={resolutionProps.error}
              touched={form.touched.resolution}
              required
              maxLength={500}
              showCharCount={true}
              placeholder="Enter a clear, debatable claim (e.g., 'Remote work reduces productivity for most teams')"
              rows={4}
              disabled={isSubmitting}
              helpText="A good resolution is specific, debatable, and takes a clear position."
              ref={form.fieldRefs.resolution}
            />
            
            {/* Topic suggestions toggle */}
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="mt-2 text-body-small text-accent hover:text-accent-hover transition-colors"
            >
              {showSuggestions ? '− Hide suggestions' : '+ Need inspiration? See topic ideas'}
            </button>
            
            {/* Topic suggestions panel */}
            {showSuggestions && (
              <div className="mt-3 p-4 bg-page-bg rounded-subtle border border-black/[0.05]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-label uppercase tracking-wider text-text-secondary">
                    Topic Ideas
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const topic = getRandomTopic();
                      resolutionProps.onChange(topic);
                      setShowSuggestions(false);
                    }}
                    className="text-caption text-accent hover:text-accent-hover"
                  >
                    🎲 Random topic
                  </button>
                </div>
                <div className="space-y-3">
                  {DEBATE_TEMPLATES.map((category) => (
                    <div key={category.category}>
                      <p className="text-caption font-medium text-text-secondary mb-1.5">
                        {category.category}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {category.topics.slice(0, 2).map((topic) => (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => {
                              resolutionProps.onChange(topic);
                              setShowSuggestions(false);
                            }}
                            className="text-caption text-text-primary bg-paper px-2 py-1 rounded border border-black/[0.08] hover:border-accent hover:text-accent transition-colors text-left"
                          >
                            {topic.length > 50 ? topic.slice(0, 50) + '...' : topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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

          {/* Submit Error Message */}
          {submitError && (
            <div className="mb-6 px-4 py-3 bg-oppose/10 border border-oppose/20 rounded-subtle">
              <p className="text-body-small text-oppose">{submitError}</p>
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
              disabled={!form.isValid || isSubmitting}
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
