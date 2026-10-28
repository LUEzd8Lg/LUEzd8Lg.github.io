# P2 方案 · 评论 / 评分 / 收藏的全站共享（静态站也要共享）

> 状态：**仅方案，未动代码** · 2026-10-24
> 决策输入：用户明确要求「纯静态 GitHub Pages 部署下也要全站可见」。

---

## 1. 现状（已核实）

| 模块 | 位置 | 存储 | 共享性 |
| --- | --- | --- | --- |
| `Comments` | app.js:546 | `localStorage wa_comments_v1` | 仅本机 |
| `RATINGS` | app.js:498 | `localStorage wa_ratings_v1`（+1/-1，按用户去重） | 仅本机 |
| `Favorites` | app.js:418 | `localStorage wa_favorites_v1` | 仅本机 |
| `CloudSync` | app.js:714 | 用户**自己的** GitHub 仓库（PAT） | 跨设备但非全站 |

Node 后端存在但不是常驻公共服务——GitHub Pages 上没有 `/api/*`。

## 2. 方案对比

| 方案 | 评论 | 评分 | 收藏数 | 账号门槛 | 维护成本 | 风险 |
| --- | --- | --- | --- | --- | --- | --- |
| A. Giscus（GitHub Discussions） | ✅ 成熟 | ❌ 不支持 | ❌ | 读者需 GitHub 账号 | 零 | 依赖 GitHub；中文读者无 GitHub 账号 |
| B. Cloudflare Workers + D1 自建公共 API | ✅ | ✅ | ✅ | 可无账号 | 低（免费额度内） | 公开写接口需防滥用 |
| C. Supabase / Firebase | ✅ | ✅ | ✅ | 可无账号 | 中 | 引入 SDK、厂商绑定 |
| D. 常驻 Node 后端 | ✅ | ✅ | ✅ | 站内账号 | 高（要服务器） | 与纯静态部署策略冲突 |

**推荐组合：评论用 Giscus（A），评分/收藏聚合用 Workers + D1（B 的裁剪版）。**

理由：
- 评论需要**内容审核、回复嵌套、通知**，自建成本高，Giscus 全部免费解决，且主题可定制成站点黑白档案风；评论区挂在详情页底部，替换现有本地评论区。
- 评分/收藏只是**计数聚合**（+1/-1、总数），无内容审核负担，一个不到 100 行的 Worker 就够，读者无需任何账号。
- 若你连 Giscus 的 GitHub 账号门槛都不想留：全部走方案 B，评论也自建（代价是要自己做审核界面 + 垃圾评论防护）。

## 3. 推荐架构（A 评论 + B 计数）

```
浏览器（纯静态）
 ├── 评论区：Giscus iframe ──► GitHub Discussions（仓库开启 Discussions）
 ├── 评分/收藏数：fetch ──► Cloudflare Worker ──► D1 数据库
 │     GET  /api/engagement?keys=organizations:ORG-001,...
 │     POST /api/engagement/vote   { key, dir: +1|-1, fp }   （Turnstile 校验）
 │     POST /api/engagement/fav    { key, delta: +1|-1 }
 └── 离线/接口失败：降级回现有 localStorage 模块，UI 不变
```

### 3.1 Giscus 集成改动点

- `renderEntry`（app.js:4749）评论区位置：本地 `Comments` 区块替换为 Giscus 容器（保留本地实现作降级）。
- 映射规则：`data-term` = `{cat}:{id}`，每个条目自动对应一个 Discussion。
- 主题：Giscus 支持自定义 CSS，做一版黑白档案风 `giscus-theme.css` 放 `data/` 下。
- 前置：仓库 Settings 开启 Discussions + 安装 Giscus App（一次性网页操作，我给你步骤）。

### 3.2 Workers 计数 API 设计

D1 表：

```sql
CREATE TABLE engagement (
  key   TEXT NOT NULL,            -- "organizations:ORG-001"
  kind  TEXT NOT NULL,            -- 'vote_up' | 'vote_down' | 'fav'
  fp    TEXT NOT NULL,            -- 匿名指纹 hash（浏览器指纹+IP 混合，不存原文）
  ts    INTEGER NOT NULL,
  PRIMARY KEY (key, kind, fp)
);
```

端点（Worker，配 Turnstile 隐形验证 + 每 IP 每分钟 10 次限流）：

| 端点 | 说明 |
| --- | --- |
| `GET /api/engagement?keys=a,b,c` | 批量返回 `{key: {up, down, favs}}`，列表页卡片用 |
| `POST /api/engagement/vote` | 投票/改票/取消（同方向再投=删除记录），与现有 `RATINGS.vote` 语义一致 |
| `POST /api/engagement/fav` | 收藏数 ±1 |

### 3.3 前端改动点（保持模块边界）

- `RATINGS`（app.js:498）：`score()` 改为「本地立即显示 + 远端拉取合并」；`vote()` 先写本地（乐观更新）再 POST，失败回滚。
- `Favorites`（app.js:418）：`toggle()` 追加一次 fav 计数上报；**收藏列表本身仍是个人数据**，共享的只有数量。
- 新增 `ENGAGE` 配置常量：API base、开关；未配置时完全走现有本地逻辑（零回归）。
- 列表页卡片分数角标：批量 GET 一次当前页 12 条的计数。

## 4. 实施步骤

1. 仓库开 Discussions + 装 Giscus → 详情页嵌入（纯前端，可独立上线）。
2. 建 Cloudflare 账号 → 建 D1 → 部署 Worker（我给你完整 Worker 源码与 wrangler 配置）。
3. 前端 `RATINGS`/`Favorites` 接远端，灰度开关 `ENGAGE.enabled`。
4. 观察一周滥用情况，必要时加 Turnstile 强制校验。

## 5. 验收标准

- [ ] 两台不同浏览器对同一条目投票，互相可见对方分数
- [ ] 断网时评分仍可用（本地模式），恢复后补同步
- [ ] 评论区在 dark/light/holo 三主题下不违和
- [ ] Worker 免费额度（日 10 万次读 / 5 万次写）远低于站点流量

## 6. 风险与回退

| 风险 | 缓解 |
| --- | --- |
| 公开写接口被刷 | Turnstile + 限流 + 同 fp 去重；最坏情况清空 D1 表，本地数据无损 |
| Giscus 加载拖慢详情页 | 懒加载：评论区滚动进视口才注入 iframe |
| 读者没有 GitHub 账号 | 方案降级为全自建（B 完整版），评论加昵称字段即可 |
| Cloudflare 账号不想注册 | 回退方案：全部用 Giscus 反应（👍/👎）当评分，牺牲 +1/-1 语义 |

## 7. 需要你决定 / 提供

1. 评论走 Giscus（推荐）还是全自建？
2. 是否接受注册 Cloudflare 账号（免费）？
3. 投票是否允许游客（现状允许，记 `__guest__`）？共享后建议改为「匿名指纹」一票制。

---

## 8. 实施记录（2026-10-24 · 已完成编码，待部署）

用户决策：① 评论用 Giscus；② Cloudflare 账号已有，Worker+D1 由用户自己部署；③ 评分/收藏仅登录用户可投（按站内用户名去重，游客不可投）。

已落地的代码改动：

| 文件 | 改动 |
| --- | --- |
| `app.js` | 新增 `ENGAGE` 配置常量（apiBase 留空 = 纯本地零回归）；新增 `Engage` 模块（计数拉取/上报/Giscus 懒加载）；详情页评分加游客闸 + 乐观更新后上报并以服务端合计刷新；收藏 toggle 后上报计数（收藏列表本身仍是个人数据）；评论区在 Giscus 配置齐全时整体替换为懒加载 iframe；列表卡片评分角标改为占位 + `hydrateList` 批量填充 |
| `style.css` | 第 ⑪ 节：`.giscus-box` / `.giscus-hint` / `.ec-eng` / `.fav-shared-count` |
| `data/giscus-theme.css` | 新增：Giscus iframe 的黑白档案风主题（Primer 变量覆盖 + 直角化） |
| `worker/` | 新增 `wrangler.toml` / `src/index.js` / `schema.sql`（D1 表 `engagement(ekey,kind,fp,ts)`，ekey 避开 SQLite 保留字 KEY） |
| `index.html` | 缓存版本号：`app.js?v=83`、`style.css?v=75` |

接口契约（与 `Engage` 模块一一对应）：

- `GET /api/engagement?keys=cat:id,...` → `{ok, data:{key:{up,down,favs,my,myFav?}}}`，≤50 个 key，CORS 白名单 `luezd8lg.github.io` + localhost:8080
- `POST /api/engagement/vote {key,dir:±1}` 头 `X-WVA-User` → 服务端 toggle（同向再投=取消、反向=改票），返回该 key 最新合计
- `POST /api/engagement/fav {key,on:bool}` 同上需登录，返回该 key 最新合计
- 校验：key 正则 `^(anomalies|organizations|deities|eras|timelines):[\w-]{1,64}$`；用户名 1-64 字符，缺失/非法 → 401

已知限制：`X-WVA-User` 可被伪造（静态站无服务端会话），只能防君子不防刷子；如出现刷票，按第 6 节加 Turnstile 或清空 D1 表，本地数据无损。

## 9. 用户部署步骤（一次性，约 15 分钟）

### 9.1 Giscus 评论区

1. GitHub 仓库 `LUEzd8Lg/LUEzd8Lg.github.io` → **Settings → General → Features → 勾选 Discussions**。
2. 访问 <https://github.com/apps/giscus> → **Install**，授权给该仓库。
3. 打开 <https://giscus.app/zh-CN>，填入仓库名，映射方式选「**特定 term**」，分类建议选 **General**；页面底部会生成一段 `<script>`，从中复制两个值：
   - `data-repo-id` → 填入 `app.js` 的 `ENGAGE.giscus.repoId`
   - `data-category-id` → 填入 `ENGAGE.giscus.categoryId`
4. 主题已内置（`data/giscus-theme.css`，黑白档案风），无需在 giscus 页面选主题。
5. push 后生效。未填 `repoId/categoryId` 时详情页保持现有本地批注，零影响。

### 9.2 Cloudflare Worker + D1（评分/收藏全站计数）

```powershell
cd worker
npx wrangler login                              # 浏览器授权你的 Cloudflare 账号
npx wrangler d1 create wva-engagement           # 记下输出里的 database_id
# 把 database_id 填进 worker/wrangler.toml 的 database_id
npx wrangler d1 execute wva-engagement --file=./schema.sql
npx wrangler deploy                             # 输出形如 https://wva-engagement.<子域>.workers.dev
```

最后把 Worker 地址填入 `app.js` 的 `ENGAGE.apiBase`（不带尾斜杠），push 即上线。

### 9.3 验收清单（对照第 5 节）

- [ ] 两台浏览器登录不同站内账号，对同一条目互投 → 分数互相可见
- [ ] 未登录点评分 → 弹提示且不产生任何请求
- [ ] `ENGAGE.apiBase` 留空时整站行为与旧版一致（本地评分/本地评论）
- [ ] 评论区在三主题下不违和（Giscus iframe 主题固定深色系，浅色主题下是独立区块，可接受）
