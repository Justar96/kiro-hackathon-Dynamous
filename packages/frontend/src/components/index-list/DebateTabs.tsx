import { useEffect } from 'react';

export type DebateTabType = 'all' | 'my-debates' | 'watching';

interface DebateTabsProps {
  activeTab: DebateTabType;
  onTabChange: (tab: DebateTabType) => void;
  myDebatesCount?: number;
  watchingCount?: number;
  isAuthenticated?: boolean;
}

const TAB_STORAGE_KEY = 'debate-active-tab';

/**
 * DebateTabs - Paper-style underline tab navigation
 */
export function DebateTabs({
  activeTab,
  onTabChange,
  myDebatesCount,
  isAuthenticated = false,
}: DebateTabsProps) {
  useEffect(() => {
    localStorage.setItem(TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  const tabs: Array<{
    id: DebateTabType;
    label: string;
    count?: number;
    requiresAuth?: boolean;
  }> = [
    { id: 'all', label: 'All' },
    { id: 'my-debates', label: 'My Debates', count: myDebatesCount, requiresAuth: true },
  ];

  return (
    <nav 
      className="flex items-center gap-6 border-b border-gray-200 mb-4" 
      role="tablist" 
      aria-label="Debate filters"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDisabled = tab.requiresAuth && !isAuthenticated;
        
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            disabled={isDisabled}
            onClick={() => !isDisabled && onTabChange(tab.id)}
            className={`
              relative pb-3 text-sm font-medium transition-colors
              ${isActive 
                ? 'text-text-primary' 
                : 'text-text-tertiary hover:text-text-secondary'
              }
              ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
              focus:outline-none focus-visible:text-accent
            `}
          >
            <span className="flex items-center gap-1.5">
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="text-[10px] text-text-tertiary">
                  ({tab.count})
                </span>
              )}
            </span>
            {/* Active underline */}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-text-primary" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function getPersistedTab(): DebateTabType {
  const stored = localStorage.getItem(TAB_STORAGE_KEY);
  if (stored === 'my-debates' || stored === 'watching') {
    return stored;
  }
  return 'all';
}

export default DebateTabs;
