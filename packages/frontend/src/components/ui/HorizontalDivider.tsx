/**
 * HorizontalDivider component for paper-style section separation
 * Subtle divider lines that match the academic paper aesthetic
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

// ============================================================================
// Types
// ============================================================================

export type DividerSpacing = 'sm' | 'md' | 'lg';

export interface HorizontalDividerProps {
  /** Spacing variant controlling margin above and below */
  spacing?: DividerSpacing;
  /** Optional decorative center element (short centered line) */
  decorative?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Test ID for property-based testing */
  'data-testid'?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spacing values in pixels for each variant
 * Used for consistent margins above and below the divider
 */
export const SPACING_VALUES: Record<DividerSpacing, number> = {
  sm: 16,
  md: 24,
  lg: 32,
};

/**
 * Tailwind classes for each spacing variant
 */
const SPACING_CLASSES: Record<DividerSpacing, string> = {
  sm: 'my-4',   // 16px
  md: 'my-6',   // 24px
  lg: 'my-8',   // 32px
};

// ============================================================================
// Component
// ============================================================================

/**
 * HorizontalDivider - A subtle divider for separating content sections
 * 
 * Renders a 1px line in the divider color (#E5E5E0) with configurable
 * spacing above and below. Optionally renders a decorative short
 * centered line variant.
 * 
 * @example
 * // Standard divider with medium spacing
 * <HorizontalDivider spacing="md" />
 * 
 * // Decorative divider with large spacing
 * <HorizontalDivider spacing="lg" decorative />
 * 
 * // Small spacing divider
 * <HorizontalDivider spacing="sm" />
 */
export function HorizontalDivider({
  spacing = 'md',
  decorative = false,
  className = '',
  'data-testid': testId,
}: HorizontalDividerProps) {
  const spacingClass = SPACING_CLASSES[spacing];
  
  if (decorative) {
    // Decorative variant: short centered line
    return (
      <div 
        className={`flex justify-center ${spacingClass} ${className}`}
        role="separator"
        aria-orientation="horizontal"
        data-testid={testId}
        data-spacing={spacing}
        data-decorative="true"
      >
        <div className="w-16 h-px bg-divider" />
      </div>
    );
  }
  
  // Standard full-width divider
  return (
    <hr 
      className={`horizontal-rule ${spacingClass} ${className}`}
      role="separator"
      aria-orientation="horizontal"
      data-testid={testId}
      data-spacing={spacing}
      data-decorative="false"
    />
  );
}

export default HorizontalDivider;
