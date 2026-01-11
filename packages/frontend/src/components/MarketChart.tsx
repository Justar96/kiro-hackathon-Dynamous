import { useEffect, useRef, useState, useCallback } from 'react';
import type { MarketDataPoint, StanceSpike, MarketPrice } from '@debate-platform/shared';
import { useSSE } from '../lib';

interface MarketChartProps {
  debateId: string;
  dataPoints: MarketDataPoint[];
  spikes: StanceSpike[];
  currentPrice?: number;
}

/**
 * MarketChart displays a timeline visualization of stance changes with labeled spikes.
 * Supports real-time updates via SSE.
 * Requirements: 4.2, 4.3, 9.1, 9.4
 */
export function MarketChart({ debateId, dataPoints, spikes, currentPrice = 50 }: MarketChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [hoveredSpike, setHoveredSpike] = useState<StanceSpike | null>(null);
  const [liveDataPoints, setLiveDataPoints] = useState<MarketDataPoint[]>(dataPoints);
  const [liveSpikes, setLiveSpikes] = useState<StanceSpike[]>(spikes);

  // Update local state when props change
  useEffect(() => {
    setLiveDataPoints(dataPoints);
    setLiveSpikes(spikes);
  }, [dataPoints, spikes]);

  // SSE subscription for real-time market updates
  // Uses the shared SSEProvider context
  const handleMarketUpdate = useCallback((data: MarketPrice & { dataPoint?: MarketDataPoint; spike?: StanceSpike }) => {
    if (data.dataPoint) {
      setLiveDataPoints(prev => [...prev, data.dataPoint!]);
    }
    if (data.spike) {
      setLiveSpikes(prev => [...prev, data.spike!]);
    }
  }, []);

  // Subscribe to market events via SSE
  useSSE<MarketPrice & { dataPoint?: MarketDataPoint; spike?: StanceSpike }>(
    'market',
    handleMarketUpdate,
    [debateId]
  );

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || dimensions.width === 0) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Draw background grid
    ctx.strokeStyle = '#f3f4f6';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (at 25%, 50%, 75%)
    [25, 50, 75].forEach(percent => {
      const y = padding.top + chartHeight * (1 - percent / 100);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    });

    // Draw 50% reference line (dashed)
    ctx.strokeStyle = '#d1d5db';
    ctx.setLineDash([4, 4]);
    const midY = padding.top + chartHeight * 0.5;
    ctx.beginPath();
    ctx.moveTo(padding.left, midY);
    ctx.lineTo(width - padding.right, midY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Y-axis labels
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [0, 25, 50, 75, 100].forEach(percent => {
      const y = padding.top + chartHeight * (1 - percent / 100);
      ctx.fillText(`${percent}%`, padding.left - 8, y);
    });

    // Draw data line
    if (liveDataPoints.length > 0) {
      const points = liveDataPoints.map((dp, i) => ({
        x: padding.left + (i / Math.max(liveDataPoints.length - 1, 1)) * chartWidth,
        y: padding.top + chartHeight * (1 - dp.supportPrice / 100),
        data: dp,
      }));

      // Area fill
      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartHeight);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
      ctx.closePath();
      
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
      gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
      gradient.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Current price dot
      if (points.length > 0) {
        const lastPoint = points[points.length - 1];
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else {
      // No data - draw flat line at current price
      const y = padding.top + chartHeight * (1 - currentPrice / 100);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw spike markers
    if (liveDataPoints.length > 1) {
      liveSpikes.forEach(spike => {
        const spikeTime = new Date(spike.timestamp).getTime();
        const startTime = new Date(liveDataPoints[0].timestamp).getTime();
        const endTime = new Date(liveDataPoints[liveDataPoints.length - 1].timestamp).getTime();
        const timeRange = endTime - startTime || 1;
        
        const x = padding.left + ((spikeTime - startTime) / timeRange) * chartWidth;
        
        // Find closest data point for y position
        let closestPoint = liveDataPoints[0];
        let minDiff = Infinity;
        liveDataPoints.forEach(dp => {
          const diff = Math.abs(new Date(dp.timestamp).getTime() - spikeTime);
          if (diff < minDiff) {
            minDiff = diff;
            closestPoint = dp;
          }
        });
        
        const y = padding.top + chartHeight * (1 - closestPoint.supportPrice / 100);
        
        // Spike marker
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = spike.direction === 'support' ? '#10b981' : '#f43f5e';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

  }, [dimensions, liveDataPoints, liveSpikes, currentPrice]);

  // Handle mouse move for spike tooltips
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (liveDataPoints.length < 2 || liveSpikes.length === 0) {
      setHoveredSpike(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const padding = { top: 20, right: 20, bottom: 30, left: 40 };
    const chartWidth = dimensions.width - padding.left - padding.right;
    const chartHeight = dimensions.height - padding.top - padding.bottom;

    const startTime = new Date(liveDataPoints[0].timestamp).getTime();
    const endTime = new Date(liveDataPoints[liveDataPoints.length - 1].timestamp).getTime();
    const timeRange = endTime - startTime || 1;

    // Check if mouse is near any spike
    for (const spike of liveSpikes) {
      const spikeTime = new Date(spike.timestamp).getTime();
      const spikeX = padding.left + ((spikeTime - startTime) / timeRange) * chartWidth;
      
      let closestPoint = liveDataPoints[0];
      let minDiff = Infinity;
      liveDataPoints.forEach(dp => {
        const diff = Math.abs(new Date(dp.timestamp).getTime() - spikeTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = dp;
        }
      });
      
      const spikeY = padding.top + chartHeight * (1 - closestPoint.supportPrice / 100);
      
      const distance = Math.sqrt((x - spikeX) ** 2 + (y - spikeY) ** 2);
      if (distance < 15) {
        setHoveredSpike(spike);
        return;
      }
    }
    
    setHoveredSpike(null);
  }, [dimensions, liveDataPoints, liveSpikes]);

  return (
    <div className="relative">
      <div 
        ref={containerRef} 
        className="w-full h-48 bg-paper rounded-lg border border-hairline"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredSpike(null)}
        />
      </div>
      
      {/* Spike tooltip */}
      {hoveredSpike && (
        <div className="absolute top-2 right-2 bg-paper border border-hairline rounded-lg shadow-elevated p-3 max-w-xs z-dropdown">
          <div className="flex items-center gap-2 mb-1">
            <span 
              className={`w-2 h-2 rounded-full ${
                hoveredSpike.direction === 'support' ? 'bg-support' : 'bg-oppose'
              }`} 
            />
            <span className="text-sm font-medium text-text-primary">
              {hoveredSpike.direction === 'support' ? '+' : '-'}{Math.abs(hoveredSpike.deltaAmount).toFixed(1)}%
            </span>
          </div>
          <p className="text-sm text-text-secondary">{hoveredSpike.label}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-support rounded" />
          <span>Support %</span>
        </div>
        {liveSpikes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-support" />
            <span>Stance shift</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketChart;
