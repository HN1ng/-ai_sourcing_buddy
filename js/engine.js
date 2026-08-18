/* =========================================================
 * AI Sourcing Buddy · 规则引擎
 * JD 解析 / 关键词变体 / Boolean 生成 / 简历解析 / 六维评分
 * ========================================================= */
'use strict';

/* ---------- 基础工具 ---------- */
function norm(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesKw(text, kw) {
  const t = norm(text);
  const k = norm(kw);
  if (!k) return false;
  if (/[\u4e00-\u9fa5]/.test(k)) return t.includes(k);
  if (k.includes(' ')) return t.includes(k);
  return new RegExp('(^|[^a-z0-9])' + escapeRegExp(k) + '($|[^a-z0-9])', 'i').test(t);
}

function partialMatchKw(text, kw) {
  const t = norm(text);
  const k = norm(kw);
  if (!k) return false;
  if (includesKw(t, k)) return true;
  // 中文词按相邻两字做弱匹配：简历写“带领团队”可命中“带团队”
  if (/[\u4e00-\u9fa5]/.test(k) && k.length >= 3) {
    for (let i = 0; i + 2 <= k.length; i++) {
      const sub = k.slice(i, i + 2);
      if (t.includes(sub)) return true;
    }
  }
  return false;
}

function inferAbilityKw(text, kw) {
  const terms = ABILITY_INFERENCE[kw];
  if (!terms || !terms.length) return false;
  return terms.some(function (t) { return includesKw(text, t); });
}

function countMatches(text, list) {
  let n = 0;
  const seen = new Set();
  const sorted = (list || []).slice().sort(function (a, b) { return b.length - a.length; });
  sorted.forEach(function (kw) {
    if (seen.has(kw)) return;
    seen.add(kw);
    if (includesKw(text, kw)) {
      n++;
      // 命中较长词后，其子词不再重复计数（如"超额完成"与"超额"、"第一名"与"第一"）
      sorted.forEach(function (other) {
        if (other !== kw && kw.indexOf(other) >= 0) seen.add(other);
      });
    }
  });
  return n;
}

function unique(arr) {
  return Array.from(new Set((arr || []).filter(Boolean).map(function (x) { return x.trim(); })));
}

function splitTerms(str) {
  return String(str || '').split(/[、,，\/|\s]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(ts) {
  const d = new Date(ts);
  const p = function (n) { return n < 10 ? '0' + n : '' + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

/* =========================================================
 * JD 解析
 * ========================================================= */
function splitJDSections(text) {
  // 返回 { main, nice }，加分/优先部分与主体分开
  const idx = text.search(/加分项|加分条件|优先|具备以下|以下条件|加分|优先考虑|加分要求/);
  const main = idx < 0 ? text : text.slice(0, idx);
  const nice = idx < 0 ? '' : text.slice(idx);
  return { main: sanitizeForAbilities(main), nice: sanitizeForAbilities(nice) };
}

function sanitizeForAbilities(text) {
  // 去掉薪酬/福利类行，避免把薪资要求误判为能力词
  return String(text).split(/\r?\n/).filter(function (line) {
    const t = line.trim();
    return !/^(薪酬|薪资|待遇|工资|月薪|年薪|薪资范围|薪资待遇|福利|五险一金)/.test(t);
  }).join('\n');
}

function extractTitle(lines) {
  const markers = /招聘|诚聘|急聘|职位|岗位|经理|总监|专员|主管|经理|VP|总裁|Director|Manager|Specialist|Lead|Head/;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    let s = lines[i];
    if (!s) continue;
    s = s.replace(/^【|】$/g, '').replace(/^\d+[\.、)]\s*/, '');
    if (s.length > 40 && !/招聘|职位|岗位/.test(s)) continue;
    // 去掉公司前缀和“招聘”字样
    s = s.replace(/^[^，。；:：|｜\s]{0,20}公司\s*/, '');
    s = s.replace(/(?:诚聘|急聘|高薪诚聘|招聘|热招|招募|岗位|职位|欢迎加入)[:：]?\s*/g, '');
    s = s.replace(/\s*[|｜]\s*.*$/, '').trim();
    s = s.replace(/[（(][^（）()]*[）)]/g, '').trim();
    if (s && s.length <= 30) return s;
  }
  const first = lines.find(function (l) { return l && l.length > 0; }) || '';
  return first.slice(0, 30);
}

function matchFunctions(text) {
  const tags = [];
  Object.keys(FUNCTION_DICT).forEach(function (key) {
    if (FUNCTION_DICT[key].some(function (w) { return includesKw(text, w); })) tags.push(key);
  });
  return tags;
}

function matchAbility(text) {
  const found = [];
  const seen = {};
  ABILITY_TERMS.forEach(function (item) {
    if (seen[item.group]) return;
    if (includesKw(text, item.term)) {
      seen[item.group] = true;
      found.push(item.label);
    }
  });
  return found;
}

function matchIndustries(text) {
  const found = [];
  INDUSTRY_DICT.forEach(function (item) {
    if (item.words.some(function (w) { return includesKw(text, w); })) found.push(item.label);
  });
  return unique(found);
}

function matchCompanies(text) {
  const found = [];
  Object.keys(COMPANY_DICT).forEach(function (key) {
    if (key === 'tiers') return;
    COMPANY_DICT[key].forEach(function (name) {
      if (includesKw(text, name)) found.push(name);
    });
  });
  return unique(found);
}

function matchCities(text) {
  return unique(CITY_DICT.filter(function (c) { return includesKw(text, c); }));
}

function matchYears(text) {
  let min = null, max = null, m, note = '';
  // 1) 收集所有 “X-Y 年” 区间（支持 -、–、—、～、~、至、到），
  //    按上下文相关性选出最像“经验年限”的那一个
  const ranges = [];
  const reRange = /(\d{1,2})\s*[\u2010\u2013\u2014\u2212\uFF0D\uFF5E\-~至到]\s*(\d{1,2})\s*年/g;
  while ((m = reRange.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    const before = String(text).slice(Math.max(0, start - 20), start);
    const after = String(text).slice(end, end + 10);
    let score = 0;
    if (/(经验|工作|从业|年限)/.test(before + after)) score += 3;
    if (/^(以上|及以上)?(经验|相关经验|相关|工作|经历)/.test(after)) score += 3;
    if (/(相关|行业|市场|销售|运营|管理|技术|职能|背景|经历|领域)/.test(before + after)) score += 1;
    ranges.push({ min: parseInt(m[1], 10), max: parseInt(m[2], 10), note: m[0], score: score });
  }
  if (ranges.length) {
    ranges.sort(function (a, b) { return b.score - a.score; });
    const best = ranges[0];
    return { min: best.min, max: best.max, note: best.note.replace(/\s+/g, ' ') };
  }
  // 2) “X 年以上”经验要求：只认“经验 / 工作 / 从业 / 年限”语境，且取最大值
  const reAbove = /(?:经验|工作|从业|年限|相关|行业)[\s，。、；;：:]*?(?:至少|不低于|不少于)?\s*(\d{1,2})\s*年(?:以上|及以上|以上经验|以上相关经验|以上工作经验)/g;
  while ((m = reAbove.exec(text))) {
    const v = parseInt(m[1], 10);
    if (min == null || v > min) min = v;
    if (!note) note = m[0].replace(/\s+/g, ' ');
  }
  if (min == null) {
    const reSimple = /(?:至少|不低于|不少于)\s*(\d{1,2})\s*年/g;
    while ((m = reSimple.exec(text))) {
      const v = parseInt(m[1], 10);
      if (min == null || v > min) min = v;
      if (!note) note = m[0].replace(/\s+/g, ' ');
    }
  }
  if (min == null) {
    const reAny = /(\d{1,2})\s*年(?:以上|及以上)/g;
    while ((m = reAny.exec(text))) {
      const v = parseInt(m[1], 10);
      if (min == null || v > min) min = v;
      if (!note) note = m[0].replace(/\s+/g, ' ');
    }
  }
  // 3) 英文：X-Y years / at least X years / X+ years
  m = text.match(/(\d{1,2})\s*(?:[\u2010\u2013\u2014\u2212\uFF0D\uFF5E\-~]|to)\s*(\d{1,2})\s*\+?\s*years?/i);
  if (m) {
    return { min: parseInt(m[1], 10), max: parseInt(m[2], 10), note: m[0].replace(/\s+/g, ' ') };
  }
  const reE2 = /(?:at least|minimum|min\.?|over|more than|above)\s*(\d{1,2})\s*\+?\s*years?/gi;
  while ((m = reE2.exec(text))) {
    const v = parseInt(m[1], 10);
    if (min == null || v > min) min = v;
    if (!note) note = m[0].replace(/\s+/g, ' ');
  }
  const reE3 = /(\d{1,2})\s*\+?\s*years?/gi;
  while ((m = reE3.exec(text))) {
    const v = parseInt(m[1], 10);
    if (min == null || v > min) min = v;
    if (!note) note = m[0].replace(/\s+/g, ' ');
  }
  return { min: min, max: max, note: note };
}

function matchEducation(text) {
  if (/博士|PhD|Doctoral/i.test(text)) return '博士';
  if (/硕士|研究生|MBA|Master/i.test(text)) return '硕士';
  if (/本科|学士|Bachelor/i.test(text)) return '本科';
  if (/大专|专科|Associate/i.test(text)) return '大专';
  if (/学历不限|不限学历/.test(text)) return '';
  return '';
}

function matchSalary(text) {
  let m;
  m = text.match(/(\d+(?:\.\d+)?)\s*[-~至到]\s*(\d+(?:\.\d+)?)\s*万\s*(\/年|\/月)?/);
  if (m) return m[1] + '-' + m[2] + '万' + (m[3] || '/年');
  m = text.match(/(\d{2,4})\s*[-~至到]\s*(\d{2,4})\s*K/gi);
  if (m) return m[0].toUpperCase();
  return '';
}

function parseJD(text) {
  const t = String(text || '');
  const lines = t.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  const title = extractTitle(lines);
  const sections = splitJDSections(t);
  const funcTags = matchFunctions(title);
  const mustRaw = matchAbility(sections.main);
  const niceRaw = matchAbility(sections.nice);
  const years = matchYears(t);
  const edu = matchEducation(t);
  const profile = {
    titleZh: title,
    titleEn: '',
    aliases: [],
    functionTags: funcTags,
    must: mustRaw.slice(0, 14),
    nice: niceRaw.filter(function (x) { return mustRaw.indexOf(x) < 0; }).slice(0, 8),
    yearsMin: years.min,
    yearsMax: years.max,
    yearsNote: years.note || '',
    education: edu,
    industry: matchIndustries(t).join('、'),
    companies: [],
    location: matchCities(t).join('、'),
    salary: matchSalary(t),
    exclude: [],
    notes: ''
  };
  // 英文标题：从岗位名提取常见英文词
  const enMap = {
    '销售': 'Sales', '市场': 'Marketing', '运营': 'Operations', '产品': 'Product',
    '经理': 'Manager', '总监': 'Director', '主管': 'Supervisor', '专员': 'Specialist',
    '客服': 'Customer Service', '行政': 'Admin', '采购': 'Procurement', '财务': 'Finance',
    '法务': 'Legal', '人力': 'HR', '招聘': 'Recruiter'
  };
  Object.keys(enMap).forEach(function (zh) {
    if (includesKw(title, zh)) profile.titleEn = profile.titleEn ? profile.titleEn + ' ' + enMap[zh] : enMap[zh];
  });
  if (!profile.titleEn && /[a-zA-Z]/.test(title)) profile.titleEn = title;
  profile.variants = generateVariants(profile);
  return profile;
}

/* =========================================================
 * 关键词变体
 * ========================================================= */
function generateVariants(profile) {
  const v = [];
  profile.functionTags.forEach(function (tag) {
    FUNCTION_ALIASES[tag].forEach(function (a) { v.push(a); });
  });
  if (profile.titleZh) v.push(profile.titleZh);
  if (profile.titleEn) v.push(profile.titleEn);
  return unique(v).slice(0, 18);
}

/* =========================================================
 * Boolean 指令生成
 * ========================================================= */
function q(s) { return '"' + s + '"'; }

function orGroup(list, quoted) {
  const arr = unique(list).filter(Boolean);
  if (!arr.length) return '';
  return '(' + arr.map(function (x) { return quoted ? q(x) : x; }).join(' OR ') + ')';
}

function buildBoolean(profile, opts) {
  // opts: { lang: 'cn'|'en', mode: 'precise'|'loose' }
  const lang = opts.lang;
  const precise = opts.mode === 'precise';
  const titles = [];
  if (profile.titleZh) titles.push(profile.titleZh);
  profile.aliases.forEach(function (a) { titles.push(a); });
  profile.variants.forEach(function (a) { titles.push(a); });
  const titleList = unique(titles).slice(0, precise ? 6 : 4);

  const must = unique(profile.must || []).slice(0, precise ? 8 : 5);
  const industry = splitTerms(profile.industry);
  const companies = (profile.companies || []).slice(0, 4);
  const exclude = unique(profile.exclude || []).slice(0, 4);
  const exStr = exclude.length ? ' ' + exclude.map(function (x) { return '-' + x; }).join(' ') : '';

  const groups = [];
  groups.push(orGroup(titleList, lang === 'en'));
  if (precise && must.length) groups.push(orGroup(must, lang === 'en'));
  if (precise && industry.length) groups.push(orGroup(industry, lang === 'en'));
  if (precise && companies.length) groups.push(orGroup(companies, lang === 'en'));
  if (!precise) {
    if (must.length) groups.push(orGroup(must.slice(0, 4), lang === 'en'));
    if (industry.length) groups.push(orGroup(industry.slice(0, 2), lang === 'en'));
  }
  let instruction = groups.filter(Boolean).join(precise ? ' AND ' : ' ');
  instruction = (instruction || '').replace(/\(([^()]*)\)/g, function (m, inner) {
    // 单元素括号去掉括号，保留词本身
    if (!/ OR /.test(inner)) return inner;
    return m;
  });
  instruction += exStr;
  return instruction.trim();
}

function buildChannelInstructions(profile) {
  const cnPrecise = buildBoolean(profile, { lang: 'cn', mode: 'precise' });
  const cnLoose = buildBoolean(profile, { lang: 'cn', mode: 'loose' });
  const enPrecise = buildBoolean(profile, { lang: 'en', mode: 'precise' });
  const enLoose = buildBoolean(profile, { lang: 'en', mode: 'loose' });

  const titleZh = profile.titleZh || '';
  const mustZh = (profile.must || []).slice(0, 4).join(' ');
  const industryZh = profile.industry || '';
  const industryWords = splitTerms(profile.industry);
  const indWords = industryWords.slice(0, 2).join(' ');
  const enTitles = (profile.titleEn ? [profile.titleEn] : []).concat(
    (profile.variants || []).filter(function (x) { return /[a-zA-Z]/.test(x); })
  );
  const enTitleGroup = orGroup(unique(enTitles).slice(0, 5), true);
  const googleBase = 'site:linkedin.com/in ' + (enTitleGroup || q(titleZh)) +
    (industryWords.length ? ' ' + orGroup(industryWords, true) : '') +
    ' -recruiter -headhunter -talent acquisition';
  const googleCn = 'site:linkedin.com/in ' + q(titleZh) + (indWords ? ' ' + indWords : '') + ' -招聘 -猎头';
  // 脉脉不公开复杂布尔语法：改为多组可直接使用的关键词组合（引号=完整词组精准匹配）
  const must3 = (profile.must || []).slice(0, 3).join(' ');
  const loc = profile.location ? splitTerms(profile.location)[0] : '';
  const comp0 = profile.companies && profile.companies[0] ? profile.companies[0] : '';
  const combos = [];
  combos.push({ label: '岗位名+能力词', text: (q(titleZh) + ' ' + must3).trim() });
  combos.push({ label: '岗位名+行业词', text: (q(titleZh) + ' ' + indWords).trim() });
  if (loc) combos.push({ label: '岗位名+地点', text: (q(titleZh) + ' ' + loc).trim() });
  if (comp0) combos.push({ label: '公司定向', text: (q(comp0) + ' ' + titleZh).trim() });
  combos.push({ label: '宽松组合', text: (titleZh + ' ' + ((profile.must || [])[0] || '') + ' ' + indWords).trim() });

  return [
    {
      id: 'maimai',
      precise: q(titleZh) + (mustZh ? ' ' + mustZh : '') + (indWords ? ' ' + indWords : ''),
      loose: titleZh + ' ' + ((profile.must || [])[0] || '') + (indWords ? ' ' + indWords : ''),
      combos: combos,
      filters: ['行业', '公司', '职位', '地区', '工作年限', '学历', '活跃度'],
      filtersAdvice: '建议先圈：行业（' + (industryZh || '先和用人经理确认') + '）、工作年限、地区；公司定向搜索时只输“公司名 + 岗位名”。'
    },
    {
      id: 'linkedin',
      precise: enPrecise,
      loose: enLoose,
      google: googleBase.trim(),
      googleCn: googleCn.trim(),
      filtersAdvice: '免费版筛选器少，把行业/公司词写进布尔指令；地点可在筛选器里选。'
    },
    {
      id: 'liepin',
      precise: (titleZh || '') + (mustZh ? ' ' + mustZh : '') + (indWords ? ' ' + indWords : ''),
      loose: (titleZh || '') + ' ' + ((profile.must || [])[0] || ''),
      filtersAdvice: '高级筛选：学历、经验、城市、行业、薪资预期。'
    },
    {
      id: 'boss',
      precise: (titleZh || '') + (mustZh ? ' ' + mustZh : '') + (indWords ? ' ' + indWords : ''),
      loose: (titleZh || '') + ' ' + ((profile.must || [])[0] || ''),
      filtersAdvice: '筛选器：学历、经验、城市、行业、公司规模。'
    }
  ];
}

/* =========================================================
 * 人才梯队搜索策略（四层漏斗）
 * ========================================================= */
function matchIndustryLabels(industryStr) {
  const matched = [];
  INDUSTRY_DICT.forEach(function (item) {
    if (includesKw(industryStr, item.label) || item.words.some(function (w) { return includesKw(industryStr, w); })) {
      if (matched.indexOf(item.label) < 0) matched.push(item.label);
    }
  });
  return matched;
}

function getAdjacentIndustries(industryStr) {
  const matched = matchIndustryLabels(industryStr || '');
  const out = [];
  matched.forEach(function (label) {
    (INDUSTRY_ADJACENCY[label] || []).forEach(function (a) {
      if (matched.indexOf(a) < 0 && out.indexOf(a) < 0) out.push(a);
    });
  });
  if (!out.length) out.push('互联网', '企业服务 / SaaS', '金融', '消费 / 快消', '制造业');
  return out.slice(0, 6);
}

function industryEnWords(label) {
  const item = INDUSTRY_DICT.find(function (i) { return i.label === label; });
  if (!item) return label;
  const en = item.words.find(function (w) { return /[a-zA-Z]/.test(w) && w.length > 2; });
  return en || label;
}

function abilityEn(term) {
  return ABILITY_EN_MAP[term] || term;
}

function industryZhWord(label) {
  const item = INDUSTRY_DICT.find(function (i) { return i.label === label; });
  if (!item) return label;
  const zh = item.words.find(function (w) { return /[\u4e00-\u9fa5]/.test(w); });
  return zh || label;
}

function enTitleList(profile, n) {
  const list = [];
  if (profile.titleEn) list.push(profile.titleEn);
  (profile.variants || []).forEach(function (v) {
    if (/[a-zA-Z]/.test(v) && list.indexOf(v) < 0) list.push(v);
  });
  return list.slice(0, n || 6);
}

function cnTitleList(profile, n) {
  const list = [profile.titleZh];
  (profile.variants || []).forEach(function (v) {
    if (/[\u4e00-\u9fa5]/.test(v) && list.indexOf(v) < 0) list.push(v);
  });
  return list.slice(0, n || 6);
}

function buildTierStrategy(profile) {
  const titleZh = profile.titleZh || '';
  const must = (profile.must || []).slice(0, 5);
  const mustEn = unique(must.map(abilityEn)).slice(0, 4);
  const companies = (profile.companies || []).slice(0, 6);
  const inds = splitTerms(profile.industry);
  const adjacent = getAdjacentIndustries(profile.industry).slice(0, 4);
  const loc = splitTerms(profile.location)[0] || '';
  const enTitles = enTitleList(profile, 6);
  const cnTitles = cnTitleList(profile, 6);
  const enTitleGroup = orGroup(enTitles, true);
  const aliasesEn = [];
  const aliasesZh = [];
  profile.functionTags.forEach(function (tag) {
    (FUNCTION_ALIASES[tag] || []).forEach(function (a) {
      if (/[a-zA-Z]/.test(a) && aliasesEn.indexOf(a) < 0) aliasesEn.push(a);
      if (/[\u4e00-\u9fa5]/.test(a) && a !== titleZh && aliasesZh.indexOf(a) < 0) aliasesZh.push(a);
    });
  });
  const titleFallback = enTitleGroup || q(titleZh);

  const tiers = [];

  // 第一梯队：对标公司 × 相同岗位
  const t1Cn = companies.length
    ? companies.slice(0, 5).map(function (c) { return { label: c, text: (q(c) + ' ' + titleZh).trim() }; })
    : [{ label: '岗位名+地点', text: (q(titleZh) + (loc ? ' ' + loc : '')).trim() }];
  const t1En = [];
  if (companies.length) {
    t1En.push({ label: 'LinkedIn 布尔', text: orGroup(companies.slice(0, 5), true) + ' AND ' + titleFallback });
    t1En.push({ label: 'Google 绕过', text: 'site:linkedin.com/in ' + orGroup(companies.slice(0, 4), true) + ' ' + titleFallback + ' -recruiter -headhunter' });
  } else {
    t1En.push({ label: 'LinkedIn 布尔', text: titleFallback });
  }
  tiers.push({
    id: 1,
    title: '对标公司 × 相同岗位',
    desc: '最精准的一层：目标公司里正在做这个岗位的人，业务和资源最匹配，转化率最高。先搜这一层。',
    cnCombos: t1Cn,
    enCombos: t1En,
    tips: companies.length
      ? ['脉脉：公司定向搜索（"公司名 岗位名"）逐个公司搜。', 'LinkedIn：公司名 + 岗位名布尔；免费额度内先跑这层。', '触达：强调对标背景，直接谈机会和业务理解。']
      : ['先在「人才画像」页手动填写目标公司池，这里会自动生成"公司 + 岗位"组合。', '当前按"岗位名 + 地点"兜底搜索；填好公司后第一梯队会更精准。', '脉脉：公司定向搜索（"公司名 岗位名"）逐个公司搜。']
  });

  // 第二梯队：相近行业 × 相同岗位
  const t2Cn = adjacent.length
    ? adjacent.slice(0, 4).map(function (a) { return { label: a, text: (q(titleZh) + ' ' + industryZhWord(a)).trim() }; })
    : [{ label: '岗位名', text: q(titleZh) }];
  const t2En = [];
  if (adjacent.length) {
    const indEn = unique(adjacent.map(industryEnWords));
    t2En.push({ label: 'LinkedIn 布尔', text: titleFallback + ' AND ' + orGroup(indEn, true) });
    t2En.push({ label: 'Google 绕过', text: 'site:linkedin.com/in ' + titleFallback + ' ' + orGroup(indEn.slice(0, 3), true) + ' -recruiter' });
  } else {
    t2En.push({ label: 'LinkedIn 布尔', text: titleFallback });
  }
  tiers.push({
    id: 2,
    title: '相近行业 × 相同岗位',
    desc: '行业边界放宽一层：岗位相同、行业相近（如 SaaS ↔ 云计算 / 互联网），候选人上手快。',
    cnCombos: t2Cn,
    enCombos: t2En,
    tips: ['脉脉：岗位名（引号）+ 相邻行业词，逐个行业搜。', '猎聘 / BOSS：直接用"岗位名 行业词"组合。', '触达：强调行业相近、方法论可直接迁移。']
  });

  // 第三梯队：跨行业 × 岗位经验可复用
  const t3Cn = [
    { label: '岗位+能力词', text: (q(titleZh) + ' ' + must.slice(0, 3).join(' ')).trim() },
    { label: '纯能力词', text: must.slice(0, 4).join(' ') || titleZh }
  ];
  const t3En = [{
    label: 'LinkedIn 布尔',
    text: titleFallback + (mustEn.length ? ' AND ' + orGroup(mustEn, true) : '')
  }];
  tiers.push({
    id: 3,
    title: '跨行业 · 岗位经验可复用',
    desc: '不限行业，只按“岗位 + 核心能力”找人（如制造业 / 物流的销售总监）。销售方法论通用，触达时重点讲可迁移性。',
    cnCombos: t3Cn,
    enCombos: t3En,
    tips: ['脉脉：岗位名（引号）+ 能力词，不加行业词。', '此层数量大，先看业绩数字和团队规模再联系。', '触达：强调行业可迁移，先聊方法论和业绩口径。']
  });

  // 第四梯队：相似岗位 × 共同能力
  const t4Cn = [];
  aliasesZh.slice(0, 4).forEach(function (a, i) {
    const word = must[i] || must[0] || '能力';
    t4Cn.push({ label: a, text: (q(a) + ' ' + word).trim() });
  });
  if (!t4Cn.length) t4Cn.push({ label: '岗位+能力词', text: (q(titleZh) + ' ' + must.slice(0, 3).join(' ')).trim() });
  const t4En = [{
    label: 'LinkedIn 布尔',
    text: orGroup(aliasesEn.slice(0, 4), true) + (mustEn.length ? ' AND ' + orGroup(mustEn.slice(0, 3), true) : '')
  }];
  tiers.push({
    id: 4,
    title: '相似岗位 × 共同能力',
    desc: '最宽的一层：岗位叫法不同但能力重叠（如销售总监 ↔ 商务拓展总监 / 渠道总监）。用于补 pipeline，需要人工筛。',
    cnCombos: t4Cn,
    enCombos: t4En,
    tips: ['脉脉 / 猎聘 / BOSS：换岗位别名 + 能力词组合。', '此层候选人多、噪音大，重点看能力词命中数。', '触达：说明岗位差异，先确认共同能力是否匹配。']
  });

  return tiers;
}

/* =========================================================
 * 简历解析
 * ========================================================= */
function parseResume(text) {
  const t = String(text || '');
  const lines = t.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
  const name = extractName(t, lines);
  const titleCompany = extractTitleCompany(lines);
  const years = extractResumeYears(t);
  const edu = extractEdu(t);
  const school = extractSchoolFactor(t);
  const industry = matchIndustries(t).slice(0, 3).join('、');
  const skills = matchAbility(t).slice(0, 10);
  const achievements = extractAchievements(t);
  const stability = analyzeStability(t, lines);
  return {
    name: name,
    title: titleCompany.title,
    company: titleCompany.company,
    years: years,
    education: edu,
    schoolNote: school.note.join('/'),
    industry: industry,
    skills: skills,
    achievements: achievements,
    stability: stability
  };
}

function extractName(text, lines) {
  let m = text.match(/(?:姓名|Name)\s*[:：]\s*([\u4e00-\u9fa5·]{2,4})/);
  if (m) return m[1];
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const s = lines[i];
    if (/先生|女士|性别|男|女/.test(s)) {
      m = s.match(/([\u4e00-\u9fa5·]{2,4})(?:先生|女士|性别)/);
      if (m) return m[1];
    }
    if (/^[\u4e00-\u9fa5·]{2,4}$/.test(s)) return s;
  }
  return '';
}

function extractTitleCompany(lines) {
  let title = '', company = '';
  const titleRe = /经理|总监|主管|专员|代表|顾问|运营|市场|销售|客服|客户成功|HR|招聘|人事|财务|法务|行政|采购|总裁|副总裁|VP|Director|Manager|Specialist|Lead|Head|Officer/i;
  const cleanPart = function (s) {
    return String(s).replace(/^\d{4}[.\-\/年]*\d{0,2}?\s*[-–—~至到]+\s*[\d.\-\/年]*(?:至今|现在|今)?\s*/, '').trim();
  };
  // 1) 分隔符行：公司 | 职位
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const s = lines[i];
    if (!/[|｜]/.test(s)) continue;
    const parts = s.split(/[|｜]/);
    for (let j = 0; j < parts.length; j++) {
      const part = cleanPart(parts[j]);
      if (titleRe.test(part) && part.length <= 30) {
        title = part;
        company = cleanPart(parts[j - 1] || '');
        break;
      }
    }
    if (title) break;
  }
  // 2) 日期行：2018 - 至今 某公司 职位
  if (!title) {
    for (let i = 0; i < Math.min(lines.length, 8); i++) {
      const s = lines[i];
      if (!/(至今|现在|今)/.test(s)) continue;
      const m = s.match(/([\u4e00-\u9fa5A-Za-z0-9（）()]{2,24}(?:公司|集团|科技|网络|咨询|服务|有限|股份|银行))\s+([\u4e00-\u9fa5A-Za-z]{2,24})$/);
      if (m) { company = m[1]; title = m[2]; break; }
    }
  }
  // 3) 无日期短行
  if (!title) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const s = lines[i];
      if (titleRe.test(s) && s.length < 30) {
        title = s.replace(/^\d+[\.、)]\s*/, '').trim();
        break;
      }
    }
  }
  if (!company) {
    const cm = lines.join('\n').match(/([\u4e00-\u9fa5A-Za-z0-9]{2,20}(?:公司|集团|科技|网络|咨询|服务))\s*(?:成立于|创立|简介|总部)/);
    if (cm) company = cm[1];
  }
  return { title: title, company: company };
}

function extractResumeYears(text) {
  let max = 0;
  let currentStart = null;
  const reD = /(20\d{2})(?:\.\d{1,2})?\s*[\u2010\u2013\u2014\u2212\uFF0D\uFF5E\-~/至到]+\s*(20\d{2}(?:\.\d{1,2})?|至今|现在|今)/g;
  // 逐行处理，跳过教育经历行（大学/学院/学校/毕业/专业等），避免把读书时间算进工作年限
  String(text).split(/\r?\n/).forEach(function (line) {
    if (/(大学|学院|学校|毕业|专业|学历|本科|硕士|博士|大专|专科|在读|研究生|MBA)/.test(line)) return;
    let m;
    while ((m = reD.exec(line))) {
      const start = parseInt(m[1], 10);
      const endStr = m[2];
      const end = /至今|现在|今/.test(endStr) ? new Date().getFullYear() : parseInt(endStr, 10);
      if (end >= start) {
        max = Math.max(max, end - start);
        if (/至今|现在|今/.test(endStr)) currentStart = start;
      }
    }
  });
  // 若存在“至今”的工作起点，优先以它为准（防止早期教育经历把年限拉长）
  if (currentStart != null) max = Math.max(max, new Date().getFullYear() - currentStart);
  // 工作年限字段
  const reF = /(?:工作|从业|行业)?(?:年限|经验|经历)\s*[:：]?\s*(\d{1,2})\s*年/;
  const mF = text.match(reF);
  if (mF) max = Math.max(max, parseInt(mF[1], 10));
  // 兜底：简历里直接写“X 年以上”
  const reAny = /(\d{1,2})\s*年(?:以上|及以上)/g;
  let ma;
  while ((ma = reAny.exec(text))) max = Math.max(max, parseInt(ma[1], 10));
  return max;
}

function extractEdu(text) {
  if (/博士|PhD/i.test(text)) return '博士';
  if (/硕士|研究生|MBA|Master/i.test(text)) return '硕士';
  if (/本科|学士|Bachelor/i.test(text)) return '本科';
  if (/大专|专科|Associate/i.test(text)) return '大专';
  return '';
}

/* 学校层次系数：985 / QS前20 / 常春藤 ×1.2；211、双一流 / QS前50 ×1.15；QS前100 ×1.1；QS前200 ×1.05；其他 ×1.0 */
function extractSchoolFactor(text) {
  const t = String(text || '');
  let factor = 1.0;
  const note = [];
  const hasNum = function (num) { return new RegExp('(^|[^0-9])' + num + '($|[^0-9])').test(t); };
  if (hasNum('985')) { factor = Math.max(factor, 1.2); note.push('985'); }
  if (hasNum('211') || /双一流/.test(t)) { factor = Math.max(factor, 1.15); note.push(/双一流/.test(t) ? '双一流' : '211'); }
  const topCn = ['清华大学', '北京大学', '复旦大学', '上海交通大学', '浙江大学', '南京大学', '中国科学技术大学', '中国人民大学', '北京航空航天大学', '同济大学', '哈尔滨工业大学', '西安交通大学', '武汉大学', '华中科技大学', '中山大学', '四川大学'];
  if (topCn.some(function (s) { return t.indexOf(s) >= 0; })) { factor = Math.max(factor, 1.2); note.push('985'); }
  const qm = t.match(/QS\s*[:：]?\s*(\d{1,3})/i);
  if (qm) {
    const r = parseInt(qm[1], 10);
    if (r <= 20) { factor = Math.max(factor, 1.2); note.push('QS前20'); }
    else if (r <= 50) { factor = Math.max(factor, 1.15); note.push('QS前50'); }
    else if (r <= 100) { factor = Math.max(factor, 1.1); note.push('QS前100'); }
    else if (r <= 200) { factor = Math.max(factor, 1.05); note.push('QS前200'); }
  }
  if (/常春藤|Ivy\s*League/i.test(t)) { factor = Math.max(factor, 1.2); note.push('常春藤'); }
  return { factor: factor, note: unique(note) };
}

function extractAchievements(text) {
  const out = [];
  const sentences = String(text).split(/[。；;！？\n]/);
  sentences.forEach(function (sentence) {
    const s = sentence.trim();
    if (s.length < 6 || s.length > 120) return;
    const hasStrong = ACHIEVEMENT_STRONG.some(function (w) { return includesKw(s, w); });
    const hasMedium = ACHIEVEMENT_MEDIUM.some(function (w) { return includesKw(s, w); });
    const hasNum = /\d/.test(s);
    if ((hasStrong || hasMedium) && hasNum) out.push(s);
  });
  return unique(out).slice(0, 5);
}

function analyzeStability(text, lines) {
  const companies = [];
  const re = /(20\d{2})(?:\.\d{1,2})?\s*[\u2010\u2013\u2014\u2212\uFF0D\uFF5E\-~/至到]+\s*(20\d{2}(?:\.\d{1,2})?|至今|现在|今)/g;
  let m;
  while ((m = re.exec(text))) {
    const start = parseInt(m[1], 10);
    const end = /至今|现在|今/.test(m[2]) ? new Date().getFullYear() : parseInt(m[2], 10);
    companies.push({ start: start, end: end });
  }
  let shortTenures = 0;
  companies.forEach(function (c) {
    if (c.end - c.start < 2) shortTenures++;
  });
  let gap = false;
  for (let i = 1; i < companies.length; i++) {
    if (companies[i].start - companies[i - 1].end > 6) gap = true;
  }
  return {
    employers: companies.length,
    shortTenures: shortTenures,
    gap: gap
  };
}

/* =========================================================
 * 六维评分
 * ========================================================= */
function scoreCandidate(parsed, profile, weights) {
  const w = Object.assign({}, DEFAULT_WEIGHTS, weights || {});
  const raw = parsed.rawText || '';
  const textForMatch = raw + ' ' + parsed.name + ' ' + parsed.title + ' ' + parsed.company + ' ' + (parsed.industry || '');

  // 1 职能匹配
  let skillScore = 60;
  const skillInferred = {};
  const must = unique(profile.must || []);
  if (must.length) {
    let hits = 0;
    must.forEach(function (kw) {
      if (includesKw(textForMatch, kw)) hits += 1;
      else if (partialMatchKw(textForMatch, kw)) hits += 0.5;
      else if (inferAbilityKw(textForMatch, kw)) {
        hits += 0.5;
        skillInferred[kw] = true;
      }
    });
    skillScore = Math.round((hits / must.length) * 100);
  }
  const titleHit = includesKw(textForMatch, profile.titleZh || '') || (profile.variants || []).some(function (v) { return includesKw(textForMatch, v); });
  const candTags = matchFunctions((parsed.title || '') + ' ' + (parsed.company || ''));
  const funcHit = (profile.functionTags || []).some(function (t) { return candTags.indexOf(t) >= 0; });
  if (titleHit && skillScore < 60) skillScore = 60;
  if (funcHit && skillScore < 65) skillScore = 65;

  // 2 业绩成果：基础 60；每个量化成就句 +2，每个强信号词（超额/Top/从0到1等）+2；封顶 100
  const achN = parsed.achievements ? parsed.achievements.length : 0;
  const strongN = countMatches(textForMatch, ACHIEVEMENT_STRONG);
  let perfScore = Math.min(100, 60 + Math.min(20, achN + strongN) * 2);

  // 3 行业经验
  let indScore = 50;
  const inds = splitTerms(profile.industry);
  if (inds.length) {
    // 直接命中 JD 行业关键词（如 SaaS、科技、金融），每个 +10（最多 +30）
    let direct = 0;
    inds.forEach(function (t) {
      if (t && countMatches(textForMatch, [t]) > 0) direct++;
    });
    // JD 行业词 → 行业标签（用于判断相邻行业）
    const jdLabels = new Set();
    INDUSTRY_DICT.forEach(function (item) {
      const matched = item.words.some(function (w) {
        const ww = norm(w);
        return inds.some(function (t) {
          const tt = norm(t);
          if (!ww || !tt) return false;
          return ww === tt || (tt.length >= 2 && ww.indexOf(tt) >= 0) || (ww.length >= 2 && tt.indexOf(ww) >= 0);
        });
      });
      if (matched) jdLabels.add(item.label);
    });
    // 简历可识别行业标签与 JD 同源或相邻，+10
    const candLabels = matchIndustries(textForMatch);
    let adjacent = false;
    candLabels.forEach(function (label) {
      if (jdLabels.has(label)) adjacent = true;
      (INDUSTRY_ADJACENCY[label] || []).forEach(function (n) {
        if (jdLabels.has(n)) adjacent = true;
      });
    });
    indScore = 50 + Math.min(3, direct) * 10;
    // 相邻行业加分只在简历未直接命中 JD 行业词时生效（避免同一证据重复加分）
    if (direct === 0 && adjacent) indScore += 10;
    // 简历行业明显无关（能识别出行业但与 JD 无直接/相邻关系）→ 30
    if (candLabels.length && direct === 0 && !adjacent) indScore = 30;
  }
  if (indScore > 100) indScore = 100;

  // 4 公司背景
  let compScore = 55;
  // 命中 JD 目标公司池 → 100（最相关）
  if (profile.companies && profile.companies.length && countMatches(textForMatch, profile.companies) > 0) {
    compScore = 100;
  } else {
    let best = 0;
    COMPANY_TIERS.forEach(function (tg) {
      if (tg.names.some(function (n) { return includesKw(textForMatch, n); })) best = Math.max(best, tg.score);
    });
    if (best > 0) compScore = best;
    else if (countMatches(textForMatch, COMPANY_DICT.tiers) > 0) compScore = 80;
    else if (inds.length && countMatches(textForMatch, inds) > 0) compScore = 70;
  }

  // 5 经验年限
  let expScore = 60;
  const years = parsed.years || 0;
  if (profile.yearsMin != null && profile.yearsMax != null) {
    if (years >= profile.yearsMin && years <= profile.yearsMax) expScore = 100;
    else if (years < profile.yearsMin) expScore = Math.max(20, Math.round((years / profile.yearsMin) * 80));
    else expScore = Math.max(60, 100 - (years - profile.yearsMax) * 8);
  } else if (profile.yearsMin != null) {
    if (years >= profile.yearsMin) expScore = 100;
    else expScore = Math.max(20, Math.round((years / profile.yearsMin) * 80));
  } else if (years > 0) {
    expScore = years <= 12 ? 90 : 70;
  }

  // 6 学历
  // 层次分：博士 80 / 硕士 70 / 本科 60 / 大专 50 / 未识别 55；再乘学校层次系数，封顶 100
  let eduScore = 55;
  const have = parsed.education;
  if (have === '博士') eduScore = 80;
  else if (have === '硕士') eduScore = 70;
  else if (have === '本科') eduScore = 60;
  else if (have === '大专') eduScore = 50;
  // 学历得分 = 层次基础分 × 学校层次系数（四舍五入）
  eduScore = Math.min(100, Math.round(eduScore * extractSchoolFactor(raw).factor));
  // 硕士封顶 95，保持与博士的差距
  if (have === '硕士' && eduScore > 95) eduScore = 95;

  const total = Math.round(
    (skillScore * w.skill + perfScore * w.performance + indScore * w.industry +
      compScore * w.company + expScore * w.experience + eduScore * w.education) / 100
  );

  return {
    scores: { skill: skillScore, performance: perfScore, industry: indScore, company: compScore, experience: expScore, education: eduScore },
    total: Math.max(0, Math.min(100, total)),
    skillInferred: skillInferred
  };
}

/* ---------- 亮点 / 顾虑 / 待核实问题 ---------- */
function generateHighlights(parsed, profile, result) {
  const h = [];
  const text = (parsed.rawText || '') + ' ' + parsed.company;
  const allCompanyNames = [];
  Object.keys(COMPANY_DICT).forEach(function (k) {
    if (k !== 'tiers') allCompanyNames.push.apply(allCompanyNames, COMPANY_DICT[k]);
  });
  if (countMatches(text, allCompanyNames) > 0) h.push('有名企 / 目标公司背景（' + allCompanyNames.filter(function (c) { return includesKw(text, c); }).slice(0, 3).join('、') + '）');
  if (countMatches(text, COMPANY_DICT.tiers) > 0) h.push('有大厂 / 头部公司经历');
  const strong = countMatches(text, ACHIEVEMENT_STRONG);
  if (strong >= 2) h.push('业绩描述含多个强信号（超额、Top、从0到1、带领团队等）');
  else if (parsed.achievements && parsed.achievements.length >= 2) h.push('有量化业绩记录（' + parsed.achievements.length + ' 条）');
  if (result.scores.performance >= 85) h.push('业绩成果维度得分高（' + result.scores.performance + ' 分）');
  if (profile.yearsMin != null && parsed.years >= profile.yearsMin + 2) h.push('经验年限高于硬性门槛 ' + (parsed.years - profile.yearsMin) + ' 年');
  const inds = splitTerms(profile.industry);
  if (inds.length && countMatches(text, inds) >= inds.length) h.push('行业经验与需求完全匹配（' + inds.join('、') + '）');
  if (parsed.education === '硕士' || parsed.education === '博士') h.push('学历 ' + parsed.education + '，达到或超过要求');
  if (/(海外|国外|新加坡|美国|英国|硅谷|留学|英语|英文|English)/i.test(text) && profile.education !== '博士') h.push('有海外背景或英语能力');
  const inferred = Object.keys(result.skillInferred || {});
  if (inferred.length) h.push('依据职责表述推断具备：' + inferred.slice(0, 4).join('、') + '（建议联系时核实）');
  return unique(h).slice(0, 8);
}

function generateConcerns(parsed, profile, result) {
  const c = [];
  const text = (parsed.rawText || '') + ' ' + parsed.title + ' ' + parsed.company;
  const must = unique(profile.must || []);
  const missing = must.filter(function (k) {
    return !includesKw(text, k) && !partialMatchKw(text, k) && !(result.skillInferred || {})[k];
  });
  if (missing.length) c.push('简历中未明确体现必备条件：' + missing.slice(0, 4).join('、'));
  if (parsed.stability && parsed.stability.employers >= 3 && parsed.stability.shortTenures >= 2) c.push('近几段工作每段不足 2 年，稳定性需要核实');
  if (parsed.stability && parsed.stability.gap) c.push('工作经历存在明显空窗期（>6 个月）');
  const inds = splitTerms(profile.industry);
  if (inds.length && countMatches(text, inds) === 0 && parsed.industry) c.push('行业经验与需求不匹配（简历显示行业：' + parsed.industry + '）');
  if (profile.yearsMin != null && parsed.years && parsed.years < profile.yearsMin) c.push('经验年限低于要求（简历约 ' + parsed.years + ' 年，要求 ' + profile.yearsMin + ' 年以上）');
  if (profile.yearsMax != null && parsed.years && parsed.years > profile.yearsMax + 3) c.push('经验年限明显超过上限（' + parsed.years + ' 年），需评估性价比与稳定性');
  if (profile.education && parsed.education && EDU_ORDER[parsed.education] != null && EDU_ORDER[profile.education] != null && EDU_ORDER[parsed.education] < EDU_ORDER[profile.education]) c.push('学历低于要求（简历：' + parsed.education + '，要求：' + profile.education + '及以上）');
  if (!parsed.achievements || parsed.achievements.length === 0) c.push('业绩描述缺少量化数字，需要当面核实成果');
  return unique(c).slice(0, 8);
}

function generateQuestions(parsed, profile, result, concerns) {
  const q = [];
  const inferred = Object.keys(result.skillInferred || {});
  if (inferred.length) {
    q.push('简历未直接写明但职责隐含的能力（' + inferred.slice(0, 3).join('、') + '），请核实实际水平与具体场景。');
  }
  if (result.scores.performance >= 70 && parsed.achievements && parsed.achievements.length) q.push('业绩口径：这些数字的统计口径和背景是什么？是否有书面依据？');
  else q.push('过往业绩：具体负责多大的盘子？超额 / 达成情况如何？');
  if (parsed.stability && parsed.stability.employers >= 3) q.push('离职动机：最近几次换工作的原因分别是什么？');
  if (parsed.stability && parsed.stability.gap) q.push('空窗期：这段时间在做什么？');
  q.push('薪酬期望：与需求的薪酬带宽是否匹配？');
  q.push('可到岗时间：最快什么时候能入职？');
  if (profile.companies && profile.companies.length) q.push('目标公司资源：是否认识 / 服务过 ' + profile.companies.slice(0, 3).join('、') + ' 这类客户？');
  if (/英语|英文|English|海外|global|international/i.test(profile.notes || '') || /英语|英文|English/i.test((parsed.rawText || ''))) q.push('英语水平：实际使用场景和流利程度如何？（读写 / 口头会议）');
  if (concerns.some(function (x) { return /稳定性|每段|空窗/.test(x); })) q.push('职业规划：未来 2-3 年的职业目标是什么？为什么选择这个岗位？');
  return unique(q).slice(0, 7);
}

function buildSuggestion(result, concerns) {
  const t = result.total;
  const topConcerns = concerns.slice(0, 2).join('；');
  if (t >= 85) return '优先沟通。匹配度高，先核实' + (topConcerns || '业绩口径与离职动机') + '，没有问题即可推进面试。';
  if (t >= 70) return '可沟通。综合分中上，重点核实' + (topConcerns || '薪酬期望与到岗时间') + '，若关键项可接受再推进。';
  if (t >= 60) return '备选。有明显短板（' + (topConcerns || '匹配度不足') + '），建议先补齐信息或放到次轮。';
  return '暂缓。与需求匹配度较低，除非候选人有特殊资源或背景，否则不建议优先联系。';
}

/* ---------- 组合分析 ---------- */
function analyzeCandidate(parsed, profile, weights) {
  const raw = parsed.rawText || '';
  const result = scoreCandidate(parsed, profile, weights);
  const highlights = generateHighlights(parsed, profile, result);
  const concerns = generateConcerns(parsed, profile, result);
  const questions = generateQuestions(parsed, profile, result, concerns);
  const suggestion = buildSuggestion(result, concerns);
  return {
    scores: result.scores,
    total: result.total,
    highlights: highlights,
    concerns: concerns,
    questions: questions,
    suggestion: suggestion,
    skillInferred: result.skillInferred,
    skills: parsed.skills,
    achievements: parsed.achievements
  };
}
