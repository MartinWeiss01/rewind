// Keeps only Rewind's tables and functions in `supabase gen types` output, so types
// for other apps sharing the same database never end up in this repository.
// Usage: supabase gen types typescript --db-url "$DATABASE_URL" --schema public | node scripts/filter-db-types.mjs
import { readFileSync } from "node:fs";

const lines = readFileSync(0, "utf8").split("\n");
const out = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Table, view and function entries sit at six spaces: `      name: {`.
  const entry = line.match(/^ {6}([a-z0-9_]+): \{$/);
  if (entry && !entry[1].startsWith("rewind_")) {
    while (i < lines.length && lines[i] !== "      }") i++;
    continue;
  }
  out.push(line);
}
process.stdout.write(out.join("\n"));
