# Tech Stack

## Runtime & Package Manager
- Bun (v1.3+) - JavaScript runtime and package manager
- Workspaces monorepo structure

## Backend
- Hono - Web framework
- Drizzle ORM - Database ORM with PostgreSQL dialect
- Neon Database - Serverless PostgreSQL (@neondatabase/serverless)
- nanoid - ID generation

## Frontend
- React 18
- TanStack Router - File-based routing with code generation
- TanStack Query - Data fetching and caching
- Vite - Build tool and dev server
- Tailwind CSS - Styling
- Neon Auth (@neondatabase/neon-js) - Authentication via Better Auth

## Testing
- Vitest - Test runner
- fast-check - Property-based testing

## Common Commands

```bash
# Install dependencies
bun install

# Development
bun run dev:backend    # Start backend (port 3000)
bun run dev:frontend   # Start frontend (port 5173)

# Testing
bun run test           # Run all tests
bun run --cwd packages/backend test:watch  # Watch mode

# Database
bun run db:generate    # Generate Drizzle migrations
bun run db:migrate     # Run migrations
bun run --cwd packages/backend db:push     # Push schema directly
bun run --cwd packages/backend db:seed     # Seed database

# Build
bun run build          # Build all packages
```

## Environment Variables

Backend (.env):
- `DATABASE_URL` - Neon PostgreSQL connection string

Frontend (.env):
- `VITE_NEON_AUTH_URL` - Neon Auth URL (from Neon Console → Auth → Configuration)
