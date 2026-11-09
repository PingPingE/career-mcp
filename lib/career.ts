import { sql } from "kysely";
import { db } from "./db";

export async function listExperiences() {
  return db
    .selectFrom("experience")
    .select(["display_id", "parent_display_id", "title"])
    .orderBy("sort")
    .execute();
}

export async function getExperience(displayId: string) {
  const exp = await db.selectFrom("experience").selectAll().where("display_id", "=", displayId).executeTakeFirst();
  if (!exp) return null;
  const children = await db
    .selectFrom("experience")
    .select(["display_id", "title"])
    .where("parent_display_id", "=", displayId)
    .orderBy("sort")
    .execute();
  return { display_id: exp.display_id, parent: exp.parent_display_id, title: exp.title, children, body: exp.body };
}

// Returns each matching line (or the title) with its experience, so a hit can be cited without reading the whole body.
export async function searchCareer(query: string) {
  const like = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const q = query.toLowerCase();
  const rows = await db
    .selectFrom("experience")
    .select(["display_id", "title", "body"])
    .where((eb) => eb.or([eb("body", "ilike", like), eb("title", "ilike", like)]))
    .orderBy("sort")
    .execute();
  const hits: { display_id: string; title: string; line: string }[] = [];
  for (const r of rows) {
    const lines = r.body.split("\n").filter((l) => l.toLowerCase().includes(q));
    if (!lines.length) hits.push({ display_id: r.display_id, title: r.title, line: "(matched the title)" });
    for (const l of lines) hits.push({ display_id: r.display_id, title: r.title, line: snippet(l.trim(), q) });
  }
  return hits.slice(0, 30);
}

function snippet(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0 || text.length <= 200) return text.slice(0, 200);
  const start = Math.max(0, i - 80);
  return (start > 0 ? "…" : "") + text.slice(start, start + 200) + "…";
}

export type NewExperience = { title: string; parent?: string; display_id?: string; body: string };

// Adds one or more experiences in one transaction (one approval in the client).
// A parent may be an existing experience or one created earlier in the same list.
export async function addExperiences(items: NewExperience[]) {
  return db.transaction().execute(async (tx) => {
    const existing = await tx.selectFrom("experience").select("display_id").execute();
    const ids = new Set(existing.map((e) => e.display_id));
    let n = Math.max(0, ...existing.filter((e) => /^N\d+$/.test(e.display_id)).map((e) => Number(e.display_id.slice(1))));
    const max = await tx.selectFrom("experience").select(sql<number>`coalesce(max(sort), 0)::int`.as("m")).executeTakeFirst();
    let sort = max?.m ?? 0;
    const created: { display_id: string; title: string }[] = [];
    for (const item of items) {
      const displayId = item.display_id?.trim() || `N${++n}`;
      if (ids.has(displayId)) throw new Error(`ID "${displayId}" already exists. Nothing was saved`);
      if (item.parent && !ids.has(item.parent))
        throw new Error(`Parent experience "${item.parent}" not found. Nothing was saved`);
      await tx
        .insertInto("experience")
        .values({
          display_id: displayId,
          parent_display_id: item.parent ?? null,
          title: item.title.trim(),
          body: item.body.trim(),
          sort: ++sort,
        })
        .execute();
      ids.add(displayId);
      created.push({ display_id: displayId, title: item.title.trim() });
    }
    return created;
  });
}

export type ExperiencePatch = { title?: string; parent?: string | null; append?: string; body?: string };

export async function updateExperience(displayId: string, patch: ExperiencePatch) {
  if (patch.append !== undefined && patch.body !== undefined) throw new Error("Send either append or body, not both");
  return db.transaction().execute(async (tx) => {
    const exp = await tx.selectFrom("experience").select(["id", "body"]).where("display_id", "=", displayId).executeTakeFirst();
    if (!exp) throw new Error(`No experience ${displayId}. Check the ID with list_experiences.`);
    if (patch.parent) {
      if (patch.parent === displayId) throw new Error("An experience cannot be its own parent");
      const all = await tx.selectFrom("experience").select(["display_id", "parent_display_id"]).execute();
      const parentOf = new Map(all.map((e) => [e.display_id, e.parent_display_id]));
      if (!parentOf.has(patch.parent)) throw new Error(`Parent experience ${patch.parent} not found`);
      // walk up from the new parent; reaching this experience means the move would create a loop
      for (let cur: string | null | undefined = patch.parent; cur; cur = parentOf.get(cur))
        if (cur === displayId) throw new Error(`${patch.parent} is under ${displayId}, so it cannot be its parent`);
    }
    const body =
      patch.body !== undefined
        ? patch.body.trim()
        : patch.append?.trim()
          ? [exp.body, patch.append.trim()].filter(Boolean).join("\n")
          : undefined;
    const res = await tx
      .updateTable("experience")
      .set({
        ...(patch.title?.trim() ? { title: patch.title.trim() } : {}),
        ...(patch.parent !== undefined ? { parent_display_id: patch.parent || null } : {}),
        ...(body !== undefined ? { body } : {}),
        updated_at: new Date(),
      })
      .where("id", "=", exp.id)
      .returning(["display_id", "parent_display_id", "title", "body"])
      .executeTakeFirstOrThrow();
    return res;
  });
}
