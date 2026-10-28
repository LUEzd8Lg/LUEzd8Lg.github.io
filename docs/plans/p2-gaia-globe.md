# P2 方案 · 盖亚星球 3D 可视化（Three.js）

> 状态：**仅方案，未动代码** · 2026-10-24
> 决策输入：技术路线已定为 **Three.js 3D 球体**。
> 现状：仓库中**不存在** `gaia-globe.js` / `region-map.js`，本方案为全新模块。

---

## 1. 目标与定位

- 新增路由 `#/gaia`：可旋转的盖亚星球，四洲信标可点击跳转，红月环绕，整体保持站点黑白档案美学（红月是唯一强调色）。
- 首页 HERO 可选嵌入缩小版（第二阶段，先不做）。
- 它是「展示层」模块：只读现有 `DATA` / `WORLD_HISTORY`，不新增数据结构。

## 2. 依赖策略（项目首次引入第三方库）

| 项 | 决策 |
| --- | --- |
| Three.js 版本 | r180+（ES Module） |
| 加载方式 | **懒加载**：仅进入 `#/gaia` 时动态 `import()`，首屏零成本 |
| 来源 | **自托管** `vendor/three.module.min.js`（~600 KB）而非 CDN——GitHub Pages 同域、可缓存、无外网依赖，符合「素材不进外部链接」的项目习惯 |
| OrbitControls | 自写轻量拖拽 + 惯性（< 80 行），不引 addons，省 ~40 KB |
| 降级 | WebGL 不可用 / `prefers-reduced-motion` / 移动端低配 → 静态合成图（四洲图拼合） + 文字信标列表 |

## 3. 模块结构

```
app.js
 └── renderGaia()                    # 新视图函数，路由 #/gaia
      └── window.GaiaGlobe.mount(el, opts)
vendor/three.module.min.js          # 自托管
js/gaia-globe.js                    # 独立 IIFE 模块，挂 window.GaiaGlobe
data/gaia/                          # 贴图素材（全部可选，缺失自动程序化）
 ├── gaia-map.jpg                   # 球面展开图 2:1（equirectangular）
 ├── gaia-clouds.jpg                # 云层（透明通道 PNG 或灰度图）
 └── gaia-bump.jpg                  # 地形凹凸灰度图
```

`gaia-globe.js` 公开接口：

```js
GaiaGlobe.mount(container, {
  continents: [...],   // 信标数据（名称/经纬/跳转 hash）
  onBeaconClick: fn,
  quality: 'auto'      // auto → 按 devicePixelRatio/移动端降采样
});
GaiaGlobe.unmount();                # 离开路由必须 dispose（释放 GL 上下文）
```

## 4. 场景组成（对应既有视觉概念）

| 元素 | 实现 | 备注 |
| --- | --- | --- |
| 盖亚本体 | `SphereGeometry` + 贴图或程序化 shader | 无贴图时用噪声生成灰黑大陆 |
| 大气辉光 | 背面半球 + 菲涅尔 shader | 冷白色，不用彩色 |
| 星空背景 | 2000 个 `Points`，慢速自转 | 复用登录门禁粒子的灰阶色板 |
| 红月 | 小球体 + 单向红色点光源 + 缓慢公转 | 全站唯一红色元素，呼应主题 |
| 刻度仪环 | 两个倾斜 `RingGeometry` 刻度环 | 「观测仪器」感 |
| 四洲信标 | 4 个 `Sprite`，呼吸闪烁 | 中洲/北洲/东洲/南洲，点击 → `#/timelines` 对应洲锚点 |
| 交互 | 拖拽旋转 + 滚轮缩放 + 信标 raycast 点击 | 闲置 3s 恢复自转 |

四洲信标经纬度：以四洲图为参照在球面展开图上标定，实施时先放近似位置，再按你反馈微调。

## 5. 素材需求（需要你提供）

| 素材 | 规格 | 缺失时的 fallback |
| --- | --- | --- |
| 球面展开图 `gaia-map.jpg` | 2048×1024，黑白灰，四洲位置可辨认 | 程序化噪声大陆（能用但不准确） |
| 云层 `gaia-clouds.jpg` | 2048×1024 灰度 | 跳过云层 |
| 凹凸 `gaia-bump.jpg` | 1024×512 灰度 | 跳过法线/位移 |

> 若你按惯例自己生成图片：提示词方向「equirectangular world map, four continents, grayscale, ink-cartography style, flat projection」。生成后按上表文件名放入 `data/gaia/` 即自动加载。

## 6. 前端改动点清单

| 文件 | 改动 |
| --- | --- |
| `index.html` | 无（脚本由 `gaia-globe.js` 自行注入） |
| `app.js` | ① 路由 `router()` 加 `#/gaia` 分支；② 新增 `renderGaia()`（骨架 + 懒加载 `js/gaia-globe.js`）；③ 导航「探索」组加入口；④ `hashchange` 离开时调 `GaiaGlobe.unmount()` |
| `style.css` | 新增 `.gaia-*` 区块（画布容器、信标图例、加载态、降级态），复用现有 CSS 变量 |
| 新增 | `js/gaia-globe.js`、`vendor/three.module.min.js`、`data/gaia/`（素材目录） |

不改：`data/*.json`、`merged.js`、server、任何现有模块。

## 7. 实施步骤

1. 下载 three.module.min.js 入 `vendor/`（一次性）。
2. 写 `gaia-globe.js`：球体 + 辉光 + 星空 + 红月 + 刻度环，程序化贴图先行。
3. `app.js` 接路由与懒加载，浏览器验证交互。
4. 加信标 + 跳转；加降级路径。
5. 你提供正式展开图后替换程序化贴图。

## 8. 验收标准

- [ ] `#/gaia` 首次进入加载 ≤ 1.5s（本地），之后走缓存
- [ ] 拖拽/缩放/信标点击流畅（60fps，低端机自动降采样不卡死）
- [ ] 首页与列表页性能不受任何影响（Three.js 未被加载）
- [ ] 三主题下视觉统一；`prefers-reduced-motion` 下显示静态图
- [ ] 离开路由后 WebGL 上下文释放（`renderer.dispose()`，内存不泄漏）

## 9. 风险

| 风险 | 缓解 |
| --- | --- |
| 600 KB 自托管库增大仓库 | 只引核心，不带 addons；gzip 后约 150 KB |
| 低端设备掉帧 | `quality:'auto'` 降 pixelRatio + 减星空密度 + 关辉光 |
| WebGL 上下文泄漏（反复进出路由） | `unmount()` 里完整 dispose + 取消 RAF，验收单列一项 |
| 黑白美学被 3D 光效破坏 | 红月唯一彩色；辉光/星空全部灰阶，验收截图三主题各一张 |
