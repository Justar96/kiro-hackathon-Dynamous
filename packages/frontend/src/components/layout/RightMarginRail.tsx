import { Skeleton } from '../common/Skeleton';

interface RightMarginRailProps {
  children?: React.ReactNode;
  isLoading?: boolean;
}

/**
 * RightMarginRail - Sidebar for market-related widgets
 */
export function RightMarginRail({ children, isLoading = false }: RightMarginRailProps) {
  if (isLoading) {
    return (
      <aside className="hidden lg:block w-[280px] shrink-0">
        <div className="sticky top-20 space-y-4">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden lg:block w-[280px] shrink-0">
      <div className="sticky top-20 space-y-4">
        {children}
      </div>
    </aside>
  );
}
