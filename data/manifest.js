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

  // === 异常档案（示例占位，待 docx 提取后替换） ===
  // 字段：id, code, title, class, summary, body(HTML), tags, source
  anomalies: [
    {
      id: 'UR-001',
      code: '步幅者',
      title: '步幅者 · Strider',
      class: 'euclid',
      summary: '一种以特定步频为触发条件的追踪型实体，曾被代号「午夜显影」行动记录。',
      tags: ['实体', '追踪', '夜间'],
      source: '都市传说/1都市传说 步幅者.docx',
      body: `
<h2>档案概述</h2>
<p><strong>步幅者</strong>是一种与人类行走节奏密切相关的异常实体。当目标个体的步频落入某一特定区间（约每秒 1.7–1.9 步）并持续 30 秒以上时，该实体将出现在目标的视觉边缘并开始同步移动。</p>
<blockquote>注：本条目由「都市传说」档案库录入，相关行动记录见 <a href="#/entry/anomalies/UR-001">UR-001</a>。</blockquote>

<h2>应对协议</h2>
<ul>
  <li>禁止单独在夜间空旷区域以恒定步频行走</li>
  <li>一旦发现步幅者踪迹，立即改变步频或停止移动</li>
  <li>切勿直视其面部——这会被视为「确认」</li>
</ul>

<h2>描述</h2>
<p>外观记录显示，步幅者身高约 2.1 米，下肢异常细长，整体轮廓呈黑色，无可见面部特征。其移动方式并非真正的「行走」，而是与目标的步频保持相位锁定。</p>

<div class="entry-appendix">
  <h3>附录 · 行动代号 001</h3>
  <p>代号「午夜显影」是已知首次针对步幅者的官方记录行动，详见 <code>行动代号/001行动代号：午夜显影 步幅者.docx</code>。</p>
</div>
`,
    },
    {
      id: 'UR-009',
      code: '克拉肯',
      title: '克拉肯 · Kraken',
      class: 'keter',
      summary: '深海巨型异常实体，代号「苍穹之眼」行动的目标。', 
      tags: ['实体', '深海', '巨型'],
      source: '都市传说/11都市传说 克拉肯.docx + 行动代号/009行动代号：苍穹之眼 克拉肯.docx',
      body: `
<h2>档案概述</h2>
<p><strong>克拉肯</strong>为深海巨型异常实体的统称，其体型远超生物学已知极限。多次海事失踪事件与其活动周期高度吻合。</p>
<h2>描述</h2>
<p>因体量过大，常规收容手段不适用。已知唯一可行的应对方式为「区域回避」——通过声呐预警网络标记其活动海域。</p>
`,
    },
  ],

  // === 组织名录 ===
  organizations: [
    {
      id: 'ORG-EDC',
      code: 'EDC',
      title: '永恒钻探公司 · Eternal Drilling Corporation',
      class: 'thaumiel',
      summary: '以深层钻探为核心业务的大型企业，其活动与多个深层异常现象相关。',
      tags: ['企业', '深层', '资源'],
      source: '红月之下/核心档案/永恒钻探公司（Eternal Drilling Corporation, EDC）核心档案.docx',
      body: `
<h2>组织概述</h2>
<p><strong>永恒钻探公司</strong>（Eternal Drilling Corporation，简称 EDC）是一家以超深层钻探技术闻名的资源企业。其钻探深度记录远超公开行业标准。</p>
<h2>已知关联</h2>
<ul>
  <li>深层异常实体的源头调查</li>
  <li>与「埃尔德」相关现象的地底活动</li>
</ul>
`,
    },
    {
      id: 'ORG-ECO',
      code: 'ECO',
      title: 'ECO 基金会 · ECO Foundation',
      class: 'thaumiel',
      summary: '以生态保护为公开名义的国际基金会，实际介入多个异常事件的处置。',
      tags: ['基金会', '国际', '生态'],
      source: '红月之下/核心档案/ECO基金会核心档案.docx',
      body: `<p>档案待提取填充。</p>`,
    },
  ],

  // === 神祇图鉴 ===
  // 字段：id, code, title, summary, img(相对 data/deities/), body
  deities: [
    {
      id: 'DEI-P01',
      code: 'OG-P01',
      title: '白曐 · The White Star',
      summary: '第一纪元最初降临者之一，与「天坠之始」密切相关。',
      img: 'deities/OG-P01 白曐.png',
      body: `<p>神祇档案待 docx 提取后补完。</p>`,
    },
    {
      id: 'DEI-P02',
      code: 'OG-P02',
      title: '埃尔德 · Elder',
      summary: '与「深」相关之神，多次回归事件的核心。',
      img: 'deities/OG-P02 埃尔德.png',
      body: `<p>神祇档案待 docx 提取后补完。</p>`,
    },
  ],

  // === 纪元卷宗 ===
  // 字段：id, era(第一纪元/第二纪元/喀尔迦书/灾变纪), code, title, summary, body
  eras: [
    {
      id: 'ERA-I-01',
      era: '第一纪元',
      code: 'I-01',
      title: '第一卷：天坠之始',
      summary: '第一纪元开篇，记载天坠事件与众神降临之始。',
      source: '世界观目前/第一纪元/第一卷：天坠之始.docx',
      body: `<p>正文待 docx 提取后填充。</p>`,
    },
    {
      id: 'ERA-II-01',
      era: '第二纪元',
      code: 'II-01',
      title: '黑蚀纪元 · 第一卷：神隐之年',
      summary: '第二纪元开篇，记录众神隐退之年代。',
      source: '世界观目前/第二纪元/黑蚀纪元 · 第一卷：神隐之年.docx',
      body: `<p>正文待 docx 提取后填充。</p>`,
    },
    {
      id: 'ERA-KRG-01',
      era: '喀尔迦书',
      code: 'KRG-01',
      title: '第一章：白星自穹顶来',
      summary: '《喀尔迦书》首章，含原文与白话文翻译。',
      source: '世界观目前/新建文件夹 (2)/第一章：白星自穹顶来（原文+白话文翻译）.docx',
      body: `<p>原文与白话文翻译待 docx 提取后填充。</p>`,
    },
  ],

  // === 组织时间线 ===
  // 字段：id, org(组织名), code, title, summary, body
  timelines: [
    {
      id: 'TL-EDC',
      org: '永恒钻探公司',
      code: 'TL-EDC',
      title: '永恒钻探公司时间线',
      summary: 'EDC 自创立至今的关键节点。',
      source: '红月之下/组织时间线/永恒钻探公司（EDC）时间线.docx',
      body: `<p>时间线事件待 docx 提取后填充。</p>`,
    },
    {
      id: 'TL-ECO',
      org: 'ECO 基金会',
      code: 'TL-ECO',
      title: 'ECO 基金会时间线',
      summary: 'ECO 基金会的历史事件时间线。',
      source: '红月之下/组织时间线/ECO基金会时间线.docx',
      body: `<p>时间线事件待 docx 提取后填充。</p>`,
    },
  ],

  // === 提取脚本生成的扩展数据将挂载到这里 ===
  // （由 tools/extract-docx.ps1 输出的 JSON 文件合并覆盖）
  _extracted: null,
};
