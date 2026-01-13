# Requirements Document

## Introduction

This specification covers the redesign of the debate active round UI to create a more compact, seamless experience that integrates better with the opening view of the debate page. The current implementation uses a separate tab navigation (RoundNavigator) and a progress indicator bar that creates visual separation and adds unnecessary chrome. The goal is to streamline the round display, remove redundant navigation elements, and improve overall UX for better engagement with the debate platform's core purpose.

## Glossary

- **Round_Progress_Bar**: A compact inline indicator showing debate progress through rounds with turn information
- **Round_Section**: The main container displaying the current round's arguments and submission forms
- **Active_Round**: The round currently accepting argument submissions
- **Viewed_Round**: The round the user is currently viewing (may differ from active round when viewing history)
- **Turn_Indicator**: Visual element showing whose turn it is to submit an argument
- **Round_Dot**: A small circular indicator representing a round's state (pending, active, completed)

## Requirements

### Requirement 1: Remove Tab Navigation

**User Story:** As a reader, I want a cleaner debate view without redundant navigation tabs, so that I can focus on the debate content without visual clutter.

#### Acceptance Criteria

1. THE Round_Section SHALL NOT display the horizontal tab navigation (RoundNavigator component)
2. THE System SHALL maintain round navigation functionality through the progress indicator
3. WHEN a user needs to view a different round THEN THE System SHALL provide clickable round dots in the progress bar
4. THE System SHALL preserve swipe gesture navigation on mobile devices

### Requirement 2: Compact Progress Indicator

**User Story:** As a reader, I want a compact progress indicator that shows debate status at a glance, so that I understand the debate state without it dominating the view.

#### Acceptance Criteria

1. THE Round_Progress_Bar SHALL display in a single compact line
2. THE Round_Progress_Bar SHALL show round number and turn information (e.g., "Round 1 · Support's turn")
3. THE Round_Dot indicators SHALL be clickable for round navigation
4. THE Active_Round dot SHALL have a subtle pulse or ring animation to indicate activity
5. THE Completed_Round dots SHALL show a checkmark or filled state
6. WHEN viewing history THEN THE System SHALL indicate this with a subtle badge or color change
7. THE Round_Progress_Bar SHALL use minimal vertical space (max 40px height)

### Requirement 3: Seamless Visual Integration

**User Story:** As a reader, I want the round section to flow naturally from the page header, so that the debate feels like a cohesive document rather than separate UI components.

#### Acceptance Criteria

1. THE Round_Section SHALL remove the outer card border/shadow when at page top
2. THE Round_Progress_Bar SHALL use a subtle background that blends with the page
3. THE System SHALL maintain visual hierarchy through typography rather than containers
4. THE Round_Header SHALL integrate directly with the progress bar without additional dividers
5. WHEN scrolling THEN THE Round_Progress_Bar MAY become sticky for persistent context

### Requirement 4: Enhanced Round Navigation UX

**User Story:** As a reader, I want intuitive round navigation, so that I can easily move between rounds without confusion.

#### Acceptance Criteria

1. WHEN a user clicks a Round_Dot THEN THE System SHALL navigate to that round if accessible
2. WHEN a round is not yet started THEN THE Round_Dot SHALL appear disabled and non-clickable
3. THE System SHALL provide visual feedback on hover for clickable round dots
4. WHEN navigating rounds THEN THE System SHALL smooth-scroll to the round content
5. THE System SHALL preserve keyboard navigation (arrow keys) between rounds

### Requirement 5: Mobile-Optimized Compact View

**User Story:** As a mobile user, I want an even more compact round display, so that I can see more debate content on my smaller screen.

#### Acceptance Criteria

1. WHEN viewport is mobile-sized THEN THE Round_Progress_Bar SHALL use abbreviated text
2. THE Mobile_Progress_Bar SHALL show "R1 · Support" instead of "Round 1 · Support's turn"
3. THE Round_Dots SHALL remain touch-friendly (minimum 44px touch target)
4. THE System SHALL support swipe gestures for round navigation on mobile
5. WHEN viewing on mobile THEN THE System SHALL hide the "Viewing history" badge text, showing only color indicator

### Requirement 6: Engagement-Focused UX Improvements

**User Story:** As a platform user, I want the debate interface to encourage engagement, so that I'm more likely to participate and follow debates.

#### Acceptance Criteria

1. THE System SHALL highlight the current turn prominently when it's the user's turn to submit
2. WHEN a new argument is submitted THEN THE System SHALL provide subtle animation feedback
3. THE System SHALL show a clear call-to-action when the user can submit an argument
4. THE Round_Section SHALL display argument count or activity indicators
5. WHEN debate is concluded THEN THE System SHALL prominently display the outcome/winner

