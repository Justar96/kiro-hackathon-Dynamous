import { sql } from 'drizzle-orm';
import { db } from './index';

/**
 * Setup test database - runs migrations and cleans tables
 */
export async function setupTestDb() {
  // Clean all tables before tests
  await cleanTestDb();
}

/**
 * Clean all tables in the test database
 */
export async function cleanTestDb() {
  // Delete in order respecting foreign key constraints
  const tables = [
    'notifications',
    'comment_reactions',
    'comments',
    'steelmans',
    'stance_spikes',
    'market_data_points',
    'reactions',
    'stances',
    'arguments',
    'rounds',
    'debates',
    'users',
  ];

  for (const table of tables) {
    try {
      await db.execute(sql.raw(`DELETE FROM ${table}`));
    } catch (e: any) {
      // Only warn on non-existence errors, ignore them
      if (e?.code !== '42P01') {
        console.warn(`Could not clean table ${table}:`, e?.message || e);
      }
    }
  }
}

/**
 * Teardown test database connection
 */
export async function teardownTestDb() {
  // Connection is handled by db instance
}
