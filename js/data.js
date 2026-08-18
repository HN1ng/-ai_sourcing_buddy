/* =========================================================
 * AI Sourcing Buddy · 数据与词库
 * 集中管理：职能词、行业词、公司池、能力词、渠道规则、策略文案
 * ========================================================= */
'use strict';

const DEFAULT_WEIGHTS = {
  skill: 25,        // 职能匹配
  performance: 25,  // 业绩成果
  industry: 20,     // 行业经验
  company: 12,      // 公司背景
  experience: 10,   // 经验年限
  education: 8      // 学历
};

const WEIGHT_LABELS = {
  skill: '职能匹配',
  performance: '业绩成果',
  industry: '行业经验',
  company: '公司背景',
  experience: '经验年限',
  education: '学历'
};

/* ---------- 职能词库（非技术岗） ---------- */
const FUNCTION_DICT = {
  sales: ['销售', '商务', '客户经理', '大客户', 'KA', '渠道', '区域', '销售总监', '销售经理', '销售代表', '销售顾问', '销售主管', 'SDR', '售前', 'BD', '商务拓展', '经销商', '代理商', '直销', '电销', '地推', 'Sales', 'Account Manager', 'Business Development', 'Key Account', 'Account Executive'],
  marketing: ['市场', '品牌', '公关', '新媒体', '内容营销', '增长', '投放', '活动策划', '数字营销', 'SEM', 'SEO', '广告', '营销', '媒介', '市场营销', 'Brand', 'Marketing'],
  operations: ['运营', '用户运营', '内容运营', '活动运营', '社群', '私域', '电商运营', '商品运营', '平台运营', '商家运营', '增长运营', '数据运营', 'Operation'],
  product: ['产品经理', '产品', '需求分析', '项目管理', 'PM', '产品运营', '解决方案'],
  hr: ['HR', '招聘', '人事', '人力资源', '薪酬', '绩效', '培训', 'HRBP', '组织发展', 'OD', '员工关系', '雇主品牌', 'Recruiter', 'Talent', 'HR Manager'],
  finance: ['财务', '会计', '审计', '税务', '资金', '投融资', 'FP&A', '总账', '应收', '应付', '出纳', '财务分析', 'Finance'],
  legal: ['法务', '合规', '律师', '知识产权', 'Legal', 'Compliance'],
  customer_service: ['客服', '客户成功', '售后', 'CSM', '服务', 'Customer Success'],
  admin: ['行政', '前台', '助理', '秘书', '后勤', '行政主管'],
  supply_chain: ['采购', '供应链', '物流', '仓储', '计划', 'Supply Chain', 'Sourcing'],
  general_management: ['总经理', '副总裁', 'VP', 'COO', 'CEO', '总裁', '事业部总经理', 'Managing Director'],
  project: ['项目经理', 'PMO', '项目交付', '交付经理', 'Project Manager']
};

const FUNCTION_LABELS = {
  sales: '销售 / BD',
  marketing: '市场 / 品牌',
  operations: '运营',
  product: '产品 / 项目',
  hr: '人力资源',
  finance: '财务',
  legal: '法务 / 合规',
  customer_service: '客服 / 客户成功',
  admin: '行政',
  supply_chain: '采购 / 供应链',
  general_management: '综合管理',
  project: '项目管理'
};

/* 岗位别名（按职能生成搜索变体） */
const FUNCTION_ALIASES = {
  sales: ['销售经理', '销售总监', '大客户销售', '客户经理', '销售主管', '区域销售', '销售顾问', '商务拓展', '渠道经理', 'Account Manager', 'Sales Manager', 'Sales Director', 'Key Account Manager', 'Business Development Manager', 'Regional Sales Manager', 'Account Executive', 'SDR'],
  marketing: ['市场经理', '品牌经理', '市场总监', '新媒体运营', '内容营销', '数字营销', '增长经理', '媒介经理', '市场专员', 'Marketing Manager', 'Brand Manager', 'Marketing Director', 'Growth Manager', 'Content Marketing'],
  operations: ['运营经理', '运营总监', '用户运营', '内容运营', '活动运营', '社群运营', '电商运营', '商家运营', 'Operations Manager', 'Operation Director'],
  product: ['产品经理', '产品总监', '高级产品经理', '需求分析师', '项目总监', 'Product Manager', 'Senior Product Manager', 'Product Director', 'Program Manager'],
  hr: ['招聘经理', 'HRBP', 'HR Manager', 'Recruiter', '人事经理', '人力资源总监', '薪酬绩效经理', '培训经理', '组织发展', 'Talent Acquisition'],
  finance: ['财务经理', '财务总监', '会计', '总账会计', '财务分析', 'Finance Manager', 'Financial Controller', 'CFO', '税务经理', '审计经理'],
  legal: ['法务经理', '法务总监', '法务专员', '合规经理', 'Legal Counsel', 'Compliance Manager', '律师'],
  customer_service: ['客服经理', '客户成功经理', '客服主管', '售后经理', 'Customer Success Manager', 'Support Manager', 'Service Manager'],
  admin: ['行政经理', '行政主管', '行政专员', '前台', 'Office Manager', 'Admin Manager'],
  supply_chain: ['采购经理', '采购总监', '供应链经理', '物流经理', '仓储经理', 'Procurement Manager', 'Supply Chain Manager', 'Logistics Manager'],
  general_management: ['总经理', '副总裁', 'VP', 'COO', '运营副总裁', 'Managing Director', 'General Manager', 'Country Manager'],
  project: ['项目经理', '高级项目经理', '交付经理', 'PMO', 'Project Manager', 'Delivery Manager', 'Program Manager']
};

/* ---------- 行业词库 ---------- */
const INDUSTRY_DICT = [
  { label: '互联网', words: ['互联网', 'Internet'] },
  { label: '电商 / 跨境电商', words: ['电商', '电子商务', '跨境电商', '出海电商', 'E-commerce', 'Cross-border'] },
  { label: '企业服务 / SaaS', words: ['企业服务', 'SaaS', 'B2B', '软件即服务', '软件', '云计算', '云服务', 'Enterprise Software'] },
  { label: '人工智能 / AI', words: ['人工智能', 'AI', '智能', '大模型', 'AIGC', '机器学习'] },
  { label: '金融', words: ['金融', '银行', '证券', '保险', '基金', '支付', '财富管理', 'Fintech', 'Finance'] },
  { label: '教育', words: ['教育', '培训', '在线教育', 'EdTech', '职业教育'] },
  { label: '医疗健康', words: ['医疗', '医药', '健康', '大健康', '生物', 'Healthcare', 'Pharma'] },
  { label: '游戏', words: ['游戏', '电竞', 'Gaming'] },
  { label: '消费 / 快消', words: ['消费', '快消', '消费品', '零售', '食品', '饮料', '美妆', '餐饮', 'FMCG', 'Consumer'] },
  { label: '汽车', words: ['汽车', '新能源车', '车联网', 'Automotive', 'EV'] },
  { label: '房地产 / 物业', words: ['房地产', '地产', '物业', '商业地产', 'Real Estate'] },
  { label: '物流 / 供应链', words: ['物流', '供应链', '仓储', '货运', 'Logistics'] },
  { label: '制造业', words: ['制造', '工业', '工厂', '智能制造', 'Manufacturing'] },
  { label: '广告 / 营销服务', words: ['广告', '营销服务', '公关公司', '媒介', 'Agency', '4A'] },
  { label: '出海 / 全球化', words: ['出海', '全球化', '海外市场', '国际业务', 'Global'] },
  { label: '新能源', words: ['新能源', '光伏', '储能', '电池', 'Energy'] },
  { label: '半导体 / 芯片', words: ['半导体', '芯片', '集成电路', 'Semiconductor'] },
  { label: '智能硬件', words: ['智能硬件', '硬件', 'IoT', '机器人'] },
  { label: '旅游 / 本地生活', words: ['旅游', '出行', '本地生活', '酒旅', '酒店', 'OTA'] },
  { label: '内容 / 文娱', words: ['内容', '文娱', '视频', '直播', '音乐', '阅读', '传媒'] },
  { label: '人力资源服务', words: ['人力资源服务', '猎头', '招聘平台', '灵活用工', 'HR SaaS'] },
  { label: '咨询 / 专业服务', words: ['咨询', '专业服务', '会计师事务所', '律所', 'Consulting'] }
];

/* 行业邻近关系（第二梯队“相近行业”用） */
const INDUSTRY_ADJACENCY = {
  '企业服务 / SaaS': ['互联网', '广告 / 营销服务', '人力资源服务', '出海 / 全球化', '人工智能 / AI', '金融'],
  '互联网': ['企业服务 / SaaS', '内容 / 文娱', '电商 / 跨境电商', '广告 / 营销服务', '人工智能 / AI', '游戏'],
  '电商 / 跨境电商': ['消费 / 快消', '互联网', '物流 / 供应链', '出海 / 全球化', '广告 / 营销服务'],
  '人工智能 / AI': ['互联网', '企业服务 / SaaS', '智能硬件', '半导体 / 芯片', '新能源'],
  '金融': ['互联网', '企业服务 / SaaS', '咨询 / 专业服务', '出海 / 全球化'],
  '教育': ['内容 / 文娱', '人力资源服务', '互联网', '消费 / 快消'],
  '医疗健康': ['金融', '消费 / 快消', '制造业', '互联网'],
  '游戏': ['内容 / 文娱', '互联网', '消费 / 快消'],
  '消费 / 快消': ['电商 / 跨境电商', '广告 / 营销服务', '旅游 / 本地生活', '内容 / 文娱'],
  '汽车': ['制造业', '新能源', '智能硬件', '物流 / 供应链'],
  '房地产 / 物业': ['金融', '制造业', '消费 / 快消', '咨询 / 专业服务'],
  '物流 / 供应链': ['电商 / 跨境电商', '制造业', '消费 / 快消', '互联网'],
  '制造业': ['汽车', '新能源', '智能硬件', '物流 / 供应链', '半导体 / 芯片'],
  '广告 / 营销服务': ['互联网', '消费 / 快消', '电商 / 跨境电商', '内容 / 文娱', '企业服务 / SaaS'],
  '出海 / 全球化': ['电商 / 跨境电商', '消费 / 快消', '互联网', '企业服务 / SaaS'],
  '新能源': ['汽车', '制造业', '半导体 / 芯片', '智能硬件'],
  '半导体 / 芯片': ['人工智能 / AI', '智能硬件', '互联网', '制造业'],
  '智能硬件': ['人工智能 / AI', '半导体 / 芯片', '消费 / 快消', '互联网'],
  '旅游 / 本地生活': ['互联网', '消费 / 快消', '内容 / 文娱'],
  '内容 / 文娱': ['互联网', '游戏', '广告 / 营销服务', '教育'],
  '人力资源服务': ['企业服务 / SaaS', '咨询 / 专业服务', '教育', '互联网'],
  '咨询 / 专业服务': ['金融', '企业服务 / SaaS', '人力资源服务', '消费 / 快消']
};

/* 能力词 → 英文（第三 / 四梯队英文组合用） */
const ABILITY_EN_MAP = {
  '客户资源': 'Client Network', '行业资源': 'Industry Network', '人脉资源': 'Network',
  '团队管理': 'Team Management', '带团队': 'Leadership', '管理经验': 'Management Experience',
  '商务谈判': 'Negotiation', '谈判能力': 'Negotiation', '英语': 'English', '英语流利': 'Fluent English',
  '数据分析': 'Data Analysis', '数据驱动': 'Data-Driven', 'Excel': 'Excel', 'SQL': 'SQL',
  '渠道管理': 'Channel Management', '渠道资源': 'Channel Network', '经销商管理': 'Dealer Management', '代理商管理': 'Partner Management', '分销渠道': 'Distribution',
  '获客': 'Lead Generation', '增长': 'Growth', '转化率': 'Conversion', '广告投放': 'Performance Marketing',
  '品牌管理': 'Brand Management', '品牌建设': 'Brand Building', '公关': 'PR', '媒介': 'Media',
  '客户成功': 'Customer Success', '续费管理': 'Renewal Management', '续约': 'Renewal', '客户满意度': 'Customer Satisfaction', 'CSM': 'Customer Success',
  '项目管理': 'Project Management', '项目交付': 'Project Delivery', 'PMP': 'PMP', '跨部门协同': 'Cross-functional Collaboration',
  '沟通能力': 'Communication', '协调能力': 'Coordination', '抗压能力': 'Resilience', '自驱力': 'Self-motivation', '结果导向': 'Results-driven',
  '预算管理': 'Budget Management', '成本控制': 'Cost Control', '财务分析': 'Financial Analysis', '税务': 'Tax', '合规': 'Compliance',
  '招聘': 'Recruiting', '绩效管理': 'Performance Management', '薪酬管理': 'Compensation', '组织发展': 'Org Development', '员工关系': 'Employee Relations',
  '采购': 'Procurement', '供应链': 'Supply Chain', '库存管理': 'Inventory', '物流': 'Logistics',
  '解决方案': 'Solutions', '售前': 'Pre-sales', '讲师': 'Trainer', '培训': 'Training'
};

/* ---------- 能力 / 条件词（JD 解析用，分“必备”倾向） ---------- */
const ABILITY_TERMS = [
  { term: '客户资源', group: '资源', label: '客户资源' },
  { term: '行业资源', group: '资源', label: '行业资源' },
  { term: '客户资源', group: '资源', label: '客户资源' },
  { term: '人脉', group: '资源', label: '人脉资源' },
  { term: '团队管理', group: '管理', label: '团队管理' },
  { term: '带团队', group: '管理', label: '带团队' },
  { term: '管理团队', group: '管理', label: '团队管理' },
  { term: '管理经验', group: '管理', label: '管理经验' },
  { term: 'leadership', group: '管理', label: 'Leadership' },
  { term: '商务谈判', group: '谈判', label: '商务谈判' },
  { term: '谈判', group: '谈判', label: '谈判能力' },
  { term: '英语', group: '语言', label: '英语' },
  { term: '英文', group: '语言', label: '英语' },
  { term: '英语流利', group: '语言', label: '英语流利' },
  { term: 'English', group: '语言', label: 'English' },
  { term: '双语', group: '语言', label: '双语' },
  { term: '数据分析', group: '数据', label: '数据分析' },
  { term: '数据驱动', group: '数据', label: '数据驱动' },
  { term: 'Excel', group: '数据', label: 'Excel' },
  { term: 'SQL', group: '数据', label: 'SQL' },
  { term: '渠道管理', group: '渠道', label: '渠道管理' },
  { term: '渠道资源', group: '渠道', label: '渠道资源' },
  { term: '经销商', group: '渠道', label: '经销商管理' },
  { term: '代理商', group: '渠道', label: '代理商管理' },
  { term: '分销', group: '渠道', label: '分销渠道' },
  { term: '获客', group: '增长', label: '获客' },
  { term: '增长', group: '增长', label: '增长' },
  { term: '转化率', group: '增长', label: '转化率' },
  { term: '投放', group: '增长', label: '广告投放' },
  { term: '品牌管理', group: '品牌', label: '品牌管理' },
  { term: '品牌建设', group: '品牌', label: '品牌建设' },
  { term: '公关', group: '品牌', label: '公关' },
  { term: '媒介', group: '品牌', label: '媒介' },
  { term: '客户成功', group: '服务', label: '客户成功' },
  { term: '续费', group: '服务', label: '续费管理' },
  { term: '续约', group: '服务', label: '续约' },
  { term: '客户满意度', group: '服务', label: '客户满意度' },
  { term: 'CSM', group: '服务', label: 'CSM' },
  { term: '项目管理', group: '项目', label: '项目管理' },
  { term: '项目交付', group: '项目', label: '项目交付' },
  { term: 'PMP', group: '项目', label: 'PMP' },
  { term: '跨部门', group: '协同', label: '跨部门协同' },
  { term: '沟通能力', group: '协同', label: '沟通能力' },
  { term: '协调', group: '协同', label: '协调能力' },
  { term: '抗压', group: '素质', label: '抗压能力' },
  { term: '自驱', group: '素质', label: '自驱力' },
  { term: '结果导向', group: '素质', label: '结果导向' },
  { term: '预算', group: '财务', label: '预算管理' },
  { term: '成本控制', group: '财务', label: '成本控制' },
  { term: '财务分析', group: '财务', label: '财务分析' },
  { term: '税务', group: '财务', label: '税务' },
  { term: '合规', group: '财务', label: '合规' },
  { term: '招聘', group: 'HR', label: '招聘' },
  { term: '绩效', group: 'HR', label: '绩效管理' },
  { term: '薪酬', group: 'HR', label: '薪酬管理' },
  { term: '组织发展', group: 'HR', label: '组织发展' },
  { term: '员工关系', group: 'HR', label: '员工关系' },
  { term: '采购', group: '供应链', label: '采购' },
  { term: '供应链', group: '供应链', label: '供应链' },
  { term: '库存', group: '供应链', label: '库存管理' },
  { term: '物流', group: '供应链', label: '物流' },
  { term: '解决方案', group: '专业', label: '解决方案' },
  { term: '售前', group: '专业', label: '售前' },
  { term: '讲师', group: '专业', label: '讲师' },
  { term: '培训', group: '专业', label: '培训' }
];

/* 能力推断表：职责/背景中出现这些表述时，推断候选人可能具备对应能力（非字面命中，报告会标注“推断”） */
const ABILITY_INFERENCE = {
  '英语': ['全球', '海外', '国际化', '国际', '留学', 'English', 'CET', '雅思', '托福', '跨国', '出海', 'global', 'overseas', 'foreign', '英文'],
  '英语流利': ['全球', '海外', '国际化', '国际', '留学', 'English', 'CET', '雅思', '托福', '跨国', '出海', 'global', 'overseas', '英文'],
  '获客': ['增长', '注册', '线索', 'leads', '流量', '拉新', '用户增长', '增长负责人', '市场负责人', '获客', 'acquisition', 'growth'],
  '增长': ['获客', '注册', '流量', '拉新', '用户增长', 'GMV', '活跃用户', 'DAU', '转化', '增长负责人', 'growth'],
  '转化率': ['转化', '漏斗', 'conversion', '转化率', '增长'],
  '成本控制': ['预算', 'ROI', '降本', '增效', '成本', '资源分配', '人效', '投产比', '费效', 'budget', 'cost'],
  '预算管理': ['预算', 'ROI', '成本', '费效', 'budget'],
  '团队管理': ['带领', '统筹', '操盘', '负责人', '管理', '团队', '搭建', '组建', 'lead', 'head of', 'manage', 'leader'],
  '带团队': ['带领', '统筹', '操盘', '负责人', '管理', '团队', 'lead', 'head of', 'leader'],
  '管理经验': ['带领', '统筹', '操盘', '负责人', '管理', '团队', 'lead', 'head of', 'manage'],
  '商务谈判': ['谈判', '签约', '合同', '商务', '议价', 'deal', 'negotiat'],
  '谈判能力': ['谈判', '签约', '商务', '议价', 'negotiat'],
  '客户资源': ['客户', 'KA', '大客户', '客户网络', 'accounts', 'clients'],
  '行业资源': ['行业', '资源', '人脉', 'network'],
  '人脉资源': ['人脉', '资源', 'network', 'connections'],
  '数据分析': ['数据', '分析', 'metrics', 'BI', '看板', '复盘', '数据驱动', 'analytics'],
  '数据驱动': ['数据', '指标', 'metrics', '复盘', '数据驱动', 'analytics'],
  '渠道管理': ['渠道', '分销', '代理商', '经销商', 'channel'],
  '渠道资源': ['渠道', '分销', '代理商', '经销商', 'channel'],
  '经销商管理': ['经销商', '代理', '渠道', 'dealer'],
  '代理商管理': ['代理', '渠道', 'partner', 'partner'],
  '分销渠道': ['分销', '渠道', 'distribution'],
  '广告投放': ['投放', '广告', 'SEM', '信息流', '买量', 'performance marketing'],
  '品牌管理': ['品牌', 'brand', '市场'],
  '品牌建设': ['品牌', 'brand', '市场'],
  '公关': ['公关', 'PR', '媒体', '媒介关系'],
  '媒介': ['媒介', '媒体', 'media'],
  '客户成功': ['续费', '续约', '客户成功', 'CSM', 'NPS', 'customer success'],
  '续费管理': ['续费', '续约', 'renewal', '留存'],
  '续约': ['续约', '续费', 'renewal'],
  '客户满意度': ['满意度', 'NPS', '口碑', 'satisfaction'],
  'CSM': ['客户成功', 'CSM', 'customer success'],
  '项目管理': ['项目', '交付', '统筹', '落地', 'PMO', 'project'],
  '项目交付': ['项目', '交付', '落地', 'delivery'],
  'PMP': ['PMP', '项目管理'],
  '跨部门协同': ['跨部门', '协同', '协作', '合作', 'stakeholder', 'cross-function'],
  '沟通能力': ['沟通', '协作', '协调', 'stakeholder', 'communication'],
  '协调能力': ['协调', '统筹', '协作', 'coordinat'],
  '抗压能力': ['抗压', '高强度', '高压', '快节奏', 'resilience'],
  '自驱力': ['自驱', '主动', 'owner', 'self-driven'],
  '结果导向': ['结果', '目标', '达成', '业绩', '指标', 'results-driven'],
  '财务分析': ['财务', '分析', '报表', 'financial'],
  '合规': ['合规', '风控', 'compliance', '监管'],
  '招聘': ['招聘', '招募', 'recruit', 'talent'],
  '绩效管理': ['绩效', '考核', '目标管理', 'OKR', 'KPI'],
  '薪酬管理': ['薪酬', '薪资', 'compensation'],
  '组织发展': ['组织发展', '组织', 'OD', '人才发展'],
  '员工关系': ['员工关系', '员工', '雇主', 'employee'],
  '采购': ['采购', '供应商', 'sourcing', 'procurement'],
  '供应链': ['供应链', 'supply chain', '物流'],
  '物流': ['物流', '仓储', 'logistics'],
  '库存管理': ['库存', '仓储', 'inventory'],
  '解决方案': ['解决方案', '方案', 'solution'],
  '售前': ['售前', '方案', 'presales', '解决方案'],
  '讲师': ['讲师', '培训', '授课', 'coach', 'trainer'],
  '培训': ['培训', '赋能', '授课', '讲师', 'train', 'coach']
};

/* ---------- 目标公司池 / 名企词 ---------- */
const COMPANY_DICT = {
  big_tech_cn: ['腾讯', '阿里', '阿里巴巴', '字节', '字节跳动', '百度', '美团', '京东', '拼多多', '网易', '华为', '小米', '快手', '小红书', '滴滴', '携程', '哔哩哔哩', 'B站', '蚂蚁', '蚂蚁集团', '平安', '招商银行', '微众银行', '滴滴出行', '饿了么', '唯品会', '58同城', '美菜', '叮咚买菜'],
  big_tech_global: ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Adobe', 'Uber', 'Airbnb', 'Stripe', 'Shopify', 'LinkedIn', 'Zoom', 'ServiceNow'],
  famous_foreign: ['宝洁', '联合利华', '玛氏', '雀巢', '可口可乐', '百事', '耐克', '阿迪达斯', '麦当劳', '星巴克', '欧莱雅', '雅诗兰黛', '埃森哲', '麦肯锡', 'BCG', '贝恩', '普华永道', '德勤', '安永', '毕马威', '高盛', '摩根', '汇丰', '渣打', '西门子', '博世', '飞利浦', '联合利华'],
  erp_saas: ['用友', '金蝶', '北森', '纷享销客', '销售易', '有赞', '微盟', '神策', 'GrowingIO', '明源云', '广联达', '帆软', 'Teambition', 'ONES', '飞书', '钉钉', '企业微信', 'Welink', '蓝凌', '泛微'],
  unicorn_cn: ['元气森林', '完美日记', '泡泡玛特', '蜜雪冰城', '瑞幸', '喜茶', '奈雪', '蕉下', 'Shein', 'SHEIN', '安克创新', '大疆', '海康威视', '旷视', '商汤', '依图', '云从', '地平线', '壁仞', '寒武纪', '沐曦'],
  tiers: ['大厂', '独角兽', '上市公司', '世界500强', '500强', '知名企业', '头部企业', '头部公司', '行业领先']
};

/* 公司背景梯队（评分用）：命中目标公司池 → 100；否则按梯队取最高分 */
const COMPANY_TIERS = [
  { tier: 1, score: 100, label: '第一梯队 · 一线大厂 / 全球巨头', names: ['腾讯', '字节', '字节跳动', '阿里巴巴', '阿里', '百度', '美团', '拼多多', '网易', '华为', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix'] },
  { tier: 2, score: 90, label: '第二梯队 · 准一线 / 知名科技', names: ['京东', '小米', '快手', '小红书', '滴滴', '滴滴出行', '哔哩哔哩', 'B站', '蚂蚁', '蚂蚁集团', '携程', '平安', '招商银行', '微众银行', '饿了么', '58同城', '唯品会', 'Salesforce', 'Oracle', 'SAP', 'IBM', 'Adobe', 'Uber', 'Airbnb', 'Stripe', 'Shopify', 'LinkedIn', 'Zoom', 'ServiceNow'] },
  { tier: 3, score: 80, label: '第三梯队 · 头部垂直 / 知名外企', names: ['大疆', '海康威视', '商汤', '旷视', '地平线', '寒武纪', 'Shein', 'SHEIN', '安克创新', '元气森林', '泡泡玛特', '蜜雪冰城', '瑞幸', '喜茶', '奈雪', '蕉下', '宝洁', '联合利华', '玛氏', '雀巢', '可口可乐', '百事', '耐克', '阿迪达斯', '麦当劳', '星巴克', '欧莱雅', '雅诗兰黛', '埃森哲', '麦肯锡', 'BCG', '贝恩', '普华永道', '德勤', '安永', '毕马威', '高盛', '摩根', '汇丰', '渣打', '西门子', '博世', '飞利浦'] },
  { tier: 4, score: 70, label: '第四梯队 · SaaS/企服 / 新锐独角兽', names: ['用友', '金蝶', '北森', '纷享销客', '销售易', '有赞', '微盟', '神策', 'GrowingIO', '明源云', '广联达', '帆软', 'Teambition', 'ONES', '飞书', '钉钉', '企业微信', 'Welink', '蓝凌', '泛微', '完美日记', '依图', '云从', '壁仞', '沐曦', '美菜', '叮咚买菜'] }
];

/* ---------- 城市 ---------- */
const CITY_DICT = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '南京', '苏州', '西安', '重庆', '天津', '长沙', '郑州', '青岛', '厦门', '合肥', '佛山', '东莞', '宁波', '无锡', '济南', '福州', '昆明', '贵阳', '远程', '海外', '新加坡', '香港', '澳门', '台北', '东京', '首尔', '纽约', '伦敦', '旧金山', '硅谷', '洛杉矶', '柏林', '巴黎', '悉尼', '多伦多', '温哥华'];

/* ---------- 业绩信号 ---------- */
const ACHIEVEMENT_STRONG = ['超额', '超额完成', '达成率', '完成率', 'Top', '冠军', '第一名', '第一', '年度最佳', '最佳销售', '优秀员工', '晋升', '从0到1', '0到1', '从零到一', '搭建团队', '从无到有', '上市', 'IPO', '里程碑'];
const ACHIEVEMENT_MEDIUM = ['增长', '同比增长', '环比', '营收', '收入', 'GMV', '销售额', '业绩', '回款', '续费', '复购', '转化率', '毛利', '净利', '利润', '客户数', '合同额', '订单', '签约', '排名', '百万', '千万', '亿', '翻倍', '带领', '管理', '负责', '搭建', '组建', '融资', 'A轮', 'B轮', 'C轮', '上市'];

/* ---------- 学历 ---------- */
const EDU_ORDER = { '博士': 4, '硕士': 3, '研究生': 3, 'MBA': 3, '本科': 2, '学士': 2, '大专': 1, '专科': 1, '中专': 0, '高中': 0, '不限': null };

/* ---------- 渠道规则 ---------- */
const CHANNEL_DEFS = [
  {
    id: 'maimai',
    name: '脉脉',
    tag: '主渠道 · 国内',
    depth: 'deep',
    note: '双引号包住完整词组可精准匹配（如 "销售经理"）；不加引号的词按关键词匹配；不支持 AND/OR 等复杂布尔，主要靠“关键词 + 筛选器”圈人。',
    filters: ['行业', '公司', '职位', '地区', '工作年限', '学历', '活跃度'],
    tips: [
      '岗位名用双引号包裹（如 "销售经理"）可精准匹配完整词组；其余能力词不加引号、用空格组合。',
      '引号词组更精准、结果更少；不加引号更宽松——先精准后宽松。',
      '筛选器优先圈行业 + 公司 + 职位层级，再放宽地区；优先联系 7 天内活跃的候选人。',
      '免费账号能发的打招呼次数有限，先发给评分最高的前 10 位。'
    ],
    fallback: [
      '换词方向：换同职能叫法（如“大客户销售”换成“KA/客户经理”）。',
      '公司定向：直接搜目标公司名 + 职位，绕过关键词匹配。',
      '二度人脉转介绍：先触达目标公司里的二度人脉请对方推荐，或去相关职言 / 圈子找人。'
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    tag: '主渠道 · 海外',
    depth: 'deep',
    note: '布尔语法完整（引号 / OR / AND / NOT / 括号），但免费账号有硬性限制，见下方要点。',
    filters: ['地点', '行业', '职能', '关键词（标题/公司/技能）'],
    tips: [
      '免费账号单次搜索最多约 1000 条结果，搜索 / 浏览有月度额度，用于招聘可能触发“商业用途限制”。',
      '没有 InMail、看不到非好友完整资料；筛选器只有地点 / 行业 / 职能 / 关键词等基础几项。',
      '先跑精准版，再用 Google 绕过版扩展；要批量 sourcing 需升级 Recruiter Lite 或 Sales Navigator。',
      '联系非好友用“加好友附言”，把亮点和意图写进一句话里。'
    ],
    fallback: [
      'Google 绕过：用 site:linkedin.com/in + 关键词搜出更多 profile。',
      '看“People also viewed”顺藤摸瓜，扩展同公司同岗位候选人。',
      '加入行业群组，或从候选人官网 / 行业活动名单 / 新闻稿里找关键人物。'
    ]
  },
  {
    id: 'liepin',
    name: '猎聘',
    tag: '补充渠道',
    depth: 'basic',
    note: '关键词 + 高级筛选；布尔支持有限，建议用简单组合。',
    tips: [
      '用“岗位名 + 空格 + 关键词”搜简历；高级筛选覆盖学历、经验、城市、行业、薪资预期。',
      '适合快速大量拉简历，质量需要二次筛选。'
    ],
    fallback: [
      '换词：换成同职能的常见叫法（如“大客户销售”↔“KA”）。',
      '放宽学历 / 经验 / 城市筛选，或用猎聘的人才推荐 / 人脉转介绍补充。'
    ]
  },
  {
    id: 'boss',
    name: 'BOSS直聘',
    tag: '补充渠道',
    depth: 'basic',
    note: '支持关键词搜索 + 筛选，不支持复杂布尔；直聊触达快。',
    tips: [
      '搜索框输入“岗位名 关键词”（空格分隔）；筛选器覆盖学历、经验、城市、行业、公司规模。',
      '适合年轻化、快消/运营类岗位；主动打招呼转化率高。'
    ],
    fallback: [
      '换关键词组合，岗位名用空格加能力词。',
      '放宽筛选后按活跃度排序优先联系在线候选人，或用“推荐人才 / 谁看过我”补充。'
    ]
  }
];

/* ---------- 需求澄清清单（解析后提示） ---------- */
const CONFIRM_QUESTIONS = [
  '这个岗位为什么现在招？是替换离职还是新增编制？',
  '用人经理心里有没有“对标的人或公司”？',
  '入职前 3 个月，最希望这个人解决什么问题？',
  '哪些要求是硬性的、哪些可以妥协？（业绩口径、学历、年龄、稳定性）',
  '业绩考核口径是什么？（营收 / 回款 / 客户数 / 续费率 / 利润）',
  '团队现状和汇报线？带不带人？',
  '薪酬带宽和预算？有没有股票 / 期权？',
  '到岗时间要求和招聘紧急程度？',
  '面试流程里谁有最终决定权？',
  '之前有没有面过但没招成的候选人？为什么没成？'
];

/* ---------- 渠道策略建议（搜索页展示） ---------- */
const STRATEGY_TIPS = [
  '第 1 步 · 脉脉：先按“岗位名 + 核心关键词”搜一轮，配合行业 / 公司筛选器；每天刷一次活跃候选人。',
  '第 2 步 · 脉脉公司定向：直接搜目标公司 + 职位，比关键词更准，先攻“对标公司”。',
  '第 3 步 · LinkedIn：海外候选人先用精准版布尔，结果不足再切宽松版；配合 Google site: 指令扩展。',
  '第 4 步 · 猎聘 / BOSS直聘：作为量仓补充，快速拉简历、二次筛选。',
  '触达顺序：按候选人页的综合分从高到低，先联系前 10 位；同时给前 3 位发转介绍邀请。'
];

/* ---------- 常见岗位澄清问题（画像字段不全时的提示） ---------- */
function buildConfirmChecklist(profile) {
  const items = [];
  if (!profile || !profile.titleZh) items.push('岗位名称待确认（用一句话说清楚“谁 + 干什么”）');
  if (!profile.industry) items.push('行业范围待确认（候选人必须来自哪个行业？）');
  if (!profile.companies || profile.companies.length === 0) items.push('目标公司池待确认（用人经理心中的对标公司有哪些？）');
  if (profile.yearsMin == null && profile.yearsMax == null) items.push('经验年限区间待确认（少于几年不合适？超过几年会 overqualified？）');
  if (profile.must && profile.must.length === 0) items.push('必备条件待确认（哪 2-3 个条件是硬性门槛？）');
  items.push('业绩口径待确认（用什么数字衡量“做得好”？）');
  return items;
}
