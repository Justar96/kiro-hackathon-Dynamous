import { sql } from 'drizzle-orm';
import { testDb, closeTestDb } from './test-db';
import * as schema from './schema';

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
    'comment_reactions',
    'comment_matches', 
    'comments',
    'votes',
    'debate_participants',
    'debates',
    'users',
  ];

  for (const table of tables) {
    try {
      await testDb.execute(sql.raw(`DELETE FROM ${table}`));
    } catch (e) {
      // Table might not exist yet, ignore
    }
  }
}

/**
 * Teardown test database connection
 */
export async function teardownTestDb() {
  await closeTestDb();
}

export { testDb };
