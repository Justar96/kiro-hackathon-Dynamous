/**
 * Test-only schema modifications
 * This file contains schema adjustments for the test database (Railway)
 * which doesn't have Neon Auth integration
 */

import { pgTable, text, integer, real, timestamp, boolean, varchar, uuid } from 'drizzle-orm/pg-core';
import * as schema from './schema';

// Re-export all schema elements
export * from './schema';

// Override users table for tests - remove neon_auth dependency
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  authUserId: uuid('auth_user_id'), // No foreign key for tests
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  reputationScore: real('reputation_score').notNull().default(100),
  predictionAccuracy: real('prediction_accuracy').notNull().default(50),
  debatesParticipated: integer('debates_participated').notNull().default(0),
  sandboxCompleted: boolean('sandbox_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
