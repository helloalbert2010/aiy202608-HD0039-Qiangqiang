import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const failures = [];
const requiredReadmeText = [
  'AIY 黑客松 2026 深圳站',
  '团队：强强',
  '团队编号：HD0039',
  '团队分工',
  '它能做什么',
  '演示',
  '用到的技术 / AI 工具',
  '怎么跑起来',
  '后续计划',
  'MIT License'
];
const forbiddenNames = [/\.apk$/i, /\.aab$/i, /\.jks$/i, /\.keystore$/i, /\.key$/i, /(^|\/)secrets?\./i];
const secretPatterns = [
  { name:'GitHub token', regex:/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name:'provider API key', regex:/\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name:'private key', regex:/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g },
  { name:'JWT-like credential', regex:/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g }
];
const textExtensions = new Set(['', '.css', '.env', '.gradle', '.html', '.java', '.js', '.json', '.md', '.mjs', '.properties', '.sql', '.svg', '.txt', '.xml', '.yaml', '.yml']);

function fail(message) { failures.push(message); }

for (const path of ['README.md', 'LICENSE', '.env.example', 'docs/submission-checklist.md']) {
  if (!existsSync(resolve(root, path))) fail(`Missing submission file: ${path}`);
}

const readme = existsSync(resolve(root, 'README.md')) ? readFileSync(resolve(root, 'README.md'), 'utf8') : '';
for (const text of requiredReadmeText) if (!readme.includes(text)) fail(`README is missing required organizer content: ${text}`);

const license = existsSync(resolve(root, 'LICENSE')) ? readFileSync(resolve(root, 'LICENSE'), 'utf8') : '';
if (!license.includes('MIT License') || !license.includes('Copyright (c) 2026 Albert, Peter, Vito')) fail('LICENSE must be MIT and name the participating team members.');

let files = [];
try {
  files = execFileSync('git', ['ls-files', '--cached'], { cwd:root, encoding:'utf8' })
    .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
} catch (error) {
  fail(`Unable to list submission files: ${error.message}`);
}

for (const file of files) {
  const normalized = file.replaceAll('\\', '/');
  if (forbiddenNames.some((pattern) => pattern.test(normalized))) fail(`Forbidden generated or secret-bearing file: ${normalized}`);
  const absolute = resolve(root, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || !textExtensions.has(extname(file).toLowerCase())) continue;
  const contents = readFileSync(absolute, 'utf8');
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(contents)) fail(`Possible ${pattern.name} in ${normalized}`);
  }
}

const envExample = existsSync(resolve(root, '.env.example')) ? readFileSync(resolve(root, '.env.example'), 'utf8') : '';
const credentialVariables = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_DEEPSEEK_API_KEY', 'VITE_GLM_API_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'AGENT_API_URL', 'AGENT_API_KEY']);
for (const line of envExample.split(/\r?\n/)) {
  if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
  const [name, ...rest] = line.split('=');
  if (credentialVariables.has(name.trim()) && rest.join('=').trim()) fail(`.env.example must keep ${name.trim()} empty.`);
}

if (failures.length) {
  console.error('Submission check failed:');
  failures.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Submission check passed: ${files.length} candidate files, required README and MIT License present, no secret pattern detected.`);
}
