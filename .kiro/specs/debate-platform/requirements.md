# Requirements Document

## Introduction

A debate platform where every post is a resolution, every debate is structured, and outcomes are determined by measured mind-changes—not raw upvotes. The platform combines Reddit's thread energy with Polymarket-style momentum UI (using virtual points, not blockchain) to create a unique "Persuasion Market" experience.

The core differentiator: tracking pre-read vs post-read stance changes to measure actual persuasion, not just agreement.

## Glossary

- **Resolution**: A crisp, debatable claim that forms the basis of a debate (e.g., "Remote work reduces productivity for most teams")
- **Persuasion_Market**: The visual representation of collective stance on a resolution, displayed as a dynamic bar/chart
- **Stance**: A user's position on a resolution, expressed as Support (0-100) or Oppose (100-0) with confidence level
- **Pre_Read_Stance**: User's position before reading debate arguments
- **Post_Read_Stance**: User's position after reading debate arguments
- **Persuasion_Delta**: The measured change between pre-read and post-read stances
- **Impact_Score**: A metric showing how often an argument caused mind-changes
- **Conviction_Points**: Non-transferable, non-purchasable virtual points representing user confidence/reputation
- **Round**: A structured phase of debate (Opening, Rebuttal, Closing)
- **Spectator**: A user who reads and votes on debates but doesn't participate as a debater
- **Debater**: A user actively arguing for one side of a resolution
- **Neon_Auth**: External authentication service provided by Neon for user identity management
- **Auth_User**: A user record managed by Neon Auth (neon_auth.user table)
- **Platform_User**: Extended user profile in the platform's users table, linked to Auth_User

## Requirements

### Requirement 1: Resolution Creation

**User Story:** As a user, I want to create debate resolutions, so that I can start structured discussions on specific claims.

#### Acceptance Criteria

1. WHEN a user submits a new resolution THEN THE System SHALL create a debate with the resolution text, Support/Oppose sides, and initial market price at 50/50
2. WHEN a resolution is created THEN THE System SHALL validate that the resolution is a clear, debatable claim (non-empty, reasonable length)
3. WHEN a resolution is created THEN THE System SHALL assign the creator as the initial debater for one side
4. IF a resolution text is empty or exceeds 500 characters THEN THE System SHALL reject the submission with a descriptive error

### Requirement 2: Structured Debate Rounds

**User Story:** As a debater, I want to participate in structured rounds, so that debates have clear progression and don't collapse into comment chaos.

#### Acceptance Criteria

1. THE Debate_System SHALL enforce three rounds per debate: Opening, Rebuttal, and Closing
2. WHEN a round is active THEN THE System SHALL allow only the designated side to submit their argument
3. WHEN a debater submits an argument THEN THE System SHALL enforce character limits (Opening: 2000, Rebuttal: 1500, Closing: 1000)
4. WHEN both sides complete a round THEN THE System SHALL advance to the next round
5. WHEN all three rounds are complete THEN THE System SHALL mark the debate as concluded and calculate final results
6. IF a debater attempts to post out of turn THEN THE System SHALL reject the submission

### Requirement 3: Pre/Post Stance Voting

**User Story:** As a spectator, I want to record my stance before and after reading a debate, so that my mind-change can be measured.

#### Acceptance Criteria

1. WHEN a spectator first views a debate THEN THE System SHALL prompt for pre-read stance (Support 0-100, Oppose 100-0) with confidence level
2. WHEN a spectator has recorded pre-read stance and reads arguments THEN THE System SHALL prompt for post-read stance
3. WHEN both stances are recorded THEN THE System SHALL calculate and store the persuasion delta
4. THE System SHALL prevent spectators from seeing current market price before recording pre-read stance (blind-first voting)
5. WHEN a user updates their post-read stance THEN THE System SHALL recalculate their persuasion delta

### Requirement 4: Persuasion Market Display

**User Story:** As a user, I want to see a visual market-style display of collective stance, so that I can understand the debate's momentum.

#### Acceptance Criteria

1. THE Market_Display SHALL show current Support/Oppose percentages as a dynamic bar
2. THE Market_Display SHALL show a timeline chart of stance changes over the debate duration
3. WHEN significant stance shifts occur THEN THE System SHALL mark spikes on the timeline with labels indicating the cause
4. THE Market_Display SHALL update in real-time as new votes are recorded
5. WHEN a debate concludes THEN THE System SHALL display final persuasion statistics (total mind-changes, net persuasion delta)

### Requirement 5: Argument Impact Tracking

**User Story:** As a user, I want to see which arguments caused the most mind-changes, so that I can identify the most persuasive points.

#### Acceptance Criteria

1. WHEN a spectator changes stance THEN THE System SHALL attribute impact to arguments they interacted with before changing
2. THE System SHALL calculate an Impact_Score for each argument based on attributed mind-changes
3. THE Debate_View SHALL highlight the "Most Impactful Argument" in the resolution card header
4. WHEN displaying arguments THEN THE System SHALL show impact indicators (e.g., "This argument shifted 15 minds")

### Requirement 6: Dual Reaction System

**User Story:** As a spectator, I want to separately indicate agreement and argument quality, so that good reasoning is recognized even when I disagree.

#### Acceptance Criteria

1. THE System SHALL provide two distinct reactions per argument: "I agree" and "Strong reasoning"
2. WHEN a user reacts THEN THE System SHALL store both reaction types independently
3. THE Argument_Display SHALL show counts for both reaction types separately
4. THE System SHALL allow users to give "Strong reasoning" without "I agree" and vice versa

### Requirement 7: User Reputation System

**User Story:** As a user, I want to build reputation through accurate predictions and quality contributions, so that my influence reflects my track record.

#### Acceptance Criteria

1. THE System SHALL assign each user a Reputation_Score starting at 100
2. WHEN a user's post-read stance aligns with final debate outcome THEN THE System SHALL increase their reputation
3. WHEN a user's arguments receive high impact scores THEN THE System SHALL increase their reputation
4. THE System SHALL weight votes by user reputation when calculating market prices
5. WHEN displaying user profiles THEN THE System SHALL show reputation score and prediction accuracy

### Requirement 8: Spectator Comments

**User Story:** As a spectator, I want to discuss the debate without disrupting the main argument flow, so that community engagement is preserved.

#### Acceptance Criteria

1. THE System SHALL provide a separate spectator comment section visually distinct from debate rounds
2. WHEN a spectator posts a comment THEN THE System SHALL display it in the spectator area, not the debate rounds
3. THE Spectator_Comments SHALL support threaded replies
4. THE UI SHALL clearly separate spectator chat from the structured debate content

### Requirement 9: Paper-Clean Dossier UI

**User Story:** As a user, I want a calm, book-like interface that treats debates as structured dossiers, so that I can focus on thinking rather than scrolling through feed chaos.

#### Acceptance Criteria

1. THE UI SHALL use a 3-column layout: left navigation rail, center paper surface, right margin rail
2. THE Center_Paper SHALL have a fixed max-width of 680-760px with generous margins, displaying content like a book page
3. THE Left_Rail SHALL display a table-of-contents style navigation with debate sections (Resolution, Definitions, Evidence, Round 1, Round 2, Round 3, Outcome)
4. THE Right_Rail SHALL display market data as subtle margin notes (Support/Oppose meter, sparkline chart, Before/After stance sliders, debate status)
5. THE UI SHALL use typography as the primary UI element: serif headings (Source Serif 4 or Literata), sans-serif body (Inter or IBM Plex Sans)
6. THE Color_Palette SHALL use warm off-white background (#F7F6F2), pure white paper, near-black text (#111), muted gray secondary text, and one accent color (blue) for links
7. THE UI SHALL use minimal borders (hairline or ultra-soft shadows) with mostly square corners (2-4px radius max)
8. THE System SHALL use TanStack React with Bun runtime for frontend implementation
9. THE UI SHALL be responsive: left TOC becomes slide-over drawer, right margin becomes sticky bottom sheet on mobile

### Requirement 10: Debate as Dossier Structure

**User Story:** As a user, I want each debate presented as a structured dossier with clear sections, so that arguments feel like essays rather than comment soup.

#### Acceptance Criteria

1. THE Debate_Page SHALL present debates as dossiers with sections: Resolution, Definitions (optional), Evidence Library, Round 1: Openings, Round 2: Rebuttals, Round 3: Closings, Verdict
2. THE Left_TOC SHALL highlight the current section as the user scrolls (like documentation sites)
3. THE Argument_Blocks SHALL display as paragraphs in a paper, not comment bubbles: side label (FOR/AGAINST in tiny caps), author + reputation (small), main text (readable), evidence footnotes
4. THE Evidence_System SHALL display inline citations as numbered footnotes [1] [2] that show source cards on hover in the right margin
5. THE Source_Card SHALL display: title, domain, year, 1-2 line excerpt, type (Study/News/Opinion)
6. WHEN a user scrolls past Round 2 THEN THE System SHALL unlock the After stance slider
7. THE UI SHALL show reading progress as a subtle line in the right rail

### Requirement 11: Before/After Stance Capture

**User Story:** As a spectator, I want to record my stance before and after reading with a clean slider interface, so that my mind-change can be measured without disrupting the reading experience.

#### Acceptance Criteria

1. THE Before_Slider SHALL appear at the top of the debate page as a simple 0-100 slider (or 5-step choices)
2. WHEN a user sets their Before stance THEN THE System SHALL lock it with a subtle check confirmation (no confetti)
3. THE After_Slider SHALL remain locked until the user scrolls past Round 2 content
4. WHEN a user sets their After stance THEN THE System SHALL display a small delta label (e.g., "Δ +12") and update the sparkline
5. THE Stance_Delta SHALL be the signature interaction: showing how minds changed, not just agreement
6. THE System SHALL prevent herding by locking the Before stance once set

### Requirement 12: Home Feed as Index

**User Story:** As a user, I want the home page to feel like a library catalog rather than a meme bazaar, so that I can find debates worth reading.

#### Acceptance Criteria

1. THE Home_Feed SHALL display debates as an index/reading list, not infinite scroll with previews
2. EACH Debate_Row SHALL display: resolution title (one line), small muted tags, tiny support/oppose bar, sparkline (tiny chart), mind-changes count
3. THE Home_Feed SHALL NOT display comment previews, noisy thumbnails, or emoji reactions
4. THE Home_Feed SHALL feel like a library catalog with calm typography and generous spacing

### Requirement 13: Impact Attribution UI

**User Story:** As a user, I want to see which arguments changed minds and attribute my own mind-change, so that persuasive reasoning is recognized.

#### Acceptance Criteria

1. WHEN a user changes their mind THEN THE System SHALL allow them to attribute it to a specific argument ("This changed my mind")
2. THE Argument_Display SHALL show a subtle impact badge (e.g., "Impact: +14") for net stance change attributed
3. THE Impact_Badge SHALL be visually muted (tiny, not shouting) but conceptually significant
4. THE Debate_Header SHALL highlight the "Most Impactful Argument" with a preview

### Requirement 14: New User Protections

**User Story:** As a platform operator, I want to prevent new accounts from manipulating debates, so that the system maintains integrity.

#### Acceptance Criteria

1. WHEN a new user registers THEN THE System SHALL place them in a sandbox mode for their first 5 debates
2. WHILE a user is in sandbox mode THEN THE System SHALL reduce their vote weight to 0.5x
3. WHEN a user completes sandbox mode THEN THE System SHALL grant full voting weight
4. THE System SHALL implement rate limits on posting in active debates (max 3 comments per 10 minutes)

### Requirement 15: Authentication with Neon Auth

**User Story:** As a user, I want to securely authenticate using Neon Auth, so that my identity is managed by a trusted provider.

#### Acceptance Criteria

1. WHEN a user signs up THEN THE System SHALL create an Auth_User record via Neon Auth (Stack Auth SDK)
2. WHEN a user signs up THEN THE System SHALL create a linked Platform_User record with default reputation settings
3. WHEN a user logs in THEN THE System SHALL authenticate via Neon Auth and return a valid session
4. THE System SHALL link Platform_User.authUserId to the neon_auth.user.id for identity correlation
5. WHEN displaying user information THEN THE System SHALL fetch profile data from both Auth_User and Platform_User records
