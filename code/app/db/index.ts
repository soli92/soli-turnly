/**
 * TSK-002 — Database connection
 * Driver: postgres (node-postgres compatible, Drizzle recommended for Next.js)
 *
 * Usage:
 *   import { db } from '@/db';
 *   const result = await db.select().from(users).where(eq(users.id, id));
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Disable prefetch for serverless/edge environments (Next.js App Router)
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

export const db = drizzle(client, { schema });

export type Database = typeof db;
