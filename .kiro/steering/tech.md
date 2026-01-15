# Thesis - Tech Stack

## Package Manager & Runtime

- **Bun** - Primary runtime and package manager
- **Monorepo** - Bun workspaces (`packages/*`)

## Frontend (`packages/frontend`)

- **React 18** with TypeScript
- **Vite** - Build tool with React plugin
- **TanStack Router** - File-based routing with code splitting
- **TanStack Query** - Server state management
- **TanStack Virtual** - Virtualized lists
- **Tailwind CSS** - Styling
- **wagmi/viem** - Ethereum wallet integration
- **Motion** - Animations
- **Neon Auth** - Authentication via `@neondatabase/neon-js`

## Backend (`packages/backend`)

- **Hono** - Lightweight HTTP framework
- **ethers.js v6** - Ethereum utilities (signing, hashing)
- **Bun runtime** - Server execution

## Shared (`packages/shared`)

- TypeScript types and domain models
- Contract ABIs and addresses
- SSE event definitions

## Smart Contracts (`contracts/`)

- **Solidity 0.8.24** with Cancun EVM
- **Foundry** - Build, test, deploy
- **OpenZeppelin** - Security primitives (ReentrancyGuard, Ownable, Pausable, SafeERC20)
- **Gnosis CTF** - Conditional Tokens Framework for outcome tokens
- **UMA Protocol** - Optimistic oracle integration (planned)

## Testing

- **Vitest** - Frontend and shared package tests
- **fast-check** - Property-based testing (frontend)
- **Foundry fuzz** - Property-based testing (contracts)
- **Testing Library** - React component testing

---

## Common Commands

### Root Level
```bash
bun install              # Install all dependencies
bun run dev:frontend     # Start frontend dev server (port 5173)
bun run dev:backend      # Start backend dev server (port 3001)
bun run build            # Build all packages
bun run test             # Run backend and shared tests
```

### Frontend (`packages/frontend`)
```bash
bun run dev              # Vite dev server
bun run build            # TypeScript check + Vite build
bun run test             # Vitest (single run)
bun run test:watch       # Vitest (watch mode)
```

### Backend (`packages/backend`)
```bash
bun run dev              # Watch mode with Bun
bun run build            # Bundle to dist/
bun test                 # Bun test runner
bun run typecheck        # TypeScript check
```

### Contracts (`contracts/`)
```bash
forge build              # Compile contracts
forge test               # Run all tests
forge test --match-contract <Name>  # Run specific test
forge test -vvv          # Verbose output with traces
forge fmt                # Format Solidity code
forge coverage           # Test coverage report
```

### Fuzz Testing (Contracts)
```bash
forge test --match-contract Fuzz     # Run fuzz tests
forge test --fuzz-runs 1000          # Custom fuzz iterations
```
