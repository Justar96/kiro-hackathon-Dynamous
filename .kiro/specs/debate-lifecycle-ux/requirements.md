# Requirements Document

## Introduction

This specification defines enhancements to Thesis's lifecycle and user experience to make debates more accessible, intuitive, and engaging. The goal is to transform the platform into a world-class research-grade debate experience where users can debate any topic (movies, music, AI, tech, products, etc.) with rich media support, private voting, and intelligent reputation scoring.

Key improvements include:
- Simplified debate creation and participation flow
- Rich media support (file uploads, YouTube embeds, web link previews)
- Completely private stance voting (no one can see individual votes)
- Intelligent reputation calculation based on persuasion quality, not just win/loss
- Enhanced UX with clear visual guidance through the debate lifecycle

## Glossary

- **Debate_Platform**: The web application that hosts structured debates
- **Debate_Lifecycle_Manager**: The system component that manages debate state transitions
- **Media_Handler**: The system component that processes and displays rich media attachments
- **Stance_Recorder**: The system component that privately records user stances
- **Reputation_Engine**: The system component that calculates user reputation scores
- **Persuasion_Delta**: The measured change in a user's stance from pre-read to post-read
- **Impact_Score**: A measure of how much an argument influenced audience stance changes
- **Resolution**: The debatable claim or topic being discussed
- **Round**: One of three structured phases (Opening, Rebuttal, Closing)
- **Debater**: A user who takes a side and submits arguments
- **Spectator**: A user who reads and votes on debates without arguing

## Requirements

### Requirement 1: Simplified Debate Creation

**User Story:** As a user, I want to create debates on any topic quickly and easily, so that I can start meaningful discussions without friction.

#### Acceptance Criteria

1. WHEN a user opens the new debate modal, THE Debate_Platform SHALL display a single-field resolution input with topic suggestions
2. WHEN a user types a resolution, THE Debate_Platform SHALL provide real-time character count and validation feedback
3. WHEN a user selects a side (Support/Oppose), THE Debate_Platform SHALL visually highlight the selection with clear color coding
4. THE Debate_Platform SHALL support debates on any topic including movies, music, AI, technology, products, and general topics
5. WHEN a debate is created, THE Debate_Lifecycle_Manager SHALL initialize the debate in "waiting_opponent" phase with 50/50 market price

### Requirement 2: Rich Media Support

**User Story:** As a debater, I want to include evidence from various sources in my arguments, so that I can make more compelling and well-supported claims.

#### Acceptance Criteria

1. WHEN a debater submits an argument, THE Media_Handler SHALL accept file uploads (images, PDFs, documents up to 10MB)
2. WHEN a YouTube URL is pasted, THE Media_Handler SHALL automatically extract and display the video thumbnail with title
3. WHEN a web URL is pasted, THE Media_Handler SHALL fetch and display a link preview with title, description, and thumbnail
4. WHEN media is attached, THE Debate_Platform SHALL display inline previews within the argument block
5. IF a media upload fails, THEN THE Media_Handler SHALL display a clear error message and allow retry
6. THE Media_Handler SHALL validate file types and reject unsupported formats with helpful guidance

### Requirement 3: Private Stance Voting

**User Story:** As a spectator, I want my votes to remain completely private, so that I can express my honest opinion without social pressure.

#### Acceptance Criteria

1. THE Stance_Recorder SHALL store all stance votes as private data that is never exposed to other users
2. WHEN displaying debate statistics, THE Debate_Platform SHALL only show aggregate data (averages, totals) without individual votes
3. THE Debate_Platform SHALL NOT display any indicator of how specific users voted
4. WHEN a user views their own profile, THE Debate_Platform SHALL show their personal voting history privately
5. THE Stance_Recorder SHALL enforce that stance data cannot be queried by user ID through any public API
6. WHILE a debate is active, THE Debate_Platform SHALL hide market price from users who have not recorded a pre-stance (blind voting)

### Requirement 4: Intelligent Reputation Calculation

**User Story:** As a user, I want my reputation to reflect my actual persuasion skills and prediction accuracy, so that the platform rewards quality contributions over gaming the system.

#### Acceptance Criteria

1. THE Reputation_Engine SHALL calculate reputation based on multiple weighted factors, not just debate wins
2. WHEN a user's argument causes significant stance shifts, THE Reputation_Engine SHALL increase their reputation proportionally to the Impact_Score
3. WHEN a user accurately predicts debate outcomes, THE Reputation_Engine SHALL increase their prediction accuracy score
4. THE Reputation_Engine SHALL apply diminishing returns to prevent reputation farming from high-volume low-quality participation
5. WHEN calculating vote weight, THE Reputation_Engine SHALL consider both reputation score and prediction accuracy
6. THE Reputation_Engine SHALL decay reputation slowly over time for inactive users to keep scores current
7. IF a user consistently makes low-impact arguments, THEN THE Reputation_Engine SHALL not penalize but also not reward their reputation

### Requirement 5: Enhanced Debate Lifecycle UX

**User Story:** As a user, I want to clearly understand where I am in the debate process, so that I can participate effectively without confusion.

#### Acceptance Criteria

1. WHEN viewing a debate, THE Debate_Platform SHALL display a clear visual progress indicator showing current round and turn
2. WHEN it is a debater's turn, THE Debate_Platform SHALL highlight the submission area with their side's color
3. WHEN a round completes, THE Debate_Platform SHALL animate the transition and notify relevant users
4. WHEN a debate concludes, THE Debate_Platform SHALL display a comprehensive results summary with persuasion metrics
5. THE Debate_Platform SHALL provide contextual help tooltips explaining each phase for new users
6. WHILE waiting for an opponent, THE Debate_Platform SHALL show estimated wait time and matching status

### Requirement 6: Spectator Engagement

**User Story:** As a spectator, I want to engage with debates beyond just voting, so that I can contribute to the discussion meaningfully.

#### Acceptance Criteria

1. WHEN viewing arguments, THE Debate_Platform SHALL allow spectators to react with "Agree" or "Strong Reasoning" reactions
2. WHEN a spectator records a post-stance, THE Debate_Platform SHALL prompt them to attribute which argument influenced them most
3. THE Debate_Platform SHALL display aggregate reaction counts on arguments without revealing individual reactors
4. WHEN a debate has high engagement, THE Debate_Platform SHALL feature it in trending sections
5. THE Debate_Platform SHALL allow spectators to leave threaded comments for discussion

### Requirement 7: Onboarding and Guidance

**User Story:** As a new user, I want clear guidance on how to participate in debates, so that I can quickly become an effective contributor.

#### Acceptance Criteria

1. WHEN a new user first visits, THE Debate_Platform SHALL display an optional interactive tutorial
2. THE Debate_Platform SHALL provide inline hints during first-time actions (first debate creation, first vote, first argument)
3. WHEN a user completes sandbox debates, THE Debate_Platform SHALL unlock full voting weight with a celebration
4. THE Debate_Platform SHALL display reputation milestones and achievements to encourage quality participation
5. IF a user's argument is rejected for being too short, THEN THE Debate_Platform SHALL provide specific improvement suggestions

### Requirement 8: Accessibility and Responsiveness

**User Story:** As a user on any device, I want Thesis to be fully accessible and responsive, so that I can participate from anywhere.

#### Acceptance Criteria

1. THE Debate_Platform SHALL support full keyboard navigation for all interactive elements
2. THE Debate_Platform SHALL provide appropriate ARIA labels for screen readers
3. THE Debate_Platform SHALL maintain minimum 44px touch targets on mobile devices
4. WHEN viewed on mobile, THE Debate_Platform SHALL adapt layout to single-column with swipe gestures for navigation
5. THE Debate_Platform SHALL support reduced motion preferences for users with vestibular disorders
6. THE Debate_Platform SHALL maintain WCAG 2.1 AA color contrast ratios throughout

