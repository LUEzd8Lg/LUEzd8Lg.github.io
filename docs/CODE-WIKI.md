# 世界观察档案库 · Code Wiki

> **项目代号**：LUEzd8Lg.github.io / Worldview Archive
> **文档版本**：v1.0（2026-10-23）
> **适用代码**：`index.html` 引用 `style.css?v=74`、`app.js?v=82`
> **面向读者**：接手维护的开发者、内容运营、二次开发者

---

## 目录

- [0. 十分钟上手](#0-十分钟上手)
- [1. 项目总览](#1-项目总览)
- [2. 系统架构](#2-系统架构)
- [3. 目录与文件地图](#3-目录与文件地图)
- [4. 前端架构（app.js）](#4-前端架构appjs)
- [5. 数据模型与本地存储](#5-数据模型与本地存储)
- [6. 后端服务（server/）](#6-后端服务server)
- [7. 关键函数与类参考](#7-关键函数与类参考)
- [8. 运行、构建与部署](#8-运行构建与部署)
- [9. 扩展开发指南](#9-扩展开发指南)
- [10. 已知限制、风险与技术债](#10-已知限制风险与技术债)
- [11. 附录](#11-附录)

---

## 0. 十分钟上手

```powershell
# 方式 A：纯静态预览（无需 Node）
powershell -ExecutionPolicy Bypass -File .\serve.ps1
# 浏览器打开 http://localhost:8080

# 方式 B：带后端（注册/登录/投稿/后台写档）
cd server
npm install
copy .env.example .env
npm start
# 浏览器打开 http://localhost:3000
```

默认管理员（**仅供本地调试，上线必须修改**）：`admin / admin123`。

三条必须知道的规则：

1. **没有构建步骤**。改完 `app.js` / `style.css` 直接刷新即可；发布到 GitHub Pages 时靠 `?v=xx` 查询参数破缓存。
2. **前端数据不是来自接口**，而是启动时由 `data/manifest.js` + `data/merged.js` 挂到 `window.ARCHIVE_DATA`。
3. **后端是可选的**。`app.js` 的 `API` 层在检测不到后端时会自动降级到 `localStorage`（离线模式），页面不会白屏。

---

## 1. 项目总览

| 维度 | 说明 |
| --- | --- |
| 产品定位 | SCP 风格的虚构世界观档案库（红月 / 盖亚四洲），含分类档案、编年史、神祇图鉴、思维导图、监控 HUD |
| 应用形态 | 单页应用（SPA），Hash 路由（`#/path`），登录门禁 + 游客模式 |
| 前端技术 | 原生 HTML / CSS / JavaScript（ES2017+），无框架、无打包器、无 npm 依赖 |
| 前端主文件 | `index.html`（506 行）、`app.js`（11,757 行 / 568 KB）、`style.css`（8,419 行 / 258 KB） |
| 后端技术 | Node.js ≥ 16 + Express 4（可选组件） |
| 后端主文件 | `server/index.js`（953 行）、`server/services/notifier.js` |
| 数据真源 | `data/*.json`（服务端） + `data/merged.js`（前端构建产物，约 1.9 MB） |
| 内容规模 | 5 个分类；当前 `organizations` 有实际条目，其余分类数组为空（既有状态，不是 Bug） |
| 部署方式 | GitHub Pages 纯静态托管（主）/ 自建 Node 服务器（备） |
| 主题 | `dark`（默认）/ `light` / `holo` 三套，由 `html` 的 class 切换 |
| 语言 | 界面、注释、数据结构均为中文；代码标识符为英文 |

### 1.1 核心能力清单

- 档案体系：分类列表（通用三视图：网格 / 列表 / 文件清单；分类专属：神祇网格、纪元分组、四洲编年表）、详情页（TOC、阅读时间、上下篇、收藏、评分、评论、排版原件 iframe、音频）。
- 检索体系：全局搜索（含搜索历史、热门标签、联想建议）、站内关键词高亮、术语索引、思维导图。
- 账户体系：注册 / 密码登录 / 短信验证码登录 / 游客模式，等级 `LV.1 ~ LV.9`。
- 创作体系：投稿页（富文本编辑器、DOCX 解析、图片 / 音频 / 封面 / 排版原件上传）、草稿自动保存、审核流转。
- 运营体系：管理后台 8 个 Tab（仪表盘、投稿审核、档案管理、用户管理、操作日志、栏目管理、数据备份、GitHub 同步）。
- 体验层：登录门禁粒子动画、开机启动序列、HUD、音效（Web Audio 合成）、合成 BGM、在线音乐、视差 / 探照灯、灯箱。

---

## 2. 系统架构

### 2.1 运行时拓扑

```
┌─────────────────────────────── 浏览器 ───────────────────────────────┐
│                                                                       │
│  index.html                                                           │
│   ├── style.css                  （视觉层：变量 / 三主题 / 动效）       │
│   ├── data/manifest.js           → 定义分类、危险等级图例、空数据骨架   │
│   ├── data/merged.js             → 覆盖 ARCHIVE_DATA 的分类数据数组     │
│   └── app.js                     → 单 IIFE，全部业务逻辑                │
│         ├── 数据层   DATA / getEntries / allEntries / computeStats     │
│         ├── 状态层   Auth / Favorites / Comments / RATINGS / …         │
│         ├── 通信层   API（fetch → /api/*，失败降级 localStorage）       │
│         ├── 视图层   renderHome / renderList / renderEntry / …         │
│         ├── 交互层   全局搜索 / 快捷键 / 侧边栏 / 灯箱 / 主题           │
│         └── 音频层   SFX / BGM（Web Audio） / OnlineMusic（<audio>）    │
│                                                                       │
│  localStorage（离线数据）   GitHub Contents API（云同步/发布）           │
└───────────────────────────────────────────────────────────────────────┘
                                    │  同源 fetch /api/*
                                    ▼
┌────────────────────── 可选：Node 后端（Express） ──────────────────────┐
│  server/index.js                                                      │
│   ├── /api/send-code /register /login /me /submit /account …          │
│   ├── /api/admin/*（JWT + requireAdmin）                              │
│   ├── /data/merged.js（运行时由 data/*.json 动态拼装）                 │
│   ├── express.static(项目根) + SPA fallback → index.html              │
│   └── 存储：DATA_DIR/*.json（用户/验证码/投稿/发送日志）               │
│             ARCHIVE_DATA_DIR/*.json（档案真源）                       │
│             UPLOAD_DIR/YYYY/MM（DOCX 与图片）                         │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 双模式运行

| 能力 | 纯静态（GitHub Pages） | 带 Node 后端 |
| --- | --- | --- |
| 数据来源 | `data/manifest.js` + `data/merged.js` | 服务端动态 `/data/merged.js` |
| 注册 / 登录 | 前端 mock（`Auth` + localStorage，验证码直接显示） | 真实 JWT，服务端校验 |
| 投稿 | 存 localStorage + 可推送 GitHub | 存服务端 `submissions`，进入审核队列 |
| 管理员权限 | 前端判断 `Auth.isAdmin()`（可被绕过，仅 UI 约束） | `requireAdmin` 中间件强制校验 |
| 后台写档案 | 写入 localStorage 覆盖层 → 手动「发布到 GitHub」 | 直接写 `data/*.json`，即时生效 |
| 跨设备数据 | 通过 GitHub Contents API（`CloudSync`） | 服务端统一存储 |
| 验证码 | 本地生成并回显 | mock 回显 / 阿里云短信 / SMTP 邮件 |

**降级判定**：`API._fetch` 只要收到非 `application/json` 响应或网络异常，就返回 `{ ok:false, _fetchError:true }`，各业务方法据此走本地实现。这套设计让同一份前端代码在两种部署下都能工作。

### 2.3 关键数据流

**A. 启动与首屏**

```
DOMContentLoaded
 └─ start()
     ├─ LocalCats.applyOverrides()      # 应用管理员自定义栏目
     ├─ LocalEntries.applyOverrides()   # 应用档案增删改覆盖
     ├─ Theme.init() / renderNavCats()
     ├─ bindGlobalSearch / bindLogout / bindThemeToggle / initSidebar / …
     └─ Auth.get() ? router() : showLoginGate()
```

**B. 路由渲染**

```
hashchange → router()
  ├─ 未登录 → showLoginGate()
  ├─ updateNav(path) + SFX.navigate()
  ├─ 按 parts[0] 分发到 renderXxx()
  ├─ 重放 .route-enter 入场动画
  └─ initLazyLoad()
```

**C. 投稿 → 审核 → 发布**

```
投稿页 renderSubmit()
  └─ API.submit(payload)
       ├─ 后端可用 → POST /api/submit → submissions(status=pending)
       │     └─ 管理员 POST /api/admin/submissions/:id/review
       │           ├─ approved → push 到 data/<分类主文件>.json
       │           └─ rejected → 仅改状态
       └─ 后端不可用 → Submissions.add() + pushSubmissionToGitHub() → data/submissions/pending/*.json
```

**D. 静态站的发布链路**

```
管理后台改档 → LocalEntries（localStorage 覆盖层）
            → 「数据备份」导出 data/*.json + data/merged.js
            → 「GitHub 同步」pushToGitHub()（逐个文件 PUT Contents API）
            → GitHub Pages 重建 → 所有人可见
```

### 2.4 分层职责

| 层 | 位置 | 职责 | 不该做的事 |
| --- | --- | --- | --- |
| 视觉层 | `style.css` | CSS 变量、布局、主题、动画 | 不写业务选择器逻辑 |
| 视图层 | `app.js` 的 `renderXxx` | 生成 HTML 字符串写入 `#view-container` | 不直接读写远端 |
| 状态层 | `app.js` 的 `Auth / Favorites / …` | localStorage CRUD + 事件广播 | 不操作 DOM |
| 通信层 | `app.js` 的 `API` | 统一 fetch、鉴权头、降级 | 不渲染 UI |
| 服务层 | `server/index.js` | 鉴权、持久化、档案读写、merged.js 生成 | 不输出 HTML 页面 |
| 数据层 | `data/*.json`、`data/merged.js` | 档案内容 | 不放业务逻辑 |

### 2.5 依赖关系

**前端：零第三方运行时依赖。** 不引入框架、路由库、图表库，全部手写。

| 外部依赖 | 类型 | 来源 | 使用位置 | 不可用时的行为 |
| --- | --- | --- | --- | --- |
| Mammoth.js | 动态 CDN（可选） | jsDelivr | `API._docxFallbackBrowser`（离线解析 DOCX） | 提示改用粘贴正文 |
| GitHub Contents API | 外部 HTTP | `api.github.com` | `CloudSync`、`pushToGitHub`、投稿直推 | 报错并提示检查仓库 / Token |
| 网易云兼容音乐 API | 用户自填 | 用户配置 | `OnlineMusic` | 在线音乐面板不可用 |
| Web Audio | 浏览器内置 | — | `SFX` / `BGM` | 静音，不影响功能 |

**后端 npm 依赖**（`server/package.json`，Node ≥ 16）

| 包 | 版本 | 用途 |
| --- | --- | --- |
| `express` | ^4.19.2 | HTTP 服务、路由、静态托管 |
| `cors` | ^2.8.5 | 跨域（`CORS_ORIGIN` 为空时全开） |
| `dotenv` | ^16.4.5 | 读取 `.env` |
| `jsonwebtoken` | ^9.0.2 | JWT 签发 / 校验 |
| `mammoth` | ^1.8.0 | 服务端 DOCX → HTML |
| `multer` | ^1.4.5-lts.1 | 文件上传（DOCX / 图片） |
| `nodemailer` | ^6.9.14 | SMTP 邮件验证码 |
| `@alicloud/dysmsapi20170525` 等 3 个 | ^2.0.24 / ^0.4.11 / ^1.4.9 | **optionalDependencies**，仅阿里云短信通道需要 |

**模块依赖方向**（单向，避免循环）：

```
视图层 renderXxx
   ├──► 状态模块（Favorites / Comments / LocalEntries …）──► localStorage
   ├──► API ──► 后端 /api/* 或本地降级
   └──► 横切模块（Theme / SFX / BGM / OnlineMusic / Bus）

状态模块 ──► Bus（只广播，绝不调用 renderXxx 或操作 DOM）
API ──► Auth（取 Token），不反向依赖视图
```

**构建期依赖**：无 Node 也能维护静态站；`tools/*.ps1` 依赖 Windows PowerShell 5.1 + .NET（`System.IO.Compression.ZipFile`、`System.Web.Extensions`）。生产发布只依赖 GitHub Pages。

---

## 3. 目录与文件地图

```
LUEzd8Lg.github.io-main/
├── index.html                 # 唯一页面：骨架、登录门禁、三个弹窗、详情模板
├── app.js                     # 全部前端逻辑（IIFE，11,757 行）
├── style.css                  # 全部样式（8,419 行，含 3 套主题）
├── serve.ps1                  # 纯 PowerShell 静态服务器（:8080）
├── README.md                  # 仅一行仓库名
│
├── data/                      # 数据与静态资源
│   ├── manifest.js            # ARCHIVE_DATA 骨架（分类、classLegend、空数组）
│   ├── merged.js              # 自动生成：覆盖各分类数组（约 1.9 MB，含 base64 图）
│   ├── organizations.json     # 组织名录真源（约 1.9 MB）
│   ├── anomalies-urban.json   # 异常档案（当前空数组）
│   ├── anomalies-operations.json
│   ├── deities.json / eras.json / timelines.json   # 当前空数组
│   ├── deities/               # 神祇立绘（按 id 或 code 命名）
│   ├── timeline/              # 四洲/纪元头图（CCTV 背景、编年表配图）
│   ├── library/               # l00.md / l01.md / l07.md 文库原始 Markdown
│   ├── audio/                 # irish-choir.wav（12 MB）
│   ├── uploads/               # 后端上传目录（YYYY/MM）
│   ├── hero.png               # 首页巨幕背景（2.1 MB）
│   └── logo-mark.png          # 站点徽标（664 KB，带 Alpha）
│
├── server/                    # 可选 Node 后端
│   ├── index.js               # Express 入口，全部 API
│   ├── services/notifier.js   # 短信 / 邮件双通道
│   ├── package.json           # 依赖清单
│   ├── .env.example           # 环境变量样板
│   ├── start.bat              # Windows 一键启动
│   ├── data/                  # DATA_DIR 默认位置（用户/验证码/投稿）
│   ├── _extract_asia.js       # 一次性数据抽取脚本
│   └── _extract_era.js
│
├── tools/                     # 运维 / 数据脚本（PowerShell）
│   ├── extract-docx.ps1       # DOCX → JSON（ZipFile + XML，无需 Office）
│   ├── merge-manifest.ps1     # data/*.json → data/merged.js
│   └── server.ps1             # 备用静态服务器
│
├── docs/
│   ├── deploy.md              # 部署方案（GitHub Pages 路线）
│   ├── gaia-roadmap.md        # 星球可视化路线图（尚未落地为代码）
│   └── image-prompts.md       # 生图提示词
│
├── .trae/specs/worldview-archive-enhancements/
│   ├── spec.md                # 增强规格（功能需求 / 验收标准）
│   └── tasks.md               # 任务拆解
│
├── 图片/                       # 四洲参考图（东洲/中州/北州/南州.png）
├── *.png                      # 各类页面头图、截图、参考图
├── 爱尔兰合唱团.wav             # 素材音频
└── 红月.ttf                   # 字体
```

**根目录的 `*.png` 大量是设计与截图素材**（`_cmp_*.png`、`cctv-*.png`、`tl-*.png`、`wh-*.png` 等），其中只有被 `app.js` / `style.css` 引用的部分会参与线上渲染。

---

## 4. 前端架构（app.js）

### 4.1 文件组织

整个文件是一个立即执行函数：

```js
(() => {
  'use strict';
  // 1) 基础工具与数据
  // 2) 状态模块
  // 3) API 层
  // 4) 登录门禁 / 启动动画
  // 5) 路由与视图渲染
  // 6) 交互绑定与音频
  // 7) start()
})();
```

模块之间通过三种方式耦合：**闭包共享变量**（`DATA`、`view`）、**`Bus` 事件总线**、**全局 `window` 挂载**（供 HTML 内联 `onerror` 调用）。

### 4.2 模块分段索引

| 行号范围 | 模块 | 说明 |
| --- | --- | --- |
| 10–97 | `CursorFX` | 自绘十字准星光标，按 hover 元素切换形态 |
| 99–131 | 数据访问 | `DATA`、`CAT_MAP`、`getEntries`、`findEntry`、`allEntries`、`computeStats` |
| 133–239 | `GLOSSARY_TERMS` | 术语词典（神祇/组织/地点/事件/仪式等），供术语索引与正文跳转 |
| 246–343 | 纪元体系 | `ERA`、`ERA_ANCHORS`、`ERA_TIERS`、`CANON_TIERS`、`WORKSHELF_GROUPS`、换算函数 |
| 346–360 | 存储键常量 | 所有 `wa_*` key 的唯一定义处 |
| 363–408 | `ICO` / `ico()` | 内联 SVG 图标库 |
| 411–415 | `Bus` | 事件总线（`on` / `emit`） |
| 418–455 | `Favorites` | 收藏，按用户名分桶 |
| 458–493 | `MarkedRead` | 手动「已读」标记 |
| 495–543 | `RATINGS` | SCP 式 +1 / -1 评分，按用户去重 |
| 545–606 | `Comments` | 批注（支持回复、点赞、软删除） |
| 608–630 | `AdminLogs` | 管理员操作日志（最多 500 条） |
| 632–656 | `Theme` | dark / light / holo 三主题切换 |
| 658–708 | `ReadProgress` | 阅读进度（滚动位置 + 百分比） |
| 710–861 | `CloudSync` | GitHub Contents API 云同步（收藏 / 阅读 / 评论）与通用 `apiGet/apiPut` |
| 863–891 | `SubmitDraft` | 投稿草稿箱（按用户分桶） |
| 893–1010 | `Auth` | 登录态、JWT、本地用户库、验证码、等级权限 |
| 1012–1516 | `API` | 后端接口封装 + 离线降级 + 管理员接口 + DOCX/图片/音频上传 |
| 1519–1548 | `Submissions` | 投稿的本地存取 |
| 1552–1630 | `LocalCats` | 栏目 / 子分组的本地覆盖与持久化 |
| 1632–1710 | `LocalEntries` | 档案增删改的本地覆盖（added / updated / deleted） |
| 1712–1925 | 账号面板 | 身份刷新、收藏/进度列表、云同步面板、注销 |
| 2009–2522 | 登录门禁 | 粒子背景、表单切换、启动序列 `showBootSequence` |
| 2523–2782 | 门禁事件 | `bindLoginGate`、验证码提示、登出 |
| 2783–2949 | 全局能力 | 快捷键、主题按钮、状态栏刷新、关键词高亮、导出备份、增长曲线 |
| 2951–3049 | 路由与导航 | `router`、`updateNav`、`renderNavCats` |
| 3050–3245 | 监控终端 | `CCTV_CHANNELS`、`renderCCTV`、`initCCTV` |
| 3246–3797 | 首页 | `renderHome`、`startHeroEffects`、`startHeroDust` |
| 3798–4470 | 列表页 | `renderList`、封面解析、程序化封面、网格/列表/清单 HTML |
| 4569–4725 | 世界史 | `WORLD_HISTORY` 四洲四纪元、`renderWorldHistory` |
| 4727–4747 | TOC | `injectTocAnchors` 注入锚点并抽取目录 |
| 4749–5428 | 详情页 | `renderEntry`（印章、元信息、排版原件、音频、评论、评分、进度、上下篇） |
| 5429–5525 | 设定中心 | `renderCanon`（正典层级 / 作品全集 / 已知勘误） |
| 5526–5715 | 文库 | `LIBRARY_DOCS`、`mdToHtml`、`renderLibrary`、`renderLibraryDoc` |
| 5716–5835 | 搜索 / 术语 | `renderSearch`、`snippet`、`glossaryData`、`glossaryCard` |
| 5836–6017 | 健康 / 观测 | `renderHealth`、`renderObserve`（随机档案卡） |
| 6018–6392 | 思维导图 | `renderMindMap`（自绘物理布局，无第三方库） |
| 6393–7364 | 投稿页 | `renderSubmit`（编辑器、上传、预览、草稿） |
| 7365–7916 | 账户页 | `renderAccount`、`renderUserPage`、`renderActivityTimeline` |
| 7917–9683 | 管理后台 | `renderAdmin` + 8 个 Tab 的渲染与事件 |
| 9684–9849 | 404 / 全局搜索 | `renderNotFound`、搜索历史、联想、热门标签 |
| 9850–10392 | 工具与侧边栏 | `escapeHtml`、`debounce`、懒加载、灯箱、返回顶部、条目导出、`initSidebar`、纪年换算、档案夹 |
| 10393–10657 | `SFX` | Web Audio 合成音效（无音频文件） |
| 10658–11243 | `BGM` | Web Audio 合成氛围音乐（drone + pad + 琶音 + 噪声） |
| 11244–11547 | `OnlineMusic` | 网易云兼容 API + 直接 URL 播放 |
| 11548–11718 | 音频 UI | 音效 / BGM / 在线音乐开关与音量同步、视差、探照灯 |
| 11719–11757 | 启动 | `start()`、`hashchange` 绑定、状态栏轮询 |

### 4.3 数据访问层

```js
const DATA = window.ARCHIVE_DATA;              // app.js:99
const view = document.getElementById('view-container');

getEntries(catId)        // DATA[catId] || []
findEntry(catId, id)     // 按 id 查找
allEntries()             // 摊平全部分类，附加 _cat
computeStats()           // { counts: {catId:n}, total }
statsCounts() / statsTotal()
```

`DATA.categories` 是导航与路由的唯一依据；`CAT_MAP` 是其 `id → category` 索引，栏目增删后需调用 `rebuildCatMap()`。

### 4.4 事件总线 `Bus`

极简发布订阅，用于跨模块解耦（例如评论变更后刷新列表、状态栏计数）：

```js
Bus.on(evt, fn);    // 注册
Bus.emit(evt, payload); // 触发，监听器异常被吞掉
```

事件清单见 [附录 B](#b-事件总线事件)。

### 4.5 API 层与降级策略

```
API._fetch(path, opts)
  ├─ 注入 Content-Type + Authorization: Bearer <JWT>
  ├─ fetch(path, { credentials:'same-origin' })
  ├─ 响应非 application/json → { ok:false, _fetchError:true }
  └─ 网络异常 → { ok:false, _fetchError:true }
```

各业务方法在拿到 `_fetchError` 后调用本地实现，典型映射：

| 方法 | 后端路径 | 降级实现 |
| --- | --- | --- |
| `sendCode` | `POST /api/send-code` | `Auth.generateCode()` |
| `register` | `POST /api/register` | 校验本地验证码 + `Auth.register()` |
| `login` | `POST /api/login` | `Auth.login()`；`admin/admin123` 直接授予 `LV.9` |
| `loginByCode` | `POST /api/login`（带 code） | `Auth.loginByCode()` |
| `submit` | `POST /api/submit` | `Submissions.add()` + `pushSubmissionToGitHub()` |
| `uploadDocx` | `POST /api/submit/upload-docx` | 动态加载 CDN `mammoth.browser.min.js` 浏览器端解析 |
| `uploadImage` | `POST /api/submit/upload-image` | `FileReader` → base64 data URI |
| `uploadAudio` | `POST /api/submit/upload-audio`（**后端未实现**） | 一律 base64 |
| `uploadDossier` | GitHub Contents API | 无降级（明确报错） |
| `deleteAccount` | `DELETE /api/account` | `Auth.deleteAccountLocal()` |
| `fetchSubmissions` | `GET /api/submissions` | `Submissions.get()` |
| `admin*` | `/api/admin/*` | `LocalEntries` / `LocalCats` / `AdminLogs` |

> 注意：`uploadAudio` 请求的后端路由在 `server/index.js` 中不存在，因此带后端时也会走 base64；大音频会显著撑大投稿 JSON。

### 4.6 路由

Hash 路由，无 History API：

```
#/                         首页
#/search?q=关键词           搜索结果
#/glossary                 术语索引
#/canon                    设定中心
#/library                  文库列表
#/library/:docId           文库阅读
#/health                   档案库健康看板
#/observe                  随机观测
#/mindmap                  思维导图
#/submit                   投稿
#/admin?tab=xxx            管理后台
#/account                  我的账户
#/user/:username           公开用户页
#/entry/:cat/:id           档案详情
#/:catId?page=&q=&view=    任意分类列表（分类 id 动态）
其它                       404
```

通用列表每页 12 条（`eras` 不分页，一次 9999 条）；列表页支持 `←/→` 方向键翻页（见 `bindKeyboardShortcuts`，app.js:2785）。

### 4.7 视图层约定

- 所有视图函数返回/写入 **HTML 字符串**，不做虚拟 DOM 差分，每次路由整体替换 `#view-container`。
- 事件绑定采用两种方式：视图渲染后手动 `querySelector` 绑定；或在 HTML 字符串里写内联 `onclick` 调用挂到 `window` 的函数。
- 用户输入进入 HTML 前必须经过 `escapeHtml` / `escapeAttr`（app.js:9850）。
- 分类横幅通过 CSS 变量 `--lh-img` 由 JS 注入；`initLazyLoad` 在路由切换后重新执行。

### 4.8 视觉与交互

| 能力 | 实现位置 | 说明 |
| --- | --- | --- |
| 三主题 | `Theme`（633）+ CSS `theme-light` / `theme-holo` | 状态存 `wa_theme_v1` |
| 登录门禁 | `showLoginGate` / `bindLoginGate`（2012 / 2523） | Canvas 粒子 + 表单校验 + 验证码倒计时 |
| 启动序列 | `showBootSequence`（2186） | 终端解码文字、扫描线、ACCESS GRANTED |
| 程序化封面 | `generateProceduralCover`（4191） | 无图条目用 data-URI SVG 生成黑白档案风封面 |
| 图片降级 | `resolveEntryImage`（4156） | 返回**候选 URL 数组**：`e.img` → `data/{cat}/{id|code}.{png,jpg,jpeg,webp}` → 占位图 → 程序化 SVG，由 `<img onerror>` 逐级回退 |
| 灯箱 | `openLightbox`（9920）/ `bindLightbox`（9965） | 正文图片点击放大 |
| 懒加载 | `initLazyLoad`（9896） | `loading="lazy"` + IntersectionObserver 占位 |
| 视差 / 探照灯 | `initParallax`（11639）/ `initSpotlight`（11670） | 列表头图视差、鼠标跟随光斑 |
| 快捷键 | `bindKeyboardShortcuts`（2785） | `/` 聚焦搜索、`Esc` 关弹窗、`←/→` 翻页 |

### 4.9 音频子系统

| 模块 | 行号 | 音源 | 说明 |
| --- | --- | --- | --- |
| `SFX` | 10394 | Web Audio 合成 | 点击、导航、管理员操作等短音效；含反馈延迟“混响” |
| `BGM` | 10659 | Web Audio 合成 | 低频 drone、pad 和弦、琶音、噪声风声，定时器调度 |
| `OnlineMusic` | 11245 | `<audio>` + 外部 API | 需用户配置网易云兼容 API 地址（`wa_om_api`），也可直接播放 URL |

首次 `pointerdown` / `keydown` 时解锁 `AudioContext`（浏览器自动播放策略）。

---

## 5. 数据模型与本地存储

### 5.1 `window.ARCHIVE_DATA`

由 `data/manifest.js` 定义，`data/merged.js` 覆盖：

```js
window.ARCHIVE_DATA = {
  meta: {
    siteName, siteNameEn, updated, version, clearance, total
  },
  categories: [
    { id, code, name, nameEn, desc, icon, source, subcats? }
  ],
  classLegend: [
    { code: 'safe'|'euclid'|'keter'|'apollyon'|'thaumiel'|'neutral', name, desc }
  ],
  anomalies: [], organizations: [], deities: [], eras: [], timelines: [],
  _extracted: null
}
```

分类 id 与路由强绑定：`anomalies` / `organizations` / `deities` / `eras` / `timelines`。

### 5.2 条目（Entry）字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 唯一编号（`UR-014` / `ORG-001` / `SUB-001` …） |
| `code` | string | 档案代号（可选） |
| `title` | string | 标题 |
| `class` | string | 危险分级，对应 `classLegend.code` |
| `summary` | string | 摘要（列表卡、搜索结果用） |
| `body` | string(HTML) | 结构化正文 |
| `content` | string(HTML) | 与 `body` 同义，服务端兼容字段 |
| `tags` | string[] | 关键词 |
| `source` | string | 来源档案说明 |
| `img` / `cover` | string | 封面（相对 `data/`、绝对路径或 base64） |
| `audio` | string | 音频地址 |
| `dossier` | string | 排版原件 HTML 路径，详情页以 iframe 原样嵌入 |
| `era` / `org` | string | 所属纪元 / 组织 |
| `author` `authorLevel` `approvedAt` `approvedBy` `fromSubmissionId` | — | 投稿合并后的溯源信息 |

### 5.3 localStorage 键表

| Key | 内容 | 维护模块 |
| --- | --- | --- |
| `wa_auth_v1` | 当前登录态 `{user, lvl, at, guest, role}` | `Auth` |
| `wa_jwt_v1` | 后端签发的 JWT | `Auth` |
| `wa_users_v1` | 本地用户库（`pass` 为 `btoa`） | `Auth` |
| `wa_codes_v1` | 本地验证码 `{contact:{code,exp}}` | `Auth` |
| `wa_submissions_v1` | 本地投稿列表 | `Submissions` |
| `wa_entries_overrides_v1` | 档案增删改覆盖 `{cat:{added,updated,deleted}}` | `LocalEntries` |
| `wa_categories_v1` | 栏目 / 子分组覆盖 | `LocalCats` |
| `wa_dismissed_notices_v1` | 已关闭的审核通知 | 通知条 |
| `wa_favorites_v1` | 收藏（按用户分桶） | `Favorites` |
| `wa_marked_read_v1` | 手动已读 | `MarkedRead` |
| `wa_ratings_v1` | 评分 `{ "cat:id": {up:[],down:[]} }` | `RATINGS` |
| `wa_comments_v1` | 批注（按条目分桶） | `Comments` |
| `wa_read_progress_v1` | 阅读进度 `{ "user|cat:id": {scrollTop,offsetPct,at} }` | `ReadProgress` |
| `wa_submit_draft_v1` | 投稿草稿（按用户分桶） | `SubmitDraft` |
| `wa_admin_logs_v1` | 管理员日志（≤500 条） | `AdminLogs` |
| `wa_theme_v1` | `dark` / `light` / `holo` | `Theme` |
| `wa_cloud_cfg_v1` | 云同步配置（可选记住 token） | `CloudSync` |
| `wa_github_sync` | 后台 GitHub 同步配置 | 管理后台 |
| `wa_submission_token` | 投稿直推 GitHub 的 token | 投稿页 |
| `wa_profile_v1` | 用户资料 | 账户页 |
| `wa_search_history` | 搜索历史 | 全局搜索 |
| `wa_view` | 列表视图偏好 `grid` / `list` | 列表页 |
| `wa_sidebar_open` | 桌面侧边栏状态 | 侧边栏 |
| `wa_sfx_muted` / `wa_sfx_vol` | 音效开关 / 音量 | `SFX` |
| `wa_bgm_on` / `wa_bgm_vol` | BGM 开关 / 音量 | `BGM` |
| `wa_om_api` / `wa_om_vol` / `wa_om_history` | 在线音乐 API / 音量 / 历史 | `OnlineMusic` |

### 5.4 数据生成链

```
原始 docx（站外） ──tools/extract-docx.ps1──► data/*.json
                                                  │
                               tools/merge-manifest.ps1
                                                  ▼
                                            data/merged.js  ← 前端 <script> 直接加载
```

- `manifest.js` 是**手写骨架**，定义分类与图例；
- `merged.js` 是**产物**，头部注释 `AUTO-GENERATED`，由 PowerShell 或管理后台生成；
- 同一份数据同时存在 `data/organizations.json`（约 1.9 MB）与 `data/merged.js`（约 1.9 MB），属于有意的“真源 + 前端打包”双份。

### 5.5 静态资源命名约定

| 资源 | 约定 | 解析函数 |
| --- | --- | --- |
| 条目封面 | `data/{cat}/{id|code}.png|jpg|jpeg|webp`，或条目 `img` 字段 | `resolveEntryImage`（4156） |
| 神祇立绘 | `data/deities/{id}.{ext}` | 同上 |
| 分类横幅 | 根目录 `IMG-0x …png`，写入 `--lh-img` | 各视图 `data-header-img` |
| 占位封面 | `无封面档案的默认占位图.png` / `placeholder-cover.png` | `PLACEHOLDER_IMG` |
| 排版原件 | `data/dossier/*.html`（自包含） | `entry.dossier` |

---

## 6. 后端服务（server/）

### 6.1 启动与配置

```bash
cd server
npm install
copy .env.example .env   # Windows
npm start                # 或 npm run dev（node --watch）
```

启动时会执行两段自检：

1. `ensureAdmin()`：确保 `ADMIN_CONTACT` 账号存在且 `role=admin`，不存在则用 `ADMIN_PASS` 创建内置管理员（`LV.9`、`builtIn`）。
2. `fixSubmissionStatus()`：为老投稿补 `status='pending'`。

`setInterval(persistAll, 15_000).unref()` 每 15 秒落盘一次。

### 6.2 环境变量

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `CORS_ORIGIN` | 空（全开） | 允许的跨域来源，逗号分隔 |
| `DATA_DIR` | 空 | 用户/验证码/投稿 JSON 目录；空则**仅内存，重启丢失** |
| `ARCHIVE_DATA_DIR` | `../data` | 档案 JSON 目录 |
| `UPLOAD_DIR` | `../data/uploads` | 上传文件根目录 |
| `ADMIN_CONTACT` / `ADMIN_PASS` | `admin` / `admin123` | 内置管理员 |
| `JWT_SECRET` / `JWT_EXP` | 内置弱密钥 / `12h` | JWT 签名与有效期 |
| `SMS_PROVIDER` | `mock` | `mock` / `aliyun` |
| `ALIYUN_*` | — | 阿里云短信 4 个必填项 + endpoint |
| `EMAIL_PROVIDER` | `mock` | `mock` / `smtp` |
| `SMTP_*` / `EMAIL_FROM_NAME` | — | SMTP 邮件 |
| `CODE_TTL_SEC` | `300` | 验证码有效期 |
| `SEND_COOLDOWN_SEC` | `60` | 同目标发送冷却 |
| `DAILY_LIMIT_PER_IP` | `100` | 单 IP 每日上限 |
| `DEFAULT_LEVEL` | `LV.2` | 注册默认等级 |

### 6.3 存储模型

| 文件（`DATA_DIR`） | 结构 | 说明 |
| --- | --- | --- |
| `users.json` | `[{contact, passHash, level, role, createdAt, builtIn?}]` | 密码 `sha256(password + '::WVA_SALT_2026')` |
| `codes.json` | `{ contactKey: {code, exp, ip} }` | 验证码 |
| `submissions.json` | `[{id,title,category,class,body,author,status,at,…}]` | 投稿，`status: pending/approved/rejected` |
| `sendLog.json` | `{ ip: [timestamps] }` | 每日发送限流 |

档案数据则是 `ARCHIVE_DATA_DIR` 下的 `CATEGORY_FILES` 映射：

```js
anomalies:     [urban, rural, nether, cosmic, classic]
organizations: [organizations.json]
eras / deities / timelines: 各自单文件
```

写入时统一落到 `CATEGORY_MAIN_FILE`（anomalies → `anomalies-urban.json`）。

### 6.4 鉴权与权限

```
Authorization: Bearer <JWT>
  └─ verifyToken() → payload{ sub, role, level }
       ├─ requireLogin  → 必须存在且 users 里能找到
       └─ requireAdmin  → payload.role === 'admin' 且库内 role 仍为 admin
```

等级规则：`LV.n` 中的数字决定权限；投稿要求 `n >= 2`（`/api/submit` 内解析 `user.level` 的数字）。

### 6.5 API 一览

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/send-code` | 无 | 发送验证码；mock 模式直接返回 code |
| POST | `/api/register` | 无 | 校验验证码 → 建用户 → 返回 JWT |
| POST | `/api/login` | 无 | 密码登录或 `code` 验证码登录 |
| GET | `/api/me` | 登录 | 当前用户资料 |
| POST | `/api/submit` | 登录 + LV.2 | 创建投稿（pending） |
| POST | `/api/submit/upload-docx` | 登录 | DOCX → HTML + 内嵌图片，落盘并改写 URL |
| POST | `/api/submit/upload-image` | 登录 | 图片上传，返回 `/data/uploads/...` |
| DELETE | `/api/account` | 无（校验密码） | 注销账号，投稿作者置为「(已注销用户)」 |
| GET | `/api/submissions` | 可选 | 管理员看全部；其他人只看已通过或自己的 |
| GET | `/api/admin/submissions` | 管理员 | 审核列表，支持 `status/category` |
| POST | `/api/admin/submissions/:id/review` | 管理员 | 通过/打回；通过时写入档案 JSON |
| GET | `/api/admin/entries/:cat` | 管理员 | 档案列表（附 `_srcFile`） |
| POST | `/api/admin/entries/:cat` | 管理员 | 新增档案 |
| PUT | `/api/admin/entries/:cat/:id` | 管理员 | 编辑档案（跨文件查找） |
| DELETE | `/api/admin/entries/:cat/:id` | 管理员 | 删除档案 |
| GET | `/api/admin/users` | 管理员 | 用户列表 |
| POST | `/api/admin/users/:contact/update` | 管理员 | 改角色 / 等级（内置管理员不可降级） |
| DELETE | `/api/admin/users/:contact` | 管理员 | 删用户（不能删自己 / 内置管理员） |
| GET | `/data/merged.js` | 无 | **动态生成**前端数据包 |
| GET | `/*` | 无 | 静态文件 + SPA 回退 `index.html` |

### 6.6 动态 `merged.js`

后台写档案只改 `data/*.json`，而前端读 `data/merged.js`。因此服务端在 `express.static` **之前**注册 `/data/merged.js`，每次请求实时拼装并 `Cache-Control: no-store`：

```js
D.anomalies = [...]; D.organizations = [...]; ...
D.meta.total = 总数; D.meta.updated = 今天;
```

这是“后台改了但别人看不到”问题的根因修复点。

### 6.7 通知服务 `services/notifier.js`

| 通道 | 触发条件 | 行为 |
| --- | --- | --- |
| mock | 默认 | 控制台打印验证码并回传前端 |
| aliyun | `SMS_PROVIDER=aliyun` | 阿里云短信 SDK（optionalDependencies，缺装会给出安装提示） |
| smtp | `EMAIL_PROVIDER=smtp` | nodemailer 发信 |

### 6.8 静态托管与 SPA 回退

```js
app.use('/', express.static(ROOT, { index:['index.html'], extensions:['html'], maxAge:0 }));
app.get('*', (req,res,next) => req.path.startsWith('/api/') ? next() : res.sendFile(ROOT/index.html));
```

`/api/*` 未命中不会落到回退，避免接口 404 被 HTML 掩盖。

---

## 7. 关键函数与类参考

### 7.1 前端

#### 数据与统计

| 函数 | 位置 | 签名 | 说明 |
| --- | --- | --- | --- |
| `getEntries` | app.js:106 | `(catId) => Entry[]` | 取分类数组，缺省空数组 |
| `findEntry` | app.js:107 | `(catId, id) => Entry\|undefined` | 按 id 精确匹配 |
| `allEntries` | app.js:109 | `() => Entry[]` | 摊平所有分类并附 `_cat` |
| `computeStats` | app.js:119 | `() => {counts,total}` | 分类计数与总数 |
| `rebuildCatMap` | app.js:103 | `() => void` | 栏目变更后重建 `CAT_MAP` |

#### 纪元与文本

| 函数 | 位置 | 说明 |
| --- | --- | --- |
| `ceToRm(ce)` | app.js:327 | 公元 → 红月年：`ce - 2312` |
| `rmToCe(rm)` | app.js:328 | 红月年 → 公元：`rm + 2312` |
| `fmtCe(ce)` | app.js:330 | 负数输出「前 N」，否则「公元 N」 |
| `fmtRm(ce)` | app.js:335 | 负数输出「红月前 N 年」，否则「红月 N 年」 |
| `tierBadge(tier)` | app.js:339 | 年表可信度徽标 S/A/B/C/X |
| `mdToHtml(md)` | app.js:5544 | 极简 Markdown → HTML（标题/列表/表格/代码/强调/删除线） |
| `injectTocAnchors(html)` | app.js:4727 | 为 `h2/h3` 注入 id，返回 `{html, toc}` |
| `highlightKeyword(text,kw)` | app.js:2886 | 搜索命中高亮 |
| `escapeHtml / escapeAttr` | app.js:9850 | XSS 防护的唯一出口 |
| `debounce(fn,delay)` | app.js:9886 | 通用防抖（搜索、草稿） |

#### 状态模块（对象字面量，非 class）

| 模块 | 位置 | 关键方法 |
| --- | --- | --- |
| `Auth` | 893 | `get/set/clear`、`getToken/setToken`、`role/isAdmin`、`register/login/loginByCode/guest`、`isLv(n)/canSubmit/isGuest/identity`、`generateCode/verifyCode`、`deleteAccountLocal` |
| `Favorites` | 418 | `list/has/toggle` |
| `MarkedRead` | 458 | `list/has/toggle` |
| `RATINGS` | 498 | `score/mine/vote(cat,id,±1)` |
| `Comments` | 546 | `list/add/remove/toggleLike` |
| `ReadProgress` | 659 | `save/get/clear/list/clearAll` |
| `SubmitDraft` | 863 | `get/save/clear` |
| `AdminLogs` | 609 | `record/clear/list/types` |
| `Theme` | 633 | `get/set/next/init` |
| `CloudSync` | 714 | `cfg/saveCfg/clearCfg/isConfigured`、`apiGet/apiPut`、`serialize/apply`、`push/pull` |
| `Submissions` | 1519 | `get/add/update/remove` |
| `LocalCats` | 1552 | `applyOverrides/addCat/updateCat/removeCat/addSubcat/removeSubcat` |
| `LocalEntries` | 1632 | `applyOverrides/add/update/delete` |

#### 通信

| 方法 | 位置 | 说明 |
| --- | --- | --- |
| `API._fetch(path,opts)` | 1018 | 统一 fetch，自动带 JWT，异常转 `_fetchError` |
| `API._authHeaders()` | 1013 | `{ Authorization: Bearer … }` |
| `API.sendCode/register/login/loginByCode` | 1044–1098 | 认证相关 |
| `API.submit(payload)` | 1099 | 投稿 |
| `API.uploadDocx/uploadImage/uploadAudio/uploadDossier` | 1112–1227 | 文件上传与降级 |
| `API._docxFallbackBrowser(file)` | 1229 | CDN mammoth 浏览器端解析 |
| `API.adminListSubmissions/adminReview` | 1296–1370 | 审核 |
| `API.adminEntries* / adminUsers*` | 1380+ | 档案与用户管理 |
| `API._adminLocalFallback(kind, params)` | 1497 | 离线模式下的管理员操作模拟 |

#### 路由与视图

| 函数 | 位置 | 说明 |
| --- | --- | --- |
| `router()` | 2951 | 全局路由分发、门禁判断、入场动画、懒加载 |
| `updateNav(path)` | 3010 | 顶部/侧栏高亮 |
| `renderNavCats()` | 3035 | 动态分类导航（顶部 + 侧栏） |
| `renderHome()` | 3247 | 首页 HERO、统计、分类卡、精选、监控终端 |
| `renderList(catId,query)` | 3799 | 六种视图切换 + 筛选 + 排序 + 分页 |
| `renderEntry(catId,id)` | 4749 | 详情页主渲染 |
| `renderCanon()` | 5429 | 设定中心 |
| `renderLibrary()` / `renderLibraryDoc(docId)` | 5640 / 5670 | 文库 |
| `renderSearch(q)` | 5725 | 搜索结果 + 摘要片段 |
| `renderGlossary()` | 5972 | 术语索引 |
| `renderHealth()` | 5861 | 数据健康看板（覆盖度、缺图、缺摘要等） |
| `renderObserve()` | 5920 | 随机观测卡 |
| `renderMindMap()` | 6018 | 思维导图（中心 → 分类 → 条目，最多 25/类） |
| `renderSubmit()` | 6394 | 投稿页（编辑器、上传、草稿） |
| `renderAccount()` | 7455 | 我的账户（资料、收藏、进度、批注、投稿） |
| `renderUserPage(username)` | 7601 | 公开用户主页 |
| `renderAdmin()` | 7918 | 管理后台外壳 + 8 Tab 分发 |
| `renderNotFound()` | 9685 | 404 |
| `start()` | 11720 | 启动装配 |

#### 管理后台 Tab

Tab 由 `drawAdminTab()`（app.js:8337）统一分发，URL 形如 `#/admin?tab=entries`。

| Tab | 渲染函数 | 行号 | 关键能力 |
| --- | --- | --- | --- |
| 数据仪表盘 `dash` | `drawDashTab` | 8067 | 分类统计、增长曲线、SVG 图表 |
| 待审核投稿 `subs` | `drawSubsTab` | 8860 | 通过 / 打回 / 改分类后合并入档 |
| 档案管理 `entries` | `drawEntriesTab` | 9206 | 增删改查、封面上传、音频状态 |
| 用户管理 `users` | `drawUsersTab` | 9536 | 提权、改等级、删除 |
| 操作日志 `logs` | `drawLogsTab` | 8207 | 日志筛选、清空 |
| 栏目管理 `cats` | `drawCatsTab` | 8711 | 栏目 / 子分组 CRUD |
| 数据备份 `data` | `drawDataTab` | 8269 | 导出 JSON / 全量备份 |
| GitHub 同步 `sync` | `drawSyncTab` | 8561 | 序列化 7 个文件（含 `merged.js`）并逐个 PUT |

#### 音频

| 模块 | 位置 | 公开 API |
| --- | --- | --- |
| `SFX` | 10394 | `click/navigate/adminClick/...`、`setMuted/setVolume`、`isMuted` |
| `BGM` | 10659 | `start/stop/isPlaying/setVolume` |
| `OnlineMusic` | 11245 | `search/play/playByUrl/stop/pause/resume`、`setApiBase/setVolume` |

### 7.2 后端

| 函数 | 位置 | 说明 |
| --- | --- | --- |
| `loadStore/saveStore` | server/index.js:70 / 81 | JSON 持久化；`DATA_DIR` 为空则 no-op |
| `persistAll()` | :127 | 全量落盘（15 秒定时 + 关键写操作后） |
| `hashPass(p)` | :150 | `sha256(p + '::WVA_SALT_2026')` |
| `signToken/verifyToken` | :158 / 165 | JWT 签发与校验 |
| `requireLogin/requireAdmin` | :171 / 179 | 鉴权中间件 |
| `listArchiveCategory(catId)` | :202 | 合并该分类所有 JSON 文件，附 `_srcFile/_cat` |
| `findEntry(catId,id)` | :216 | 跨文件定位条目，返回 `{srcFile,arr,idx,item,filePath}` |
| `writeArchiveFile(file,arr)` | :227 | 写回 JSON（2 空格缩进） |
| `genEntryId(catId,payload)` | :232 | 按前缀 + 自增生成 `UAR-/ORG-/ERA-/TL-/DEI-` |
| `readJsonIfExists(fp,fallback)` | :190 | 容错读取，非 `.json` 直接跳过 |
| `multerDocx / multerImage` | :263 / 274 | 30 MB DOCX / 10 MB 图片，落到 `YYYY/MM/` |

---

## 8. 运行、构建与部署

### 8.1 纯静态本地预览

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

- 端口 `8080`，`HttpListener` 实现，MIME 表覆盖 html/js/css/json/图片/字体/音视频。
- 该模式**没有 `/api/*`**，应用自动进入离线模式（验证码本地生成并回显）。
- 备选：`tools/server.ps1`。

### 8.2 带后端运行

```powershell
cd server
npm install
copy .env.example .env
notepad .env          # 至少改 JWT_SECRET / ADMIN_PASS
npm start
```

启动后：

- 前端：`http://localhost:3000/`
- API 示例：`http://localhost:3000/api/send-code`
- 后端会直接托管项目根目录的静态资源，无需另开静态服务器。
- 若 `DATA_DIR` 留空，用户/投稿只在内存，重启即失；**生产必须配置持久目录**。

### 8.3 GitHub Pages 部署（推荐路线）

1. 仓库 Settings → Pages → Source = `main` 分支根目录。
2. 生成 Fine-grained PAT：仅本仓库，权限 `Contents = Read and write`。
3. 站内「我的账户 → 云同步」填 Owner / Repo / PAT。
4. 后台改档 → 「GitHub 同步 → 上传到云端」（逐个 PUT `data/*.json` 与 `data/merged.js`）。
5. 约 1 分钟后 Pages 重建完成，所有人可见。

> 关键：第 4 步才是「发布」。只改本地 localStorage，别人看不到。

### 8.4 数据导入工具

| 脚本 | 用途 | 依赖 |
| --- | --- | --- |
| `tools/extract-docx.ps1` | 批量扫描 docx，解析 `word/document.xml` 输出 JSON | .NET 4.5+（ZipFile + Xml），无需 Word |
| `tools/merge-manifest.ps1` | 合并 `data/*.json` → `data/merged.js` | `System.Web.Extensions`（JavaScriptSerializer） |

```powershell
powershell -ExecutionPolicy Bypass -File tools\extract-docx.ps1 -Source "C:\...\世界观" -OutDir data
powershell -ExecutionPolicy Bypass -File tools\merge-manifest.ps1 -DataDir data
```

### 8.5 缓存与版本号

`index.html` 通过查询参数破缓存，**手工维护**：

```html
<link rel="stylesheet" href="style.css?v=74">
<script src="data/manifest.js?v=48"></script>
<script src="data/merged.js?v=48"></script>
<script src="app.js?v=82"></script>
```

改动任一文件后必须同步提升对应 `?v=`，否则老访客会拿到缓存。图片使用 `loading="lazy"`，封面按候选路径探测。

### 8.6 常见故障排查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| 页面全白 | `data/merged.js` 语法错误 / 体积过大加载失败 | DevTools Console；重新生成 merged.js |
| 登录后仍弹出登录门禁 | localStorage 被清 / `wa_auth_v1` 损坏 | 清除该 key 后重新登录 |
| 后端接口 404 被 HTML 吞掉 | 请求路径未以 `/api/` 开头 | 检查 `API._fetch` 路径 |
| 验证码收不到 | `SMS_PROVIDER=mock` | 页面会直接显示验证码；配 `.env` 才能真发 |
| 后台改了别人看不到 | 未发布到 GitHub / 未重启服务 | 走「GitHub 同步」或配置持久磁盘 |
| 投稿图片 404 | `UPLOAD_DIR` 与静态根不一致 | 确保 `UPLOAD_DIR=../data/uploads` |
| 8080 端口被占用 | http.sys 已注册（PID 4 为 System） | 换端口；**不要终止 PID 4** |

---

## 9. 扩展开发指南

### 9.1 新增一个分类

1. 在 `data/manifest.js` 的 `categories` 增加 `{id, code, name, nameEn, desc, icon, source}`。
2. 在 `data/merged.js` 同步 `D.categories`（或交给 `merge-manifest.ps1` 重建）。
3. 后端如需支持写档：在 `server/index.js` 的 `CATEGORY_FILES` 与 `CATEGORY_MAIN_FILE` 增加映射。
4. 如需专属图标：在 `app.js` 的 `CAT_ICONS`（3021）加 SVG 片段。
5. 刷新页面即可，路由 `#/{id}` 与导航会自动出现。

### 9.2 新增一条档案

- 静态站：管理后台 → 档案管理 → 新增 → 保存到 `LocalEntries` → 发布到 GitHub。
- 服务端：`POST /api/admin/entries/:cat`，或直接编辑 `data/*.json`。
- 封面：把图片放到 `data/{cat}/{id}.jpg` 即可自动命中，无需改 JSON。

### 9.3 新增页面

```js
// 1) 在 router() 增加分支（app.js:2972 附近）
else if (parts[0] === 'my-page') renderMyPage();

// 2) 实现视图函数
function renderMyPage() {
  view.innerHTML = `<section class="my-page">…</section>`;
  // 3) 渲染后绑定事件
}
```

导航入口：`index.html` 的 `.header-nav` / `.sidebar-nav`，或动态由 `renderNavCats()` 生成。

### 9.4 新增主题

1. `style.css` 以 `html.theme-xxx { --bg: …; --text: …; }` 定义变量覆盖。
2. `Theme.CYCLE`（635）加入新主题名；`Theme._apply`（649）切换对应 class。

### 9.5 新增后端 API

```js
app.post('/api/foo', requireLogin, (req, res) => {
  // 校验 → 操作 store → persistAll() → jsonReply(res, 200, {ok:true})
});
```

注意：路由必须注册在 `express.static` 与 `app.get('*')` 之前，否则会被 SPA 回退截获。

### 9.6 编码约定

- 不用 `innerHTML` 拼接未转义的用户输入，统一走 `escapeHtml`。
- 新增 localStorage 读写必须集中在对应模块，键名加到 `app.js:347-360` 的常量区。
- 新模块广播变更使用 `Bus.emit`，不要直接调用别的视图函数。
- 注释与 UI 文案用中文，标识符用英文。

---

## 10. 已知限制、风险与技术债

### 10.1 功能缺口

| 项 | 说明 |
| --- | --- |
| `POST /api/submit/upload-audio` | 前端有调用，后端未实现，永远走 base64 |
| `data/anomalies*.json` / `deities` / `eras` / `timelines` | 目前为空数组，页面空态是既有状态 |
| 星球可视化 / 区域地图 | `docs/gaia-roadmap.md` 仅为路线图，代码中无 `gaia-globe.js` / `region-map.js` |
| 评论 / 评分 / 收藏 | 仅存本地（或用户自己的 GitHub 云文件），**不是全站共享** |
| 文库文档 | `LIBRARY_DOCS` 列了 l00–l10，但 `data/library/` 只有 l00/l01/l07 |
| 自动化测试 | 仓库无测试、无 lint、无 CI |
| 异常档案文件名不一致 | 前端同步写 `anomalies-operations.json`，后端 `CATEGORY_FILES` 只读 `urban/rural/nether/cosmic/classic`，`operations` 不会被后端加载 |
| 后台字段编辑范围 | 档案编辑弹窗覆盖主要字段，`subcats` 等结构字段仍需改 JSON |

### 10.2 性能

- `data/merged.js` 约 **1.95 MB**，且 `<script>` 未加 `defer`，会阻塞首屏解析。
- `merged.js` 与 `organizations.json` 内容重复，各自约 1.9 MB。
- 条目封面以内联 base64 存入 `merged.js`，进一步放大体积；`organizations` 徽标图尤其明显。
- `data/hero.png` 2.1 MB、`data/logo-mark.png` 664 KB、`data/audio/irish-choir.wav` 12 MB 都是大文件。
- 列表页无虚拟滚动，每次整体重绘 12 条卡片；`eras` 一次性渲染全部分组，条目增长后 DOM 压力会上升。

### 10.3 安全风险（务必阅读）

| 风险 | 位置 | 建议 |
| --- | --- | --- |
| 默认管理员 `admin/admin123` | 前端降级逻辑 + `.env.example` | 生产环境改密码并移除前端兜底 |
| 前端 `Auth.isAdmin()` 可伪造 | `wa_auth_v1` 在 localStorage | 纯静态模式下后台只是 UI 约束，不能存敏感数据 |
| JWT 默认弱密钥 | `server/index.js:46` | 必须设置长随机 `JWT_SECRET` |
| 密码 `sha256 + 固定盐` | `hashPass` | 生产建议 bcrypt/argon2 |
| mock 验证码回显 | 前后端一致设计 | 上线前切真实通道 |
| Token 写入 `data/submissions-config.json`（base64 仅编码，非加密） | 管理后台 GitHub Tab | **任何人可解码并获得仓库写权限**，强烈建议改为服务端代提交 |
| PAT 存于 localStorage | 云同步 / 同步配置 | 不勾选「记住令牌」，或改用短期令牌 |

> 纯静态部署下不存在真正的权限边界：所有“管理员”校验都在浏览器内。若需要真实权限，必须启用 Node 后端。

### 10.4 可维护性

- `app.js` 单文件 11,757 行，模块靠注释分隔，无模块系统。
- 视图与事件绑定混排，局部变量命名空间较拥挤。
- 大量内联样式（`style="…"`）与 `style.css` 并存。
- 缓存版本号手工维护，容易漏改。
- `data/manifest.js` 与 `data/merged.js` 需要保持分类一致，靠人工同步。

---

## 11. 附录

### A. 路由表

| Hash | 视图函数 | 权限 |
| --- | --- | --- |
| `#/` | `renderHome` | 登录（游客可） |
| `#/:catId` | `renderList` | 登录（游客可） |
| `#/entry/:cat/:id` | `renderEntry` | 登录（游客可） |
| `#/search?q=` | `renderSearch` | 登录 |
| `#/glossary` | `renderGlossary` | 登录 |
| `#/canon` | `renderCanon` | 登录 |
| `#/library` / `#/library/:id` | `renderLibrary` / `renderLibraryDoc` | 登录 |
| `#/health` | `renderHealth` | 登录 |
| `#/observe` | `renderObserve` | 登录 |
| `#/mindmap` | `renderMindMap` | 登录 |
| `#/submit` | `renderSubmit` | LV.2+ |
| `#/account` | `renderAccount` | 登录（非游客） |
| `#/user/:name` | `renderUserPage` | 登录 |
| `#/admin?tab=` | `renderAdmin` | `role=admin` |
| 其它 | `renderNotFound` | — |

### B. 事件总线事件

| 事件 | 触发方 | 典型监听用途 |
| --- | --- | --- |
| `favorites:changed` | `Favorites.toggle` / `CloudSync.apply` | 刷新收藏按钮与列表 |
| `markedread:changed` | `MarkedRead.toggle` | 刷新已读状态 |
| `ratings:changed` | `RATINGS.vote` | 刷新评分显示 |
| `comments:changed` | `Comments.*` / `CloudSync.apply` | 刷新批注区 |
| `logs:changed` | `AdminLogs.record` | 刷新日志 Tab |
| `theme:changed` | `Theme.set` | 同步主题按钮 |
| `cats:changed` | `LocalCats.*` | 重建导航与栏目标签 |
| `entries:changed` | `LocalEntries.*` | 刷新列表与统计 |
| `draft:saved` | `SubmitDraft.save` | 草稿保存提示 |
| `stats:refresh` | API 降级路径 | 刷新状态栏计数 |
| `data:changed` | 管理员操作 | 触发视图重绘 |
| `submissions:reviewed` | 审核操作 | 更新待审数量 |
| `sfx:changed` | `SFX` | 同步音效 UI |
| `bgm:changed` | `BGM` | 同步 BGM UI |
| `om:changed` | `OnlineMusic` | 同步在线音乐 UI |

### C. 全局符号索引（后端）

| 路由/中间件 | 行号 |
| --- | --- |
| `CATEGORY_FILES` / `CATEGORY_MAIN_FILE` | 52 / 61 |
| `ensureAdmin` | 98 |
| `persistAll` | 127 |
| `signToken` / `verifyToken` | 158 / 165 |
| `requireLogin` / `requireAdmin` | 171 / 179 |
| `/api/send-code` | 304 |
| `/api/register` | 368 |
| `/api/login` | 411 |
| `/api/me` | 455 |
| `/api/submit` | 472 |
| `/api/submit/upload-docx` | 519 |
| `/api/submit/upload-image` | 586 |
| `/api/account` | 601 |
| `/api/submissions` | 646 |
| `/api/admin/*` 审核与档案 | 675–827 |
| `/api/admin/users*` | 830–887 |
| `/data/merged.js` | 894 |
| 静态托管 / SPA 回退 | 933 / 940 |
| `app.listen` | 945 |

### D. 术语表

| 术语 | 含义 |
| --- | --- |
| 红月纪元（RM） | 新历；红月 0 年 = 公元 2312，`RM = CE - 2312` |
| 条目 / Entry | 一条档案记录 |
| 分类 / Category | `anomalies/organizations/deities/eras/timelines`，决定路由与数据键 |
| 覆盖层 / Override | `LocalEntries` 在原始数据上叠加的增删改，存 localStorage |
| 降级 / Fallback | 后端不可用时切换到 localStorage 实现 |
| 排版原件 / Dossier | 自包含 HTML，详情页 iframe 原样展示 |
| 正典层级 | 设定冲突时的优先级（0–6 级），见 `CANON_TIERS` |
| 可信度分级 | 年表证据等级 S/A/B/C/X，见 `ERA_TIERS` |

---

> **维护提示**：修改架构性内容（新增模块、新增 API、改变数据流）时，请同步更新本文对应章节与行号，并在页首递增文档版本。
