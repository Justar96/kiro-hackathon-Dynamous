# Project Structure

```
debate-platform/
├── packages/
│   ├── backend/           # Hono API server
│   │   ├── src/
│   │   │   ├── db/        # Database schema and connection
│   │   │   │   ├── schema.ts    # Drizzle schema definitions
│   │   │   │   ├── index.ts     # DB connection export
│   │   │   │   └── seed.ts      # Seed data
│   │   │   ├── services/  # Business logic layer
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── debate.service.ts
│   │   │   │   ├── user.service.ts
│   │   │   │   ├── voting.service.ts
│   │   │   │   └── *.property.ts  # Property-based tests
│   │   │   └── index.ts   # Hono app entry point
│   │   └── drizzle/       # Generated migrations
│   │
│   ├── frontend/          # React SPA
│   │   ├── src/
│   │   │   ├── components/    # Shared React components
│   │   │   ├── routes/        # TanStack Router file-based routes
│   │   │   ├── auth.ts         # Neon Auth client config
│   │   │   └── main.tsx       # App entry point
│   │   └── routeTree.gen.ts   # Auto-generated route tree
│   │
│   └── shared/            # Shared types and constants
│       └── src/
│           └── types.ts   # TypeScript interfaces, constants
```

## Conventions

- Services are singleton classes exported with both class and instance
- Property-based tests use `.property.ts` suffix
- Database schema uses Drizzle with PostgreSQL enums
- IDs are generated with nanoid
- Frontend routes auto-generate via TanStack Router plugin
- Shared package provides types consumed by both frontend and backend
- API proxy configured: frontend `/api/*` → backend `localhost:3000`
