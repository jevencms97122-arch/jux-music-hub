import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const srcDir = new URL('src', import.meta.url).pathname;
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
  const regex = /(\w+)\.get\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const before = content;
  content = content.replace(regex, (match, obj, key) => {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) return `${obj}.${key}`;
    return match;
  });
  if (content !== before) {
    writeFileSync(f, content, 'utf-8');
    count++;
    console.log(`Fixed: ${f.replace(srcDir, '')}`);
  }
}
console.log(`\nFixed ${count} files`);