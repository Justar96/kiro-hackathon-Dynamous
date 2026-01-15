# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thesis is a structured debate platform where outcomes are determined by "persuasion delta" (mind changes) rather than raw upvotes. Users create debates with resolutions, take support/oppose sides, and spectators record pre-read and post-read stances to measure argument impact.

## Commands

```bash
# Install dependencies
bun install

# Development (run in separate terminals)
bun run dev:backend    # Backend on port 8080
bun run dev:frontend   # Frontend on port 5173

# Testing
bun run test                              # All tests
bun run --cwd packages/backend test       # Backend only
bun run --cwd packages/frontend test      # Frontend only
bun run --cwd packages/shared test        # Shared only
bun run --cwd packages/backend test:watch # Watch mode

# Single test file
bun run --cwd packages/backend vitest run src/services/debate.service.property.ts

# Database
bun run db:generate    # Generate Drizzle migrations
bun run db:migrate     # Run migrations
bun run --cwd packages/backend db:seed   # Seed database
bun run --cwd packages/backend db:push   # Push schema without migration

# Build
bun run build
```

## Architecture

### Monorepo Structure

Three packages with workspace dependencies:
- `packages/backend` - Hono API server with Drizzle ORM
- `packages/frontend` - React 18 SPA with TanStack Router/Query
- `packages/shared` - TypeScript types imported via `@thesis/shared`

### Backend (`packages/backend`)

**Entry point:** `src/index.ts` - Hono routes and middleware

**Services pattern:** All business logic in `src/services/*.service.ts`, exported via `src/services/index.ts`. Routes handle HTTP concerns only; services handle domain logic.

**Key services:**
- `debate.service.ts` - Debate creation, round advancement
- `voting.service.ts` - Stance recording (pre-read/post-read)
- `market.service.ts` - Persuasion delta calculations
- `steelman.service.ts` - Steelman Gate verification
- `matching.service.ts` - Opponent matching

**Real-time:** SSE via `broadcast.ts` for live updates (arguments, market shifts, comments)

**Database:** Drizzle ORM with Neon PostgreSQL. Schema in `src/db/schema.ts`.

### Frontend (`packages/frontend`)

**Routing:** TanStack Router with file-based routes in `src/routes/`. Root layout in `__root.tsx`.

**State management:** TanStack Query for server state. Query definitions in `src/lib/api/queries/`, mutations in `src/lib/api/mutations/`.

**Real-time:** SSE hooks in `src/lib/sse/` sync with React Query cache.

**Component organization:**
- `components/debate/` - Debate view components
- `components/index-list/` - Feed and listing components
- `components/auth/` - Authentication UI
- `components/common/` - Shared UI components
- `components/icons/` - Custom icon components

**Hooks:** Custom hooks in `src/lib/hooks/` organized by concern:
- `data/` - Data fetching (useDebates, useMarket, useStances)
- `optimistic/` - Optimistic updates
- `form/` - Form state management
- `navigation/` - Deep linking, scroll restoration

### Shared (`packages/shared`)

**Types:** All domain types in `src/types.ts`. Round configuration is the single source of truth:
```typescript
export const ROUNDS = [
  { number: 1, type: 'opening', charLimit: 2000 },
  { number: 2, type: 'rebuttal', charLimit: 1500 },
  { number: 3, type: 'closing', charLimit: 1000 },
];
```

**SSE Events:** Event type definitions in `src/sse-events.ts`.

## Testing

Uses Vitest with fast-check for property-based testing.

**Naming conventions:**
- `*.test.ts` / `*.test.tsx` - Unit/integration tests
- `*.property.ts` / `*.property.tsx` - Property-based tests

**Backend tests:** Use `TEST_DATABASE_URL` env var. Tests run sequentially to avoid DB conflicts. Import `setupTestDb`/`cleanTestDb` from `src/db/test-setup.ts`.

**Frontend tests:** jsdom environment with Testing Library. Setup in `src/test-setup.ts`.

## Environment Variables

- `DATABASE_URL` - Neon PostgreSQL connection string
- `TEST_DATABASE_URL` - Separate test database connection

Config files: `packages/backend/.env`, `packages/frontend/.env`

## Key Domain Concepts

- **Persuasion Delta:** Mind changes attributed to specific arguments, not vote counts
- **Pre/Post Stances:** Spectators record position before and after reading, enabling blind voting
- **Steelman Gate:** Debaters must demonstrate understanding of opponent's position before rebuttals
- **Three-Round Format:** Opening (2000 chars) → Rebuttal (1500 chars) → Closing (1000 chars)
