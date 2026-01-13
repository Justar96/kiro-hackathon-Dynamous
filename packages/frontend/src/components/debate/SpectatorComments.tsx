import { useState, useCallback, useMemo } from 'react';
import type { Comment, User } from '@debate-platform/shared';
import { HorizontalDivider } from '../ui/HorizontalDivider';

interface SpectatorCommentsProps {
  debateId: string;
  comments: Comment[];
  users?: Map<string, User>;
  currentUserId?: string;
  onAddComment: (content: string, parentId?: string | null) => void;
  isSubmitting?: boolean;
}

/**
 * SpectatorComments displays the spectator discussion section.
 * Visually distinct from debate rounds with threaded replies.
 * 
 * Requirements: 8.1, 8.4
 */
export function SpectatorComments({
  comments,
  users,
  currentUserId,
  onAddComment,
  isSubmitting = false,
}: SpectatorCommentsProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyContent, setReplyContent] = useState('');

  // Build threaded comment structure
  const threadedComments = useMemo(() => {
    return buildCommentTree(comments);
  }, [comments]);

  const handleSubmitComment = useCallback(() => {
    if (!newCommentContent.trim()) return;
    onAddComment(newCommentContent.trim());
    setNewCommentContent('');
  }, [newCommentContent, onAddComment]);

  const handleSubmitReply = useCallback((parentId: string) => {
    if (!replyContent.trim()) return;
    onAddComment(replyContent.trim(), parentId);
    setReplyContent('');
    setReplyingTo(null);
  }, [replyContent, onAddComment]);

  const handleCancelReply = useCallback(() => {
    setReplyingTo(null);
    setReplyContent('');
  }, []);

  return (
    <section 
      id="comments" 
      className="mt-8 scroll-mt-8"
      aria-labelledby="comments-heading"
    >
      {/* Horizontal divider before comments section - Requirements: 3.1, 3.2, 3.5 */}
      <HorizontalDivider spacing="lg" />
      
      {/* Section header - visually distinct from debate rounds */}
      <header className="mb-3">
        <h2 
          id="comments-heading"
          className="font-heading text-heading-2 text-text-primary"
        >
          Spectator Discussion
        </h2>
        <p className="text-body-small text-text-secondary mt-0.5">
          Share your thoughts on this debate.
        </p>
      </header>

      {/* New comment form */}
      {currentUserId && (
        <CommentForm
          value={newCommentContent}
          onChange={setNewCommentContent}
          onSubmit={handleSubmitComment}
          placeholder="Add to the discussion..."
          isSubmitting={isSubmitting}
        />
      )}

      {/* Comments list */}
      <div className="mt-4 space-y-3">
        {threadedComments.length === 0 ? (
          <EmptyComments isAuthenticated={!!currentUserId} />
        ) : (
          threadedComments.map((thread) => (
            <CommentThread
              key={thread.comment.id}
              thread={thread}
              users={users}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              replyContent={replyContent}
              onReplyClick={setReplyingTo}
              onReplyContentChange={setReplyContent}
              onSubmitReply={handleSubmitReply}
              onCancelReply={handleCancelReply}
              isSubmitting={isSubmitting}
              depth={0}
            />
          ))
        )}
      </div>
    </section>
  );
}

/**
 * Comment form for new comments and replies.
 */
interface CommentFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  isSubmitting?: boolean;
  isReply?: boolean;
}

function CommentForm({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Write a comment...',
  isSubmitting = false,
  isReply = false,
}: CommentFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === 'Escape' && onCancel) {
      onCancel();
    }
  };

  return (
    <div className={`${isReply ? 'mt-3' : ''}`}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isSubmitting}
        className={`
          w-full px-4 py-3 
          bg-gray-50 border border-gray-200 rounded-subtle
          text-body text-text-primary placeholder:text-text-tertiary
          focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-none
          ${isReply ? 'min-h-[80px]' : 'min-h-[100px]'}
        `}
        rows={isReply ? 2 : 3}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-caption text-text-tertiary">
          {isReply ? 'Press Esc to cancel' : 'Press ⌘+Enter to submit'}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            /* Cancel button - 44px minimum touch target for accessibility (Requirement 8.4) */
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="min-h-[44px] px-3 text-body-small text-text-secondary hover:text-text-primary transition-colors inline-flex items-center"
            >
              Cancel
            </button>
          )}
          {/* Submit button - 44px minimum touch target for accessibility (Requirement 8.4) */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !value.trim()}
            className="min-h-[44px] px-4 bg-accent text-white text-body-small rounded-subtle hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
          >
            {isSubmitting ? 'Posting...' : isReply ? 'Reply' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Single comment with optional replies.
 */
interface CommentThreadProps {
  thread: CommentNode;
  users?: Map<string, User>;
  currentUserId?: string;
  replyingTo: string | null;
  replyContent: string;
  onReplyClick: (commentId: string | null) => void;
  onReplyContentChange: (content: string) => void;
  onSubmitReply: (parentId: string) => void;
  onCancelReply: () => void;
  isSubmitting?: boolean;
  depth: number;
}

function CommentThread({
  thread,
  users,
  currentUserId,
  replyingTo,
  replyContent,
  onReplyClick,
  onReplyContentChange,
  onSubmitReply,
  onCancelReply,
  isSubmitting,
  depth,
}: CommentThreadProps) {
  const { comment, replies } = thread;
  const author = users?.get(comment.userId);
  const isReplying = replyingTo === comment.id;
  const maxDepth = 3; // Limit nesting depth

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l border-gray-100' : ''}`}>
      {/* Comment content */}
      <article className="group">
        {/* Author info */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-body-small font-medium text-text-primary">
            {author?.username || 'Anonymous'}
          </span>
          {author && (
            <>
              <span className="text-caption text-text-tertiary">·</span>
              <span className="text-caption text-text-tertiary">
                Rep: {author.reputationScore.toFixed(0)}
              </span>
            </>
          )}
          <span className="text-caption text-text-tertiary">·</span>
          <time className="text-caption text-text-tertiary">
            {formatRelativeTime(comment.createdAt)}
          </time>
        </div>

        {/* Comment text */}
        <p className="text-body text-text-primary leading-relaxed">
          {comment.content}
        </p>

        {/* Actions - 44px minimum touch target for accessibility (Requirement 8.4) */}
        {currentUserId && depth < maxDepth && (
          <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReplyClick(isReplying ? null : comment.id)}
              className="min-h-[44px] px-2 text-caption text-text-tertiary hover:text-accent transition-colors inline-flex items-center"
            >
              {isReplying ? 'Cancel' : 'Reply'}
            </button>
          </div>
        )}

        {/* Reply form */}
        {isReplying && (
          <CommentForm
            value={replyContent}
            onChange={onReplyContentChange}
            onSubmit={() => onSubmitReply(comment.id)}
            onCancel={onCancelReply}
            placeholder={`Reply to ${author?.username || 'this comment'}...`}
            isSubmitting={isSubmitting}
            isReply
          />
        )}
      </article>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {replies.map((reply) => (
            <CommentThread
              key={reply.comment.id}
              thread={reply}
              users={users}
              currentUserId={currentUserId}
              replyingTo={replyingTo}
              replyContent={replyContent}
              onReplyClick={onReplyClick}
              onReplyContentChange={onReplyContentChange}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              isSubmitting={isSubmitting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Empty state when no comments exist.
 */
function EmptyComments({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="py-6 text-center">
      <p className="text-body text-text-secondary">
        No comments yet.
      </p>
      {isAuthenticated ? (
        <p className="text-body-small text-text-tertiary mt-0.5">
          Be the first to share your thoughts.
        </p>
      ) : (
        <p className="text-body-small text-text-tertiary mt-0.5">
          Sign in to join the discussion.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Utility Types and Functions
// ============================================================================

interface CommentNode {
  comment: Comment;
  replies: CommentNode[];
}

/**
 * Build a tree structure from flat comments array.
 * Top-level comments (parentId = null) are roots.
 */
function buildCommentTree(comments: Comment[]): CommentNode[] {
  const commentMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  // First pass: create nodes
  comments.forEach((comment) => {
    commentMap.set(comment.id, { comment, replies: [] });
  });

  // Second pass: build tree
  comments.forEach((comment) => {
    const node = commentMap.get(comment.id)!;
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  // Sort by creation date (oldest first for chronological order)
  const sortByDate = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => 
      new Date(a.comment.createdAt).getTime() - new Date(b.comment.createdAt).getTime()
    );
    nodes.forEach((node) => sortByDate(node.replies));
  };
  sortByDate(roots);

  return roots;
}

/**
 * Format a date as relative time (e.g., "2 hours ago").
 */
function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default SpectatorComments;
