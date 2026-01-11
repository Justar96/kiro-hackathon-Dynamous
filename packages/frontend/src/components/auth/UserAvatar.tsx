/**
 * UserAvatar component - displays user avatar with image or initial fallback
 * 
 * Requirements: 5.1 - Display user's avatar image or initial
 */

export interface UserAvatarProps {
  /** Avatar image URL */
  src: string | null;
  /** User's display name for initial fallback */
  name: string | null;
  /** User's email for fallback initial */
  email: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

/**
 * Get the initial character for avatar fallback
 * Prioritizes name, falls back to email
 */
function getInitial(name: string | null, email: string): string {
  if (name && name.trim().length > 0) {
    return name.trim()[0].toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.trim()[0].toUpperCase();
  }
  return '?';
}

/**
 * Size classes for avatar variants
 */
const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
} as const;

/**
 * UserAvatar displays a user's profile image or falls back to their initial
 * Uses platform styling with rounded-small border radius and proper contrast
 */
export function UserAvatar({
  src,
  name,
  email,
  size = 'md',
  className = '',
  'data-testid': testId,
}: UserAvatarProps) {
  const initial = getInitial(name, email);
  const sizeClass = sizeClasses[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name || email}
        className={`${sizeClass} rounded-small object-cover border border-hairline ${className}`}
        data-testid={testId}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-small bg-text-primary text-paper flex items-center justify-center font-semibold select-none border border-text-primary ${className}`}
      data-testid={testId}
      aria-label={name || email}
    >
      {initial}
    </div>
  );
}

export default UserAvatar;
