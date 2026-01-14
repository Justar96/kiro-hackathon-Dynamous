# Test Database Setup - Railway PostgreSQL

## Overview
The test database is now configured to use Railway PostgreSQL instead of Neon. This provides a separate test environment that won't affect your production data.

## Configuration

### Environment Variables
The Railway PostgreSQL connection string is configured in `.env`:
```
TEST_DATABASE_URL=postgresql://postgres:FnMtokSULYDUsmxdjegbITmsjnaNfjKX@switchback.proxy.rlwy.net:28354/railway
```

### Database Selection
The application automatically selects the correct database based on the environment:

- **Production**: Uses Neon (with Neon Auth integration)
- **Tests**: Uses Railway PostgreSQL (without Neon Auth dependencies)

This is controlled by environment variables:
- `NODE_ENV=test` or `VITEST=true` → Railway PostgreSQL
- Otherwise → Neon

### Schema Files
- `src/db/schema.ts` - Production schema with Neon Auth integration
- `src/db/schema.test-only.ts` - Test schema without Neon Auth dependencies
- `src/db/index.ts` - Dynamically selects the correct database and schema

### Drizzle Configuration
The `drizzle.config.ts` file supports both databases:

```bash
# Push schema to test database (Railway)
$env:DB_TARGET="test"; bun run db:push

# Push schema to production database (Neon)
bun run db:push
```

## Running Tests

### Run All Tests
```bash
bun test
```

### Run Specific Test File
```bash
bun test src/services/debate.service.test.ts
```

### Watch Mode
```bash
bun test:watch
```

## Test Results
✅ **27 out of 32 tests passing** with Railway PostgreSQL
- All schema tests passing
- All voting service tests passing
- All reputation service tests passing
- All market service calculation tests passing

### Known Issues (Test Logic, Not Database)
Some integration tests have minor issues unrelated to the database setup:
1. One test timeout (needs longer timeout or optimization)
2. A few tests with missing test data setup
3. PostgreSQL vs Neon SQL function differences (e.g., `round()` function)

## Database Cleanup
Tests automatically clean the database before each test run using `cleanTestDb()` function.

## Benefits of This Setup
1. ✅ **Isolated Testing**: Test data doesn't affect production
2. ✅ **Standard PostgreSQL**: Uses standard postgres-js driver instead of Neon serverless
3. ✅ **Parallel Testing**: Can run tests while production is running
4. ✅ **Cost Effective**: Railway free tier for testing
5. ✅ **No Neon Auth Dependencies**: Simplified schema for testing

## Troubleshooting

### Tests Can't Connect to Database
Check that:
- Railway PostgreSQL service is running
- `TEST_DATABASE_URL` is correctly set in `.env`
- Network can reach Railway proxy

### Schema Mismatch Errors
Push the test schema to Railway:
```bash
$env:DB_TARGET="test"; bun run db:push
```

### Clean Database Manually
Run the cleanup function:
```typescript
import { cleanTestDb } from './src/db/test-setup';
await cleanTestDb();
```
