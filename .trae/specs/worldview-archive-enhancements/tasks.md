# 世界观察档案库增强 · 任务分解与实现计划

> 关联规格：`spec.md` · 仓库根：`d:\Desktop\Worldview_Archive`
> 代码约定：所有新增逻辑在 `app.js` IIFE 内部按 `// ============ XXX ============` 分区注释组织；
> 样式新增/修改统一写入 `style.css`，新 CSS 变量集中在 `:root` / `.theme-light` 声明块。

---

## 任务依赖总览

```
Phase 1（数据核心）独立可并行
  ├─ Task 1  审核数据同步
  ├─ Task 2  搜索增强
  └─ Task 3  数据导出备份

Phase 2（交互体验）
  ├─ Task 4  TOC 目录（依赖详情页，独立）
  ├─ Task 5  键盘快捷键（全局，独立）
  ├─ Task 6  主题切换（全局样式，需重跑全页面视觉评审）
  └─ Task 7  移动端适配（依赖 Task 6，两套主题都要在小屏验证）

Phase 3（视觉艺术，需生图）
  ├─ Task 8  默认占位图（生图 → 替换 SVG）
  ├─ Task 9  分类横幅 × 6（生图 → 挂路由）
  ├─ Task 10 favicon（生图/裁剪 → 写 link 标签）
  └─ Task 11 自定义 404（无需生图，纯 CSS + 文案）

Phase 4（用户功能，可并行）
  ├─ Task 12 收藏/书签
  ├─ Task 13 评论系统
  ├─ Task 14 阅读进度（详情页，与 Task 4 相邻代码区）
  ├─ Task 15 关联推荐（详情页底部）
  └─ Task 16 投稿草稿箱（投稿页，独立）

Phase 5（管理员后台）
  ├─ Task 17 批量审核增强（UI 已有，补逻辑；可与 Task 1 同步）
  ├─ Task 18 操作日志（写入钩子散落在各 API 回调 + 日志 Tab）
  └─ Task 19 仪表盘（后台首 Tab，新增页面 + 简易图表）
```

---

## Task 1：审核后数据同步链路修复

- **优先级**：high
- **对应 AC**：AC-R1
- **关联 FR**：FR-1
- **修改文件**：`app.js`（`API.adminReview` 降级分支成功回调、`drawSubsTab` 通过成功处理、`router` 计数刷新）

### 实现要点
1. 在 `API.adminReview` 降级分支 `status === 'approved'` 时，确认 `LocalEntries.add(cat, entry)` 之后已同步到 `DATA[cat]`（现有 `LocalEntries.add` 已同步内存，无需修改，但需增加事件派发）。
2. 新增轻量事件总线：`const Bus = { listeners:{}, on(e,fn){(Bus.listeners[e]=Bus.listeners[e]||[]).push(fn)}, emit(e,p){(Bus.listeners[e]||[]).forEach(f=>{try{f(p)}catch{}})} }`
3. 在审核通过成功处 `Bus.emit('data:changed')`；在 `LocalEntries.add/update/delete` 成功处也 `emit`。
4. `refreshIdentity()` 内或新增 `refreshStatsBadge()`：监听 `data:changed` 重新调用 `computeStats()` 更新顶部 `#stat-total` 文案。
5. `renderList()` 首次渲染不依赖缓存，本身直接读取 `getEntries()` → 已自然生效，但需在审核成功 Toast 中加「去 [分类名] 查看」快捷链接，用户点击立即 re-render 列表。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T1-R1 | rule | 模拟降级流程：以 admin/admin123 登录 → #/submit 提交一篇 anomalies 分类投稿 → 打开 #/admin 通过 → 跳转 #/anomalies → 新条目在列表中（无需手动 F5） | 操作步骤截图 + 条目卡片存在 |
| T1-R2 | rule | 审核通过前后，顶部「在档条目」数字 +1 | 前后数字值对比截图 |

### 完成证据
- 通过审核后不刷新页面访问分类页可见新条目
- 顶部计数实时更新

---

## Task 2：搜索增强（正文/标签/代号 + 高级筛选）

- **优先级**：high
- **对应 AC**：AC-R2
- **关联 FR**：FR-2
- **修改文件**：`app.js`（`renderSearch`、`renderList` 搜索区）、`style.css`（高级筛选折叠面板样式）

### 实现要点
1. **全局搜索命中范围**：`renderSearch` 中现有 `allEntries().filter` 已包含 `e.body`，无需扩展；但需增加片段高亮：
   - 对每条结果在正文中找第一个关键词下标 `idx`，截取 `Math.max(0,idx-40) ~ idx+80`，用 `<mark>` 替换关键词。
   - 新增 `function highlightKw(text, kw)` 工具函数（HTML 转义 → 关键词替换为 `<mark>`）。
2. **列表页高级筛选**：在 `renderList()` 工具栏 `.list-toolbar` 右侧加「筛选 ▾」按钮，点击展开折叠面板：
   - 分类 Chips（异常/组织/神祇/纪元/时间线，对应 catId 链接跳转，当前分类禁用态）
   - 危险等级 select（已有，合并到面板区）
   - 标签输入框（逗号分隔 → AND 匹配到 `tags:[]`）
   - 「重置」按钮清空所有筛选
3. 搜索结果匹配时，结果卡片展示摘要中高亮关键词（若摘要无命中则拼接正文片段高亮）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T2-R1 | rule | 搜索某档案正文中独有的生僻词 → 该档案出现在搜索结果 | 搜索词 + 结果卡片截图（含高亮片段） |
| T2-R2 | rule | anomalies 列表页打开筛选，选择等级=keter → 仅显示 keter 条目 | 筛选前后条目数对比截图 |
| T2-R3 | rule | 标签输入「异常,收容」→ 只显示同时含两个标签的档案 | 结果列表中任一条 tags 同时含两个词 |

### 完成证据
- 搜索命中正文 + 高亮显示
- 高级筛选面板可展开收起，筛选结果与条件一致

---

## Task 3：管理员数据导出/备份

- **优先级**：high
- **对应 AC**：AC-R3
- **关联 FR**：FR-3
- **修改文件**：`app.js`（`renderAdmin` 新增「数据」Tab 或在现有头部加导出按钮）、`index.html`（可选：下载用 `<a>` 无需改）

### 实现要点
1. 管理员后台新增第 5 个 Tab 顺序：`['dashboard', 'subs', 'entries', 'users', 'logs', 'data']`（Task 19 补 dashboard，本 Task 先加 data Tab 占位或复用 entries 顶部按钮区即可）。
2. `function exportBackupJSON()`：
   - 读取 `DATA`（含 LocalEntries 覆盖后）、`Auth.getUsers()`、`Submissions.get()`、`LocalEntries._load()`、`dismissed notices`、`favorites`、`comments`、`drafts`、`admin logs`
   - 封装为：`{ meta:{ exportedAt:Date.now(), version:'1.0', by: Auth.get().user }, categories: DATA.categories, classLegend: DATA.classLegend, DATA: { anomalies,organizations,deities,eras,timelines }, users, submissions, entriesOverrides, dismissedNotices, favorites, comments, drafts, adminLogs }`
   - `JSON.stringify(obj, null, 2)` → Blob → createObjectURL → 创建 `<a download>` 触发下载，文件名 `wa-backup-YYYYMMDD-HHMMSS.json`
3. （可选，需等 Q1 确认再做）`importBackupJSON(file)`：读取 JSON → 逐项 `localStorage.setItem` 覆盖 + 调用 `LocalEntries.applyOverrides()` + `router()` 重渲染 + 刷新计数。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T3-R1 | rule | 管理员后台点击「导出备份」→ 浏览器下载 .json 文件 → 文件 size > 2KB，JSON.parse 无异常 | 下载文件 + JSON 校验通过截图 |
| T3-R2 | rule | 导出文件中 `DATA.anomalies` 长度等于 `computeStats().counts.anomalies` | 两者数值相等 |
| T3-R3 | rule | 导出文件中 `meta.exportedAt` 在最近 1 分钟内，`meta.by === 'admin'` | 字段检查 |

### 完成证据
- 导出的 JSON 文件（路径与内容结构）
- 下载成功截图

---

## Task 4：详情页自动生成 TOC 目录 + 跳转

- **优先级**：high
- **对应 AC**：AC-R4
- **关联 FR**：FR-4
- **修改文件**：`app.js`（`renderEntry` 渲染完成后插入 TOC 逻辑）、`style.css`（TOC 侧边栏样式 + 高亮态 + 响应式折叠态）

### 实现要点
1. `renderEntry` 渲染完后，`detail-body` 节点内查询 `h1,h2,h3,h4`（注意部分标题已经是 h1 在 doc head 内，所以 `querySelectorAll('#detail-body h2, #detail-body h3, #detail-body h4')` 更合理）。
2. 为每个标题生成 id：`function slugify(s){return String(s).trim().toLowerCase().replace(/[\s]+/g,'-').replace(/[^\w\u4e00-\u9fa5-]/g,'')}`，若重复则 `-2`、`-3` 递增。
3. `id` 写入标题元素，锚点跳转可使用 URL hash（但为避免与 SPA 路由冲突，使用 `scrollIntoView({behavior:'smooth', block:'start'})`）。
4. TOC 容器插入到 `detail-card` 右侧（`float: right; width: 220px; position: sticky; top: 100px`），移动端（`<=768px`）改为 `details`/`summary` 折叠面板插入到文档顶部 reader bar 下方。
5. IntersectionObserver 监听各标题，滚动时给对应 TOC 项加 `.toc-active` 类（边框/文字变亮）。
6. TOC 项点击：阻止默认跳转 → 对应标题 `scrollIntoView`，同时 URL hash 可酌情更新（`history.replaceState(null, '', '#' + slug)`，避免触发 router 重渲染）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T4-R1 | rule | 打开含 ≥3 个 h2/h3 的详情页 → TOC 出现且条目数 = 标题数 | 标题数与 TOC 项数一致截图 |
| T4-R2 | rule | 点击 TOC 第 N 项 → 页面滚动到对应标题顶部，标题顶部出现在视口上 1/3 | 滚动后位置截图 |
| T4-R3 | rule | 滚动页面，当前标题对应的 TOC 项高亮 | 高亮项匹配可见标题 |
| T4-R4 | rubric | TOC 视觉与详情页机密文档风格一致性 (0-2) | ≥1：2=无缝融合；1=样式略突兀但可读；0=违和 | 视觉评审截图 |

### 完成证据
- 详情页 TOC 侧边栏 + 移动端折叠态截图
- 点击跳转 & 滚动高亮操作录屏或步骤说明

---

## Task 5：全局键盘快捷键

- **优先级**：medium
- **对应 AC**：AC-R5
- **关联 FR**：FR-5
- **修改文件**：`app.js`（顶部新增全局快捷键注册区，靠近 `initLazyLoad`/router 末尾）

### 实现要点
1. 新增 `function bindGlobalShortcuts()`，DOM 就绪时绑定一次（使用 `document.addEventListener('keydown', ...)`）。
2. 冲突规避：当 `document.activeElement` 为 `input, textarea, [contenteditable="true"], select` 时，只响应 `Esc`，其它快捷键忽略。
3. 快捷键映射：
   - `Esc`：按优先级从高到低依次尝试关闭
     1) 全屏投稿编辑器（editorWrap.fullscreen）
     2) 账号管理弹窗（`account-modal` display）
     3) 管理员编辑弹窗（`.admin-modal` 存在则 remove）
     4) 审核通知 Toast（若有显式层）
   - `/`：`e.preventDefault()` → `#global-search.focus()` → `select()` 选中全文字
   - `←` / `→`：当前路由是列表类路由（`renderList` 的分类页）时，解析 URL query `page`，构造上一页/下一页跳转
   - `Ctrl+S` (Cmd+S)：投稿页时阻止浏览器默认保存 → 触发草稿手动保存（Task 16 实现后对接）
   - `Ctrl+B`：详情页 + LV.2 已登录 → 切换收藏状态（Task 12 实现后对接，此处存 hook）
4. 为快捷键增加一个可选的 Help 浮层（按 `?` 键显示，Esc 关闭），非必须（若工作量允许加）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T5-R1 | rule | 在首页按 `/` → 光标跳到搜索框且文字全选 | 搜索框 focus + selection 截图 |
| T5-R2 | rule | 打开账号管理弹窗 → 按 Esc → 弹窗关闭 | 关闭前后对比 |
| T5-R3 | rule | 在 anomalies 列表第 2 页 → 按 ← → 翻页 → URL 改变 → 列表对应刷新 | 路由 hash 变化 |
| T5-R4 | rule | 光标在搜索输入框（非内容输入态）按 `/` 不触发（不应跳自身）或输入框内 `/` 被屏蔽（需验证前者） | 输入状态不触发快捷键 |

### 完成证据
- 5 组快捷键（Esc、/、←→、Ctrl+S、Ctrl+B）手动验证通过记录

---

## Task 6：暗黑/明亮主题切换

- **优先级**：medium
- **对应 AC**：AC-R6、AC-U2
- **关联 FR**：FR-6
- **修改文件**：`style.css`（新增 `.theme-light` 全部变量覆盖 + 组件规则）、`app.js`（顶部导航加切换按钮 + 初始化读取 localStorage）、`index.html`（可选：body 默认加 `class="theme-dark"`）

### 实现要点
1. CSS 变量集 `.theme-light`（档案室明亮风，米白背景 + 深灰文字 + 暖银边框）：
   - `--bg: #f5f2ec`、`--bg-2: #efece6`、`--bg-3: #e8e5df`、`--bg-4: #e2ded7`
   - `--text: #1a1a1a`、`--text-2: #4a4a4a`、`--text-3: #7a7a7a`、`--text-4: #b0b0b0`
   - `--silver: #5a5a5a`、`--silver-2: #2c2c2c`
   - `--border: #d9d4ca`、`--border-2: #c8c2b6`、`--border-gold: rgba(100,90,70,0.3)`
   - `--red: #8a2323` 保持
   - 背景噪点纹理（body::before）在明亮模式下调低透明度 0.3 → 或者 `mix-blend-mode: multiply` 重新调色
   - body::after 暗角 vignette 在明亮模式换成「顶部柔光 + 四角轻微阴影」
2. `#archive-header`、`.btn-primary`、`.entry-card`、`.list-header` 等关键组件在 `.theme-light` 下补覆盖规则。
3. 顶部导航 header-search 右侧加主题切换按钮：`<button id="theme-toggle" title="主题切换">☀️</button>`（暗黑模式显示太阳，明亮显示月亮）。
4. JS 初始化：
   ```
   const THEME_KEY = 'wa_theme_v1';
   function applyTheme(t) {
     document.body.classList.toggle('theme-light', t === 'light');
     document.body.classList.toggle('theme-dark',  t !== 'light');
     const btn = document.getElementById('theme-toggle');
     if (btn) btn.textContent = t === 'light' ? '🌙' : '☀️';
     localStorage.setItem(THEME_KEY, t);
   }
   // 初始化
   const savedTheme = localStorage.getItem(THEME_KEY);
   const sysLight = window.matchMedia('(prefers-color-scheme: light)').matches;
   applyTheme(savedTheme || (sysLight ? 'light' : 'dark'));
   ```
5. 绑定按钮点击 toggle。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T6-R1 | rule | 点击主题切换按钮，body class 在 theme-dark/theme-light 间切换，localStorage 同步更新 | DevTools Elements + Application 面板截图 |
| T6-R2 | rule | 明亮模式下刷新页面仍为明亮模式 | 刷新前后截图 |
| T6-R3 | rubric | 明亮主题视觉一致性 AC-U2 (0-2) | ≥1：逐页面截图评审 |
| T6-R4 | rule | 管理员后台、投稿编辑器、详情页在明亮模式下文字可读（对比度 ≥ 4.5:1） | 关键页面截图抽查 |

### 完成证据
- 暗黑 → 明亮切换的首页、列表、详情、投稿、后台 5 张对比截图
- localStorage 值更新成功

---

## Task 7：移动端适配优化

- **优先级**：medium
- **对应 AC**：AC-U1
- **关联 FR**：FR-7
- **修改文件**：`style.css`（新增 `@media (max-width: 768px)` 响应式块集中追加，零散断点合并）、`app.js`（TOC 移动端折叠态、详情字号默认值调整、Tab 横向滚动）

### 实现要点（断点 ≤768px）
1. **顶部导航**：
   - `.header-inner` `flex-direction: column` 或 `.header-nav` 改为横向滚动（`overflow-x: auto; white-space: nowrap`），`.header-search` `width: 100%`
   - `.logo-title` 字号缩小到 12px，logo-sub 可隐藏
2. **卡片**：
   - `.entry-grid` `grid-template-columns: 1fr`
   - `.anom-card` `grid-template-columns: 100px 1fr` 或 4:6 比例（左图右文保持）
   - `.anom-thumb` 保持方形，`aspect-ratio: 1/1`
3. **详情页**：
   - TOC 从右侧固定改为顶部折叠 `<details>`/`<summary>`
   - `.detail-meta` 表格改成单列流式
   - `.reader-bar` 按钮从 4 个缩到 3 个（移除 A++）
4. **投稿页**：
   - `.submit-grid` 单列（`.sb-field-docx`、`.sb-field-editor`、`.sb-preview` 各占整行）
   - `.sb-preview` 默认 `preview-hidden` 类自动添加（由 JS 初值决定）
   - 全屏按钮始终可见
5. **管理员后台**：
   - `.admin-table` 外层加 `overflow-x: auto`，保持表格列宽不压缩
   - `.atab`（管理员 Tab）横向滚动 + 缩小 padding
   - `.admin-sub-grid` 单列布局
6. **其他**：
   - `.hero-title` 字号从 58px → 36px，`.hero-inner` 单列
   - `.timeline-strip` `grid-template-columns: 1fr` 垂直时间线，横线改竖线

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T7-R1 | rubric | 移动端 AC-U1 可用性 (0-2) | ≥1：375×667 视口 5 个核心页面（首页、列表、详情、投稿、后台）截图各 1 张，人工评估 |
| T7-R2 | rule | 投稿编辑器在 375px 下工具栏按钮不溢出、全屏按钮可点击、正文输入区高度 ≥ 200px | 编辑器区域截图 + 触达区尺寸示意 |
| T7-R3 | rule | 管理员表格在 375px 下可横向滑动查看全部列，操作按钮不被截断 | 表格水平滚动演示 |

### 完成证据
- Chrome DevTools iPhone SE (375×667) 视口下：首页、异常列表、详情、投稿、管理员后台 5 张截图
- （可选）简短录屏验证投稿流程在手机端可走通

---

## Task 8：默认封面占位图（生图 + 替换 SVG）

- **优先级**：medium
- **对应 AC**：AC-R7、AC-U4
- **关联 FR**：FR-8
- **修改文件**：`data/default-cover.png`（新增，生图下载后放置）、`app.js`（`buildAnomThumbHtml` SVG 兜底改为 img + onerror fallback to 简化 SVG）

### 实现要点
1. **生图**：调用 text_to_image API
   - Prompt（中文，URL 编码）：`一张黑白机密档案风格的正方形封面占位图，中央印有大写 CLASSIFIED 字样，四周环绕条形码和印章边框，右下角有 VISUAL REDACTED 小字，带有斑驳的做旧纹理和冷冽银盐颗粒感，冷色调黑白灰三色风格，整体构图简洁适合作为档案卡片缩略图`
   - `image_size: square_hd`
2. 图片下载 → 保存为 `data/default-cover.png`（建议用浏览器 fetch 转 Blob 再下载，或直接 base64 写入本地）。
3. 修改 `buildAnomThumbHtml`：
   - 把现有 SVG 兜底的 `.anom-thumb-fb` 内部替换为 `<img class="default-cover-img" src="data/default-cover.png" onerror="this.style.display='none';this.nextSibling.style.display='grid'">` + 一个简化版纯文字 SVG（`<span>CLASSIFIED</span>`）作为二级兜底。
   - `.anom-thumb-fb` 默认 CSS `display: grid; place-items: center`，`.default-cover-img` `width:100%; height:100%; object-fit: cover; filter: grayscale(100%) contrast(1.05) brightness(0.95)`。
4. 神祇、时间线、纪元三类卡同样走此占位（它们当前也复用 `buildAnomThumbHtml` 或类似逻辑，一并统一）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T8-R1 | rule | `data/default-cover.png` 文件存在且 > 20KB | 文件属性截图 |
| T8-R2 | rule | 打开异常列表，无封面的卡片显示占位图（img）而非原 SVG 交叉线 | 卡片截图对比 |
| T8-R3 | rubric | 占位图设计感 AC-U4 (0-2) | ≥1：视觉评审 |

### 完成证据
- `data/default-cover.png` 存在
- 列表页无封面条目显示新占位图的截图

---

## Task 9：分类横幅图 × 6（生图 2 张新增 + 4 张可选替换/补强）

- **优先级**：medium
- **对应 AC**：AC-U3
- **关联 FR**：FR-9
- **修改文件**：`d:\Desktop\Worldview_Archive\` 根目录（现有 IMG-02 ~ IMG-05）+ 新增 `IMG-06 时间线页头图.png` + `IMG-07 管理中枢页头图.png`、`app.js`（`renderList` 中 HEADER_IMGS 字典加 timelines 和 admin，`renderAdmin` 加页头横幅块）

### 实现要点
1. **生图两张新增**（image_size: `landscape_16_9` 后再裁剪或直接要求横幅比例，优先 1920×400）：
   - 时间线页头：
     Prompt：`一张黑白冷冽纪实风格的横幅背景图，时间轴延伸向远方，历史碎片与档案文件拼贴散落，旧钟表齿轮与斑驳胶片颗粒交叠，宏大历史感，无文字，适合做网站页头背景`
   - 管理中枢页头：
     Prompt：`一张黑白冷冽纪实风格的服务器机房横幅背景图，监控屏幕矩阵闪烁，数据流与代码瀑布，蓝灰冷色调，画面中央有微妙的中央控制室氛围，无文字，适合做管理后台页头横幅`
2. 保存为 `IMG-06 时间线页头图.png` 与 `IMG-07 管理中枢页头图.png`（存于项目根目录，与现有 IMG-02~05 同级）。
3. （可选）若现有 4 张横幅风格不统一，可一次性重新生成 4 张保持整套风格；此步由用户评审 Q3 后决定（规格列为建议非必须）。
4. `renderAdmin` 顶部 `admin-head` 上方插入横幅 `<div class="list-header" data-header-img="IMG-07 管理中枢页头图.png" style="margin-bottom:24px">` 内部放管理中枢标题 + 简短描述，沿用 `list-header` CSS 类（复用 `--lh-img` 背景机制）。
5. `renderList` 中 HEADER_IMGS 字典补 timelines → `IMG-06 时间线页头图.png`。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T9-R1 | rule | `IMG-06`、`IMG-07` 文件存在且非空 | 文件列表截图 |
| T9-R2 | rule | 打开 #/timelines 顶部横幅显示 IMG-06 图 | 顶部横幅截图 |
| T9-R3 | rule | 管理员后台顶部横幅显示 IMG-07 图 | 后台首页横幅截图 |
| T9-R4 | rubric | 6 张横幅氛围匹配度 AC-U3 (0-2) | ≥1：6 张横幅人工评审 |

### 完成证据
- 6 张横幅文件存在
- 6 个分类+后台页头横幅截图各 1 张

---

## Task 10：网站 favicon

- **优先级**：low
- **对应 AC**：AC-R8
- **关联 FR**：FR-10
- **修改文件**：`data/favicon.png`（新建）、`index.html` `<head>` 插入 `<link rel="icon">`

### 实现要点
1. 优先复用 `data/logo-mark.png`，使用 Canvas 客户端端裁剪为 32×32（或用生图 API 重新生成 32×32 版本）。
   - 最简单方案：写一段临时 JS 在浏览器加载 `data/logo-mark.png` 后，绘制到 32×32 canvas → 导出 PNG → 手动保存为 `data/favicon.png`。
   - 或调用 text_to_image 生成 32×32 正方形 logo 简化版（image_size 可选最小 square 即可）。
2. 在 `index.html` `<head>` 第 7 行前后（style.css 下方）插入：
   ```html
   <link rel="icon" type="image/png" sizes="32x32" href="data/favicon.png">
   <link rel="apple-touch-icon" href="data/logo-mark.png">
   ```
3. 验证：`favicon.png` 非空 + 浏览器标签页显示，刷新不 404。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T10-R1 | rule | `data/favicon.png` 文件存在且 1KB~20KB | 文件属性截图 |
| T10-R2 | rule | 浏览器标签页可见 logo 小图标，地址栏无 404 报错 | 标签页截图 + DevTools Network 200 |

### 完成证据
- favicon 文件存在
- 浏览器标签页显示截图

---

## Task 11：自定义 404 页面

- **优先级**：low
- **对应 AC**：AC-R16
- **关联 FR**：FR-11
- **修改文件**：`app.js`（重写 `renderNotFound()`）、`style.css`（404 专用样式类 `.nf-wrap` / `.nf-stamp` / `.nf-actions`）

### 实现要点
1. `renderNotFound()` 现有可能是空白，重写为：
   ```
   <div class="nf-wrap">
     <div class="nf-stamp">404 · FILE DESTROYED</div>
     <h2 class="nf-title">档案编号 404 · 该记录已被销毁</h2>
     <p class="nf-sub">您请求的档案不存在、已被红acted，或从未被世界观察档案库正式收录。</p>
     <div class="nf-barcode">████ ████ ██ ████████ ██████ ██████ ████████ · 404 · NFA · ARCHIVE MISSING</div>
     <div class="nf-actions">
       <a class="btn btn-primary" href="#/">◈ 返回首页档案库</a>
       <a class="btn btn-ghost" href="javascript:history.back()">← 返回上一页</a>
     </div>
     <div class="nf-foot">WORLDVIEW ARCHIVE · FILE NOT FOUND · PROTOCOL-404</div>
   </div>
   ```
2. CSS 装饰：
   - `.nf-wrap` 居中 640px，padding 80px 24px，机密印章水印（45 度旋转重复）
   - `.nf-stamp` 旋转 -6 度，红色边框，大字号 56px serif，虚线 redacted 装饰
   - `.nf-barcode` 等宽字体条形样式（CSS 渐变模拟或纯文字）
   - `.nf-actions` flex gap 12px 居中

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T11-R1 | rule | 访问 `#/non-existent-1234567` → 渲染上述 404 页面 | 页面截图 |
| T11-R2 | rule | 「返回首页」按钮 → 跳转 #/；「返回上一页」按钮 → history.back() | 两个按钮跳转正确 |

### 完成证据
- 404 页面截图
- 两个按钮功能验证

---

## Task 12：档案收藏/书签系统

- **优先级**：medium
- **对应 AC**：AC-R9
- **关联 FR**：FR-12
- **修改文件**：`app.js`（新增 Favorites 模块 + 详情页按钮 + 账号管理面板新增收藏 Tab/Section）、`style.css`（♡ 按钮样式 + 收藏列表卡片样式，复用 entry-card 简化）

### 实现要点
1. Favorites 模块：
   ```
   const FAV_KEY = 'wa_favorites_v1';
   const Favorites = {
     _key(user) { return FAV_KEY + ':' + (user?.user || 'guest'); }, // 按 Auth.get().user 隔离
     all(user) { try { return JSON.parse(localStorage.getItem(this._key(user)) || '[]'); } catch { return []; } },
     has(user, cat, id) { return this.all(user).some(f => f.cat === cat && f.id === id); },
     add(user, cat, id) {
       const list = this.all(user);
       if (!this.has(user, cat, id)) list.unshift({ cat, id, addedAt: Date.now() });
       localStorage.setItem(this._key(user), JSON.stringify(list));
       Bus.emit('favorites:changed');
     },
     remove(user, cat, id) {
       const list = this.all(user).filter(f => !(f.cat === cat && f.id === id));
       localStorage.setItem(this._key(user), JSON.stringify(list));
       Bus.emit('favorites:changed');
     },
     toggle(user, cat, id) { this.has(user, cat, id) ? this.remove(user, cat, id) : this.add(user, cat, id); }
   };
   ```
2. 详情页头部机密印章下方或返回链接右侧加收藏按钮：
   `<button class="fav-btn" data-fav="${Favorites.has(Auth.get(), catId, id) ? '1' : '0'}">${Favorites.has(...) ? '❤ 已收藏' : '♡ 收藏'}</button>`
   点击时：LV.2 以下 → 提示「请登录 LV.2 以上使用收藏功能」；否则 Toggle 并更新按钮文字/样式。
3. 账号管理面板（`.account-modal .am-body`）现有信息下方新增分隔块：
   ```
   <div class="am-favorites">
     <h4>我的收藏 · FAVORITES (${count})</h4>
     <div class="am-fav-list">
       每条：<a href="#/entry/{cat}/{id}">编号 · 标题</a> 分类徽章 + 收藏时间 + [移除] 按钮
     </div>
   </div>
   ```
   空状态：「暂无收藏，浏览档案时点击 ♡ 加入收藏」。
4. Task 5 快捷键 Ctrl+B 调用收藏 toggle（详情页 + LV.2 条件）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T12-R1 | rule | LV.2 用户在详情页点击「♡ 收藏」→ 变「❤ 已收藏」→ localStorage 新增记录 → 刷新页面仍是 ❤ | 三种状态验证截图 |
| T12-R2 | rule | 账号管理面板「我的收藏」列表显示刚收藏的条目 | 列表含对应条目截图 |
| T12-R3 | rule | 账号管理面板中取消收藏 → 列表移除 + 详情页同步变回 ♡ | 双向联动验证 |
| T12-R4 | rule | 游客（LV.1）点击收藏按钮，弹出请登录提示（不写入） | 游客态点击 Toast 提示截图 |

### 完成证据
- 详情页收藏按钮（未收藏/已收藏两态）截图
- 账号管理收藏列表截图（含跳转 + 取消收藏操作记录）

---

## Task 13：评论/批注系统

- **优先级**：medium
- **对应 AC**：AC-R10
- **关联 FR**：FR-13
- **修改文件**：`app.js`（新增 Comments 模块 + `renderEntry` 详情页底部插入评论区）、`style.css`（评论列表样式 `.cm-list` / `.cm-item` / `.cm-form`）

### 实现要点
1. Comments 模块：
   ```
   const CM_KEY = 'wa_comments_v1';
   const Comments = {
     _k(cat, id) { return cat + ':' + id; },
     all() { try { return JSON.parse(localStorage.getItem(CM_KEY) || '{}'); } catch { return {}; } },
     list(cat, id) { return (Comments.all()[Comments._k(cat, id)] || []).filter(c => !c.deleted); },
     add(cat, id, content) {
       const u = Auth.get();
       const all = Comments.all();
       const key = Comments._k(cat, id);
       all[key] = all[key] || [];
       all[key].push({
         id: 'CM-' + Date.now().toString(36) + Math.random().toString(36).slice(2,5),
         userId: u?.user || 'unknown',
         userContact: u?.user || '匿名',
         level: u?.lvl || 'LV.1',
         content: String(content).slice(0, 1000),
         at: Date.now(),
         deleted: false,
         deletedBy: null
       });
       localStorage.setItem(CM_KEY, JSON.stringify(all));
     },
     remove(cat, id, commentId) {
       const u = Auth.get();
       const all = Comments.all();
       const key = Comments._k(cat, id);
       const arr = all[key] || [];
       const cm = arr.find(x => x.id === commentId);
       if (!cm) return { ok: false, msg: '评论不存在' };
       const isAdmin = Auth.isAdmin();
       const isOwner = cm.userContact === (u?.user || '');
       if (!isAdmin && !isOwner) return { ok: false, msg: '无权限' };
       cm.deleted = true;
       cm.deletedBy = isAdmin ? 'admin' : 'self';
       cm.deletedAt = Date.now();
       localStorage.setItem(CM_KEY, JSON.stringify(all));
       return { ok: true };
     }
   };
   ```
2. `renderEntry` 中 `detail-source` 之前插入评论区：
   - 标题栏「📝 档案批注 · COMMENTS (N)」
   - LV.2 以上显示评论表单（textarea ≥3 行 + 提交按钮，文字长度限制 1000，提交后转义显示）
   - 评论列表：头像占位（首字母方块） + 用户名·等级 + 时间 + 内容，内容使用 `escapeHtml` 渲染，换行转 `<br>`
   - 每条评论右侧：管理员看到「删除」按钮；作者自己也看到删除按钮（软删后内容显示为灰色 `[已删除]` 小字）
3. 评论数量 badge 同时展示在详情页 meta 下方或标题下（可选）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T13-R1 | rule | LV.2 用户发布评论 → 列表立即出现 → 刷新仍在 | 发布前/后截图 |
| T13-R2 | rule | 管理员账号进入同一详情页 → 每条评论旁有「删除」按钮 → 点击删除后评论变 [已删除] | 删除前后对比 |
| T13-R3 | rule | 作者自己可以删除自己的评论 | 删除操作演示 |
| T13-R4 | rule | 游客提交评论的输入框不显示（或显示被禁用 + 提示登录） | 游客态截图 |

### 完成证据
- 评论表单 + 列表截图（含正常评论、[已删除]评论两态）
- 管理员删除评论操作演示记录

---

## Task 14：阅读进度记忆

- **优先级**：medium
- **对应 AC**：AC-R11
- **关联 FR**：FR-14
- **修改文件**：`app.js`（`renderEntry` 滚动保存 + 进入恢复提示）

### 实现要点
1. localStorage key：`wa_read_progress_v1`，结构 `{ [cat+':'+id]: { scrollY, at, fontSize } }`
2. 保存：
   - `renderEntry` 末尾给 `window` 绑定 scroll（debounce 300ms）：
     ```
     const key = catId + ':' + id;
     const save = () => {
       const all = JSON.parse(localStorage.getItem('wa_read_progress_v1') || '{}');
       all[key] = { scrollY: window.scrollY, at: Date.now(), fontSize: localStorage.getItem('detail-font-size') || '15' };
       localStorage.setItem('wa_read_progress_v1', JSON.stringify(all));
     };
     const debounced = debounce(save, 300);
     window.addEventListener('scroll', debounced, { passive: true });
     view._progressCleanup = () => window.removeEventListener('scroll', debounced);
     ```
   - 字号调整（drb-btn 点击时）同样存入对应 key 的 fontSize。
3. 恢复：
   - 进入 `renderEntry` 时，读取该 key 记录；若存在且 `Date.now() - record.at < 30*86400*1000` 且 `record.scrollY > 300`：
     - 显示浮动 Toast：「检测到上次阅读到第 XXX 字/第 XXX px，是否恢复位置？ [恢复] [忽略]」
     - 用户点「恢复」→ `window.scrollTo({ top: record.scrollY, behavior: 'smooth' })` 且字号应用 `record.fontSize`
     - 点「忽略」→ 仅删除此条记录（避免继续提示）
     - Toast 30s 无操作自动消失并保留记录（下次仍提示）
4. 路由切换时（`router()` 开头）调用 `view._progressCleanup && view._progressCleanup()` 清理 scroll 监听。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T14-R1 | rule | 打开长文档 → 滚动到中部（> 1000px）→ 等待 1 秒保存 → 关闭标签页重开 → 打开同一档案 → 出现恢复提示 → 点恢复 → 滚动位置误差 < 100px | 操作流程截图 + 位置前后数值 |
| T14-R2 | rule | 字号调为 A+ (17px) → 下次恢复时字号也是 17px | 字号值截图 |
| T14-R3 | rule | 点击「忽略」→ 下次进入不再提示 | 忽略后重开页面无提示 |

### 完成证据
- 恢复 Toast 截图
- 滚动前后 Y 值记录（DevTools console 输出 `scrollY` 数值对比）

---

## Task 15：档案关联推荐

- **优先级**：low
- **对应 AC**：AC-R12
- **关联 FR**：FR-15
- **修改文件**：`app.js`（`renderEntry` 详情页底部新增推荐区）、`style.css`（推荐区域标题 + 推荐卡片复用首页 doc-card 或 简化 anom-card）

### 实现要点
1. 算法（打分）：
   ```
   function findRelated(catId, id, limit = 6) {
     const cur = findEntry(catId, id);
     if (!cur) return [];
     const curTags = new Set(cur.tags || []);
     const scored = [];
     for (const e of allEntries()) {
       if (e._cat === catId && String(e.id) === String(id)) continue; // 排除自身
       let s = 0;
       // 1) 同分类 + 同标签 ≥1 高权重
       const eTags = new Set(e.tags || []);
       let tagIntersect = 0;
       for (const t of curTags) if (eTags.has(t)) tagIntersect++;
       if (e._cat === catId && tagIntersect > 0) s += 20 + tagIntersect * 5;
       // 2) 同分类中权重
       else if (e._cat === catId) s += 8;
       // 3) 仅标签交集
       if (tagIntersect > 0) s += tagIntersect * 3;
       // bonus: era/org 字段相同 +3
       if (cur.era && e.era === cur.era) s += 3;
       if (cur.org && e.org === cur.org) s += 3;
       if (s > 0) scored.push({ e, s });
     }
     scored.sort((a,b) => b.s - a.s);
     return scored.slice(0, limit).map(x => x.e);
   }
   ```
2. 推荐区位置：评论区上方（若 Task 13 未完成则在 detail-footer 上方），与详情头部分隔一条机密纹分割线，标题「🔗 相关档案 · RELATED DOCUMENTS」。
3. 卡片：复用 `htmlEntryGrid` / `buildAnomThumbHtml` 的简化版，一行 3 列（移动端 1 列），每张带缩略图、编号、标题、分类徽章。
4. 若结果不足 3 条，可显示「相关档案不足，推荐浏览同类其他档案 → [同分类链接]」。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T15-R1 | rule | 打开一篇 tags ≥ 2 的档案 → 相关档案区域至少 1 条推荐 | 推荐卡片数量 ≥ 1 截图 |
| T15-R2 | rule | 推荐列表不含当前档案自身 | 检查列表 id |
| T15-R3 | rule | 推荐卡片点击跳转到对应详情页 | 跳转链接正确 |

### 完成证据
- 详情页底部相关档案区截图（至少 3 条）
- 推荐算法打分示例（console 输出 3 条 scored 分数与标签交集对应一致）

---

## Task 16：投稿草稿箱自动保存

- **优先级**：medium
- **对应 AC**：AC-R13
- **关联 FR**：FR-16
- **修改文件**：`app.js`（`renderSubmit` 内新增草稿自动保存 + 恢复提示 + 手动保存按钮）

### 实现要点
1. localStorage key：`wa_drafts_v1`，结构 `{ [userContact]: { ...payload, savedAt } }`
2. `renderSubmit()` 渲染完成后：
   - 检查草稿是否存在（当前用户下，`savedAt` 在 30 天内且 `title/body` 非空）
   - 若存在 → 顶部浮动 Toast：「检测到 XX 天前未提交的草稿（XX 字），是否恢复？ [恢复] [丢弃]」
   - 用户点「恢复」→ 把草稿内容填到表单各字段 + 封面预览 + 编辑器 innerHTML
   - 用户点「丢弃」→ 立即 `delete drafts[user]` save
3. 自动保存：
   - 监听表单关键字段 `input` 事件（title、summary、tags、source、body editor、category select、class select），debounce 5 秒自动写入草稿
   - Ctrl+S 快捷键（Task 5）立即触发保存，并在投稿页显示「✓ 草稿已保存于 HH:MM:SS」的短暂 Toast
4. 顶部显示草稿状态条：`📝 草稿箱状态：上次保存 HH:MM:SS | [手动保存] | [丢弃草稿]`
5. 投稿提交成功后（submit API 成功回调）：`delete drafts[user]` 清除草稿，并提示「已提交，草稿已清除」。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T16-R1 | rule | 填写标题、正文 → 等 5 秒或 Ctrl+S → 关闭页面重开 → 弹恢复提示 → 恢复后正文内容一致（字符数 ±10） | 恢复前后字符数对比 |
| T16-R2 | rule | 手动点「丢弃草稿」→ 再刷新页面不再弹恢复提示 | 丢弃后无提示 |
| T16-R3 | rule | 成功提交投稿 → 草稿自动被清除（下一次进入不提示恢复） | 提交后无草稿 |
| T16-R4 | rule | 封面上传后恢复草稿时，封面预览图也恢复显示 | 封面恢复截图 |

### 完成证据
- 恢复提示 Toast 截图
- 手动保存/草稿状态条截图
- 提交后草稿清除确认步骤

---

## Task 17：批量审核增强（二次确认 + 汇总 Toast）

- **优先级**：low（UI 已有，逻辑补强）
- **对应 AC**：AC-R1（批量通过部分）
- **关联 FR**：FR-17
- **修改文件**：`app.js`（`drawSubsTab` 中 `#admin-subs-batch-approve` / `#admin-subs-batch-reject` 事件）

### 实现要点
1. 批量通过 `ids.length > 5` 时，`confirm` 文本更强调：`您选择了 ${ids.length} 条投稿批量通过！\n系统将为每条生成档案条目并写入分类库。\n此操作不可逆，确认继续？`
2. 失败 ID 收集：循环结束后把失败 ID 拼接进 banner：`批量通过完成 · 成功 ${ok} 条 · 失败 ${fail} 条${failIds.length ? '（失败：' + failIds.join('、') + '）' : ''}`
3. 批量退回时的统一备注如果输入了 `note`，每条都写入 `reviewNote`，日志记录（Task 18）中单独 action=`bulk-reject`。
4. 批量通过后额外触发 `Bus.emit('data:changed')`，确保计数刷新（与 Task 1 对接）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T17-R1 | rule | 勾选 >5 条 → 批量通过 → confirm 提示更强调 | 弹窗文字截图 |
| T17-R2 | rule | 批量通过 3 条 → 3 条对应分类条目增加（数量 +3） | 分类页计数前后对比 |
| T17-R3 | rule | 故意构造 1 条异常（如空 title）→ 批量通过 → Toast 显示失败列表和总数 | Toast 截图含失败详情 |

### 完成证据
- 批量通过二次确认弹窗截图
- 批量通过成功 + 失败汇总 Toast 截图
- 对应分类页 3 条新条目出现截图

---

## Task 18：管理员操作日志

- **优先级**：medium
- **对应 AC**：AC-R15
- **关联 FR**：FR-18
- **修改文件**：`app.js`（新增 AdminLogs 模块 + 各 admin API 成功回调写入钩子 + `renderAdmin` 新增「📋 操作日志」Tab）

### 实现要点
1. 模块：
   ```
   const LOG_KEY = 'wa_admin_logs_v1';
   const AdminLogs = {
     all() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } },
     push({ action, targetType, targetId, detail }) {
       const u = Auth.get();
       if (!u || !Auth.isAdmin()) return; // 只记录管理员
       const all = AdminLogs.all();
       all.unshift({
         id: 'LOG-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6),
         admin: u.user,
         action, targetType, targetId,
         detail: detail || {},
         at: Date.now()
       });
       // 截断：超过 500 条时丢弃最旧的
       if (all.length > 500) all.length = 500;
       localStorage.setItem(LOG_KEY, JSON.stringify(all));
     }
   };
   ```
2. 在现有各管理员 API 成功回调处插入（成功分支内）：
   - `API.adminReview` 单个通过 → `AdminLogs.push({action:'approve-submission', targetType:'submission', targetId: subId, detail:{status, note, toCategory: patch?.category}})`
   - `API.adminReview` 单个退回 → `action:'reject-submission'`
   - 批量通过（循环外汇总）→ `AdminLogs.push({action:'bulk-approve', targetType:'submission', targetId:'batch', detail:{count:ids.length, ok, fail, failIds}})`
   - 批量退回 → `action:'bulk-reject'`
   - `API.adminAddEntry` → `action:'create-entry'`
   - `API.adminUpdateEntry` → `action:'update-entry'`
   - `API.adminDeleteEntry` → `action:'delete-entry'`
   - 批量删除档案 → `action:'bulk-delete-entries'`
   - `API.adminUpdateUser` → `action:'update-user'`
   - `API.adminDeleteUser` → `action:'delete-user'`
   - 导出备份 → `action:'export-data'`
3. `renderAdmin` Tab 新增「📋 操作日志」：
   - 顶部筛选：action select（全部/approve/reject/增删改/导出）、admin select（全部/admin/具体）、时间范围（今天/本周/本月/全部）
   - 列表表格：时间、管理员、操作类型（徽章颜色）、目标类型、目标 ID、详情摘要（JSON 取关键字段显示 1-2 行）
   - 分页 20/页
   - 右上角按钮：导出 CSV（逗号分隔 + UTF-8 BOM，Excel 可打开）

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T18-R1 | rule | 审核通过 1 条投稿 + 删除 1 条档案 → 操作日志列表新增 2 条记录，内容匹配 | 两条日志截图（action/targetId/detail） |
| T18-R2 | rule | 按操作类型筛选「通过投稿」→ 只显示对应日志 | 筛选结果截图 |
| T18-R3 | rule | 导出 CSV → Excel 或记事本打开列对齐无乱码 | CSV 文件打开截图 |
| T18-R4 | rule | 非管理员不写日志（尝试 user 写无效） | user 操作后日志条数不增 |

### 完成证据
- 日志 Tab 列表截图（含 5+ 条各种类型日志）
- 筛选功能演示截图
- CSV 导出文件内容片段

---

## Task 19：数据统计仪表盘（管理员首 Tab）

- **优先级**：high
- **对应 AC**：AC-R14、AC-U5
- **关联 FR**：FR-19
- **修改文件**：`app.js`（`renderAdmin` 重写 Tab 顺序，新增 `drawDashboardTab()`）、`style.css`（`.adm-card` / `.adm-chart` / `.adm-cols` 仪表盘网格与卡片样式）

### 实现要点
1. Tab 顺序调整为：📊 仪表盘（`dashboard`，默认）→ 📥 投稿审核（`subs`）→ 📚 档案管理（`entries`）→ 👤 用户管理（`users`）→ 📋 操作日志（`logs`）→ 💾 数据（`data`，含导出按钮，Task 3 对接）。
2. 仪表盘网格（2×2 大卡 + 1 行操作卡）：
   - **4 个数字卡片**（2×2 grid）：
     - 总档案数：`statsTotal()` + 5 分类 breakdown 小字
     - 待审核投稿：`Submissions.get().filter(s=>s.status==='pending').length` + 「去审核」按钮
     - 本月新增档案：统计 `DATA[*]` 中 `LocalEntries.add` 追加的条目（`entriesOverrides.*.added`）按 `at/addedAt` 字段过滤，或者 fallback 统计最近 30 天管理员新增的（LocalEntries 的 added 内若没 at 字段则估算为 0，或在 `LocalEntries.add` 中给每条补 `_addedAt: Date.now()` 字段——本 Task 需同步给 LocalEntries 补）
     - 总用户数：`Auth.getUsers().length`
   - **本月新增柱状图**（简易 Canvas 柱状：X 近 30 天，Y 每天新增档案数；无数据也显示空 x 轴）。数据源：从 `LocalEntries.added[]._addedAt`（本 Task 补充）聚合。若无数据，则显示「暂无近 30 天新增数据」占位 + 提示投稿审核通过会记录日期。
   - **用户增长折线**（简易 Canvas：X 近 30 天，Y 累计用户；用户 `at: Date.now()` 字段已有）。
   - **分类占比环形图**（可选：简单 Canvas 环形图，5 分类数量按比例切分，图例在下方）。
   - **快捷操作区**：一行 3 按钮：「一键导出备份」「去审核投稿」「新增档案」。
3. 数字滚动动效复用首页 Hero `stat-value` `data-count` 逻辑（抽出 `animateCount(el, target)` 工具函数）。

### 测试要求（TR）

| TR ID | 类型 | 内容 | 证据 |
|---|---|---|---|
| T19-R1 | rule | admin 登录后台 → 默认进入仪表盘 Tab → 4 张数字卡片显示实际值（与其他入口核对一致） | 仪表盘截图 + 各数值手动核对 |
| T19-R2 | rule | 「待审核投稿」数字 = Submissions pending 实际数量 | 与投稿审核 Tab 数量对比 |
| T19-R3 | rule | 点击「去审核投稿」按钮切到投稿审核 Tab；「新增档案」弹出编辑器 | 跳转/弹层正确 |
| T19-R4 | rubric | 仪表盘可读性 AC-U5 (0-2) | ≥1：截图评审 |
| T19-R5 | rule | 柱状图无数据时显示占位不报错 | 无数据占位显示截图 |

### 完成证据
- 仪表盘全屏截图（含 4 张数字卡 + 柱状图 + 折线图 + 快捷操作）
- 4 项数值手工核对步骤与对应来源记录
- 图表 Canvas 元素正常显示无白屏

---

## 数据导出 / 收藏 / 评论 / 草稿 / 日志 localStorage Key 汇总（防冲突）

| Key | 结构 | 写入模块 |
|---|---|---|
| `wa_theme_v1` | `'dark' \| 'light'` | Task 6 applyTheme |
| `wa_read_progress_v1` | `{ [cat:id]: { scrollY, at, fontSize } }` | Task 14 |
| `wa_favorites_v1:{user}` | `Array<{cat,id,addedAt}>` | Task 12 Favorites |
| `wa_comments_v1` | `{ [cat:id]: Array<Comment> }` | Task 13 Comments |
| `wa_drafts_v1` | `{ [userContact]: Draft }` | Task 16 |
| `wa_admin_logs_v1` | `Array<Log>`（最多 500 条，截断） | Task 18 AdminLogs |
| （已有）`wa_auth_v1` | `Auth.session` | - |
| （已有）`wa_users_v1` | `Array<User>` | - |
| （已有）`wa_codes_v1` | `{ contact:{code,exp} }` | - |
| （已有）`wa_submissions_v1` | `Array<Submission>` | - |
| （已有）`wa_jwt_v1` | `string` | - |
| （已有）`wa_entries_overrides_v1` | `{ [cat]:{added,updated,deleted} }` | LocalEntries |
| （已有）`wa_dismissed_notices_v1` | `Array<id>` | - |
| （已有）`detail-font-size` | `string` px 值 | - |
| （已有）`sb-preview-font-size` | `string` px 值 | - |

---

## 任务总览表（按优先级执行）

| 阶段 | 任务 | 优先级 | 预估工作量 | 前置依赖 |
|---|---|---|---|---|
| P1 | Task 1 审核数据同步 | HIGH | 中 | 无 |
| P1 | Task 2 搜索增强 | HIGH | 中 | 无 |
| P1 | Task 3 数据导出备份 | HIGH | 小 | 无 |
| P1 | Task 19 数据统计仪表盘 | HIGH | 大 | 无（可与 P1 其他并行） |
| P2 | Task 4 TOC 目录 | HIGH | 中 | 无 |
| P2 | Task 12 收藏系统 | MEDIUM | 中 | 无 |
| P2 | Task 16 投稿草稿箱 | MEDIUM | 中 | 无 |
| P2 | Task 5 键盘快捷键 | MEDIUM | 小 | Task 12, 16 可合并 Ctrl+B, Ctrl+S hook |
| P2 | Task 14 阅读进度 | MEDIUM | 中 | Task 4 完成后同区域 |
| P2 | Task 18 管理员操作日志 | MEDIUM | 大 | 无 |
| P2 | Task 6 主题切换 | MEDIUM | 中 | 无 |
| P3 | Task 8 默认占位图 | MEDIUM | 中 | 生图 API 可用 |
| P3 | Task 9 分类横幅 × 6 | MEDIUM | 中 | 生图 API 可用 |
| P3 | Task 11 自定义 404 | LOW | 小 | 无 |
| P3 | Task 10 favicon | LOW | 小 | 无 |
| P3 | Task 13 评论系统 | MEDIUM | 中 | 无 |
| P3 | Task 15 关联推荐 | LOW | 小 | Task 13 或独立 |
| P3 | Task 7 移动端适配 | MEDIUM | 大 | Task 6（双主题均在小屏验证） |
| P3 | Task 17 批量审核增强 | LOW | 小 | Task 1, Task 18（写日志 hook 位置共用） |
