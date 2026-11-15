// Downloads Spotify's official Web API OpenAPI document, strips the
// `x-spotify-policy` annotations (they point at a file outside the document)
// and fixes one invalid schema line, so Orval can validate it.
// Output: node_modules/.cache/spotify-openapi.yaml (input for orval.config.ts).
import { mkdir, writeFile } from "node:fs/promises";

const source = "https://developer.spotify.com/reference/web-api/open-api-schema.yaml";
const target = new URL("../node_modules/.cache/spotify-openapi.yaml", import.meta.url);

const response = await fetch(source);
if (!response.ok) throw new Error(`Download failed: ${response.status} ${response.statusText}`);
const lines = (await response.text()).split("\n");

const kept = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const indent = line.length - line.trimStart().length;
  if (line.trimStart().startsWith("x-spotify-policy")) {
    // Skip the key and every more-indented line that belongs to it.
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      const nextIndent = next.length - next.trimStart().length;
      if (next.trim() !== "" && nextIndent <= indent) break;
      i++;
    }
    continue;
  }
  // The published document puts `required: true` inside one schema object, which is
  // invalid OpenAPI (schema `required` must be a list). Drop that line only.
  const previous = kept.at(-1) ?? "";
  const previousIndent = previous.length - previous.trimStart().length;
  if (
    line.trim() === "required: true" &&
    previous.trimStart().startsWith("type:") &&
    previousIndent === indent
  ) {
    continue;
  }
  kept.push(line);
}

await mkdir(new URL(".", target), { recursive: true });
await writeFile(target, kept.join("\n"));
console.log(`Wrote ${target.pathname} (${kept.length} lines)`);
