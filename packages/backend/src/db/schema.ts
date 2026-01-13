import { pgTable, text, integer, real, timestamp, boolean, varchar, pgEnum, uuid, pgSchema } from 'drizzle-orm/pg-core';

// Reference to Neon Auth schema
export const neonAuthSchema = pgSchema('neon_auth');

// Neon Auth user table reference (read-only, managed by Neon Auth)
export const neonAuthUsers = neonAuthSchema.table('user', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  emailVerified: boolean('emailVerified'),
  image: text('image'),
  createdAt: timestamp('createdAt'),
  updatedAt: timestamp('updatedAt'),
  role: text('role'),
  banned: boolean('banned'),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
});

// Enums for PostgreSQL
export const debateStatusEnum = pgEnum('debate_status', ['active', 'concluded']);
export const turnEnum = pgEnum('turn', ['support', 'oppose']);
export const roundTypeEnum = pgEnum('round_type', ['opening', 'rebuttal', 'closing']);
export const sideEnum = pgEnum('side', ['support', 'oppose']);
export const stanceTypeEnum = pgEnum('stance_type', ['pre', 'post']);
export const reactionTypeEnum = pgEnum('reaction_type', ['agree', 'strong_reasoning']);
export const directionEnum = pgEnum('direction', ['support', 'oppose']);

// Extended user profile (links to Neon Auth user)
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Can be neon_auth user id or custom id
  authUserId: uuid('auth_user_id').references(() => neonAuthUsers.id), // Link to Neon Auth
  username: varchar('username', { length: 255 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'), // Optional if using Neon Auth
  reputationScore: real('reputation_score').notNull().default(100),
  predictionAccuracy: real('prediction_accuracy').notNull().default(50),
  debatesParticipated: integer('debates_participated').notNull().default(0),
  sandboxCompleted: boolean('sandbox_completed').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const debates = pgTable('debates', {
  id: text('id').primaryKey(),
  resolution: text('resolution').notNull(),
  status: debateStatusEnum('status').notNull().default('active'),
  currentRound: integer('current_round').notNull().default(1),
  currentTurn: turnEnum('current_turn').notNull().default('support'),
  supportDebaterId: text('support_debater_id').notNull().references(() => users.id),
  opposeDebaterId: text('oppose_debater_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  concludedAt: timestamp('concluded_at'),
});

export const rounds = pgTable('rounds', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  roundNumber: integer('round_number').notNull(),
  roundType: roundTypeEnum('round_type').notNull(),
  supportArgumentId: text('support_argument_id'),
  opposeArgumentId: text('oppose_argument_id'),
  completedAt: timestamp('completed_at'),
});

export const arguments_ = pgTable('arguments', {
  id: text('id').primaryKey(),
  roundId: text('round_id').notNull().references(() => rounds.id),
  debaterId: text('debater_id').notNull().references(() => users.id),
  side: sideEnum('side').notNull(),
  content: text('content').notNull(),
  impactScore: real('impact_score').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const stances = pgTable('stances', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  voterId: text('voter_id').notNull().references(() => users.id),
  type: stanceTypeEnum('type').notNull(),
  supportValue: integer('support_value').notNull(),
  confidence: integer('confidence').notNull(),
  lastArgumentSeen: text('last_argument_seen'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const reactions = pgTable('reactions', {
  id: text('id').primaryKey(),
  argumentId: text('argument_id').notNull().references(() => arguments_.id),
  voterId: text('voter_id').notNull().references(() => users.id),
  type: reactionTypeEnum('type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const comments = pgTable('comments', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  userId: text('user_id').notNull().references(() => users.id),
  parentId: text('parent_id'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const marketDataPoints = pgTable('market_data_points', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  supportPrice: real('support_price').notNull(),
  voteCount: integer('vote_count').notNull(),
});

export const stanceSpikes = pgTable('stance_spikes', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  argumentId: text('argument_id').notNull().references(() => arguments_.id),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  deltaAmount: real('delta_amount').notNull(),
  direction: directionEnum('direction').notNull(),
  label: text('label').notNull(),
});

// Steelman Gate: Anti-strawman forcefield
// Before rebuttal, debater must write a steelman of opponent's argument
export const steelmanStatusEnum = pgEnum('steelman_status', ['pending', 'approved', 'rejected']);

export const steelmans = pgTable('steelmans', {
  id: text('id').primaryKey(),
  debateId: text('debate_id').notNull().references(() => debates.id),
  roundNumber: integer('round_number').notNull(), // Which round this steelman is for (2 or 3)
  authorId: text('author_id').notNull().references(() => users.id), // Who wrote the steelman
  targetArgumentId: text('target_argument_id').notNull().references(() => arguments_.id), // The argument being steelmanned
  content: text('content').notNull(), // The steelman text
  status: steelmanStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'), // Why opponent rejected (if rejected)
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
});
