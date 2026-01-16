/**
 * Market Detail Page
 *
 * Displays a single market with order book, trading interface, and real-time updates.
 * Paper dossier aesthetic with stance terminology.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'motion/react';
import { MarketChart } from '../components/market';
import { WarningIcon, ClockIcon } from '../components';
import { HorizontalDivider } from '../components/ui/HorizontalDivider';

export const Route = createFileRoute('/markets/$marketId')({
  component: MarketDetailPage,
});

// Mock market data
const MOCK_MARKETS: Record<string, { question: string; yesPercent: number; endDate: string; category: string; volume: string; description: string }> = {
  'mock-1': { question: 'Will Bitcoin exceed $100,000 by end of 2026?', yesPercent: 72, endDate: 'Dec 31, 2026', category: 'Crypto', volume: '$1.2k', description: 'Resolves YES if Bitcoin price exceeds $100,000 USD on any major exchange before December 31, 2026 11:59 PM UTC.' },
  'mock-2': { question: 'Will AI replace 50% of coding jobs within 5 years?', yesPercent: 34, endDate: 'Jan 15, 2031', category: 'Technology', volume: '$890', description: 'Resolves YES if credible employment data shows 50% reduction in software developer jobs compared to 2024 baseline.' },
  'mock-3': { question: 'Will the US enter a recession in 2026?', yesPercent: 45, endDate: 'Dec 31, 2026', category: 'Economics', volume: '$2.1k', description: 'Resolves YES if NBER officially declares a recession occurring in 2026.' },
  'mock-4': { question: 'Will SpaceX successfully land humans on Mars before 2030?', yesPercent: 28, endDate: 'Dec 31, 2029', category: 'Science', volume: '$450', description: 'Resolves YES if SpaceX lands at least one human on Mars surface who survives landing.' },
  'mock-5': { question: 'Will remote work remain the dominant work model in tech?', yesPercent: 61, endDate: 'Jun 30, 2027', category: 'Business', volume: '$780', description: 'Resolves YES if >50% of tech workers work remotely at least 3 days/week according to major surveys.' },
  'mock-6': { question: 'Will Ethereum flip Bitcoin in market cap by 2028?', yesPercent: 18, endDate: 'Dec 31, 2028', category: 'Crypto', volume: '$3.4k', description: 'Resolves YES if Ethereum market cap exceeds Bitcoin market cap at any point before end of 2028.' },
  'mock-7': { question: 'Will AGI be achieved before 2030?', yesPercent: 22, endDate: 'Dec 31, 2029', category: 'Technology', volume: '$5.2k', description: 'Resolves YES if a credible AI research organization announces AGI achievement verified by independent experts.' },
  'mock-8': { question: 'Will Tesla stock exceed $500 by end of 2026?', yesPercent: 41, endDate: 'Dec 31, 2026', category: 'Stocks', volume: '$1.8k', description: 'Resolves YES if TSLA closes above $500 on NASDAQ before December 31, 2026.' },
  'mock-9': { question: 'Will the Fed cut rates below 3% in 2026?', yesPercent: 55, endDate: 'Dec 31, 2026', category: 'Economics', volume: '$920', description: 'Resolves YES if Federal Reserve target rate falls below 3% at any point in 2026.' },
  'mock-10': { question: 'Will Apple release AR glasses in 2026?', yesPercent: 67, endDate: 'Dec 31, 2026', category: 'Technology', volume: '$1.5k', description: 'Resolves YES if Apple announces and ships AR glasses product to consumers in 2026.' },
  'mock-11': { question: 'Will Solana surpass Ethereum in daily transactions?', yesPercent: 38, endDate: 'Jun 30, 2026', category: 'Crypto', volume: '$2.3k', description: 'Resolves YES if Solana 7-day average transactions exceed Ethereum for any week before June 30, 2026.' },
  'mock-12': { question: 'Will OpenAI IPO in 2026?', yesPercent: 29, endDate: 'Dec 31, 2026', category: 'Business', volume: '$4.1k', description: 'Resolves YES if OpenAI completes an initial public offering on a major stock exchange in 2026.' },
  'mock-13': { question: 'Will global temperatures rise 1.5°C above pre-industrial levels by 2030?', yesPercent: 73, endDate: 'Dec 31, 2030', category: 'Science', volume: '$680', description: 'Resolves YES based on official IPCC or NASA climate data showing 1.5°C threshold breached.' },
  'mock-14': { question: 'Will China land astronauts on the Moon before 2028?', yesPercent: 52, endDate: 'Dec 31, 2027', category: 'Science', volume: '$340', description: 'Resolves YES if CNSA successfully lands Chinese astronauts on the Moon before 2028.' },
  'mock-15': { question: 'Will a major US bank adopt Bitcoin as reserve asset?', yesPercent: 15, endDate: 'Dec 31, 2026', category: 'Crypto', volume: '$1.1k', description: 'Resolves YES if a top 10 US bank by assets announces Bitcoin holdings as treasury reserve.' },
  'mock-16': { question: 'Will autonomous vehicles be legal in all US states by 2028?', yesPercent: 44, endDate: 'Dec 31, 2028', category: 'Technology', volume: '$560', description: 'Resolves YES if all 50 US states have legalized Level 4+ autonomous vehicles on public roads.' },
};

function MarketDetailPage() {
  const { marketId } = Route.useParams();
  const { isConnected } = useAccount();
  const [tradeTab, setTradeTab] = useState<'buy' | 'sell'>('buy');

  const market = MOCK_MARKETS[marketId];

  if (!market) {
    return (
      <div className="min-h-screen bg-page-bg flex items-center justify-center">
        <div className="dossier-card rounded-subtle p-8 text-center max-w-md">
          <WarningIcon className="w-12 h-12 text-oppose mx-auto mb-4" />
          <h2 className="font-heading text-heading-2 text-text-primary mb-2">Market Not Found</h2>
          <p className="text-text-secondary mb-4">The market you're looking for doesn't exist.</p>
          <Link to="/" className="text-accent hover:underline">← Back to Markets</Link>
        </div>
      </div>
    );
  }

  const noPercent = 100 - market.yesPercent;

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-4">
          <Link to="/" className="text-body-small text-accent hover:underline">← Back to Markets</Link>
        </div>

        {/* Header */}
        <motion.header 
          className="dossier-card rounded-subtle p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="small-caps text-label text-support">Active</span>
            <span className="text-xs text-text-tertiary px-2 py-0.5 bg-divider rounded-full">{market.category}</span>
          </div>
          
          <h1 className="font-heading text-heading-1 text-text-primary leading-tight mb-4">
            {market.question}
          </h1>

          {/* Stance Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-body-small mb-2">
              <span className="text-support font-medium">Yes {market.yesPercent}%</span>
              <span className="text-oppose font-medium">No {noPercent}%</span>
            </div>
            <div className="h-3 bg-divider rounded-full overflow-hidden flex">
              <motion.div 
                className="bg-support" 
                initial={{ width: 0 }}
                animate={{ width: `${market.yesPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <motion.div 
                className="bg-oppose" 
                initial={{ width: 0 }}
                animate={{ width: `${noPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-body-small text-text-secondary">
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              <span>Ends: {market.endDate}</span>
            </div>
            <div>Volume: <span className="typewriter">{market.volume}</span></div>
          </div>

          <HorizontalDivider spacing="md" className="my-4" />
          <div>
            <h3 className="small-caps text-label text-text-secondary mb-2">Resolution Criteria</h3>
            <p className="text-body-small text-text-secondary">{market.description}</p>
          </div>
        </motion.header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Chart & Activity */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div 
              className="dossier-card rounded-subtle p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <h2 className="small-caps text-label text-text-secondary mb-3">Price History</h2>
              <MarketChart marketId={marketId} />
            </motion.div>

            <motion.div 
              className="dossier-card rounded-subtle p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <h2 className="small-caps text-label text-text-secondary mb-3">Recent Activity</h2>
              <div className="space-y-2">
                {[
                  { action: 'Bought Yes', amount: '$50', time: '2 min ago', user: '0x1a2b...3c4d' },
                  { action: 'Sold No', amount: '$120', time: '5 min ago', user: '0x5e6f...7g8h' },
                  { action: 'Bought Yes', amount: '$200', time: '12 min ago', user: '0x9i0j...1k2l' },
                  { action: 'Bought No', amount: '$75', time: '18 min ago', user: '0x3m4n...5o6p' },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-divider last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${activity.action.includes('Yes') ? 'text-support' : 'text-oppose'}`}>
                        {activity.action}
                      </span>
                      <span className="text-body-small typewriter">{activity.amount}</span>
                    </div>
                    <div className="text-caption text-text-tertiary">
                      <span className="typewriter">{activity.user}</span> • {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right - Trading */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
          >
            <div className="dossier-card rounded-subtle p-4 sticky top-4">
              <h2 className="small-caps text-label text-text-secondary mb-4">Trade</h2>
              
              {/* Buy/Sell Tabs */}
              <div className="flex gap-2 p-1 bg-divider/50 rounded-full mb-4">
                {(['buy', 'sell'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTradeTab(tab)}
                    className="relative flex-1 px-4 py-2 text-sm font-medium rounded-full transition-colors capitalize"
                  >
                    {tradeTab === tab && (
                      <motion.div
                        layoutId="tradeTab"
                        className="absolute inset-0 bg-paper shadow-sm rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className={`relative z-10 ${tradeTab === tab ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {tab}
                    </span>
                  </button>
                ))}
              </div>

              {/* Outcome Selection */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button className="p-4 border-2 border-support bg-support/5 rounded-subtle text-center hover:bg-support/10 transition-colors">
                  <div className="text-support font-bold text-lg">{market.yesPercent}¢</div>
                  <div className="text-xs text-text-secondary">Yes</div>
                </button>
                <button className="p-4 border-2 border-oppose bg-oppose/5 rounded-subtle text-center hover:bg-oppose/10 transition-colors">
                  <div className="text-oppose font-bold text-lg">{noPercent}¢</div>
                  <div className="text-xs text-text-secondary">No</div>
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-4">
                <label className="text-body-small text-text-secondary mb-1 block">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-3 bg-page-bg border border-divider rounded-subtle text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Potential Return */}
              <div className="p-3 bg-page-bg rounded-subtle mb-4">
                <div className="flex justify-between text-body-small">
                  <span className="text-text-secondary">Potential return</span>
                  <span className="text-support font-medium">+$0.00</span>
                </div>
                <div className="flex justify-between text-caption text-text-tertiary mt-1">
                  <span>If Yes wins</span>
                  <span>0 shares</span>
                </div>
              </div>

              {/* Action Button */}
              {isConnected ? (
                <button className="w-full py-3 bg-accent text-white font-medium rounded-subtle hover:bg-accent-hover transition-colors">
                  {tradeTab === 'buy' ? 'Buy' : 'Sell'}
                </button>
              ) : (
                <button className="w-full py-3 bg-accent text-white font-medium rounded-subtle hover:bg-accent-hover transition-colors">
                  Connect Wallet to Trade
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
