import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MarketChartProps {
  marketId: string;
}

type PriceHistoryTimeframe = '1H' | '1D' | '1W' | '1M' | 'ALL';

interface PriceHistoryPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  volume: number;
}

// Mock data generator
function generateMockPriceHistory(timeframe: PriceHistoryTimeframe): PriceHistoryPoint[] {
  const now = Date.now();
  const intervals: Record<PriceHistoryTimeframe, { count: number; step: number }> = {
    '1H': { count: 60, step: 60 * 1000 },
    '1D': { count: 24, step: 60 * 60 * 1000 },
    '1W': { count: 7 * 24, step: 60 * 60 * 1000 },
    '1M': { count: 30, step: 24 * 60 * 60 * 1000 },
    'ALL': { count: 90, step: 24 * 60 * 60 * 1000 },
  };

  const { count, step } = intervals[timeframe];
  const data: PriceHistoryPoint[] = [];
  let yesPrice = 0.72;

  for (let i = count; i >= 0; i--) {
    const timestamp = now - i * step;
    yesPrice += (Math.random() - 0.5) * 0.05;
    yesPrice = Math.max(0.1, Math.min(0.9, yesPrice));
    
    data.push({
      timestamp,
      yesPrice: Number(yesPrice.toFixed(2)),
      noPrice: Number((1 - yesPrice).toFixed(2)),
      volume: Math.floor(Math.random() * 500) + 100,
    });
  }

  return data;
}

export function MarketChart({ marketId }: MarketChartProps) {
  const [timeframe, setTimeframe] = useState<PriceHistoryTimeframe>('1D');
  
  const data = useMemo(() => generateMockPriceHistory(timeframe), [timeframe, marketId]);

  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    if (timeframe === '1H') return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (timeframe === '1D') return date.toLocaleTimeString('en-US', { hour: '2-digit' });
    if (timeframe === '1W') return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.3} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={formatXAxis}
            stroke="#9ca3af"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis 
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}¢`}
            stroke="#9ca3af"
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
            formatter={(value) => {
              if (value === undefined || value === null) return ['N/A', ''];
              return [`${(Number(value) * 100).toFixed(1)}¢`, ''];
            }}
          />
          <Line 
            type="monotone" 
            dataKey="yesPrice" 
            stroke="#10b981" 
            strokeWidth={2}
            dot={false}
            name="Yes"
          />
          <Line 
            type="monotone" 
            dataKey="noPrice" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={false}
            name="No"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex gap-2 mt-3 justify-center">
        {(['1H', '1D', '1W', '1M', 'ALL'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`px-3 py-1 text-xs rounded-subtle transition-colors ${
              timeframe === tf
                ? 'bg-accent text-white'
                : 'bg-divider/50 text-text-secondary hover:bg-divider'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
}
