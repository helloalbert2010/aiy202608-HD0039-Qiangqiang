(function (global) {
  'use strict';

  var DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
  var GLM_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  var GLM_TRANSCRIPTION_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/audio/transcriptions';
  var GLM_FILES_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/files';

  async function requestJson(url, apiKey, body) {
    if (!apiKey) throw new Error('缺少 API Key');
    var response = await fetch(url, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer ' + apiKey },
      body:JSON.stringify(body)
    });
    if (!response.ok) {
      var detail = await response.text();
      throw new Error('模型请求失败（' + response.status + '）：' + detail.slice(0, 240));
    }
    return response.json();
  }

  async function analyzeTextWithDeepSeek(apiKey, prompt) {
    var data = await requestJson(DEEPSEEK_ENDPOINT, apiKey, {
      model:'deepseek-v4-pro',
      messages:[
        { role:'system', content:'你是一名严谨的学生经历档案整理助手。只使用输入中的事实，不确定内容必须明确标注。请输出结构化 JSON。' },
        { role:'user', content:prompt }
      ],
      response_format:{ type:'json_object' },
      temperature:0.2
    });
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || '' : '';
  }

  async function analyzeMediaWithGlm(apiKey, input) {
    if (!apiKey) throw new Error('缺少 GLM API Key');
    var content = [{ type:'text', text:input.prompt }];
    if (input.dataUrl) content.push({ type:'image_url', image_url:{ url:input.dataUrl } });
    var data = await requestJson(GLM_ENDPOINT, apiKey, {
      model:'glm-5v-turbo',
      messages:[{ role:'user', content:content }],
      temperature:0.1
    });
    return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || '' : '';
  }

  async function extractDocumentWithGlm(apiKey, file) {
    if (!apiKey) throw new Error('缺少 GLM API Key');
    var form = new FormData();
    form.append('purpose', 'file-extract');
    form.append('file', file, file.name || 'document');
    var upload = await fetch(GLM_FILES_ENDPOINT, { method:'POST', headers:{ Authorization:'Bearer ' + apiKey }, body:form });
    if (!upload.ok) {
      var uploadDetail = await upload.text();
      throw new Error('文档上传失败（' + upload.status + '）：' + uploadDetail.slice(0, 240));
    }
    var uploaded = await upload.json();
    var fileId = uploaded.id || uploaded.file_id || (uploaded.data && (uploaded.data.id || uploaded.data.file_id));
    if (!fileId) throw new Error('文档上传接口没有返回 file_id');
    try {
      var contentResponse = await fetch(GLM_FILES_ENDPOINT + '/' + encodeURIComponent(fileId) + '/content', { headers:{ Authorization:'Bearer ' + apiKey } });
      if (!contentResponse.ok) {
        var contentDetail = await contentResponse.text();
        throw new Error('文档提取失败（' + contentResponse.status + '）：' + contentDetail.slice(0, 240));
      }
      var raw = await contentResponse.text();
      var extracted = raw;
      try {
        var parsed = JSON.parse(raw);
        extracted = parsed.content || parsed.text || parsed.result || (parsed.data && (parsed.data.content || parsed.data.text)) || raw;
      } catch (_) {}
      if (typeof extracted !== 'string') extracted = JSON.stringify(extracted);
      if (!extracted.trim()) throw new Error('文档提取接口没有返回正文');
      return extracted.trim();
    } finally {
      fetch(GLM_FILES_ENDPOINT + '/' + encodeURIComponent(fileId), { method:'DELETE', headers:{ Authorization:'Bearer ' + apiKey } }).catch(function () {});
    }
  }

  async function transcribeAudioWithGlm(apiKey, audioBlob, filename) {
    if (!apiKey) throw new Error('缺少 GLM API Key');
    var form = new FormData();
    form.append('model', 'glm-asr-2512');
    form.append('file', audioBlob, filename || 'experience-recording.wav');
    var response = await fetch(GLM_TRANSCRIPTION_ENDPOINT, {
      method:'POST',
      headers:{ Authorization:'Bearer ' + apiKey },
      body:form
    });
    if (!response.ok) {
      var detail = await response.text();
      throw new Error('语音转写请求失败（' + response.status + '）：' + detail.slice(0, 240));
    }
    var data = await response.json();
    var transcript = data.text || data.result || data.transcript || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
    if (!transcript) throw new Error('接口没有返回转写文字');
    return transcript;
  }

  function writeWavString(view, offset, value) {
    for (var index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  }

  async function audioBlobToWav(blob) {
    var AudioContextClass = global.AudioContext || global.webkitAudioContext;
    if (!AudioContextClass) throw new Error('当前环境无法转换录音格式');
    var audioContext = new AudioContextClass();
    try {
      var sourceBuffer = await blob.arrayBuffer();
      var decoded = await audioContext.decodeAudioData(sourceBuffer.slice(0));
      var targetRate = 16000;
      var sourceRate = decoded.sampleRate;
      var outputLength = Math.max(1, Math.floor(decoded.length * targetRate / sourceRate));
      var samples = new Float32Array(outputLength);
      var channels = [];
      for (var channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) channels.push(decoded.getChannelData(channelIndex));
      for (var sampleIndex = 0; sampleIndex < outputLength; sampleIndex += 1) {
        var sourcePosition = sampleIndex * sourceRate / targetRate;
        var left = Math.floor(sourcePosition);
        var right = Math.min(left + 1, decoded.length - 1);
        var mix = 0;
        for (var channel = 0; channel < channels.length; channel += 1) mix += channels[channel][left] + (channels[channel][right] - channels[channel][left]) * (sourcePosition - left);
        samples[sampleIndex] = mix / channels.length;
      }
      var wavBuffer = new ArrayBuffer(44 + samples.length * 2);
      var view = new DataView(wavBuffer);
      writeWavString(view, 0, 'RIFF');
      view.setUint32(4, 36 + samples.length * 2, true);
      writeWavString(view, 8, 'WAVE');
      writeWavString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, targetRate, true);
      view.setUint32(28, targetRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeWavString(view, 36, 'data');
      view.setUint32(40, samples.length * 2, true);
      for (var outputIndex = 0; outputIndex < samples.length; outputIndex += 1) {
        var sample = Math.max(-1, Math.min(1, samples[outputIndex]));
        view.setInt16(44 + outputIndex * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
      }
      return new Blob([wavBuffer], { type:'audio/wav' });
    } finally {
      await audioContext.close();
    }
  }

  function wavSegment(source, dataStart, dataEnd, format) {
    var payload = source.slice(dataStart, dataEnd);
    var buffer = new ArrayBuffer(44 + payload.byteLength);
    var view = new DataView(buffer);
    writeWavString(view, 0, 'RIFF');
    view.setUint32(4, 36 + payload.byteLength, true);
    writeWavString(view, 8, 'WAVE');
    writeWavString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, format.channels, true);
    view.setUint32(24, format.sampleRate, true);
    view.setUint32(28, format.byteRate, true);
    view.setUint16(32, format.blockAlign, true);
    view.setUint16(34, format.bitsPerSample, true);
    writeWavString(view, 36, 'data');
    view.setUint32(40, payload.byteLength, true);
    new Uint8Array(buffer, 44).set(new Uint8Array(payload));
    return new Blob([buffer], { type:'audio/wav' });
  }

  async function transcribeAudioSequentially(apiKey, wavBlob, options) {
    var config = options || {};
    var source = await wavBlob.arrayBuffer();
    var view = new DataView(source);
    if (source.byteLength < 44 || String.fromCharCode.apply(null, new Uint8Array(source, 0, 4)) !== 'RIFF') {
      return transcribeAudioWithGlm(apiKey, wavBlob, config.filename || 'experience-recording.wav');
    }
    var channels = view.getUint16(22, true);
    var sampleRate = view.getUint32(24, true);
    var byteRate = view.getUint32(28, true);
    var blockAlign = view.getUint16(32, true);
    var bitsPerSample = view.getUint16(34, true);
    var bytesPerSegment = Math.max(blockAlign, Math.floor(byteRate * 29 / blockAlign) * blockAlign);
    var dataStart = 44;
    var dataLength = Math.max(0, Math.min(view.getUint32(40, true), source.byteLength - dataStart));
    var total = Math.max(1, Math.ceil(dataLength / bytesPerSegment));
    var transcripts = [];
    for (var index = 0; index < total; index += 1) {
      var start = dataStart + index * bytesPerSegment;
      var end = Math.min(dataStart + dataLength, start + bytesPerSegment);
      var segment = wavSegment(source, start, end, { channels:channels, sampleRate:sampleRate, byteRate:byteRate, blockAlign:blockAlign, bitsPerSample:bitsPerSample });
      if (config.onProgress) config.onProgress(index + 1, total);
      transcripts.push(await transcribeAudioWithGlm(apiKey, segment, 'recording-' + String(index + 1).padStart(2, '0') + '-of-' + String(total).padStart(2, '0') + '.wav'));
    }
    return transcripts.map(function (part) { return String(part || '').trim(); }).filter(Boolean).join('\n');
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function parseModelJson(raw) {
    var value = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(value);
  }

  function inferCategoryFromText(description) {
    var value = String(description || '');
    if (/比赛|竞赛|获奖|赛题/.test(value)) return '综合竞赛';
    if (/研究|实验|论文|调研/.test(value)) return '研究和探究';
    if (/社团|主席|负责人|负责|组织|主持|协调|带领|志愿者/.test(value)) return '领导力活动';
    if (/展览|车展|参观|体验/.test(value)) return '探索类活动';
    if (/绘画|音乐|戏剧|艺术/.test(value)) return '艺术活动';
    return '随手记';
  }

  function localRetrievalSummary(description, photoInsights) {
    var cleaned = String(description || '').trim().replace(/然后/g, '随后').replace(/我们/g, '参与团队').replace(/我/g, '记录者').replace(/\s+/g, ' ').trim();
    if (cleaned && !/[。！？]$/.test(cleaned)) cleaned += '。';
    var visual = (photoInsights || []).filter(Boolean).join('；');
    if (!cleaned && visual) cleaned = '照片资料显示：' + visual + '。';
    else if (cleaned && visual) cleaned += '照片资料补充：' + visual + '。';
    if (!cleaned) cleaned = '该事件目前仅保存了附件资料，尚未形成可确认的文字事实摘要。';
    return cleaned.slice(0, 500);
  }

  async function synthesizeEventForRetrieval(apiKey, event, analyses) {
    var prompt = [
      '请把以下学生事件资料整理为供经历库检索和后续对话理解使用的结构化摘要。',
      '输出 JSON，字段必须为：title、category、date、aiDescription、keywords、uncertainties。',
      'aiDescription 要求：',
      '1. 用第三人称客观复述事件本身，写清时间、地点、参与对象、发生了什么、学生做了什么、结果、感受和后续意向；',
      '2. 只写资料中能确认的事实，原文中的可能、应该、记不清等不确定性必须保留；',
      '3. 适合未来按人物、活动、物品、行为、主题、情绪和目标检索；',
      '4. 不评价学生，不使用体现了、展现了、说明了某种能力等评语或建议；',
      '5. 不要求用户补充信息，缺失项放进 uncertainties；正文控制在 120 至 350 个汉字；',
      '6. 日期已按用户手动选择 > 文字明确日期 > 默认今天确定。必须原样返回输入 date，不得根据模糊措辞修改。',
      '可选分类：' + event.categories.join('、'),
      '事件基本信息：' + JSON.stringify({ title:event.title, category:event.category, date:event.date, dateSource:event.dateSource, description:event.description }),
      '文字、语音、文件和照片的独立分析：' + JSON.stringify(analyses)
    ].join('\n');
    return analyzeTextWithDeepSeek(apiKey, prompt);
  }

  async function analyzeRecord(input, keys, categories, onPhase) {
    var analyses = [];
    var photoInsights = [];
    var phase = typeof onPhase === 'function' ? onPhase : function () {};

    phase('text', 'running');
    if (input.description && keys.deepseek) {
      try {
        var textResult = await analyzeTextWithDeepSeek(keys.deepseek, '独立分析以下原始事件记录。提取可确认的时间、地点、人物、对象、行动、结果、感受、意向和不确定信息；不要评价学生。只输出 JSON。\n' + input.description);
        analyses.push({ type:'text', result:parseModelJson(textResult) });
      } catch (error) {
        analyses.push({ type:'text', result:input.description, warning:'文字独立分析失败：' + error.message });
      }
    } else if (input.description) {
      analyses.push({ type:'text', result:input.description, warning:'未配置 DeepSeek Key' });
    }
    if (input.transcript && keys.glm) {
      try {
        analyses.push({ type:'voice', result:await analyzeMediaWithGlm(keys.glm, { prompt:'整理这段语音转写，提取事件事实、学生行动和个人感受。只输出事实分析。\n' + input.transcript }) });
      } catch (error) {
        analyses.push({ type:'voice', result:input.transcript, warning:'语音内容分析失败：' + error.message });
      }
    }
    phase('text', 'done');

    phase('documents', 'running');
    for (var documentIndex = 0; documentIndex < input.documents.length; documentIndex += 1) {
      var documentFile = input.documents[documentIndex];
      if (!keys.glm) {
        analyses.push({ type:'document', name:documentFile.name, note:'文件已保存，未配置 GLM Key' });
        continue;
      }
      try {
        var documentText = await extractDocumentWithGlm(keys.glm, documentFile);
        var documentResult = await analyzeMediaWithGlm(keys.glm, { prompt:'读取以下活动文档提取内容，提取活动名称、日期、地点、参与者行动和可核实结果；不能确认的内容要明确说明。只输出事实分析。\n' + documentText.slice(0, 50000) });
        analyses.push({ type:'document', name:documentFile.name, result:documentResult });
      } catch (error) {
        analyses.push({ type:'document', name:documentFile.name, note:'文件已保存并以文件名作为检索线索', warning:'文件分析失败：' + error.message });
      }
    }
    phase('documents', 'done');

    phase('photos', 'running');
    for (var photoIndex = 0; photoIndex < input.photos.length; photoIndex += 1) {
      var photoFile = input.photos[photoIndex];
      if (!keys.glm) {
        analyses.push({ type:'photo', name:photoFile.name, warning:'未配置 GLM Key' });
        continue;
      }
      try {
        var photoData = await fileToDataUrl(photoFile);
        var photoResult = await analyzeMediaWithGlm(keys.glm, { prompt:'只描述这张活动照片中可见的事实：场景、人物、物品、文字和动作。不要推断身份、品牌或事件结果；不确定内容要明确说明。', dataUrl:photoData });
        photoInsights.push(photoResult);
        analyses.push({ type:'photo', name:photoFile.name, result:photoResult });
      } catch (error) {
        analyses.push({ type:'photo', name:photoFile.name, warning:'照片分析失败：' + error.message });
      }
    }
    phase('photos', 'done');

    phase('synthesis', 'running');
    var fallbackDescription = localRetrievalSummary(input.description, photoInsights);
    var fallback = {
      title:input.title || fallbackDescription.replace(/[。！？].*$/, '').slice(0, 28) || '一段新的经历',
      category:input.category || inferCategoryFromText(input.description),
      date:input.date,
      aiDescription:fallbackDescription,
      keywords:[],
      uncertainties:[],
      analyses:analyses
    };
    if (!keys.deepseek) {
      phase('synthesis', 'done');
      return fallback;
    }
    try {
      var raw = await synthesizeEventForRetrieval(keys.deepseek, {
        title:input.title,
        category:input.category,
        date:input.date,
        dateSource:input.dateSource,
        description:input.description,
        categories:categories
      }, analyses);
      var parsed = parseModelJson(raw);
      var result = {
        title:String(parsed.title || fallback.title).trim(),
        category:categories.indexOf(parsed.category) >= 0 ? parsed.category : fallback.category,
        date:input.date,
        aiDescription:String(parsed.aiDescription || fallback.aiDescription).trim(),
        keywords:Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 12).map(String) : [],
        uncertainties:Array.isArray(parsed.uncertainties) ? parsed.uncertainties.filter(function (item) { return !/时间|日期/.test(String(item)); }).map(String) : [],
        analyses:analyses
      };
      phase('synthesis', 'done');
      return result;
    } catch (error) {
      fallback.warning = 'AI 摘要生成失败，已使用事实型本地摘要：' + error.message;
      phase('synthesis', 'done');
      return fallback;
    }
  }

  global.MobileAI = {
    audioBlobToWav:audioBlobToWav,
    transcribeAudioSequentially:transcribeAudioSequentially,
    analyzeRecord:analyzeRecord
  };
}(window));
