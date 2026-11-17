# 公主换装乐园（otools-princess）

给 3–8 岁孩子的离线公主换装游戏，作为 OTools 独立插件发布。

**核心特点：真换装，不是换色。** 每位公主的立绘由 8 个独立图层叠加而成，点选衣柜里的任一部件即替换对应图层并实时重绘——发型、礼服廓形、袖型、领口、道具都是各自独立绘制的造型。

## 一句话

50 位主题公主 · 118 件独立造型部件 · 12 个梦幻场景 · 分层自由搭配 + 套装加成 + 转盘抽奖 + 相册收藏。

## 内容口径

| 项 | 数量 | 说明 |
|---|---|---|
| 公主 | 50 | 5 大主题 × 10 位（玫瑰花园 / 海洋人鱼 / 星夜魔法 / 花园茶会 / 森林仙子） |
| 造型部件 | 118 | 8 大类，每件独立造型；同款换色属配色微调，不单独计件 |
| 场景 | 12 | 城堡舞会、樱花庭院、星空露台等 |
| 套装 | 4 | 凑齐同主题 4 件核心部件可领星星大奖 |

8 大类部件：发型 18 · 礼服 20 · 上衣 24 · 鞋子 12 · 头饰 14 · 首饰 10 · 道具 12 · 翅膀/宠物 8。

## 功能

- **换装间**：中央立绘舞台 + 右侧「当前造型」8 层清单（点一下脱下）+ 分类衣柜 + 场景切换 + 随机搭配 + 表情切换 + 拍照收藏。
- **公主图鉴**：50 位公主卡片，按主题筛选，点击即载入她的默认搭配。
- **魔法衣柜**：118 件部件总览，稀有度徽章、锁定态、解锁价格、穿着中标记。
- **套装任务**：4 套主题套装，部件收集进度与领奖。
- **幸运转盘**：从未解锁部件中按稀有度加权抽取，首次免费。
- **我的相册**：收藏搭配照片（含场景），可回看。
- **家长中心**：离线/无广告/无内购说明，收集进度，亮暗切换，重置进度。

## 技术

- 纯前端 Vue 3 + Vite，`base: './'`，无网络、无 SDK、无 native。
- **渲染引擎**（`src/game/render.mjs`）：分层 SVG 生成器，每类部件按 `variant` 绘制不同 path；`renderFigure()` 组合 8 层出整张立绘，`renderThumb()` 按类别裁切视窗出卡片缩略图。
- **数据层**（`src/game/data.mjs`）：配方表展开出 50 公主 / 118 部件 / 12 场景 / 4 套装，纯数据无 DOM 依赖。
- **逻辑层**（`src/game/logic.mjs`）：不可变状态函数（穿戴/解锁/转盘/套装/收藏/统计），便于单测。
- **主题自持**（`src/theme.ts`）：读宿主注入 `window.__OTOOLS_THEME__` → 本地缓存 → 系统配色；`html.dark` 切换令牌，不依赖宿主样式表。
- 存档：`localStorage` 键 `otools-princess:save:v1`，含脱敏校验与非法 id 过滤。

## 开发

```bash
npm install
npm run dev          # 127.0.0.1:6574 热更新
npm run typecheck    # vue-tsc 类型检查
npm test             # 游戏逻辑 + 发布脚本单测（node --test）
npm run build        # 产出 dist/
npm run preview      # 本地起 dist 静态服务（6575）
node scripts/e2e-check.mjs   # Chrome CDP 端到端换装交互验收（需先 preview）
npm run pack         # 构建 + 打包 .oplg + 校验
```

本地预览可用 `?view=home|studio|...` 指定初始视图，`?theme=dark|light` 指定主题。

## 打包与发布

`npm run pack` 产出 `dist-pack/otools-princess-<version>.oplg`（扁平 ZIP：plugin.json + logo.svg + dist/）。
`verify-plugin.mjs` 校验摘要、ZIP/CRC、入口与 logo 齐备、正式包不含 devUrl/quickDev。

发布走独立仓自带工作流：推 `v<版本>` 标签触发 `.github/workflows/release-plugin.yml`，构建 → Release → 上架市场（需仓库 `release` environment 与 `XYCLOUD_PAT` 等配置，见宿主 AGENTS.md）。
纯前端单合包，Release 标签格式 `v<版本>`。
