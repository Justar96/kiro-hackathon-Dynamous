# Project Structure

```
thesis/
├── packages/
│   ├── backend/           # Hono API server
│   │   ├── src/
│   │   │   ├── index.ts       # API routes and middleware
│   │   │   ├── broadcast.ts   # SSE connection management
│   │   │   ├── db/
│   │   │   │   ├── schema.ts  # Drizzle table definitions
│   │   │   │   ├── index.ts   # Database connection
│   │   │   │   └── seed.ts    # Database seeding
│   │   │   └── services/      # Business logic layer
│   │   │       ├── auth.service.ts
│   │   │       ├── debate.service.ts
│   │   │       ├── voting.service.ts
│   │   │       ├── market.service.ts
│   │   │       ├── comment.service.ts
│   │   │       ├── reaction.service.ts
│   │   │       ├── reputation.service.ts
│   │   │       └── steelman.service.ts
│   │   └── drizzle/           # Migration files
│   │
│   ├── frontend/          # React SPA
│   │   ├── src/
│   │   │   ├── main.tsx       # App entry point
│   │   │   ├── routes/        # TanStack Router pages
│   │   │   ├── components/
│   │   │   │   ├── auth/      # Authentication UI
│   │   │   │   ├── debate/    # Debate view components
│   │   │   │   ├── common/    # Shared UI components
│   │   │   │   ├── index-list/# Debate listing components
│   │   │   │   └── ui/        # Base UI primitives
│   │   │   └── lib/           # Hooks, queries, mutations
│   │   └── index.html
│   │
│   └── shared/            # Shared TypeScript types
│       └── src/
│           ├── types.ts       # Domain types and interfaces
│           └── sse-events.ts  # SSE event definitions
│
└── .kiro/
    ├── steering/          # AI assistant guidelines
    └── specs/             # Feature specifications
```

## Key Patterns

### Backend Services
Each service handles a specific domain (debates, voting, market, etc.) and is imported via `services/index.ts`. Services contain business logic; routes in `index.ts` handle HTTP concerns.

### Frontend Organization
- `routes/` — Page components with TanStack Router file-based routing
- `components/` — Organized by feature domain
- `lib/` — Custom hooks (`use*.ts`), React Query queries/mutations

### Naming Conventions
- `*.service.ts` — Backend business logic
- `*.property.ts` / `*.property.tsx` — Property-based tests (fast-check)
- `*.test.ts` / `*.test.tsx` — Unit/integration tests
- `use*.ts` — React hooks

### Shared Types
All domain types live in `packages/shared/src/types.ts`. Import from `@thesis/shared` in both frontend and backend.
