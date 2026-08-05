import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

export class RepositoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function mapRecordRow(row) {
  return {
    id:String(row.id || ''),
    title:String(row.title || ''),
    category:String(row.category || ''),
    occurredOn:row.occurred_on || null,
    description:String(row.description || ''),
    aiDescription:String(row.ai_description || ''),
    keywords:asArray(row.keywords).map(String),
    uncertainties:asArray(row.uncertainties).map(String),
    files:asArray(row.files),
    photos:asArray(row.photos),
    needsDate:Boolean(row.needs_date),
    createdVia:row.created_via ? String(row.created_via) : null,
    createdAt:row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt:row.updated_at ? new Date(row.updated_at).toISOString() : null
  };
}

function createTimedFetch(timeoutMs) {
  return async function timedFetch(input, init = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const upstreamSignal = init.signal;
    const abortUpstream = () => controller.abort(upstreamSignal.reason);
    if (upstreamSignal) {
      if (upstreamSignal.aborted) abortUpstream();
      else upstreamSignal.addEventListener('abort', abortUpstream, { once:true });
    }
    try {
      return await fetch(input, { ...init, signal:controller.signal });
    } catch (error) {
      if (controller.signal.aborted && !upstreamSignal?.aborted) {
        throw new RepositoryError('UPSTREAM_UNREACHABLE', '数据库请求超时');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortUpstream);
    }
  };
}

async function execute(query) {
  try {
    const result = await query;
    if (result.error) throw new RepositoryError('UPSTREAM_ERROR', '数据库请求失败');
    return result;
  } catch (error) {
    if (error instanceof RepositoryError) throw error;
    throw new RepositoryError('UPSTREAM_UNREACHABLE', '无法连接数据库');
  }
}

export function createSupabaseRepository(config) {
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
    global:{ fetch:createTimedFetch(config.databaseTimeoutMs) }
  });

  return {
    async checkHealth() {
      const result = await execute(client.from('records').select('id', { count:'exact', head:true }));
      return { recordCount:Number(result.count || 0) };
    },

    async listRecords() {
      const rows = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const result = await execute(
          client.from('records').select('*').order('created_at', { ascending:false }).range(offset, offset + PAGE_SIZE - 1)
        );
        rows.push(...(result.data || []));
        if (!result.data || result.data.length < PAGE_SIZE) break;
      }
      return rows.map(mapRecordRow);
    },

    async listCategories() {
      const result = await execute(client.from('categories').select('name').order('created_at', { ascending:true }));
      return (result.data || []).map((row) => String(row.name || '').trim()).filter(Boolean);
    },

    async createRecord(record) {
      const row = {
        id:record.id,
        title:record.title,
        category:record.category,
        occurred_on:record.occurredOn,
        description:record.description,
        ai_description:record.aiDescription,
        keywords:record.keywords,
        uncertainties:record.uncertainties,
        files:record.files,
        photos:record.photos,
        needs_date:record.needsDate,
        created_via:record.createdVia,
        created_at:record.createdAt
      };
      const result = await execute(client.from('records').insert(row).select('*').single());
      return mapRecordRow(result.data);
    },

    async createNote(note) {
      const row = { id:note.id, content:note.content, note_date:note.noteDate, created_at:note.createdAt };
      const result = await execute(client.from('notes').insert(row).select('id,created_at').single());
      return { id:String(result.data.id), createdAt:new Date(result.data.created_at).toISOString() };
    },

    async findRecord(id) {
      const result = await execute(client.from('records').select('*').eq('id', id).maybeSingle());
      return result.data ? mapRecordRow(result.data) : null;
    },

    async deleteRecord(id) {
      await execute(client.from('records').delete().eq('id', id));
    },

    async deleteNote(id) {
      await execute(client.from('notes').delete().eq('id', id));
    }
  };
}
