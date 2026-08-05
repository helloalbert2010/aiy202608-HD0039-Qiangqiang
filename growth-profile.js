export const TRAIT_DEFINITIONS = [
  { id:'leadership', label:'领导力', terms:['主席','负责人','统筹','带领','领导','主持','组织','排班','分配','决策','议程'] },
  { id:'collaboration', label:'协作力', terms:['团队','同学','小组','组员','搭档','协作','合作','协调','分工','轮班','同伴','我们','志愿者'] },
  { id:'execution', label:'执行力', terms:['完成','提交','按时','负责','落实','执行','推进','解决','调整','整理','制作','组装','记录','采集','测量','训练'] },
  { id:'creativity', label:'创造力', terms:['设计','创作','改编','重写','构图','草图','制作','方案','创新','改造','策划','重新','作品'] },
  { id:'expression', label:'表达力', terms:['主持','演讲','辩论','陈述','分享','广播','采访','汇报','展示','讲解','说明','表达','问答','对白','脚本','主席'] },
  { id:'research', label:'研究力', terms:['研究','调研','实验','数据','模型','采样','观察','访谈','分析','假设','验证','测量','误差','来源','事实核对','探究'] },
  { id:'technology', label:'技术力', terms:['AI','人工智能','Python','代码','编程','机器人','传感器','数据分析','模型','技术','可视化','循迹车','阈值'] },
  { id:'responsibility', label:'社会责任', terms:['社区','志愿','公益','慈善','环保','责任','服务','公共','捐','儿童','隐私','社会','食堂','迎新'] }
];

export const DOMAIN_DEFINITIONS = [
  { id:'academic', label:'学术研究', terms:['研究','调研','实验','数据','模型','论文','报告','采样','观察','访谈','学术','课程','错题','阅读','测量','分析'] },
  { id:'technology-ai', label:'技术与 AI', terms:['AI','人工智能','Python','代码','编程','机器人','传感器','数据分析','模型','技术','可视化','循迹车','阈值'] },
  { id:'competition', label:'竞赛挑战', terms:['竞赛','比赛','路演','选拔','半决赛','小组赛','校队','获奖','二等奖','展示奖'] },
  { id:'expression', label:'公共表达', terms:['主持','辩论','演讲','陈述','分享','广播','采访','汇报','展示','讲解','说明','表达','问答','主席'] },
  { id:'collaboration', label:'团队协作', terms:['团队','同学','小组','组员','搭档','协调','合作','协作','分工','排班','一起','同伴','志愿者','我们'] },
  { id:'social', label:'社会实践', terms:['社区','志愿','公益','慈善','实习','社会','环保','食堂','公共','迎新','图书馆','服务'] },
  { id:'art', label:'艺术创作', terms:['艺术','设计','创作','作品','戏剧','音乐','合唱','摄影','海报','剪纸','舞台','剧本','演出','构图'] },
  { id:'self-management', label:'自我管理', terms:['计划','训练','坚持','连续','每周','限时','时间','复盘','调整','改进','整理','按时','独立','反思','总结'] }
];

const ACTION_PATTERN = /负责|组织|主持|协调|完成|设计|制作|研究|调研|分析|验证|记录|调整|改进|解决|提出|编写|采集|测量|讲解|分享|训练|参与|参加/;
const OUTCOME_PATTERN = /最终|完成|获得|获奖|入选|晋级|提交|报告|作品|展示|展览|演出|解决|发现|稳定|提高|刷新|顺利|恢复|调整后|制成|产出|发布/;
const PROOF_PATTERN = /获.{0,4}奖|奖项|入选|晋级|报告|作品|展示|展览|演出|证书|提交|发布|完成.{0,6}(?:项目|报告|作品)|\d+(?:个|项|篇|份|场|名)/;
const DURATION_PATTERN = /连续|持续|每周|每天|长期|多次|一次次|两周|一周|四周|六周|\d+\s*(?:天|周|月|年|次)/;
const REFLECTION_PATTERN = /发现|学到|意识到|认识到|反思|收获|明白|理解|注意到|总结|改进|结论边界|误差/;

const TRAIT_SUGGESTIONS = {
  leadership:'可以补充一次负责分工、主持讨论或推动团队决策的经历。',
  collaboration:'可以记录一次有明确分工、沟通调整或共同交付的团队经历。',
  execution:'可以补充一次从计划到按时完成，并写清结果的项目经历。',
  creativity:'可以记录一次设计、改编、创作或提出新方案的经历。',
  expression:'可以补充一次演讲、主持、展示或公开分享的经历。',
  research:'可以记录一次提出问题、收集数据并形成结论的研究经历。',
  technology:'可以补充一次编程、AI、工程制作或数据分析项目经历。',
  responsibility:'可以补充一次社会实践、志愿服务或社区项目经历。'
};

function sourceText(record) {
  return [record && record.title, record && record.category, record && record.description].filter(Boolean).join(' ');
}

function matchedTerms(definition, text) {
  var normalized = String(text || '').toLowerCase();
  return definition.terms.filter(function (term) { return normalized.indexOf(term.toLowerCase()) >= 0; }).slice(0, 4);
}

function recordFacts(record) {
  var text = sourceText(record);
  var hasAttachment = Boolean(((record && record.files) || []).length + ((record && record.photos) || []).length);
  return {
    action:ACTION_PATTERN.test(text),
    outcome:OUTCOME_PATTERN.test(text),
    proof:hasAttachment || PROOF_PATTERN.test(text),
    duration:DURATION_PATTERN.test(text),
    reflection:REFLECTION_PATTERN.test(text),
    attachment:hasAttachment
  };
}

function traitEvidenceLevel(facts) {
  var level = 1;
  if (facts.action) level = 2;
  if (facts.outcome) level = 3;
  if (facts.outcome && (facts.duration || facts.proof)) level = 4;
  return level;
}

function traitAnalysis(records, definition) {
  var evidence = (records || []).map(function (record) {
    var terms = matchedTerms(definition, sourceText(record));
    if (!terms.length) return null;
    var facts = recordFacts(record);
    return { record:record, terms:terms, facts:facts, level:traitEvidenceLevel(facts) };
  }).filter(Boolean).sort(function (a, b) { return b.level - a.level || String(b.record.date || '').localeCompare(String(a.record.date || '')); });
  if (!evidence.length) return { id:definition.id, label:definition.label, score:0, evidence:[], breakdown:{ quantity:0, strength:0, outcome:0, duration:0 } };
  var quantity = Math.min(30, evidence.length * 6);
  var averageLevel = evidence.reduce(function (sum, item) { return sum + item.level; }, 0) / evidence.length;
  var strength = Math.round(averageLevel / 4 * 40);
  var outcome = Math.round(evidence.filter(function (item) { return item.facts.outcome; }).length / evidence.length * 20);
  var duration = Math.round(evidence.filter(function (item) { return item.facts.duration || item.facts.proof; }).length / evidence.length * 10);
  return { id:definition.id, label:definition.label, score:Math.min(100, quantity + strength + outcome + duration), evidence:evidence, breakdown:{ quantity:quantity, strength:strength, outcome:outcome, duration:duration } };
}

function growthPoints(facts, crossDomain) {
  var parts = [{ label:'相关经历', points:1 }];
  if (facts.outcome) parts.push({ label:'明确成果', points:2 });
  if (facts.proof) parts.push({ label:facts.attachment ? '附件或可证明成果' : '奖项、作品或展示', points:2 });
  if (facts.duration) parts.push({ label:'持续时间', points:1 });
  if (facts.reflection) parts.push({ label:'反思总结', points:1 });
  if (crossDomain) parts.push({ label:'跨领域经历', points:1 });
  return { total:parts.reduce(function (sum, item) { return sum + item.points; }, 0), parts:parts };
}

function annualDomainEvidence(records, year) {
  var result = Object.fromEntries(DOMAIN_DEFINITIONS.map(function (definition) { return [definition.id, []]; }));
  (records || []).filter(function (record) { return String(record.date || '').slice(0, 4) === String(year); }).forEach(function (record) {
    var text = sourceText(record);
    var matches = DOMAIN_DEFINITIONS.map(function (definition) { return { definition:definition, terms:matchedTerms(definition, text) }; }).filter(function (item) { return item.terms.length; });
    var facts = recordFacts(record);
    matches.forEach(function (match) {
      var points = growthPoints(facts, matches.length > 1);
      result[match.definition.id].push({ record:record, year:Number(year), terms:match.terms, facts:facts, points:points.total, parts:points.parts });
    });
  });
  Object.values(result).forEach(function (items) { items.sort(function (a, b) { return b.points - a.points || String(b.record.date || '').localeCompare(String(a.record.date || '')); }); });
  return result;
}

export function getAvailableGrowthYears(records) {
  var years = Array.from(new Set((records || []).map(function (record) { return Number(String(record.date || '').slice(0, 4)); }).filter(Number.isFinite))).sort(function (a, b) { return b - a; });
  if (!years.length) {
    var current = new Date().getFullYear();
    return [current, current - 1];
  }
  if (years.length === 1) years.push(years[0] - 1);
  return years;
}

export function buildGrowthProfile(records, currentYear, baselineYear) {
  var safeRecords = Array.isArray(records) ? records.filter(function (record) { return record && typeof record === 'object'; }) : [];
  var traits = TRAIT_DEFINITIONS.map(function (definition) { return traitAnalysis(safeRecords, definition); });
  var currentEvidence = annualDomainEvidence(safeRecords, currentYear);
  var baselineEvidence = annualDomainEvidence(safeRecords, baselineYear);
  var domains = DOMAIN_DEFINITIONS.map(function (definition) {
    var currentItems = currentEvidence[definition.id];
    var baselineItems = baselineEvidence[definition.id];
    var current = currentItems.reduce(function (sum, item) { return sum + item.points; }, 0);
    var baseline = baselineItems.reduce(function (sum, item) { return sum + item.points; }, 0);
    return { id:definition.id, label:definition.label, current:current, baseline:baseline, difference:current - baseline, currentEvidence:currentItems, baselineEvidence:baselineItems };
  });
  var highestTrait = traits.slice().sort(function (a, b) { return b.score - a.score; })[0] || null;
  var lowestTrait = traits.slice().sort(function (a, b) { return a.score - b.score; })[0] || null;
  var positiveGrowth = domains.filter(function (domain) { return domain.difference > 0; }).sort(function (a, b) { return b.difference - a.difference; });
  var newDomains = domains.filter(function (domain) { return domain.baseline === 0 && domain.current > 0; }).sort(function (a, b) { return b.current - a.current; });
  var stableDomains = domains.filter(function (domain) { return domain.current > 0 && domain.baseline > 0 && domain.difference >= -2; }).sort(function (a, b) { return Math.min(b.current, b.baseline) - Math.min(a.current, a.baseline); });
  var axisPeak = Math.max.apply(Math, [10].concat(domains.flatMap(function (domain) { return [domain.current, domain.baseline]; })));
  return {
    recordCount:safeRecords.length,
    currentYear:Number(currentYear),
    baselineYear:Number(baselineYear),
    currentRecordCount:safeRecords.filter(function (record) { return String(record.date || '').slice(0, 4) === String(currentYear); }).length,
    baselineRecordCount:safeRecords.filter(function (record) { return String(record.date || '').slice(0, 4) === String(baselineYear); }).length,
    traits:traits,
    domains:domains,
    highestTrait:highestTrait,
    lowestTrait:lowestTrait,
    biggestGrowth:positiveGrowth[0] || null,
    newDomains:newDomains,
    stableDomain:stableDomains[0] || null,
    growthAxisMax:Math.ceil(axisPeak / 10) * 10
  };
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]; });
}

function radarPoint(index, count, radius, center) {
  var angle = -Math.PI / 2 + index * Math.PI * 2 / count;
  return { x:center + Math.cos(angle) * radius, y:center + Math.sin(angle) * radius, angle:angle };
}

function radarPolygon(values, maximum, radius, center) {
  return values.map(function (value, index) {
    var point = radarPoint(index, values.length, radius * Math.max(0, Math.min(1, value / maximum)), center);
    return point.x.toFixed(1) + ',' + point.y.toFixed(1);
  }).join(' ');
}

function radarMarkup(config) {
  var center = 210; var radius = 132; var count = config.dimensions.length;
  var rings = [0.25, 0.5, 0.75, 1].map(function (ratio) {
    var points = config.dimensions.map(function (_, index) { var point = radarPoint(index, count, radius * ratio, center); return point.x.toFixed(1) + ',' + point.y.toFixed(1); }).join(' ');
    return '<polygon class="radar-grid-ring" points="' + points + '"></polygon>';
  }).join('');
  var axes = config.dimensions.map(function (_, index) { var point = radarPoint(index, count, radius, center); return '<line class="radar-axis-line" x1="' + center + '" y1="' + center + '" x2="' + point.x.toFixed(1) + '" y2="' + point.y.toFixed(1) + '"></line>'; }).join('');
  var series = config.series.map(function (item) {
    var polygon = radarPolygon(item.values, config.maximum, radius, center);
    var dots = item.values.map(function (value, index) { var point = radarPoint(index, count, radius * Math.max(0, Math.min(1, value / config.maximum)), center); return '<circle class="radar-point" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="3.4" style="--series-color:' + item.color + '"><title>' + escapeHtml(config.dimensions[index].label) + '：' + value + '</title></circle>'; }).join('');
    return '<polygon class="radar-series-area" points="' + polygon + '" style="--series-color:' + item.color + ';--series-fill:' + item.fill + '"></polygon>' + dots;
  }).join('');
  var labels = config.dimensions.map(function (dimension, index) {
    var point = radarPoint(index, count, 169, center);
    var active = config.activeDimension === dimension.id ? ' active' : '';
    return '<g class="radar-axis-action' + active + '" data-profile-kind="' + config.kind + '" data-profile-dimension="' + dimension.id + '" role="button" tabindex="0" aria-label="查看' + escapeHtml(dimension.label) + '证据"><circle cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="29"></circle><text x="' + point.x.toFixed(1) + '" y="' + (point.y + 4).toFixed(1) + '" text-anchor="middle">' + escapeHtml(dimension.label) + '</text></g>';
  }).join('');
  var ringLabels = [0.25, 0.5, 0.75, 1].map(function (ratio) { return '<text class="radar-scale-label" x="' + (center + 7) + '" y="' + (center - radius * ratio + 4).toFixed(1) + '">' + Math.round(config.maximum * ratio) + '</text>'; }).join('');
  var legend = config.series.map(function (item) { return '<span><i style="--legend-color:' + item.color + '"></i>' + escapeHtml(item.name) + '</span>'; }).join('');
  return '<svg class="radar-svg" viewBox="0 0 420 420" role="img" aria-label="' + escapeHtml(config.label) + '"><g>' + rings + axes + ringLabels + series + labels + '</g></svg><div class="radar-legend">' + legend + '</div>';
}

function scoreSign(value) { return value > 0 ? '+' + value : String(value); }

function evidenceStrength(level) {
  return ['无关','提及','明确行动','有成果','持续或可证明'][level] || '待判断';
}

function evidenceCard(item, kind, dimensionLabel) {
  var record = item.record || {};
  var isTrait = kind === 'trait';
  var contribution = isTrait ? '+' + item.level + ' 级' : '+' + item.points + ' 分';
  var meta = isTrait ? '证据强度：' + evidenceStrength(item.level) : '积分构成：' + item.parts.map(function (part) { return part.label + ' +' + part.points; }).join(' · ');
  var terms = (item.terms || []).map(function (term) { return '<span>' + escapeHtml(term) + '</span>'; }).join('');
  var explanation = isTrait
    ? '原始记录命中“' + escapeHtml((item.terms || []).join('、')) + '”，并' + (item.facts.outcome ? '写明了成果' : item.facts.action ? '写明了行动' : '提到了相关内容') + (item.facts.duration || item.facts.proof ? '，且有持续性或可证明材料。' : '。')
    : '该记录支持“' + escapeHtml(dimensionLabel) + '”；' + escapeHtml(item.parts.map(function (part) { return part.label + ' +' + part.points; }).join('，')) + '。';
  return '<article class="growth-evidence-card"><div class="growth-evidence-card-top"><div><span class="growth-evidence-date">' + escapeHtml(record.date || '日期待补充') + '</span><h3>' + escapeHtml(record.title || '未命名经历') + '</h3></div><strong>' + contribution + '</strong></div><div class="growth-evidence-tags"><span class="primary">' + escapeHtml(dimensionLabel) + '</span>' + terms + '</div><p class="growth-evidence-explanation">' + explanation + '</p><blockquote>' + escapeHtml(record.description || '这条记录还没有原始描述。') + '</blockquote><div class="growth-evidence-meta"><span>' + escapeHtml(meta) + '</span><a href="/detail?id=' + encodeURIComponent(record.id || '') + '">查看来源记录 →</a></div></article>';
}

export function initGrowthProfile(options) {
  var records = Array.isArray(options && options.records) ? options.records : [];
  var main = document.getElementById('growth-main');
  if (!main) return;
  var years = getAvailableGrowthYears(records);
  var currentSelect = document.getElementById('growth-current-year');
  var baselineSelect = document.getElementById('growth-baseline-year');
  var currentYear = years[0]; var baselineYear = years.find(function (year) { return year < currentYear; }) || currentYear - 1;
  var selectYears = Array.from(new Set(years.concat([currentYear, baselineYear]))).sort(function (a, b) { return b - a; });
  var optionsMarkup = selectYears.map(function (year) { return '<option value="' + year + '">' + year + '</option>'; }).join('');
  currentSelect.innerHTML = optionsMarkup; baselineSelect.innerHTML = optionsMarkup;
  currentSelect.value = String(currentYear); baselineSelect.value = String(baselineYear);
  var state = { currentYear:currentYear, baselineYear:baselineYear, activeKind:'trait', activeDimension:'', profile:null };

  function ensureYearOption(select, year) {
    if (Array.from(select.options).some(function (option) { return Number(option.value) === Number(year); })) return;
    var option = document.createElement('option'); option.value = String(year); option.textContent = String(year); select.appendChild(option);
  }

  function renderCharts() {
    var profile = state.profile;
    document.getElementById('trait-radar-note').textContent = profile.recordCount + ' 条经历参与计算；点击维度查看证据';
    document.getElementById('boundary-radar-note').textContent = profile.baselineYear + ' vs ' + profile.currentYear + '，对比 ' + profile.baselineRecordCount + ' / ' + profile.currentRecordCount + ' 条经历';
    document.getElementById('trait-radar').innerHTML = radarMarkup({
      kind:'trait', label:'经历特质雷达图', dimensions:profile.traits,
      series:[{ name:'当前经历特质', color:'#6657e8', fill:'rgba(102,87,232,.18)', values:profile.traits.map(function (item) { return item.score; }) }],
      maximum:100, activeDimension:state.activeKind === 'trait' ? state.activeDimension : ''
    });
    document.getElementById('boundary-radar').innerHTML = radarMarkup({
      kind:'growth', label:'认知边界年度成长雷达图', dimensions:profile.domains,
      series:[
        { name:String(profile.baselineYear), color:'#9aa5b8', fill:'rgba(154,165,184,.13)', values:profile.domains.map(function (item) { return item.baseline; }) },
        { name:String(profile.currentYear), color:'#6657e8', fill:'rgba(102,87,232,.17)', values:profile.domains.map(function (item) { return item.current; }) }
      ],
      maximum:profile.growthAxisMax, activeDimension:state.activeKind === 'growth' ? state.activeDimension : ''
    });
    var highest = profile.highestTrait; var lowest = profile.lowestTrait;
    document.getElementById('trait-insights').innerHTML = highest ? '<button type="button" data-profile-kind="trait" data-profile-dimension="' + highest.id + '"><span>最高特质</span><strong>' + escapeHtml(highest.label) + ' <b>' + highest.score + '</b></strong><small>' + highest.evidence.length + ' 条经历证据</small></button><button type="button" class="needs-work" data-profile-kind="trait" data-profile-dimension="' + lowest.id + '"><span>待补强</span><strong>' + escapeHtml(lowest.label) + ' <b>' + lowest.score + '</b></strong><small>' + escapeHtml(TRAIT_SUGGESTIONS[lowest.id]) + '</small></button>' : '<div class="growth-insight-empty">还没有可计算的经历</div>';
    var biggest = profile.biggestGrowth; var newly = profile.newDomains[0]; var stable = profile.stableDomain;
    document.getElementById('boundary-insights').innerHTML = '<button type="button" data-profile-kind="growth" data-profile-dimension="' + (biggest ? biggest.id : profile.domains[0].id) + '"><span>最大成长</span><strong>' + (biggest ? escapeHtml(biggest.label) + ' <b>' + scoreSign(biggest.difference) + '</b>' : '暂无正增长') + '</strong><small>' + (biggest ? '年度领域积分变化' : '可继续补充当年经历') + '</small></button><button type="button" class="new-domain" data-profile-kind="growth" data-profile-dimension="' + (newly ? newly.id : profile.domains[0].id) + '"><span>新拓展领域</span><strong>' + (newly ? escapeHtml(newly.label) : '本期暂无') + '</strong><small>' + (newly ? '对比年 0 分，当前年 ' + newly.current + ' 分' : '两个年份都有相关证据') + '</small></button><button type="button" class="stable-domain" data-profile-kind="growth" data-profile-dimension="' + (stable ? stable.id : profile.domains[0].id) + '"><span>稳定优势</span><strong>' + (stable ? escapeHtml(stable.label) : '证据不足') + '</strong><small>' + (stable ? '两个年份均有经历支持' : '需要两个年份的连续证据') + '</small></button>';
  }

  function renderEvidence() {
    var profile = state.profile; var selected; var evidence; var summary;
    if (state.activeKind === 'trait') {
      selected = profile.traits.find(function (item) { return item.id === state.activeDimension; }) || profile.highestTrait;
      state.activeDimension = selected.id; evidence = selected.evidence;
      document.getElementById('growth-evidence-kicker').textContent = '特质证据 · ' + selected.label;
      summary = selected.score + ' 分 = 经历数量 ' + selected.breakdown.quantity + ' + 证据强度 ' + selected.breakdown.strength + ' + 成果清晰度 ' + selected.breakdown.outcome + ' + 持续/可证明 ' + selected.breakdown.duration;
    } else {
      selected = profile.domains.find(function (item) { return item.id === state.activeDimension; }) || profile.domains[0];
      state.activeDimension = selected.id; evidence = selected.currentEvidence.concat(selected.baselineEvidence).sort(function (a, b) { return b.year - a.year || b.points - a.points; });
      document.getElementById('growth-evidence-kicker').textContent = '年度成长 · ' + selected.label;
      summary = profile.currentYear + ' 年 ' + selected.current + ' 分 − ' + profile.baselineYear + ' 年 ' + selected.baseline + ' 分 = ' + scoreSign(selected.difference) + (selected.baseline === 0 && selected.current > 0 ? '（新拓展领域）' : '');
    }
    document.getElementById('growth-evidence-summary').textContent = summary;
    document.getElementById('growth-evidence-grid').innerHTML = evidence.length ? evidence.map(function (item) { return evidenceCard(item, state.activeKind, selected.label); }).join('') : '<div class="growth-empty-evidence"><h3>这个维度还没有可追溯证据</h3><p>' + escapeHtml(state.activeKind === 'trait' ? TRAIT_SUGGESTIONS[selected.id] : '可以补充一条与该领域相关、写清行动和结果的经历。') + '</p><a class="btn btn-secondary" href="/record">记录一段新经历</a></div>';
  }

  function renderProfile() {
    state.profile = buildGrowthProfile(records, state.currentYear, state.baselineYear);
    if (!state.activeDimension) state.activeDimension = state.profile.highestTrait ? state.profile.highestTrait.id : state.profile.traits[0].id;
    renderCharts(); renderEvidence();
  }

  function chooseDimension(target) {
    state.activeKind = target.dataset.profileKind;
    state.activeDimension = target.dataset.profileDimension;
    renderCharts(); renderEvidence();
  }

  main.addEventListener('click', function (event) {
    var dimension = event.target.closest('[data-profile-dimension]');
    if (dimension) chooseDimension(dimension);
  });
  main.addEventListener('keydown', function (event) {
    var dimension = event.target.closest('[data-profile-dimension]');
    if (dimension && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); chooseDimension(dimension); }
  });
  function updateYears(currentYearChanged) {
    state.currentYear = Number(currentSelect.value);
    state.baselineYear = currentYearChanged ? state.currentYear - 1 : Number(baselineSelect.value);
    if (state.baselineYear >= state.currentYear) state.baselineYear = state.currentYear - 1;
    ensureYearOption(baselineSelect, state.baselineYear); baselineSelect.value = String(state.baselineYear);
    renderProfile();
  }
  currentSelect.addEventListener('change', function () { updateYears(true); });
  baselineSelect.addEventListener('change', function () { updateYears(false); });
  document.getElementById('growth-generate').addEventListener('click', function (event) {
    var button = event.currentTarget; var label = button.querySelector('span'); button.disabled = true; label.textContent = '正在生成…'; main.setAttribute('aria-busy', 'true');
    window.setTimeout(function () { updateYears(false); button.disabled = false; label.textContent = '生成画像'; main.removeAttribute('aria-busy'); if (options && typeof options.onGenerated === 'function') options.onGenerated('画像已基于当前经历库重新生成'); }, 220);
  });
  renderProfile();
}
