# Implementation Plan: Debate Lifecycle UX Enhancement

## Overview

This implementation plan breaks down the debate lifecycle UX enhancements into discrete, incremental tasks. Each task builds on previous work and includes property-based tests to validate correctness. The plan follows the existing monorepo structure with backend services, frontend components, and shared types.

## Tasks

- [x] 1. Database Schema Extensions
  - [x] 1.1 Create media_attachments table migration
    - Add table with id, argument_id, type, url, thumbnail_url, title, description, mime_type, file_size, created_at
    - Add foreign key to arguments table with CASCADE delete
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Create reputation_factors table migration
    - Add table with user_id, impact_score_total, prediction_accuracy, participation_count, quality_score, last_active_at
    - Add unique constraint on user_id
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.3 Create reputation_history table migration
    - Add table with id, user_id, previous_score, new_score, change_amount, reason, debate_id, created_at
    - Add foreign keys to users and debates tables
    - _Requirements: 4.1, 4.6_

- [x] 2. Shared Types and Interfaces
  - [x] 2.1 Add media attachment types to shared package
    - Define MediaAttachment, UrlPreview, YouTubePreview interfaces
    - Define ACCEPTED_FILE_TYPES and MAX_FILE_SIZE constants
    - _Requirements: 2.1, 2.6_

  - [x] 2.2 Add reputation types to shared package
    - Define ReputationScore, ReputationBreakdown, ReputationFactor interfaces
    - Define REPUTATION_WEIGHTS constants
    - _Requirements: 4.1, 4.5_

  - [x] 2.3 Add privacy-related types to shared package
    - Define AggregateStanceData interface (no individual voter data)
    - _Requirements: 3.1, 3.2_

- [x] 3. Backend MediaService Implementation
  - [x] 3.1 Create MediaService class with file validation
    - Implement validateFile() with type and size checks
    - Implement uploadFile() stub (file storage integration later)
    - _Requirements: 2.1, 2.5, 2.6_

  - [x] 3.2 Write property test for file validation
    - **Property 4: File Upload Size Validation**
    - **Validates: Requirements 2.1, 2.5, 2.6**

  - [x] 3.3 Implement YouTube URL parsing
    - Implement parseYouTubeUrl() to extract videoId from various URL formats
    - Return YouTubePreview with videoId, title placeholder, thumbnailUrl
    - _Requirements: 2.2_

  - [x] 3.4 Write property test for YouTube URL parsing
    - **Property 5: YouTube URL Parsing Round-Trip**
    - **Validates: Requirements 2.2**

  - [x] 3.5 Implement web URL preview parsing
    - Implement parseUrl() to fetch Open Graph metadata
    - Return UrlPreview with title, description, thumbnailUrl
    - _Requirements: 2.3_

  - [x] 3.6 Write property test for URL preview structure
    - **Property 6: Web URL Preview Structure**
    - **Validates: Requirements 2.3**

  - [x] 3.7 Implement getArgumentMedia() database query
    - Query media_attachments by argumentId
    - Return array of MediaAttachment
    - _Requirements: 2.4_

- [x] 4. Checkpoint - Media Service Tests Pass
  - Ensure all media service tests pass, ask the user if questions arise.

- [x] 5. Backend ReputationEngineV2 Implementation
  - [x] 5.1 Create ReputationEngineV2 class with multi-factor calculation
    - Implement calculateReputation() using weighted factors
    - Implement calculateVoteWeight() considering reputation and accuracy
    - _Requirements: 4.1, 4.5_

  - [x] 5.2 Write property test for multi-factor reputation
    - **Property 10: Multi-Factor Reputation Calculation**
    - **Validates: Requirements 4.1, 4.5**

  - [x] 5.3 Implement impact-based reputation updates
    - Implement updateReputationOnImpact() proportional to impact score
    - Record change in reputation_history table
    - _Requirements: 4.2_

  - [x] 5.4 Write property test for impact-proportional reputation
    - **Property 11: Impact-Proportional Reputation**
    - **Validates: Requirements 4.2**

  - [x] 5.5 Implement prediction accuracy tracking
    - Implement updatePredictionAccuracy() on debate conclusion
    - Increase on correct predictions, decrease on incorrect
    - _Requirements: 4.3_

  - [x] 5.6 Write property test for prediction accuracy
    - **Property 12: Prediction Accuracy Update**
    - **Validates: Requirements 4.3**

  - [x] 5.7 Implement diminishing returns formula
    - Apply logarithmic diminishing returns to repeated actions
    - Formula: gain = rawScore * (1 / (1 + log10(count + 1)))
    - _Requirements: 4.4_

  - [x] 5.8 Write property test for diminishing returns
    - **Property 13: Diminishing Returns Formula**
    - **Validates: Requirements 4.4**

  - [x] 5.9 Implement reputation decay for inactive users
    - Implement applyDecay() based on days since last activity
    - Decay rate: 1% per week of inactivity after 30 days
    - _Requirements: 4.6_

  - [x] 5.10 Write property test for reputation decay
    - **Property 14: Reputation Decay Over Time**
    - **Validates: Requirements 4.6**

  - [x] 5.11 Implement low-impact neutrality handling
    - Arguments with impact < threshold result in ±0 reputation change
    - _Requirements: 4.7_

  - [x] 5.12 Write property test for low-impact neutrality
    - **Property 15: Low-Impact Neutrality**
    - **Validates: Requirements 4.7**

- [x] 6. Checkpoint - Reputation Engine Tests Pass
  - Ensure all reputation engine tests pass, ask the user if questions arise.

- [x] 7. Backend PrivacyGuard Implementation
  - [x] 7.1 Create PrivacyGuard class with filtering logic
    - Implement filterForPublicResponse() to remove voter IDs
    - Implement getAggregateStats() returning only counts/averages
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 7.2 Write property test for vote privacy
    - **Property 7: Vote Privacy Invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [x] 7.3 Implement self-access authorization
    - Implement canAccessOwnStance() checking requester === owner
    - Return own stance data only to the owner
    - _Requirements: 3.4_

  - [x] 7.4 Write property test for self-access
    - **Property 8: Self-Access Vote Retrieval**
    - **Validates: Requirements 3.4**

  - [x] 7.5 Implement blind voting enforcement
    - Check pre-stance exists before returning market price
    - Return error if no pre-stance recorded
    - _Requirements: 3.6_

  - [x] 7.6 Write property test for blind voting
    - **Property 9: Blind Voting Enforcement**
    - **Validates: Requirements 3.6**

- [x] 8. Checkpoint - Privacy Guard Tests Pass
  - Ensure all privacy guard tests pass, ask the user if questions arise.

- [x] 9. Backend API Routes Integration
  - [x] 9.1 Add media upload endpoint
    - POST /api/arguments/:id/media
    - Validate file, store, return MediaAttachment
    - _Requirements: 2.1, 2.5_

  - [x] 9.2 Add URL preview endpoint
    - POST /api/media/preview
    - Parse URL, return UrlPreview or YouTubePreview
    - _Requirements: 2.2, 2.3_

  - [x] 9.3 Update stance endpoints with privacy filtering
    - Apply PrivacyGuard to all stance-related responses
    - Ensure no voter IDs leak through any endpoint
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 9.4 Add reputation breakdown endpoint
    - GET /api/users/:id/reputation
    - Return ReputationBreakdown for user profile
    - _Requirements: 4.1_

  - [x] 9.5 Update debate conclusion to use ReputationEngineV2
    - Wire processDebateConclusion() into debate.service
    - Update all participant reputations
    - _Requirements: 4.2, 4.3_

- [x] 10. Checkpoint - Backend Integration Tests Pass
  - Ensure all backend integration tests pass, ask the user if questions arise.

- [x] 11. Frontend MediaUploader Component
  - [x] 11.1 Create MediaUploader component
    - File input with drag-and-drop support
    - URL paste detection for YouTube and web links
    - Preview display for attached media
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 11.2 Create MediaPreview component
    - Display thumbnails for images and videos
    - Display link cards for web URLs
    - Display file icons for documents
    - _Requirements: 2.4_

  - [x] 11.3 Integrate MediaUploader into ArgumentSubmissionForm
    - Add media attachment section below textarea
    - Pass media array to onSubmit handler
    - _Requirements: 2.1, 2.4_

- [x] 12. Frontend Enhanced Debate Creation
  - [x] 12.1 Update NewDebateModal with topic suggestions
    - Add category-based topic suggestions
    - Add "Random topic" button
    - _Requirements: 1.1, 1.4_

  - [x] 12.2 Write property test for character count
    - **Property 2: Character Count Accuracy**
    - **Validates: Requirements 1.2**

  - [x] 12.3 Write property test for topic acceptance
    - **Property 3: Topic Acceptance Universality**
    - **Validates: Requirements 1.4**

  - [x] 12.4 Write property test for debate initialization
    - **Property 1: Debate Initialization Invariant**
    - **Validates: Requirements 1.5**

- [x] 13. Frontend Privacy-Aware Components
  - [x] 13.1 Update StanceInput to hide market price before pre-stance
    - Check hasPreStance before showing market data
    - Display "Record stance to see market" message
    - _Requirements: 3.6_

  - [x] 13.2 Update debate statistics display for aggregate-only
    - Remove any individual voter indicators
    - Show only totalVoters, avgDelta, mindChangedCount
    - _Requirements: 3.2, 3.3_

  - [x] 13.3 Add personal voting history to profile
    - Query own stances only
    - Display in private profile section
    - _Requirements: 3.4_

- [x] 14. Frontend Reputation Display
  - [x] 14.1 Create ReputationBreakdown component
    - Display overall score with factor breakdown
    - Show recent changes with reasons
    - Display rank/percentile if available
    - _Requirements: 4.1_

  - [x] 14.2 Update user profile with reputation breakdown
    - Integrate ReputationBreakdown component
    - Show milestones and achievements
    - _Requirements: 7.4_

- [x] 15. Frontend Debate Lifecycle UX
  - [x] 15.1 Create DebateProgressIndicator component
    - Visual progress bar showing rounds 1-2-3
    - Highlight current round and turn
    - Show "Your turn" indicator when applicable
    - _Requirements: 5.1, 5.2_

  - [x] 15.2 Create DebateResultsSummary component
    - Display final prices, mind changes, persuasion delta
    - Show winner side with visual emphasis
    - _Requirements: 5.4_

  - [x] 15.3 Write property test for results summary completeness
    - **Property 16: Results Summary Completeness**
    - **Validates: Requirements 5.4**

  - [x] 15.4 Add contextual help tooltips
    - Add tooltips explaining each phase
    - Show for new users (first 5 debates)
    - _Requirements: 5.5_

  - [x] 15.5 Update waiting state display
    - Show estimated wait time
    - Show matching status
    - _Requirements: 5.6_

- [x] 16. Frontend Spectator Engagement
  - [x] 16.1 Update reaction display for privacy
    - Show aggregate counts only
    - Remove any user indicators from reactions
    - _Requirements: 6.3_

  - [x] 16.2 Write property test for reaction privacy
    - **Property 18: Reaction Privacy**
    - **Validates: Requirements 6.3**

  - [x] 16.3 Add argument attribution prompt
    - Show after post-stance submission
    - Allow selecting most influential argument
    - _Requirements: 6.2_

- [ ] 17. Checkpoint - Frontend Component Tests Pass
  - Ensure all frontend component tests pass, ask the user if questions arise.

- [x] 18. Backend Comment Threading Validation
  - [x] 18.1 Add parent existence validation to comment service
    - Verify parentId exists before creating reply
    - Return error if parent not found
    - _Requirements: 6.5_

  - [x] 18.2 Write property test for comment threading
    - **Property 20: Comment Threading Integrity**
    - **Validates: Requirements 6.5**

- [x] 19. Backend Trending Algorithm
  - [x] 19.1 Implement trending score calculation
    - Score = votes + reactions + comments (weighted)
    - Add recency decay factor
    - _Requirements: 6.4_

  - [x] 19.2 Write property test for trending consistency
    - **Property 19: Trending Algorithm Consistency**
    - **Validates: Requirements 6.4**

- [x] 20. Backend Sandbox Completion
  - [x] 20.1 Update sandbox completion to set full vote weight
    - Set sandboxCompleted = true after 5 debates
    - Update vote weight calculation
    - _Requirements: 7.3_

  - [x] 20.2 Write property test for sandbox vote weight
    - **Property 21: Sandbox Completion Vote Weight**
    - **Validates: Requirements 7.3**

- [x] 21. Backend Argument Validation Feedback
  - [x] 21.1 Enhance argument rejection messages
    - Include specific character count requirement
    - Include improvement suggestions
    - _Requirements: 7.5_

  - [x] 21.2 Write property test for argument feedback
    - **Property 22: Short Argument Feedback**
    - **Validates: Requirements 7.5**

- [x] 22. Frontend Accessibility
  - [x] 22.1 Audit and fix touch target sizes
    - Ensure all interactive elements are ≥44px
    - Add padding where needed
    - _Requirements: 8.3_

  - [x] 22.2 Write property test for touch targets
    - **Property 23: Touch Target Minimum Size**
    - **Validates: Requirements 8.3**

  - [x] 22.3 Add ARIA labels to new components
    - MediaUploader, ReputationBreakdown, DebateProgressIndicator
    - _Requirements: 8.2_

  - [x] 22.4 Add reduced motion support
    - Check prefers-reduced-motion media query
    - Disable animations when preference set
    - _Requirements: 8.5_

- [x] 23. Final Checkpoint - All Tests Pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 24. Integration and Wiring
  - [x] 24.1 Wire all new services into main backend index
    - Export MediaService, ReputationEngineV2, PrivacyGuard
    - Register new API routes
    - _Requirements: All_

  - [x] 24.2 Update frontend query hooks for new endpoints
    - Add useMediaUpload, useReputationBreakdown hooks
    - Update existing hooks to use privacy-filtered data
    - _Requirements: All_

  - [x] 24.3 Add SSE events for reputation updates
    - Broadcast reputation changes to affected users
    - _Requirements: 4.1_

- [x] 25. Final Integration Tests
  - [x] 25.1 Write end-to-end test for debate with media
    - Create debate, add argument with media, verify display
    - _Requirements: 2.1, 2.4_

  - [x] 25.2 Write end-to-end test for reputation flow
    - Complete debate, verify reputation updates for all participants
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 25.3 Write end-to-end test for privacy
    - Verify no individual votes exposed through any flow
    - _Requirements: 3.1, 3.2, 3.3_

## Notes

- All tasks including property-based tests are required for comprehensive coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (23 properties total)
- Unit tests validate specific examples and edge cases
- Property tests use fast-check with minimum 100 iterations each

