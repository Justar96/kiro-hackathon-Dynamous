# Thesis - Project Structure

```
thesis/
├── packages/
│   ├── frontend/          # React SPA
│   │   ├── src/
│   │   │   ├── components/    # UI components by domain
│   │   │   │   ├── auth/      # Authentication (AuthModal, ProfileDropdown)
│   │   │   │   ├── common/    # Shared (Modal, Toast, ErrorBoundary)
│   │   │   │   ├── market/    # Trading UI
│   │   │   │   ├── layout/    # App shell, navigation
│   │   │   │   ├── icons/     # SVG icon components
│   │   │   │   └── ui/        # Base UI primitives
│   │   │   ├── lib/           # Utilities and hooks
│   │   │   │   ├── api/       # API client functions
│   │   │   │   ├── auth/      # Auth utilities
│   │   │   │   ├── hooks/     # Custom React hooks
│   │   │   │   ├── utils/     # Helper functions
│   │   │   │   └── wagmi/     # Web3 configuration
│   │   │   ├── routes/        # TanStack Router file-based routes
│   │   │   └── main.tsx       # App entry point
│   │   └── vite.config.ts
│   │
│   ├── backend/           # Hono API server
│   │   ├── src/
│   │   │   ├── services/      # Business logic
│   │   │   │   ├── matchingEngine.ts   # Order matching (CLOB)
│   │   │   │   ├── merkleTree.ts       # Settlement proofs
│   │   │   │   ├── orderSigner.ts      # EIP-712 signing
│   │   │   │   ├── riskEngine.ts       # Position limits
│   │   │   │   ├── settlement.ts       # Batch settlement
│   │   │   │   └── monitor.ts          # Metrics/alerts
│   │   │   ├── types.ts       # Backend-specific types
│   │   │   └── index.ts       # Hono app + routes
│   │   └── test/              # Bun tests
│   │
│   └── shared/            # Shared code
│       └── src/
│           ├── types.ts       # Domain models (Debate, User, Stance, etc.)
│           ├── sse-events.ts  # Server-sent event types
│           └── contracts/     # ABIs and addresses
│
├── contracts/             # Solidity smart contracts
│   ├── src/
│   │   ├── Market.sol         # Individual prediction market
│   │   ├── MarketFactory.sol  # Market deployment factory
│   │   ├── OrderBook.sol      # On-chain CLOB
│   │   ├── SettlementVault.sol # Merkle-based withdrawals
│   │   ├── ConditionalTokens.sol
│   │   ├── interfaces/        # Contract interfaces
│   │   └── libraries/         # Shared helpers (CTFHelpers)
│   ├── test/
│   │   ├── *.t.sol            # Unit tests
│   │   ├── *.fuzz.sol         # Fuzz/property tests
│   │   ├── helpers/           # Test utilities
│   │   └── mocks/             # Mock contracts
│   ├── script/                # Deployment scripts
│   └── lib/                   # Git submodules
│       ├── forge-std/
│       ├── openzeppelin-contracts/
│       ├── conditional-tokens-contracts/
│       └── protocol/          # UMA protocol
│
├── docs/                  # Documentation
└── .kiro/
    ├── specs/             # Feature specifications
    └── steering/          # AI assistant guidelines
```

## Key Conventions

### Component Files
- `Component.tsx` - Main component
- `Component.property.tsx` - Property-based tests
- `Component.test.tsx` - Unit tests
- `index.ts` - Barrel exports per folder

### Contract Files
- `Contract.sol` - Implementation
- `IContract.sol` - Interface (in `interfaces/`)
- `Contract.t.sol` - Unit tests
- `Contract.fuzz.sol` - Fuzz tests

### Shared Types
All domain types live in `packages/shared/src/types.ts` - import from `@thesis/shared`.
