import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load environment variables
config();

// Use TEST_DATABASE_URL if DB_TARGET=test, otherwise use DATABASE_URL
const isTestDb = process.env.DB_TARGET === 'test';
const databaseUrl = isTestDb 
  ? process.env.TEST_DATABASE_URL! 
  : process.env.DATABASE_URL!;

// Use test-only schema for Railway PostgreSQL (no Neon Auth)
const schemaPath = isTestDb 
  ? './src/db/schema.test-only.ts'
  : './src/db/schema.ts';

export default defineConfig({
  schema: schemaPath,
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
