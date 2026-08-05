import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createMobileApiServer } from './server.js';

const fixedNow = new Date('2026-08-05T10:00:00.000Z');
const records = [{
  id:'existing-record',
  title:'',
  category:'研究和探究',
  occurredOn:'2026-08-05',
  description:'',
  aiDescription:'已整理',
  keywords:[],
  uncertainties:[],
  files:[],
  photos:[],
  needsDate:false,
  createdVia:null,
  createdAt:'2026-08-05T08:00:00.000Z',
  updatedAt:'2026-08-05T08:00:00.000Z'
}];
const notes = [];
const repository = {
  async checkHealth() { return { recordCount:records.length }; },
  async listRecords() { return records.map((record) => ({ ...record })); },
  async listCategories() { return ['研究和探究', '自定义分类']; },
  async createRecord(record) {
    const saved = { ...record, updatedAt:record.createdAt };
    records.unshift(saved);
    return saved;
  },
  async createNote(note) {
    notes.unshift(note);
    return { id:note.id, createdAt:note.createdAt };
  }
};

const config = {
  host:'127.0.0.1',
  port:0,
  timeZone:'Asia/Shanghai',
  corsOrigin:'*',
  maxBodyBytes:12000,
  databaseTimeoutMs:10000,
  agentTimeoutMs:30000,
  supabaseUrl:'https://example.supabase.co',
  supabasePublishableKey:'test-publishable-key',
  agentApiUrl:'',
  agentApiKey:'',
  version:'test',
  now:() => new Date(fixedNow)
};

let server;
let baseUrl;

async function start(testConfig, options) {
  const instance = createMobileApiServer(testConfig, options);
  await new Promise((resolve, reject) => {
    instance.once('error', reject);
    instance.listen(0, '127.0.0.1', resolve);
  });
  return instance;
}

async function readJson(path, init) {
  const response = await fetch(baseUrl + path, init);
  assert.match(response.headers.get('content-type') || '', /^application\/json; charset=utf-8/i);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return { response, body:await response.json() };
}

before(async () => {
  server = await start(config, { repository });
  baseUrl = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('mobile API success contracts', async () => {
  const health = await readJson('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.databaseReachable, true);
  assert.equal(health.body.agentConfigured, false);

  const listed = await readJson('/api/records');
  assert.equal(listed.response.status, 200);
  assert.ok(Array.isArray(listed.body.records));

  const snapshot = await readJson('/api/archive/snapshot');
  assert.equal(snapshot.body.snapshot.totalRecords, records.length);
  assert.deepEqual(snapshot.body.snapshot.weeklyRecordDays, [2]);

  const categories = await readJson('/api/categories');
  assert.equal(categories.body.categories.includes('自定义分类'), true);
  assert.equal(categories.body.categories.includes('学术竞赛'), true);

  const created = await readJson('/api/records', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ title:'测试', category:'研究和探究', occurredOn:'2026-08-05', description:'测试正文' })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.record.createdVia, 'mobile');
  assert.deepEqual(created.body.record.keywords, []);

  const note = await readJson('/api/notes', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ content:'测试随手记', noteDate:'2026-08-05' })
  });
  assert.equal(note.response.status, 201);
  assert.equal(note.body.receipt.status, 'saved');
});

test('mobile API error contracts', async () => {
  const invalidJson = await readJson('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{' });
  assert.equal(invalidJson.response.status, 400);
  assert.equal(invalidJson.body.error.code, 'INVALID_JSON');

  const empty = await readJson('/api/records', { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' });
  assert.equal(empty.body.error.code, 'EMPTY_DESCRIPTION');

  const invalidDate = await readJson('/api/records', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ description:'x', occurredOn:'2026-02-30' })
  });
  assert.equal(invalidDate.body.error.code, 'INVALID_DATE');

  const tooLarge = await readJson('/api/records', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ description:'x'.repeat(13000) })
  });
  assert.equal(tooLarge.response.status, 413);
  assert.equal(tooLarge.body.error.code, 'BODY_TOO_LARGE');

  const agent = await readJson('/api/assistant/messages', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ message:'测试' })
  });
  assert.equal(agent.response.status, 503);
  assert.equal(agent.body.error.code, 'AGENT_NOT_CONFIGURED');

  const missing = await readJson('/missing');
  assert.equal(missing.response.status, 404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');
});

test('health fails when Supabase is not configured', async () => {
  const unconfigured = await start({ ...config, supabaseUrl:'', supabasePublishableKey:'' }, { repository:null });
  try {
    const response = await fetch('http://127.0.0.1:' + unconfigured.address().port + '/health');
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error.code, 'SUPABASE_NOT_CONFIGURED');
  } finally {
    await new Promise((resolve) => unconfigured.close(resolve));
  }
});
