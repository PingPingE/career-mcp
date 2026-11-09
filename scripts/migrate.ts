// Creates Better Auth tables and the app tables (request log, experience). Safe to run repeatedly.
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../lib/auth";
import { ensureAppTables } from "../lib/db";

const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
console.log(
  "better-auth:",
  toBeCreated.map((t) => t.table),
  toBeAdded.map((t) => t.table),
);
await runMigrations();
await ensureAppTables();
console.log("migrations done");
process.exit(0);
