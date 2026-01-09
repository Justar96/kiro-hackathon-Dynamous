/**
 * Skeleton components for paper-style loading states
 * Subtle, calm loading indicators that match the paper aesthetic
 */

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton element with pulse animation
 */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`bg-gray-100 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Text line skeleton
 */
export function SkeletonText({ 
  lines = 1, 
  className = '' 
}: { 
  lines?: number; 
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
}

/**
 * Heading skeleton
 */
export function SkeletonHeading({ className = '' }: SkeletonProps) {
  return <Skeleton className={`h-8 w-2/3 ${className}`} />;
}

/**
 * Avatar skeleton
 */
export function SkeletonAvatar({ 
  size = 'md' 
}: { 
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };
  
  return <Skeleton className={`${sizeClasses[size]} rounded-full`} />;
}

/**
 * Card skeleton - paper-style card loading state
 */
export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-paper rounded-small border border-gray-100 shadow-paper p-6 ${className}`}>
      <SkeletonHeading className="mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
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
