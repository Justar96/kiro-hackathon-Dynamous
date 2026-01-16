/**
 * Home Page - Market Feed
 *
 * Reddit-style compact feed with 3-column layout.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'motion/react';
import { CreateMarketForm } from '../components/market';
import { Modal, useToast, PlusIcon, InfiniteFeed, TrendingRail } from '../components';
import { IndexThreeColumnLayout } from '../components/layout/IndexThreeColumnLayout';
import { useWalletConnection } from '../lib/hooks/web3/useWalletConnection';

export const Route = createFileRoute('/')({
  component: HomePage,
});

// Mock markets for development
const MOCK_MARKETS = [
  { id: 'mock-1', question: 'Will Bitcoin exceed $100,000 by end of 2026?', yesPercent: 72, endDate: 'Dec 31, 2026', category: 'Crypto', volume: '$1.2k' },
  { id: 'mock-2', question: 'Will AI replace 50% of coding jobs within 5 years?', yesPercent: 34, endDate: 'Jan 15, 2031', category: 'Technology', volume: '$890' },
  { id: 'mock-3', question: 'Will the US enter a recession in 2026?', yesPercent: 45, endDate: 'Dec 31, 2026', category: 'Economics', volume: '$2.1k' },
  { id: 'mock-4', question: 'Will SpaceX successfully land humans on Mars before 2030?', yesPercent: 28, endDate: 'Dec 31, 2029', category: 'Science', volume: '$450' },
  { id: 'mock-5', question: 'Will remote work remain the dominant work model in tech?', yesPercent: 61, endDate: 'Jun 30, 2027', category: 'Business', volume: '$780' },
  { id: 'mock-6', question: 'Will Ethereum flip Bitcoin in market cap by 2028?', yesPercent: 18, endDate: 'Dec 31, 2028', category: 'Crypto', volume: '$3.4k' },
  { id: 'mock-7', question: 'Will AGI be achieved before 2030?', yesPercent: 22, endDate: 'Dec 31, 2029', category: 'Technology', volume: '$5.2k' },
  { id: 'mock-8', question: 'Will Tesla stock exceed $500 by end of 2026?', yesPercent: 41, endDate: 'Dec 31, 2026', category: 'Stocks', volume: '$1.8k' },
  { id: 'mock-9', question: 'Will the Fed cut rates below 3% in 2026?', yesPercent: 55, endDate: 'Dec 31, 2026', category: 'Economics', volume: '$920' },
  { id: 'mock-10', question: 'Will Apple release AR glasses in 2026?', yesPercent: 67, endDate: 'Dec 31, 2026', category: 'Technology', volume: '$1.5k' },
  { id: 'mock-11', question: 'Will Solana surpass Ethereum in daily transactions?', yesPercent: 38, endDate: 'Jun 30, 2026', category: 'Crypto', volume: '$2.3k' },
  { id: 'mock-12', question: 'Will OpenAI IPO in 2026?', yesPercent: 29, endDate: 'Dec 31, 2026', category: 'Business', volume: '$4.1k' },
  { id: 'mock-13', question: 'Will global temperatures rise 1.5°C above pre-industrial levels by 2030?', yesPercent: 73, endDate: 'Dec 31, 2030', category: 'Science', volume: '$680' },
  { id: 'mock-14', question: 'Will China land astronauts on the Moon before 2028?', yesPercent: 52, endDate: 'Dec 31, 2027', category: 'Science', volume: '$340' },
  { id: 'mock-15', question: 'Will a major US bank adopt Bitcoin as reserve asset?', yesPercent: 15, endDate: 'Dec 31, 2026', category: 'Crypto', volume: '$1.1k' },
  { id: 'mock-16', question: 'Will autonomous vehicles be legal in all US states by 2028?', yesPercent: 44, endDate: 'Dec 31, 2028', category: 'Technology', volume: '$560' },
];

/**
 * Left Rail - Filters & Quick Actions
 */
function LeftRail({ onCreateClick, isConnected }: { onCreateClick: () => void; isConnected: boolean }) {
  return (
    <div className="space-y-4">
      <div className="dossier-card rounded-subtle p-4">
        <h3 className="small-caps text-label text-text-secondary mb-3">Quick Actions</h3>
        <button
          onClick={onCreateClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white text-sm font-medium rounded-subtle hover:bg-accent-hover transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          New Market
        </button>
        {!isConnected && (
          <p className="mt-2 text-caption text-text-tertiary text-center italic">Connect wallet to create</p>
        )}
      </div>

      <div className="dossier-card rounded-subtle p-4">
        <h3 className="small-caps text-label text-text-secondary mb-3">Categories</h3>
        <div className="space-y-0.5">
          {['All', 'Crypto', 'Technology', 'Economics', 'Science', 'Business'].map((cat) => (
            <button key={cat} className="w-full text-left px-3 py-2 text-body-small text-text-secondary hover:text-text-primary hover:bg-paper-aged rounded-subtle transition-colors">
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="dossier-card rounded-subtle p-4">
        <h3 className="small-caps text-label text-text-secondary mb-3">How It Works</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">1</span>
            <span>Browse prediction markets</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">2</span>
            <span>Buy Yes or No shares</span>
          </div>
          <div className="flex items-center gap-2.5 text-xs text-text-secondary">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center text-[10px]">3</span>
            <span>Earn when you're right</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Right Rail - Trending & Stats
 */
function RightRail({ markets }: { markets: typeof MOCK_MARKETS }) {
  const trendingItems = markets.slice(0, 5).map(m => ({
    id: m.id,
    question: m.question,
    yesPercent: m.yesPercent,
    volume: m.volume,
  }));

  return (
    <div className="space-y-4">
      <TrendingRail items={trendingItems} maxCount={5} />

      <div className="dossier-card rounded-subtle overflow-hidden">
        <div className="px-4 py-3 border-b border-divider bg-paper-aged">
          <h2 className="small-caps text-label text-text-secondary flex items-center gap-2">
            <span className="text-text-tertiary">◈</span>
            Platform Stats
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-body-small text-text-secondary">Active markets</span>
            <span className="text-body-small font-semibold text-text-primary typewriter">{markets.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-body-small text-text-secondary">Total volume</span>
            <span className="text-body-small font-semibold text-text-primary typewriter">$12,450</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-divider">
            <span className="text-body-small text-text-secondary">Traders</span>
            <span className="text-body-small font-bold text-accent typewriter">847</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Center Content - Compact feed
 */
function CenterContent({
  markets,
  activeTab,
  setActiveTab,
  isConnected,
}: {
  markets: typeof MOCK_MARKETS;
  activeTab: 'all' | 'my-positions';
  setActiveTab: (tab: 'all' | 'my-positions') => void;
  isConnected: boolean;
}) {
  const tabs = [
    { id: 'all' as const, label: 'All Markets' },
    ...(isConnected ? [{ id: 'my-positions' as const, label: 'My Positions' }] : []),
  ];

  const [isStuck, setIsStuck] = useState(false);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 1, rootMargin: '-1px 0px 0px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* Header */}
      <header className="mb-6">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
            Markets
          </h1>
          <p className="mt-1 text-xs text-text-tertiary">
            Trade on outcomes • See market sentiment • Earn from predictions
          </p>
        </div>
      </header>

      {/* Sentinel for intersection observer */}
      <div ref={stickyRef} className="h-0" />

      {/* Sticky Pill Tabs */}
      <motion.div 
        className="sticky top-0 z-10 py-2 -mx-1 px-1 mb-4"
        animate={{
          backgroundColor: isStuck ? 'rgba(13, 13, 15, 0.95)' : 'transparent',
        }}
        style={{
          backdropFilter: isStuck ? 'blur(8px)' : 'none',
        }}
      >
        <motion.div 
          className="flex gap-2 p-1 rounded-full w-fit transition-all duration-200"
          animate={{
            backgroundColor: isStuck ? 'rgba(42, 42, 46, 0.8)' : 'rgba(42, 42, 46, 0.5)',
            boxShadow: isStuck ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-4 py-2 text-sm font-medium rounded-full transition-colors"
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-paper shadow-sm rounded-full"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className={`relative z-10 ${activeTab === tab.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </motion.div>
        {/* Gradient fade at bottom */}
        <motion.div
          className="absolute left-0 right-0 -bottom-4 h-4 pointer-events-none"
          animate={{
            opacity: isStuck ? 1 : 0,
          }}
          style={{
            background: 'linear-gradient(to bottom, rgba(13, 13, 15, 0.95), transparent)',
          }}
        />
      </motion.div>

      {/* Compact Feed - Grid */}
      <InfiniteFeed
        markets={markets}
        hasNextPage={false}
        isFetchingNextPage={false}
        isLoading={false}
        isError={false}
      />

      {/* Footer */}
      <footer className="mt-8 pt-6 border-t border-divider text-center">
        <p className="text-caption text-text-tertiary italic">
          Predict outcomes • Trade with conviction • Earn from accuracy
        </p>
      </footer>
    </div>
  );
}

function HomePage() {
  const { isConnected } = useAccount();
  const { showToast } = useToast();
  const { connect, connectors } = useWalletConnection();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my-positions'>('all');

  const handleCreateSuccess = () => {
    showToast({ type: 'success', message: 'Market created successfully!' });
    setShowCreateModal(false);
  };

  const handleCreateClick = () => {
    if (!isConnected) {
      const injectedConnector = connectors.find(c => c.id === 'injected');
      if (injectedConnector) {
        connect(injectedConnector);
      } else {
        showToast({ type: 'error', message: 'Please connect your wallet first' });
      }
      return;
    }
    setShowCreateModal(true);
  };

  return (
    <>
      <IndexThreeColumnLayout
        leftRail={<LeftRail onCreateClick={handleCreateClick} isConnected={isConnected} />}
        centerContent={
          <CenterContent
            markets={MOCK_MARKETS}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isConnected={isConnected}
          />
        }
        rightRail={<RightRail markets={MOCK_MARKETS} />}
      />

      {showCreateModal && (
        <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
          <div className="p-6 bg-paper">
            <h2 className="font-heading text-heading-2 text-text-primary mb-4">Create New Market</h2>
            <CreateMarketForm onSuccess={handleCreateSuccess} onCancel={() => setShowCreateModal(false)} />
          </div>
        </Modal>
      )}
    </>
  );
}
