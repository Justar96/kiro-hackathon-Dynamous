# Tech Stack

## Runtime & Package Manager
- Bun (v1.3+) — JavaScript runtime and package manager
- Monorepo with Bun workspaces

## Backend (`packages/backend`)
- Hono — lightweight web framework
- Drizzle ORM — type-safe database queries
- Neon PostgreSQL — serverless Postgres with Neon Auth integration
- SSE (Server-Sent Events) — real-time updates via `hono/streaming`

## Frontend (`packages/frontend`)
- React 18 with TypeScript
- TanStack Router — file-based routing with type safety
- TanStack Query — server state management
- Tailwind CSS — utility-first styling
- Vite — build tool and dev server

## Shared (`packages/shared`)
- TypeScript types and interfaces shared between frontend/backend
- SSE event type definitions

## Testing
- Vitest — test runner for all packages
- fast-check — property-based testing
- Testing Library — React component testing
- jsdom — browser environment for frontend tests

## Common Commands

```bash
# Install dependencies
bun install

# Development
bun run dev:backend    # Start backend with watch mode (port 8080)
bun run dev:frontend   # Start frontend dev server (port 5173)

# Testing
bun run test                           # Run all tests
bun run --cwd packages/backend test    # Backend tests only
bun run --cwd packages/frontend test   # Frontend tests only

# Database
bun run db:generate    # Generate Drizzle migrations
bun run db:migrate     # Run migrations
bun run --cwd packages/backend db:seed  # Seed database

# Build
bun run build          # Build all packages
```

## Environment Variables
- `DATABASE_URL` — Neon PostgreSQL connection string
- `TEST_DATABASE_URL` — Separate test database connection
- Backend: `packages/backend/.env`
- Frontend: `packages/frontend/.env`
