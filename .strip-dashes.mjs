// One-off migration: replace em/en dashes with human punctuation.
// Rules, in order:
//   1. '—' / "—" / >—< placeholders become 'Not set'.
//   2. Page-title lines use ' | ' between the page name and the site name.
//   3. En dashes in ranges become ' to ' (months, numbers, template spans).
//   4. A clause before an em dash of four words or fewer takes a colon;
//      anything longer takes a comma.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'E:/blackpearlbd';
const EM = '\u2014';
const EN = '\u2013';

const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.css', '.html', '.md', '.yaml', '.yml', '.json', '.toml']);
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.wrangler', 'coverage', 'build', 'playwright-report', 'test-results']);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, acc);
    } else if (EXT.has(path.extname(entry.name))) {
      acc.push(full);
    }
  }
  return acc;
}

// Everything the site ships plus the repo docs. Excludes vendored UI kits the
// project does not own the wording of.
const OWNED = [
  path.join(ROOT, 'web'),
  path.join(ROOT, 'worker'),
  path.join(ROOT, 'scripts'),
  path.join(ROOT, 'supabase'),
  path.join(ROOT, '.github'),
].filter((dir) => fs.existsSync(dir));

const files = [...OWNED.flatMap((dir) => walk(dir))];
for (const extra of ['agent-instructions.md', 'CLOUDFLARE_SETUP.md', 'DEPLOYMENT_CHECKLIST.md', 'README.md', 'mempalace.yaml', 'entities.json', 'web/index.html', 'web/public/_headers', 'web/public/_redirects', 'web/public/assets/404.html', 'web/public/robots.txt', 'web/public/sitemap.xml']) {
  const full = path.join(ROOT, extra);
  if (fs.existsSync(full)) files.push(full);
}

const TITLE_LINE = /^\s*(\/\/\s*)?(<title>|title:)/;

function stripPlaceholders(line) {
  return line
    .replace(/'—'/g, "'Not set'")
    .replace(/"—"/g, '"Not set"')
    .replace(/—'/g, "Not set'")
    .replace(/>—</g, '>Not set<');
}

function replaceRanges(line) {
  return line
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+–\s+/g, '$1 to ')
    .replace(/(?<=[\d৳])\s+–\s+(?=[\d৳])/g, ' to ')
    .replace(/\}\s+–\s+\$\{/g, '} to ${')
    .replace(/(?<=[\d৳])–(?=[\d৳])/g, ' to ');
}

// Where does the clause containing the dash begin? After the last comment
// marker, sentence end or clause break, so the word count reflects the fragment
// the dash actually joins.
function clauseStart(before) {
  const markers = ['//', '{/*', '/*', '. ', '; ', '— ', ') '];
  let best = -1;
  for (const marker of markers) {
    const at = before.lastIndexOf(marker);
    if (at > best) best = at;
  }
  return best + 1;
}

function replaceEmDashes(line) {
  let out = '';
  let rest = line;
  for (;;) {
    const at = rest.indexOf(` ${EM} `);
    if (at === -1) break;
    const before = out + rest.slice(0, at);
    const after = rest.slice(at + 3);
    const clause = before.slice(clauseStart(before)).trim();
    const words = clause.split(/\s+/).filter(Boolean).length;
    out = before + (words <= 4 ? ': ' : ', ');
    rest = after;
  }
  out += rest;

  // Anything left (a dash against a quote or bracket) joins with a comma.
  return out.split(`${EM}`).join(', ').split(` ${EN} `).join(', ');
}

let changed = 0;
let touchedFiles = 0;

for (const file of files) {
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes(EM) && !original.includes(EN)) continue;

  const lines = original.split('\n');
  const out = lines.map((line) => {
    if (!line.includes(EM) && !line.includes(EN)) return line;
    let next = stripPlaceholders(line);
    if (TITLE_LINE.test(next)) {
      return next.split(` ${EM} `).join(' | ');
    }
    next = replaceRanges(next);
    return replaceEmDashes(next);
  });

  const joined = out.join('\n');
  if (joined !== original) {
    fs.writeFileSync(file, joined, 'utf8');
    changed += joined.split('\n').filter((l, i) => l !== lines[i]).length;
    touchedFiles += 1;
  }
}

console.log(`files scanned: ${files.length}`);
console.log(`files rewritten: ${touchedFiles}`);
console.log(`lines changed: ${changed}`);