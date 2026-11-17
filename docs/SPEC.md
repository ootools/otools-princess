# 设计规格 · 公主换装乐园

## 设计目标

3–8 岁儿童向、平板/面板横屏（1200×800）使用。核心是「换装」——让孩子给公主换发型、换裙子、换道具，看到整套装扮变化。因此立绘必须分层，每个部件独立造型。

## 视觉系统

- 奶油粉彩底：奶油底 `#FFF6F2` / 主粉 `#FF79B0` / 薰衣草 `#B9A5FF` / 天空蓝 `#8FD8FF` / 薄荷绿 `#8FE3C4` / 奶油黄 `#FFD469` / 深字 `#3B2456`。
- 大圆角（16–30px）、柔和阴影、卡片式布局、圆润字体；少文字多图形，图标+短标签。
- 亮/暗双主题：令牌自持于 `styles.css`，`html.dark` 切换；舞台背景随场景色，避免暗色下立绘场景与容器割裂。
- 触控友好：导航/按钮/卡片尺寸 ≥ 44px。

## 立绘分层（从后到前）

```
1 场景背景
2 翅膀/宠物（身后）
3 后发
4 腿 + 鞋
5 礼服（主体裙摆 + 衣身）
6 躯干/手臂（肤色）
7 上衣（叠加层，可为空）
8 脸（Q 版大眼 + 腮红 + 微笑/眨眼）
9 前发/刘海
10 头饰
11 首饰
12 手持道具
13 宠物（身前）
```

`viewBox` 固定 `0 0 400 520`，人物居中。`renderFigure(outfit, princess, sceneId, opts)` 顺序拼层。

## 造型差异化规则

每个部件有唯一 `variant`，对应独立的 SVG 绘制分支，保证「不同造型」而非「同款换色」：

- **礼服 20**：ball 蓬蓬 / mermaid 鱼尾 / aline / tiered 蛋糕 / tutu 纱裙 / column 直筒 / princessSleeve 泡泡袖 / short / train 拖尾 / ruffle 荷叶 / sunflower / ice 冰晶 / lace 蕾丝 / golden / candy 条纹 / velvet / butterfly / moon / apple / sage。
- **上衣 24**：roundTee / sailor 水手领 / puffBlouse / camisole / hooded / ruffleCollar / capelet / vVest / offShoulder / turtleneck / laceBlouse / doubleBreasted / wrap / armor / pinafore / flaredSleeve / knit / longCape / bubble / tieredCake / bowTie / suspender / cardigan / goldenBolero——袖型（短/泡泡/长/斗篷）、领口、衣身结构各异。
- **发型 18**：longWave / twinBun 双丸子 / highPony / bob / braid 麻花 / longStraight / curly / spaceBun / bobClips / flowerUpdo / twinTail / mermaid / roseCurl / goldLong / snowBob / starLong / chestnut / peachUpdo。
- 鞋 12 / 头饰 14 / 首饰 10 / 道具 12 / 翅膀宠物 8 同样各有独立造型分支。

配色（part.color）只作为造型的一部分，不计入素材数。

## 玩法与状态

- 稀有度：普通 54 / 稀有 30 / 闪亮 23 / 限定 11（合计 118）。普通款与部分稀有款（每类前若干件）默认解锁。
- 星星：初始 30；拍照 +2；解锁部件按稀有度扣 10/20/35/60；转盘首次免费、之后 15；套装领奖 40。
- 转盘从**未解锁**部件中按权重（普通6/稀有3/闪亮2/限定1）抽取。
- 套装：4 套，每套 4 件核心部件，凑齐可领 40 星（各套仅可领一次）。
- 存档：`localStorage`，反序列化时过滤非法部件 id、补全默认解锁项、钳制星星非负。

## 验收

- `npm test`：16 项游戏逻辑/数据单测（数量口径、id 唯一、套装引用、渲染差异、存档往返、解锁/转盘/套装/收藏/随机等）+ 14 项发布脚本单测。
- `scripts/e2e-check.mjs`：Chrome CDP 驱动真实点击，验证「点部件→立绘 SVG 变化 →层级面板更新 →存档写入」「切公主→HUD 更新」「50 位公主渲染」。
- 截图逐屏校验 8 个视图 + 亮暗主题 + 立绘/缩略图渲染预览。
