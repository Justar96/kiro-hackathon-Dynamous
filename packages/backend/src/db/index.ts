import { neon } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import * as testSchema from './schema.test-only';

// Check if we're in test environment
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

// Type for our database - use the schema type for proper inference
type DbSchema = typeof schema;
type DbInstance = NeonHttpDatabase<DbSchema> | PostgresJsDatabase<DbSchema>;

let db: DbInstance;

if (isTest) {
  // Use Railway PostgreSQL for tests with test-only schema
  const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!;
  const client = postgres(connectionString);
  // Cast testSchema as schema type since they have the same structure
  db = drizzlePg(client, { schema: testSchema as unknown as DbSchema }) as PostgresJsDatabase<DbSchema>;
} else {
  // Use Neon for production
  const sql = neon(process.env.DATABASE_URL!);
  db = drizzle({ client: sql, schema }) as NeonHttpDatabase<DbSchema>;
}

export { db };

// Always export from schema (it contains all tables)
// Tests will use the test-only schema via the db instance
export * from './schema';
