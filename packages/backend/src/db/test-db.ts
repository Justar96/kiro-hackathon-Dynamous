import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Test database connection using Railway PostgreSQL.
 * This uses the standard postgres-js driver instead of Neon's serverless driver.
 */
const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!;

const client = postgres(connectionString);
export const testDb = drizzle(client, { schema });

/**
 * Close the database connection (useful for cleanup after tests)
 */
export async function closeTestDb() {
  await client.end();
}

export * from './schema';
