interface MarketChartProps {
  marketId: string;
}

export function MarketChart(_props: MarketChartProps) {
  // Placeholder - integrate with charting library like recharts or chart.js
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Price History</h3>
      <div className="h-64 bg-gray-50 rounded flex items-center justify-center text-gray-500">
        Chart placeholder - integrate with recharts or chart.js
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">1D</button>
        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">1W</button>
        <button className="px-3 py-1 rounded bg-blue-600 text-white">1M</button>
        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">3M</button>
        <button className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">ALL</button>
      </div>
    </div>
  );
}
