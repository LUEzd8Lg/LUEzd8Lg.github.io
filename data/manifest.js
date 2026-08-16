/* ===========================================================================
   世界观察档案库 · 数据清单
   此文件为数据载入入口，由 app.js 读取后渲染。
   内容来源：C:\Users\12738\Desktop\世界观 下的 docx 档案
   提取方式：tools/extract-docx.ps1 → data/*.json → 合并到此处
   =========================================================================== */

window.ARCHIVE_DATA = {
  // 元信息
  meta: {
    siteName: '世界观察档案库',
    siteNameEn: 'WORLDVIEW ARCHIVE',
    updated: '2026-08-14',
    version: '0.1.0-skeleton',
    clearance: '访客 LV.1',
  },

  // 分类定义（顺序决定首页与导航顺序）
  categories: [
    {
      id: 'anomalies',
      code: 'ANOM',
      name: '异常档案',
      nameEn: 'Anomaly Archive',
      desc: '收录被记录在案的异常实体、现象、地点与物品。每条档案附有应对协议与危险分级。',
      icon: '⬡',
      source: '都市传说/ + 行动代号/',
    },
    {
      id: 'organizations',
      code: 'ORG',
      name: '组织名录',
      nameEn: 'Organization Registry',
      desc: '红月之下活跃的各类组织、企业、教会与机构的核心档案。',
      icon: '◈',
      source: '红月之下/核心档案/',
    },
    {
      id: 'deities',
      code: 'DEI',
      name: '神祇图鉴',
      nameEn: 'Deity Codex',
      desc: '旧神时代的众神名录，附神像图与权柄领域。',
      icon: '✦',
      source: '世界观目前/神/',
    },
    {
      id: 'eras',
      code: 'ERA',
      name: '纪元卷宗',
      nameEn: 'Era Codex',
      desc: '世界观三大纪元（神代、黑蚀、寂祀）与《喀尔迦书》《灾变纪》等典籍文本。',
      icon: '☉',
      source: '世界观目前/第一纪元/ + 第二纪元/ + 喀尔迦书/',
    },
    {
      id: 'timelines',
      code: 'TL',
      name: '组织时间线',
      nameEn: 'Organization Timelines',
      desc: '各组织历史事件的纵向时间线，可交叉对照。',
      icon: '◷',
      source: '红月之下/组织时间线/',
    },
  ],

  // 危险等级图例
  classLegend: [
    { code: 'safe',     name: '安全',     desc: '已理解且可控，无主动威胁' },
    { code: 'euclid',   name: '潜在',     desc: '特性不完全明确，需谨慎对待' },
    { code: 'keter',    name: '高危',     desc: '主动威胁且难以收容' },
    { code: 'apollyon', name: '终结',     desc: '可引发文明级灾难' },
    { code: 'thaumiel', name: '反制',     desc: '被用作收容/对抗其他异常的工具' },
    { code: 'neutral',  name: '未分级',   desc: '尚未评定或属于非异常条目' },
  ],

  // === 异常档案 ===
  // 字段：id, code, title, class, summary, body(HTML), tags, source
  anomalies: [],

  // === 组织名录 ===
  organizations: [],

  // === 神祇图鉴 ===
  // 字段：id, code, title, summary, img(相对 data/deities/), body
  deities: [],

  // === 纪元卷宗 ===
  // 字段：id, era(第一纪元/第二纪元/喀尔迦书/灾变纪), code, title, summary, body
  eras: [],

  // === 组织时间线 ===
  // 字段：id, org(组织名), code, title, summary, body
  timelines: [],

  // === 提取脚本生成的扩展数据将挂载到这里 ===
  // （由 tools/extract-docx.ps1 输出的 JSON 文件合并覆盖）
  _extracted: null,
};
