# Implementation Plan: Debate Platform

## Overview

This plan implements a "Persuasion Market" debate platform using TanStack React, Bun runtime, Hono backend, and Neon PostgreSQL with Drizzle ORM. Authentication is handled via Neon Auth (Stack Auth SDK). Tasks are ordered to build incrementally, with core data models first, then services, then UI components.

## Tasks

- [x] 1. Project setup and configuration
  - Initialize Bun project with TypeScript
  - Set up monorepo structure (packages/frontend, packages/backend, packages/shared)
  - Configure Drizzle ORM with Neon PostgreSQL
  - Set up Vitest and fast-check for testing
  - Configure TanStack React (Query, Router) for frontend
  - Set up Tailwind CSS
  - _Requirements: 9.5, 9.6_

- [x] 2. Database schema and core types
  - [x] 2.1 Create shared TypeScript interfaces for all data models
    - User, NeonAuthUser, Debate, Round, Argument, Stance, Reaction, Comment, MarketDataPoint
    - _Requirements: All data model requirements_
  - [x] 2.2 Implement Drizzle schema (schema.ts) for PostgreSQL
    - Create all tables: users, debates, rounds, arguments, stances, reactions, comments, market_data_points, stance_spikes
    - Set up PostgreSQL enums for type safety
    - Reference neon_auth.user table for auth integration
    - Set up foreign key relationships
    - _Requirements: All data model requirements_
  - [x] 2.3 Create database migrations and seed data
    - Push schema to Neon PostgreSQL
    - Create seed script with sample users and debates
    - _Requirements: All data model requirements_

- [x] 3. User and authentication service
  - [x] 3.1 Set up Neon Auth integration
    - Configure Stack Auth SDK with environment variables
    - Create auth handler routes (/handler/[...stack])
    - Implement StackProvider wrapper for frontend
    - _Requirements: 11.1, 11.2, 11.3_
  - [x] 3.2 Implement user synchronization
    - Create AuthService.getOrCreatePlatformUser method
    - Link neon_auth.user to platform users table
    - Sync user profile data on login
    - _Requirements: 11.2, 11.4_
  - [x] 3.3 Write property test for new user initialization
    - **Property 12: New User Reputation Initialization**
    - **Validates: Requirements 7.1**
  - [x] 3.4 Implement sandbox tracking
    - Track debates participated count
    - Update sandboxCompleted after 5 debates
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 3.5 Write property test for sandbox vote weight
    - **Property 14: Sandbox Vote Weight**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [x] 4. Checkpoint - Ensure user service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Debate service implementation
  - [x] 5.1 Implement debate creation
    - Create DebateService.createDebate method
    - Initialize with 50/50 market price
    - Assign creator as support debater
    - Create 3 rounds (opening, rebuttal, closing)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1_
  - [x] 5.2 Write property tests for debate creation
    - **Property 1: Resolution Creation Initialization**
    - **Property 2: Resolution Validation**
    - **Property 3: Debate Round Structure Invariant**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1**
  - [x] 5.3 Implement argument submission with turn enforcement
    - Create DebateService.submitArgument method
    - Validate current turn matches submitter's side
    - Enforce character limits per round type
    - _Requirements: 2.2, 2.3, 2.6_
  - [x] 5.4 Write property tests for argument submission
    - **Property 4: Turn Enforcement**
    - **Property 5: Argument Character Limits**
    - **Validates: Requirements 2.2, 2.3, 2.6**
  - [x] 5.5 Implement round advancement and debate conclusion
    - Advance round when both sides submit
    - Conclude debate after round 3
    - Calculate final results
    - _Requirements: 2.4, 2.5_
  - [x] 5.6 Write property test for round advancement
    - **Property 6: Round Advancement**
    - **Validates: Requirements 2.4, 2.5**

- [x] 6. Checkpoint - Ensure debate service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Voting service implementation
  - [x] 7.1 Implement pre/post stance recording
    - Create VotingService.recordPreStance and recordPostStance methods
    - Store stance with confidence level
    - Track lastArgumentSeen for impact attribution
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 7.2 Implement persuasion delta calculation
    - Calculate delta = postStance.supportValue - preStance.supportValue
    - Recalculate on post-stance updates
    - _Requirements: 3.3, 3.5_
  - [x] 7.3 Write property test for persuasion delta
    - **Property 7: Persuasion Delta Calculation**
    - **Validates: Requirements 3.3, 3.5**
  - [x] 7.4 Implement blind voting enforcement
    - Prevent market price access before pre-stance recorded
    - _Requirements: 3.4_
  - [x] 7.5 Write property test for blind voting
    - **Property 8: Blind Voting Enforcement**
    - **Validates: Requirements 3.4**

- [x] 8. Market calculator implementation
  - [x] 8.1 Implement market price calculation
    - Calculate weighted average of post-stances
    - Weight by user reputation and sandbox status
    - _Requirements: 4.1, 4.5, 7.4_
  - [x] 8.2 Write property test for market price calculation
    - **Property 9: Market Price Calculation**
    - **Validates: Requirements 4.5, 7.4**
  - [x] 8.3 Implement impact attribution and scoring
    - Attribute stance changes to lastArgumentSeen
    - Calculate impactScore as sum of attributed deltas
    - _Requirements: 5.1, 5.2_
  - [x] 8.4 Write property test for impact attribution
    - **Property 10: Impact Attribution**
    - **Validates: Requirements 5.1, 5.2**
  - [x] 8.5 Implement spike detection for significant stance shifts
    - Detect large deltas and create spike records
    - Generate labels for spikes
    - _Requirements: 4.3_

- [x] 9. Checkpoint - Ensure voting and market tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Reaction service implementation
  - [x] 10.1 Implement dual reaction system
    - Create ReactionService.addReaction method
    - Support 'agree' and 'strong_reasoning' types independently
    - _Requirements: 6.1, 6.2, 6.4_
  - [x] 10.2 Write property test for reaction independence
    - **Property 11: Dual Reaction Independence**
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [x] 11. Reputation service implementation
  - [x] 11.1 Implement reputation updates
    - Increase reputation on correct predictions
    - Increase reputation on high impact arguments
    - _Requirements: 7.2, 7.3_
  - [x] 11.2 Write property test for reputation increase
    - **Property 13: Reputation Increase on Correct Prediction**
    - **Validates: Requirements 7.2**

- [x] 12. Comment service implementation
  - [x] 12.1 Implement comment posting with threading
    - Create CommentService.addComment method
    - Support parent-child relationships
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 12.2 Write property test for comment threading
    - **Property 16: Comment Threading**
    - **Validates: Requirements 8.3**
  - [x] 12.3 Implement rate limiting
    - Limit to 3 comments per 10 minutes per user per debate
    - _Requirements: 10.4_
  - [x] 12.4 Write property test for rate limiting
    - **Property 15: Comment Rate Limiting**
    - **Validates: Requirements 10.4**

- [x] 13. Checkpoint - Ensure all backend service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Backend API routes
  - [x] 14.1 Set up Hono server with middleware
    - Configure CORS, JSON parsing, error handling
    - Set up Neon Auth middleware for protected routes
    - _Requirements: All API requirements, 11.3_
  - [x] 14.2 Implement debate API routes
    - POST /api/debates, GET /api/debates, GET /api/debates/:id
    - POST /api/debates/:id/arguments
    - _Requirements: 1.1, 2.2, 2.3_
  - [x] 14.3 Implement voting API routes
    - POST /api/debates/:id/stance/pre, POST /api/debates/:id/stance/post
    - GET /api/debates/:id/market
    - _Requirements: 3.1, 3.2, 3.4, 4.1_
  - [x] 14.4 Implement reaction and comment API routes
    - POST /api/arguments/:id/react
    - POST /api/debates/:id/comments, GET /api/debates/:id/comments
    - _Requirements: 6.1, 8.2, 8.3_
  - [x] 14.5 Implement SSE stream for realtime updates
    - GET /api/debates/:id/stream
    - _Requirements: 4.4_
  - [x] 14.6 Implement user API routes
    - GET /api/users/me (current authenticated user)
    - GET /api/users/:id, GET /api/users/:id/stats
    - _Requirements: 7.5, 11.5_

- [x] 15. Checkpoint - Ensure API routes work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Frontend setup and routing
  - [x] 16.1 Set up TanStack Router with routes
    - Home (debate list), Debate view, User profile
    - Auth routes via Stack Auth handler
    - _Requirements: 9.1, 11.3_
  - [x] 16.2 Set up TanStack Query for data fetching
    - Configure query client
    - Create API hooks for all endpoints
    - _Requirements: All frontend requirements_
  - [x] 16.3 Configure Stack Auth for frontend
    - Set up StackProvider and StackTheme
    - Create stack.ts configuration
    - Add UserButton component
    - _Requirements: 11.1, 11.3_

- [x] 17. Core UI components
  - [x] 17.1 Implement ResolutionCard component
    - Display resolution text, Support/Oppose bar, mind-change count
    - Show most impactful argument preview
    - _Requirements: 9.2_
  - [x] 17.2 Implement MarketChart component
    - Timeline visualization with labeled spikes
    - Real-time updates via SSE
    - _Requirements: 4.2, 4.3, 9.4_
  - [x] 17.3 Implement StanceInput component
    - Slider for Support 0-100
    - Confidence level selector
    - Pre/post mode handling
    - _Requirements: 3.1, 3.2_

- [x] 18. Paper-clean layout system
  - [x] 18.1 Implement ThreeColumnLayout component
    - Left rail (240px), center paper (720px max), right margin (200px)
    - Warm off-white background (#F7F6F2), white paper surface
    - Responsive: drawer + bottom sheet on mobile
    - _Requirements: 9.1, 9.2, 9.9_
  - [x] 18.2 Implement LeftNavRail component
    - Table-of-contents style navigation
    - Section highlighting on scroll (IntersectionObserver)
    - Slide-over drawer on mobile
    - _Requirements: 9.3, 10.2_
  - [x] 18.3 Implement RightMarginRail component
    - Support/Oppose meter, sparkline chart
    - Before/After stance sliders
    - Reading progress indicator
    - Sticky bottom sheet on mobile
    - _Requirements: 9.4, 10.7, 11.1, 11.4_
  - [x] 18.4 Set up design tokens and typography
    - Configure Tailwind with paper-clean color palette
    - Add Source Serif 4 + Inter fonts
    - Implement typography scale (heading-1, body, label, caption)
    - _Requirements: 9.5, 9.6, 9.7_

- [x] 19. Debate dossier components
  - [x] 19.1 Implement DossierHeader component
    - Resolution as serif heading, subtitle, muted tags
    - Status indicator (Open/Locked/Resolved in tiny caps)
    - _Requirements: 10.1_
  - [x] 19.2 Implement ArgumentBlock component
    - Side label (FOR/AGAINST in tiny caps)
    - Author + reputation (small text)
    - Main text as readable paragraph (not comment bubble)
    - Evidence footnotes [1] [2]
    - Impact badge ("Impact: +14" muted)
    - _Requirements: 10.3, 13.2, 13.3_
  - [x] 19.3 Implement EvidenceFootnote and SourceCard components
    - Inline numbered citations
    - Hover shows source card in right margin
    - Source card: title, domain, year, excerpt, type
    - _Requirements: 10.4, 10.5_
  - [x] 19.4 Implement RoundSection component
    - Section header (Round 1: Openings)
    - FOR and AGAINST ArgumentBlocks
    - Scroll anchor for TOC navigation
    - _Requirements: 10.1, 10.3_

- [x] 20. Stance capture and impact UI
  - [x] 20.1 Update StanceInput for Before/After flow
    - Before slider at top, locks with subtle check after set
    - After slider unlocks after scrolling past Round 2
    - Delta label (Δ +12) after both recorded
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 20.2 Implement scroll-based After unlock
    - IntersectionObserver on Round 2 section
    - Unlock After slider when Round 2 exits viewport
    - _Requirements: 10.6, 11.3_
  - [x] 20.3 Implement impact attribution UI
    - "This changed my mind" button on arguments
    - Impact badge display
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 21. Home feed as index
  - [x] 21.1 Implement index-style debate list
    - Resolution title (one line), muted tags
    - Tiny support/oppose bar, sparkline, mind-changes count
    - No comment previews or thumbnails
    - Library catalog aesthetic
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  - [x] 21.2 Update ResolutionCard for index style
    - Compact row layout
    - Calm typography, generous spacing
    - _Requirements: 12.2_

- [x] 22. Debate view page assembly
  - [x] 22.1 Implement DebateView page with dossier structure
    - ThreeColumnLayout wrapper
    - TOC sections: Resolution, Definitions, Evidence, Rounds, Outcome
    - Paper content with all sections
    - Margin with market data and stance inputs
    - _Requirements: 10.1, 10.2_
  - [x] 22.2 Implement SpectatorComments section
    - Visually distinct from debate rounds
    - Threaded replies
    - _Requirements: 8.1, 8.4_
  - [x] 22.3 Wire reading progress tracking
    - Track scroll position
    - Update progress indicator in right margin
    - _Requirements: 10.7_

- [x] 23. User and navigation components
  - [x] 23.1 Implement navigation and layout
    - Clean minimal header with logo
    - User menu with Stack Auth UserButton
    - _Requirements: 9.1, 15.3_
  - [x] 23.2 Implement UserProfile page
    - Display reputation score, prediction accuracy
    - Show debate history
    - Link to Neon Auth profile data
    - _Requirements: 7.5, 15.5_
  - [x] 23.3 Implement debate creation form
    - Resolution input with validation
    - Side selection
    - Require authentication
    - _Requirements: 1.1, 1.2, 15.3_

- [x] 24. Final integration and polish
  - [x] 24.1 Wire all components together
    - Connect frontend to backend API
    - Test full user flows with authentication
    - _Requirements: All requirements_
  - [x] 24.2 Implement responsive design
    - Mobile-friendly layouts (drawer + bottom sheet)
    - Touch-friendly interactions
    - _Requirements: 9.9_
  - [x] 24.3 Add loading states and error handling
    - Skeleton loaders (paper-style)
    - Error boundaries
    - Toast notifications (subtle, not shouting)
    - Auth error handling
    - _Requirements: All error handling_
  - [x] 24.4 Add micro-interactions
    - TOC section highlighting on scroll
    - Subtle check on Before stance lock
    - Delta label animation on After stance
    - _Requirements: 10.2, 11.2, 11.4_

- [x] 25. Final checkpoint - Full system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks including property-based tests are required for comprehensive validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases

### Paper-Clean UI Philosophy
- **Content-first, UI-second**: Typography is the UI, not boxes/borders/gradients
- **Debate as dossier**: Each debate is a structured document with sections, not a feed of comments
- **3-column layout**: Left TOC, center paper (720px), right margin notes
- **Calm aesthetic**: Warm off-white (#F7F6F2), serif headings, generous whitespace
- **Before/After as signature**: The stance delta (Δ +12) is the core differentiator
- **Evidence as footnotes**: Inline citations [1] [2] with hover source cards
- **Home as index**: Library catalog feel, not Reddit feed

### Technical Stack
- Authentication is handled via Neon Auth (Stack Auth SDK) - no custom auth implementation needed
- Database is Neon PostgreSQL (serverless) with connection pooling
- Frontend uses TanStack Router + Query with Tailwind CSS
- Fonts: Source Serif 4 (headings), Inter (body/UI)

### Environment Variables Required
- DATABASE_URL (Neon PostgreSQL connection string)
- NEXT_PUBLIC_STACK_PROJECT_ID
- NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
- STACK_SECRET_SERVER_KEY
