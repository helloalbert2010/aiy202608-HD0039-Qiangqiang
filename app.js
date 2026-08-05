import { analyzeMediaWithGlm, analyzeTextWithDeepSeek, chatWithDeepSeek, synthesizeEventForRetrieval, transcribeAudioSequentially } from './ai-client.js';
import {
  applyCloudCollectionPatch,
  isCloudConfigured,
  markCloudMigrationComplete,
  migrateArchiveToCloud,
  readCloudArchive,
  readCloudMigrationState,
  upsertCloudCategories
} from './cloud-store.js';
import { initGrowthProfile } from './growth-profile.js';
import {
  ArrowRight,
  ArrowUp,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  createIcons,
  Database,
  Download,
  FileSearch,
  FileText,
  Home,
  LibraryBig,
  MessageCircle,
  MessageSquareMore,
  Mic,
  NotebookPen,
  Orbit,
  PenLine,
  Plus,
  Radar,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  WandSparkles,
  X
} from 'lucide';

const RECORDS_KEY = 'ji-records-v1';
const SETTINGS_KEY = 'ji-settings-v1';
const CHAT_KEY = 'ji-chat-v2';
const NOTES_KEY = 'ji-notes-v1';
const NOTES_SPREAD_MIGRATION_KEY = 'ji-notes-spread-v1';
const NOTES_SPREAD_BACKUP_KEY = 'ji-notes-backup-before-spread-v1';
const SHARED_STORAGE_MIGRATION_KEY = 'ji-shared-file-storage-v1';
const SHARED_RECORDS_PENDING_KEY = 'ji-shared-records-pending-v1';
const SHARED_NOTES_PENDING_KEY = 'ji-shared-notes-pending-v1';
const CLOUD_STORAGE_MIGRATION_KEY = 'ji-supabase-shared-storage-v1';
const ARCHIVE_API_PATH = '/api/archive-data';
const MEDIA_API_PREFIX = '/api/archive-media/';

const DEFAULT_CATEGORIES = ['学术竞赛','体育竞赛','综合竞赛','学术活动','探索类活动','研学活动','领导力活动','研究和探究','艺术活动','实习','随手记'];
const SEED_RECORDS = [
  { id:'sim-2026', title:'模拟联合国：第一次独立主持危机委员会', category:'领导力活动', date:'2026-05-18', description:'准备了两周的议题材料，第一次担任危机委员会主席。开场时两位代表因为程序问题争论起来，我先暂停流程，让每个人把事实说完，再把争议拆成三个具体动作。最后大家在规定时间内完成了决议。', aiDescription:'记录者在模拟联合国危机委员会中担任主席，负责会前研究、议程设计和现场主持。开场后，两位代表因程序问题发生争论；记录者暂停流程，让双方分别说明事实，再将争议拆分为三个具体动作。讨论随后恢复，参会代表在规定时间内完成了决议。', files:['MUN_Crisis_Committee.pdf'], photos:['https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&w=900&q=80'], createdAt:'2026-05-20T10:00:00.000Z', needsDate:false },
  { id:'robotics-2026', title:'机器人社：把一台总是跑偏的车调回赛道', category:'研究和探究', date:'2026-04-29', description:'区域赛前一周，循迹车每次过弯都会偏离。我们把问题拆成传感器、代码和机械结构三组，轮流验证假设。我负责记录每次参数变化，最后发现是一个被忽略的光照变量。', aiDescription:'机器人区域赛前一周，团队发现循迹车每次过弯都会偏离赛道。团队将原因拆分为传感器、代码和机械结构三组假设并逐项验证；记录者负责保存每次参数变化。实验最终定位到此前被忽略的环境光照变量，团队据此调整车辆设置。', files:['Regional_Robotics_Report.docx'], photos:['https://images.unsplash.com/photo-1563770660941-10a5c3e0a7f4?auto=format&fit=crop&w=900&q=80'], createdAt:'2026-05-01T10:00:00.000Z', needsDate:false },
  { id:'coast-2026', title:'海岸线调研：第一次把数据讲给社区听', category:'探索类活动', date:'2026-03-22', description:'参加海岸线微塑料调研，连续三天在潮间带取样。回到社区分享时，发现大家更关心的是“这些数据和我有什么关系”，于是临时调整了讲法。', aiDescription:'你参加了海岸线微塑料调研，在潮间带完成连续三天的取样与记录。面向社区分享数据时，你注意到听众真正关心的是研究和日常生活的连接，临时改变表达顺序，用身边可见的场景解释抽象指标。这次调整让你看到，严谨的研究也需要从对方的视角重新组织。', files:['Coastline_Sampling_Notes.pdf'], photos:['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'], createdAt:'2026-03-24T10:00:00.000Z', needsDate:false },
  { id:'theatre-2025', title:'校园戏剧节：在最后一周接住一场演出', category:'艺术活动', date:'2025-12-06', description:'负责舞台监督。演出前一周主灯故障，原方案无法使用。我和灯光老师重新设计走位，在一次次排练里让演员习惯新的节奏，最终演出没有被看出变化。', aiDescription:'记录者在校园戏剧节中担任舞台监督。演出前一周主灯发生故障，原有舞台调度方案无法继续使用；记录者与灯光老师重新设计演员走位，并通过后续排练让演员适应新的节奏。演出最终按计划完成，现场观众没有察觉方案曾被临时调整。', files:['Theatre_Festival_Poster.png'], photos:['https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=80'], createdAt:'2025-12-08T10:00:00.000Z', needsDate:false }
];

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]; });
}
function dateLabel(date) {
  if (!date) return '待补充时间';
  var bits = date.split('-');
  return bits.length === 3 ? bits[0] + ' / ' + bits[1] + ' / ' + bits[2] : date;
}
export function getRecords() {
  try {
    var saved = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  localStorage.setItem(RECORDS_KEY, JSON.stringify(SEED_RECORDS));
  return SEED_RECORDS.slice();
}
function readStoredCollection(key) {
  try {
    var saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : null;
  } catch (error) { return null; }
}
function collectionPatch(previous, next) {
  var before = new Map((previous || []).filter(function (item) { return item && item.id; }).map(function (item) { return [String(item.id), item]; }));
  var after = new Map((next || []).filter(function (item) { return item && item.id; }).map(function (item) { return [String(item.id), item]; }));
  var deleteIds = Array.from(before.keys()).filter(function (id) { return !after.has(id); });
  var upsert = Array.from(after.entries()).filter(function (entry) { return !before.has(entry[0]) || JSON.stringify(before.get(entry[0])) !== JSON.stringify(entry[1]); }).map(function (entry) { return entry[1]; });
  return { upsert:upsert, deleteIds:deleteIds };
}
function mergeCollectionPatches(first, second) {
  var upserts = new Map(); var deleted = new Set();
  [first, second].forEach(function (patch) {
    (patch && Array.isArray(patch.deleteIds) ? patch.deleteIds : []).forEach(function (id) { var key = String(id); deleted.add(key); upserts.delete(key); });
    (patch && Array.isArray(patch.upsert) ? patch.upsert : []).forEach(function (item) { if (!item || !item.id) return; var key = String(item.id); upserts.set(key, item); deleted.delete(key); });
  });
  return { upsert:Array.from(upserts.values()), deleteIds:Array.from(deleted) };
}
function readPendingPatch(key) {
  try { return JSON.parse(localStorage.getItem(key)) || { upsert:[], deleteIds:[] }; } catch (error) { return { upsert:[], deleteIds:[] }; }
}
function patchHasChanges(patch) { return Boolean((patch.upsert || []).length || (patch.deleteIds || []).length); }
var sharedWriteQueue = Promise.resolve();
var cloudWriteQueue = Promise.resolve();
function queueArchivePatch(collection, patch, pendingKey) {
  if (!patchHasChanges(patch)) return Promise.resolve();
  var pending = mergeCollectionPatches(readPendingPatch(pendingKey), patch);
  localStorage.setItem(pendingKey, JSON.stringify(pending));
  sharedWriteQueue = sharedWriteQueue.catch(function () {}).then(async function () {
    var rawPending = localStorage.getItem(pendingKey); if (!rawPending) return;
    var currentPatch = JSON.parse(rawPending); var payload = {};
    payload[collection + 'Patch'] = currentPatch;
    var response = await fetch(ARCHIVE_API_PATH, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload), keepalive:true });
    if (!response.ok) throw new Error('共享存储写入失败（' + response.status + '）');
    var archive = await response.json();
    if (localStorage.getItem(pendingKey) === rawPending) {
      localStorage.removeItem(pendingKey);
      if (Array.isArray(archive[collection])) localStorage.setItem(collection === 'records' ? RECORDS_KEY : NOTES_KEY, JSON.stringify(archive[collection]));
    }
  });
  return sharedWriteQueue.catch(function (error) { console.warn('[MyArchive] Shared file write failed:', error); });
}
function cacheCloudArchive(archive) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(Array.isArray(archive.records) ? archive.records : []));
  localStorage.setItem(NOTES_KEY, JSON.stringify(Array.isArray(archive.notes) ? archive.notes : []));
  var settings = getSettings();
  settings.categories = Array.isArray(archive.categories) ? archive.categories : [];
  saveSettings(settings);
}
function queueCloudCollectionPatch(collection, patch) {
  if (!patchHasChanges(patch)) return Promise.resolve();
  cloudWriteQueue = cloudWriteQueue.catch(function () {}).then(async function () {
    await applyCloudCollectionPatch(collection, patch);
    cacheCloudArchive(await readCloudArchive());
  });
  return cloudWriteQueue;
}
async function saveRecords(records) {
  var previous = readStoredCollection(RECORDS_KEY) || [];
  if (isCloudConfigured()) {
    try { await queueCloudCollectionPatch('records', collectionPatch(previous, records)); }
    catch (error) { showToast(error.message); throw error; }
    return;
  }
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return queueArchivePatch('records', collectionPatch(previous, records), SHARED_RECORDS_PENDING_KEY);
}
function getNotes() {
  try {
    var saved = JSON.parse(localStorage.getItem(NOTES_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) {}
  return [];
}
async function saveNotes(notes) {
  var previous = readStoredCollection(NOTES_KEY) || [];
  if (isCloudConfigured()) {
    try { await queueCloudCollectionPatch('notes', collectionPatch(previous, notes)); }
    catch (error) { showToast(error.message); throw error; }
    return;
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return queueArchivePatch('notes', collectionPatch(previous, notes), SHARED_NOTES_PENDING_KEY);
}
async function readProjectArchive() {
  var response = await fetch(ARCHIVE_API_PATH, { headers:{ Accept:'application/json' }, cache:'no-store' });
  if (!response.ok) throw new Error('本地项目数据读取失败（' + response.status + '）');
  var archive = await response.json();
  return {
    records:Array.isArray(archive.records) ? archive.records : [],
    notes:Array.isArray(archive.notes) ? archive.notes : []
  };
}
async function patchSharedArchive(payload) {
  var response = await fetch(ARCHIVE_API_PATH, { method:'PATCH', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
  if (!response.ok) throw new Error('共享存储迁移失败（' + response.status + '）');
  return response.json();
}
async function syncArchiveFromCloud(localRecords, localNotes) {
  try {
    var migrated = false;
    var migrationState = await readCloudMigrationState();
    if (!migrationState) {
      var projectArchive = await readProjectArchive();
      var cloudArchive = await migrateArchiveToCloud(projectArchive, getSettings().categories || []);
      var cloudRecordIds = new Set(cloudArchive.records.map(function (item) { return String(item.id); }));
      var cloudNoteIds = new Set(cloudArchive.notes.map(function (item) { return String(item.id); }));
      var allRecordsUploaded = projectArchive.records.every(function (item) { return cloudRecordIds.has(String(item.id)); });
      var allNotesUploaded = projectArchive.notes.every(function (item) { return cloudNoteIds.has(String(item.id)); });
      if (!allRecordsUploaded || !allNotesUploaded) {
        throw new Error('云端数据数量与本地不一致，迁移标记未写入');
      }
      migrationState = {
        completedAt:new Date().toISOString(),
        records:projectArchive.records.length,
        notes:projectArchive.notes.length
      };
      await markCloudMigrationComplete(migrationState);
      migrated = true;
    }
    var archive = await readCloudArchive();
    cacheCloudArchive(archive);
    localStorage.setItem(CLOUD_STORAGE_MIGRATION_KEY, JSON.stringify(migrationState));
    localStorage.removeItem(SHARED_RECORDS_PENDING_KEY);
    localStorage.removeItem(SHARED_NOTES_PENDING_KEY);
    migrateLegacyMedia(archive.records).catch(function (error) { console.warn('[MyArchive] Legacy media migration failed:', error); });
    return { ready:true, mode:'cloud', migrated:migrated, records:archive.records.length, notes:archive.notes.length };
  } catch (error) {
    console.warn('[MyArchive] Supabase storage unavailable:', error);
    if (!localRecords) localStorage.setItem(RECORDS_KEY, JSON.stringify(SEED_RECORDS));
    if (!localNotes) localStorage.setItem(NOTES_KEY, '[]');
    return { ready:false, mode:'cloud', error:error };
  }
}
async function syncArchiveFromLocalProject(localRecords, localNotes) {
  try {
    var archive = await readProjectArchive(); var firstMigration = !localStorage.getItem(SHARED_STORAGE_MIGRATION_KEY); var payload = {};
    var recordsPending = readPendingPatch(SHARED_RECORDS_PENDING_KEY); var notesPending = readPendingPatch(SHARED_NOTES_PENDING_KEY);
    if (firstMigration && localRecords) {
      var remoteRecordIds = new Set((archive.records || []).map(function (record) { return String(record.id); }));
      var seedIds = new Set(SEED_RECORDS.map(function (record) { return record.id; }));
      var recordsToMigrate = localRecords.filter(function (record) { return !seedIds.has(record.id) || !archive.records.length || remoteRecordIds.has(String(record.id)); });
      recordsPending = mergeCollectionPatches(recordsPending, { upsert:recordsToMigrate, deleteIds:[] });
    }
    if (firstMigration && localNotes) notesPending = mergeCollectionPatches(notesPending, { upsert:localNotes, deleteIds:[] });
    if (firstMigration && !localRecords && !(archive.records || []).length) recordsPending = mergeCollectionPatches(recordsPending, { upsert:SEED_RECORDS, deleteIds:[] });
    if (patchHasChanges(recordsPending)) payload.recordsPatch = recordsPending;
    if (patchHasChanges(notesPending)) payload.notesPatch = notesPending;
    if (payload.recordsPatch || payload.notesPatch) archive = await patchSharedArchive(payload);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(Array.isArray(archive.records) ? archive.records : []));
    localStorage.setItem(NOTES_KEY, JSON.stringify(Array.isArray(archive.notes) ? archive.notes : []));
    localStorage.removeItem(SHARED_RECORDS_PENDING_KEY); localStorage.removeItem(SHARED_NOTES_PENDING_KEY);
    localStorage.setItem(SHARED_STORAGE_MIGRATION_KEY, JSON.stringify({ completedAt:new Date().toISOString() }));
    migrateLegacyMedia(localRecords || archive.records || []).catch(function (error) { console.warn('[MyArchive] Legacy media migration failed:', error); });
    return { ready:true, mode:'local' };
  } catch (error) {
    console.warn('[MyArchive] Shared file storage unavailable:', error);
    if (!localRecords) localStorage.setItem(RECORDS_KEY, JSON.stringify(SEED_RECORDS));
    if (!localNotes) localStorage.setItem(NOTES_KEY, '[]');
    return { ready:false, mode:'local', error:error };
  }
}
async function syncArchiveFromProject() {
  var localRecords = readStoredCollection(RECORDS_KEY); var localNotes = readStoredCollection(NOTES_KEY);
  if (isCloudConfigured()) return syncArchiveFromCloud(localRecords, localNotes);
  return syncArchiveFromLocalProject(localRecords, localNotes);
}
function localDateKey(value) {
  var date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
function noteDate(note) { return note.date || localDateKey(note.createdAt); }
async function migrateClusteredNotes() {
  if (localStorage.getItem(NOTES_SPREAD_MIGRATION_KEY)) return;
  var notes = getNotes(); var groups = notes.reduce(function (result, note) { var date = noteDate(note); if (date) (result[date] || (result[date] = [])).push(note); return result; }, {}); var clusterDate = Object.keys(groups).sort(function (left, right) { return groups[right].length - groups[left].length; })[0]; var cluster = clusterDate && groups[clusterDate];
  if (!cluster || cluster.length < 4) { localStorage.setItem(NOTES_SPREAD_MIGRATION_KEY, JSON.stringify({ completedAt:new Date().toISOString(), changed:0 })); return; }
  localStorage.setItem(NOTES_SPREAD_BACKUP_KEY, JSON.stringify(notes));
  var base = parseDateKey(clusterDate) || new Date(); var offsets = [1,3,6,10,15,21,29,38,49,62,77,94,113,135,160,188];
  cluster.slice().sort(function (a, b) { return new Date(a.createdAt || 0) - new Date(b.createdAt || 0); }).forEach(function (note, index) { var explicit = explicitDateFromText(note.content, base); var target = explicit ? parseDateKey(explicit.date) : new Date(base.getFullYear(), base.getMonth(), base.getDate() - (offsets[index % offsets.length] + Math.floor(index / offsets.length) * 210)); var date = localDateKey(target); note.date = date; var original = new Date(note.createdAt || base); if (!Number.isFinite(original.getTime())) original = new Date(base); original.setFullYear(target.getFullYear(), target.getMonth(), target.getDate()); note.createdAt = original.toISOString(); });
  await saveNotes(notes); localStorage.setItem(NOTES_SPREAD_MIGRATION_KEY, JSON.stringify({ completedAt:new Date().toISOString(), changed:cluster.length, sourceDate:clusterDate }));
}
function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { categories:[], deepseek:'', glm:'' }; } catch (e) { return { categories:[], deepseek:'', glm:'' }; }
}
const ENV_AI_KEYS = {
  deepseek:String(import.meta.env.VITE_DEEPSEEK_API_KEY || '').trim(),
  glm:String(import.meta.env.VITE_GLM_API_KEY || '').trim()
};
function getAiKeys() {
  var settings = getSettings();
  return {
    deepseek:ENV_AI_KEYS.deepseek || String(settings.deepseek || '').trim(),
    glm:ENV_AI_KEYS.glm || String(settings.glm || '').trim()
  };
}
function saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
async function saveCustomCategories(settings) {
  if (isCloudConfigured()) await upsertCloudCategories(settings.categories || []);
  saveSettings(settings);
}
function allCategories() { return DEFAULT_CATEGORIES.concat(getSettings().categories || []).filter(function (item, index, arr) { return arr.indexOf(item) === index; }); }
function getCurrentPage() { return document.body.dataset.page || 'home'; }
var mediaDbPromise;
function openMediaDb() {
  if (mediaDbPromise) return mediaDbPromise;
  mediaDbPromise = new Promise(function (resolve, reject) {
    var request = indexedDB.open('ji-media-v1', 1);
    request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('uploads')) request.result.createObjectStore('uploads', { keyPath:'id' }); };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () { reject(request.error); };
  });
  return mediaDbPromise;
}
async function storeMedia(file) {
  var item = { id:'media-' + Date.now() + '-' + Math.random().toString(36).slice(2,8), name:file.name, type:file.type || 'application/octet-stream', size:file.size, blob:file };
  try { return await uploadSharedMedia(item); }
  catch (error) {
    console.warn('[MyArchive] Shared media upload failed, using browser storage:', error);
    var db = await openMediaDb();
    await new Promise(function (resolve, reject) { var tx = db.transaction('uploads', 'readwrite'); tx.objectStore('uploads').put(item); tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); }; });
    return { id:item.id, name:item.name, type:item.type, size:item.size };
  }
}
async function uploadSharedMedia(item) {
  var response = await fetch(MEDIA_API_PREFIX + encodeURIComponent(item.id), { method:'PUT', headers:{ 'Content-Type':item.type || 'application/octet-stream', 'X-Archive-File-Name':encodeURIComponent(item.name || item.id) }, body:item.blob });
  if (!response.ok) throw new Error('附件写入失败（' + response.status + '）');
  return response.json();
}
async function getLocalStoredMedia(id) {
  var db = await openMediaDb();
  return new Promise(function (resolve, reject) { var req = db.transaction('uploads', 'readonly').objectStore('uploads').get(id); req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); }; });
}
async function getStoredMedia(id) {
  try {
    var response = await fetch(MEDIA_API_PREFIX + encodeURIComponent(id), { cache:'no-store' });
    if (response.ok) {
      var name = id; try { name = decodeURIComponent(response.headers.get('X-Archive-File-Name') || id); } catch {}
      var blob = await response.blob(); return { id:id, name:name, type:blob.type, size:blob.size, blob:blob };
    }
    if (response.status !== 404) throw new Error('附件读取失败（' + response.status + '）');
  } catch (error) { console.warn('[MyArchive] Shared media read failed:', error); }
  var localItem = await getLocalStoredMedia(id);
  if (localItem && localItem.blob) uploadSharedMedia(localItem).catch(function () {});
  return localItem;
}
async function getMediaUrl(id) {
  var item = await getStoredMedia(id);
  return item && item.blob ? URL.createObjectURL(item.blob) : '';
}
async function deleteMedia(id) {
  if (!id) return;
  try { await fetch(MEDIA_API_PREFIX + encodeURIComponent(id), { method:'DELETE' }); } catch (error) { console.warn('[MyArchive] Shared media delete failed:', error); }
  var db = await openMediaDb();
  await new Promise(function (resolve, reject) { var tx = db.transaction('uploads', 'readwrite'); tx.objectStore('uploads').delete(id); tx.oncomplete = resolve; tx.onerror = function () { reject(tx.error); }; });
}
async function migrateLegacyMedia(records) {
  var attachments = [];
  (records || []).forEach(function (record) {
    (record.files || []).concat(record.photos || []).forEach(function (item) { if (item && typeof item === 'object' && item.id && !attachments.some(function (saved) { return saved.id === item.id; })) attachments.push(item); });
  });
  await Promise.allSettled(attachments.map(async function (attachment) {
    var existing = await fetch(MEDIA_API_PREFIX + encodeURIComponent(attachment.id), { method:'HEAD', cache:'no-store' });
    if (existing.ok) return;
    var localItem = await getLocalStoredMedia(attachment.id);
    if (localItem && localItem.blob) await uploadSharedMedia(localItem);
  }));
}
function showToast(message) {
  var toast = document.getElementById('toast'); if (!toast) return;
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2300);
}

function getCompanionDays(records) {
  var timestamps = records.map(function (record) {
    return Date.parse(record.createdAt || record.date || '');
  }).filter(Number.isFinite);
  if (!timestamps.length) return 1;
  var firstDay = new Date(Math.min.apply(Math, timestamps));
  firstDay.setHours(0, 0, 0, 0);
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today - firstDay) / 86400000) + 1);
}

function navMarkup(active) {
  var items = [
    ['home','home','首页','/'], ['record','pen-line','开始记录','/record'], ['library','library-big','我的记录','/library'], ['chat','message-circle','AI 对话','/chat'], ['notes','notebook-pen','我的随手记','/notes'], ['growth','radar','成长画像','/growth'], ['atlas','orbit','事件星球','/atlas'], ['calendar','calendar-days','日历','/calendar']
  ];
  var html = '<a class="brand" href="/" aria-label="MyArchive 首页"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">MyArchive</span><span class="brand-caption">PERSONAL ARCHIVE</span></a><nav class="sidebar-nav" aria-label="主要导航">';
  items.forEach(function (item) { html += '<a class="nav-item ' + (active === item[0] ? 'active' : '') + '" href="' + item[3] + '" title="' + item[2] + '" aria-label="' + item[2] + '"><span class="nav-icon"><i data-lucide="' + item[1] + '"></i></span><span>' + item[2] + '</span></a>'; });
  html += '</nav>';
  var spaceName = isCloudConfigured() ? '共享云空间' : '本地空间';
  var spaceDetail = isCloudConfigured() ? '云端已连接' : '本机存储';
  html += '<div class="sidebar-foot"><a class="user-mini" href="#" id="sidebar-space"><div class="avatar"><i data-lucide="database"></i></div><div><strong>' + spaceName + '</strong><span>' + spaceDetail + '</span></div><i data-lucide="arrow-right" aria-hidden="true"></i></a></div>';
  return html;
}
function topbarMarkup(active) {
  var labels = { home:'首页', record:'开始记录', chat:'与 AI 对话', atlas:'事件星球', library:'我的记录', notes:'我的随手记', calendar:'日历视图', growth:'个人成长画像', detail:'记录详情', settings:'设置' };
  return '<div class="breadcrumb"><strong>' + (labels[active] || '') + '</strong></div><div class="top-actions"><a class="icon-button top-search" href="/library" title="搜索记录" aria-label="搜索记录"><i data-lucide="search"></i></a><a class="top-record" href="/record"><i data-lucide="plus"></i><span>开始记录</span></a><button class="icon-button" id="top-space" title="数据空间" aria-label="数据空间"><i data-lucide="database"></i></button></div>';
}
function initShell() {
  var page = getCurrentPage();
  var sidebar = document.getElementById('sidebar'); var topbar = document.getElementById('topbar');
  if (sidebar) { sidebar.innerHTML = navMarkup(page); var space = document.getElementById('sidebar-space'); if (space) space.addEventListener('click', function (e) { e.preventDefault(); openStorageStatus(); }); }
  if (topbar) { topbar.innerHTML = topbarMarkup(page); var spaceButton = document.getElementById('top-space'); if (spaceButton) spaceButton.addEventListener('click', openStorageStatus); }
}
function openStorageStatus() {
  var wrap = document.getElementById('global-modals'); if (!wrap) return;
  if (!isCloudConfigured()) {
    wrap.innerHTML = '<div class="overlay open"><div class="modal"><div class="modal-head"><h2>本地空间</h2><button class="close-button" id="close-space" type="button" aria-label="关闭">×</button></div><p>当前未配置云数据库，事件和随手记保存在本机项目中。</p></div></div>';
    document.getElementById('close-space').addEventListener('click', function () { wrap.innerHTML = ''; });
    return;
  }
  wrap.innerHTML = '<div class="overlay open"><div class="modal"><div class="modal-head"><h2>共享云空间</h2><button class="close-button" id="close-space" type="button" aria-label="关闭">×</button></div><p>当前项目使用唯一一套共享数据。</p><div class="cloud-state"><span></span>事件与随手记从 Supabase 读取</div></div></div>';
  document.getElementById('close-space').addEventListener('click', function () { wrap.innerHTML = ''; });
}

function categoryClass(category) {
  if (category === '艺术活动' || category === '体育竞赛') return 'orange';
  if (category === '探索类活动' || category === '研学活动') return 'blue';
  if (category === '学术竞赛' || category === '综合竞赛') return 'yellow';
  return '';
}
function calendarTone(category) {
  if (category === '随手记') return 'note';
  if (/学术|竞赛/.test(category || '')) return 'academic';
  if (/研究|探究|探索|研学/.test(category || '')) return 'research';
  if (/领导|实习/.test(category || '')) return 'leadership';
  if (/艺术/.test(category || '')) return 'art';
  if (/体育/.test(category || '')) return 'sport';
  return 'other';
}
function collectCalendarMarks(records, notes) {
  var marks = {};
  function add(date, tone) { if (!date) return; var item = marks[date] || (marks[date] = { count:0, tones:[] }); item.count += 1; if (item.tones.indexOf(tone) < 0) item.tones.push(tone); }
  (records || []).forEach(function (record) { add(record.date, calendarTone(record.category)); });
  (notes || []).forEach(function (note) { add(noteDate(note), 'note'); });
  return marks;
}
function calendarDots(mark) { return mark ? '<span class="calendar-dot-group" aria-hidden="true">' + mark.tones.slice(0,4).map(function (tone) { return '<i class="calendar-dot ' + tone + '"></i>'; }).join('') + '</span>' : ''; }
function recordCard(record) {
  var firstPhoto = record.photos && record.photos[0]; var cover = typeof firstPhoto === 'string' ? firstPhoto : '';
  var image = cover ? '<div class="record-media" style="background-image:url(\'' + esc(cover) + '\')"></div>' : '';
  return '<a class="record-card" href="/detail?id=' + encodeURIComponent(record.id) + '">' + image + '<div class="record-card-top"><span class="tag ' + categoryClass(record.category) + '">' + esc(record.category || '待分类') + '</span><span class="small-link">打开 ↗</span></div><h3>' + esc(record.title || '未命名经历') + '</h3><p>' + esc(record.aiDescription || record.description || '这段经历还没有描述。') + '</p><div class="record-meta"><span>◷ ' + dateLabel(record.date) + '</span><span>▱ ' + ((record.files || []).length + (record.photos || []).length) + ' 个附件</span></div></a>';
}

function initHome() {
  var records = getRecords();
  var notes = getNotes();
  document.querySelector('[data-stat="total"]').textContent = records.length;
  document.querySelector('[data-stat="days"]').textContent = getCompanionDays(records);
  document.getElementById('recent-records').innerHTML = records.slice().sort(function (a,b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); }).slice(0,4).map(recordCard).join('');
  renderHomeCalendar(records, notes);
  var noteForm = document.getElementById('home-note-form');
  var noteInput = document.getElementById('home-note-input');
  noteForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    var content = noteInput.value.trim();
    if (!content) { showToast('先写下一点想法再保存'); noteInput.focus(); return; }
    var createdAt = new Date();
    var nextNotes = getNotes();
    nextNotes.unshift({ id:'note-' + Date.now(), content:content, date:localDateKey(createdAt), createdAt:createdAt.toISOString() });
    try {
      await saveNotes(nextNotes);
      noteInput.value = '';
      renderHomeCalendar(getRecords(), getNotes());
      showToast('随手记已保存');
    } catch (error) {}
  });
  setupNoteVoice(document.getElementById('home-note-voice'), document.getElementById('home-note-voice-status'), noteInput);
}

function setupNoteVoice(button, status, target) {
  var recorder; var chunks = []; var stream; var startedAt; var clock; var limitTimer;
  button.addEventListener('click', async function () {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { showToast('当前浏览器不支持录音'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      chunks = []; startedAt = Date.now(); recorder = new MediaRecorder(stream);
      recorder.ondataavailable = function (event) { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = async function () {
        clearInterval(clock); clearTimeout(limitTimer); stream.getTracks().forEach(function (track) { track.stop(); }); button.classList.remove('recording'); button.setAttribute('aria-label', '语音转文字');
        var aiKeys = getAiKeys();
        if (!aiKeys.glm) { status.textContent = '请先在设置中填写 GLM Key'; showToast('录音已完成，配置 GLM Key 后可转成文字'); return; }
        try {
          status.textContent = '正在转成文字…';
          var blob = new Blob(chunks, { type:recorder.mimeType || 'audio/webm' });
          var transcript = await transcribeAudioSequentially(aiKeys.glm, await audioBlobToWav(blob), { filename:'quick-note.wav', onProgress:function (index, total) { status.textContent = total > 1 ? '识别第 ' + index + ' / ' + total + ' 段…' : '正在转成文字…'; } });
          target.value = [target.value.trim(), transcript].filter(Boolean).join('\n');
          status.textContent = '已加入文本框'; target.focus();
        } catch (error) { status.textContent = '转写失败'; showToast('语音转写失败：' + error.message); }
      };
      recorder.start(1000); button.classList.add('recording'); button.setAttribute('aria-label', '停止录音'); status.textContent = '正在录音 · 00:00';
      clock = setInterval(function () { var seconds = Math.floor((Date.now() - startedAt) / 1000); status.textContent = '正在录音 · ' + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }, 1000);
      limitTimer = setTimeout(function () { if (recorder.state === 'recording') recorder.stop(); }, 600000);
    } catch (error) { status.textContent = '无法使用麦克风'; showToast('请检查浏览器的麦克风权限'); }
  });
}

function renderHomeCalendar(records, notes) {
  var root = document.getElementById('home-calendar');
  if (!root) return;
  var today = new Date();
  var year = today.getFullYear();
  var month = today.getMonth();
  var monthKey = year + '-' + String(month + 1).padStart(2, '0');
  var marks = collectCalendarMarks(records, notes); var monthMarks = Object.keys(marks).filter(function (date) { return date.indexOf(monthKey) === 0; });
  var firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  var dayCount = new Date(year, month + 1, 0).getDate();
  var cells = Array.from({ length:firstOffset }, function () { return '<span class="calendar-day muted" aria-hidden="true"></span>'; });
  for (var day = 1; day <= dayCount; day += 1) {
    var dateKey = monthKey + '-' + String(day).padStart(2, '0');
    var className = 'calendar-day' + (day === today.getDate() ? ' today' : '') + (marks[dateKey] ? ' has-records' : '');
    var dots = calendarDots(marks[dateKey]);
    cells.push('<a class="' + className + '" href="/calendar?date=' + dateKey + '"' + (day === today.getDate() ? ' aria-current="date"' : '') + '><b>' + day + '</b>' + dots + '</a>');
  }
  root.innerHTML = '<div class="calendar-month"><strong>' + year + '年' + (month + 1) + '月</strong><span>本月 ' + monthMarks.reduce(function (sum, date) { return sum + marks[date].count; }, 0) + ' 条记录</span></div><div class="calendar-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="calendar-grid">' + cells.join('') + '</div>';
}

function fillCategories(select) { select.innerHTML = '<option value="">请先选择</option>' + allCategories().map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join(''); }
function fileList(input, target) {
  target.innerHTML = Array.from(input.files || []).map(function (file) { return '<div class="file-chip"><span>' + esc(file.name) + '</span><span>' + Math.max(1, Math.round(file.size / 1024)) + ' KB</span></div>'; }).join('');
}
function explicitDateFromText(text, referenceDate) {
  var source = String(text || ''); var reference = new Date(referenceDate || Date.now()); reference.setHours(0, 0, 0, 0);
  function validDate(year, month, day, evidence) { var value = new Date(year, month - 1, day); return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day ? { date:localDateKey(value), evidence:evidence } : null; }
  var full = source.match(/((?:19|20)\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*(?:日|号)?/);
  if (full) return validDate(Number(full[1]), Number(full[2]), Number(full[3]), full[0]);
  var lastYear = source.match(/去年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (lastYear) return validDate(reference.getFullYear() - 1, Number(lastYear[1]), Number(lastYear[2]), lastYear[0]);
  var monthDay = source.match(/(?:^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)/);
  if (monthDay) return validDate(reference.getFullYear(), Number(monthDay[1]), Number(monthDay[2]), monthDay[0].trim());
  var offset = /大前天/.test(source) ? -3 : /前天/.test(source) ? -2 : /昨天|昨日/.test(source) ? -1 : null;
  if (offset !== null) { reference.setDate(reference.getDate() + offset); return { date:localDateKey(reference), evidence:offset === -1 ? '昨天' : offset === -2 ? '前天' : '大前天' }; }
  var weekDay = source.match(/上周([一二三四五六日天])/);
  if (weekDay) { var targetDay = '一二三四五六日天'.indexOf(weekDay[1]) + 1; if (targetDay === 7 || targetDay === 8) targetDay = 7; var currentDay = reference.getDay() || 7; reference.setDate(reference.getDate() - currentDay - 7 + targetDay); return { date:localDateKey(reference), evidence:weekDay[0] }; }
  return null;
}
function initRecord() {
  var category = document.getElementById('event-category'); fillCategories(category);
  var dateInput = document.getElementById('event-date'); var descriptionBox = document.getElementById('event-description'); dateInput.value = localDateKey(new Date());
  dateInput.addEventListener('change', function () { dateInput.dataset.userChanged = 'true'; });
  descriptionBox.addEventListener('blur', function () { if (dateInput.dataset.userChanged === 'true') return; var inferred = explicitDateFromText(descriptionBox.value, new Date()); if (inferred) { dateInput.value = inferred.date; dateInput.dataset.textEvidence = inferred.evidence; showToast('已根据“' + inferred.evidence + '”调整活动时间'); } });
  var documentInput = document.getElementById('document-input'); var photoInput = document.getElementById('photo-input');
  documentInput.addEventListener('change', function () { fileList(documentInput, document.getElementById('document-list')); });
  photoInput.addEventListener('change', function () { fileList(photoInput, document.getElementById('photo-list')); });
  document.getElementById('add-category').addEventListener('click', async function () { var name = window.prompt('创建一个新的活动分类'); if (name && name.trim()) { var settings = getSettings(); settings.categories = (settings.categories || []).concat(name.trim()).filter(function (v,i,a) { return a.indexOf(v) === i; }); try { await saveCustomCategories(settings); fillCategories(category); category.value = name.trim(); showToast('已添加自定义分类'); } catch (error) { showToast(error.message); } } });
  var voiceButton = document.getElementById('voice-button'); var voiceStatus = document.getElementById('voice-status'); var captureField = voiceButton.closest('.capture-field'); var voiceLabel = voiceButton.querySelector('span'); var recorder; var voiceChunks = []; var voiceLimitTimer; var voiceClock;
  voiceButton.addEventListener('click', async function () {
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { showToast('当前浏览器不支持录音'); return; }
    try {
      var stream = await navigator.mediaDevices.getUserMedia({ audio:true }); voiceChunks = []; recorder = new MediaRecorder(stream); var startedAt = Date.now();
      recorder.ondataavailable = function (event) { if (event.data.size) voiceChunks.push(event.data); };
      recorder.onstop = async function () { clearTimeout(voiceLimitTimer); clearInterval(voiceClock); stream.getTracks().forEach(function (track) { track.stop(); }); voiceButton.classList.remove('recording'); captureField.classList.remove('is-recording'); voiceLabel.textContent = '开始语音记录'; voiceButton.setAttribute('aria-label', '开始录音'); var aiKeys = getAiKeys(); if (!aiKeys.glm) { voiceStatus.textContent = '录音已完成 · 请先在设置中填入 GLM Key 以识别'; return; } try { voiceStatus.textContent = '正在转换录音…'; var blob = new Blob(voiceChunks, { type:recorder.mimeType || 'audio/webm' }); var wavBlob = await audioBlobToWav(blob); var transcript = await transcribeAudioSequentially(aiKeys.glm, wavBlob, { onProgress:function (index, total) { voiceStatus.textContent = total > 1 ? '正在按顺序识别第 ' + index + ' / ' + total + ' 段…' : '正在识别录音…'; } }); descriptionBox.value = [descriptionBox.value, transcript].filter(Boolean).join('\n'); voiceStatus.textContent = '识别完成 · 已按原顺序加入文字'; descriptionBox.dispatchEvent(new Event('blur')); } catch (error) { voiceStatus.textContent = '识别失败：' + error.message; } };
      recorder.start(1000); voiceButton.classList.add('recording'); captureField.classList.add('is-recording'); voiceLabel.textContent = '停止并识别'; voiceButton.setAttribute('aria-label', '停止录音并识别'); voiceStatus.textContent = '正在录音 · 00:00 / 10:00'; voiceClock = setInterval(function () { var seconds = Math.floor((Date.now() - startedAt) / 1000); var min = String(Math.floor(seconds / 60)).padStart(2,'0'); var sec = String(seconds % 60).padStart(2,'0'); voiceStatus.textContent = '正在录音 · ' + min + ':' + sec + ' / 10:00'; }, 1000); voiceLimitTimer = setTimeout(function () { if (recorder.state === 'recording') recorder.stop(); }, 600000);
    } catch (error) { voiceButton.classList.remove('recording'); captureField.classList.remove('is-recording'); voiceLabel.textContent = '开始语音记录'; voiceStatus.textContent = '无法使用麦克风，请检查浏览器权限'; }
  });
  document.getElementById('record-form').addEventListener('submit', function (e) { e.preventDefault(); submitRecord(); });
}
async function audioBlobToWav(blob) {
  var AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error('当前浏览器无法转换录音格式');
  var audioContext = new AudioContextClass();
  try {
    var sourceBuffer = await blob.arrayBuffer(); var decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0)); var targetRate = 16000; var sourceRate = decoded.sampleRate; var outputLength = Math.max(1, Math.floor(decoded.length * targetRate / sourceRate)); var samples = new Float32Array(outputLength); var channels = [];
    for (var channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) channels.push(decoded.getChannelData(channelIndex));
    for (var i = 0; i < outputLength; i += 1) { var sourcePosition = i * sourceRate / targetRate; var left = Math.floor(sourcePosition); var right = Math.min(left + 1, decoded.length - 1); var mix = 0; for (var c = 0; c < channels.length; c += 1) mix += channels[c][left] + (channels[c][right] - channels[c][left]) * (sourcePosition - left); samples[i] = mix / channels.length; }
    var wavBuffer = new ArrayBuffer(44 + samples.length * 2); var view = new DataView(wavBuffer); writeWavString(view, 0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeWavString(view, 8, 'WAVE'); writeWavString(view, 12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, targetRate, true); view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); writeWavString(view, 36, 'data'); view.setUint32(40, samples.length * 2, true);
    for (var sampleIndex = 0; sampleIndex < samples.length; sampleIndex += 1) { var sample = Math.max(-1, Math.min(1, samples[sampleIndex])); view.setInt16(44 + sampleIndex * 2, sample < 0 ? sample * 32768 : sample * 32767, true); }
    return new Blob([wavBuffer], { type:'audio/wav' });
  } finally { await audioContext.close(); }
}
function writeWavString(view, offset, value) { for (var i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i)); }
function fileToDataUrl(file) { return new Promise(function (resolve, reject) { var reader = new FileReader(); reader.onload = function () { resolve(reader.result); }; reader.onerror = function () { reject(reader.error); }; reader.readAsDataURL(file); }); }
function parseModelJson(raw) { var value = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim(); return JSON.parse(value); }
function localRetrievalSummary(description, photoInsights) {
  var source = String(description || '').trim();
  var cleaned = source.replace(/这几天去逛/g, '近日参观').replace(/这个事情吧[，,]?/g, '').replace(/这个车的话/g, '该车辆').replace(/然后/g, '随后').replace(/我们/g, '参与团队').replace(/我去跟([^，。]+)聊了一下/g, '记录者与$1进行了交流').replace(/如果我长大了有钱了我估计会买/g, '记录者表示未来经济条件允许时可能购买').replace(/我感觉我是非常喜欢/g, '记录者非常喜欢').replace(/我/g, '记录者').replace(/(^|[，。！？\s])嗯+[，。！？\s]*/g, '$1').replace(/呃/g, '').replace(/啊([，。])/g, '$1').replace(/\s+/g, ' ').trim();
  if (cleaned && !/[。！？]$/.test(cleaned)) cleaned += '。';
  var visual = (photoInsights || []).filter(Boolean).join('；');
  if (!cleaned && visual) cleaned = '照片资料显示：' + visual + '。';
  else if (cleaned && visual) cleaned += '照片资料补充：' + visual + '。';
  if (!cleaned) cleaned = '该事件目前仅保存了附件资料，尚未形成可确认的文字事实摘要。';
  return cleaned.slice(0, 500);
}
function inferCategoryFromText(description) { if (/比赛|竞赛|获奖|赛题/.test(description)) return '综合竞赛'; if (/研究|实验|论文|调研/.test(description)) return '研究和探究'; if (/社团|主席|负责人|负责|组织|主持|协调|带领|志愿者/.test(description)) return '领导力活动'; if (/展览|车展|参观|体验/.test(description)) return '探索类活动'; if (/绘画|音乐|戏剧|艺术/.test(description)) return '艺术活动'; return '随手记'; }
async function generateEventSynthesis(input) {
  var aiKeys = getAiKeys(); var analyses = []; var photoInsights = [];
  if (input.description && aiKeys.deepseek) {
    try { var textResult = await analyzeTextWithDeepSeek(aiKeys.deepseek, '独立分析以下原始事件记录。提取可确认的时间、地点、人物、对象、行动、结果、感受、意向和不确定信息；不要评价学生。只输出 JSON。\n' + input.description); analyses.push({ type:'text', result:parseModelJson(textResult) }); } catch (error) { analyses.push({ type:'text', result:input.description, warning:'文字独立分析失败：' + error.message }); }
  } else if (input.description) analyses.push({ type:'text', result:input.description });
  if (aiKeys.glm) {
    for (var photoIndex = 0; photoIndex < input.photos.length; photoIndex += 1) {
      try { var dataUrl = await fileToDataUrl(input.photos[photoIndex]); var photoResult = await analyzeMediaWithGlm(aiKeys.glm, { prompt:'只描述这张活动照片中可见的事实：场景、人物、物品、文字和动作。不要推断身份、品牌或事件结果；不确定内容要明确说明。', dataUrl:dataUrl }); photoInsights.push(photoResult); analyses.push({ type:'photo', name:input.photos[photoIndex].name, result:photoResult }); } catch (error) { analyses.push({ type:'photo', name:input.photos[photoIndex].name, warning:'照片分析失败：' + error.message }); }
    }
  }
  input.documents.forEach(function (document) { analyses.push({ type:'document', name:document.name, note:'文件已保存，当前摘要仅使用文件名作为检索线索' }); });
  var fallbackDescription = localRetrievalSummary(input.description, photoInsights); var fallback = { title:input.title || fallbackDescription.replace(/[。！？].*$/, '').slice(0, 28) || '一段新的经历', category:input.category || inferCategoryFromText(input.description), date:input.date || localDateKey(new Date()), aiDescription:fallbackDescription, keywords:[], uncertainties:[] };
  if (!aiKeys.deepseek) return fallback;
  try {
    var raw = await synthesizeEventForRetrieval(aiKeys.deepseek, { title:input.title, category:input.category, date:input.date, dateSource:input.dateSource, description:input.description, categories:allCategories() }, analyses); var parsed = parseModelJson(raw); var allowedCategories = allCategories(); return { title:String(parsed.title || fallback.title).trim(), category:allowedCategories.indexOf(parsed.category) >= 0 ? parsed.category : fallback.category, date:input.date, aiDescription:String(parsed.aiDescription || fallback.aiDescription).trim(), keywords:Array.isArray(parsed.keywords) ? parsed.keywords.slice(0,12) : [], uncertainties:Array.isArray(parsed.uncertainties) ? parsed.uncertainties.filter(function (item) { return !/时间|日期/.test(item); }) : fallback.uncertainties };
  } catch (error) { showToast('AI 摘要生成失败，已保存事实型本地摘要'); return fallback; }
}
function submitRecord() {
  var title = document.getElementById('event-title').value.trim(); var category = document.getElementById('event-category').value; var dateField = document.getElementById('event-date'); var description = document.getElementById('event-description').value.trim(); var inferredDate = explicitDateFromText(description, new Date()); if (dateField.dataset.userChanged !== 'true' && inferredDate) { dateField.value = inferredDate.date; dateField.dataset.textEvidence = inferredDate.evidence; } var date = dateField.value || localDateKey(new Date()); var dateSource = dateField.dataset.userChanged === 'true' ? 'manual' : dateField.dataset.textEvidence ? 'text' : 'default-today'; var docs = Array.from(document.getElementById('document-input').files || []); var photos = Array.from(document.getElementById('photo-input').files || []);
  if (!description && !docs.length && !photos.length) { showToast('请至少添加一份文件、一张照片或一段文字描述'); document.getElementById('event-description').focus(); return; }
  document.getElementById('form-content').style.display = 'none'; document.getElementById('analysis-progress').classList.add('show');
  var progress = Array.from(document.querySelectorAll('.progress-step')); progress.forEach(function (step) { step.className = 'progress-step'; });
  var current = 0;
  function advance() { if (current > 0) { progress[current - 1].classList.remove('running'); progress[current - 1].classList.add('done'); progress[current - 1].querySelector('.step-status').textContent = '✓'; } if (current < progress.length) { progress[current].classList.add('running'); current += 1; setTimeout(advance, 670); } else { finish(); } }
  async function finish() { var lastStep = progress[progress.length - 1]; lastStep.classList.remove('done'); lastStep.classList.add('running'); lastStep.querySelector('.step-status').textContent = '…'; try { var synthesis = await generateEventSynthesis({ title:title, category:category, date:date, dateSource:dateSource, description:description, documents:docs, photos:photos }); var storedDocs = await Promise.all(docs.map(storeMedia)); var storedPhotos = await Promise.all(photos.map(storeMedia)); var record = { id:'r-' + Date.now(), title:synthesis.title, category:synthesis.category, date:synthesis.date, description:description || '已上传资料，等待补充文字描述。', aiDescription:synthesis.aiDescription, keywords:synthesis.keywords, uncertainties:synthesis.uncertainties, files:storedDocs, photos:storedPhotos, createdAt:new Date().toISOString(), needsDate:false }; var records = getRecords(); records.unshift(record); await saveRecords(records); lastStep.classList.remove('running'); lastStep.classList.add('done'); lastStep.querySelector('.step-status').textContent = '✓'; document.getElementById('success-note').textContent = dateSource === 'text' ? '已根据文字线索确定日期，并生成标题、分类与事实摘要。' : '标题、分类与事实摘要已经生成。'; document.getElementById('success-panel').classList.add('show'); document.getElementById('view-created').href = '/detail?id=' + encodeURIComponent(record.id); } catch (error) { lastStep.classList.remove('running'); document.getElementById('success-note').textContent = '记录创建失败：' + error.message; document.getElementById('success-panel').classList.add('show'); } }
  advance();
}

function initLibrary() {
  var grid = document.getElementById('library-grid'); var search = document.getElementById('library-search'); var filterWrap = document.getElementById('category-filters'); var active = new Set();
  var cats = allCategories(); filterWrap.innerHTML = '<button class="filter-chip active" data-filter="all">全部</button>' + cats.map(function (c) { return '<button class="filter-chip" data-filter="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  function render() { var query = search.value.trim().toLowerCase(); var records = getRecords().filter(function (r) { var text = [r.title,r.description,r.aiDescription,r.category].join(' ').toLowerCase(); var matchesQuery = !query || text.indexOf(query) >= 0; var matchesFilter = !active.size || active.has(r.category); return matchesQuery && matchesFilter; }); document.getElementById('library-count').textContent = records.length; document.getElementById('active-filter-note').textContent = active.size ? '已筛选 ' + Array.from(active).join('、') : ''; grid.innerHTML = records.length ? records.map(recordCard).join('') : '<div class="empty-state"><h3>还没有匹配的经历</h3><p>换个关键词或取消筛选，看看是否能找到它。</p><a class="btn btn-secondary" href="/record">记录一段新经历</a></div>'; }
  filterWrap.addEventListener('click', function (e) { var button = e.target.closest('[data-filter]'); if (!button) return; var filter = button.dataset.filter; if (filter === 'all') { active.clear(); } else if (active.has(filter)) { active.delete(filter); } else { active.add(filter); } Array.from(filterWrap.children).forEach(function (b) { b.classList.toggle('active', b.dataset.filter === 'all' ? !active.size : active.has(b.dataset.filter)); }); render(); });
  search.addEventListener('input', render); render();
}

function initNotes() {
  var notes = getNotes().slice().sort(function (a, b) { return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0); });
  document.getElementById('notes-count').textContent = notes.length;
  var list = document.getElementById('notes-list');
  if (!notes.length) {
    list.innerHTML = '<div class="notes-empty"><i data-lucide="notebook-pen"></i><h2>还没有随手记</h2><p>你在首页留下的念头，会按时间出现在这里。</p></div>';
    return;
  }
  list.innerHTML = notes.map(function (note) {
    var created = new Date(note.createdAt || note.date || Date.now());
    var day = String(created.getMonth() + 1).padStart(2, '0') + '.' + String(created.getDate()).padStart(2, '0');
    var detail = created.getFullYear() + '年 · ' + ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][created.getDay()] + ' · ' + created.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false });
    return '<article class="note-entry"><time datetime="' + esc(note.createdAt || note.date || '') + '"><strong>' + day + '</strong><span>' + detail + '</span></time><div class="note-entry-body">' + esc(note.content) + '</div></article>';
  }).join('');
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  var bits = value.split('-').map(Number); var date = new Date(bits[0], bits[1] - 1, bits[2]);
  return localDateKey(date) === value ? date : null;
}
function fullDateLabel(date) {
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日 · ' + ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][date.getDay()];
}
function initCalendar() {
  var queryDate = parseDateKey(new URLSearchParams(location.search).get('date'));
  var selected = queryDate || new Date(); selected.setHours(0, 0, 0, 0);
  var monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
  var records = getRecords(); var notes = getNotes();
  var monthLabel = document.getElementById('calendar-month-label'); var grid = document.getElementById('calendar-grid');
  function renderMonth() {
    var year = monthCursor.getFullYear(); var month = monthCursor.getMonth(); var marks = collectCalendarMarks(records, notes);
    monthLabel.textContent = year + '年' + (month + 1) + '月';
    var offset = (new Date(year, month, 1).getDay() + 6) % 7;
    var firstCell = new Date(year, month, 1 - offset); var todayKey = localDateKey(new Date()); var selectedKey = localDateKey(selected); var cells = [];
    for (var index = 0; index < 42; index += 1) {
      var cellDate = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + index); var key = localDateKey(cellDate);
      var classes = ['calendar-date'];
      if (cellDate.getMonth() !== month) classes.push('outside');
      if (key === todayKey) classes.push('today');
      if (key === selectedKey) classes.push('selected');
      if (marks[key]) classes.push('has-records');
      cells.push('<button class="' + classes.join(' ') + '" type="button" data-calendar-date="' + key + '" aria-label="' + fullDateLabel(cellDate) + (marks[key] ? '，有 ' + marks[key].count + ' 条记录' : '') + '"' + (key === selectedKey ? ' aria-pressed="true"' : '') + '><span class="calendar-number">' + cellDate.getDate() + '</span>' + calendarDots(marks[key]) + '</button>');
    }
    grid.innerHTML = cells.join('');
  }
  function renderAgenda() {
    var selectedKey = localDateKey(selected);
    var dayRecords = records.filter(function (record) { return record.date === selectedKey; }).sort(function (a, b) { return new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date); });
    var dayNotes = notes.filter(function (note) { return noteDate(note) === selectedKey; }).sort(function (a, b) { return new Date(a.createdAt || a.date) - new Date(b.createdAt || b.date); });
    document.getElementById('agenda-date').textContent = fullDateLabel(selected);
    document.getElementById('agenda-count').textContent = dayRecords.length + ' 个事件';
    document.getElementById('agenda-events').innerHTML = dayRecords.length ? dayRecords.map(function (record) {
      var firstPhoto = record.photos && record.photos[0]; var cover = typeof firstPhoto === 'string' ? '<div class="agenda-event-cover" style="background-image:url(\'' + esc(firstPhoto) + '\')"></div>' : '';
      return '<a class="agenda-event" href="/detail?id=' + encodeURIComponent(record.id) + '"><span class="agenda-event-dot ' + calendarTone(record.category) + '"></span><div class="agenda-event-copy"><div class="agenda-event-meta"><span>当天</span><span class="tag ' + categoryClass(record.category) + '">' + esc(record.category || '待分类') + '</span></div><h4>' + esc(record.title || '未命名经历') + '</h4><p>' + esc(record.aiDescription || record.description || '这段经历还没有描述。') + '</p><small>查看详情 <span aria-hidden="true">→</span></small></div>' + cover + '</a>';
    }).join('') : '<p class="agenda-empty">当日无记录事件</p>';
    document.getElementById('agenda-notes').innerHTML = dayNotes.length ? dayNotes.map(function (note) { var created = new Date(note.createdAt || note.date); return '<article class="agenda-note"><time>' + created.toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false }) + '</time><p>' + esc(note.content) + '</p></article>'; }).join('') : '<p class="agenda-empty">当日无随手记</p>';
    history.replaceState(null, '', '/calendar?date=' + selectedKey);
  }
  function render() { renderMonth(); renderAgenda(); }
  grid.addEventListener('click', function (event) { var button = event.target.closest('[data-calendar-date]'); if (!button) return; selected = parseDateKey(button.dataset.calendarDate); monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1); render(); });
  document.getElementById('calendar-prev').addEventListener('click', function () { monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1); renderMonth(); });
  document.getElementById('calendar-next').addEventListener('click', function () { monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1); renderMonth(); });
  document.getElementById('calendar-today').addEventListener('click', function () { selected = new Date(); selected.setHours(0, 0, 0, 0); monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1); render(); });
  render();
}

function getChatMessages() { try { var m = JSON.parse(sessionStorage.getItem(CHAT_KEY)); if (Array.isArray(m)) return m; } catch (e) {} return []; }
function saveChatMessages(messages) { sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages)); }
function lastChatContext(messages) { for (var i = messages.length - 1; i >= 0; i -= 1) if (messages[i].context) return messages[i].context; return { mode:'chat' }; }
var chatReferenceIds = [];
function isGreeting(query) { return /^(你好|嗨|hello|hi|早上好|晚上好|在吗|哈喽)[！!。．,.，\s]*$/i.test(query.trim()); }
function wantsArchive(query) { return /找|推荐|筛选|匹配|回顾|经历库|活动记录|哪条|哪些经历|文书|简历|面试|改写|总结我的/.test(query); }
function hasTheme(query) { return /领导|团队|协作|冲突|研究|探索|坚持|突破|创造力|沟通|责任|压力|成长|独立|解决问题|组织/.test(query); }
function detectScenario(query) { if (/简历|bullet|resume/i.test(query)) return '简历'; if (/面试/.test(query)) return '面试'; if (/申请|文书|essay|个人陈述/i.test(query)) return '申请文书'; if (/入团|入党/.test(query)) return '入团入党材料'; return ''; }
function topicText(query) { var words = query.match(/领导力|团队协作|团队合作|解决冲突|研究能力|探索精神|突破舒适区|沟通能力|责任感|抗压|创造力|独立性/); return words ? words[0] : ''; }
function wantsNewRecord(query) {
  var source = String(query || '').trim();
  return /(?:新建|创建|新增|添加|录入)(?:一条|一个|这段|这次)?(?:新的?)?(?:事件|经历|活动|记录)/.test(source)
    || /(?:想|希望|打算|要|请|麻烦|帮我|能不能|可以).{0,20}(?:把|将)?(?:它|他|这件事|这次活动|这段经历|这个活动)?(?:记录|记下|存下)(?:下来|一下|进经历库|到经历库)?/.test(source)
    || /(?:把|将).{1,80}(?:记录|记下|存下)(?:来|进经历库|到经历库)/.test(source)
    || /(?:加入|放进|保存到|存进)(?:我的)?(?:经历库|事件记录)/.test(source);
}
function confirmsFormalRecord(query) { return /^(?:好的?[，,]?)?(?:作为)?(?:一条)?正式(?:经历|事件|记录)(?:吧|就好|就可以)?[。！!\s]*$/.test(String(query || '').trim()); }
function wantsToFinishRecord(query) { return /就这些|先这样|直接保存|保存吧|创建吧|不想再聊|不补充|没有了|没了|到这里/.test(query); }
function wantsToCancelRecord(query) { return /算了|取消(?:记录|创建)|不记录了|别保存/.test(query); }
function documentFormatFromQuery(query) { if (/pdf/i.test(query)) return 'pdf'; if (/word|docx|文档文件/i.test(query)) return 'word'; return ''; }
function recentRecordRequest(messages) {
  for (var i = messages.length - 1; i >= Math.max(0, messages.length - 8); i -= 1) {
    if (messages[i].role === 'user' && wantsNewRecord(messages[i].text || '')) return messages[i].text;
  }
  return '';
}
function cleanRecordDetail(query) {
  var detail = String(query || '').trim();
  detail = detail.replace(/^(?:好的?[，,]?|可以[，,]?|请|麻烦)?(?:你)?(?:帮我)?(?:新建|创建|新增|添加|记下|记录下|存下|录入)(?:一条|一个|这段|这次)?(?:新的?)?(?:事件|经历|活动|记录)?[：:，,\s]*/, '');
  detail = detail.replace(/[，,。；;\s]*(?:我)?(?:想|希望|打算|要)?(?:请你|让你|你能|帮我)?(?:把|将)?(?:它|他|这件事|这次活动|这段经历|这个活动)?(?:记录|记下|存下)(?:下来|一下|进经历库|到经历库)?(?:吧|好吗|可以吗)?[。！!\s]*$/, '');
  if (confirmsFormalRecord(detail) || /^(?:好的?|可以|行|嗯|不知道|不记得|记不清|没有|没什么)[。！!\s]*$/.test(detail)) return '';
  return detail.trim();
}
function mergeChatRecordDraft(query, previous) {
  var draft = Object.assign({ title:'', category:'', date:'', description:'', turns:0, completedStages:[] }, previous || {}); var clean = String(query || '').trim();
  var named = clean.match(/(?:标题是|叫作|叫做|名为)[“「]?([^”，。；」\n]{2,40})/); if (named) draft.title = named[1].trim();
  var explicit = explicitDateFromText(clean, new Date()); if (explicit) draft.date = explicit.date;
  var detail = cleanRecordDetail(clean);
  if (!wantsToFinishRecord(clean) && detail) draft.description = [draft.description, detail].filter(Boolean).join('\n');
  if (!draft.category || draft.category === '随手记') draft.category = inferCategoryFromText(draft.description);
  if (!draft.title && draft.description) { var eventName = draft.description.match(/(?:我|我们)?(?:今天|昨天|前天)?(?:参加|参与|去了|听了|参观)(?:了)?(?:一个|一次|一场)?([^，。；\n]{2,24})/); var actionName = draft.description.match(/负责([^，。；\n]{2,20})/); if (eventName) draft.title = eventName[1].trim() + (actionName ? '：' + actionName[1].trim() : ''); }
  draft.turns += 1;
  return draft;
}
function recordSubject(draft) {
  if (draft.title) return draft.title.split('：')[0].slice(0, 28);
  var match = draft.description.match(/(?:参加|参与|去了|听了|参观)(?:了)?(?:一个|一次|一场)?([^，。；\n]{2,28})/);
  return match ? match[1].trim() : '';
}
function recordHasFocus(draft) { return draft.description.length >= 42 || /(?:主要|主题|内容|围绕|讲了|分享到|提到|讨论|介绍|展示|案例|最有印象|印象最深)/.test(draft.description); }
function recordHasParticipation(draft) {
  var role = '(?:听众|观众|参会者|成员|志愿者|主持人|组织者|分享者)';
  var action = '(?:负责|提出|提问|分享了|交流了|尝试|试着|完成|制作|组织|协调|解决|实践了|操作|展示|回答|带领|查找|整理|记录了)';
  return new RegExp('(?:我|我们)(?:(?:是|作为|担任).{0,14}' + role + '|(?:在|当时|现场|还|也|主要|随后|后来|其中|跟着|向|和|与)[^。；\\n]{0,44}' + action + '|' + action + ')').test(draft.description)
    || new RegExp('(?:作为|担任).{0,10}' + role).test(draft.description);
}
function recordHasReflection(draft) { return /(?:最后|最终|结果|收获|学到|发现|意识到|明白|感受|觉得|启发|之后|后来|接下来|准备|打算|决定|让我|对我|获得|成功)/.test(draft.description); }
function recordDraftIsDetailed(draft) { return draft.description.length >= 58 && recordHasFocus(draft) && recordHasParticipation(draft) && recordHasReflection(draft); }
function nextRecordStage(draft) {
  var completed = new Set(draft.completedStages || []);
  if (draft.description.length < 18 && !completed.has('scene')) return 'scene';
  if (!recordHasFocus(draft) && !completed.has('focus')) return 'focus';
  if (!recordHasParticipation(draft) && !completed.has('participation')) return 'participation';
  if (!recordHasReflection(draft) && !completed.has('reflection')) return 'reflection';
  if (draft.description.length < 72 && !completed.has('detail')) return 'detail';
  return '';
}
function recordGuidance(stage, draft, active) {
  var subject = recordSubject(draft); var label = subject ? '“' + subject + '”' : '这段经历';
  if (stage === 'scene') return '当然可以。我们慢慢整理，不用一次把所有信息都想全。先从事情本身开始：这是一次什么活动，当时大概发生了什么？';
  if (stage === 'focus') return (active ? '好，我已经记下事情的开头。' : '好，我们慢慢把' + label + '整理成一条正式经历，不用一次把所有信息都想全。') + '先从你最有印象的部分说起：当时主要聊了什么，哪一点让你现在还记得？';
  if (stage === 'participation') return '这部分我先记下了。接下来只聊你在现场的参与：除了到场参加，你有没有提问、交流、动手尝试，或者做过什么特别的记录？';
  if (stage === 'reflection') return '明白，这样你在' + label + '里的参与就清楚多了。最后想听听它对你的影响：你带走了什么新认识，或者之后想继续做什么？';
  return '已经很接近一条完整记录了。再补一个最具体的现场片段就好：有没有一句话、一个例子或一个瞬间，让你印象特别深？';
}
function recordConversationStep(query, messages) {
  var context = lastChatContext(messages); var active = context.mode === 'create-record'; var seed = wantsNewRecord(query) ? query : confirmsFormalRecord(query) ? recentRecordRequest(messages) : '';
  if (!active && !seed) return null;
  if (active && wantsToCancelRecord(query)) return { text:'好的，这次不会创建记录。我们可以继续聊别的内容。', context:{ mode:'chat' } };
  var draft = mergeChatRecordDraft(active ? query : seed, active ? context.draft : null);
  if (active && context.stage && draft.completedStages.indexOf(context.stage) < 0) draft.completedStages.push(context.stage);
  var finish = wantsToFinishRecord(query) || recordDraftIsDetailed(draft) || (active && draft.turns >= 5 && draft.description.length >= 24);
  if (finish && draft.description) return { draft:draft, shouldCreate:true };
  var stage = nextRecordStage(draft);
  if (!stage && draft.description) return { draft:draft, shouldCreate:true };
  return { text:recordGuidance(stage || 'scene', draft, active), context:{ mode:'create-record', stage:stage || 'scene', draft:draft } };
}
async function createRecordFromChat(draft) {
  var date = draft.date || localDateKey(new Date()); var dateSource = draft.date ? 'text' : 'default-today';
  var synthesis = await generateEventSynthesis({ title:draft.title, category:draft.category, date:date, dateSource:dateSource, description:draft.description, documents:[], photos:[] });
  var record = { id:'chat-' + Date.now(), title:synthesis.title, category:synthesis.category, date:date, description:draft.description, aiDescription:synthesis.aiDescription, keywords:synthesis.keywords, uncertainties:synthesis.uncertainties, files:[], photos:[], createdAt:new Date().toISOString(), needsDate:false, createdVia:'chat' };
  var records = getRecords(); records.unshift(record); await saveRecords(records); return record;
}
function artifactFromRecords(format, query, recordIds, reply) {
  var records = recordIds.map(function (id) { return getRecords().find(function (record) { return record.id === id; }); }).filter(Boolean);
  var title = records.length === 1 ? records[0].title : records.length > 1 ? '经历整理与对比' : 'MyArchive 对话整理';
  var sections = records.map(function (record, index) { return (index + 1) + '. ' + record.title + '\n日期：' + dateLabel(record.date) + '\n分类：' + (record.category || '待分类') + '\n\n' + (record.aiDescription || record.description || ''); });
  var content = sections.length ? title + '\n\n' + sections.join('\n\n') : title + '\n\n需求：' + query + '\n\n' + reply;
  return { format:format, title:title, content:content };
}
function localArchiveMatches(query, context) {
  var records = getRecords(); var combined = [query, context.scenario || '', context.theme || ''].join(' ').toLowerCase(); var categoryHints = [];
  if (/领导|团队|协作|冲突|沟通|责任/.test(combined)) categoryHints = ['领导力活动','研究和探究'];
  else if (/研究|探索/.test(combined)) categoryHints = ['研究和探究','探索类活动'];
  else if (/艺术|创造/.test(combined)) categoryHints = ['艺术活动'];
  var matches = records.filter(function (record) { var text = [record.title,record.category,record.description,record.aiDescription,(record.keywords || []).join(' ')].join(' ').toLowerCase(); return (categoryHints.length && categoryHints.indexOf(record.category) >= 0) || text.indexOf(combined.trim()) >= 0; });
  if (!matches.length) matches = records.slice(0, Math.min(3, records.length));
  return matches.slice(0,3);
}
function makeLocalReply(query, messages, selectedRecordIds) {
  var q = query.trim(); var lower = q.toLowerCase(); var context = lastChatContext(messages); var scenario = context.scenario || detectScenario(q); var theme = context.theme || topicText(q); var switchesToChat = /我想聊|先聊|另外|其实|焦虑|迷茫|今天|最近|谢谢|再见/.test(q) && !wantsArchive(q); var archiveIntent = wantsArchive(q) || (context.mode === 'retrieval' && !switchesToChat); var format = documentFormatFromQuery(q);
  if (format) { var sourceIds = (selectedRecordIds || []).slice(); if (!sourceIds.length) sourceIds = localArchiveMatches(q, context).map(function (record) { return record.id; }); var reply = '已经按你的要求整理好' + (format === 'word' ? ' Word 文档' : ' PDF 文件') + '，可以在下方直接下载。'; return { text:reply, recs:sourceIds, artifact:artifactFromRecords(format, q, sourceIds, reply), context:{ mode:'document' } }; }
  if (isGreeting(q)) return { text:'你好！今天过得怎么样？我们可以聊学校、活动、最近的困惑，或者一起慢慢整理一段经历。你不用一开始就把需求说完整。', context:{ mode:'chat' } };
  if (/你能做什么|怎么用|你是谁|可以聊什么/.test(lower)) return { text:'我可以陪你进行普通对话，也可以在你准备文书、简历、面试或材料时，从经历库里找记录、阅读详情并帮你改写。你可以先告诉我发生了什么，我会通过几轮对话慢慢理解你想要的结果。', context:{ mode:'chat' } };
  if (/谢谢|感谢|再见|拜拜/.test(lower)) return { text:'不客气。你想到新的细节时，随时可以回来接着聊。', context:{ mode:'chat' } };
  if (/随手记|最近.*想法|之前.*想法|我写过什么/.test(q) && getNotes().length) {
    var recentNotes = getNotes().slice().sort(function (a, b) { return new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date); }).slice(0, 3);
    return { text:'我会把你的随手记也放进理解范围。最近留下的内容包括：\n' + recentNotes.map(function (note) { return '“' + note.content.slice(0, 80) + (note.content.length > 80 ? '…' : '') + '”'; }).join('\n') + '\n你想先从哪一条继续聊？', context:{ mode:'chat' } };
  }
  if (/焦虑|迷茫|难过|压力|累|烦/.test(lower) && !archiveIntent) return { text:'听起来你最近有点辛苦。你愿意先说说，最让你卡住的是学业、活动安排，还是对下一步方向的不确定？', context:{ mode:'chat', support:true } };
  if (archiveIntent) {
    if (!scenario && !theme && /找|推荐|筛选|经历库|哪些/.test(q)) return { text:'可以。你想把这些经历用在什么场景？比如申请文书、简历、面试，或者只是想回顾自己这一阶段的变化？', context:{ mode:'retrieval', stage:'scenario' } };
    if (scenario && !theme && context.stage !== 'done') return { text:'明白了，是' + scenario + '。你更想突出哪一面？例如团队协作、领导力、解决冲突、研究能力，或者某个具体的成长变化？', context:{ mode:'retrieval', stage:'theme', scenario:scenario } };
    var matches = localArchiveMatches(q, { scenario:scenario, theme:theme }); var framing = scenario ? '为' + scenario + '准备' : '回顾自己的经历'; var focus = theme ? '，重点看“' + theme + '”' : '';
    return { text:'明白了，你是在' + framing + focus + '。我先找到 ' + matches.length + ' 条比较贴近的记录。你可以先点开看看，之后告诉我哪一条最像你想讲的故事，我再继续帮你改写或追问细节。', recs:matches.map(function (r) { return r.id; }), context:{ mode:'retrieval', stage:'done', scenario:scenario, theme:theme } };
  }
  return { text:'我听到了。你可以继续把事情说下去，不需要马上整理成“正确的问题”。如果你愿意，我也可以帮你把刚才的想法拆成：发生了什么、你做了什么、你现在真正想得到什么。', context:{ mode:'chat' } };
}
async function getChatReply(query, messages, selectedRecordIds) {
  var creation = recordConversationStep(query, messages);
  if (creation) {
    if (!creation.shouldCreate) return creation;
    var created = await createRecordFromChat(creation.draft);
    return { text:'已经把“' + created.title + '”创建为事件记录并放进经历库。活动日期为 ' + dateLabel(created.date) + '；之后仍可以在详情页继续补充或修改。', recs:[created.id], context:{ mode:'chat', createdRecordId:created.id } };
  }
  var aiKeys = getAiKeys(); var referenceIds = selectedRecordIds || [];
  if (aiKeys.deepseek) {
    try {
      var promptMessages = messages.filter(function (m) { return !m.typing; }).map(function (m) { var names = (m.refs || []).map(function (id) { var record = getRecords().find(function (item) { return item.id === id; }); return record && record.title; }).filter(Boolean); return { role:m.role, content:(names.length ? '【本轮引用事件：' + names.join('、') + '】\n' : '') + m.text }; });
      var raw = await chatWithDeepSeek(aiKeys.deepseek, promptMessages, getRecords(), getNotes(), referenceIds); var parsed = parseModelJson(raw); var validIds = Array.isArray(parsed.recordIds) ? parsed.recordIds.filter(function (id) { return getRecords().some(function (r) { return r.id === id; }); }) : []; var shownIds = validIds.length ? validIds : referenceIds; var previousContext = lastChatContext(messages); var artifact = parsed.document && /^(word|pdf)$/.test(parsed.document.format || '') && parsed.document.content ? { format:parsed.document.format, title:String(parsed.document.title || 'MyArchive 对话整理'), content:String(parsed.document.content) } : null; var requestedFormat = documentFormatFromQuery(query); if (requestedFormat && !artifact) artifact = artifactFromRecords(requestedFormat, query, shownIds, parsed.reply || ''); return { text:parsed.reply || '我还在理解你的意思，可以再多告诉我一点吗？', recs:shownIds, artifact:artifact, context:{ mode:parsed.intent === 'retrieve' ? 'retrieval' : parsed.intent === 'document' ? 'document' : 'chat', stage:shownIds.length ? 'done' : 'conversation', scenario:previousContext.scenario, theme:previousContext.theme } };
    } catch (error) { showToast('AI 暂时不可用，已切换为本地对话模式'); }
  }
  return makeLocalReply(query, messages, referenceIds);
}
function safeDownloadName(value) { return String(value || 'MyArchive 文档').replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'MyArchive 文档'; }
function downloadBlob(blob, filename) { var url = URL.createObjectURL(blob); var link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500); }
async function exportWordArtifact(artifact) {
  var docx = await import('docx'); var lines = String(artifact.content || '').split(/\n/); var children = [];
  lines.forEach(function (line, index) { if (index === 0) children.push(new docx.Paragraph({ heading:docx.HeadingLevel.TITLE, spacing:{ after:320 }, children:[new docx.TextRun({ text:line || artifact.title, bold:true, size:36 })] })); else children.push(new docx.Paragraph({ spacing:{ after:line ? 160 : 80, line:360 }, children:[new docx.TextRun({ text:line, size:22 })] })); });
  var documentFile = new docx.Document({ creator:'MyArchive', title:artifact.title, sections:[{ properties:{ page:{ margin:{ top:1134, right:1134, bottom:1134, left:1134 } } }, children:children }] });
  downloadBlob(await docx.Packer.toBlob(documentFile), safeDownloadName(artifact.title) + '.docx');
}
async function exportPdfArtifact(artifact) {
  var libraries = await Promise.all([import('html2canvas'), import('jspdf')]); var html2canvas = libraries[0].default || libraries[0]; var JsPdf = libraries[1].jsPDF; var sheet = document.createElement('article'); sheet.className = 'pdf-export-sheet'; var title = document.createElement('h1'); title.textContent = artifact.title; var body = document.createElement('div'); body.textContent = artifact.content; sheet.append(title, body); document.body.appendChild(sheet);
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; var canvas = await html2canvas(sheet, { scale:2, useCORS:true, backgroundColor:'#ffffff', logging:false }); var pdf = new JsPdf({ unit:'mm', format:'a4', orientation:'portrait', compress:true }); var pageWidth = pdf.internal.pageSize.getWidth(); var pageHeight = pdf.internal.pageSize.getHeight(); var margin = 10; var imageWidth = pageWidth - margin * 2; var imageHeight = canvas.height * imageWidth / canvas.width; var image = canvas.toDataURL('image/jpeg', .96); var position = margin; pdf.addImage(image, 'JPEG', margin, position, imageWidth, imageHeight, undefined, 'FAST'); var remaining = imageHeight - (pageHeight - margin * 2); while (remaining > 0) { pdf.addPage(); position = margin - (imageHeight - remaining); pdf.addImage(image, 'JPEG', margin, position, imageWidth, imageHeight, undefined, 'FAST'); remaining -= pageHeight - margin * 2; } pdf.save(safeDownloadName(artifact.title) + '.pdf'); } finally { sheet.remove(); }
}
async function exportChatArtifact(artifact) { if (!artifact) return; showToast('正在生成' + (artifact.format === 'word' ? ' Word 文档…' : ' PDF 文件…')); try { if (artifact.format === 'word') await exportWordArtifact(artifact); else await exportPdfArtifact(artifact); showToast('文件已生成并开始下载'); } catch (error) { showToast('文件生成失败：' + error.message); } }
function renderChatReferences() {
  var root = document.getElementById('chat-references'); if (!root) return; chatReferenceIds = chatReferenceIds.filter(function (id, index, list) { return list.indexOf(id) === index && getRecords().some(function (record) { return record.id === id; }); }); root.hidden = !chatReferenceIds.length;
  root.innerHTML = chatReferenceIds.map(function (id) { var record = getRecords().find(function (item) { return item.id === id; }); return '<span class="chat-reference-chip"><i data-lucide="message-square-more"></i><span>' + esc(record.title) + '</span><button type="button" data-remove-reference="' + esc(id) + '" title="移除引用" aria-label="移除 ' + esc(record.title) + '"><i data-lucide="x"></i></button></span>'; }).join('');
}
function renderChat() {
  var box = document.getElementById('messages'); var messages = getChatMessages(); var workspace = document.getElementById('chat-workspace'); var active = messages.length > 0;
  workspace.classList.toggle('is-active', active); document.getElementById('clear-chat').hidden = !active;
  document.getElementById('chat-input').placeholder = active ? '输入消息…' : '和我聊聊，或告诉我你想找什么';
  box.innerHTML = messages.map(function (message, messageIndex) {
    var bubbleContent = message.typing ? '<span class="typing-dots"><i></i><i></i><i></i></span>' : esc(message.text);
    var referenceLabels = message.refs && message.refs.length ? '<div class="sent-references">' + message.refs.map(function (id) { var record = getRecords().find(function (item) { return item.id === id; }); return record ? '<span><i data-lucide="message-square-more"></i>' + esc(record.title) + '</span>' : ''; }).join('') + '</div>' : '';
    var cards = message.recs && message.recs.length ? '<div class="recommendations">' + message.recs.map(function (id) { var record = getRecords().find(function (item) { return item.id === id; }); var firstPhoto = record && record.photos && record.photos[0]; var cover = typeof firstPhoto === 'string' ? firstPhoto : 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=500&q=80'; var href = '/detail?id=' + encodeURIComponent(record && record.id); return record ? '<article class="rec-card"><a class="rec-card-main" href="' + href + '"><div class="rec-thumb" style="background-image:url(\'' + esc(cover) + '\')"></div><div class="rec-copy"><h4>' + esc(record.title) + '</h4><p>' + esc(record.category) + ' · ' + dateLabel(record.date) + '</p></div></a><button class="rec-follow" type="button" data-follow-record="' + esc(record.id) + '"><i data-lucide="message-square-more"></i><span>追问 AI</span></button><a class="rec-arrow" href="' + href + '" title="查看详情" aria-label="查看 ' + esc(record.title) + ' 详情">↗</a></article>' : ''; }).join('') + '</div>' : '';
    var artifact = message.artifact ? '<button class="chat-artifact" type="button" data-artifact-message="' + messageIndex + '"><span class="artifact-icon"><i data-lucide="file-text"></i></span><span><strong>' + esc(message.artifact.title) + '</strong><small>' + (message.artifact.format === 'word' ? 'Word 文档 · .docx' : 'PDF 文件 · .pdf') + '</small></span><i class="artifact-download" data-lucide="download"></i></button>' : '';
    var timestamp = message.createdAt ? new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', hour12:false }) : '';
    var avatar = message.role === 'assistant' ? '<div class="message-avatar" aria-label="AI 助手"><span class="brand-mark"></span></div>' : '';
    return '<div class="message ' + (message.role === 'user' ? 'user' : '') + '">' + avatar + '<div class="message-stack">' + referenceLabels + '<div class="message-bubble">' + bubbleContent + '</div>' + cards + artifact + (message.typing ? '' : '<time class="message-time">' + timestamp + '</time>') + '</div></div>';
  }).join('');
  renderChatReferences(); renderIcons();
  box.scrollTop = box.scrollHeight;
}
function initChat() {
  var form = document.getElementById('chat-form'); var input = document.getElementById('chat-input'); var sendButton = form.querySelector('.send-btn'); var messagesBox = document.getElementById('messages'); var referencesBox = document.getElementById('chat-references');
  function resizeInput() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 116) + 'px'; input.style.overflowY = input.scrollHeight > 116 ? 'auto' : 'hidden'; }
  async function send() {
    var q = input.value.trim(); if (!q || sendButton.disabled) return; var now = new Date().toISOString(); var messages = getChatMessages(); var selectedIds = chatReferenceIds.slice();
    messages.push({ role:'user', text:q, refs:selectedIds, createdAt:now }); messages.push({ role:'assistant', typing:true, createdAt:now }); saveChatMessages(messages); input.value = ''; chatReferenceIds = []; resizeInput(); sendButton.disabled = true; renderChat();
    var answer = await getChatReply(q, messages.slice(0, -1), selectedIds); await new Promise(function (resolve) { setTimeout(resolve, 350); });
    var finalMessages = getChatMessages().filter(function (message) { return !message.typing; }); finalMessages.push({ role:'assistant', text:answer.text, recs:answer.recs, artifact:answer.artifact, context:answer.context, createdAt:new Date().toISOString() }); saveChatMessages(finalMessages); sendButton.disabled = false; renderChat(); input.focus();
  }
  form.addEventListener('submit', function (event) { event.preventDefault(); send(); });
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', function (event) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
  referencesBox.addEventListener('click', function (event) { var button = event.target.closest('[data-remove-reference]'); if (!button) return; chatReferenceIds = chatReferenceIds.filter(function (id) { return id !== button.dataset.removeReference; }); renderChatReferences(); renderIcons(); input.focus(); });
  messagesBox.addEventListener('click', function (event) {
    var follow = event.target.closest('[data-follow-record]'); if (follow) { if (chatReferenceIds.indexOf(follow.dataset.followRecord) < 0) chatReferenceIds.push(follow.dataset.followRecord); renderChatReferences(); renderIcons(); input.focus(); return; }
    var artifactButton = event.target.closest('[data-artifact-message]'); if (artifactButton) { var message = getChatMessages()[Number(artifactButton.dataset.artifactMessage)]; exportChatArtifact(message && message.artifact); }
  });
  document.getElementById('clear-chat').addEventListener('click', function () { sessionStorage.removeItem(CHAT_KEY); chatReferenceIds = []; input.value = ''; resizeInput(); renderChat(); input.focus(); });
  renderChat(); resizeInput();
}

function initDetail() {
  var id = new URLSearchParams(location.search).get('id'); var record = getRecords().find(function (r) { return r.id === id; }) || getRecords()[0]; var main = document.getElementById('detail-main');
  if (!record) { main.innerHTML = '<div class="empty-state"><h3>还没有这条记录</h3><p>它可能已被删除，或者链接已经失效。</p><a class="btn btn-secondary" href="/library">返回经历库</a></div>'; return; }
  var photos = (record.photos || []).map(function (photo, index) { var isStored = typeof photo === 'object'; var style = isStored ? '' : ' style="background-image:url(\'' + esc(photo) + '\')"'; var mediaId = isStored ? ' data-media-id="' + esc(photo.id) + '"' : ''; return '<div class="media-tile"' + style + mediaId + '><button class="media-remove" type="button" data-remove-photo="' + index + '" title="删除照片">×</button><span class="media-caption">' + esc(isStored ? photo.name : '活动照片') + '</span></div>'; }).join('');
  var files = (record.files || []).map(function (file, index) { var name = typeof file === 'object' ? file.name : file; return '<div class="media-tile file"><span class="file-mark">DOC</span><div><strong>' + esc(name) + '</strong><span>已保存到此事件</span></div><button class="media-remove" type="button" data-remove-file="' + index + '" title="删除文件">×</button></div>'; }).join('');
  var categoryOptions = allCategories().map(function (category) { return '<option value="' + esc(category) + '" ' + (category === record.category ? 'selected' : '') + '>' + esc(category) + '</option>'; }).join('');
  function editButton(field, label) {
    return '<button class="detail-edit-button" type="button" data-edit-field="' + field + '" title="编辑' + label + '" aria-label="编辑' + label + '" aria-pressed="false"><i class="detail-edit-glyph" data-lucide="pen-line"></i><i class="detail-save-glyph" data-lucide="save"></i></button>';
  }
  main.innerHTML = [
    '<div class="detail-header"><div class="detail-header-copy"><div class="eyebrow">MEMORY DETAIL</div>',
    '<div class="detail-editable detail-title-editable" data-editable="title"><div class="detail-field-value" data-field-value><h1>' + esc(record.title) + '</h1></div><div class="detail-field-editor"><input class="detail-title-input" data-field-editor type="text" value="' + esc(record.title) + '" aria-label="事件标题" /></div>' + editButton('title', '事件标题') + '</div>',
    '<div class="record-meta detail-meta">',
    '<div class="detail-editable detail-meta-item" data-editable="date"><span class="detail-field-value" data-field-value>◷ ' + dateLabel(record.date) + '</span><div class="detail-field-editor"><input class="detail-inline-input" data-field-editor type="date" value="' + esc(record.date || '') + '" aria-label="活动时间" /></div>' + editButton('date', '活动时间') + '</div>',
    '<div class="detail-editable detail-meta-item" data-editable="category"><span class="detail-field-value tag ' + categoryClass(record.category) + '" data-field-value>' + esc(record.category || '待分类') + '</span><div class="detail-field-editor"><select class="detail-inline-input" data-field-editor aria-label="活动分类">' + categoryOptions + '</select></div>' + editButton('category', '活动分类') + '</div>',
    '</div></div><div class="detail-actions"><a class="btn btn-secondary" href="/library">← 返回经历库</a></div></div>',
    '<div class="detail-layout"><section class="detail-section"><div class="section-head compact"><h2>AI 事件描述</h2><button class="btn btn-secondary btn-compact" id="regenerate-ai" type="button">↻ 重新生成</button></div><div class="ai-callout"><div class="ai-label">RETRIEVAL SUMMARY · DEEPSEEK V4 PRO</div>' + esc(record.aiDescription || '暂无 AI 描述') + '</div></section>',
    '<section class="detail-section detail-editable detail-description-editable" data-editable="description"><div class="section-head compact"><h2>我的原始记录</h2>' + editButton('description', '原始记录') + '</div><div class="detail-copy detail-field-value" data-field-value>' + esc(record.description || '暂无文字描述') + '</div><div class="detail-field-editor"><textarea class="detail-description-input" data-field-editor aria-label="原始记录">' + esc(record.description || '') + '</textarea></div></section>',
    '<section class="detail-section"><div class="section-head compact"><h2>资料与照片</h2><div class="attachment-actions"><label class="btn btn-secondary btn-compact" for="detail-file-upload">↥ 文件</label><input class="file-input" id="detail-file-upload" type="file" multiple accept=".pdf,.doc,.docx" /><label class="btn btn-secondary btn-compact" for="detail-photo-upload">▧ 照片</label><input class="file-input" id="detail-photo-upload" type="file" multiple accept="image/*" /></div></div><div class="media-grid">' + (photos + files || '<div class="empty-state"><p>还没有上传资料</p></div>') + '</div></section></div>',
    '<footer class="detail-footer"><div class="detail-status-summary"><span>创建于 <strong>' + new Date(record.createdAt || Date.now()).toLocaleDateString('zh-CN') + '</strong></span><span>附件 <strong>' + ((record.files || []).length + (record.photos || []).length) + ' 个</strong></span><span>时间 <strong>' + (record.date ? '已识别' : '需要补充') + '</strong></span></div><button type="button" class="btn btn-danger" id="delete-record">删除记录</button></footer>'
  ].join('');
  main.querySelectorAll('[data-media-id]').forEach(async function (tile) { var url = await getMediaUrl(tile.dataset.mediaId); if (url) tile.style.backgroundImage = 'url("' + url + '")'; });
  document.getElementById('regenerate-ai').addEventListener('click', async function (e) { var button = e.currentTarget; button.disabled = true; button.textContent = '正在生成…'; try { var sourcePhotos = []; for (var photoIndex = 0; photoIndex < (record.photos || []).length; photoIndex += 1) { var photo = record.photos[photoIndex]; if (photo && typeof photo === 'object') { var storedPhoto = await getStoredMedia(photo.id); if (storedPhoto && storedPhoto.blob) sourcePhotos.push(new File([storedPhoto.blob], storedPhoto.name, { type:storedPhoto.type || storedPhoto.blob.type })); } } var sourceDocuments = (record.files || []).map(function (file) { return { name:typeof file === 'object' ? file.name : file }; }); var synthesis = await generateEventSynthesis({ title:record.title, category:record.category, date:record.date, description:record.description, documents:sourceDocuments, photos:sourcePhotos }); var records = getRecords(); var recordIndex = records.findIndex(function (item) { return item.id === record.id; }); records[recordIndex] = Object.assign({}, records[recordIndex], { aiDescription:synthesis.aiDescription, keywords:synthesis.keywords, uncertainties:synthesis.uncertainties }); await saveRecords(records); showToast('已重新生成事实型事件摘要'); setTimeout(function () { location.reload(); }, 500); } catch (error) { button.disabled = false; button.textContent = '↻ 重新生成'; showToast('重新生成失败：' + error.message); } });
  function setEditing(container, button, editing) {
    var label = { title:'事件标题', category:'活动分类', date:'活动时间', description:'原始记录' }[button.dataset.editField];
    container.classList.toggle('is-editing', editing); button.classList.toggle('is-saving', editing); button.setAttribute('aria-pressed', String(editing)); button.setAttribute('aria-label', (editing ? '保存' : '编辑') + label); button.title = (editing ? '保存' : '编辑') + label;
  }
  function updateFieldValue(field, value, container) {
    var display = container.querySelector('[data-field-value]');
    if (field === 'title') display.querySelector('h1').textContent = value;
    if (field === 'date') display.textContent = '◷ ' + dateLabel(value);
    if (field === 'category') { display.textContent = value || '待分类'; display.className = 'detail-field-value tag ' + categoryClass(value); }
    if (field === 'description') display.textContent = value || '暂无文字描述';
  }
  main.addEventListener('click', async function (event) {
    var button = event.target.closest('[data-edit-field]'); if (!button) return;
    var field = button.dataset.editField; var container = button.closest('[data-editable]'); var editor = container.querySelector('[data-field-editor]');
    if (!container.classList.contains('is-editing')) { editor.value = record[field] || ''; setEditing(container, button, true); editor.focus(); if (field === 'title') editor.select(); return; }
    var value = editor.value.trim(); if (field === 'title' && !value) value = '未命名经历';
    var records = getRecords(); var index = records.findIndex(function (item) { return item.id === record.id; }); if (index < 0) return;
    records[index] = Object.assign({}, records[index], { [field]:value }); if (field === 'date') records[index].needsDate = !value; await saveRecords(records); record = records[index]; updateFieldValue(field, value, container); setEditing(container, button, false); showToast('已保存' + ({ title:'事件标题', category:'活动分类', date:'活动时间', description:'原始记录' }[field]));
  });
  document.getElementById('detail-file-upload').addEventListener('change', function (e) { updateAttachments(record.id, 'files', Array.from(e.target.files || [])); });
  document.getElementById('detail-photo-upload').addEventListener('change', function (e) { updateAttachments(record.id, 'photos', Array.from(e.target.files || [])); });
  main.addEventListener('click', function (e) { var photoButton = e.target.closest('[data-remove-photo]'); var fileButton = e.target.closest('[data-remove-file]'); if (photoButton) removeAttachment(record.id, 'photos', Number(photoButton.dataset.removePhoto)); if (fileButton) removeAttachment(record.id, 'files', Number(fileButton.dataset.removeFile)); });
  document.getElementById('delete-record').addEventListener('click', async function () { if (window.confirm('确定删除这条经历吗？删除后无法恢复。')) { var storedMedia = (record.files || []).concat(record.photos || []).filter(function (item) { return item && typeof item === 'object'; }); await Promise.all(storedMedia.map(function (item) { return deleteMedia(item.id); })); await saveRecords(getRecords().filter(function (r) { return r.id !== record.id; })); location.href = '/library'; } });
}

async function updateAttachments(recordId, field, uploads) { if (!uploads.length) return; var stored = await Promise.all(uploads.map(storeMedia)); var records = getRecords(); var index = records.findIndex(function (r) { return r.id === recordId; }); records[index][field] = (records[index][field] || []).concat(stored); await saveRecords(records); showToast('附件已加入记录'); setTimeout(function () { location.reload(); }, 350); }
async function removeAttachment(recordId, field, attachmentIndex) { var records = getRecords(); var index = records.findIndex(function (r) { return r.id === recordId; }); var removed = records[index][field][attachmentIndex]; if (removed && typeof removed === 'object') await deleteMedia(removed.id); records[index][field].splice(attachmentIndex, 1); await saveRecords(records); showToast('附件已删除'); setTimeout(function () { location.reload(); }, 350); }

function initSettings() {
  var settings = getSettings(); var deepseekInput = document.getElementById('deepseek-key'); var glmInput = document.getElementById('glm-key');
  deepseekInput.value = ENV_AI_KEYS.deepseek ? '' : settings.deepseek || ''; deepseekInput.disabled = Boolean(ENV_AI_KEYS.deepseek); if (ENV_AI_KEYS.deepseek) deepseekInput.placeholder = '已由本机环境配置';
  glmInput.value = ENV_AI_KEYS.glm ? '' : settings.glm || ''; glmInput.disabled = Boolean(ENV_AI_KEYS.glm); if (ENV_AI_KEYS.glm) glmInput.placeholder = '已由本机环境配置';
  updateCategoryList(); updateApiStatus();
  document.getElementById('settings-form').addEventListener('submit', function (e) { e.preventDefault(); var current = getSettings(); saveSettings(Object.assign({}, current, { deepseek:ENV_AI_KEYS.deepseek ? current.deepseek : deepseekInput.value.trim(), glm:ENV_AI_KEYS.glm ? current.glm : glmInput.value.trim() })); updateApiStatus(); showToast('设置已保存到当前浏览器'); });
  document.getElementById('category-form').addEventListener('submit', async function (e) { e.preventDefault(); var input = document.getElementById('custom-category'); var value = input.value.trim(); if (!value) return; var next = getSettings(); next.categories = (next.categories || []).concat(value).filter(function (v,i,a) { return a.indexOf(v) === i; }); try { await saveCustomCategories(next); input.value = ''; updateCategoryList(); showToast('自定义分类已添加'); } catch (error) { showToast(error.message); } });
}
function updateApiStatus() { var aiKeys = getAiKeys(); var status = document.getElementById('api-status'); var text = status.querySelector('.api-status-text'); var ready = Boolean(aiKeys.deepseek || aiKeys.glm); var fromEnvironment = Boolean(ENV_AI_KEYS.deepseek || ENV_AI_KEYS.glm); status.classList.toggle('ready', ready); text.textContent = fromEnvironment ? 'AI 已由本机环境预配置，无需手动填写 Key' : ready ? '已保存 Key，本地调用接口已准备就绪' : '尚未连接真实模型，当前使用本地演示分析'; }
function updateCategoryList() { var list = document.getElementById('custom-category-list'); if (list) list.innerHTML = (getSettings().categories || []).map(function (c) { return '<span class="custom-category">' + esc(c) + '</span>'; }).join('') || '<span class="help-text">还没有自定义分类</span>'; }

function renderIcons() {
  createIcons({
    icons:{ ArrowRight, ArrowUp, BrainCircuit, CalendarDays, ChevronLeft, ChevronRight, Clock3, Database, Download, FileSearch, FileText, Home, LibraryBig, MessageCircle, MessageSquareMore, Mic, NotebookPen, Orbit, PenLine, Plus, Radar, RotateCcw, Save, Search, Settings2, Sparkles, WandSparkles, X },
    attrs:{ 'stroke-width':1.8 }
  });
}

async function init() {
  if (getCurrentPage() === 'settings') { location.replace('/'); return; }
  var storageStatus = await syncArchiveFromProject();
  if (storageStatus.ready) await migrateClusteredNotes();
  initShell();
  var page = getCurrentPage();
  if (page === 'home') initHome();
  if (page === 'record') initRecord();
  if (page === 'library') initLibrary();
  if (page === 'notes') initNotes();
  if (page === 'calendar') initCalendar();
  if (page === 'chat') initChat();
  if (page === 'growth') initGrowthProfile({ records:getRecords(), onGenerated:showToast });
  if (page === 'detail') initDetail();
  if (page === 'settings') initSettings();
  renderIcons();
  if (!storageStatus.ready && storageStatus.mode === 'cloud') showToast('云端暂不可用，当前显示本地缓存');
  else if (!storageStatus.ready) showToast('项目共享存储暂不可用，当前显示本地缓存');
  else if (storageStatus.migrated) showToast('本地数据已上传：' + storageStatus.records + ' 条事件，' + storageStatus.notes + ' 条随手记');
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); }, { once:true });
else init();
