# Requirements Document

## Introduction

This feature redesigns the debate page UX by consolidating the three separate round sections (Opening, Rebuttal, Closing) into a single unified "Active Round" section that dynamically displays content based on debate progress. This creates a more compact, focused experience that reduces cognitive load and guides users through the debate flow naturally.

Currently, users see all three rounds stacked vertically, creating a long page even when rounds are incomplete. The new design shows only the current/relevant round prominently, with completed rounds accessible via a compact history view or tabs.

## Glossary

- **Unified_Round_Section**: The single component that replaces three separate RoundSection components, displaying the current active round prominently
- **Round_Progress_Indicator**: Visual element showing which round the debate is in (1/3, 2/3, 3/3) and overall progress
- **Round_History**: Collapsed/expandable view of previously completed rounds
- **Active_Round_View**: The main display area showing the current round's arguments
- **Round_Navigator**: Tab or stepper UI allowing users to switch between viewing different rounds
- **Debate_Phase**: The current state of the debate (opening, rebuttal, closing, concluded)

## Requirements

### Requirement 1: Unified Round Display

**User Story:** As a debate viewer, I want to see only the current active round prominently displayed, so that I can focus on the most relevant content without scrolling through empty or completed sections.

#### Acceptance Criteria

1. THE Unified_Round_Section SHALL display only one round's content at a time as the primary view
2. WHEN a debate is in Round 1, THE Unified_Round_Section SHALL display the Opening round arguments
3. WHEN a debate is in Round 2, THE Unified_Round_Section SHALL display the Rebuttal round arguments
4. WHEN a debate is in Round 3, THE Unified_Round_Section SHALL display the Closing round arguments
5. WHEN a debate is concluded, THE Unified_Round_Section SHALL display the final round (Closing) by default

### Requirement 2: Round Progress Visualization

**User Story:** As a debate viewer, I want to see clear visual indication of debate progress, so that I understand where the debate stands and what to expect next.

#### Acceptance Criteria

1. THE Round_Progress_Indicator SHALL display the current round number and total rounds (e.g., "Round 2 of 3")
2. THE Round_Progress_Indicator SHALL show which side's turn it is during active debates
3. WHEN a round is complete, THE Round_Progress_Indicator SHALL visually mark it as completed
4. THE Round_Progress_Indicator SHALL use distinct visual states for: pending, active, and completed rounds
5. WHEN viewing a non-active round, THE Round_Progress_Indicator SHALL indicate the user is viewing history

### Requirement 3: Round Navigation

**User Story:** As a debate viewer, I want to navigate between rounds easily, so that I can review previous arguments or see the full debate context when needed.

#### Acceptance Criteria

1. THE Round_Navigator SHALL allow users to switch between all available rounds
2. WHEN a user clicks on a completed round, THE Unified_Round_Section SHALL display that round's arguments
3. WHEN a user clicks on the active round, THE Unified_Round_Section SHALL return to showing current progress
4. THE Round_Navigator SHALL visually distinguish between completed rounds and the active round
5. IF a round has no arguments yet, THEN THE Round_Navigator SHALL show it as unavailable/disabled
6. THE Round_Navigator SHALL preserve the user's viewing context when new arguments arrive

### Requirement 4: Compact Round History

**User Story:** As a debate viewer, I want to quickly reference previous rounds without leaving the current view, so that I can understand the full context while focusing on new arguments.

#### Acceptance Criteria

1. WHEN viewing the active round, THE Round_History SHALL show a collapsed summary of completed rounds
2. WHEN a user expands the Round_History, THE system SHALL display previous round arguments in a condensed format
3. THE Round_History SHALL show key information: round type, both arguments (truncated), and completion status
4. WHEN a user clicks on a history item, THE Unified_Round_Section SHALL navigate to that round's full view
5. THE Round_History SHALL not appear when viewing Round 1 (no history exists)

### Requirement 5: Responsive Round Transitions

**User Story:** As a debate viewer, I want smooth transitions when the debate progresses to a new round, so that I'm aware of updates without jarring page changes.

#### Acceptance Criteria

1. WHEN a new round begins, THE Unified_Round_Section SHALL animate the transition to the new round
2. WHEN a new argument is submitted in the current round, THE Active_Round_View SHALL update with a subtle highlight animation
3. THE system SHALL preserve scroll position when round content updates
4. IF the user is viewing a historical round when a new round begins, THEN THE system SHALL show a notification without forcing navigation
5. WHEN transitioning between rounds, THE system SHALL maintain the "This changed my mind" button state

### Requirement 6: Mobile-Optimized Round View

**User Story:** As a mobile user, I want the unified round section to work well on small screens, so that I can follow debates on my phone.

#### Acceptance Criteria

1. THE Round_Navigator SHALL use a compact tab or swipe interface on mobile
2. THE Round_Progress_Indicator SHALL be visible without scrolling on mobile
3. WHEN on mobile, THE Round_History SHALL be accessible via a bottom sheet or expandable section
4. THE Active_Round_View SHALL use full-width layout on mobile screens
5. WHEN swiping between rounds on mobile, THE system SHALL provide haptic feedback if available

### Requirement 7: Argument Submission Integration

**User Story:** As a debater, I want to submit my argument within the unified round view, so that the submission flow feels integrated with the viewing experience.

#### Acceptance Criteria

1. WHEN it is the current user's turn to argue, THE Active_Round_View SHALL display the argument submission form inline
2. THE argument submission form SHALL show the character limit for the current round type
3. WHEN an argument is submitted, THE Active_Round_View SHALL immediately display the new argument
4. IF the user is not a debater in this debate, THEN THE system SHALL not show the submission form
5. WHEN both arguments for a round are submitted, THE system SHALL automatically transition to showing the next round

### Requirement 8: TOC Navigation Update

**User Story:** As a debate viewer using the table of contents, I want the TOC to reflect the new unified structure, so that navigation remains intuitive.

#### Acceptance Criteria

1. THE LeftNavRail SHALL show a single "Debate Rounds" section instead of three separate round entries
2. WHEN the user clicks "Debate Rounds" in the TOC, THE page SHALL scroll to the Unified_Round_Section
3. THE TOC SHALL show the current round indicator next to "Debate Rounds" (e.g., "Debate Rounds (2/3)")
4. THE TOC SHALL maintain entries for Resolution, Outcome, and Discussion sections
5. WHEN viewing a specific round via the Round_Navigator, THE TOC SHALL not change its highlight state
