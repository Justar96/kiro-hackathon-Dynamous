/**
 * Errors Module Index
 *
 * Exports error handling utilities for contract interactions.
 */

export {
  parseContractError,
  isUserRejection,
  isRecoverableError,
  getSuggestedAction,
  type ContractError,
  type ContractErrorCode,
} from './contract-errors';
