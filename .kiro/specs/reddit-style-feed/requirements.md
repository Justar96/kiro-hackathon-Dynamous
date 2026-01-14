# Requirements Document

## Introduction

This feature refactors the debate index page center column to adopt a Reddit-style infinite scroll feed with compact, engaging debate post cards. The trending section will be relocated to the right column, and the main feed will support doom-scrolling behavior with modern, visually engaging debate cards that encourage interaction.

## Glossary

- **Feed**: The main scrollable list of debate posts in the center column
- **Debate_Card**: A compact, visually engaging container displaying a single debate's key information
- **Infinite_Scroll**: A pagination pattern where new content loads automatically as the user scrolls near the bottom
- **Trending_Section**: A curated list of the most active debates, relocated to the right rail
- **Quick_Stance**: Inline voting buttons allowing users to record their position without leaving the feed
- **Engagement_Metrics**: Visual indicators showing debate activity (mind changes, comments, participants)
- **Right_Rail**: The right sidebar column containing supplementary content

## Requirements

### Requirement 1: Reddit-Style Infinite Scroll Feed

**User Story:** As a user, I want to scroll through debates continuously without pagination, so that I can browse content seamlessly like on Reddit.

#### Acceptance Criteria

1. WHEN the user scrolls within 200px of the feed bottom, THE Feed SHALL automatically load the next batch of debates
2. WHILE debates are loading, THE Feed SHALL display a loading indicator at the bottom
3. WHEN all debates have been loaded, THE Feed SHALL display an end-of-feed message
4. THE Feed SHALL maintain scroll position when new content loads
5. WHEN the user returns to the feed from a debate page, THE Feed SHALL restore the previous scroll position

### Requirement 2: Compact Debate Card Design

**User Story:** As a user, I want debate cards to be compact yet informative, so that I can quickly scan and find interesting debates.

#### Acceptance Criteria

1. THE Debate_Card SHALL display the resolution text with a maximum of 2 lines with ellipsis truncation
2. THE Debate_Card SHALL display the current support/oppose percentage as a visual bar
3. THE Debate_Card SHALL display the mind change count with a delta (Δ) indicator
4. THE Debate_Card SHALL display the debate status (Live, Open, Round X, Resolved)
5. THE Debate_Card SHALL display the current round and total rounds for active debates
6. WHEN a debate is live, THE Debate_Card SHALL show a pulsing indicator
7. THE Debate_Card SHALL have a maximum height to ensure consistent feed density
8. THE Debate_Card SHALL display a mini sparkline showing stance trend over time

### Requirement 3: Engagement-Focused Card Interactions

**User Story:** As a user, I want to interact with debates directly from the feed, so that I can engage quickly without navigating away.

#### Acceptance Criteria

1. WHEN the user hovers over a Debate_Card, THE Debate_Card SHALL display a subtle highlight effect
2. WHEN the user clicks a Debate_Card, THE Feed SHALL navigate to the debate detail page
3. THE Debate_Card SHALL display Quick_Stance buttons for authenticated users
4. WHEN the user clicks a Quick_Stance button, THE Feed SHALL record the stance without navigation
5. WHEN a stance is recorded, THE Debate_Card SHALL show immediate visual feedback
6. THE Debate_Card SHALL display the user's existing stance if previously recorded

### Requirement 4: Trending Section Relocation

**User Story:** As a user, I want to see trending debates in the sidebar, so that the main feed focuses on browsable content.

#### Acceptance Criteria

1. THE Trending_Section SHALL be displayed in the Right_Rail instead of the center column
2. THE Trending_Section SHALL display up to 5 trending debates in a compact list format
3. THE Trending_Section SHALL show debate resolution, support percentage, and mind change count
4. WHEN a trending debate is clicked, THE Feed SHALL navigate to the debate detail page
5. THE Trending_Section SHALL update in real-time when debate activity changes

### Requirement 5: Feed Performance and Loading States

**User Story:** As a user, I want the feed to load quickly and show appropriate loading states, so that I have a smooth browsing experience.

#### Acceptance Criteria

1. THE Feed SHALL display skeleton cards while initial data loads
2. WHEN loading more debates, THE Feed SHALL show a spinner at the bottom without blocking interaction
3. IF a network error occurs during loading, THEN THE Feed SHALL display a retry button
4. THE Feed SHALL implement virtualization for lists exceeding 50 items to maintain performance
5. THE Feed SHALL prefetch debate data when the user hovers over a card for 100ms

### Requirement 6: Mobile-Responsive Feed Layout

**User Story:** As a mobile user, I want the feed to adapt to my screen size, so that I can browse debates comfortably on any device.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE Trending_Section SHALL be hidden from the Right_Rail
2. WHEN the viewport width is below 768px, THE Debate_Card SHALL expand to full width
3. THE Debate_Card SHALL maintain touch-friendly tap targets of at least 44px
4. WHEN on mobile, THE Quick_Stance buttons SHALL be larger for easier tapping
5. THE Feed SHALL support pull-to-refresh on touch devices
