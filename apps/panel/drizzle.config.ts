import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Vite, so it reads the URL from the shell (see the db:* scripts).
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'mysql',
	dbCredentials: { url: process.env.DATABASE_URL },
	strict: true
});
