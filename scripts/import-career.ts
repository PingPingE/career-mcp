// Loads a markdown career file into the database, keeping every line as written.
// Usage: npm run import -- <path/to/career.md> [--replace]
//   Without --replace it refuses when data already exists (so additions made through Claude are never wiped by accident).
import { readFileSync } from "node:fs";
import { db, ensureAppTables } from "../lib/db";
import { parseCareer } from "../lib/parse-career";

const file = process.argv[2];
const replace = process.argv.includes("--replace");
if (!file) {
  console.error("usage: npm run import -- <career.md> [--replace]");
  process.exit(1);
}
await ensureAppTables();
const existing = await db.selectFrom("experience").select("id").limit(1).execute();
if (existing.length && !replace) {
  console.error("Career data already exists. Use --replace to overwrite it (this also deletes anything added through an AI app)");
  process.exit(1);
}
const parsed = parseCareer(readFileSync(file, "utf8"));
await db.transaction().execute(async (tx) => {
  await tx.deleteFrom("experience").execute();
  let sort = 0;
  for (const e of parsed) {
    await tx
      .insertInto("experience")
      .values({ display_id: e.display_id, parent_display_id: e.parent, title: e.title, body: e.body, sort: ++sort })
      .execute();
  }
});
console.log(`Imported ${parsed.length} experiences`);
process.exit(0);
