/**
 * Mutations Index
 * 
 * Barrel exports for all mutation functions organized by domain.
 */

// Debate mutations
export { createDebate, joinDebate } from './debates';

// Argument mutations
export { submitArgument, markMindChanged, uploadArgumentMedia, getUrlPreview } from './arguments';

// Stance mutations
export {
  recordPreStance,
  recordPostStance,
  recordQuickStance,
  attributeImpact,
} from './stances';

// Comment mutations
export { addComment } from './comments';

// Reaction mutations
export { addReaction, removeReaction } from './reactions';

// Steelman mutations
export { submitSteelman, reviewSteelman, deleteSteelman } from './steelman';
