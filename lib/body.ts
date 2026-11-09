// Joins entries into one markdown body: each entry becomes a "- " bullet, its extra lines indented under it.
export function toBody(entries: string[]) {
  return entries
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const [first, ...rest] = t.split("\n");
      return [`- ${first}`, ...rest.map((l) => `  ${l}`)].join("\n");
    })
    .join("\n");
}
