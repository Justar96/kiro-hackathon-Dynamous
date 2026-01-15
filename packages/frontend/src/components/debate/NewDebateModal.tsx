import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../common/Modal';
import { FormField } from '../common/FormField';
import { useToast } from '../common/Toast';
import { useSession, createDebate, useFormValidation, required, maxLength, DEBATE_TEMPLATES, getRandomTopic } from '../../lib';
import { useAuthModal } from '../auth/AuthModal';
import { PlusIcon, XIcon, SpinnerIcon } from '../icons';

// ============================================================================
// Context Types
// ============================================================================

interface NewDebateModalContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const NewDebateModalContext = createContext<NewDebateModalContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface NewDebateModalProviderProps {
  children: ReactNode;
}

/**
 * NewDebateModalProvider - Provides modal state and controls
 */
export function NewDebateModalProvider({ children }: NewDebateModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <NewDebateModalContext.Provider value={{ isOpen, open, close }}>
      {children}
    </NewDebateModalContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useNewDebateModal(): NewDebateModalContextValue {
  const context = useContext(NewDebateModalContext);
  if (!context) {
    throw new Error('useNewDebateModal must be used within a NewDebateModalProvider');
  }
  return context;
}

// ============================================================================
// Modal Content
// ============================================================================

interface NewDebateModalContentProps {
  isOpen: boolean;
  onClose: () => void;
}

// Animation delay helper for staggered entrance
const staggerDelay = (index: number) => ({
  animationDelay: `${index * 50}ms`,
});

function NewDebateModalContent({ isOpen, onClose }: NewDebateModalContentProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openSignIn } = useAuthModal();
  const { showToast } = useToast();
  
  const [side, setSide] = useState<'support' | 'oppose'>('support');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger entrance animation when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Form validation
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
      onClose();
      // Reset form
      form.resetForm();
      setSide('support');
      setShowSuggestions(false);
      // Navigate to the new debate
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

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    
    if (!form.validateAll()) {
      return;
    }
    
    createDebateMutation.mutate();
  }, [form, createDebateMutation]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      onClose();
      // Reset form on close
      form.resetForm();
      setSide('support');
      setShowSuggestions(false);
      setSubmitError(null);
    }
  }, [isSubmitting, onClose, form]);

  // If not authenticated, show sign-in prompt
  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="sm">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
            <PlusIcon size="lg" className="text-accent" decorative />
          </div>
          <h2 className="font-heading text-xl text-text-primary mb-2">
            Sign in to create a debate
          </h2>
          <p className="text-body-small text-text-secondary mb-6">
            You need to be signed in to start a new debate.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                handleClose();
                openSignIn();
              }}
              className="px-4 py-2 bg-accent text-white text-body-small font-medium rounded-lg hover:bg-accent-hover transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={handleClose}
              className="px-4 py-2 text-text-secondary text-body-small font-medium hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <div className="p-6 overflow-hidden">
        {/* Header - with entrance animation */}
        <div 
          className={`flex items-center justify-between mb-6 transition-all duration-300 ease-out ${
            isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
          style={staggerDelay(0)}
        >
          <div>
            <h2 className="font-heading text-xl text-text-primary">
              New Debate
            </h2>
            <p className="text-body-small text-text-secondary mt-1">
              Create a resolution for structured debate
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-text-tertiary hover:text-text-primary transition-all duration-200 rounded-lg hover:bg-page-bg hover:rotate-90 active:scale-90"
            aria-label="Close"
          >
            <XIcon size="md" decorative />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Resolution Input - with staggered entrance */}
          <div 
            className={`mb-5 transition-all duration-300 ease-out ${
              isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={staggerDelay(1)}
          >
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
              placeholder="Enter a clear, debatable claim (e.g., 'Remote work reduces productivity')"
              rows={3}
              disabled={isSubmitting}
              ref={form.fieldRefs.resolution}
              autoFocus
            />
            
            {/* Topic suggestions toggle with hover animation */}
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="mt-2 text-body-small text-accent hover:text-accent-hover transition-all duration-200 hover:translate-x-0.5"
            >
              <span className={`inline-block transition-transform duration-200 ${showSuggestions ? 'rotate-0' : 'rotate-0'}`}>
                {showSuggestions ? '−' : '+'}
              </span>
              {' '}
              {showSuggestions ? 'Hide suggestions' : 'Need inspiration?'}
            </button>
            
            {/* Topic suggestions panel with slide animation */}
            <div 
              className={`grid transition-all duration-300 ease-out ${
                showSuggestions ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-3 bg-page-bg rounded-lg border border-black/[0.05] max-h-40 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption text-text-secondary font-medium">
                      Topic Ideas
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const topic = getRandomTopic();
                        resolutionProps.onChange(topic);
                        setShowSuggestions(false);
                      }}
                      className="text-caption text-accent hover:text-accent-hover transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      Random
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEBATE_TEMPLATES.flatMap(cat => cat.topics.slice(0, 1)).slice(0, 6).map((topic, index) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          resolutionProps.onChange(topic);
                          setShowSuggestions(false);
                        }}
                        className="text-caption text-text-primary bg-paper px-2 py-1 rounded border border-black/[0.08] hover:border-accent hover:text-accent hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 text-left active:scale-95"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        {topic.length > 40 ? topic.slice(0, 40) + '...' : topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Selection with staggered entrance and micro-interactions */}
          <div 
            className={`mb-5 transition-all duration-300 ease-out ${
              isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={staggerDelay(2)}
          >
            <label className="block text-body-small font-medium text-text-primary mb-2">
              Your Position
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSide('support')}
                disabled={isSubmitting}
                className={`group relative px-3 py-2.5 rounded-lg border transition-all duration-200 overflow-hidden ${
                  side === 'support'
                    ? 'bg-support/10 border-support text-support scale-[1.02] shadow-sm'
                    : 'border-black/[0.08] text-text-secondary hover:border-support/50 hover:bg-support/5 active:scale-[0.98]'
                }`}
              >
                {/* Selection indicator dot */}
                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-support transition-all duration-200 ${
                  side === 'support' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`} />
                <span className="block text-caption font-medium">For</span>
                <span className={`block text-[11px] transition-colors duration-200 ${
                  side === 'support' ? 'text-support/70' : 'text-text-tertiary'
                }`}>Support</span>
              </button>
              <button
                type="button"
                onClick={() => setSide('oppose')}
                disabled={isSubmitting}
                className={`group relative px-3 py-2.5 rounded-lg border transition-all duration-200 overflow-hidden ${
                  side === 'oppose'
                    ? 'bg-oppose/10 border-oppose text-oppose scale-[1.02] shadow-sm'
                    : 'border-black/[0.08] text-text-secondary hover:border-oppose/50 hover:bg-oppose/5 active:scale-[0.98]'
                }`}
              >
                {/* Selection indicator dot */}
                <span className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-oppose transition-all duration-200 ${
                  side === 'oppose' ? 'opacity-100 scale-100' : 'opacity-0 scale-0'
                }`} />
                <span className="block text-caption font-medium">Against</span>
                <span className={`block text-[11px] transition-colors duration-200 ${
                  side === 'oppose' ? 'text-oppose/70' : 'text-text-tertiary'
                }`}>Oppose</span>
              </button>
            </div>
          </div>

          {/* Submit Error with shake animation */}
          {submitError && (
            <div className="mb-4 px-3 py-2 bg-oppose/10 border border-oppose/20 rounded-lg animate-[shake_0.5s_ease-in-out]">
              <p className="text-body-small text-oppose">{submitError}</p>
            </div>
          )}

          {/* Actions with staggered entrance */}
          <div 
            className={`flex items-center justify-end gap-3 pt-2 transition-all duration-300 ease-out ${
              isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
            }`}
            style={staggerDelay(3)}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-text-secondary text-body-small font-medium hover:text-text-primary transition-all duration-200 hover:bg-page-bg rounded-lg active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!form.isValid || isSubmitting}
              className="relative px-5 py-2 bg-accent text-white text-body-small font-medium rounded-lg hover:bg-accent-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm overflow-hidden"
            >
              {/* Loading spinner overlay */}
              <span className={`absolute inset-0 flex items-center justify-center bg-accent transition-opacity duration-200 ${
                isSubmitting ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}>
                <SpinnerIcon size="sm" className="animate-spin" decorative />
              </span>
              <span className={`transition-opacity duration-200 ${isSubmitting ? 'opacity-0' : 'opacity-100'}`}>
                Create Debate
              </span>
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

export { NewDebateModalContent };
export default NewDebateModalProvider;
