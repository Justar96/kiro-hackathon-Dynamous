/**
 * Data Hooks Index
 * 
 * Domain-organized hooks for data fetching and mutations.
 */

// Auth token hook
export { useAuthToken } from './useAuthToken';

// Health check hooks
export { useHealthCheck } from './useHealth';

// Market hooks
export {
  useMarkets,
  useMarket,
  useCreateMarket,
  usePlaceOrder,
  usePositions,
  type Market,
} from './useMarkets';
