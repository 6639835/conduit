import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Create Neon HTTP client (edge-compatible)
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle ORM instance
export const db = drizzle(sql, { schema });

// Export schema for convenience
export { schema };
export * from './schema';
