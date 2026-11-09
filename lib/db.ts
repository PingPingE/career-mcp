import { Kysely, PostgresDialect, sql, type Dialect, type Generated } from "kysely";
import { Pool } from "pg";
import { toBody } from "./body";

// One dialect shared by Better Auth and our own tables.
// DATABASE_URL set -> Postgres (Neon on Vercel). Unset -> embedded PGlite for local dev.
async function createDialect(): Promise<Dialect> {
  if (process.env.DATABASE_URL) {
    return new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
    });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGliteDialect } = await import("kysely-pglite-dialect");
  return new PGliteDialect(new PGlite("./.pglite"));
}

// Next.js bundles each route separately; keep one connection per process.
const g = globalThis as unknown as { __careerDialect?: Promise<Dialect> };
export const dialect = await (g.__careerDialect ??= createDialect());

export interface LogTable {
  id: number | undefined;
  at: Date | undefined;
  rpc_method: string | null;
  protocol_version: string | null;
  client_name: string | null;
  client_version: string | null;
  user_agent: string | null;
  azp: string | null;
  capabilities: string | null;
}

export interface ExperienceTable {
  id: Generated<number>;
  display_id: string;
  parent_display_id: string | null;
  title: string;
  body: Generated<string>;
  sort: number;
  updated_at: Generated<Date>;
}

export const db = new Kysely<{
  mcp_request_log: LogTable;
  experience: ExperienceTable;
}>({ dialect });

export async function ensureAppTables() {
  await db.schema
    .createTable("mcp_request_log")
    .ifNotExists()
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("at", "timestamptz", (c) => c.notNull().defaultTo(new Date(0)))
    .addColumn("rpc_method", "text")
    .addColumn("protocol_version", "text")
    .addColumn("client_name", "text")
    .addColumn("client_version", "text")
    .addColumn("user_agent", "text")
    .addColumn("azp", "text")
    .addColumn("capabilities", "text")
    .execute();
  await db.schema
    .createTable("experience")
    .ifNotExists()
    .addColumn("id", "serial", (c) => c.primaryKey())
    .addColumn("display_id", "text", (c) => c.notNull().unique())
    .addColumn("parent_display_id", "text")
    .addColumn("title", "text", (c) => c.notNull())
    .addColumn("body", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("sort", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("updated_at", "timestamptz", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await foldFactsIntoBody();
}

// One-time move from the old two-level shape (experience + one row per fact) to one body per experience.
// Facts are joined in their original order; the old table is dropped in the same transaction. Safe to re-run.
async function foldFactsIntoBody() {
  await sql`alter table experience add column if not exists body text not null default ''`.execute(db);
  const old = await sql<{ n: number }>`select count(*)::int as n from information_schema.tables where table_name = 'fact'`.execute(db);
  if (!old.rows[0]?.n) return;
  await db.transaction().execute(async (tx) => {
    const facts = await sql<{ experience_id: number; text: string }>`select experience_id, text from fact order by experience_id, position, id`.execute(tx);
    const byExp = new Map<number, string[]>();
    for (const f of facts.rows) byExp.set(f.experience_id, [...(byExp.get(f.experience_id) ?? []), f.text]);
    for (const [id, texts] of byExp) {
      await tx.updateTable("experience").set({ body: toBody(texts) }).where("id", "=", id).where("body", "=", "").execute();
    }
    await sql`drop table fact`.execute(tx);
  });
}
