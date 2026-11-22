import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/shared/database/seed.js' },
  datasource: { url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL },
});
