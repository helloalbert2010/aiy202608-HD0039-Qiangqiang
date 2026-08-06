(function (global) {
  'use strict';

  var RECORDS_KEY = 'ji-records-v1';
  var NOTES_KEY = 'ji-notes-v1';
  var SETTINGS_KEY = 'ji-settings-v1';
  var DEFAULT_CATEGORIES = ['学术竞赛','体育竞赛','综合竞赛','学术活动','探索类活动','研学活动','领导力活动','研究和探究','艺术活动','实习','随手记'];
  var currentView = 'home';
  var toastTimer;
  var recordTranscript = '';
  var recordCompleted = false;
  var cloud = { url:'', key:'', configured:false, online:false, syncing:false };
  var ai = { deepseek:'', glm:'' };
  var voice = { recorder:null, stream:null, chunks:[], targetId:'', startedAt:0, clock:null, limitTimer:null, transcribing:false };

  function readCollection(key) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function writeCollection(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function records() { return readCollection(RECORDS_KEY).sort(function (left, right) { return Date.parse(right.createdAt || right.date || 0) - Date.parse(left.createdAt || left.date || 0); }); }
  function notes() { return readCollection(NOTES_KEY).sort(function (left, right) { return Date.parse(right.createdAt || right.date || 0) - Date.parse(left.createdAt || left.date || 0); }); }
  function settings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  }
  function saveSettings(value) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)); }
  function allCategories() {
    var custom = Array.isArray(settings().categories) ? settings().categories : [];
    return DEFAULT_CATEGORIES.concat(custom).map(function (item) { return String(item || '').trim(); }).filter(function (item, index, list) { return item && list.indexOf(item) === index; });
  }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]; }); }
  function localDateKey(value) {
    var date = value instanceof Date ? value : new Date(value || Date.now());
    if (!Number.isFinite(date.getTime())) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }
  function dateText(value) {
    if (!value) return '时间待补充';
    var date = new Date(String(value).length === 10 ? value + 'T00:00:00' : value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN', { month:'long', day:'numeric' }) : value;
  }
  function timeText(value) {
    var date = new Date(value || Date.now());
    return Number.isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }) : '';
  }
  function showToast(message) {
    var box = document.getElementById('toast');
    if (!box) return;
    box.textContent = message;
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, 2800);
  }

  function configureRuntime() {
    try {
      var cloudRaw = global.AndroidBridge && global.AndroidBridge.getSupabaseConfig ? global.AndroidBridge.getSupabaseConfig() : '';
      var cloudConfig = cloudRaw ? JSON.parse(cloudRaw) : {};
      cloud.url = String(cloudConfig.url || '').replace(/\/$/, '');
      cloud.key = String(cloudConfig.key || '');
      cloud.configured = Boolean(cloud.url && cloud.key);
    } catch (_) {
      cloud.configured = false;
    }
    try {
      var aiRaw = global.AndroidBridge && global.AndroidBridge.getAiConfig ? global.AndroidBridge.getAiConfig() : '';
      var aiConfig = aiRaw ? JSON.parse(aiRaw) : {};
      var local = settings();
      ai.deepseek = String(aiConfig.deepseek || local.deepseek || '').trim();
      ai.glm = String(aiConfig.glm || local.glm || '').trim();
    } catch (_) {
      ai.deepseek = '';
      ai.glm = '';
    }
  }

  async function cloudRequest(path, options) {
    if (!cloud.configured) throw new Error('Supabase 尚未配置');
    var request = options || {};
    var headers = Object.assign({ apikey:cloud.key, Authorization:'Bearer ' + cloud.key, Accept:'application/json' }, request.headers || {});
    if (request.body != null) headers['Content-Type'] = 'application/json';
    var response = await fetch(cloud.url + '/rest/v1/' + path, Object.assign({}, request, { headers:headers }));
    var text = await response.text();
    var data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!response.ok) throw new Error(data && data.message ? data.message : 'HTTP ' + response.status);
    return data;
  }
  function validCloudDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null; }
  function recordToCloudRow(record) {
    return {
      id:String(record.id),
      title:String(record.title || ''),
      category:String(record.category || ''),
      occurred_on:validCloudDate(record.date),
      description:String(record.description || ''),
      ai_description:String(record.aiDescription || ''),
      keywords:Array.isArray(record.keywords) ? record.keywords.map(String) : [],
      uncertainties:Array.isArray(record.uncertainties) ? record.uncertainties.map(String) : [],
      files:Array.isArray(record.files) ? record.files : [],
      photos:Array.isArray(record.photos) ? record.photos : [],
      needs_date:Boolean(record.needsDate),
      created_via:record.createdVia ? String(record.createdVia) : 'mobile',
      created_at:new Date(record.createdAt || Date.now()).toISOString()
    };
  }
  function noteToCloudRow(note) {
    return { id:String(note.id), content:String(note.content || '').trim(), note_date:validCloudDate(note.date), created_at:new Date(note.createdAt || Date.now()).toISOString() };
  }
  function cloudRowToRecord(row) {
    return { id:row.id, title:row.title || '', category:row.category || '', date:row.occurred_on || '', description:row.description || '', aiDescription:row.ai_description || '', keywords:Array.isArray(row.keywords) ? row.keywords : [], uncertainties:Array.isArray(row.uncertainties) ? row.uncertainties : [], files:Array.isArray(row.files) ? row.files : [], photos:Array.isArray(row.photos) ? row.photos : [], createdAt:row.created_at, needsDate:Boolean(row.needs_date), createdVia:row.created_via || undefined };
  }
  function cloudRowToNote(row) { return { id:row.id, content:row.content || '', date:row.note_date || '', createdAt:row.created_at }; }
  async function upsertCloud(collection, item) {
    var row = collection === 'records' ? recordToCloudRow(item) : noteToCloudRow(item);
    if (collection === 'notes' && !row.content) throw new Error('随手记内容不能为空');
    await cloudRequest(collection + '?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify([row]) });
    cloud.online = true;
  }
  async function upsertCloudCategory(name) {
    await cloudRequest('categories?on_conflict=name', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify([{ name:name }]) });
  }
  async function readCloudCollections() {
    var result = await Promise.all([
      cloudRequest('records?select=*&order=created_at.desc'),
      cloudRequest('notes?select=*&order=created_at.desc'),
      cloudRequest('categories?select=name&order=created_at.asc')
    ]);
    return {
      records:(result[0] || []).map(cloudRowToRecord),
      notes:(result[1] || []).map(cloudRowToNote),
      categories:(result[2] || []).map(function (row) { return row.name; }).filter(Boolean)
    };
  }
  async function syncFromCloud() {
    if (!cloud.configured || cloud.syncing) return;
    cloud.syncing = true;
    var localRecords = records();
    var localNotes = notes();
    try {
      var remote = await readCloudCollections();
      var remoteRecordIds = new Set(remote.records.map(function (item) { return String(item.id); }));
      var remoteNoteIds = new Set(remote.notes.map(function (item) { return String(item.id); }));
      var localOnlyRecords = localRecords.filter(function (item) { return !remoteRecordIds.has(String(item.id)); });
      var localOnlyNotes = localNotes.filter(function (item) { return !remoteNoteIds.has(String(item.id)); });
      for (var recordIndex = 0; recordIndex < localOnlyRecords.length; recordIndex += 1) await upsertCloud('records', localOnlyRecords[recordIndex]);
      for (var noteIndex = 0; noteIndex < localOnlyNotes.length; noteIndex += 1) await upsertCloud('notes', localOnlyNotes[noteIndex]);
      writeCollection(RECORDS_KEY, remote.records.concat(localOnlyRecords));
      writeCollection(NOTES_KEY, remote.notes.concat(localOnlyNotes));
      var localSettings = settings();
      localSettings.categories = remote.categories;
      saveSettings(localSettings);
      cloud.online = true;
      fillCategoryOptions();
      render();
      showToast(localOnlyRecords.length || localOnlyNotes.length ? '云端已连接，本机数据已同步' : '云端数据已同步');
    } catch (_) {
      cloud.online = false;
      showToast('云端暂时不可用，已保留本机缓存');
    } finally {
      cloud.syncing = false;
    }
  }

  function recordCard(record) {
    return '<article class="record-card"><span class="record-dot"></span><div class="record-card-main"><strong class="record-card-title">' + esc(record.title || '未命名经历') + '</strong><div class="record-card-meta"><span>' + esc(dateText(record.date)) + '</span><span>·</span><span>' + esc(record.category || '未分类') + '</span><span>·</span><span>' + ((record.files || []).length + (record.photos || []).length) + ' 个附件</span></div><p class="record-card-desc">' + esc(record.aiDescription || record.description || '') + '</p></div></article>';
  }
  function noteCard(note) { return '<article class="note-card"><p>' + esc(note.content || '') + '</p><time>' + esc(timeText(note.createdAt || note.date)) + '</time></article>'; }
  function render() {
    var allRecords = records();
    var allNotes = notes();
    document.getElementById('notes-list').innerHTML = allNotes.map(noteCard).join('') || '<div class="empty">还没有随手记，想到什么就从首页写下来。</div>';
    document.getElementById('notes-total').textContent = allNotes.length ? allNotes.length + ' 条' : '';
    document.getElementById('library-records').innerHTML = allRecords.map(recordCard).join('') || '<div class="empty">还没有经历记录。</div>';
    document.getElementById('library-notes').innerHTML = allNotes.map(noteCard).join('') || '<div class="empty">还没有随手记。</div>';
  }
  function fillCategoryOptions(selected) {
    var select = document.getElementById('record-category');
    if (!select) return;
    var current = selected == null ? select.value : selected;
    select.innerHTML = '<option value="">请先选择，也可以交给 AI</option>' + allCategories().map(function (category) { return '<option value="' + esc(category) + '">' + esc(category) + '</option>'; }).join('');
    if (allCategories().indexOf(current) >= 0) select.value = current;
  }
  function go(view) {
    if (view === 'record' && recordCompleted) resetRecordFlow();
    currentView = view;
    document.querySelectorAll('.view').forEach(function (item) { item.classList.toggle('active', item.id === view + '-view'); });
    document.querySelectorAll('.nav-item').forEach(function (item) { item.classList.toggle('active', item.dataset.go === view); });
    if (view === 'record' && !document.getElementById('record-date').value) document.getElementById('record-date').value = localDateKey(new Date());
    render();
    global.scrollTo(0, 0);
  }

  async function saveNote() {
    var input = document.getElementById('home-note-input');
    var content = input.value.trim();
    if (!content) { showToast('先写下一点内容吧'); input.focus(); return; }
    var now = new Date();
    var item = { id:'note-mobile-' + Date.now(), content:content, date:localDateKey(now), createdAt:now.toISOString() };
    try {
      if (cloud.configured) await upsertCloud('notes', item);
      var list = notes();
      list.unshift(item);
      writeCollection(NOTES_KEY, list);
      input.value = '';
      document.getElementById('home-note-status').textContent = '已保存到你的随手记';
      render();
      showToast(cloud.configured ? '随手记已保存到云端' : '随手记已保存到本机');
    } catch (error) {
      showToast('随手记保存失败：' + error.message);
    }
  }

  function explicitDateFromText(text, referenceDate) {
    var source = String(text || '');
    var reference = new Date(referenceDate || Date.now());
    reference.setHours(0, 0, 0, 0);
    function validDate(year, month, day, evidence) {
      var value = new Date(year, month - 1, day);
      return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day ? { date:localDateKey(value), evidence:evidence } : null;
    }
    var full = source.match(/((?:19|20)\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*(?:日|号)?/);
    if (full) return validDate(Number(full[1]), Number(full[2]), Number(full[3]), full[0]);
    var lastYear = source.match(/去年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
    if (lastYear) return validDate(reference.getFullYear() - 1, Number(lastYear[1]), Number(lastYear[2]), lastYear[0]);
    var monthDay = source.match(/(?:^|[^\d])(\d{1,2})\s*月\s*(\d{1,2})\s*(?:日|号)?/);
    if (monthDay) return validDate(reference.getFullYear(), Number(monthDay[1]), Number(monthDay[2]), monthDay[0].trim());
    var offset = /大前天/.test(source) ? -3 : /前天/.test(source) ? -2 : /昨天|昨日/.test(source) ? -1 : null;
    if (offset !== null) {
      reference.setDate(reference.getDate() + offset);
      return { date:localDateKey(reference), evidence:offset === -1 ? '昨天' : offset === -2 ? '前天' : '大前天' };
    }
    var weekDay = source.match(/上周([一二三四五六日天])/);
    if (weekDay) {
      var targetDay = '一二三四五六日天'.indexOf(weekDay[1]) + 1;
      if (targetDay >= 7) targetDay = 7;
      var currentDay = reference.getDay() || 7;
      reference.setDate(reference.getDate() - currentDay - 7 + targetDay);
      return { date:localDateKey(reference), evidence:weekDay[0] };
    }
    return null;
  }
  function applyInferredDate() {
    var dateInput = document.getElementById('record-date');
    if (dateInput.dataset.userChanged === 'true') return;
    var inferred = explicitDateFromText(document.getElementById('record-description').value, new Date());
    if (!inferred) return;
    dateInput.value = inferred.date;
    dateInput.dataset.textEvidence = inferred.evidence;
    showToast('已根据“' + inferred.evidence + '”调整活动时间');
  }

  var attachmentDbPromise;
  function openAttachmentDb() {
    if (attachmentDbPromise) return attachmentDbPromise;
    attachmentDbPromise = new Promise(function (resolve, reject) {
      var request = indexedDB.open('ji-media-v1', 1);
      request.onupgradeneeded = function () { if (!request.result.objectStoreNames.contains('uploads')) request.result.createObjectStore('uploads', { keyPath:'id' }); };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
    return attachmentDbPromise;
  }
  async function storeAttachment(file) {
    var item = { id:'media-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), name:file.name, type:file.type || 'application/octet-stream', size:file.size, blob:file };
    var db = await openAttachmentDb();
    await new Promise(function (resolve, reject) {
      var transaction = db.transaction('uploads', 'readwrite');
      transaction.objectStore('uploads').put(item);
      transaction.oncomplete = resolve;
      transaction.onerror = function () { reject(transaction.error); };
    });
    return { id:item.id, name:item.name, type:item.type, size:item.size };
  }
  function attachmentSize(size) {
    var value = Number(size || 0);
    if (value < 1024) return value + ' B';
    if (value < 1024 * 1024) return Math.round(value / 1024) + ' KB';
    return (value / 1024 / 1024).toFixed(1) + ' MB';
  }
  function renderPendingAttachments() {
    var photoInput = document.getElementById('record-photos');
    var fileInput = document.getElementById('record-files');
    var files = Array.from(photoInput.files || []).concat(Array.from(fileInput.files || []));
    document.getElementById('record-attachment-list').innerHTML = files.map(function (file) { return '<div class="attachment-chip"><span>' + (file.type && file.type.indexOf('image/') === 0 ? '▧' : '▤') + '</span><strong>' + esc(file.name) + '</strong><span>' + attachmentSize(file.size) + '</span></div>'; }).join('');
  }

  function voiceStatus(targetId) { return document.getElementById(targetId === 'record-description' ? 'record-voice-status' : 'home-note-status'); }
  function setVoiceUi(targetId, recording) {
    var button = document.querySelector('[data-voice-target="' + targetId + '"]');
    if (!button) return;
    button.classList.toggle('recording', recording);
    button.setAttribute('aria-label', recording ? '停止录音并识别' : '开始录音');
    if (targetId === 'record-description') {
      document.getElementById('record-capture-field').classList.toggle('is-recording', recording);
      var label = button.querySelector('span');
      if (label) label.textContent = recording ? '停止并识别' : '开始录音';
    }
  }
  function clearVoiceResources() {
    clearInterval(voice.clock);
    clearTimeout(voice.limitTimer);
    if (voice.stream) voice.stream.getTracks().forEach(function (track) { track.stop(); });
    voice.stream = null;
    voice.recorder = null;
    voice.clock = null;
    voice.limitTimer = null;
  }
  async function startVoice(targetId) {
    if (voice.recorder && voice.recorder.state === 'recording') {
      if (voice.targetId !== targetId) { showToast('请先结束当前录音'); return; }
      voice.recorder.stop();
      return;
    }
    if (voice.transcribing) { showToast('上一段录音正在由 GLM 转写'); return; }
    if (!ai.glm) { showToast('APK 未配置 GLM Key，无法进行语音识别'); return; }
    if (!navigator.mediaDevices || !global.MediaRecorder) { showToast('当前 WebView 不支持录音'); return; }
    try {
      voice.stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      voice.chunks = [];
      voice.targetId = targetId;
      voice.startedAt = Date.now();
      var options = global.MediaRecorder.isTypeSupported && global.MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType:'audio/webm;codecs=opus' } : undefined;
      voice.recorder = options ? new MediaRecorder(voice.stream, options) : new MediaRecorder(voice.stream);
      var recorder = voice.recorder;
      recorder.ondataavailable = function (event) { if (event.data && event.data.size) voice.chunks.push(event.data); };
      recorder.onstop = async function () {
        var stoppedTarget = voice.targetId;
        var chunks = voice.chunks.slice();
        var mimeType = recorder.mimeType || 'audio/webm';
        clearVoiceResources();
        setVoiceUi(stoppedTarget, false);
        voice.transcribing = true;
        var status = voiceStatus(stoppedTarget);
        try {
          status.textContent = '正在转换录音格式…';
          var wav = await global.MobileAI.audioBlobToWav(new Blob(chunks, { type:mimeType }));
          var transcript = await global.MobileAI.transcribeAudioSequentially(ai.glm, wav, {
            filename:stoppedTarget === 'record-description' ? 'experience-recording.wav' : 'quick-note.wav',
            onProgress:function (index, total) { status.textContent = total > 1 ? 'GLM 正在识别第 ' + index + ' / ' + total + ' 段…' : 'GLM 正在识别录音…'; }
          });
          var input = document.getElementById(stoppedTarget);
          input.value = [input.value.trim(), transcript].filter(Boolean).join('\n');
          if (stoppedTarget === 'record-description') {
            recordTranscript = [recordTranscript, transcript].filter(Boolean).join('\n');
            applyInferredDate();
          }
          status.textContent = 'GLM 识别完成，已按原顺序加入文字';
          input.focus();
        } catch (error) {
          status.textContent = 'GLM 识别失败：' + error.message;
        } finally {
          voice.transcribing = false;
          voice.targetId = '';
          voice.chunks = [];
        }
      };
      recorder.start(1000);
      setVoiceUi(targetId, true);
      var status = voiceStatus(targetId);
      status.textContent = '正在录音 · 00:00 / 10:00';
      voice.clock = setInterval(function () {
        var seconds = Math.floor((Date.now() - voice.startedAt) / 1000);
        status.textContent = '正在录音 · ' + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0') + ' / 10:00';
      }, 1000);
      voice.limitTimer = setTimeout(function () { if (voice.recorder && voice.recorder.state === 'recording') voice.recorder.stop(); }, 600000);
    } catch (error) {
      clearVoiceResources();
      setVoiceUi(targetId, false);
      voiceStatus(targetId).textContent = '无法使用麦克风，请检查系统权限';
    }
  }

  function setAnalysisStep(name, state) {
    var order = { text:'1', documents:'2', photos:'3', synthesis:'4' };
    var step = document.querySelector('[data-analysis-step="' + name + '"]');
    if (!step) return;
    step.classList.remove('running', 'done');
    if (state === 'running' || state === 'done') step.classList.add(state);
    step.querySelector('.step-status').textContent = state === 'done' ? '✓' : order[name];
  }
  function resetRecordFlow() {
    recordTranscript = '';
    recordCompleted = false;
    var form = document.getElementById('record-form');
    form.reset();
    var dateInput = document.getElementById('record-date');
    dateInput.value = localDateKey(new Date());
    delete dateInput.dataset.userChanged;
    delete dateInput.dataset.textEvidence;
    fillCategoryOptions('');
    renderPendingAttachments();
    document.getElementById('record-form-content').style.display = '';
    document.getElementById('record-analysis-progress').classList.remove('show');
    document.getElementById('record-success').classList.remove('show');
    document.getElementById('record-error').classList.remove('show');
    ['text','documents','photos','synthesis'].forEach(function (name) { setAnalysisStep(name, 'idle'); });
    document.getElementById('record-voice-status').textContent = '单次最长 10 分钟，长录音会按顺序分段识别';
  }
  function beginRecordAnalysis() {
    document.getElementById('record-form-content').style.display = 'none';
    document.getElementById('record-analysis-progress').classList.add('show');
    document.getElementById('record-success').classList.remove('show');
    document.getElementById('record-error').classList.remove('show');
    ['text','documents','photos','synthesis'].forEach(function (name) { setAnalysisStep(name, 'idle'); });
    global.scrollTo(0, 0);
  }
  function restoreRecordForm(error) {
    document.getElementById('record-analysis-progress').classList.remove('show');
    document.getElementById('record-form-content').style.display = '';
    showToast('记录创建失败：' + error.message);
    global.scrollTo(0, 0);
  }
  async function submitRecord(event) {
    event.preventDefault();
    if (voice.recorder || voice.transcribing) { showToast('请先完成当前语音识别'); return; }
    var title = document.getElementById('record-title').value.trim();
    var category = document.getElementById('record-category').value;
    var dateInput = document.getElementById('record-date');
    var description = document.getElementById('record-description').value.trim();
    var documents = Array.from(document.getElementById('record-files').files || []);
    var photos = Array.from(document.getElementById('record-photos').files || []);
    if (!description && !documents.length && !photos.length) { showToast('请至少添加一份文件、一张照片或一段文字描述'); document.getElementById('record-description').focus(); return; }
    if (photos.length > 12) { showToast('照片最多选择 12 张'); return; }
    if (documents.some(function (file) { return file.size > 20 * 1024 * 1024; })) { showToast('单个文档不能超过 20 MB'); return; }
    applyInferredDate();
    var date = dateInput.value || localDateKey(new Date());
    var dateSource = dateInput.dataset.userChanged === 'true' ? 'manual' : dateInput.dataset.textEvidence ? 'text' : 'default-today';
    if (!global.MobileAI) { showToast('AI 模块加载失败'); return; }
    if (!cloud.configured) { showToast('Supabase 尚未配置，不能创建共享记录'); return; }
    beginRecordAnalysis();
    try {
      var synthesis = await global.MobileAI.analyzeRecord({ title:title, category:category, date:date, dateSource:dateSource, description:description, transcript:recordTranscript, documents:documents, photos:photos }, ai, allCategories(), function (name, state) {
        if (name === 'synthesis' && state === 'done') return;
        setAnalysisStep(name, state);
      });
      document.getElementById('record-title').value = synthesis.title;
      fillCategoryOptions(synthesis.category);
      dateInput.value = synthesis.date;
      var storedFiles = [];
      var storedPhotos = [];
      for (var fileIndex = 0; fileIndex < documents.length; fileIndex += 1) storedFiles.push(await storeAttachment(documents[fileIndex]));
      for (var photoIndex = 0; photoIndex < photos.length; photoIndex += 1) storedPhotos.push(await storeAttachment(photos[photoIndex]));
      var item = {
        id:'r-mobile-' + Date.now(),
        title:synthesis.title,
        category:synthesis.category,
        date:synthesis.date,
        description:description || '已上传资料，等待补充文字描述。',
        aiDescription:synthesis.aiDescription,
        keywords:synthesis.keywords,
        uncertainties:synthesis.uncertainties,
        files:storedFiles,
        photos:storedPhotos,
        createdAt:new Date().toISOString(),
        needsDate:false,
        createdVia:'mobile'
      };
      await upsertCloud('records', item);
      var list = records().filter(function (saved) { return saved.id !== item.id; });
      list.unshift(item);
      writeCollection(RECORDS_KEY, list);
      render();
      setAnalysisStep('synthesis', 'done');
      recordCompleted = true;
      var note = '已生成“' + item.title + '”，分类为“' + item.category + '”，并保存 AI 摘要、关键词、不确定项和 ' + (storedFiles.length + storedPhotos.length) + ' 个附件引用。';
      if (synthesis.warning) note += ' ' + synthesis.warning;
      document.getElementById('record-success-note').textContent = note;
      document.getElementById('record-success').classList.add('show');
    } catch (error) {
      restoreRecordForm(error);
    }
  }

  async function addCategory() {
    var name = global.prompt('创建一个新的活动分类');
    name = String(name || '').trim();
    if (!name) return;
    try {
      if (cloud.configured) await upsertCloudCategory(name);
      var value = settings();
      value.categories = (Array.isArray(value.categories) ? value.categories : []).concat(name).filter(function (item, index, list) { return list.indexOf(item) === index; });
      saveSettings(value);
      fillCategoryOptions(name);
      showToast('已添加自定义分类');
    } catch (error) {
      showToast('添加分类失败：' + error.message);
    }
  }

  function bindEvents() {
    document.addEventListener('click', function (event) {
      var goButton = event.target.closest('[data-go]');
      if (goButton) { go(goButton.dataset.go); return; }
      var voiceButton = event.target.closest('[data-voice-target]');
      if (voiceButton) { startVoice(voiceButton.dataset.voiceTarget); return; }
      var tab = event.target.closest('[data-library-tab]');
      if (tab) {
        document.querySelectorAll('[data-library-tab]').forEach(function (item) { item.classList.toggle('active', item === tab); });
        var recordsTab = tab.dataset.libraryTab === 'records';
        document.getElementById('library-records').style.display = recordsTab ? '' : 'none';
        document.getElementById('library-notes').style.display = recordsTab ? 'none' : '';
      }
    });
    document.getElementById('home-note-save').addEventListener('click', saveNote);
    document.getElementById('record-photos').addEventListener('change', renderPendingAttachments);
    document.getElementById('record-files').addEventListener('change', renderPendingAttachments);
    document.getElementById('record-description').addEventListener('blur', applyInferredDate);
    document.getElementById('record-date').addEventListener('change', function (event) { event.target.dataset.userChanged = 'true'; });
    document.getElementById('record-add-category').addEventListener('click', addCategory);
    document.getElementById('record-form').addEventListener('submit', submitRecord);
    document.getElementById('record-again').addEventListener('click', function () { resetRecordFlow(); global.scrollTo(0, 0); });
  }

  function start() {
    configureRuntime();
    bindEvents();
    resetRecordFlow();
    go('home');
    syncFromCloud();
    global.mobileBack = function () { if (currentView !== 'home') { go('home'); return true; } return false; };
  }

  global.MyArchiveMobileApp = { start:start };
}(window));
