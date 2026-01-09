import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { nanoid } from 'nanoid';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql, schema });

async function seed() {
  console.log('🌱 Seeding database...');

  // Create sample users
  const users = [
    {
      id: nanoid(),
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hashed_password_1', // In production, use proper hashing
      reputationScore: 150,
      predictionAccuracy: 65,
      debatesParticipated: 10,
      sandboxCompleted: true,
      createdAt: new Date(),
    },
    {
      id: nanoid(),
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: 'hashed_password_2',
      reputationScore: 120,
      predictionAccuracy: 55,
      debatesParticipated: 7,
      sandboxCompleted: true,
      createdAt: new Date(),
    },
    {
      id: nanoid(),
      username: 'charlie',
      email: 'charlie@example.com',
      passwordHash: 'hashed_password_3',
      reputationScore: 100,
      predictionAccuracy: 50,
      debatesParticipated: 3,
      sandboxCompleted: false,
      createdAt: new Date(),
    },
  ];

  for (const user of users) {
    await db.insert(schema.users).values(user);
  }
  console.log(`✅ Created ${users.length} users`);

  // Create a sample debate
  const debate = {
    id: nanoid(),
    resolution: 'Remote work reduces productivity for most teams',
    status: 'active' as const,
    currentRound: 1,
    currentTurn: 'support' as const,
    supportDebaterId: users[0].id,
    opposeDebaterId: users[1].id,
    createdAt: new Date(),
    concludedAt: null,
  };

  await db.insert(schema.debates).values(debate);
  console.log('✅ Created sample debate');

  // Create rounds for the debate
  const roundTypes = ['opening', 'rebuttal', 'closing'] as const;
  const rounds = roundTypes.map((roundType, index) => ({
    id: nanoid(),
    debateId: debate.id,
    roundNumber: index + 1,
    roundType,
    supportArgumentId: null,
    opposeArgumentId: null,
    completedAt: null,
  }));

  for (const round of rounds) {
    await db.insert(schema.rounds).values(round);
  }
  console.log(`✅ Created ${rounds.length} rounds`);

  // Create initial market data point
  const marketDataPoint = {
    id: nanoid(),
    debateId: debate.id,
    timestamp: new Date(),
    supportPrice: 50,
    voteCount: 0,
  };

  await db.insert(schema.marketDataPoints).values(marketDataPoint);
  console.log('✅ Created initial market data point');

  // Create a pre-stance from charlie (spectator)
  const preStance = {
    id: nanoid(),
    debateId: debate.id,
    voterId: users[2].id,
    type: 'pre' as const,
    supportValue: 60,
    confidence: 3,
    lastArgumentSeen: null,
    createdAt: new Date(),
  };

  await db.insert(schema.stances).values(preStance);
  console.log('✅ Created sample pre-stance');

  console.log('🎉 Seeding complete!');
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});
