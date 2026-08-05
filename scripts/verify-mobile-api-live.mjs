import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';
import { configFromEnv, createMobileApiServer } from '../mobile-api/server.js';
import { createSupabaseRepository } from '../mobile-api/repository.js';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.env.local');
if (existsSync(envFile)) loadEnvFile(envFile);

const config = configFromEnv();
const baseUrl = String(process.env.MOBILE_API_BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const repository = config.supabaseUrl && config.supabasePublishableKey ? createSupabaseRepository(config) : null;
const prefix = '[MOBILE-BACKEND-READY-20260805]';
let createdRecordId = null;
let createdNoteId = null;

async function request(path, init) {
  const response = await fetch(baseUrl + path, init);
  assert.match(response.headers.get('content-type') || '', /^application\/json; charset=utf-8/i, path + ' must return JSON');
  assert.equal(response.headers.get('cache-control'), 'no-store', path + ' must disable caching');
  const body = await response.json();
  return { response, body };
}

async function expectError(path, init, status, code) {
  const result = await request(path, init);
  assert.equal(result.response.status, status, path + ' status');
  assert.equal(result.body.error?.code, code, path + ' error code');
  return code;
}

async function verifyMissingDatabaseContract() {
  const server = createMobileApiServer({ ...config, host:'127.0.0.1', port:0, supabaseUrl:'', supabasePublishableKey:'' }, { repository:null });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/health');
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error?.code, 'SUPABASE_NOT_CONFIGURED');
    return body.error.code;
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const evidence = { testTime:new Date().toISOString(), prefix };

try {
  assert.ok(repository, 'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured');

  const health = await request('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.databaseReachable, true);
  evidence.health = { status:health.body.status, databaseReachable:health.body.databaseReachable, agentConfigured:health.body.agentConfigured, version:health.body.version };

  const baseline = await request('/api/records');
  assert.equal(baseline.response.status, 200);
  assert.ok(Array.isArray(baseline.body.records));
  evidence.baselineRecords = baseline.body.records.length;

  const initialSnapshot = await request('/api/archive/snapshot');
  assert.equal(initialSnapshot.body.snapshot.totalRecords, evidence.baselineRecords);
  evidence.snapshotTotalRecords = initialSnapshot.body.snapshot.totalRecords;

  const categories = await request('/api/categories');
  assert.ok(Array.isArray(categories.body.categories));
  evidence.categories = { type:'array', count:categories.body.categories.length };

  const created = await request('/api/records', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ title:prefix, category:'研究和探究', occurredOn:'2026-08-05', description:prefix })
  });
  assert.equal(created.response.status, 201);
  createdRecordId = created.body.record.id;
  assert.ok(createdRecordId);
  evidence.createdRecordId = createdRecordId;

  const apiReadBack = await request('/api/records');
  assert.equal(apiReadBack.body.records.some((record) => record.id === createdRecordId), true);
  evidence.apiReadBack = true;

  const directReadBack = await repository.findRecord(createdRecordId);
  assert.equal(directReadBack?.id, createdRecordId);
  evidence.sharedDatabaseReadBack = true;

  const note = await request('/api/notes', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ content:prefix, noteDate:'2026-08-05' })
  });
  assert.equal(note.response.status, 201);
  createdNoteId = note.body.receipt.captureId;
  evidence.createdNoteId = createdNoteId;

  evidence.errors = {
    invalidJson:await expectError('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{' }, 400, 'INVALID_JSON'),
    emptyDescription:await expectError('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' }, 400, 'EMPTY_DESCRIPTION'),
    invalidDate:await expectError('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ description:'x', occurredOn:'2026-02-30' }) }, 400, 'INVALID_DATE'),
    bodyTooLarge:await expectError('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ description:'x'.repeat(config.maxBodyBytes + 1) }) }, 413, 'BODY_TOO_LARGE'),
    emptyMessage:await expectError('/api/assistant/messages', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' }, 400, 'EMPTY_MESSAGE'),
    agentNotConfigured:await expectError('/api/assistant/messages', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ message:'test' }) }, 503, 'AGENT_NOT_CONFIGURED'),
    notFound:await expectError('/not-found', undefined, 404, 'NOT_FOUND'),
    supabaseNotConfigured:await verifyMissingDatabaseContract()
  };
} finally {
  if (createdRecordId && repository) await repository.deleteRecord(createdRecordId);
  if (createdNoteId && repository) await repository.deleteNote(createdNoteId);
}

const restored = await request('/api/records');
assert.equal(restored.body.records.length, evidence.baselineRecords);
assert.equal(restored.body.records.some((record) => record.id === createdRecordId), false);
evidence.cleanup = { exactRecordId:createdRecordId, exactNoteId:createdNoteId, baselineRestored:true };

console.log(JSON.stringify(evidence, null, 2));
