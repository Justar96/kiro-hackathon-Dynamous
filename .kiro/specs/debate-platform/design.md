# Design Document: Debate Platform

## Overview

This document describes the technical design for a debate platform that measures persuasion through pre/post stance tracking. The platform differentiates from Reddit by focusing on epistemics (what changes minds) rather than raw upvotes.

The system uses a "Persuasion Market" model where the collective stance on resolutions is visualized like a prediction market, but powered by virtual reputation points rather than real money or blockchain.

### Tech Stack
- **Frontend**: TanStack React (React Query, TanStack Router) with Bun runtime
- **Backend**: Bun + Hono (lightweight, fast API framework)
- **Database**: Neon PostgreSQL (serverless) with Drizzle ORM
- **Authentication**: Neon Auth (Stack Auth SDK)
- **Realtime**: Server-Sent Events (SSE) for market updates
- **Styling**: Tailwind CSS for clean minimal design

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │Resolution│  │  Debate  │  │  Market  │  │    User Profile  ││
│  │  List    │  │   View   │  │  Chart   │  │                  ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│                         │                                       │
│              TanStack Query + Stack Auth SDK                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/SSE
┌─────────────────────────┴───────────────────────────────────────┐
│                      Backend (Hono + Bun)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │  Debate  │  │  Voting  │  │  Market  │  │    Reputation    ││
│  │  Service │  │  Service │  │Calculator│  │     Service      ││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
│                         │                                       │
│                    Drizzle ORM                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────────────┐
│                  Neon PostgreSQL (Serverless)                   │
│  ┌─────────────────────────┐  ┌───────────────────────────────┐│
│  │      neon_auth schema   │  │        public schema          ││
│  │  user │ session │ ...   │  │  users │ debates │ rounds ... ││
│  └─────────────────────────┘  └───────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### Layout Components

##### ThreeColumnLayout
The core layout wrapper implementing the paper-clean dossier aesthetic.
```typescript
interface ThreeColumnLayoutProps {
  leftRail: React.ReactNode;      // TOC navigation
  centerPaper: React.ReactNode;   // Main content (680-760px max)
  rightMargin: React.ReactNode;   // Market data, stance inputs
}
```

##### LeftNavRail
Table-of-contents style navigation with section highlighting.
```typescript
interface LeftNavRailProps {
  sections: NavSection[];
  activeSection: string;          // Highlighted based on scroll position
  onSectionClick: (sectionId: string) => void;
}

interface NavSection {
  id: string;
  label: string;
  indent?: number;                // For nested items
}
```

##### RightMarginRail
Subtle margin notes for market data and stance capture.
```typescript
interface RightMarginRailProps {
  debateId: string;
  marketPrice: MarketPrice;
  userStance?: { before?: number; after?: number };
  debateStatus: 'active' | 'concluded';
  readingProgress: number;        // 0-100%
}
```

#### Debate Components

#### ResolutionCard
Displays a debate resolution in the home feed index style.
```typescript
interface ResolutionCardProps {
  debate: Debate;
  marketPrice: MarketPrice;
  mindChangeCount: number;
  topImpactArgument?: Argument;
}
// Renders: title (one line), muted tags, tiny support/oppose bar, sparkline, mind-changes
```

#### DossierHeader
The resolution header at the top of a debate dossier.
```typescript
interface DossierHeaderProps {
  resolution: string;
  tags?: string[];
  status: 'active' | 'concluded';
  createdAt: Date;
}
```

#### DebateView
Main debate page with dossier structure.
```typescript
interface DebateViewProps {
  debateId: string;
}
// Renders: ThreeColumnLayout with TOC, paper content (sections), margin data
```

#### MarketChart
Sparkline visualization of stance changes (fits in margin).
```typescript
interface MarketChartProps {
  debateId: string;
  dataPoints: MarketDataPoint[];
  spikes: StanceSpike[];
  compact?: boolean;              // For margin display
}
```

#### StanceInput
Before/After stance capture with slider interface.
```typescript
interface StanceInputProps {
  debateId: string;
  type: 'before' | 'after';
  locked?: boolean;               // Before locks after set, After locks until scroll
  onSubmit: (stance: StanceValue) => void;
  currentValue?: number;
}
// Shows delta label (Δ +12) after both stances recorded
```

#### ArgumentBlock
Individual argument display as essay paragraph (not comment bubble).
```typescript
interface ArgumentBlockProps {
  argument: Argument;
  side: 'support' | 'oppose';
  author: User;
  impactScore: number;
  citations: Citation[];
  onAttributeImpact?: () => void; // "This changed my mind"
}
// Renders: side label (tiny caps), author+rep (small), main text, footnotes
```

#### EvidenceFootnote
Inline citation that shows source card on hover.
```typescript
interface EvidenceFootnoteProps {
  number: number;
  source: EvidenceSource;
}

interface EvidenceSource {
  title: string;
  domain: string;
  year: number;
  excerpt: string;
  type: 'study' | 'news' | 'opinion';
}
```

#### SourceCard
Hover card displayed in right margin for evidence citations.
```typescript
interface SourceCardProps {
  source: EvidenceSource;
  position: { top: number };      // Aligned with footnote
}
```

#### RoundSection
A section in the dossier for one debate round.
```typescript
interface RoundSectionProps {
  round: Round;
  roundNumber: 1 | 2 | 3;
  supportArgument?: Argument;
  opposeArgument?: Argument;
}
// Renders as paper section with FOR/AGAINST blocks
```

#### ImpactBadge
Subtle badge showing argument impact.
```typescript
interface ImpactBadgeProps {
  score: number;                  // Net stance change attributed
}
// Renders: "Impact: +14" in muted style
```

#### SpectatorComments
Separate comment section (visually distinct from debate rounds).
```typescript
interface SpectatorCommentsProps {
  debateId: string;
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => void;
}
```

#### ReadingProgress
Subtle progress indicator in right margin.
```typescript
interface ReadingProgressProps {
  progress: number;               // 0-100%
}
// Renders as thin vertical line
```

### Backend Services

#### DebateService
Manages debate lifecycle and round progression.
```typescript
interface DebateService {
  createDebate(resolution: string, creatorId: string, side: 'support' | 'oppose'): Promise<Debate>;
  submitArgument(debateId: string, userId: string, content: string): Promise<Argument>;
  advanceRound(debateId: string): Promise<Round>;
  concludeDebate(debateId: string): Promise<DebateResult>;
}
```

#### VotingService
Handles stance recording and persuasion calculation.
```typescript
interface VotingService {
  recordPreStance(debateId: string, userId: string, stance: StanceValue): Promise<void>;
  recordPostStance(debateId: string, userId: string, stance: StanceValue): Promise<PersuasionDelta>;
  calculatePersuasionDelta(preStance: StanceValue, postStance: StanceValue): number;
}
```

#### MarketCalculator
Computes market prices and impact scores.
```typescript
interface MarketCalculator {
  calculateMarketPrice(debateId: string): Promise<MarketPrice>;
  calculateImpactScore(argumentId: string): Promise<number>;
  getMarketHistory(debateId: string): Promise<MarketDataPoint[]>;
}
```

#### ReputationService
Manages user reputation based on prediction accuracy.
```typescript
interface ReputationService {
  updateReputation(userId: string, debateId: string, outcome: DebateOutcome): Promise<number>;
  getVoteWeight(userId: string): Promise<number>;
  isSandboxUser(userId: string): Promise<boolean>;
}
```

#### AuthService
Handles authentication via Neon Auth integration.
```typescript
interface AuthService {
  getCurrentUser(): Promise<NeonAuthUser | null>;
  getOrCreatePlatformUser(authUserId: string): Promise<User>;
  linkAuthUser(platformUserId: string, authUserId: string): Promise<void>;
}
```

### API Endpoints

```typescript
// Authentication (via Neon Auth / Stack Auth)
// Handled by Stack Auth SDK - /handler/[...stack] routes

// Debates
POST   /api/debates              // Create new debate
GET    /api/debates              // List debates
GET    /api/debates/:id          // Get debate details
POST   /api/debates/:id/arguments // Submit argument

// Voting
POST   /api/debates/:id/stance/pre   // Record pre-read stance
POST   /api/debates/:id/stance/post  // Record post-read stance
GET    /api/debates/:id/market       // Get current market price

// Reactions
POST   /api/arguments/:id/react      // Add reaction to argument

// Comments
POST   /api/debates/:id/comments     // Add spectator comment
GET    /api/debates/:id/comments     // Get comments

// Users
GET    /api/users/:id                // Get user profile
GET    /api/users/:id/stats          // Get user statistics
GET    /api/users/me                 // Get current user (from auth)

// Realtime
GET    /api/debates/:id/stream       // SSE stream for market updates
```

## Data Models

### NeonAuthUser (from neon_auth.user - managed by Neon Auth)
```typescript
interface NeonAuthUser {
  id: string;                     // UUID
  name: string | null;
  email: string | null;
  emailVerified: boolean | null;
  image: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
}
```

### User (Platform User - extended profile)
```typescript
interface User {
  id: string;
  authUserId: string | null;      // Link to neon_auth.user.id
  username: string;
  email: string;
  reputationScore: number;        // Starting at 100
  predictionAccuracy: number;     // 0-100%
  debatesParticipated: number;
  sandboxCompleted: boolean;
  createdAt: Date;
}
```

### Debate
```typescript
interface Debate {
  id: string;
  resolution: string;             // The debatable claim
  status: 'active' | 'concluded';
  currentRound: 1 | 2 | 3;
  currentTurn: 'support' | 'oppose';
  supportDebaterId: string;
  opposeDebaterId: string | null;
  createdAt: Date;
  concludedAt: Date | null;
}
```

### Round
```typescript
interface Round {
  id: string;
  debateId: string;
  roundNumber: 1 | 2 | 3;
  roundType: 'opening' | 'rebuttal' | 'closing';
  supportArgumentId: string | null;
  opposeArgumentId: string | null;
  completedAt: Date | null;
}
```

### Argument
```typescript
interface Argument {
  id: string;
  roundId: string;
  debaterId: string;
  side: 'support' | 'oppose';
  content: string;
  impactScore: number;            // Calculated from mind-changes
  createdAt: Date;
}
```

### Stance
```typescript
interface Stance {
  id: string;
  debateId: string;
  voterId: string;
  type: 'pre' | 'post';
  supportValue: number;           // 0-100
  confidence: number;             // 1-5
  lastArgumentSeen: string | null; // For impact attribution
  createdAt: Date;
}

interface StanceValue {
  supportValue: number;           // 0-100 (oppose = 100 - support)
  confidence: number;             // 1-5
}
```

### Reaction
```typescript
interface Reaction {
  id: string;
  argumentId: string;
  voterId: string;
  type: 'agree' | 'strong_reasoning';
  createdAt: Date;
}
```

### MarketDataPoint
```typescript
interface MarketDataPoint {
  timestamp: Date;
  supportPrice: number;           // 0-100
  voteCount: number;
}

interface MarketPrice {
  supportPrice: number;
  opposePrice: number;
  totalVotes: number;
  mindChangeCount: number;
}
```

### StanceSpike
```typescript
interface StanceSpike {
  timestamp: Date;
  argumentId: string;
  deltaAmount: number;            // How much the price moved
  direction: 'support' | 'oppose';
  label: string;                  // e.g., "Cited meta-analysis"
}
```

### Comment
```typescript
interface Comment {
  id: string;
  debateId: string;
  userId: string;
  parentId: string | null;        // For threading
  content: string;
  createdAt: Date;
}
```

### Database Schema (Drizzle - PostgreSQL)

```typescript
// schema.ts
import { pgTable, pgSchema, pgEnum, text, integer, real, timestamp, boolean, varchar, uuid } from 'drizzle-orm/pg-core';

// Reference to Neon Auth schema (read-only, managed by Neon Auth)
export const neonAuthSchema = pgSchema('neon_auth');

export const neonAuthUsers = neonAuthSchema.table('user', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  emailVerified: boolean('emailVerified'),
  image: text('image'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
});

// PostgreSQL Enums
export const debateStatusEnum = pgEnum('debate_status', ['active', 'concluded']);
export const turnEnum = pgEnum('turn', ['support', 'oppose']);
export const roundTypeEnum = pgEnum('round_type', ['opening', 'rebuttal', 'closing']);
export const sideEnum = pgEnum('side', ['support', 'oppose']);
export const stanceTypeEnum = pgEnum('stance_type', ['pre', 'post']);
export const reactionTypeEnum = pgEnum('reaction_type', ['agree', 'strong_reasoning']);
export const directionEnum = pgEnum('direction', ['support', 'oppose']);

// Platform users (extended profile linked to Neon Auth)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  authUserId: uuid('auth_user_id').references(() => neonAuthUsers.id),
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),  // Optional if using Neon Auth
  reputationScore: real('reputation_score').notNull().default(100),
  predictionAccuracy: real('prediction_accuracy').notNull().default(50),
  debatesParticipated: integer('debates_participated').notNull().default(0),
  sandboxCompleted: boolean('sandbox_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const debates = pgTable('debates', {
  id: text('id').primaryKey(),
  resolution: text('resolution').notNull(),
  status: debateStatusEnum('status').notNull().default('active'),
  currentRound: integer('current_round').notNull().default(1),
  currentTurn: turnEnum('current_turn').notNull().default('support'),
  supportDebaterId: text('support_debater_id').notNull().references(() => users.id),
  opposeDebaterId: text('oppose_debater_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  concludedAt: timestamp('concluded_at'),
});

export const rounds = pgTable('rounds', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  roundNumber: integer('round_number').notNull(),
  roundType: roundTypeEnum('round_type').notNull(),
  supportArgumentId: text('support_argument_id'),
  opposeArgumentId: text('oppose_argument_id'),
  completedAt: timestamp('completed_at'),
});

export const arguments_ = pgTable('arguments', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => rounds.id),
  debaterId: text('debater_id').notNull().references(() => users.id),
  side: sideEnum('side').notNull(),
  content: text('content').notNull(),
  impactScore: real('impact_score').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stances = pgTable('stances', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  voterId: text('voter_id').notNull().references(() => users.id),
  type: stanceTypeEnum('type').notNull(),
  supportValue: integer('support_value').notNull(),
  confidence: integer('confidence').notNull(),
  lastArgumentSeen: text('last_argument_seen'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reactions = pgTable('reactions', {
  id: text('id').primaryKey(),
  argumentId: text('argument_id').notNull().references(() => arguments_.id),
  voterId: text('voter_id').notNull().references(() => users.id),
  type: reactionTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  userId: text('user_id').notNull().references(() => users.id),
  parentId: text('parent_id'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const marketDataPoints = pgTable('market_data_points', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  supportPrice: real('support_price').notNull(),
  voteCount: integer('vote_count').notNull(),
});

export const stanceSpikes = pgTable('stance_spikes', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  argumentId: text('argument_id').notNull().references(() => arguments_.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  deltaAmount: real('delta_amount').notNull(),
  direction: directionEnum('direction').notNull(),
  label: text('label').notNull(),
});
```

### Database Connection (Neon Serverless)

```typescript
// db/index.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, schema });
```

## Neon Auth Integration

### UI Design System

The platform uses a "paper-clean" aesthetic inspired by book/documentation layouts.

#### Design Tokens

```typescript
// tailwind.config.js extension
const designTokens = {
  colors: {
    // Background layers
    'page-bg': '#F7F6F2',         // Warm off-white
    'paper': '#FFFFFF',            // Pure white for content
    'paper-shadow': 'rgba(0,0,0,0.04)',
    
    // Text hierarchy
    'text-primary': '#111111',     // Near-black
    'text-secondary': '#6B7280',   // Muted gray
    'text-tertiary': '#9CA3AF',    // Light gray
    
    // Accent
    'accent': '#2563EB',           // Blue for links/active
    'accent-hover': '#1D4ED8',
    
    // Semantic
    'support': '#059669',          // Green-ish for support
    'oppose': '#DC2626',           // Red-ish for oppose
  },
  
  typography: {
    // Headings: serif
    'heading': '"Source Serif 4", "Literata", Georgia, serif',
    // Body/UI: sans-serif
    'body': '"Inter", "IBM Plex Sans", system-ui, sans-serif',
  },
  
  spacing: {
    'paper-max-width': '720px',    // 680-760px range
    'paper-padding': '48px',
    'rail-width': '240px',
    'margin-width': '200px',
  },
  
  borders: {
    'hairline': '1px solid rgba(0,0,0,0.08)',
    'radius-subtle': '2px',
    'radius-small': '4px',
  },
};
```

#### Typography Scale

```css
/* Headings - Serif */
.heading-1 { font-size: 2rem; line-height: 1.3; font-weight: 600; }
.heading-2 { font-size: 1.5rem; line-height: 1.4; font-weight: 600; }
.heading-3 { font-size: 1.25rem; line-height: 1.4; font-weight: 500; }

/* Body - Sans-serif */
.body-large { font-size: 1.125rem; line-height: 1.7; }
.body { font-size: 1rem; line-height: 1.6; }
.body-small { font-size: 0.875rem; line-height: 1.5; }

/* UI elements */
.label { font-size: 0.75rem; line-height: 1.4; letter-spacing: 0.05em; text-transform: uppercase; }
.caption { font-size: 0.75rem; line-height: 1.4; color: var(--text-secondary); }
```

#### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              page-bg (#F7F6F2)                          │
│  ┌──────────┐  ┌─────────────────────────────────┐  ┌────────────────┐ │
│  │          │  │                                 │  │                │ │
│  │  Left    │  │         Paper Surface           │  │  Right Margin  │ │
│  │  Rail    │  │         (white, 720px)          │  │  (subtle)      │ │
│  │  (TOC)   │  │                                 │  │                │ │
│  │          │  │  ┌─────────────────────────┐   │  │  Support: 62   │ │
│  │  Topics  │  │  │ Resolution              │   │  │  ━━━━━━━━━━━   │ │
│  │  --------│  │  │ subtitle / tags         │   │  │  Oppose: 38    │ │
│  │          │  │  └─────────────────────────┘   │  │                │ │
│  │  Debate  │  │                                 │  │  ┌──────────┐ │ │
│  │  > Res.  │  │  Definitions                    │  │  │sparkline │ │ │
│  │    Round1│  │  ─────────────────────────────  │  │  └──────────┘ │ │
│  │    Round2│  │                                 │  │                │ │
│  │    Round3│  │  Round 1: Openings              │  │  Before: ──●── │ │
│  │    Outc. │  │  ─────────────────────────────  │  │  After:  ───── │ │
│  │          │  │  FOR │ argument text...         │  │                │ │
│  │          │  │  AGAINST │ argument text...     │  │  Δ +12         │ │
│  │          │  │                                 │  │                │ │
│  └──────────┘  └─────────────────────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Mobile Adaptation

```typescript
// Responsive breakpoints
const breakpoints = {
  mobile: '640px',
  tablet: '1024px',
  desktop: '1280px',
};

// Mobile layout changes:
// - Left rail → slide-over drawer (hamburger menu)
// - Right margin → sticky bottom sheet
// - Paper surface → full width with padding
```

### Stack Auth Setup

The platform uses Neon Auth via Stack Auth SDK for authentication:

```typescript
// Frontend: stack.ts
import { StackServerApp } from '@stackframe/stack';

export const stackServerApp = new StackServerApp({
  projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID!,
  publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY!,
  secretServerKey: process.env.STACK_SECRET_SERVER_KEY!,
});
```

### User Synchronization

When a user authenticates via Neon Auth:
1. Stack Auth creates/updates the `neon_auth.user` record
2. Platform creates/updates the linked `public.users` record
3. The `auth_user_id` column links the two records

```typescript
// Example: Get or create platform user from auth user
async function getOrCreatePlatformUser(authUser: NeonAuthUser): Promise<User> {
  const existing = await db.query.users.findFirst({
    where: eq(users.authUserId, authUser.id)
  });
  
  if (existing) return existing;
  
  return await db.insert(users).values({
    id: nanoid(),
    authUserId: authUser.id,
    username: authUser.name || `user_${nanoid(8)}`,
    email: authUser.email!,
    reputationScore: 100,
    predictionAccuracy: 50,
    debatesParticipated: 0,
    sandboxCompleted: false,
  }).returning();
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Resolution Creation Initialization

*For any* valid resolution text and creator user, creating a debate SHALL result in:
- Initial market price of exactly 50/50
- Creator assigned as supportDebaterId
- Status set to 'active'
- currentRound set to 1

**Validates: Requirements 1.1, 1.3**

### Property 2: Resolution Validation

*For any* resolution text:
- If text is non-empty AND length ≤ 500 characters, creation SHALL succeed
- If text is empty OR length > 500 characters, creation SHALL fail with error

**Validates: Requirements 1.2, 1.4**

### Property 3: Debate Round Structure Invariant

*For any* debate, there SHALL always be exactly 3 rounds created with types ['opening', 'rebuttal', 'closing'] in order.

**Validates: Requirements 2.1**

### Property 4: Turn Enforcement

*For any* debate in active state, submitting an argument:
- SHALL succeed if user is the debater for currentTurn side
- SHALL fail if user is the debater for the opposite side

**Validates: Requirements 2.2, 2.6**

### Property 5: Argument Character Limits

*For any* argument submission:
- Opening round: content length ≤ 2000 characters
- Rebuttal round: content length ≤ 1500 characters
- Closing round: content length ≤ 1000 characters
Arguments exceeding limits SHALL be rejected.

**Validates: Requirements 2.3**

### Property 6: Round Advancement

*For any* round where both supportArgumentId and opposeArgumentId are set, the debate's currentRound SHALL increment (if < 3) or debate SHALL conclude (if = 3).

**Validates: Requirements 2.4, 2.5**

### Property 7: Persuasion Delta Calculation

*For any* user with both pre-stance and post-stance recorded:
- persuasionDelta = postStance.supportValue - preStance.supportValue
- Updating post-stance SHALL recalculate delta correctly

This is a round-trip property: the delta should always equal the arithmetic difference.

**Validates: Requirements 3.3, 3.5**

### Property 8: Blind Voting Enforcement

*For any* user who has NOT recorded a pre-stance for a debate, requesting market price SHALL be denied or return a masked value.

**Validates: Requirements 3.4**

### Property 9: Market Price Calculation

*For any* debate with recorded post-stances:
- marketPrice.supportPrice = weighted average of all post-stance supportValues
- Weights are determined by user reputation and sandbox status
- supportPrice + opposePrice = 100

**Validates: Requirements 4.5, 7.4**

### Property 10: Impact Attribution

*For any* stance change (pre to post), the impact SHALL be attributed to the lastArgumentSeen at time of post-stance recording. The argument's impactScore SHALL equal the sum of all attributed deltas.

**Validates: Requirements 5.1, 5.2**

### Property 11: Dual Reaction Independence

*For any* argument and user:
- User can add 'agree' reaction without 'strong_reasoning'
- User can add 'strong_reasoning' reaction without 'agree'
- Both reactions are stored and counted independently

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 12: New User Reputation Initialization

*For any* newly created user, reputationScore SHALL equal exactly 100.

**Validates: Requirements 7.1**

### Property 13: Reputation Increase on Correct Prediction

*For any* concluded debate where user's post-stance direction matches the final outcome direction, user's reputationScore SHALL increase.

**Validates: Requirements 7.2**

### Property 14: Sandbox Vote Weight

*For any* user:
- If sandboxCompleted = false, vote weight = 0.5
- If sandboxCompleted = true, vote weight = 1.0
- sandboxCompleted becomes true after participating in 5 debates

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 15: Comment Rate Limiting

*For any* user in a debate, attempting to post more than 3 comments within a 10-minute window SHALL be rejected.

**Validates: Requirements 10.4**

### Property 16: Comment Threading

*For any* comment with a parentId, the parent comment SHALL exist and belong to the same debate.

**Validates: Requirements 8.3**

### Property 17: Auth User Linkage

*For any* platform user with an authUserId, the referenced neon_auth.user record SHALL exist.

**Validates: Requirements 11.4**

## Error Handling

### Input Validation Errors
- Empty resolution text → 400 Bad Request with message "Resolution text cannot be empty"
- Resolution too long → 400 Bad Request with message "Resolution exceeds 500 character limit"
- Argument too long → 400 Bad Request with message "Argument exceeds {limit} character limit for {roundType}"
- Invalid stance value → 400 Bad Request with message "Stance must be between 0 and 100"

### Authorization Errors
- Wrong turn submission → 403 Forbidden with message "It is not your turn to submit"
- Non-debater argument → 403 Forbidden with message "Only assigned debaters can submit arguments"
- Pre-stance not recorded → 403 Forbidden with message "Record your pre-read stance first"
- Not authenticated → 401 Unauthorized with message "Authentication required"

### Rate Limiting Errors
- Comment rate exceeded → 429 Too Many Requests with message "Maximum 3 comments per 10 minutes"

### Not Found Errors
- Invalid debate ID → 404 Not Found with message "Debate not found"
- Invalid argument ID → 404 Not Found with message "Argument not found"
- Invalid user ID → 404 Not Found with message "User not found"

### Conflict Errors
- Debate already concluded → 409 Conflict with message "Debate has already concluded"
- Round already complete → 409 Conflict with message "This round is already complete"
- Duplicate reaction → 409 Conflict with message "You have already reacted to this argument"

## Testing Strategy

### Property-Based Testing

We will use **fast-check** as the property-based testing library for TypeScript/JavaScript.

Configuration:
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: debate-platform, Property {number}: {property_text}**

Property tests will cover:
1. Resolution creation and validation (Properties 1-2)
2. Debate round structure and progression (Properties 3-6)
3. Persuasion delta calculations (Property 7)
4. Market price calculations (Property 9)
5. Impact attribution (Property 10)
6. Reaction independence (Property 11)
7. Reputation and sandbox mechanics (Properties 12-14)
8. Rate limiting (Property 15)
9. Comment threading (Property 16)
10. Auth user linkage (Property 17)

### Unit Testing

Unit tests will use **Vitest** and focus on:
- Specific examples demonstrating correct behavior
- Edge cases (empty inputs, boundary values)
- Error conditions and proper error messages
- Integration points between services
- Neon Auth integration flows

### Test Organization

```
packages/backend/src/
├── services/
│   ├── debate.service.ts
│   ├── debate.service.test.ts      # Unit tests
│   ├── debate.service.property.ts  # Property tests
│   ├── voting.service.ts
│   ├── voting.service.test.ts
│   ├── voting.service.property.ts
│   ├── auth.service.ts
│   ├── auth.service.test.ts
│   └── ...
├── utils/
│   ├── market-calculator.ts
│   ├── market-calculator.test.ts
│   └── market-calculator.property.ts
└── db/
    ├── schema.ts
    ├── schema.test.ts
    ├── index.ts
    └── seed.ts
```

### Test Coverage Goals

- All service methods have unit tests
- All correctness properties have property-based tests
- Error handling paths are tested
- Edge cases documented and tested
- Auth integration flows tested
