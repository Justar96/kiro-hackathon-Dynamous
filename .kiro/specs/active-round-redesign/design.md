# Design Document: Active Round Redesign

## Overview

This design transforms the debate round section from a card-based tabbed interface into a streamlined, document-like experience. The key changes are:

1. **Remove RoundNavigator tabs** - Eliminate the horizontal tab bar entirely
2. **Compact progress indicator** - Single-line progress with clickable round dots
3. **Seamless integration** - Remove card chrome, blend with page flow
4. **Enhanced engagement** - Better turn highlighting and CTAs

The redesign maintains all existing functionality while reducing visual complexity and improving content focus.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ RoundSection (container)                                     │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CompactProgressBar                                       │ │
│ │ ┌───────────────────────────────────────────────────┐   │ │
│ │ │ "Round 1 · Support's turn"  [●] [○] [○]           │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ RoundHeader (integrated, no divider above)              │ │
│ │ "Opening Statements"                                     │ │
│ │ "Each side presents their initial position..."          │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ActiveRoundView                                          │ │
│ │ - ArgumentBlock (support)                                │ │
│ │ - ArgumentBlock (oppose) / SubmissionForm               │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### CompactProgressBar Component

Replaces both `RoundProgressIndicator` and `RoundNavigator` with a single compact component.

```typescript
interface CompactProgressBarProps {
  /** Current active round in the debate */
  currentRound: RoundNumber;
  /** Which side's turn it is */
  currentTurn: 'support' | 'oppose';
  /** Overall debate status */
  debateStatus: 'seeking_opponent' | 'active' | 'concluded';
  /** Which round the user is viewing */
  viewedRound: RoundNumber;
  /** Round data for determining accessibility */
  rounds: Round[];
  /** Whether the current user can submit (for turn highlighting) */
  isUserTurn?: boolean;
  /** Callback when user selects a round */
  onRoundSelect: (round: RoundNumber) => void;
}

interface RoundDotProps {
  roundNumber: RoundNumber;
  state: 'pending' | 'active' | 'completed' | 'viewing';
  isNavigable: boolean;
  isSelected: boolean;
  onClick: () => void;
}
```

### Updated RoundSection Props

```typescript
interface RoundSectionProps {
  debate: Debate;
  rounds: Round[];
  supportDebater?: User | null;
  opposeDebater?: User | null;
  currentUserId?: string;
  arguments?: { [roundNumber: number]: { support?: Argument | null; oppose?: Argument | null } };
  citations?: { [argumentId: string]: Citation[] };
  /** New: Controls whether to show card styling */
  variant?: 'card' | 'seamless';
  onCitationHover?: (citation: Citation | null, position: { top: number }) => void;
  onMindChanged?: (argumentId: string) => void;
  onArgumentSubmit?: (content: string) => void;
  isSubmitting?: boolean;
  onRoundComplete?: (completedRound: RoundNumber, nextRound: RoundNumber | null) => void;
}
```

## Data Models

No new data models required. The redesign uses existing `Debate`, `Round`, and `Argument` types from `@debate-platform/shared`.

### State Derivation

```typescript
type RoundDotState = 'pending' | 'active' | 'completed' | 'viewing';

function deriveRoundDotState(
  roundNumber: RoundNumber,
  round: Round | undefined,
  currentRound: RoundNumber,
  viewedRound: RoundNumber,
  debateStatus: string
): RoundDotState {
  if (viewedRound === roundNumber && roundNumber !== currentRound) {
    return 'viewing'; // Viewing history
  }
  if (round?.completedAt) {
    return 'completed';
  }
  if (roundNumber === currentRound && debateStatus === 'active') {
    return 'active';
  }
  return 'pending';
}

function isRoundNavigable(
  roundNumber: RoundNumber,
  rounds: Round[],
  currentRound: RoundNumber
): boolean {
  // Can navigate to current round or any completed round
  if (roundNumber === currentRound) return true;
  const round = rounds[roundNumber - 1];
  return round?.completedAt !== null;
}
```

### Progress Text Generation

```typescript
function getProgressText(
  currentRound: RoundNumber,
  currentTurn: 'support' | 'oppose',
  debateStatus: string,
  isMobile: boolean
): string {
  if (debateStatus === 'concluded') {
    return isMobile ? 'Concluded' : 'Debate Concluded';
  }
  if (debateStatus === 'seeking_opponent') {
    return isMobile ? 'Seeking...' : 'Seeking Opponent';
  }
  
  const turnLabel = currentTurn === 'support' ? 'Support' : 'Oppose';
  
  if (isMobile) {
    return `R${currentRound} · ${turnLabel}`;
  }
  return `Round ${currentRound} · ${turnLabel}'s turn`;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Round Dot Click Navigation

*For any* debate state and any round that is navigable (current round or completed), clicking that round's dot should update the viewed round to match the clicked round.

**Validates: Requirements 1.2, 1.3, 2.3, 4.1**

### Property 2: Disabled Dots for Inaccessible Rounds

*For any* debate state, rounds that are neither the current round nor completed should have their dots rendered as disabled and non-interactive.

**Validates: Requirements 4.2**

### Property 3: Completed Round Visual State

*For any* round that has a non-null `completedAt` timestamp, its corresponding dot should display the completed visual state (checkmark or filled styling).

**Validates: Requirements 2.5**

### Property 4: History Viewing Indicator

*For any* state where `viewedRound` differs from `currentRound` and the viewed round is completed, the system should display a history viewing indicator.

**Validates: Requirements 2.6**

### Property 5: Swipe Gesture Navigation

*For any* mobile viewport and any horizontal swipe gesture exceeding the threshold, the system should navigate to the adjacent round if that round is navigable.

**Validates: Requirements 1.4, 5.4**

### Property 6: Keyboard Navigation

*For any* focused progress bar state, pressing left/right arrow keys should navigate to the previous/next navigable round respectively.

**Validates: Requirements 4.5**

### Property 7: Mobile Abbreviated Text

*For any* debate state when rendered in a mobile viewport, the progress text should use abbreviated format (e.g., "R1 · Support" instead of "Round 1 · Support's turn").

**Validates: Requirements 5.1**

### Property 8: User Turn Highlighting

*For any* active debate where `currentTurn` matches the current user's side, the progress bar should display prominent turn highlighting.

**Validates: Requirements 6.1**

### Property 9: Submission CTA Visibility

*For any* state where the user can submit an argument (correct side, their turn, active round, no existing argument), a clear call-to-action should be visible.

**Validates: Requirements 6.3**

### Property 10: Concluded Debate Outcome Display

*For any* debate with status 'concluded', the system should prominently display the debate outcome.

**Validates: Requirements 6.5**

## Error Handling

| Error Condition | Handling Strategy |
|-----------------|-------------------|
| Missing round data | Display fallback "Round data unavailable" message |
| Navigation to invalid round | Silently ignore click, keep current view |
| Swipe on non-touch device | No-op, gesture handlers only active on touch |
| Keyboard nav at boundary | Wrap around or stop at first/last navigable round |

## Testing Strategy

### Unit Tests

- CompactProgressBar renders correct text for various debate states
- Round dots display correct visual states
- Click handlers fire with correct round numbers
- Mobile viewport triggers abbreviated text
- Keyboard navigation cycles through rounds correctly

### Property-Based Tests

Using fast-check with minimum 100 iterations per property:

1. **Round navigation property**: Generate random debate states, verify clicking navigable dots updates viewedRound
2. **Disabled state property**: Generate debates with various round completion states, verify inaccessible rounds are disabled
3. **Completed visual property**: Generate rounds with/without completedAt, verify visual state matches
4. **History indicator property**: Generate viewedRound/currentRound combinations, verify indicator presence
5. **Swipe navigation property**: Generate swipe directions and debate states, verify correct navigation
6. **Keyboard navigation property**: Generate key events and debate states, verify navigation behavior
7. **Mobile text property**: Generate debate states, verify text format changes with viewport
8. **Turn highlighting property**: Generate user/turn combinations, verify highlighting when matched
9. **CTA visibility property**: Generate submission eligibility states, verify CTA presence
10. **Outcome display property**: Generate concluded debates, verify outcome is displayed

### Integration Tests

- Full RoundSection renders without RoundNavigator
- Round selection updates ActiveRoundView content
- Swipe gestures work on mobile viewport
- Sticky behavior activates on scroll (if implemented)

