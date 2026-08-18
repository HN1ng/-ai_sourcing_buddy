/* =========================================================
 * AI Sourcing Buddy · 界面与交互
 * 状态管理 / 多需求档案 / 三页签 / 评分排序 / 导出导入
 * ========================================================= */
'use strict';

const STORAGE_KEY = 'ras_tool_v1';

/* 默认 AI 配置（内置 DeepSeek，开箱即用） */
const DEFAULT_AI_CONFIG = {
  enabled: true,
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-ca310f5ac4c44ad085bcf67ec8b8f4bd',
  model: 'deepseek-v4-flash'
};

const AI_JD_PROMPT = '你是资深招聘专家。请把下面的招聘 JD 解析为严格 JSON（不要输出其他文字）。\n关键词要求：must 和 nice 里的每一项必须是 2-6 字的核心能力词（如「大客户开发」「商务谈判」「团队管理」「客户资源」「英语」「从0到1」），禁止整句照抄，禁止出现「负责/具备/要求/需/有/能够/善于」等引导词，禁止把学历、工作年限、行业、地点写进关键词（这些分别放入 education、yearsMin/yearsMax、industry、location 字段）。\n{"titleZh":"岗位中文名","titleEn":"岗位英文名","aliases":["常见岗位叫法（2-4个）"],"must":["必备能力关键词（4-6个，越短越好）"],"nice":["加分关键词（0-4个，越短越好）"],"yearsMin":数字或null,"yearsMax":数字或null,"education":"学历要求","industry":"行业","companies":["目标公司（JD未提及则为空数组）"],"location":"地点","exclude":["排除词（可空数组）"]}\n\nJD：\n';
const AI_RESUME_PROMPT = '你是资深招聘专家，负责评估候选人与岗位的匹配度。\n岗位信息：\n{{PROFILE}}\n\n候选人简历：\n{{RESUME}}\n\n注意：简历中写"至今"表示候选人当前在职，属于正常状态，不要将其列为顾虑或待核实问题；只有时间线存在明显矛盾（如工作重叠、无法解释的断层、前后不一致）时才提出。\n\n请输出严格 JSON（不要输出其他文字）：\n{"highlights":["亮点（3-5条，尽量引用简历中的具体证据）"],"concerns":["顾虑（2-4条）"],"questions":["待核实问题（3-5条）"],"suggestion":"是否优先沟通及原因（一句话）","summary":"候选人与岗位适配性的总结（2-3句）"}';
const AI_RESUME_SCORE_PROMPT = '你是资深招聘专家。请根据岗位画像评估候选人简历，并提取简历结构化信息。\n岗位信息：\n{{PROFILE}}\n\n候选人简历：\n{{RESUME}}\n\n评分规则（每项 0-100，用整数）：\n1. 职能匹配（skill）：对照必备条件逐条判定：直接命中 100 / 从职责表述可推断 80 / 相似或可复用经验 60 / 缺失 0，取平均值；简历表达方式不同但能力等价时，要给出推断或可迁移分，不要一棒子打死。\n2. 业绩成果（performance）：基础 60；有量化数字成就加分（每个 +2 左右）；量级越大分越高（百万/千万/亿）；角色越深分越高（参与/负责/主导/从0到1）；封顶 100。\n3. 行业经验（industry）：基础 50；直接命中 JD 行业 +20~30；相邻行业 +10~20；可迁移 +10；明显无关 30。\n4. 公司背景（company）：目标公司池或一线大厂 90-100；知名科技/垂直头部 80-90；SaaS/企服知名 70-80；其他 55-70；有规模标签（大厂/独角兽/500强）80。\n5. 经验年限（experience）：在要求区间内 100；低于按比例递减；超过酌情递减。\n6. 学历（education）：基础分 博士80 / 硕士70 / 本科60 / 大专50，乘学校系数（985/QS前20/常春藤 ×1.2、211/双一流/QS前50 ×1.15、QS前100 ×1.1、QS前200 ×1.05、其他 ×1.0），四舍五入，最高 100。\n注意：简历中"至今"表示当前在职，属于正常状态，不要列为顾虑。\n\n输出严格 JSON（不要输出其他文字）：\n{"name":"姓名","title":"当前职位","company":"当前公司","years":数字,"education":"学历层次","schoolNote":"学校层次（如 QS前20 / 985，无则空字符串）","industry":"行业","location":"地点","skills":["2-6个能力词"],"achievements":["量化成就（0-5条）"],"scores":{"skill":0,"performance":0,"industry":0,"company":0,"experience":0,"education":0},"evidence":{"skill":"一句话依据","performance":"一句话依据","industry":"一句话依据","company":"一句话依据","experience":"一句话依据","education":"一句话依据"},"highlights":["亮点（3-5条，引用简历证据）"],"concerns":["顾虑（2-4条）"],"questions":["待核实问题（3-5条）"],"suggestion":"是否优先沟通及原因（一句话）","summary":"候选人与岗位适配性总结（2-3句）"}';

/* ---------- 基础工具 ---------- */
function $(id) { return document.getElementById(id); }
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.add('hidden'); }, 2400);
}

function copyText(text) {
  if (!text) { toast('没有可复制的内容'); return; }
  const done = function () { toast('已复制'); };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text, done); });
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); }
  document.body.removeChild(ta);
}

function renderChips(containerId, items, onChange, placeholder) {
  const box = $(containerId);
  if (!box) return;
  let inp = null;
  let committing = false;
  const commit = function () {
    if (committing) return;
    const v = inp.value.trim();
    if (!v) return;
    committing = true;
    items.push(v);
    onChange(items.slice());
    inp.value = '';
    render(true);
    committing = false;
  };
  const render = function (focusNew) {
    // 清空旧输入框，避免移除 DOM 时触发 blur 导致重复提交
    if (inp) inp.value = '';
    box.innerHTML = '';
    items.forEach(function (it, i) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = it;
      const x = document.createElement('button');
      x.className = 'x'; x.type = 'button'; x.textContent = '×';
      x.onclick = function () { items.splice(i, 1); render(); onChange(items.slice()); };
      chip.appendChild(x);
      box.appendChild(chip);
    });
    inp = document.createElement('input');
    inp.className = 'chip-input';
    inp.placeholder = placeholder || '回车添加';
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
    });
    inp.addEventListener('blur', commit);
    box.appendChild(inp);
    if (focusNew) inp.focus();
  };
  render(false);
}

/* ---------- 状态 ---------- */
function defaultState() {
  return {
    settings: { weights: Object.assign({}, DEFAULT_WEIGHTS) },
    archives: [],
    activeId: null
  };
}

// 首次打开 / 恢复示例：加载预置的演示案例（面试官打开即可看到测试数据）
function seedDemoState() {
  if (typeof DEMO_DATA === 'undefined' || !DEMO_DATA) return defaultState();
  const d = JSON.parse(JSON.stringify(DEMO_DATA));
  const s = {
    settings: Object.assign({ weights: Object.assign({}, DEFAULT_WEIGHTS) }, d.settings || {}),
    archives: d.archives || [],
    activeId: (d.archives && d.archives[0]) ? d.archives[0].id : null
  };
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.archives) return s;
    }
  } catch (e) { /* 忽略 */ }
  // 无本地数据时，预置示例案例，保证首次打开即可演示
  return seedDemoState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('数据保存失败：浏览器本地存储不可用');
  }
}

let state = loadState();

function getArchive() {
  return state.archives.find(function (a) { return a.id === state.activeId; }) || null;
}

function ensureArchive() {
  if (state.archives.length === 0) {
    const a = makeArchive('未命名需求');
    state.archives.push(a);
    state.activeId = a.id;
    saveState();
  } else if (!getArchive()) {
    state.activeId = state.archives[0].id;
  }
}

function makeArchive(name) {
  return {
    id: uid(),
    name: name || '未命名需求',
    createdAt: Date.now(),
    profile: null,
    history: [],
    candidates: []
  };
}

/* =========================================================
 * 右上角：需求档案切换器（文字 + 下拉菜单）
 * ========================================================= */
function closeArchiveMenu() {
  const m = $('archiveMenu');
  if (m) m.classList.add('hidden');
}

function toggleArchiveMenu() {
  const m = $('archiveMenu');
  if (m) m.classList.toggle('hidden');
}

function renderArchiveSwitcher() {
  const nameEl = $('archiveCurrentName');
  const cur = getArchive();
  if (nameEl) nameEl.textContent = cur ? (cur.name || '未命名需求') : '未命名需求';
  if (nameEl && cur && cur.demo) nameEl.textContent += '（示例）';
  const listEl = $('archiveMenuList');
  if (listEl) {
    listEl.innerHTML = '';
    state.archives.forEach(function (a) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'archive-menu-item' + (a.id === state.activeId ? ' active' : '');
      item.textContent = (a.id === state.activeId ? '✓ ' : '') + (a.name || '未命名需求') + (a.demo ? '（示例）' : '');
      item.onclick = function () {
        state.activeId = a.id;
        saveState();
        closeArchiveMenu();
        renderArchiveSwitcher();
        refreshAll();
      };
      listEl.appendChild(item);
    });
  }
  $('archiveName').value = cur ? (cur.name || '') : '';
}

/* =========================================================
 * 页签
 * ========================================================= */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  ['profile', 'search', 'candidates'].forEach(function (p) {
    $('tab-' + p).classList.toggle('active', p === name);
  });
}

/* =========================================================
 * 画像页
 * ========================================================= */
let editorChips = { aliases: [], must: [], nice: [], exclude: [] };

function populateProfileEditor(profile) {
  if (!profile) return;
  $('pTitleZh').value = profile.titleZh || '';
  $('pTitleEn').value = profile.titleEn || '';
  $('pYearsMin').value = profile.yearsMin == null ? '' : profile.yearsMin;
  $('pYearsMax').value = profile.yearsMax == null ? '' : profile.yearsMax;
  const yearsNoteEl = $('yearsNote');
  if (yearsNoteEl) {
    if (profile.yearsNote && profile.yearsMin != null) {
      yearsNoteEl.textContent = '年限识别依据：“' + profile.yearsNote + '” → ' + profile.yearsMin + '-' + profile.yearsMax + ' 年';
    } else if (profile.yearsMin != null) {
      yearsNoteEl.textContent = '经验区间：' + (profile.yearsMin == null ? '' : profile.yearsMin) + '-' + (profile.yearsMax == null ? '以上' : profile.yearsMax) + ' 年';
    } else {
      yearsNoteEl.textContent = '未识别到年限要求，请手动填写（如区间 3-5 年，或下限 3 年）';
    }
  }
  $('pEdu').value = profile.education || '';
  $('pIndustry').value = profile.industry || '';
  $('pCompanies').value = (profile.companies || []).join('，');
  $('pLocation').value = profile.location || '';
  editorChips = {
    aliases: (profile.aliases || []).slice(),
    must: (profile.must || []).slice(),
    nice: (profile.nice || []).slice(),
    exclude: (profile.exclude || []).slice()
  };
  renderChips('pAliases', editorChips.aliases, function () {});
  renderChips('pMust', editorChips.must, function () {});
  renderChips('pNice', editorChips.nice, function () {});
  renderChips('pExclude', editorChips.exclude, function () {});
  $('profileEditor').classList.remove('hidden');
}

function readProfileFromEditor(profile) {
  profile.titleZh = $('pTitleZh').value.trim();
  profile.titleEn = $('pTitleEn').value.trim();
  profile.aliases = editorChips.aliases.slice();
  profile.must = editorChips.must.slice();
  profile.nice = editorChips.nice.slice();
  profile.yearsMin = $('pYearsMin').value === '' ? null : parseInt($('pYearsMin').value, 10);
  profile.yearsMax = $('pYearsMax').value === '' ? null : parseInt($('pYearsMax').value, 10);
  profile.education = $('pEdu').value;
  profile.industry = $('pIndustry').value.trim();
  profile.companies = unique($('pCompanies').value.split(/[，,、]/));
  profile.location = $('pLocation').value.trim();
  profile.exclude = editorChips.exclude.slice();
  // 与必备条件重复的加分项自动移除
  const mustList = editorChips.must.slice();
  const dupNice = editorChips.nice.filter(function (x) { return mustList.indexOf(x) >= 0; });
  if (dupNice.length) {
    editorChips.nice = editorChips.nice.filter(function (x) { return mustList.indexOf(x) < 0; });
    renderChips('pNice', editorChips.nice, function () {}, '回车添加');
    toast('与必备条件重复的加分项已自动移除：' + dupNice.join('、'));
  }
  profile.nice = editorChips.nice.slice();
  profile.variants = generateVariants(profile);
  return profile;
}

function renderConfirmChecklist(profile) {
  const box = $('confirmChecklist');
  const items = buildConfirmChecklist(profile);
  if (!items.length) { box.classList.add('hidden'); return; }
  box.innerHTML = '<h4>建议先和用人经理确认</h4><ul>' + items.slice(0, 5).map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
  box.classList.remove('hidden');
}

function runRuleParseJd() {
  const text = $('jdInput').value;
  if (!text.trim()) { toast('请先粘贴 JD 文本'); return; }
  const archive = getArchive();
  if (!archive) return;
  const profile = parseJD(text);
  archive.profile = profile;
  if (!archive.name || archive.name === '未命名需求') {
    archive.name = (profile.titleZh || '新需求') + ' 需求';
  }
  saveState();
  populateProfileEditor(profile);
  renderConfirmChecklist(profile);
  renderArchiveSwitcher();
  toast('解析完成，请确认画像');
}

function onSaveProfile() {
  const archive = getArchive();
  if (!archive || !archive.profile) { toast('请先解析 JD'); return; }
  readProfileFromEditor(archive.profile);
  saveState();
  renderConfirmChecklist(archive.profile);
  toast('画像已保存');
}

function onGoSearch() {
  const archive = getArchive();
  if (!archive) return;
  try {
    if (archive.profile && !$('profileEditor').classList.contains('hidden')) {
      readProfileFromEditor(archive.profile);
      pushHistory(archive);
    }
  } catch (e) {
    console.error('生成搜索指令时出错：', e);
  }
  saveState();
  switchTab('search');
  renderSearch();
  toast('已生成搜索指令，可直接复制使用');
}

/* =========================================================
 * 搜索页
 * ========================================================= */
function pushHistory(archive) {
  const profile = archive.profile;
  if (!profile || !profile.titleZh) return;
  const channels = buildChannelInstructions(profile);
  archive.history.push({
    id: uid(),
    time: Date.now(),
    label: '生成搜索指令 · ' + profile.titleZh,
    general: {
      cnPrecise: buildBoolean(profile, { lang: 'cn', mode: 'precise' }),
      cnLoose: buildBoolean(profile, { lang: 'cn', mode: 'loose' }),
      enPrecise: buildBoolean(profile, { lang: 'en', mode: 'precise' }),
      enLoose: buildBoolean(profile, { lang: 'en', mode: 'loose' })
    },
    channels: channels
  });
  if (archive.history.length > 50) archive.history = archive.history.slice(-50);
}

function boolBlock(label, text) {
  const wrap = document.createElement('div');
  wrap.className = 'bool-block';
  const tag = document.createElement('span');
  tag.className = 'label-tag';
  tag.textContent = label;
  const code = document.createElement('div');
  code.className = 'bool-input';
  code.textContent = text;
  const btn = document.createElement('button');
  btn.className = 'btn btn-sm copy-btn';
  btn.textContent = '复制';
  btn.onclick = function () { copyText(text); };
  wrap.appendChild(tag);
  wrap.appendChild(code);
  wrap.appendChild(btn);
  return wrap;
}

function renderSearch() {
  const archive = getArchive();
  const empty = $('searchEmpty');
  const content = $('searchContent');
  if (!archive || !archive.profile || !archive.profile.titleZh) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');

  const profile = archive.profile;
  const variants = profile.variants || [];
  renderChips('variantChips', variants, function (list) {
    profile.variants = list;
    saveState();
  }, '补充关键词，回车保存');
  $('btnAddVariant').onclick = function () {
    const inp = document.querySelector('#variantChips .chip-input');
    if (inp) inp.focus();
  };

  // 人才梯队搜索策略
  renderTiers(profile);

  // 通用指令
  const general = $('generalBooleans');
  general.innerHTML = '';
  general.appendChild(boolBlock('中文·精准', buildBoolean(profile, { lang: 'cn', mode: 'precise' })));
  general.appendChild(boolBlock('中文·宽松', buildBoolean(profile, { lang: 'cn', mode: 'loose' })));
  general.appendChild(boolBlock('英文·精准', buildBoolean(profile, { lang: 'en', mode: 'precise' })));
  general.appendChild(boolBlock('英文·宽松', buildBoolean(profile, { lang: 'en', mode: 'loose' })));

  // 渠道卡片
  const channels = buildChannelInstructions(profile);
  const grid = $('channelCards');
  grid.innerHTML = '';
  channels.forEach(function (ch) {
    const def = CHANNEL_DEFS.find(function (d) { return d.id === ch.id; });
    if (!def) return;
    const card = document.createElement('div');
    card.className = 'channel-card';
    const head = document.createElement('div');
    head.className = 'ch-head';
    const name = document.createElement('span');
    name.className = 'ch-name';
    name.textContent = def.name;
    const tag = document.createElement('span');
    tag.className = 'ch-tag' + (def.depth === 'basic' ? ' basic' : '');
    tag.textContent = def.depth === 'deep' ? '深度支持' : '基础支持';
    head.appendChild(name);
    head.appendChild(tag);
    card.appendChild(head);
    const note = document.createElement('p');
    note.className = 'ch-note';
    note.textContent = def.note;
    card.appendChild(note);
    if (ch.google) card.appendChild(boolBlock('Google 绕过版', ch.google));
    if (ch.googleCn) card.appendChild(boolBlock('Google 中文版', ch.googleCn));
    if (ch.filtersAdvice) {
      const fa = document.createElement('p');
      fa.className = 'ch-tip';
      fa.innerHTML = '<b>筛选器：</b>' + ch.filtersAdvice;
      card.appendChild(fa);
    }
    const tipList = document.createElement('ul');
    tipList.className = 'ch-tip-list';
    (def.tips || []).forEach(function (tip) {
      const li = document.createElement('li');
      li.textContent = tip;
      tipList.appendChild(li);
    });
    card.appendChild(tipList);
    if (def.fallback && def.fallback.length) {
      const fh = document.createElement('p');
      fh.className = 'ch-fallback-title';
      fh.textContent = '搜索效果不好时：';
      card.appendChild(fh);
      const fl = document.createElement('ol');
      fl.className = 'ch-fallback-list';
      def.fallback.forEach(function (tip, i) {
        const li = document.createElement('li');
        const num = document.createElement('span');
        num.className = 'ch-fallback-num';
        num.textContent = (i + 1) + '、';
        li.appendChild(num);
        li.appendChild(document.createTextNode(tip));
        fl.appendChild(li);
      });
      card.appendChild(fl);
    }
    grid.appendChild(card);
  });

  // 渠道策略建议
  const tips = $('strategyTips');
  tips.innerHTML = '<ul class="strategy-list">' + STRATEGY_TIPS.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';

  // 指令历史
  renderHistory();
}

function renderTiers(profile) {
  const box = $('tierCards');
  if (!box) return;
  box.innerHTML = '';
  buildTierStrategy(profile).forEach(function (tier) {
    const card = document.createElement('div');
    card.className = 'tier-card';
    const head = document.createElement('div');
    head.className = 'tier-head';
    const num = document.createElement('span');
    num.className = 'tier-num';
    num.textContent = tier.id;
    const title = document.createElement('span');
    title.className = 'ch-name';
    title.textContent = tier.title;
    head.appendChild(num);
    head.appendChild(title);
    card.appendChild(head);
    const desc = document.createElement('p');
    desc.className = 'tier-desc';
    desc.textContent = tier.desc;
    card.appendChild(desc);
    tier.cnCombos.forEach(function (c) {
      card.appendChild(boolBlock('中文 · ' + c.label, c.text));
    });
    tier.enCombos.forEach(function (c) {
      card.appendChild(boolBlock('英文 · ' + c.label, c.text));
    });
    const ul = document.createElement('ul');
    ul.className = 'tier-tips';
    tier.tips.forEach(function (t) {
      const li = document.createElement('li');
      li.textContent = t;
      ul.appendChild(li);
    });
    card.appendChild(ul);
    box.appendChild(card);
  });
}

function renderHistory() {
  const archive = getArchive();
  const box = $('historyList');
  box.innerHTML = '';
  if (!archive || !archive.history.length) {
    box.innerHTML = '<p class="hint">暂无历史记录。每次点击「生成搜索指令」都会留痕。</p>';
    return;
  }
  archive.history.slice().reverse().forEach(function (h) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const det = document.createElement('details');
    const sum = document.createElement('summary');
    sum.innerHTML = h.label + ' <span class="h-time">· ' + fmtDate(h.time) + '</span>';
    det.appendChild(sum);
    const body = document.createElement('div');
    if (h.general) {
      body.appendChild(boolBlock('中文·精准', h.general.cnPrecise));
      body.appendChild(boolBlock('中文·宽松', h.general.cnLoose));
      body.appendChild(boolBlock('英文·精准', h.general.enPrecise));
      body.appendChild(boolBlock('英文·宽松', h.general.enLoose));
    }
    (h.channels || []).forEach(function (ch) {
      const def = CHANNEL_DEFS.find(function (d) { return d.id === ch.id; });
      const label = def ? def.name : ch.id;
      body.appendChild(boolBlock(label + '·精准', ch.precise));
      body.appendChild(boolBlock(label + '·宽松', ch.loose));
      if (ch.google) body.appendChild(boolBlock(label + '·Google', ch.google));
    });
    det.appendChild(body);
    item.appendChild(det);
    box.appendChild(item);
  });
}

/* =========================================================
 * 候选人：评分 / 排序 / 表格
 * ========================================================= */
function recalcCandidate(candidate, archive) {
  const parsed = candidate.parsed || {};
  const ai = candidate.ai && candidate.ai.scores ? candidate.ai : null;
  let result;
  if (ai) {
    // AI 评分：六维分来自 AI，综合分按当前权重合成
    result = {
      scores: ai.scores,
      total: weightedTotal(ai.scores, state.settings.weights),
      highlights: ai.highlights || [],
      concerns: ai.concerns || [],
      questions: ai.questions || [],
      suggestion: ai.suggestion || '',
      summary: ai.summary || '',
      skillInferred: {}
    };
  } else {
    result = analyzeCandidate(parsed, archive.profile || {}, state.settings.weights);
  }
  candidate.name = parsed.name;
  candidate.title = parsed.title;
  candidate.company = parsed.company;
  candidate.years = parsed.years;
  // 学校层次展示：旧候选人没有 schoolNote 时用简历原文重新识别
  const school = parsed.schoolNote ? { note: String(parsed.schoolNote).split('/') } : extractSchoolFactor(parsed.rawText || '');
  candidate.education = school.note.length ? (parsed.education || '') + ' · ' + school.note.join('/') : parsed.education;
  candidate.industry = parsed.industry;
  candidate.scores = result.scores;
  candidate.total = result.total;
  candidate.highlights = result.highlights;
  candidate.concerns = result.concerns;
  candidate.questions = result.questions;
  candidate.suggestion = result.suggestion;
  candidate.summary = result.summary;
  candidate.achievements = ai && ai.achievements ? ai.achievements : parsed.achievements;
}

function orderedCandidates(archive) {
  const showRemoved = $('showRemoved') && $('showRemoved').checked;
  const sortKey = $('sortSelect') ? $('sortSelect').value : 'total';
  const list = archive.candidates.filter(function (c) { return showRemoved || !c.removed; });
  const pinned = list.filter(function (c) { return c.pinned; });
  const frozen = list.filter(function (c) { return !c.pinned && c.frozen; });
  const rest = list.filter(function (c) { return !c.pinned && !c.frozen; });
  const by = function (a, b) {
    if (sortKey === 'createdAt') return b.createdAt - a.createdAt;
    const va = a.scores && a.scores[sortKey] != null ? a.scores[sortKey] : a.total;
    const vb = b.scores && b.scores[sortKey] != null ? b.scores[sortKey] : b.total;
    return vb - va || a.createdAt - b.createdAt;
  };
  rest.sort(by);
  frozen.sort(function (a, b) { return a._frozenAt - b._frozenAt || a.createdAt - b.createdAt; });
  pinned.sort(function (a, b) { return a._pinnedAt - b._pinnedAt || a.createdAt - b.createdAt; });
  return pinned.concat(frozen, rest);
}

function scoreClass(v) {
  if (v >= 85) return 'score-high';
  if (v >= 70) return 'score-mid';
  if (v >= 60) return 'score-low';
  return 'score-bad';
}

function renderCandidates() {
  const archive = getArchive();
  if (!archive) return;
  const empty = $('candEmpty');
  const content = $('candContent');
  if (!archive.candidates.length) {
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  content.classList.remove('hidden');

  // 优先联系提示
  const active = archive.candidates.filter(function (c) { return !c.removed; })
    .slice().sort(function (a, b) { return b.total - a.total; }).slice(0, 3);
  const tip = $('priorityTip');
  if (active.length) {
    tip.innerHTML = '<b>建议优先联系：</b>' + active.map(function (c) { return (c.name || '候选人') + '（' + c.total + ' 分）'; }).join('、') + '。联系前先按「待核实问题」确认关键信息。';
    tip.classList.remove('hidden');
  } else {
    tip.classList.add('hidden');
  }

  const rows = $('candidateRows');
  rows.innerHTML = '';
  const ordered = orderedCandidates(archive);
  ordered.forEach(function (c, idx) {
    const tr = document.createElement('tr');
    if (c.removed) tr.className = 'removed';
    const s = c.scores || {};
    const cell = function (txt, cls) {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      td.textContent = txt == null ? '—' : txt;
      return td;
    };
    const flags = document.createElement('td');
    if (c.pinned) flags.appendChild(Object.assign(document.createElement('span'), { className: 'flag pin-flag', textContent: '📌' }));
    if (c.frozen) flags.appendChild(Object.assign(document.createElement('span'), { className: 'flag frozen-flag', textContent: '❄' }));
    if (c.highlights && c.highlights.length) flags.appendChild(Object.assign(document.createElement('span'), { className: 'flag', textContent: '✨' + c.highlights.length }));
    if (c.concerns && c.concerns.length) flags.appendChild(Object.assign(document.createElement('span'), { className: 'flag', textContent: '⚠' + c.concerns.length }));

    const nameTd = document.createElement('td');
    nameTd.innerHTML = '<div class="cand-name">' + (c.name || '未命名') + '</div><div class="cand-meta">' + (c.company || '') + (c.title ? ' · ' + c.title : '') + '</div>';

    const totalTd = document.createElement('td');
    totalTd.appendChild(Object.assign(document.createElement('span'), { className: 'score-badge ' + scoreClass(c.total), textContent: c.total }));

    const actTd = document.createElement('td');
    const actBox = document.createElement('div');
    actBox.className = 'row-actions';
    const mkBtn = function (label, fn) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = function (e) { e.stopPropagation(); fn(); };
      return b;
    };
    actBox.appendChild(mkBtn(c.pinned ? '取消置顶' : '置顶', function () {
      c.pinned = !c.pinned;
      c._pinnedAt = Date.now();
      saveState(); renderCandidates();
    }));
    actBox.appendChild(mkBtn('重命名', function () {
      const n = prompt('输入新的候选人姓名：', c.name || '');
      if (n === null) return;
      const v = n.trim();
      if (!v) { toast('姓名不能为空'); return; }
      c.name = v;
      if (c.parsed) c.parsed.name = v;
      saveState(); renderCandidates();
    }));
    actBox.appendChild(mkBtn(c.frozen ? '解冻' : '冻结', function () {
      c.frozen = !c.frozen;
      c._frozenAt = Date.now();
      saveState(); renderCandidates();
    }));
    actBox.appendChild(mkBtn(c.removed ? '恢复' : '移除', function () {
      c.removed = !c.removed;
      saveState(); renderCandidates();
    }));
    actTd.appendChild(actBox);

    tr.appendChild(cell(idx + 1));
    tr.appendChild(nameTd);
    tr.appendChild(cell(s.skill));
    tr.appendChild(cell(s.performance));
    tr.appendChild(cell(s.industry));
    tr.appendChild(cell(s.company));
    tr.appendChild(cell(s.experience));
    tr.appendChild(cell(s.education));
    tr.appendChild(totalTd);
    tr.appendChild(flags);
    tr.appendChild(actTd);
    tr.onclick = function () { openCandidateDetail(c.id); };
    rows.appendChild(tr);
  });
}

function renderWeights() {
  ['weightInputs', 'weightInputsSettings'].forEach(function (id) {
    const box = $(id);
    if (!box) return;
    box.innerHTML = '';
    Object.keys(WEIGHT_LABELS).forEach(function (key) {
      const label = document.createElement('label');
      label.textContent = WEIGHT_LABELS[key];
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = 0; inp.max = 100; inp.value = state.settings.weights[key] || 0;
      inp.dataset.k = key;
      inp.onchange = function () {
        const v = Math.max(0, Math.min(100, parseInt(inp.value, 10) || 0));
        inp.value = v;
        state.settings.weights[key] = v;
        syncWeights();
        const archive = getArchive();
        if (archive) {
          archive.candidates.forEach(function (c) { recalcCandidate(c, archive); });
          saveState(); renderCandidates();
        }
        saveState();
        toast('权重已更新，候选人已重新评分');
      };
      label.appendChild(inp);
      box.appendChild(label);
    });
  });
  updateWeightSum();
}

function syncWeights() {
  const w = state.settings.weights;
  ['weightInputs', 'weightInputsSettings'].forEach(function (id) {
    const box = $(id);
    if (!box) return;
    Object.keys(WEIGHT_LABELS).forEach(function (key) {
      const inp = box.querySelector('input[data-k="' + key + '"]');
      if (inp) inp.value = w[key] || 0;
    });
  });
}

function updateWeightSum() {
  const w = state.settings.weights;
  const sum = Object.keys(WEIGHT_LABELS).reduce(function (acc, k) { return acc + (w[k] || 0); }, 0);
  const el = $('weightSum');
  if (el) el.textContent = '当前权重合计：' + sum + '%' + (sum !== 100 ? '（不等于 100% 时按比例折算）' : '');
}

/* =========================================================
 * 添加候选人
 * ========================================================= */
let addData = { raw: '', skills: [], aiParsed: null, aiResult: null };

function openAddCandidate() {
  $('addText').value = '';
  $('addFile').value = '';
  $('addFileLabel').textContent = '未选择文件';
  ['addName', 'addTitle', 'addCompany', 'addYears', 'addEdu', 'addIndustry'].forEach(function (id) { $(id).value = ''; });
  addData = { raw: '', skills: [], aiParsed: null, aiResult: null };
  renderChips('addSkills', addData.skills, function (list) { addData.skills = list; }, '回车添加');
  $('addPreview').classList.add('hidden');
  $('modalAddCandidate').classList.remove('hidden');
}

function closeModal(id) {
  $(id).classList.add('hidden');
}

function extractPdfText(file) {
  return new Promise(function (resolve, reject) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) {
      reject(new Error('PDF 解析组件未加载（请确认 lib 文件夹完整）'));
      return;
    }
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
      file.arrayBuffer().then(function (buf) {
        pdfjsLib.getDocument({
          data: buf,
          cMapUrl: 'lib/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'lib/standard_fonts/',
          useSystemFonts: true,
          isEvalSupported: false,
          disableFontFace: true
        }).promise.then(function (pdf) {
          const tasks = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            tasks.push(pdf.getPage(i).then(function (page) {
              return page.getTextContent().then(function (tc) {
                return tc.items.map(function (it) { return it.str; }).join(' ');
              });
            }));
          }
          Promise.all(tasks).then(function (pages) {
            resolve(pages.join('\n'));
          }, function (e) {
            reject(new Error('提取文本失败：' + (e && e.message || e)));
          });
        }, function (e) {
          reject(new Error('解析文档结构失败：' + (e && e.message || e)));
        });
      }, function (e) {
        reject(new Error('读取文件失败：' + (e && e.message || e)));
      });
    } catch (e) {
      reject(new Error('PDF 解析异常：' + (e && e.message || e)));
    }
  });
}

function renderPdfPagesToCanvases(pdf, scale) {
  const tasks = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    tasks.push(pdf.getPage(i).then(function (page) {
      let viewport = page.getViewport({ scale: scale || 4 });
      // 防止超大页面超出画布上限
      const maxDim = 4200;
      if (Math.max(viewport.width, viewport.height) > maxDim) {
        const k = maxDim / Math.max(viewport.width, viewport.height);
        viewport = page.getViewport({ scale: (scale || 4) * k });
      }
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      return page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      }).promise.then(function () {
        return canvas;
      });
    }));
  }
  return Promise.all(tasks);
}

// OCR 前图像预处理：灰度 + 对比度拉伸，显著提升扫描件识别率
function preprocessCanvasForOcr(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++;
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= n * 0.01) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc >= n * 0.01) { hi = i; break; } }
  const span = (hi - lo) || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, Math.round((d[i] - lo) * 255 / span)));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function ocrPdfFile(file, onProgress) {
  return new Promise(function (resolve, reject) {
    const pdfjsLib = window.pdfjsLib;
    if (!pdfjsLib) { reject(new Error('PDF 解析组件未加载')); return; }
    if (!window.Tesseract) { reject(new Error('OCR 组件未加载（需要联网，请改用粘贴文本）')); return; }
    file.arrayBuffer().then(function (buf) {
      pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
        renderPdfPagesToCanvases(pdf, 4).then(function (canvases) {
          Tesseract.createWorker('chi_sim+eng', 1, {
            langPath: 'https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0'
          }).then(function (worker) {
            const texts = [];
            let idx = 0;
            const next = function () {
              if (idx >= canvases.length) {
                worker.terminate();
                resolve(texts.join('\n'));
                return;
              }
              if (onProgress) onProgress(idx + 1, canvases.length);
              preprocessCanvasForOcr(canvases[idx]);
              worker.recognize(canvases[idx]).then(function (res) {
                texts.push((res && res.data && res.data.text) || '');
                idx++;
                next();
              }, function (e) {
                worker.terminate();
                reject(e);
              });
            };
            next();
          }, reject);
        }, reject);
      }, reject);
    }, reject);
  });
}

function profileSummaryText(profile) {
  return [
    '岗位：' + (profile.titleZh || ''),
    '必备：' + (profile.must || []).join('、'),
    '加分：' + (profile.nice || []).join('、'),
    '行业：' + (profile.industry || ''),
    '年限：' + (profile.yearsMin == null ? '' : profile.yearsMin) + '-' + (profile.yearsMax == null ? '以上' : profile.yearsMax),
    '学历：' + (profile.education || ''),
    '目标公司：' + (profile.companies || []).join('、')
  ].join('\n');
}

function weightedTotal(scores, weights) {
  const w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
  const keys = ['skill', 'performance', 'industry', 'company', 'experience', 'education'];
  let sum = 0;
  keys.forEach(function (k) {
    if (typeof scores[k] === 'number') sum += scores[k] * w[k];
  });
  return Math.max(0, Math.min(100, Math.round(sum / 100)));
}

function applyAiParsed(data) {
  $('addName').value = data.name || '';
  $('addTitle').value = data.title || '';
  $('addCompany').value = data.company || '';
  $('addYears').value = data.years || '';
  $('addEdu').value = data.education || '';
  $('addIndustry').value = data.industry || '';
  addData.skills = (data.skills || []).slice(0, 10);
  renderChips('addSkills', addData.skills, function (list) { addData.skills = list; }, '回车添加');
  $('addPreview').classList.remove('hidden');
  const scores = data.scores || {};
  const labels = { skill: '职能', performance: '业绩', industry: '行业', company: '公司', experience: '经验', education: '学历' };
  $('aiScoreGrid').innerHTML = Object.keys(labels).map(function (k) {
    return '<div class="ai-score-item"><span>' + labels[k] + '</span><b>' + (scores[k] == null ? '—' : scores[k]) + '</b></div>';
  }).join('');
  const total = weightedTotal(scores, state.settings.weights);
  $('aiScoreNote').textContent = '综合分（按当前权重）：' + total + '。确认加入 Pipeline 后生效。';
  $('aiScorePreview').classList.remove('hidden');
}

function onParseResume() {
  const ta = $('addText');
  const file = $('addFile').files[0];
  if (!ta.value.trim() && !file) { toast('请先粘贴简历文本或上传 PDF'); return; }
  const cleanText = function (text) {
    // OCR / 粘贴文本可能出现中文间空格（如"阿 里 巴 巴"），统一清洗
    return String(text || '')
      .replace(/([\u4e00-\u9fa5])[ \t\u3000]+(?=[\u4e00-\u9fa5])/g, '$1')
      .replace(/([\u4e00-\u9fa5])[ \t]+(?=[，。、；：！？）】》」』])/g, '$1')
      .replace(/([（【《「『])[ \t]+(?=[\u4e00-\u9fa5])/g, '$1')
      .replace(/\u3000/g, ' ');
  };
  const finishRule = function (text) {
    ta.value = text;
    addData.raw = text;
    if (!text || text.trim().length === 0) {
      $('addFileLabel').textContent = '未提取到文本';
      toast('这份 PDF 是扫描件 / 图片型（没有文字层），无法提取文本。请粘贴简历文字版，或后续开启 OCR 识别。');
      return;
    }
    const parsed = parseResume(text);
    $('addName').value = parsed.name || '';
    $('addTitle').value = parsed.title || '';
    $('addCompany').value = parsed.company || '';
    $('addYears').value = parsed.years || '';
    $('addEdu').value = parsed.education || '';
    $('addIndustry').value = parsed.industry || '';
    addData.skills = parsed.skills.slice();
    renderChips('addSkills', addData.skills, function (list) { addData.skills = list; }, '回车添加');
    $('addPreview').classList.remove('hidden');
    toast('解析完成，请确认信息');
  };
  const finish = function (rawText) {
    const text = cleanText(rawText);
    ta.value = text;
    addData.raw = text;
    if (!text || text.trim().length === 0) {
      $('addFileLabel').textContent = '未提取到文本';
      toast('未提取到文本，请改用粘贴方式。');
      return;
    }
    const cfg = getAiConfig();
    const archive = getArchive();
    if (cfg.enabled && cfg.apiKey && archive && archive.profile) {
      $('addFileLabel').textContent = 'AI 解析+评分中（约 30-60 秒）…';
      const prompt = AI_RESUME_SCORE_PROMPT.replace('{{PROFILE}}', profileSummaryText(archive.profile)).replace('{{RESUME}}', text);
      callLLM([{ role: 'user', content: prompt }], cfg).then(function (content) {
        const data = parseAiJson(content);
        if (!data || typeof data !== 'object') throw new Error('AI 返回格式不正确');
        addData.aiParsed = data;
        addData.aiResult = data;
        applyAiParsed(data);
        $('addFileLabel').textContent = 'AI 解析+评分完成';
        toast('AI 解析+评分完成，请确认信息');
      }).catch(function (e) {
        $('addFileLabel').textContent = '已退回规则解析';
        finishRule(text);
        toast('AI 解析失败（' + (e && e.message || e) + '），已用规则解析兜底');
      });
    } else {
      if (!cfg.enabled || !cfg.apiKey) toast('AI 未启用，已用规则解析');
      else toast('请先在人才画像页完成 JD 解析，当前用规则解析');
      finishRule(text);
    }
  };
  if (file) {
    $('addFileLabel').textContent = '正在解析 PDF…';
    extractPdfText(file).then(function (text) {
      if (text && text.trim().length > 0) {
        $('addFileLabel').textContent = file.name + '（已解析）';
        finish(text);
      } else {
        // 图片型 / 扫描件 PDF：自动走 OCR
        $('addFileLabel').textContent = '检测到扫描件，正在准备 OCR…';
        ocrPdfFile(file, function (cur, total) {
          $('addFileLabel').textContent = 'OCR 识别中 ' + cur + '/' + total + ' 页（首次使用需联网下载模型，可能需要几分钟）…';
        }).then(function (ocrText) {
          if (!ocrText || !ocrText.trim()) {
            $('addFileLabel').textContent = 'OCR 未识别到内容';
            toast('OCR 未能识别出文字，请改用粘贴文本。');
            return;
          }
          $('addFileLabel').textContent = file.name + '（OCR 识别完成）';
          finish(ocrText);
        }).catch(function (e) {
          $('addFileLabel').textContent = 'OCR 失败';
          toast('OCR 失败：' + (e && e.message ? e.message : '未知错误') + '。可改用粘贴文本；OCR 需要联网。');
        });
      }
    }).catch(function (e) {
      $('addFileLabel').textContent = '解析失败，请粘贴文本';
      toast('PDF 解析失败：' + (e && e.message ? e.message : '未知错误') + '。可改用粘贴文本。');
    });
  } else {
    finish(ta.value);
  }
}

function onAddConfirm() {
  const archive = getArchive();
  if (!archive) return;
  if (!addData.raw.trim()) { toast('请先解析简历'); return; }
  const aiParsed = addData.aiParsed || {};
  const parsed = {
    rawText: addData.raw,
    name: $('addName').value.trim(),
    title: $('addTitle').value.trim(),
    company: $('addCompany').value.trim(),
    years: parseInt($('addYears').value, 10) || 0,
    education: $('addEdu').value.trim(),
    schoolNote: aiParsed.schoolNote || '',
    industry: $('addIndustry').value.trim(),
    skills: addData.skills.slice(),
    achievements: (aiParsed.achievements || []).slice(0, 5),
    stability: analyzeStability(addData.raw, addData.raw.split(/\r?\n/))
  };
  const candidate = {
    id: uid(),
    createdAt: Date.now(),
    pinned: false,
    frozen: false,
    removed: false,
    ai: addData.aiResult || null,
    parsed: parsed
  };
  recalcCandidate(candidate, archive);
  archive.candidates.push(candidate);
  saveState();
  closeModal('modalAddCandidate');
  renderCandidates();
  toast('已加入 Pipeline 并完成评分');
}

/* =========================================================
 * 候选人详情
 * ========================================================= */
let detailCandidateId = null;

function openCandidateDetail(id) {
  const archive = getArchive();
  const c = archive && archive.candidates.find(function (x) { return x.id === id; });
  if (!c) return;
  detailCandidateId = id;
  const aiBadge = $('aiBadge');
  const aiSec = $('aiSummarySection');
  const aiBox = $('aiSummaryBox');
  if (c.summary || (c.aiAnalyzed && c.aiSummary)) {
    if (aiBadge) aiBadge.classList.remove('hidden');
    if (aiSec) aiSec.style.display = '';
    if (aiBox) aiBox.textContent = c.summary || c.aiSummary;
  } else {
    if (aiBadge) aiBadge.classList.add('hidden');
    if (aiSec) aiSec.style.display = 'none';
  }
  // AI 评分依据
  const evBox = $('aiEvidenceBox');
  const evList = $('aiEvidenceList');
  if (c.ai && c.ai.evidence) {
    const labels = { skill: '职能', performance: '业绩', industry: '行业', company: '公司', experience: '经验', education: '学历' };
    evList.innerHTML = Object.keys(labels).map(function (k) {
      return '<li><b>' + labels[k] + '</b>：' + (c.ai.evidence[k] || '—') + '</li>';
    }).join('');
    evBox.classList.remove('hidden');
  } else {
    evBox.classList.add('hidden');
  }
  $('cNameHead').textContent = (c.name || '候选人') + ' · 分析报告';
  $('cTitle').textContent = c.title || '—';
  $('cCompany').textContent = c.company || '—';
  $('cYears').textContent = c.years ? c.years + ' 年' : '—';
  $('cEdu').textContent = c.education || '—';
  $('cIndustry').textContent = c.industry || '—';
  const totalEl = $('cTotal');
  totalEl.textContent = c.total;
  totalEl.className = 'score-big ' + scoreClass(c.total);
  drawRadar(c.scores || {});
  drawBars(c.scores || {});
  $('highlightList').innerHTML = (c.highlights || []).length ? c.highlights.map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li class="hint">暂未识别到明显亮点</li>';
  $('concernList').innerHTML = (c.concerns || []).length ? c.concerns.map(function (x) { return '<li>' + x + '</li>'; }).join('') : '<li class="hint">暂未识别到明显顾虑</li>';
  $('questionList').innerHTML = (c.questions || []).map(function (x) { return '<li>' + x + '</li>'; }).join('');
  $('suggestionBox').textContent = c.suggestion || '';
  $('cRaw').textContent = (c.parsed && c.parsed.rawText) || '';
  $('modalCandidate').classList.remove('hidden');
}

/* =========================================================
 * AI 深度分析（可选，Key 仅存本机）
 * ========================================================= */
function ensureAiSettings() {
  let ai = state.settings.ai;
  // 首次使用或旧版本未配置 Key 时，自动补全为内置 DeepSeek 配置
  if (!ai || !ai.apiKey) {
    ai = Object.assign({}, DEFAULT_AI_CONFIG, ai || {});
    if (!ai.apiKey) ai.apiKey = DEFAULT_AI_CONFIG.apiKey;
    // 旧版本默认的 OpenAI 占位一并替换为 DeepSeek 默认
    if (!ai.baseUrl || ai.baseUrl === 'https://api.openai.com/v1') ai.baseUrl = DEFAULT_AI_CONFIG.baseUrl;
    if (!ai.model || ai.model === 'gpt-4o-mini') ai.model = DEFAULT_AI_CONFIG.model;
    ai.enabled = true;
    state.settings.ai = ai;
    saveState();
  }
  return state.settings.ai;
}

function getAiConfig() {
  return Object.assign({}, ensureAiSettings());
}

function updateAiButtons() {
  // AI 解析按钮始终可用；未启用或调用失败时自动退回规则解析
}

function renderAiSettings() {
  const ai = ensureAiSettings();
  $('aiEnabled').checked = !!ai.enabled;
  $('aiBaseUrl').value = ai.baseUrl || DEFAULT_AI_CONFIG.baseUrl;
  $('aiApiKey').value = ai.apiKey || '';
  $('aiModel').value = ai.model || DEFAULT_AI_CONFIG.model;
  updateAiButtons();
}

function saveAiSettingsFromInputs() {
  const ai = ensureAiSettings();
  ai.enabled = $('aiEnabled').checked;
  ai.baseUrl = $('aiBaseUrl').value.trim() || DEFAULT_AI_CONFIG.baseUrl;
  ai.apiKey = $('aiApiKey').value.trim();
  ai.model = $('aiModel').value.trim() || DEFAULT_AI_CONFIG.model;
  saveState();
  updateAiButtons();
}

function callLLM(messages, config) {
  return Promise.resolve().then(function () {
    const base = (config.baseUrl || DEFAULT_AI_CONFIG.baseUrl).replace(/\/+$/, '');
    return fetch(base + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_AI_CONFIG.model,
      messages: messages,
      temperature: 0.3
    })
  }).then(function (res) {
    if (!res.ok) {
      return res.text().then(function (t) {
        throw new Error('接口返回 ' + res.status + '：' + String(t).slice(0, 200));
      });
    }
    return res.json();
    }).then(function (data) {
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) throw new Error('接口未返回内容');
      return content;
    });
  });
}

function parseAiJson(text) {
  const cleaned = String(text || '').replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 返回不是有效 JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// 把 AI 返回的整句/长短语清洗成可用于匹配和搜索的关键词
function cleanKeyword(kw) {
  let s = String(kw || '').trim().replace(/^[\s\-•·*\d.、)）]+/, '');
  s = s.split(/[，。；、,;]/)[0].trim();
  s = s.replace(/^(负责|具备|拥有|掌握|熟悉|了解|需要|需|要求|要求具备|能够|可以|善于|擅长|具有|有|独立|协助|参与|主导|推动|完成|制定|搭建|建立|维护|跟进|开拓|开发|管理|带领|支持|配合|对接|协调|统筹|规划|执行|组织|策划|优先|加分)/, '');
  s = s.replace(/^(良好的|较强的|优秀的|扎实的|丰富的|熟练的|一定的|极强的|出色的|基础的|基本的)/, '');
  s = s.replace(/^\d+(\.\d+)?\s*[-–—~至到]?\s*\d*\s*(年|人)?/, '');
  s = s.replace(/(者加分|者优先|加分|优先|经验|能力|背景)$/, '');
  if (/^(本科|硕士|博士|大专|专科|学历|学位)/.test(s)) return '';
  if (/工作语言/.test(s)) return '英语';
  s = s.trim();
  return s.length >= 2 && s.length <= 12 ? s : '';
}

// 过滤 AI 把“至今=在职”当疑点产生的顾虑/问题（在职是正常状态）
function filterAiTimelineNoise(items, resumeText) {
  if (!/至今|现在|在职/i.test(resumeText || '')) return items || [];
  return (items || []).filter(function (x) {
    if (/是否在职|在职状态|在职情况/.test(x)) return false;
    if (/至今/.test(x) && /解释|说明|逻辑|状态|核实|确认|为什么/.test(x)) return false;
    return true;
  });
}

function testAiConnection() {
  saveAiSettingsFromInputs();
  const config = getAiConfig();
  const out = $('aiTestResult');
  if (!config.apiKey) { out.textContent = '请先填写 API Key'; return; }
  out.textContent = '测试中…';
  callLLM([{ role: 'user', content: 'ping' }], config).then(function () {
    out.textContent = '✓ 连接成功';
  }).catch(function (e) {
    out.textContent = '✗ 失败：' + (e && e.message || e);
  });
}

function aiParseJd() {
  const config = getAiConfig();
  const text = $('jdInput').value;
  if (!text.trim()) { toast('请先粘贴 JD'); return; }
  if (!config.enabled || !config.apiKey) {
    runRuleParseJd();
    toast('AI 未启用，已用规则解析兜底');
    return;
  }
  const btn = $('btnParseJd');
  btn.disabled = true;
  btn.textContent = 'AI 解析中…';
  callLLM([{ role: 'user', content: AI_JD_PROMPT + text }], config).then(function (content) {
    const data = parseAiJson(content);
    const archive = getArchive();
    if (!archive) return;
    const p = archive.profile || {};
    ['titleZh', 'titleEn', 'education', 'industry', 'location'].forEach(function (k) {
      if (data[k]) p[k] = data[k];
    });
    if (Array.isArray(data.aliases)) p.aliases = unique(data.aliases);
    if (Array.isArray(data.must)) p.must = unique(data.must.map(cleanKeyword).filter(Boolean)).slice(0, 14);
    if (Array.isArray(data.nice)) p.nice = unique(data.nice.map(cleanKeyword).filter(Boolean)).filter(function (x) { return p.must.indexOf(x) < 0; }).slice(0, 8);
    if (typeof data.yearsMin === 'number') p.yearsMin = data.yearsMin;
    if (typeof data.yearsMax === 'number') p.yearsMax = data.yearsMax;
    if (Array.isArray(data.companies)) p.companies = unique(data.companies);
    if (Array.isArray(data.exclude)) p.exclude = unique(data.exclude);
    p.variants = generateVariants(p);
    archive.profile = p;
    populateProfileEditor(p);
    renderConfirmChecklist(p);
    saveState();
    toast('AI 深度解析完成，请确认画像');
  }).catch(function (e) {
    runRuleParseJd();
    toast('AI 解析失败（' + (e && e.message || e) + '），已用规则解析兜底');
  }).then(function () {
    btn.disabled = false;
    btn.textContent = 'AI 解析 JD';
  });
}

function aiAnalyzeCurrent() {
  const config = getAiConfig();
  if (!config.enabled || !config.apiKey) { toast('请先在设置中启用并填写 AI 配置'); return; }
  const archive = getArchive();
  const c = archive && archive.candidates.find(function (x) { return x.id === detailCandidateId; });
  if (!c) return;
  const btn = $('btnAiAnalyze');
  btn.disabled = true;
  btn.textContent = 'AI 分析中…';
  const profile = archive.profile || {};
  const profileSummary = [
    '岗位：' + (profile.titleZh || ''),
    '必备：' + (profile.must || []).join('、'),
    '加分：' + (profile.nice || []).join('、'),
    '行业：' + (profile.industry || ''),
    '年限：' + (profile.yearsMin == null ? '' : profile.yearsMin) + '-' + (profile.yearsMax == null ? '以上' : profile.yearsMax)
  ].join('\n');
  const resume = (c.parsed && c.parsed.rawText) || '';
  const prompt = AI_RESUME_PROMPT.replace('{{PROFILE}}', profileSummary).replace('{{RESUME}}', resume);
  callLLM([{ role: 'user', content: prompt }], config).then(function (content) {
    const data = parseAiJson(content);
    if (Array.isArray(data.highlights)) c.highlights = data.highlights.slice(0, 8);
    if (Array.isArray(data.concerns)) c.concerns = filterAiTimelineNoise(data.concerns, resume).slice(0, 8);
    if (Array.isArray(data.questions)) c.questions = filterAiTimelineNoise(data.questions, resume).slice(0, 7);
    if (data.suggestion) c.suggestion = data.suggestion;
    if (data.summary) c.aiSummary = data.summary;
    c.aiAnalyzed = true;
    saveState();
    openCandidateDetail(c.id);
    renderCandidates();
    toast('AI 深度分析完成');
  }).catch(function (e) {
    toast('AI 分析失败：' + (e && e.message || e));
  }).then(function () {
    btn.disabled = false;
    btn.textContent = 'AI 深度分析';
  });
}

// 对单个候选人重新执行 AI 解析+评分
function aiRescoreCandidate(c, archive) {
  const config = getAiConfig();
  const resume = (c.parsed && c.parsed.rawText) || '';
  const profile = (archive && archive.profile) || {};
  if (!config.enabled || !config.apiKey) { toast('请先在设置中启用并填写 AI 配置'); return Promise.resolve(false); }
  if (!resume.trim()) { toast('该候选人没有简历原文，无法 AI 评分'); return Promise.resolve(false); }
  const prompt = AI_RESUME_SCORE_PROMPT.replace('{{PROFILE}}', profileSummaryText(profile)).replace('{{RESUME}}', resume);
  return callLLM([{ role: 'user', content: prompt }], config).then(function (content) {
    const data = parseAiJson(content);
    if (!data || typeof data !== 'object' || !data.scores) throw new Error('AI 返回格式不正确');
    if (data.name) c.parsed.name = data.name;
    if (data.title) c.parsed.title = data.title;
    if (data.company) c.parsed.company = data.company;
    if (typeof data.years === 'number') c.parsed.years = data.years;
    if (data.education) c.parsed.education = data.education;
    if (data.schoolNote) c.parsed.schoolNote = data.schoolNote;
    if (data.industry) c.parsed.industry = data.industry;
    if (Array.isArray(data.skills)) c.parsed.skills = data.skills.slice(0, 10);
    if (Array.isArray(data.achievements)) c.parsed.achievements = data.achievements.slice(0, 5);
    c.ai = data;
    recalcCandidate(c, archive);
    saveState();
    return true;
  });
}

// 批量 AI 评分（旧候选人补评分）
function aiScoreAll() {
  const archive = getArchive();
  if (!archive) return;
  const list = (archive.candidates || []).filter(function (c) { return !c.removed; });
  if (!list.length) { toast('当前需求还没有候选人'); return; }
  const config = getAiConfig();
  if (!config.enabled || !config.apiKey) { toast('请先在设置中启用并填写 AI 配置'); return; }
  if (!confirm('将为 ' + list.length + ' 位候选人各调用一次 AI（消耗 token，可能需要几分钟）。确定继续？')) return;
  const btn = $('btnAiScoreAll');
  btn.disabled = true;
  const run = function (i) {
    if (i >= list.length) {
      btn.disabled = false;
      saveState();
      renderCandidates();
      toast('AI 评分全部完成');
      return;
    }
    btn.textContent = 'AI 评分中 ' + (i + 1) + '/' + list.length + '…';
    aiRescoreCandidate(list[i], archive).then(function () {
      renderCandidates();
      run(i + 1);
    }).catch(function (e) {
      toast('第 ' + (i + 1) + ' 位评分失败：' + (e && e.message || e) + '，继续下一位');
      run(i + 1);
    });
  };
  run(0);
}

function drawRadar(scores) {
  const canvas = $('radarCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, R = 100;
  const keys = ['skill', 'performance', 'industry', 'company', 'experience', 'education'];
  ctx.clearRect(0, 0, W, H);
  // 网格
  [25, 50, 75, 100].forEach(function (pct) {
    ctx.beginPath();
    keys.forEach(function (k, i) {
      const ang = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      const r = R * pct / 100;
      const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  // 轴线 + 标签
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#5b6472';
  keys.forEach(function (k, i) {
    const ang = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(ang), cy + R * Math.sin(ang));
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    const lx = cx + (R + 20) * Math.cos(ang);
    const ly = cy + (R + 16) * Math.sin(ang);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(WEIGHT_LABELS[k], lx, ly);
  });
  // 数据多边形
  ctx.beginPath();
  keys.forEach(function (k, i) {
    const ang = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const r = R * (scores[k] || 0) / 100;
    const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(37, 99, 235, .22)';
  ctx.fill();
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBars(scores) {
  const box = $('scoreBars');
  box.innerHTML = '';
  Object.keys(WEIGHT_LABELS).forEach(function (key) {
    const row = document.createElement('div');
    row.className = 'score-bar-row';
    const label = document.createElement('span');
    label.className = 'sb-label';
    label.textContent = WEIGHT_LABELS[key];
    const track = document.createElement('div');
    track.className = 'sb-track';
    const fill = document.createElement('div');
    fill.className = 'sb-fill';
    fill.style.width = (scores[key] || 0) + '%';
    track.appendChild(fill);
    const val = document.createElement('span');
    val.className = 'sb-val';
    val.textContent = scores[key] || 0;
    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(val);
    box.appendChild(row);
  });
}

/* =========================================================
 * 导出 / 导入
 * ========================================================= */
function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

function exportCsv() {
  const archive = getArchive();
  if (!archive || !archive.candidates.length) { toast('没有候选人可导出'); return; }
  const head = ['排名', '姓名', '当前职位', '公司', '经验年限', '学历', '行业', '职能匹配', '业绩成果', '行业经验', '公司背景', '经验年限分', '学历分', '综合分', '亮点数', '顾虑数', '沟通建议'];
  const rows = [head];
  const ordered = orderedCandidates(archive);
  ordered.forEach(function (c, i) {
    const s = c.scores || {};
    rows.push([
      i + 1, c.name || '', c.title || '', c.company || '', c.years || '',
      c.education || '', c.industry || '', s.skill || 0, s.performance || 0,
      s.industry || 0, s.company || 0, s.experience || 0, s.education || 0,
      c.total, (c.highlights || []).length, (c.concerns || []).length,
      (c.suggestion || '').replace(/,/g, '，')
    ]);
  });
  const csv = '\ufeff' + rows.map(function (r) {
    return r.map(function (v) {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\n');
  download((archive.name || '需求') + '-候选人对比表.csv', csv, 'text/csv;charset=utf-8');
  toast('对比表已导出');
}

function exportAll() {
  const data = {
    app: 'recruiting-ai-sourcing',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    archives: state.archives
  };
  download('招聘寻源工具-数据备份-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(data, null, 2), 'application/json');
  toast('数据已导出');
}

function importAll(file) {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.archives)) throw new Error('格式不正确');
      if (!confirm('导入将覆盖当前全部数据（建议先导出备份）。确定继续？')) return;
      state.settings = data.settings || defaultState().settings;
      state.archives = data.archives;
      ensureArchive();
      saveState();
      renderArchiveSwitcher();
      refreshAll();
      toast('数据导入成功');
    } catch (e) {
      toast('导入失败：' + e.message);
    }
  };
  reader.readAsText(file);
}

function clearAll() {
  if (!confirm('确定清空全部数据？此操作不可恢复（建议先导出备份）。')) return;
  state = defaultState();
  ensureArchive();
  saveState();
  renderArchiveSwitcher();
  refreshAll();
  toast('已清空');
}

/* =========================================================
 * 刷新
 * ========================================================= */
function refreshAll() {
  const archive = getArchive();
  $('archiveName').value = archive ? (archive.name || '') : '';
  if (archive && archive.profile) {
    populateProfileEditor(archive.profile);
    $('profileEditor').classList.remove('hidden');
    renderConfirmChecklist(archive.profile);
    renderSearch();
  } else {
    $('profileEditor').classList.add('hidden');
    $('confirmChecklist').classList.add('hidden');
    $('searchEmpty').classList.remove('hidden');
    $('searchContent').classList.add('hidden');
  }
  renderCandidates();
}

/* =========================================================
 * 初始化
 * ========================================================= */
function init() {
  ensureArchive();
  renderArchiveSwitcher();
  renderWeights();
  refreshAll();

  // 页签
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });

  // 档案
  $('btnNewArchive').onclick = function () {
    const a = makeArchive('未命名需求');
    state.archives.push(a);
    state.activeId = a.id;
    saveState();
    renderArchiveSwitcher();
    refreshAll();
    $('archiveName').focus();
  };
  $('archiveTrigger').onclick = function (e) {
    e.stopPropagation();
    toggleArchiveMenu();
  };
  document.addEventListener('click', function (e) {
    const sw = document.querySelector('.archive-switcher');
    if (sw && !sw.contains(e.target)) closeArchiveMenu();
  });
  $('btnDeleteArchive').onclick = function () {
    const archive = getArchive();
    if (!archive) return;
    if (!confirm('确定删除需求「' + archive.name + '」？其候选人数据将一并删除（建议先导出备份）。')) return;
    state.archives = state.archives.filter(function (x) { return x.id !== archive.id; });
    ensureArchive();
    saveState();
    renderArchiveSwitcher();
    refreshAll();
    toast('已删除当前需求');
  };
  $('archiveName').addEventListener('change', function () {
    const archive = getArchive();
    if (archive) {
      archive.name = this.value.trim() || '未命名需求';
      saveState();
      renderArchiveSwitcher();
    }
  });

  // 画像页
  $('btnParseJd').onclick = aiParseJd;
  $('btnClearJd').onclick = function () { $('jdInput').value = ''; $('jdInput').focus(); };
  $('btnSaveProfile').onclick = onSaveProfile;
  $('btnGoSearch').onclick = onGoSearch;

  // 搜索页
  $('btnAddVariant').onclick = function () {
    const inp = document.querySelector('#variantChips .chip-input');
    if (inp) inp.focus();
  };

  // 候选人页
  $('btnAddCandidate').onclick = openAddCandidate;
  $('btnAddCandidateEmpty').onclick = openAddCandidate;
  const openUpload = function () {
    openAddCandidate();
    setTimeout(function () {
      const f = $('addFile');
      if (f) f.click();
    }, 150);
  };
  $('btnUploadResume').onclick = openUpload;
  $('btnUploadResumeEmpty').onclick = openUpload;
  $('btnExportCsv').onclick = exportCsv;
  $('btnRecalcAll').onclick = function () {
    const archive = getArchive();
    if (!archive) return;
    (archive.candidates || []).forEach(function (c) { recalcCandidate(c, archive); });
    saveState();
    renderCandidates();
    toast('已按最新评分规则重新评分全部候选人');
  };
  $('btnAiScoreAll').onclick = aiScoreAll;
  $('sortSelect').onchange = renderCandidates;
  $('showRemoved').onchange = renderCandidates;
  $('btnResetWeights').onclick = function () {
    state.settings.weights = Object.assign({}, DEFAULT_WEIGHTS);
    const archive = getArchive();
    if (archive) archive.candidates.forEach(function (c) { recalcCandidate(c, archive); });
    renderWeights();
    saveState();
    renderCandidates();
    toast('已恢复默认权重');
  };

  // 添加候选人弹窗
  $('btnParseResume').onclick = onParseResume;
  $('btnAddConfirm').onclick = onAddConfirm;
  $('addFile').onchange = function () {
    if (this.files && this.files[0]) $('addFileLabel').textContent = this.files[0].name;
  };

  // 详情弹窗
  $('btnAiRescore').onclick = function () {
    const archive = getArchive();
    const c = archive && archive.candidates.find(function (x) { return x.id === detailCandidateId; });
    if (!c) return;
    const btn = $('btnAiRescore');
    btn.disabled = true;
    btn.textContent = 'AI 评分中…';
    aiRescoreCandidate(c, archive).then(function () {
      openCandidateDetail(c.id);
      renderCandidates();
      toast('AI 重新评分完成');
    }).catch(function (e) {
      toast('AI 评分失败：' + (e && e.message || e));
    }).then(function () {
      btn.disabled = false;
      btn.textContent = 'AI 重新评分';
    });
  };
  $('btnReanalyze').onclick = function () {
    const archive = getArchive();
    const c = archive && archive.candidates.find(function (x) { return x.id === detailCandidateId; });
    if (!c) return;
    recalcCandidate(c, archive);
    saveState();
    openCandidateDetail(c.id);
    renderCandidates();
    toast('已重新分析');
  };
  $('btnDeleteCandidate').onclick = function () {
    const archive = getArchive();
    const c = archive && archive.candidates.find(function (x) { return x.id === detailCandidateId; });
    if (!c) return;
    c.removed = true;
    saveState();
    closeModal('modalCandidate');
    renderCandidates();
    toast('已从列表中移除（可在候选人页勾选“显示已剔除”恢复）');
  };

  // 设置弹窗
  $('btnSettings').onclick = function () {
    renderWeights();
    renderAiSettings();
    $('modalSettings').classList.remove('hidden');
  };
  $('btnExportAll').onclick = exportAll;
  $('btnImportAll').onclick = function () { $('importFile').click(); };
  $('btnExportAll2').onclick = exportAll;
  $('btnImportAll2').onclick = function () { $('importFile').click(); };
  $('btnRestoreDemo').onclick = function () {
    if (!confirm('将重新载入预置示例案例（B2B 市场经理 · 五位候选人），当前数据会被覆盖（建议先导出备份）。确定继续？')) return;
    state = seedDemoState();
    saveState();
    renderArchiveSwitcher();
    refreshAll();
    toast('已恢复示例案例');
  };
  $('btnClearData').onclick = clearAll;
  $('importFile').onchange = function () {
    if (this.files && this.files[0]) importAll(this.files[0]);
    this.value = '';
  };

  // AI 深度分析
  renderAiSettings();
  ['aiEnabled', 'aiBaseUrl', 'aiApiKey', 'aiModel'].forEach(function (id) {
    $(id).addEventListener('change', saveAiSettingsFromInputs);
  });
  $('btnAiTest').onclick = testAiConnection;
  $('btnAiAnalyze').onclick = aiAnalyzeCurrent;

  // 弹窗关闭
  document.querySelectorAll('.modal-close').forEach(function (b) {
    b.onclick = function () { closeModal(b.dataset.close); };
  });
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) {
      if (e.target === m) m.classList.add('hidden');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
