/**
 * Contract Error Parser
 *
 * Parses Solidity revert reasons and other contract errors into user-friendly messages.
 * Handles common error cases from the on-chain settlement contracts.
 *
 * Requirements: 6.6
 */

/**
 * Error codes for contract errors
 */
export type ContractErrorCode =
  | 'INVALID_END_DATE'
  | 'INSUFFICIENT_LIQUIDITY'
  | 'MARKET_NOT_ACTIVE'
  | 'MARKET_NOT_PENDING_RESOLUTION'
  | 'MARKET_NOT_RESOLVED'
  | 'MARKET_ALREADY_RESOLVED'
  | 'DISPUTE_PERIOD_NOT_ENDED'
  | 'DISPUTE_PERIOD_ENDED'
  | 'INVALID_OUTCOME'
  | 'UNAUTHORIZED_ORACLE'
  | 'INVALID_PRICE'
  | 'INVALID_QUANTITY'
  | 'INSUFFICIENT_BALANCE'
  | 'INSUFFICIENT_COLLATERAL'
  | 'INSUFFICIENT_ALLOWANCE'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_ACTIVE'
  | 'UNAUTHORIZED_CANCELLATION'
  | 'MARKET_PAUSED'
  | 'MARKET_ALREADY_EXISTS'
  | 'TOKEN_AMOUNT_MISMATCH'
  | 'NO_WINNING_TOKENS'
  | 'ALREADY_REDEEMED'
  | 'USER_REJECTED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Parsed contract error with user-friendly message
 */
export interface ContractError {
  code: ContractErrorCode;
  message: string;
  details?: Record<string, unknown>;
  originalError?: Error;
}

/**
 * Error message mappings for each error code
 */
const ERROR_MESSAGES: Record<ContractErrorCode, string> = {
  INVALID_END_DATE: 'Market end date must be in the future',
  INSUFFICIENT_LIQUIDITY: 'Insufficient initial liquidity. Minimum 10 USDC required.',
  MARKET_NOT_ACTIVE: 'This market is no longer active for trading',
  MARKET_NOT_PENDING_RESOLUTION: 'Market is not pending resolution',
  MARKET_NOT_RESOLVED: 'Market has not been resolved yet',
  MARKET_ALREADY_RESOLVED: 'This market has already been resolved',
  DISPUTE_PERIOD_NOT_ENDED: 'The dispute period has not ended yet',
  DISPUTE_PERIOD_ENDED: 'The dispute period has already ended',
  INVALID_OUTCOME: 'Invalid outcome specified',
  UNAUTHORIZED_ORACLE: 'Only the oracle can perform this action',
  INVALID_PRICE: 'Price must be between $0.01 and $0.99',
  INVALID_QUANTITY: 'Quantity must be greater than 0',
  INSUFFICIENT_BALANCE: 'Insufficient token balance for this operation',
  INSUFFICIENT_COLLATERAL: 'Insufficient USDC balance for this operation',
  INSUFFICIENT_ALLOWANCE: 'Please approve USDC spending first',
  ORDER_NOT_FOUND: 'Order not found',
  ORDER_NOT_ACTIVE: 'This order is no longer active',
  UNAUTHORIZED_CANCELLATION: 'You can only cancel your own orders',
  MARKET_PAUSED: 'Trading is currently paused',
  MARKET_ALREADY_EXISTS: 'A market with this question already exists',
  TOKEN_AMOUNT_MISMATCH: 'YES and NO token amounts must be equal',
  NO_WINNING_TOKENS: 'You have no winning tokens to redeem',
  ALREADY_REDEEMED: 'You have already redeemed your winnings',
  USER_REJECTED: 'Transaction was rejected',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNKNOWN: 'An unexpected error occurred',
};

/**
 * Patterns to match Solidity error signatures in error messages
 */
const ERROR_PATTERNS: Array<{ pattern: RegExp; code: ContractErrorCode }> = [
  // MarketFactory errors
  { pattern: /InvalidEndDate/i, code: 'INVALID_END_DATE' },
  { pattern: /InsufficientInitialLiquidity/i, code: 'INSUFFICIENT_LIQUIDITY' },
  { pattern: /MarketAlreadyExists/i, code: 'MARKET_ALREADY_EXISTS' },

  // Market errors
  { pattern: /MarketNotActive/i, code: 'MARKET_NOT_ACTIVE' },
  { pattern: /MarketNotPendingResolution/i, code: 'MARKET_NOT_PENDING_RESOLUTION' },
  { pattern: /MarketNotResolved/i, code: 'MARKET_NOT_RESOLVED' },
  { pattern: /MarketAlreadyResolved/i, code: 'MARKET_ALREADY_RESOLVED' },
  { pattern: /DisputePeriodNotEnded/i, code: 'DISPUTE_PERIOD_NOT_ENDED' },
  { pattern: /DisputePeriodEnded/i, code: 'DISPUTE_PERIOD_ENDED' },
  { pattern: /InvalidOutcome/i, code: 'INVALID_OUTCOME' },
  { pattern: /UnauthorizedOracle/i, code: 'UNAUTHORIZED_ORACLE' },
  { pattern: /InsufficientTokenBalance/i, code: 'INSUFFICIENT_BALANCE' },
  { pattern: /TokenAmountMismatch/i, code: 'TOKEN_AMOUNT_MISMATCH' },

  // OrderBook errors
  { pattern: /InvalidPrice/i, code: 'INVALID_PRICE' },
  { pattern: /InvalidQuantity/i, code: 'INVALID_QUANTITY' },
  { pattern: /OrderNotFound/i, code: 'ORDER_NOT_FOUND' },
  { pattern: /OrderNotActive/i, code: 'ORDER_NOT_ACTIVE' },
  { pattern: /UnauthorizedCancellation/i, code: 'UNAUTHORIZED_CANCELLATION' },
  { pattern: /InsufficientCollateral/i, code: 'INSUFFICIENT_COLLATERAL' },
  { pattern: /MarketPaused/i, code: 'MARKET_PAUSED' },

  // Settlement errors
  { pattern: /NoWinningTokens/i, code: 'NO_WINNING_TOKENS' },
  { pattern: /AlreadyRedeemed/i, code: 'ALREADY_REDEEMED' },

  // ERC20 errors
  { pattern: /ERC20InsufficientBalance/i, code: 'INSUFFICIENT_BALANCE' },
  { pattern: /ERC20InsufficientAllowance/i, code: 'INSUFFICIENT_ALLOWANCE' },
  { pattern: /insufficient balance/i, code: 'INSUFFICIENT_BALANCE' },
  { pattern: /insufficient allowance/i, code: 'INSUFFICIENT_ALLOWANCE' },

  // User actions
  { pattern: /user rejected/i, code: 'USER_REJECTED' },
  { pattern: /user denied/i, code: 'USER_REJECTED' },
  { pattern: /rejected the request/i, code: 'USER_REJECTED' },

  // Network errors
  { pattern: /network/i, code: 'NETWORK_ERROR' },
  { pattern: /timeout/i, code: 'NETWORK_ERROR' },
  { pattern: /connection/i, code: 'NETWORK_ERROR' },
];

/**
 * Extract error details from Solidity error arguments
 */
function extractErrorDetails(message: string): Record<string, unknown> | undefined {
  const details: Record<string, unknown> = {};

  // Try to extract numeric values from error messages
  const numericMatch = message.match(/(\d+)/g);
  if (numericMatch) {
    if (message.includes('required') && message.includes('available')) {
      details.required = numericMatch[0];
      details.available = numericMatch[1];
    } else if (message.includes('price')) {
      details.price = numericMatch[0];
    } else if (message.includes('amount') || message.includes('quantity')) {
      details.amount = numericMatch[0];
    }
  }

  // Try to extract addresses
  const addressMatch = message.match(/0x[a-fA-F0-9]{40}/g);
  if (addressMatch) {
    details.addresses = addressMatch;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}

/**
 * Parse a contract error into a user-friendly format
 *
 * @param error - The error to parse (can be any type)
 * @returns Parsed contract error with code and message
 */
export function parseContractError(error: unknown): ContractError {
  // Handle null/undefined
  if (!error) {
    return {
      code: 'UNKNOWN',
      message: ERROR_MESSAGES.UNKNOWN,
    };
  }

  // Get error message
  let errorMessage = '';
  let originalError: Error | undefined;

  if (error instanceof Error) {
    errorMessage = error.message;
    originalError = error;

    // Check for nested error messages (common in viem/wagmi)
    if ('cause' in error && error.cause instanceof Error) {
      errorMessage += ' ' + error.cause.message;
    }

    // Check for shortMessage (viem specific)
    if ('shortMessage' in error && typeof error.shortMessage === 'string') {
      errorMessage += ' ' + error.shortMessage;
    }

    // Check for details (viem specific)
    if ('details' in error && typeof error.details === 'string') {
      errorMessage += ' ' + error.details;
    }
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    // Try to extract message from object
    const obj = error as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      errorMessage = obj.message;
    } else if (typeof obj.reason === 'string') {
      errorMessage = obj.reason;
    } else if (typeof obj.error === 'string') {
      errorMessage = obj.error;
    }
  }

  // Match against known error patterns
  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(errorMessage)) {
      return {
        code,
        message: ERROR_MESSAGES[code],
        details: extractErrorDetails(errorMessage),
        originalError,
      };
    }
  }

  // Return unknown error with original message if available
  return {
    code: 'UNKNOWN',
    message: errorMessage || ERROR_MESSAGES.UNKNOWN,
    originalError,
  };
}

/**
 * Check if an error is a user rejection
 */
export function isUserRejection(error: ContractError): boolean {
  return error.code === 'USER_REJECTED';
}

/**
 * Check if an error is recoverable (user can retry)
 */
export function isRecoverableError(error: ContractError): boolean {
  const nonRecoverableCodes: ContractErrorCode[] = [
    'MARKET_ALREADY_RESOLVED',
    'ALREADY_REDEEMED',
    'MARKET_ALREADY_EXISTS',
    'UNAUTHORIZED_ORACLE',
    'UNAUTHORIZED_CANCELLATION',
  ];
  return !nonRecoverableCodes.includes(error.code);
}

/**
 * Get a suggested action for an error
 */
export function getSuggestedAction(error: ContractError): string | null {
  switch (error.code) {
    case 'INSUFFICIENT_BALANCE':
      return 'Please add more tokens to your wallet';
    case 'INSUFFICIENT_COLLATERAL':
      return 'Please add more USDC to your wallet';
    case 'INSUFFICIENT_ALLOWANCE':
      return 'Please approve USDC spending and try again';
    case 'INVALID_PRICE':
      return 'Enter a price between $0.01 and $0.99';
    case 'MARKET_PAUSED':
      return 'Please wait until trading resumes';
    case 'NETWORK_ERROR':
      return 'Check your internet connection and try again';
    case 'USER_REJECTED':
      return 'Confirm the transaction in your wallet to proceed';
    default:
      return null;
  }
}
