# Thesis UX Improvement Plan

> **Goal**: Make Thesis more Reddit-like with emphasis on easy onboarding, anonymous voting, reputation systems, and threaded comments - while polishing existing features and removing dead code.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Dead Code Cleanup](#phase-0-dead-code-cleanup)
3. [UX Polish & Bug Fixes](#phase-1-ux-polish--bug-fixes)
4. [Reddit-Style Comment Threads](#phase-2-reddit-style-comment-threads)
5. [Anonymous Voting Display](#phase-3-anonymous-voting-display)
6. [Simplified Entry Points](#phase-4-simplified-entry-points)
7. [Implementation Timeline](#implementation-timeline)

---

## Current State Analysis

### Debate Lifecycle (Current)

```
CREATE DEBATE ──► WAIT FOR OPPONENT ──► 3 STRUCTURED ROUNDS ──► OUTCOME
     │                   │                      │                  │
     │                   │                      │                  │
  Resolution      Queue/Matching         Opening → Steelman      Winner by
  Pick Side       (can take time)        Rebuttal → Steelman    Thesis
                                         Closing                   Delta
```

### What's Working Well

| Feature | Status | Notes |
|---------|--------|-------|
| Blind Voting | ✅ Secure | Pre-stance recorded before seeing market data |
| Anonymous Voting | ✅ Implemented | Voter identities never exposed in API responses |
| Threaded Comments | ✅ Backend Ready | `parentId` column, `getCommentTree()` API exists |
| Real-time Updates | ✅ Working | SSE for market, comments, arguments, rounds |
| Steelman Gate | ✅ Implemented | Forces good-faith engagement |
| Reputation System | ✅ Basic | Starting 100, bonuses for predictions/impact |

### Pain Points Identified

| Issue | Impact | Details |
|-------|--------|---------|
| High barrier to entry | High | Must create full debate with opponent |
| Opponent matching delays | High | Debates sit idle in queue |
| Complex 3-round structure | Medium | Intimidating for newcomers |
| Comments not visually threaded | Medium | Backend supports it, frontend shows flat |
| No quick engagement option | Medium | Can't just vote and move on |
| Unused code accumulation | Low | Dead components, deprecated files |

---

## Phase 0: Dead Code Cleanup

**Priority**: P0 (Do First)  
**Effort**: Low  
**Impact**: Cleaner codebase, faster builds

### Files to Delete

| File Path | Reason |
|-----------|--------|
| `packages/frontend/src/components/debate/RoundNavigator.tsx` | Deprecated, replaced by `CompactProgressBar` |
| `packages/frontend/src/components/debate/SimpleStanceInput.tsx` | Never imported or used |
| `packages/frontend/src/lib/useSignUpCallback.ts` | Complete file unused |
| `packages/frontend/src/lib/useUsernameCheck.ts` | Complete file unused |

### Exports to Remove from Barrel Files

**`packages/frontend/src/components/debate/index.ts`**:
```diff
- export { RoundNavigator } from './RoundNavigator';
- export { SimpleStanceInput } from './SimpleStanceInput';
```

**`packages/frontend/src/components/index.ts`**:
```diff
- export { AuthModalContext } from './auth/AuthModal';  // Internal, use hook instead
```

**`packages/frontend/src/components/index-list/index.ts`**:
```diff
- export { QuickStanceWidget } from './QuickStanceWidget';      // If unused
- export { OnboardingBanner } from './OnboardingBanner';        // If unused
- export { SandboxProgress } from './SandboxProgress';          // Duplicate of inline
```

### Code Consolidation

| Issue | Action |
|-------|--------|
| Sandbox Progress duplicate | Use `SandboxProgress.tsx` component OR remove it and keep inline version in `index.tsx` |
| Username validation duplicate | Consolidate `validateUsername()` from `AuthProvider.tsx` and `useUsernameCheck.ts` into shared util |
| Multiple MOBILE_BREAKPOINT definitions | Create single source of truth in `packages/frontend/src/lib/constants.ts` |

### Cleanup Checklist

- [ ] Delete 4 unused files
- [ ] Update barrel exports in 3 files
- [ ] Consolidate MOBILE_BREAKPOINT constant
- [ ] Run `bun run build` to verify no breaks
- [ ] Run `bun run typecheck` to catch import errors

---

## Phase 1: UX Polish & Bug Fixes

**Priority**: P0  
**Effort**: Medium  
**Impact**: Better user experience, accessibility compliance

### 1.1 Accessibility Fixes (High Priority)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `DebateIndexRow.tsx` | 45-99 | Article lacks heading structure | Add `aria-labelledby` pointing to resolution |
| `DebateIndexRow.tsx` | 109-152 | MiniSparkline SVG lacks a11y | Add `role="img" aria-label="Market trend"` |
| `RightMarginRail.tsx` | 243-274 | Sparkline SVG lacks a11y | Add `role="img" aria-label="Price history"` |
| `StanceInput.tsx` | 188-197 | Slider lacks `aria-valuetext` | Add descriptive value text for screen readers |
| `SpectatorComments.tsx` | 260-268 | Reply button invisible to keyboard | Keep visible but muted, add focus style |
| `DebateIndexRow.tsx` | 76 | `stopPropagation` breaks keyboard nav | Use proper button isolation pattern |

### 1.2 Loading States (Medium Priority)

| Component | Issue | Fix |
|-----------|-------|-----|
| `SpectatorComments.tsx` | No loading skeleton | Add `<SkeletonParagraph>` while comments load |
| `RightMarginRail.tsx` | No sparkline loading state | Show skeleton while `dataPoints` load |
| `MindChangeLeaderboard.tsx` | Verify loading state | Add skeleton for leaderboard data |

### 1.3 Mobile Responsiveness (Medium Priority)

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `StanceInput.tsx` | 231-261 | Confidence grid cramped on mobile | Use `grid-cols-3 sm:grid-cols-5` |
| `RoundSection.tsx` | 315-327 | Sticky header overlaps on small screens | Change to `lg:sticky` |
| `ArgumentSubmissionForm.tsx` | 109-115 | No mobile submit hint | Add touch-friendly "Tap to submit" |

### 1.4 Animation Improvements (Low Priority)

| Component | Enhancement |
|-----------|-------------|
| `DebateIndexList.tsx` | Add staggered fade-in for debate rows |
| `SpectatorComments.tsx` | Add fade-in animation for new comments |
| `StanceInput.tsx` | Add scale transition when locking stance |
| `ConnectionStatus.tsx` | Add reconnection toast notification |

### 1.5 Form UX Improvements

| Component | Issue | Fix |
|-----------|-------|-----|
| `ArgumentSubmissionForm.tsx` | No validation message for char limit | Add red text like FormField |
| `SpectatorComments.tsx` | No character limit on comments | Add maxLength with counter (500 chars) |
| `StanceInput.tsx` | Disabled button has no explanation | Add tooltip "Select position first" |
| `NewDebateModal.tsx` | No auto-focus on open | Add `autoFocus` to resolution textarea |

### 1.6 Toast/Notification Gaps

| Scenario | Action |
|----------|--------|
| Opponent joined your debate | Add toast "An opponent has joined!" |
| Your turn to argue | Add toast "It's your turn!" |
| Connection restored | Add toast "Reconnected" |
| Mind changed attribution | Add "Undo" action to toast |

### Phase 1 Checklist

- [ ] Fix 6 accessibility issues
- [ ] Add 3 missing loading states
- [ ] Fix 3 mobile responsiveness issues
- [ ] Add 4 animation improvements
- [ ] Fix 4 form UX issues
- [ ] Add 4 missing notifications

---

## Phase 2: Reddit-Style Comment Threads

**Priority**: P1  
**Effort**: Medium  
**Impact**: High - Core differentiator for engagement

### Current State

- **Backend**: ✅ Full threading support (`parentId`, `getCommentTree()`, nested replies)
- **Frontend**: ⚠️ Flat display, threading logic exists but underutilized

### Target State

```
┌────────────────────────────────────────────────────────────────┐
│  ARGUMENT BLOCK                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ @Debater_A (Support)                                     │ │
│  │ "Remote work increases productivity because..."          │ │
│  │                                                          │ │
│  │ ▲ 127  ▼   │ 💬 23 replies  │ Changed my mind (5)       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  └── Thread (collapsed by default)                             │
│      ├── Anonymous_7e4a: "Good point..." ▲8 ▼                 │
│      │   └── Anonymous_b2c1: "But consider..." ▲3 ▼          │
│      ├── Anonymous_f9d2: "Source?" ▲12 ▼                      │
│      └── [Load 19 more replies...]                             │
└────────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

#### 2.1 Backend Changes

- [ ] Add `GET /api/debates/:id/comments/count` for reply counts per argument
- [ ] Add argument-linked comments (`argumentId` field in comments table)
- [ ] Update SSE to broadcast comment counts per argument

#### 2.2 Frontend Components

**New Components:**
- [ ] `CommentThread.tsx` - Collapsible threaded comment display
- [ ] `CommentVoteButtons.tsx` - Up/down vote with count (anonymous)
- [ ] `CollapsedReplies.tsx` - "Load X more replies" button
- [ ] `AnonymousUsername.tsx` - Hash-based anonymous display name

**Updates to Existing:**
- [ ] `SpectatorComments.tsx` - Use new threaded components
- [ ] `ArgumentBlock.tsx` - Add inline comment thread preview
- [ ] Update `buildCommentTree()` to support collapse state

#### 2.3 Anonymous Username Display

```typescript
// Generate consistent anonymous name per user per debate
function getAnonymousName(userId: string, debateId: string): string {
  const hash = hashString(userId + debateId);
  return `Anon_${hash.slice(0, 4)}`;  // e.g., "Anon_7e4a"
}
```

**Rules:**
- Same user gets same anonymous name within a debate
- Different name in different debates
- Debaters shown as `@username` (public)
- Spectators shown as `Anon_xxxx` (anonymous)

### Phase 2 Checklist

- [ ] Add 1 new DB column (`argumentId` for comments)
- [ ] Create 4 new frontend components
- [ ] Update 2 existing components
- [ ] Implement anonymous username generation
- [ ] Add comment vote UI (anonymous)
- [ ] Add "Load more" pagination

---

## Phase 3: Anonymous Voting Display

**Priority**: P1  
**Effort**: Low  
**Impact**: High - Trust & privacy assurance

### Current State

- **Backend**: ✅ Voting is anonymous (aggregate data only in API)
- **Frontend**: ⚠️ Users may not realize votes are anonymous

### Target State

```
┌───────────────────────────────────────────────────────────────┐
│  MARKET POSITION (Your vote is anonymous)                     │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ████████████████░░░░░░░░  67% Support                       │
│                                                               │
│  📊 234 voters    🔄 45 minds changed    📈 +12% today        │
│                                                               │
│  🔒 Votes are anonymous - no one can see how you voted        │
└───────────────────────────────────────────────────────────────┘
```

### Implementation Tasks

#### 3.1 UI Enhancements

- [ ] Add "🔒 Anonymous" badge next to voting controls
- [ ] Add privacy tooltip explaining vote anonymity
- [ ] Show aggregate stats prominently (voters, mind changes)
- [ ] Add "Your vote is private" reassurance on stance input

#### 3.2 Privacy Indicators

| Location | Enhancement |
|----------|-------------|
| `RightMarginRail.tsx` | Add lock icon + "Anonymous" label |
| `StanceInput.tsx` | Add privacy tooltip on slider |
| `DebateIndexRow.tsx` | Show "X voters" instead of voter list |
| `AudienceStats.tsx` | Emphasize aggregate nature of stats |

### Phase 3 Checklist

- [ ] Add privacy badge to 3 components
- [ ] Add privacy tooltip to stance input
- [ ] Update copy to emphasize anonymity
- [ ] Add "X voters" aggregate display

---

## Phase 4: Simplified Entry Points

**Priority**: P2  
**Effort**: High  
**Impact**: High - Reduces barrier to entry

### 4.1 Quick Vote Flow (New)

Allow users to vote without reading full debate:

```
┌────────────────────────────────────────────────────────────────┐
│  "AI will replace most white-collar jobs by 2030"             │
│                                                                │
│  Quick Vote: [ 👍 Agree ] [ 👎 Disagree ] [ 👀 Read More ]    │
│                                                                │
│  ███████░░░ 67% agree  •  234 voters  •  Live now              │
└────────────────────────────────────────────────────────────────┘
```

**Note**: This is a simplified "pre-stance" that encourages users to later return and submit a "post-stance" after reading.

### 4.2 Simplified Index Page

```
┌────────────────────────────────────────────────────────────────┐
│  🔥 TRENDING NOW                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ "AI will replace most jobs by 2030"                    │   │
│  │ ███████░░░ 72% Agree  │  156 voters  │  🔴 Live        │   │
│  │ [ Watch ] [ Vote ]                                     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  💡 NEEDS YOUR VOTE                                            │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ "Remote work reduces productivity"                      │   │
│  │ █████░░░░░ 50% ?  │  12 voters  │  Needs opinions!     │   │
│  │ [ Quick Vote ▲/▼ ]                                     │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ⚔️ LOOKING FOR OPPONENTS                                      │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ "Universal Basic Income is feasible"                    │   │
│  │ Created by @user • Waiting for challenger               │   │
│  │ [ Accept Challenge ]                                    │   │
│  └────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Guest Voting (Pre-Signup)

Allow voting before account creation:

1. Guest votes → stored in localStorage
2. On signup → sync votes to account
3. Prompt to create account after 3 votes

### Implementation Tasks

#### 4.4 New Components

- [ ] `QuickVoteCard.tsx` - Simplified voting card for index
- [ ] `TrendingSection.tsx` - Curated trending debates
- [ ] `NeedsVotesSection.tsx` - Debates with low vote count
- [ ] `GuestVoteStorage.ts` - LocalStorage management for guest votes

#### 4.5 Backend Changes

- [ ] Add `GET /api/debates/trending` - Top debates by activity
- [ ] Add `GET /api/debates/needs-votes` - Low vote count debates
- [ ] Add `POST /api/sync-guest-votes` - Sync guest votes on signup

### Phase 4 Checklist

- [ ] Create 4 new frontend components
- [ ] Add 3 new backend endpoints
- [ ] Implement guest vote localStorage sync
- [ ] Update index page layout
- [ ] Add signup prompt after 3 guest votes

---

## Implementation Timeline

### Week 1: Foundation

| Day | Task | Phase |
|-----|------|-------|
| 1 | Delete unused files, update barrel exports | Phase 0 |
| 1 | Consolidate MOBILE_BREAKPOINT constant | Phase 0 |
| 2 | Fix accessibility issues (6 items) | Phase 1 |
| 3 | Add missing loading states | Phase 1 |
| 4 | Fix mobile responsiveness issues | Phase 1 |
| 5 | Add animation improvements | Phase 1 |

### Week 2: Comments & Privacy

| Day | Task | Phase |
|-----|------|-------|
| 1-2 | Create CommentThread component | Phase 2 |
| 3 | Implement anonymous usernames | Phase 2 |
| 4 | Add comment voting UI | Phase 2 |
| 5 | Add privacy badges and tooltips | Phase 3 |

### Week 3: Entry Points

| Day | Task | Phase |
|-----|------|-------|
| 1-2 | Create QuickVoteCard component | Phase 4 |
| 3 | Update index page layout | Phase 4 |
| 4 | Add trending/needs-votes endpoints | Phase 4 |
| 5 | Implement guest vote sync | Phase 4 |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Time to first vote | ~3 min | <30 sec | Analytics |
| Debate participation rate | ? | +50% | User signups vs debates joined |
| Comment engagement | Low | +100% | Comments per debate |
| Mobile usability score | ? | 90+ | Lighthouse |
| Accessibility score | ? | 95+ | axe-core audit |

---

## Technical Notes

### Build Commands

```bash
# Type check
bun run typecheck

# Build all packages
bun run build

# Run tests
bun run test

# Dev server
bun run dev
```

### Key Files Reference

| Area | Files |
|------|-------|
| Routing | `packages/frontend/src/routes/*.tsx` |
| Components | `packages/frontend/src/components/**/*.tsx` |
| Hooks | `packages/frontend/src/lib/*.ts` |
| Backend Routes | `packages/backend/src/index.ts` |
| Services | `packages/backend/src/services/*.ts` |
| DB Schema | `packages/backend/src/db/schema.ts` |
| Shared Types | `packages/shared/src/types.ts` |

---

## Appendix: Files to Modify by Phase

### Phase 0 (Cleanup)
- Delete: 4 files
- Modify: 3 barrel export files

### Phase 1 (Polish)
- Modify: ~12 component files
- Add: Minor utility functions

### Phase 2 (Comments)
- Add: 4 new components
- Modify: 2 existing components
- Backend: 1 new column, 1 new endpoint

### Phase 3 (Privacy)
- Modify: 4 components (UI only)

### Phase 4 (Entry Points)
- Add: 4 new components
- Backend: 3 new endpoints
- Modify: Index page layout
