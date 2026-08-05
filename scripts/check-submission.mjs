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
const forbiddenNames = [
  /\.apk$/i,
  /\.aab$/i,
  /\.jks$/i,
  /\.keystore$/i,
  /\.key$/i,
  /(^|\/)\.env(?:\.|$)/i,
  /(^|\/)(?:secrets?|credentials?)(?:\.|$)/i
];
const secretPatterns = [
  { name:'GitHub token', regex:/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { name:'GitHub fine-grained token', regex:/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name:'provider API key', regex:/\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name:'Google API key', regex:/\bAIza[A-Za-z0-9_-]{35}\b/g },
  { name:'AWS access key', regex:/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { name:'Supabase secret key', regex:/\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name:'Supabase publishable key', regex:/\bsb_publishable_[A-Za-z0-9_-]{20,}\b/g },
  { name:'private key', regex:/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/g },
  { name:'JWT-like credential', regex:/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g }
];
const textExtensions = new Set(['', '.css', '.env', '.gradle', '.html', '.java', '.js', '.json', '.md', '.mjs', '.properties', '.sql', '.svg', '.txt', '.xml', '.yaml', '.yml']);

function fail(message) { failures.push(message); }
function isPublicEnvExample(path) { return /(^|\/)\.env\.example$/i.test(path); }
function isForbiddenName(path) { return !isPublicEnvExample(path) && forbiddenNames.some((pattern) => pattern.test(path)); }
function isTextCandidate(path) { return /(^|\/)\.env(?:\.|$)/i.test(path) || textExtensions.has(extname(path).toLowerCase()); }
function scanSecrets(contents, source) {
  for (const pattern of secretPatterns) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(contents)) fail(`Possible ${pattern.name} in ${source}`);
  }
}

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
  if (isForbiddenName(normalized)) fail(`Forbidden generated or secret-bearing file: ${normalized}`);
  const absolute = resolve(root, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || !isTextCandidate(normalized)) continue;
  const contents = readFileSync(absolute, 'utf8');
  scanSecrets(contents, normalized);
}

let historyBlobs = 0;
try {
  const objects = execFileSync('git', ['rev-list', '--objects', '--all'], { cwd:root, encoding:'utf8' })
    .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const scannedObjectIds = new Set();
  for (const object of objects) {
    const separator = object.indexOf(' ');
    if (separator < 0) continue;
    const objectId = object.slice(0, separator);
    const normalized = object.slice(separator + 1).trim().replaceAll('\\', '/');
    if (isForbiddenName(normalized)) fail(`Forbidden generated or secret-bearing file retained in Git history: ${normalized}`);
    if (!isTextCandidate(normalized) || scannedObjectIds.has(objectId)) continue;
    scannedObjectIds.add(objectId);
    const type = execFileSync('git', ['cat-file', '-t', objectId], { cwd:root, encoding:'utf8' }).trim();
    if (type !== 'blob') continue;
    const contents = execFileSync('git', ['cat-file', '-p', objectId], { cwd:root, encoding:'utf8', maxBuffer:20 * 1024 * 1024 });
    historyBlobs += 1;
    scanSecrets(contents, `Git history blob ${objectId.slice(0, 12)} (${normalized})`);
  }
} catch (error) {
  fail(`Unable to scan Git history: ${error.message}`);
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
  console.log(`Submission check passed: ${files.length} tracked files and ${historyBlobs} historical text blobs scanned; required README and MIT License present; no secret pattern detected.`);
}
