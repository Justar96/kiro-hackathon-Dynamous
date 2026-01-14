/**
 * Icon System Types and Constants
 * 
 * Provides consistent sizing, animation control, and accessibility props
 * for all icons throughout the application.
 */

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type AnimationTrigger = 'hover' | 'click' | 'mount' | 'state-change' | 'none';

export interface IconProps {
  /** Icon size variant */
  size?: IconSize;
  /** Additional CSS classes */
  className?: string;
  /** Animation trigger type */
  animate?: AnimationTrigger;
  /** Disable all animations */
  noAnimation?: boolean;
  /** Accessibility label for semantic icons */
  'aria-label'?: string;
  /** Whether icon is decorative (sets aria-hidden) */
  decorative?: boolean;
  /** Custom stroke width for outline icons */
  strokeWidth?: number;
}

/**
 * Maps size variants to Tailwind CSS classes
 * xs: 12px, sm: 16px, md: 20px, lg: 24px, xl: 32px
 */
export const SIZE_MAP: Record<IconSize, string> = {
  xs: 'w-3 h-3',    // 12px
  sm: 'w-4 h-4',    // 16px
  md: 'w-5 h-5',    // 20px
  lg: 'w-6 h-6',    // 24px
  xl: 'w-8 h-8',    // 32px
};
