/**
 * Script de remplacement : r.get('xxx') → r.xxx
 * Exécuter : node src/scripts/fix-r-get.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const srcDir = new URL('..', import.meta.url).pathname;
const files = [];

function walk(dir) {
  const entries = readdirSync(dir);
  for (const e of entries) {
    const p = join(dir, e);
    if (e === 'node_modules' || e === 'dist' || e === '.git') continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.ts' || extname(p) === '.tsx') files.push(p);
  }
}
walk(srcDir);

let count = 0;
for (const f of files) {
  let content = readFileSync(f, 'utf-8');
  // Replace r.get('xxx') with r.xxx
  const regex = /(\w+)\.get\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const before = content;
  content = content.replace(regex, (match, obj, key) => {
    // Handle special cases where key might be a reserved word or contain special chars
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
      return `${obj}.${key}`;
    }
    return match; // keep as-is if key isn't a valid identifier
  });
  if (content !== before) {
    writeFileSync(f, content, 'utf-8');
    count++;
    console.log(`✓ Fixed: ${f.replace(srcDir, '')}`);
  }
}
console.log(`\n✅ Fixed ${count} files`);