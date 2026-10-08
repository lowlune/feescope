// Static id-consistency check: every element id referenced by app.js must exist
// in index.html. Run: node check-ids.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const refs = new Set();

for (const m of app.matchAll(/\$\('([^']+)'\)/g)) refs.add(m[1]);
for (const m of app.matchAll(/getElementById\('([^']+)'\)/g)) refs.add(m[1]);
const fields = app.match(/const FIELDS\s*=\s*\[([\s\S]*?)\]/);
if (fields) for (const m of fields[1].matchAll(/'([^']+)'/g)) refs.add(m[1]);

const missing = [...refs].filter((id) => !htmlIds.has(id)).sort();
if (missing.length) {
  console.error('id-consistency FAILED. Missing in index.html:', missing.join(', '));
  process.exit(1);
}
console.log(`id-consistency OK: ${refs.size} ids referenced by app.js, all present in index.html.`);
