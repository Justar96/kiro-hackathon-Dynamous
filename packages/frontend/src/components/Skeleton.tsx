/**
 * Skeleton components for paper-style loading states
 * Subtle, calm loading indicators that match the paper aesthetic
 * 
 * Requirements: 4.1, 4.3 - Display skeleton loaders matching paper-clean aesthetic
 */

// ============================================================================
// Types
// ============================================================================

export type SkeletonVariant = 'text' | 'heading' | 'paragraph' | 'avatar' | 'button' | 'card';

export interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  /** Test ID for property-based testing */
  'data-testid'?: string;
}

export interface SkeletonLoaderProps extends SkeletonProps {
  /** The type of skeleton to render */
  variant: SkeletonVariant;
  /** Number of lines for paragraph variant */
  lines?: number;
  /** Size for avatar variant */
  size?: 'sm' | 'md' | 'lg';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert width/height to CSS value
 */
function toCssValue(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return `${value}px`;
  return value;
}

// ============================================================================
// Base Skeleton Component
// ============================================================================

/**
 * Base skeleton element with pulse animation
 * Matches paper-clean aesthetic with warm gray tones
 */
export function Skeleton({ 
  className = '', 
  width, 
  height,
  'data-testid': testId,
}: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width !== undefined) style.width = toCssValue(width);
  if (height !== undefined) style.height = toCssValue(height);

  return (
    <div 
      className={`bg-gray-100 rounded animate-pulse ${className}`}
      style={Object.keys(style).length > 0 ? style : undefined}
      aria-hidden="true"
      data-testid={testId}
      data-skeleton="true"
    />
  );
}

// ============================================================================
// Variant Components
// ============================================================================

/**
 * Text line skeleton - single line of text
 */
export function SkeletonText({ 
  lines = 1, 
  className = '',
  width,
  height,
  'data-testid': testId,
}: { 
  lines?: number; 
  className?: string;
  width?: string | number;
  height?: string | number;
  'data-testid'?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} data-testid={testId} data-skeleton="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`${height ? '' : 'h-4'} ${i === lines - 1 && lines > 1 ? 'w-3/4' : width ? '' : 'w-full'}`}
          width={width}
          height={height}
        />
      ))}
    </div>
  );
}

/**
 * Heading skeleton - larger text for titles
 */
export function SkeletonHeading({ 
  className = '',
  width,
  height,
  'data-testid': testId,
}: SkeletonProps) {
  return (
    <Skeleton 
      className={`${height ? '' : 'h-8'} ${width ? '' : 'w-2/3'} ${className}`}
      width={width}
      height={height}
      data-testid={testId}
    />
  );
}

/**
 * Paragraph skeleton - multiple lines of text with natural variation
 */
export function SkeletonParagraph({
  lines = 3,
  className = '',
  'data-testid': testId,
}: {
  lines?: number;
  className?: string;
  'data-testid'?: string;
}) {
  // Create natural line width variation
  const lineWidths = Array.from({ length: lines }).map((_, i) => {
    if (i === lines - 1) return 'w-2/3'; // Last line shorter
    if (i % 3 === 1) return 'w-11/12'; // Some variation
    return 'w-full';
  });

  return (
    <div className={`space-y-2 ${className}`} data-testid={testId} data-skeleton="true">
      {lineWidths.map((widthClass, i) => (
        <Skeleton key={i} className={`h-4 ${widthClass}`} />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton - circular placeholder for user avatars
 */
export function SkeletonAvatar({ 
  size = 'md',
  width,
  height,
  'data-testid': testId,
}: { 
  size?: 'sm' | 'md' | 'lg';
  width?: string | number;
  height?: string | number;
  'data-testid'?: string;
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  // Use custom dimensions if provided, otherwise use size preset
  const hasCustomDimensions = width !== undefined || height !== undefined;
  
  return (
    <Skeleton 
      className={`${hasCustomDimensions ? '' : sizeClasses[size]} rounded-full`}
      width={width}
      height={height}
      data-testid={testId}
    />
  );
}

/**
 * Button skeleton - placeholder for action buttons
 */
export function SkeletonButton({
  className = '',
  width,
  height,
  'data-testid': testId,
}: SkeletonProps) {
  return (
    <Skeleton 
      className={`${height ? '' : 'h-10'} ${width ? '' : 'w-24'} rounded-md ${className}`}
      width={width}
      height={height}
      data-testid={testId}
    />
  );
}

/**
 * Card skeleton - paper-style card loading state
 */
export function SkeletonCard({ 
  className = '',
  width,
  height,
  'data-testid': testId,
}: SkeletonProps) {
  return (
    <div 
      className={`bg-paper rounded-small border border-gray-100 shadow-paper p-6 ${className}`}
      style={{
        width: toCssValue(width),
        height: toCssValue(height),
      }}
      data-testid={testId}
      data-skeleton="true"
    >
      <SkeletonHeading className="mb-4" />
      <SkeletonParagraph lines={3} />
    </div>
  );
}

// ============================================================================
// Unified SkeletonLoader Component
// ============================================================================

/**
 * Unified skeleton loader component with variant support
 * Matches paper-clean aesthetic with support for custom dimensions
 * 
 * Requirements: 4.1, 4.3
 * 
 * @example
 * // Text skeleton
 * <SkeletonLoader variant="text" />
 * 
 * // Heading with custom width
 * <SkeletonLoader variant="heading" width={200} />
 * 
 * // Paragraph with 5 lines
 * <SkeletonLoader variant="paragraph" lines={5} />
 * 
 * // Avatar with custom size
 * <SkeletonLoader variant="avatar" size="lg" />
 */
export function SkeletonLoader({
  variant,
  lines = 3,
  size = 'md',
  className = '',
  width,
  height,
  'data-testid': testId,
}: SkeletonLoaderProps) {
  switch (variant) {
    case 'text':
      return (
        <SkeletonText 
          lines={1} 
          className={className} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
    case 'heading':
      return (
        <SkeletonHeading 
          className={className} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
    case 'paragraph':
      return (
        <SkeletonParagraph 
          lines={lines} 
          className={className}
          data-testid={testId}
        />
      );
    case 'avatar':
      return (
        <SkeletonAvatar 
          size={size} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
    case 'button':
      return (
        <SkeletonButton 
          className={className} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
    case 'card':
      return (
        <SkeletonCard 
          className={className} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
    default:
      return (
        <Skeleton 
          className={className} 
          width={width} 
          height={height}
          data-testid={testId}
        />
      );
  }
}

/**
 * Debate row skeleton for index list
 */
export function SkeletonDebateRow() {
  return (
    <div className="flex items-center gap-2 sm:gap-4 py-4 px-2 sm:px-3 border-b border-gray-50">
      <div className="flex-1 min-w-0">
        <Skeleton className="h-5 w-full mb-2" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-20 hidden sm:block" />
        </div>
      </div>
      <Skeleton className="w-12 sm:w-16 h-4" />
      <Skeleton className="w-12 h-6 hidden md:block" />
      <Skeleton className="w-10 sm:w-16 h-4" />
    </div>
  );
}

/**
 * Argument block skeleton
 */
export function SkeletonArgumentBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/**
 * Market data skeleton for right margin
 */
export function SkeletonMarketData() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

/**
 * Stats card skeleton
 */
export function SkeletonStatCard() {
  return (
    <div className="bg-paper rounded-small border border-gray-100 shadow-paper p-3 sm:p-4">
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-full mt-2 hidden sm:block" />
    </div>
  );
}

export default Skeleton;
