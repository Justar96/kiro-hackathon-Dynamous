# Index Page Improvement Proposals

## Overview
This document outlines proposed enhancements to the debate platform's index page to increase user engagement, improve discoverability, and leverage existing backend features.

---

## Selected Features for Implementation

### 1. User's Debates Tab System
**Priority: HIGH**

#### Description
A tab navigation system that allows users to filter debates based on their relationship to them.

#### Tabs
1. **All Debates** (Default)
   - Shows all debates on the platform
   - Current behavior maintained
   
2. **My Debates**
   - Debates where user is a debater (support or oppose side)
   - Debates where user has submitted a stance (pre or post)
   - Shows user's participation level

3. **Watching** (Future Enhancement)
   - Debates user has bookmarked/favorited
   - Could use localStorage initially, database later
   - Quick access to debates of interest

#### Benefits
- Personalized experience for logged-in users
- Quick access to relevant debates
- Encourages return visits to track debates
- Reduces cognitive load when browsing

#### Technical Implementation
```typescript
// Component Structure
<DebateTabs 
  activeTab="all" | "my-debates" | "watching"
  onTabChange={(tab) => void}
  myDebatesCount={number}
  watchingCount={number}
/>

// Backend Integration
- Use existing: debateService.getUserDebateHistory(userId)
- Filter debates by user participation
- Count user's active debates
```

#### UI/UX Design
- Clean tab navigation with counts
- Active tab highlighted with accent color
- Smooth transition between views
- Empty state for "My Debates" when user hasn't participated
- Persistent tab selection (localStorage)

---

### 2. Trending Debates Card
**Priority: HIGH**

#### Description
A prominent featured section displaying 2-3 most active/trending debates to capture user attention and highlight platform activity.

#### Metrics for "Trending"
1. **Mind Change Count** (Primary)
   - Debates with highest `mindChangeCount`
   - Indicates persuasive arguments

2. **Recent Activity** (Secondary)
   - Debates with recent argument submissions
   - Current round progression
   - Active turn indicators

3. **Stance Volatility** (Tertiary)
   - Large market price swings
   - Recent stance spikes
   - Controversial debates

#### Visual Elements
- **Larger card format** - Stands out from list
- **Live indicator** - Pulsing dot for active debates
- **Market visualization** - Mini sparkline of price movement
- **Delta badges** - Prominent mind-change count
- **Status indicators** - Current round, whose turn
- **Gradient background** - Subtle accent to differentiate

#### Layout Options
**Option A: Horizontal Cards (Recommended)**
```
┌───────────────────────────────────────────────────┐
│ 🔥 Trending Debates                               │
├─────────────┬─────────────┬─────────────────────┐
│ Debate 1    │ Debate 2    │ Debate 3            │
│ 🟢 Live     │ R3/3        │ R2/3                │
│ Δ 24 minds  │ Δ 18 minds  │ Δ 15 minds          │
│ [Chart]     │ [Chart]     │ [Chart]             │
└─────────────┴─────────────┴─────────────────────┘
```

**Option B: Vertical Stack**
```
┌───────────────────────────────────────┐
│ 🔥 Trending Debates                   │
├───────────────────────────────────────┤
│ 1. [Debate Title] • 🟢 Live • Δ 24   │
│    [Mini Chart] Support: 67% → 82%   │
├───────────────────────────────────────┤
│ 2. [Debate Title] • R3/3 • Δ 18      │
│    [Mini Chart] Support: 45% → 38%   │
└───────────────────────────────────────┘
```

#### Benefits
- Immediate engagement hook for visitors
- Showcases platform activity
- Highlights quality debates
- Creates FOMO (fear of missing out)
- Social proof through participation numbers

#### Technical Implementation
```typescript
// Component
<TrendingDebatesCard 
  debates={DebateWithMarket[]}
  maxCount={3}
  sortBy="mind-changes" | "recent-activity" | "volatility"
/>

// Backend
- Sort debates by mindChangeCount
- Filter active debates only
- Get top 3 results
- Include market data and current status
```

---

### 3. Leaderboard Section
**Priority: HIGH**

#### Description
A gamification feature showcasing top-performing arguments and users to encourage quality participation and competition.

#### Two Sub-Sections

##### 3A. Top Arguments
**Displays: Top 5-10 arguments by impact score**

**Data Points:**
- Argument excerpt (first 100 chars)
- Debater username + reputation
- Impact score (from `argument.impactScore`)
- Debate resolution (linked)
- Side (Support/Oppose)
- Timestamp

**Visual Design:**
```
┌─────────────────────────────────────┐
│ 🏆 Top Arguments                     │
├─────────────────────────────────────┤
│ 1. "Climate data from 2020..."      │
│    by @scientist_42 (Rep: +150)     │
│    Impact: +47 • For • Climate...   │
├─────────────────────────────────────┤
│ 2. "Historical precedent shows..."  │
│    by @historian (Rep: +89)         │
│    Impact: +42 • Against • Voting..│
└─────────────────────────────────────┘
```

##### 3B. Top Users
**Displays: Top 5-10 users by reputation score**

**Data Points:**
- Username
- Reputation score (from `user.reputationScore`)
- Prediction accuracy (from `user.predictionAccuracy`)
- Debates participated
- Sandbox status
- Total impact score (sum of argument impacts)

**Visual Design:**
```
┌─────────────────────────────────────┐
│ 👥 Top Debaters                      │
├─────────────────────────────────────┤
│ 1. @master_debater                  │
│    Rep: +250 • 89% accuracy         │
│    42 debates • 580 total impact    │
├─────────────────────────────────────┤
│ 2. @logic_lord                      │
│    Rep: +198 • 76% accuracy         │
│    35 debates • 420 total impact    │
└─────────────────────────────────────┘
```

#### Gamification Elements
- **Rankings** - Clear 1st, 2nd, 3rd positions
- **Badges** - Top 10, Top 100 indicators
- **Trends** - Up/down arrows for movement
- **Achievements** - "Rising Star", "Consistent", "Influential"

#### Benefits
- Motivates quality arguments
- Encourages accurate predictions
- Creates community recognition
- Transparent reputation system
- Rewards engagement

#### Technical Implementation
```typescript
// Components
<LeaderboardSection>
  <TopArguments arguments={TopArgument[]} />
  <TopUsers users={TopUser[]} />
</LeaderboardSection>

// Backend (Existing)
- marketService.getTopArguments(limit: 10)
- Create: userService.getTopUsers(limit: 10)

// New Backend Method
async getTopUsers(limit: number): Promise<TopUser[]> {
  // Query users ordered by reputationScore DESC
  // Include debatesParticipated, predictionAccuracy
  // Calculate total impact from arguments
}
```

---

## Page Layout Integration

### Desktop Layout (>= 1024px)
```
┌────────────────────────────────────────────────────────┐
│ Header: Debate Index                                    │
│ Subtitle: Structured debates...                        │
├────────────────────────────────────────────────────────┤
│ [All Debates] [My Debates] [Watching]                  │
├────────────────────────────────────────────────────────┤
│ 🔥 Trending Debates                                     │
│ ┌──────────┬──────────┬──────────┐                    │
│ │ Debate 1 │ Debate 2 │ Debate 3 │                    │
│ └──────────┴──────────┴──────────┘                    │
├───────────────────────────────┬────────────────────────┤
│ Main Debate List               │ 🏆 Leaderboards        │
│                               │ ┌──────────────────┐  │
│ ┌───────────────────────────┐ │ │ Top Arguments    │  │
│ │ Resolution 1              │ │ │ 1. ...           │  │
│ │ S/O • Trend • Minds       │ │ │ 2. ...           │  │
│ └───────────────────────────┘ │ └──────────────────┘  │
│ ┌───────────────────────────┐ │ ┌──────────────────┐  │
│ │ Resolution 2              │ │ │ Top Users        │  │
│ │ S/O • Trend • Minds       │ │ │ 1. ...           │  │
│ └───────────────────────────┘ │ │ 2. ...           │  │
│                               │ └──────────────────┘  │
│ (continued list...)           │                        │
└───────────────────────────────┴────────────────────────┘
```

### Tablet Layout (768px - 1023px)
```
┌────────────────────────────────────────┐
│ Header + Tabs                           │
├────────────────────────────────────────┤
│ 🔥 Trending Debates (2 cards)          │
│ ┌──────────────┬──────────────┐       │
│ │ Debate 1     │ Debate 2     │       │
│ └──────────────┴──────────────┘       │
├────────────────────────────────────────┤
│ Main Debate List (Full Width)          │
├────────────────────────────────────────┤
│ 🏆 Leaderboards (Below List)            │
│ ┌──────────────┬──────────────┐       │
│ │ Top Args     │ Top Users    │       │
│ └──────────────┴──────────────┘       │
└────────────────────────────────────────┘
```

### Mobile Layout (< 768px)
```
┌──────────────────────────┐
│ Header                    │
├──────────────────────────┤
│ [All][My][Watch] Tabs    │
├──────────────────────────┤
│ 🔥 Trending (1 card)     │
│ ┌──────────────────────┐ │
│ │ Debate 1             │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ Main Debate List         │
│ (Stacked vertically)     │
├──────────────────────────┤
│ 🏆 Top Arguments         │
│ (Collapsed by default)   │
├──────────────────────────┤
│ 👥 Top Users             │
│ (Collapsed by default)   │
└──────────────────────────┘
```

---

## Component Architecture

### New Components to Create

#### 1. `DebateTabs.tsx`
```typescript
interface DebateTabsProps {
  activeTab: 'all' | 'my-debates' | 'watching';
  onTabChange: (tab: string) => void;
  myDebatesCount?: number;
  watchingCount?: number;
  userId?: string;
}

export function DebateTabs({ ... }: DebateTabsProps) {
  // Tab navigation with counts
  // Active state management
  // Keyboard navigation support
}
```

#### 2. `TrendingDebatesCard.tsx`
```typescript
interface TrendingDebatesCardProps {
  debates: DebateWithMarket[];
  maxCount?: number;
  layout?: 'horizontal' | 'vertical';
}

export function TrendingDebatesCard({ ... }: TrendingDebatesCardProps) {
  // Featured debate cards
  // Live indicators
  // Market visualizations
  // Mind change badges
}
```

#### 3. `LeaderboardSection.tsx`
```typescript
interface LeaderboardSectionProps {
  topArguments?: TopArgument[];
  topUsers?: TopUser[];
  maxItems?: number;
  collapsible?: boolean;
}

export function LeaderboardSection({ ... }: LeaderboardSectionProps) {
  // Contains TopArguments and TopUsers
  // Responsive layout
  // Loading states
}
```

#### 4. `TopArgumentCard.tsx`
```typescript
interface TopArgumentCardProps {
  argument: TopArgument;
  rank: number;
  compact?: boolean;
}

export function TopArgumentCard({ ... }: TopArgumentCardProps) {
  // Argument excerpt
  // Debater info
  // Impact score
  // Link to debate
}
```

#### 5. `TopUserCard.tsx`
```typescript
interface TopUserCardProps {
  user: TopUser;
  rank: number;
  compact?: boolean;
}

export function TopUserCard({ ... }: TopUserCardProps) {
  // Username + avatar
  // Reputation score
  // Stats (accuracy, debates)
  // Link to profile
}
```

### Modified Components

#### `routes/index.tsx`
```typescript
// Add tab state management
const [activeTab, setActiveTab] = useState<'all' | 'my-debates' | 'watching'>('all');

// Filter debates based on tab
const filteredDebates = useMemo(() => {
  switch (activeTab) {
    case 'my-debates':
      return debatesWithMarket.filter(d => 
        d.debate.supportDebaterId === userId || 
        d.debate.opposeDebaterId === userId ||
        userHasVoted(d.debate.id)
      );
    case 'watching':
      return getWatchedDebates();
    default:
      return debatesWithMarket;
  }
}, [activeTab, debatesWithMarket, userId]);

// Get trending debates
const trendingDebates = useMemo(() => 
  [...debatesWithMarket]
    .sort((a, b) => 
      (b.marketPrice?.mindChangeCount ?? 0) - (a.marketPrice?.mindChangeCount ?? 0)
    )
    .slice(0, 3)
, [debatesWithMarket]);
```

---

## Backend Enhancements

### New API Endpoints

#### 1. Get Top Users
```typescript
// packages/backend/src/routes/users.ts
router.get('/users/top', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const topUsers = await userService.getTopUsers(limit);
  res.json(topUsers);
});
```

#### 2. Get My Debates
```typescript
// packages/backend/src/routes/debates.ts
router.get('/debates/my', async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const myDebates = await debateService.getUserDebateHistory(userId);
  const myStances = await stanceService.getUserStances(userId);
  
  // Combine debates where user is debater or voter
  const uniqueDebateIds = new Set([
    ...myDebates.map(d => d.id),
    ...myStances.map(s => s.debateId)
  ]);
  
  const debates = await Promise.all(
    Array.from(uniqueDebateIds).map(id => 
      debateService.getDebateById(id)
    )
  );
  
  res.json(debates);
});
```

### New Service Methods

#### `UserService.getTopUsers()`
```typescript
// packages/backend/src/services/user.service.ts
async getTopUsers(limit: number = 10): Promise<TopUser[]> {
  const topUsers = await db.query.users.findMany({
    orderBy: [desc(users.reputationScore)],
    limit,
  });
  
  // Calculate total impact for each user
  const usersWithImpact = await Promise.all(
    topUsers.map(async (user) => {
      const userArguments = await db.query.arguments_.findMany({
        where: eq(arguments_.debaterId, user.id),
      });
      
      const totalImpact = userArguments.reduce(
        (sum, arg) => sum + arg.impactScore, 
        0
      );
      
      return {
        id: user.id,
        username: user.username,
        reputationScore: user.reputationScore,
        predictionAccuracy: user.predictionAccuracy,
        debatesParticipated: user.debatesParticipated,
        sandboxCompleted: user.sandboxCompleted,
        totalImpact,
      };
    })
  );
  
  return usersWithImpact;
}
```

---

## Data Flow

### User's Debates Tab
1. User clicks "My Debates" tab
2. Frontend calls `/api/debates/my` (if not cached)
3. Backend queries debates + stances for user
4. Frontend filters and displays user's debates
5. Cache result for 5 minutes

### Trending Debates
1. Load all debates with market data (existing)
2. Frontend sorts by `mindChangeCount` DESC
3. Take top 3 debates
4. Render in featured card format
5. Update on SSE market events

### Leaderboard
1. On page load, fetch top arguments and users
2. Backend queries sorted by impact/reputation
3. Frontend renders leaderboard cards
4. Cache for 10 minutes
5. Show loading skeleton while fetching

---

## Query Integration

### React Query Hooks

```typescript
// packages/frontend/src/lib/queries.ts

// Top Arguments
export const topArgumentsQueryOptions = {
  queryKey: ['topArguments'],
  queryFn: async () => {
    const response = await fetch('/api/arguments/top?limit=10');
    return response.json();
  },
  staleTime: 10 * 60 * 1000, // 10 minutes
};

// Top Users
export const topUsersQueryOptions = {
  queryKey: ['topUsers'],
  queryFn: async () => {
    const response = await fetch('/api/users/top?limit=10');
    return response.json();
  },
  staleTime: 10 * 60 * 1000, // 10 minutes
};

// My Debates
export const myDebatesQueryOptions = (userId?: string) => ({
  queryKey: ['myDebates', userId],
  queryFn: async () => {
    if (!userId) return [];
    const response = await fetch('/api/debates/my');
    return response.json();
  },
  enabled: !!userId,
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

---

## Accessibility Considerations

### Keyboard Navigation
- Tab key cycles through debate tabs
- Arrow keys navigate within leaderboards
- Enter/Space activates links
- Focus indicators on all interactive elements

### Screen Readers
- Proper ARIA labels for tabs
- Landmark regions (main, complementary, navigation)
- Alt text for icons and badges
- Meaningful link text

### Responsive Touch Targets
- Minimum 44x44px for all clickable elements
- Adequate spacing between tabs
- Easy-to-tap trending debate cards

---

## Performance Optimization

### Caching Strategy
- Trending debates: Derive from existing data (no extra request)
- Top arguments: Cache 10 minutes, prefetch on hover
- Top users: Cache 10 minutes, background refresh
- My debates: Cache 5 minutes, invalidate on debate action

### Lazy Loading
- Leaderboard loads after main list renders
- Trending debates load with priority
- Images lazy load with intersection observer

### Code Splitting
- Leaderboard components split into separate chunk
- Load on viewport intersection

---

## Analytics & Metrics

### Track User Behavior
- Tab switching frequency
- Trending debate click-through rate
- Leaderboard engagement
- Time spent on index page

### Success Metrics
- Increased return visits
- Higher debate participation rate
- More varied debate discovery
- Reduced bounce rate

---

## Future Enhancements

### Phase 2 Features
1. **Debate Categories/Tags**
   - Organize debates by topic (Politics, Science, Ethics)
   - Filter by category
   - Tag-based recommendations

2. **Advanced Filtering**
   - Sort by: Newest, Trending, Controversial, Concluded
   - Status filter: Active, Concluded, All
   - Date range picker

3. **Search Functionality**
   - Full-text search across resolutions
   - Real-time filtering
   - Search history

4. **Personalized Recommendations**
   - "Debates you might like" based on voting history
   - ML-powered suggestions
   - Similar debates section

5. **Watching/Bookmarking**
   - Backend-persisted watching list
   - Email/push notifications for watched debates
   - Custom lists/collections

6. **Quick Stats Dashboard**
   - Total debates count
   - Active users count
   - Total mind changes today
   - Platform velocity metrics

---

## Implementation Timeline

### Sprint 1 (Week 1)
- [ ] Create DebateTabs component
- [ ] Implement tab filtering logic
- [ ] Add localStorage for watched debates
- [ ] Basic styling and responsive design

### Sprint 2 (Week 2)
- [ ] Create TrendingDebatesCard component
- [ ] Add mini market visualizations
- [ ] Implement live indicators
- [ ] Polish animations and transitions

### Sprint 3 (Week 3)
- [ ] Create LeaderboardSection components
- [ ] Add backend endpoint for top users
- [ ] Implement TopArgumentCard and TopUserCard
- [ ] Integrate with existing market service

### Sprint 4 (Week 4)
- [ ] Integration testing
- [ ] Responsive design refinement
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] User acceptance testing

---

## Design System Tokens

### Colors
```scss
// Trending indicators
--color-trending-live: #10b981; // Green for live
--color-trending-recent: #f59e0b; // Orange for recent

// Leaderboard
--color-rank-gold: #fbbf24; // 1st place
--color-rank-silver: #9ca3af; // 2nd place
--color-rank-bronze: #f97316; // 3rd place
```

### Spacing
```scss
--spacing-trending-card: 1.5rem;
--spacing-leaderboard: 1rem;
--spacing-tab-gap: 0.5rem;
```

### Typography
```scss
--font-leaderboard-rank: 1.25rem;
--font-trending-title: 1.125rem;
--font-stats-value: 1.5rem;
```

---

## Testing Strategy

### Unit Tests
- Tab switching logic
- Debate filtering functions
- Leaderboard sorting
- Data transformations

### Integration Tests
- API endpoints for top users/arguments
- Query hooks with React Query
- SSE updates for trending debates

### E2E Tests
- Navigate between tabs
- Click trending debate
- View leaderboard details
- Mobile responsiveness

---

## Conclusion

These three features work synergistically to:
1. **Personalize** the experience (User's Debates Tabs)
2. **Engage** users immediately (Trending Debates Card)
3. **Gamify** participation (Leaderboard Section)

Together, they transform the index page from a simple list to an engaging hub that encourages exploration, participation, and return visits.

The implementation leverages existing backend services and maintains the clean, minimal aesthetic of the platform while adding valuable functionality that increases user engagement and platform value.
