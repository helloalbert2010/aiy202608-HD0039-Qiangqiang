import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const pages = ['index', 'record', 'chat', 'atlas', 'library', 'detail', 'settings', 'notes', 'calendar', 'growth'];
const archiveDirectory = resolve(import.meta.dirname, 'data');
const archiveFile = resolve(archiveDirectory, 'archive-data.json');
const archiveBackupFile = resolve(archiveDirectory, 'archive-data.backup.json');
const mediaDirectory = resolve(archiveDirectory, 'media');
const archiveApiPath = '/api/archive-data';
const mediaApiPrefix = '/api/archive-media/';

function cleanPageUrlsPlugin() {
  const pageNames = new Set(pages);

  function install(server) {
    server.middlewares.use((request, response, next) => {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        next();
        return;
      }

      const url = new URL(request.url || '/', 'http://127.0.0.1');
      const match = /^\/([^/]+?)(\.html)?$/.exec(url.pathname);
      if (!match || !pageNames.has(match[1])) {
        next();
        return;
      }

      const page = match[1];
      if (match[2] || page === 'index') {
        response.statusCode = 308;
        response.setHeader('Location', (page === 'index' ? '/' : '/' + page) + url.search);
        response.setHeader('Cache-Control', 'no-store');
        response.end();
        return;
      }

      request.url = '/' + page + '.html' + url.search;
      next();
    });
  }

  return {
    name: 'myarchive-clean-page-urls',
    configureServer: install,
    configurePreviewServer: install
  };
}

function sendJson(response, status, value) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(value));
}

function readRequestBody(request, limit) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error('Request body is too large');
        error.statusCode = 413;
        reject(error);
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolveBody(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function emptyArchive() {
  return { version: 1, records: [], notes: [], updatedAt: null };
}

async function readArchive() {
  try {
    const saved = JSON.parse(await readFile(archiveFile, 'utf8'));
    return {
      version: 1,
      records: Array.isArray(saved.records) ? saved.records : [],
      notes: Array.isArray(saved.notes) ? saved.notes : [],
      updatedAt: saved.updatedAt || null
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return emptyArchive();
  }
}

async function writeArchive(archive) {
  await mkdir(archiveDirectory, { recursive: true });
  const temporaryFile = archiveFile + '.' + process.pid + '.' + Date.now() + '.tmp';
  await writeFile(temporaryFile, JSON.stringify(archive, null, 2) + '\n', 'utf8');
  try {
    try { await copyFile(archiveFile, archiveBackupFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await rename(temporaryFile, archiveFile);
  } catch (error) {
    await rm(temporaryFile, { force: true });
    throw error;
  }
}

function applyCollectionPatch(current, patch) {
  const entries = new Map(current.filter((item) => item && item.id).map((item) => [String(item.id), item]));
  const deletedIds = Array.isArray(patch?.deleteIds) ? patch.deleteIds : [];
  const upserts = Array.isArray(patch?.upsert) ? patch.upsert : [];
  deletedIds.forEach((id) => entries.delete(String(id)));
  upserts.forEach((item) => {
    if (item && item.id) entries.set(String(item.id), item);
  });
  return Array.from(entries.values()).sort((left, right) => {
    return Date.parse(right.createdAt || right.date || 0) - Date.parse(left.createdAt || left.date || 0);
  });
}

function mediaPaths(id) {
  return {
    content: resolve(mediaDirectory, id + '.bin'),
    metadata: resolve(mediaDirectory, id + '.json')
  };
}

function archiveStoragePlugin() {
  async function handleRequest(request, response, next) {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname === archiveApiPath) {
      if (request.method === 'GET') {
        sendJson(response, 200, await readArchive());
        return;
      }
      if (request.method === 'PATCH') {
        const body = JSON.parse((await readRequestBody(request, 10 * 1024 * 1024)).toString('utf8') || '{}');
        const archive = await readArchive();
        if (body.recordsPatch) archive.records = applyCollectionPatch(archive.records, body.recordsPatch);
        if (body.notesPatch) archive.notes = applyCollectionPatch(archive.notes, body.notesPatch);
        archive.updatedAt = new Date().toISOString();
        await writeArchive(archive);
        sendJson(response, 200, archive);
        return;
      }
      sendJson(response, 405, { error: 'Method not allowed' });
      return;
    }

    if (!url.pathname.startsWith(mediaApiPrefix)) {
      next();
      return;
    }

    const id = decodeURIComponent(url.pathname.slice(mediaApiPrefix.length));
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
      sendJson(response, 400, { error: 'Invalid media id' });
      return;
    }
    const paths = mediaPaths(id);

    if (request.method === 'PUT') {
      const content = await readRequestBody(request, 100 * 1024 * 1024);
      let name = id;
      try { name = decodeURIComponent(String(request.headers['x-archive-file-name'] || id)); } catch {}
      const metadata = {
        id,
        name,
        type: String(request.headers['content-type'] || 'application/octet-stream'),
        size: content.length
      };
      await mkdir(mediaDirectory, { recursive: true });
      await Promise.all([
        writeFile(paths.content, content),
        writeFile(paths.metadata, JSON.stringify(metadata, null, 2) + '\n', 'utf8')
      ]);
      sendJson(response, 200, metadata);
      return;
    }

    if (request.method === 'GET' || request.method === 'HEAD') {
      try {
        const metadata = JSON.parse(await readFile(paths.metadata, 'utf8'));
        const content = request.method === 'HEAD' ? null : await readFile(paths.content);
        response.statusCode = 200;
        response.setHeader('Content-Type', metadata.type || 'application/octet-stream');
        response.setHeader('Content-Length', String(metadata.size || content?.length || 0));
        response.setHeader('X-Archive-File-Name', encodeURIComponent(metadata.name || id));
        response.setHeader('Cache-Control', 'no-store');
        response.end(content);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        sendJson(response, 404, { error: 'Media not found' });
      }
      return;
    }

    if (request.method === 'DELETE') {
      await Promise.all([rm(paths.content, { force: true }), rm(paths.metadata, { force: true })]);
      response.statusCode = 204;
      response.end();
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed' });
  }

  function install(server) {
    server.middlewares.use((request, response, next) => {
      handleRequest(request, response, next).catch((error) => {
        if (response.headersSent) {
          response.end();
          return;
        }
        sendJson(response, error.statusCode || 500, { error: error.message || 'Archive storage failed' });
      });
    });
  }

  return {
    name: 'myarchive-local-file-storage',
    configureServer: install,
    configurePreviewServer: install
  };
}

export default defineConfig({
  plugins: [cleanPageUrlsPlugin(), archiveStoragePlugin()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  build: {
    chunkSizeWarningLimit: 550,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((page) => [page, resolve(import.meta.dirname, page + '.html')]))
    }
  }
});
