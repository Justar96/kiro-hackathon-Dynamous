# Repository Guidelines

## Project Structure & Module Organization
- `packages/backend/`: Bun + TypeScript backend (`src/` for app code, `test/` for Bun tests).
- `packages/frontend/`: Vite + React frontend (`src/` for UI, `index.html`, Tailwind config).
- `packages/shared/`: Shared TypeScript types/utilities (`src/`).
- `contracts/`: Solidity contracts and vendor libraries.
- `docs/`: Architecture notes and phase documentation.

## Build, Test, and Development Commands
- `bun install`: install workspace dependencies.
- `bun run dev:backend`: run backend with watch mode.
- `bun run dev:frontend`: run Vite dev server for the frontend.
- `bun run build`: build backend and frontend.
- `bun run test`: run backend tests (Bun) and shared tests (Vitest).
- `bun run --cwd packages/frontend test`: run frontend Vitest suite.
- `bun run db:generate` / `bun run db:migrate`: backend database tooling.

## Coding Style & Naming Conventions
- TypeScript everywhere; packages use ESM (`"type": "module"`).
- No repo-wide lint/format config detected; follow existing file style.
- React components use `PascalCase`, hooks use `useX` naming.
- Test naming patterns: `*.test.ts`, `*.property.tsx`, `*.integration.test.tsx`.

## Testing Guidelines
- Backend: `bun test` runs tests in `packages/backend/test/`.
- Frontend + shared: Vitest (`packages/frontend/src/**`, `packages/shared/src/**`).
- Prefer colocated tests near the feature; keep property tests in `*.property.tsx` when applicable.

## Commit & Pull Request Guidelines
- Commit style follows Conventional Commits (e.g., `feat(scope): ...`, `chore: ...`).
- PRs should include a short summary, testing performed, and screenshots for UI changes.
- Link related issues or specs when available.

## Configuration & Secrets
- Use `.env.example` files in `packages/backend/` and `packages/frontend/` as templates.
- Do not commit real secrets; document new env vars in the relevant example file.
