// `npm run db:setup`: creates the tables from supabase/schema.sql. Safe to run again (it only adds what is missing).
import { readFileSync } from "node:fs";

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Put it in .env.local first.");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });
try {
  await sql.unsafe(readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
  const [{ n: leads }] = await sql`select count(*)::int n from leads`;
  const [{ n: events }] = await sql`select count(*)::int n from events`;
  console.log(`Done. Tables ready (leads: ${leads}, events: ${events}).`);
} catch (err) {
  console.error("Setup failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
