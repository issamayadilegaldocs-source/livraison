/**
 * Validates every gql`...` document found in all frontends against the API
 * schema (src/schema.gql).
 *
 * Usage: node tools/validate-frontend-ops.js
 */
const fs = require("fs");
const path = require("path");
const {
  buildSchema,
  parse,
  validate,
  Kind,
} = require("graphql");

const ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_PATH = path.join(ROOT, "enatega-multivendor-api", "src", "schema.gql");
const TARGETS = [
  { app: "admin",  dir: path.join(ROOT, "enatega-multivendor-admin", "lib", "api", "graphql") },
  { app: "web",    dir: path.join(ROOT, "enatega-multivendor-web", "lib", "api", "graphql") },
  { app: "mobile", dir: path.join(ROOT, "enatega-multivendor-app", "src", "apollo") },
  { app: "rider",  dir: path.join(ROOT, "enatega-multivendor-rider", "lib", "apollo") },
  { app: "store",  dir: path.join(ROOT, "enatega-multivendor-store", "lib", "apollo") },
  { app: "store2", dir: path.join(ROOT, "enatega-multivendor-store", "lib", "api", "graphql") },
];

const schema = buildSchema(fs.readFileSync(SCHEMA_PATH, "utf8"));

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

// Extract gql`...` template literals (both tagged with gql and plain `#graphql` prefix)
function extractDocs(text) {
  const out = [];
  // Tagged: gql`...`  or  gql( `...` )
  const gqlRe = /(?:export\s+)?(?:const\s+(\w+)\s*=\s*)?gql`([\s\S]*?)`/g;
  let m;
  while ((m = gqlRe.exec(text)) !== null) {
    out.push({ constName: m[1] || null, source: m[2] });
  }
  // Plain `#graphql ...` template strings (not already matched as gql``)
  // These are raw strings that start with #graphql comment
  const rawRe = /(?:export\s+)?const\s+(\w+)\s*=\s*`#graphql([\s\S]*?)`/g;
  while ((m = rawRe.exec(text)) !== null) {
    out.push({ constName: m[1] || null, source: m[2] });
  }
  // Plain non-tagged template strings used as mutations/queries (heuristic)
  const plainRe = /(?:export\s+)?const\s+(\w+)\s*=\s*`\s*(query|mutation|subscription|fragment)\s[\s\S]*?`/g;
  while ((m = plainRe.exec(text)) !== null) {
    // avoid duplicates already captured above
    const src = m[0].replace(/^[^`]*`/, "").replace(/`$/, "");
    if (!out.some((d) => d.source === src)) {
      out.push({ constName: m[1] || null, source: src });
    }
  }
  return out;
}

// Pass 1: collect all documents
const docs = []; // { app, file, constName, source }
const fragmentsByConstName = new Map();
const fragmentsByFragmentName = new Map();

for (const { app, dir } of TARGETS) {
  if (!fs.existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const text = fs.readFileSync(file, "utf8");
    const found = extractDocs(text);
    for (const d of found) {
      docs.push({ app, file, constName: d.constName, source: d.source });
    }
  }
}

// Pass 2: index fragments
for (const d of docs) {
  const fragMatch = d.source.match(/^\s*fragment\s+(\w+)\s/);
  if (fragMatch) {
    if (d.constName) fragmentsByConstName.set(d.constName, d.source);
    fragmentsByFragmentName.set(fragMatch[1], d.source);
  }
}

let errorCount = 0;
let okCount = 0;
let skipCount = 0;
const failures = [];

for (const d of docs) {
  if (/^\s*fragment\s/.test(d.source)) { skipCount++; continue; }

  // Inline ${FRAGMENT_CONST} interpolations
  let source = d.source.replace(/\$\{(\w+)\}/g, (_, name) =>
    fragmentsByConstName.get(name) || ""
  );

  // Strip @client selections (Apollo client-only fields)
  source = source.replace(/^.*@client.*$/gm, "");

  // Strip @connection directives which don't exist in the schema
  source = source.replace(/@connection\([^)]*\)/g, "");

  // Append missing fragment definitions
  const spreadNames = [...source.matchAll(/\.\.\.\s*(\w+)/g)].map((x) => x[1]);
  for (const s of new Set(spreadNames)) {
    if (!new RegExp(`fragment\\s+${s}\\b`).test(source) && fragmentsByFragmentName.has(s)) {
      source += "\n" + fragmentsByFragmentName.get(s);
    }
  }

  // Skip if source is essentially empty after stripping
  if (/^\s*$/.test(source)) { skipCount++; continue; }

  let ast;
  try {
    ast = parse(source);
  } catch (e) {
    errorCount++;
    failures.push({ app: d.app, file: d.file, name: d.constName, errors: ["PARSE: " + e.message] });
    continue;
  }

  const errs = validate(schema, ast);
  if (errs.length) {
    errorCount++;
    failures.push({
      app: d.app,
      file: d.file,
      name: d.constName,
      errors: errs.map((e) => e.message),
    });
  } else {
    okCount++;
  }
}

// Group failures by app
const byApp = {};
for (const f of failures) {
  (byApp[f.app] = byApp[f.app] || []).push(f);
}

for (const [app, list] of Object.entries(byApp)) {
  console.log(`\n========== [${app.toUpperCase()}] ==========`);
  for (const f of list) {
    console.log(`\n  ${f.name || "(anonymous)"}  (${path.relative(ROOT, f.file)})`);
    for (const e of f.errors) console.log(`    - ${e}`);
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`  Valid:   ${okCount}`);
console.log(`  Invalid: ${errorCount}`);
console.log(`  Skipped: ${skipCount} (fragments only)`);
console.log(`  Total:   ${docs.length}`);

if (errorCount > 0) process.exit(1);
