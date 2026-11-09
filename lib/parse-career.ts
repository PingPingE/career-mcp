// Turns a markdown career file into experiences, keeping every line's text as written.
//   "### A1. Title"     -> experience A1
//   "#### A1-2. Title"  -> experience A1-2 (child of A1)
//   "## Section"        -> experience for bullets written directly under a section
//   "- bullet"          -> one bullet in that experience's body; indented lines below it stay with it
// Lines marked "[unconfirmed]" or "확인 필요" keep that text; readers are told not to rely on them.

export type ParsedExperience = {
  display_id: string;
  parent: string | null;
  title: string;
  body: string;
};
type Draft = Omit<ParsedExperience, "body"> & { entries: string[] };

import { toBody } from "./body";

const ID_RE = /^([A-Z]\d+(?:-\d+)?)\.\s+(.*)$/;

export function parseCareer(md: string): ParsedExperience[] {
  const out: Draft[] = [];
  let section: string | null = null; // current "## " heading text
  let sectionExp: Draft | null = null; // lazily created for bullets directly under "## "
  let h3: Draft | null = null;
  let current: Draft | null = null;
  let entry: string[] | null = null;
  let autoN = 0;

  const flush = () => {
    if (entry && current) {
      const text = entry.join("\n").trim();
      if (text) current.entries.push(text);
    }
    entry = null;
  };
  const newExp = (heading: string, parent: string | null) => {
    const m = ID_RE.exec(heading);
    const title = (m ? m[2] : heading).trim();
    const exp: Draft = {
      display_id: m ? m[1] : `X${++autoN}`,
      parent,
      title,
      entries: [],
    };
    out.push(exp);
    return exp;
  };

  for (const raw of md.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (/^# /.test(line)) continue;
    if (/^## /.test(line)) {
      flush();
      section = line.slice(3).trim();
      sectionExp = null;
      h3 = null;
      current = null;
      continue;
    }
    if (/^### /.test(line)) {
      flush();
      // headings without an id inside a section become children of that section
      const heading = line.slice(4).trim();
      const parent = ID_RE.test(heading) ? null : ensureSection()?.display_id ?? null;
      h3 = newExp(heading, parent);
      current = h3;
      continue;
    }
    if (/^#### /.test(line)) {
      flush();
      current = newExp(line.slice(5).trim(), h3?.display_id ?? null);
      continue;
    }
    const top = /^(- |\d+\. )/.test(line);
    if (top) {
      flush();
      if (!current) current = ensureSection();
      entry = [line.replace(/^- /, "")];
      continue;
    }
    if (entry && (/^\s+\S/.test(line) || line === "")) {
      if (line !== "") entry.push(line.trim());
      continue;
    }
    if (line.trim() === "" || line.startsWith(">") || line.startsWith("---")) {
      flush();
      continue;
    }
    // a plain paragraph line: keep it as its own entry so nothing written is lost
    flush();
    if (!current) current = ensureSection();
    entry = [line.trim()];
  }
  flush();
  return out
    .filter((e) => e.entries.length > 0 || out.some((c) => c.parent === e.display_id))
    .map(({ entries, ...e }) => ({ ...e, body: toBody(entries) }));

  function ensureSection() {
    if (!section) return null;
    if (!sectionExp) {
      sectionExp = newExp(section, null);
    }
    return sectionExp;
  }
}
