import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, extname, join, normalize, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index', 'record', 'chat', 'atlas', 'library', 'detail', 'settings', 'notes', 'calendar', 'growth'];
const requiredFiles = [
  'README.md',
  'AGENTS.md',
  '.env.example',
  'package.json',
  'vite.config.js',
  'app.js',
  'ai-client.js',
  'memory-atlas.js',
  'styles.css',
  'home.js',
  'home.css',
  'growth-profile.js',
  'mobile-api/repository.js',
  'mobile-api/server.js',
  'mobile-api/start.js',
  'mobile-api/server.test.js',
  'scripts/verify-mobile-api-live.mjs',
  'docs/cloud-database.md',
  'docs/competition-state.md',
  'docs/test-evidence.md',
  'supabase/migrations/202608030001_archive_schema.sql'
];
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist']);
const forbiddenLegacyTerms = [
  ['home', 'variants'].join('-'),
  ['home', 'variant'].join('-'),
  ...Array.from({ length: 10 }, (_, index) => `home-${String(index + 1).padStart(2, '0')}.html`),
  ['designs', 'html'].join('.'),
  ['designs', 'css'].join('.')
];
const sourceExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs']);
const failures = [];

function fail(message) {
  failures.push(message);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : walk(join(directory, entry.name));
    }
    return entry.isFile() ? [join(directory, entry.name)] : [];
  });
}

function isInsideRoot(path) {
  const resolved = resolve(path);
  return resolved === root || resolved.startsWith(root + '\\') || resolved.startsWith(root + '/');
}

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) fail(`Missing required file: ${file}`);
}

for (const page of pages) {
  if (!existsSync(join(root, `${page}.html`))) fail(`Missing page entry: ${page}.html`);
}

const viteConfig = existsSync(join(root, 'vite.config.js')) ? readFileSync(join(root, 'vite.config.js'), 'utf8') : '';
for (const page of pages) {
  if (!viteConfig.includes(`'${page}'`)) fail(`vite.config.js does not declare page: ${page}`);
}

const cloudMigrationPath = join(root, 'supabase/migrations/202608030001_archive_schema.sql');
const cloudMigration = existsSync(cloudMigrationPath) ? readFileSync(cloudMigrationPath, 'utf8') : '';
const requiredCloudRules = [
  'create table public.records',
  'create table public.notes',
  'create table public.categories',
  'alter table public.records enable row level security',
  'alter table public.notes enable row level security',
  'alter table public.categories enable row level security',
  'revoke all on table public.records from anon',
  'revoke all on table public.notes from anon',
  'revoke all on table public.categories from anon',
  '(select auth.uid()) = user_id'
];
for (const rule of requiredCloudRules) {
  if (!cloudMigration.toLowerCase().includes(rule)) fail(`Supabase migration is missing required rule: ${rule}`);
}

const envExamplePath = join(root, '.env.example');
const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, 'utf8') : '';
for (const variable of ['VITE_SUPABASE_URL=', 'VITE_SUPABASE_PUBLISHABLE_KEY=', 'HOST=', 'PORT=', 'SUPABASE_URL=', 'SUPABASE_PUBLISHABLE_KEY=']) {
  if (!envExample.includes(variable)) fail(`.env.example is missing public variable: ${variable}`);
}
for (const secretName of ['SERVICE_ROLE', 'DATABASE_PASSWORD']) {
  if (envExample.toUpperCase().includes(secretName)) fail(`.env.example must not contain server secret variable: ${secretName}`);
}

const files = walk(root);
for (const file of files) {
  if (!sourceExtensions.has(extname(file))) continue;
  const projectPath = relative(root, file).replaceAll('\\', '/');
  const contents = readFileSync(file, 'utf8');
  for (const term of forbiddenLegacyTerms) {
    if (contents.includes(term)) fail(`Legacy homepage reference in ${projectPath}: ${term}`);
  }
}

for (const page of pages) {
  const file = join(root, `${page}.html`);
  if (!existsSync(file)) continue;
  const contents = readFileSync(file, 'utf8');
  const references = [...contents.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    if (!reference.startsWith('/') || reference.startsWith('//')) continue;
    const assetPath = reference.split(/[?#]/, 1)[0];
    if (!assetPath || assetPath.includes('..')) {
      fail(`Unsafe local reference in ${basename(file)}: ${reference}`);
      continue;
    }
    const resolved = normalize(join(root, assetPath));
    if (!isInsideRoot(resolved) || !existsSync(resolved)) {
      fail(`Missing local reference in ${basename(file)}: ${reference}`);
    }
  }
}

if (failures.length) {
  console.error('Project check failed:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Project check passed: ${pages.length} pages, ${files.length} source files.`);
}
