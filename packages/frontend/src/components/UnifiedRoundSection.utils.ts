/**
 * Utility functions for UnifiedRoundSection component.
 * 
 * Requirements: 2.1, 2.3, 3.5, 4.3
 */

import type { Debate, Round } from '@debate-platform/shared';
import type { RoundStep, RoundStepState } from './UnifiedRoundSection.types';

/**
 * Gets the display label for a round type.
 * 
 * @param roundType - The type of round
 * @returns Human-readable label
 */
export function getRoundLabel(roundType: Round['roundType']): string {
  const labels: Record<Round['roundType'], string> = {
    opening: 'Opening',
    rebuttal: 'Rebuttal',
    closing: 'Closing',
  };
  return labels[roundType];
}

/**
 * Derives the visual state for each round step based on debate state.
 * 
 * Requirements: 2.1, 2.3, 2.4, 2.5
 * 
 * @param debate - The current debate
 * @param rounds - Array of rounds for the debate
 * @param viewedRound - Which round the user is currently viewing
 * @returns Array of RoundStep objects with derived states
 */
export function deriveRoundStates(
  debate: Debate,
  rounds: Round[],
  viewedRound: 1 | 2 | 3
): RoundStep[] {
  return rounds.map((round, index) => {
    const roundNumber = (index + 1) as 1 | 2 | 3;
    const isCompleted = round.completedAt !== null;
    const isActive = debate.currentRound === roundNumber && debate.status === 'active';
    const isViewing = viewedRound === roundNumber;
    
    let state: RoundStepState;
    if (isViewing && isCompleted && !isActive) {
      // User is viewing a completed round that isn't the active one
      state = 'viewing-history';
    } else if (isCompleted) {
      state = 'completed';
    } else if (isActive) {
      state = 'active';
    } else {
      state = 'pending';
    }
    
    return {
      roundNumber,
      label: getRoundLabel(round.roundType),
      state,
      hasArguments: round.supportArgumentId !== null || round.opposeArgumentId !== null,
    };
  });
}

/**
 * Determines if a user can navigate to a specific round.
 * 
 * Requirements: 3.5
 * 
 * @param targetRound - The round number to navigate to
 * @param rounds - Array of rounds for the debate
 * @param currentRound - The debate's current active round
 * @returns true if navigation is allowed
 */
export function canNavigateToRound(
  targetRound: 1 | 2 | 3,
  rounds: Round[],
  currentRound: 1 | 2 | 3
): boolean {
  const round = rounds[targetRound - 1];
  if (!round) return false;
  
  // Can always navigate to completed rounds
  if (round.completedAt !== null) return true;
  
  // Can navigate to active round
  if (targetRound === currentRound) return true;
  
  // Can navigate to rounds that have at least one argument
  return round.supportArgumentId !== null || round.opposeArgumentId !== null;
}

/**
 * Generates a truncated excerpt from content for history summaries.
 * 
 * Requirements: 4.3
 * 
 * @param content - The full content string
 * @param maxLength - Maximum length of the excerpt (default: 100)
 * @returns Truncated string with "..." suffix if truncated
 */
export function generateExcerpt(content: string, maxLength: number = 100): string {
  if (!content) return '';
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

/**
 * Gets the round configuration (title and description) for a round type.
 * 
 * @param roundType - The type of round
 * @returns Object with title and description
 */
export function getRoundConfig(roundType: Round['roundType']): { 
  title: string; 
  description: string;
} {
  switch (roundType) {
    case 'opening':
      return {
        title: 'Openings',
        description: 'Each side presents their initial position and key arguments.',
      };
    case 'rebuttal':
      return {
        title: 'Rebuttals',
        description: 'Each side responds to the opposing arguments.',
      };
    case 'closing':
      return {
        title: 'Closings',
        description: 'Each side summarizes their case and makes final appeals.',
      };
    default:
      return {
        title: 'Arguments',
        description: '',
      };
  }
}

/**
 * Gets the turn label for display.
 * 
 * @param turn - The current turn side
 * @returns Human-readable turn label
 */
export function getTurnLabel(turn: 'support' | 'oppose'): string {
  return turn === 'support' ? "Support's turn" : "Oppose's turn";
}

/**
 * Generates the progress indicator text.
 * 
 * Requirements: 2.1, 2.2
 * 
 * @param currentRound - The current round number
 * @param currentTurn - The current turn side
 * @param debateStatus - The debate status
 * @param isViewingHistory - Whether user is viewing a historical round
 * @returns Formatted progress text
 */
export function getProgressText(
  currentRound: 1 | 2 | 3,
  currentTurn: 'support' | 'oppose',
  debateStatus: 'active' | 'concluded',
  isViewingHistory: boolean
): string {
  const roundText = `Round ${currentRound} of 3`;
  
  if (debateStatus === 'concluded') {
    return `${roundText} · Concluded`;
  }
  
  if (isViewingHistory) {
    return `${roundText} · Viewing history`;
  }
  
  return `${roundText} · ${getTurnLabel(currentTurn)}`;
}
