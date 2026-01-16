/**
 * Trading Module
 * 
 * Exports order signing utilities for the hybrid CLOB trading system.
 */

export {
  // Classes
  OrderSigner,
  
  // Enums
  Side,
  SignatureType,
  
  // Types
  type OrderParams,
  type UnsignedOrder,
  type SignedOrder,
  type CTFExchangeDomain,
  
  // Constants
  DOMAIN_NAME,
  DOMAIN_VERSION,
  ORDER_TYPES,
  DEFAULT_EXPIRATION_SECONDS,
  DEFAULT_FEE_RATE_BPS,
  ZERO_ADDRESS,
  
  // Utility functions
  calculateOrderPrice,
  isOrderExpired,
  serializeOrder,
  deserializeOrder,
} from './orderSigner';
