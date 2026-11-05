import fs from "node:fs/promises";
import { loadContent, archiveText } from "./archive-content.mjs";

// Validate the entire input before writing any downloads.
const { records } = await loadContent();
const output = new URL("../public/archives/", import.meta.url);
await fs.mkdir(output, { recursive: true });
for (const record of records) {
  await fs.writeFile(
    new URL(`LAPPAS-${record.id}.txt`, output),
    archiveText(record),
    "utf8",
  );
}
// Drop downloads of works that are no longer in the archive.
const keep = new Set(records.map((record) => `LAPPAS-${record.id}.txt`));
for (const name of await fs.readdir(output)) {
  if (/^LAPPAS-X-\d{3}\.txt$/.test(name) && !keep.has(name)) await fs.rm(new URL(name, output));
}
console.log(`Prepared ${records.length} downloadable archive records.`);
