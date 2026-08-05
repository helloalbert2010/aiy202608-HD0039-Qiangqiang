import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createSupabaseRepository, RepositoryError } from './repository.js';

export const DEFAULT_CATEGORIES = ['学术竞赛','体育竞赛','综合竞赛','学术活动','探索类活动','研学活动','领导力活动','研究和探究','艺术活动','实习','随手记'];

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function configFromEnv(env = process.env) {
  return {
    host:String(env.HOST || '127.0.0.1').trim(),
    port:positiveInteger(env.PORT, 8787),
    timeZone:String(env.TZ || 'Asia/Shanghai').trim(),
    corsOrigin:String(env.CORS_ORIGIN || '*').trim(),
    maxBodyBytes:positiveInteger(env.MAX_BODY_BYTES, 1048576),
    databaseTimeoutMs:positiveInteger(env.DATABASE_TIMEOUT_MS, 10000),
    agentTimeoutMs:positiveInteger(env.AGENT_TIMEOUT_MS, 30000),
    supabaseUrl:String(env.SUPABASE_URL || '').trim(),
    supabasePublishableKey:String(env.SUPABASE_PUBLISHABLE_KEY || '').trim(),
    agentApiUrl:String(env.AGENT_API_URL || '').trim(),
    agentApiKey:String(env.AGENT_API_KEY || '').trim(),
    version:String(env.MYARCHIVE_API_VERSION || '1.0.0').trim(),
    now:() => new Date()
  };
}

function sendJson(response, status, value, corsOrigin) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Access-Control-Allow-Origin', corsOrigin);
  response.setHeader('Vary', 'Origin');
  response.end(JSON.stringify(value));
}

function sendError(response, status, code, message, corsOrigin) {
  sendJson(response, status, { error:{ code, message } }, corsOrigin);
}

function resolveCorsOrigin(request, configuredOrigin) {
  const requestOrigin = String(request.headers.origin || '').trim();
  if (!requestOrigin || configuredOrigin === '*') return configuredOrigin || '*';
  const allowed = configuredOrigin.split(',').map((value) => value.trim()).filter(Boolean);
  if (allowed.includes(requestOrigin)) return requestOrigin;
  throw new HttpError(403, 'CORS_ORIGIN_DENIED', '当前来源不允许访问此服务');
}

function readBody(request, limit) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(request.headers['content-length'] || 0);
    if (declaredLength > limit) {
      request.resume();
      reject(new HttpError(413, 'BODY_TOO_LARGE', '请求体超过大小限制'));
      return;
    }
    const chunks = [];
    let size = 0;
    let settled = false;
    request.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        settled = true;
        reject(new HttpError(413, 'BODY_TOO_LARGE', '请求体超过大小限制'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

async function readJson(request, limit) {
  const body = await readBody(request, limit);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, 'INVALID_JSON', '请求体不是有效 JSON');
  }
}

function validDate(value) {
  if (value == null || value === '') return null;
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new HttpError(400, 'INVALID_DATE', '日期必须是有效的 YYYY-MM-DD');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
    throw new HttpError(400, 'INVALID_DATE', '日期必须是有效的 YYYY-MM-DD');
  }
  return text;
}

function dateParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year:Number(values.year), month:Number(values.month), day:Number(values.day) };
}

function weeklyRecordDays(records, now, timeZone) {
  const today = dateParts(now, timeZone);
  const todayTime = Date.UTC(today.year, today.month - 1, today.day);
  const todayWeekday = (new Date(todayTime).getUTCDay() + 6) % 7;
  const weekStart = todayTime - todayWeekday * 86400000;
  return Array.from(new Set(records.flatMap((record) => {
    if (!record.occurredOn) return [];
    const [year, month, day] = record.occurredOn.split('-').map(Number);
    const recordTime = Date.UTC(year, month - 1, day);
    const offset = Math.floor((recordTime - weekStart) / 86400000);
    return offset >= 0 && offset <= 6 ? [offset] : [];
  }))).sort((left, right) => left - right);
}

function mergeCategories(customCategories) {
  return Array.from(new Set(DEFAULT_CATEGORIES.concat(customCategories || []).map((value) => String(value || '').trim()).filter(Boolean)));
}

function snapshot(records, categories, now, timeZone) {
  return {
    totalRecords:records.length,
    domainCount:new Set(records.map((record) => record.category.trim()).filter(Boolean)).size,
    aiReadyCount:records.filter((record) => record.aiDescription.trim()).length,
    weeklyRecordDays:weeklyRecordDays(records, now, timeZone),
    categories:mergeCategories(categories)
  };
}

async function requestAgent(config, message, conversationId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.agentTimeoutMs);
  try {
    const response = await fetch(config.agentApiUrl, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + config.agentApiKey },
      body:JSON.stringify({ message, conversationId:conversationId || undefined }),
      signal:controller.signal
    });
    if (!response.ok) throw new HttpError(502, 'UPSTREAM_ERROR', 'AI 服务暂时不可用');
    const data = await response.json();
    const content = data.reply?.content ?? data.choices?.[0]?.message?.content ?? data.content;
    if (!content) throw new HttpError(502, 'UPSTREAM_ERROR', 'AI 服务没有返回有效内容');
    return {
      content:String(content),
      conversationId:String(data.reply?.conversationId || data.conversationId || conversationId || 'conversation-' + randomUUID()),
      createdAt:new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (controller.signal.aborted) throw new HttpError(504, 'AGENT_TIMEOUT', 'AI 服务响应超时');
    throw new HttpError(502, 'UPSTREAM_UNREACHABLE', '无法连接 AI 服务');
  } finally {
    clearTimeout(timeout);
  }
}

export function createMobileApiServer(inputConfig = configFromEnv(), options = {}) {
  const config = { ...configFromEnv({}), ...inputConfig };
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  const repository = options.repository === undefined
    ? (configured ? createSupabaseRepository(config) : null)
    : options.repository;

  return createServer(async (request, response) => {
    let corsOrigin = '*';
    try {
      corsOrigin = resolveCorsOrigin(request, config.corsOrigin);
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const route = url.pathname;

      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        sendJson(response, 200, { ok:true }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && route === '/health') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        await repository.checkHealth();
        sendJson(response, 200, {
          service:'myarchive-api',
          status:'ok',
          supabaseConfigured:true,
          databaseReachable:true,
          agentConfigured:Boolean(config.agentApiUrl && config.agentApiKey),
          version:config.version,
          timestamp:config.now().toISOString()
        }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && route === '/api/records') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        sendJson(response, 200, { records:await repository.listRecords() }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && route === '/api/categories') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        sendJson(response, 200, { categories:mergeCategories(await repository.listCategories()) }, corsOrigin);
        return;
      }

      if (request.method === 'GET' && route === '/api/archive/snapshot') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        const [records, categories] = await Promise.all([repository.listRecords(), repository.listCategories()]);
        sendJson(response, 200, { snapshot:snapshot(records, categories, config.now(), config.timeZone) }, corsOrigin);
        return;
      }

      if (request.method === 'POST' && route === '/api/records') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        const body = await readJson(request, config.maxBodyBytes);
        const description = String(body.description || '').trim();
        if (!description) throw new HttpError(400, 'EMPTY_DESCRIPTION', '经历正文不能为空');
        const occurredOn = validDate(body.occurredOn);
        const createdAt = config.now().toISOString();
        const record = await repository.createRecord({
          id:'record-mobile-' + randomUUID(),
          title:String(body.title || '').trim(),
          category:String(body.category || '').trim(),
          occurredOn,
          description,
          aiDescription:'',
          keywords:[],
          uncertainties:[],
          files:[],
          photos:[],
          needsDate:occurredOn === null,
          createdVia:'mobile',
          createdAt
        });
        sendJson(response, 201, { record }, corsOrigin);
        return;
      }

      if (request.method === 'POST' && route === '/api/notes') {
        if (!repository) throw new HttpError(503, 'SUPABASE_NOT_CONFIGURED', '数据库尚未配置');
        const body = await readJson(request, config.maxBodyBytes);
        const content = String(body.content || '').trim();
        if (!content) throw new HttpError(400, 'EMPTY_CONTENT', '随手记正文不能为空');
        const created = await repository.createNote({
          id:'note-mobile-' + randomUUID(),
          content,
          noteDate:validDate(body.noteDate),
          createdAt:config.now().toISOString()
        });
        sendJson(response, 201, { receipt:{ captureId:created.id, createdAt:created.createdAt, kind:'text', status:'saved', transcriptionStatus:'not_requested' } }, corsOrigin);
        return;
      }

      if (request.method === 'POST' && route === '/api/assistant/messages') {
        const body = await readJson(request, config.maxBodyBytes);
        const message = String(body.message || '').trim();
        if (!message) throw new HttpError(400, 'EMPTY_MESSAGE', '消息不能为空');
        if (message.length > 8000) throw new HttpError(400, 'MESSAGE_TOO_LONG', '消息不能超过 8000 个字符');
        if (!config.agentApiUrl || !config.agentApiKey) throw new HttpError(503, 'AGENT_NOT_CONFIGURED', 'AI 助手尚未配置');
        sendJson(response, 200, { reply:await requestAgent(config, message, body.conversationId) }, corsOrigin);
        return;
      }

      throw new HttpError(404, 'NOT_FOUND', '接口不存在');
    } catch (error) {
      if (response.headersSent) return;
      if (error instanceof HttpError) {
        sendError(response, error.status, error.code, error.message, corsOrigin);
        return;
      }
      if (error instanceof RepositoryError) {
        sendError(response, 502, error.code, error.message, corsOrigin);
        return;
      }
      sendError(response, 500, 'INTERNAL_ERROR', '服务内部错误', corsOrigin);
    }
  });
}
