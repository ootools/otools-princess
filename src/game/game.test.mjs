/** 游戏数据与逻辑单测（node --test，无 DOM 依赖） */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARTS, PART_BY_ID, PRINCESSES, SCENES, SETS, CATEGORIES, COUNTS,
} from './data.mjs';
import { renderFigure, renderThumb } from './render.mjs';
import {
  createState, serialize, deserialize, selectPrincess, equip, unequip,
  unlockPart, spin, setProgress, claimSet, capture, randomize, stats, UNLOCK_COST,
} from './logic.mjs';

test('内容数量：50 公主 / 118 部件 / 12 场景 / 8 类', () => {
  assert.equal(PRINCESSES.length, 50);
  assert.equal(PARTS.length, 118);
  assert.equal(SCENES.length, 12);
  assert.equal(CATEGORIES.length, 8);
  assert.equal(COUNTS.princesses, 50);
  assert.equal(COUNTS.parts, 118);
});

test('公主与部件 id 唯一', () => {
  assert.equal(new Set(PRINCESSES.map((p) => p.id)).size, 50);
  assert.equal(new Set(PARTS.map((p) => p.id)).size, 118);
  assert.equal(PART_BY_ID.size, 118);
});

test('每个套装引用的部件都存在且同主题部件齐全', () => {
  for (const set of SETS) {
    assert.equal(set.parts.length, 4, `${set.name} 应有 4 件`);
    for (const id of set.parts) assert.ok(PART_BY_ID.has(id), `套装 ${set.name} 引用了不存在的部件 ${id}`);
  }
});

test('每位公主默认搭配的部件都存在', () => {
  for (const p of PRINCESSES) {
    for (const [cat, id] of Object.entries(p.outfit)) {
      if (id) assert.ok(PART_BY_ID.has(id), `${p.name} 的 ${cat} 引用了不存在的部件 ${id}`);
    }
  }
});

test('每个分类都有部件，稀有度分布合计 118', () => {
  const sum = Object.values(COUNTS.byCategory).reduce((a, b) => a + b, 0);
  assert.equal(sum, 118);
  const rsum = Object.values(COUNTS.byRarity).reduce((a, b) => a + b, 0);
  assert.equal(rsum, 118);
});

test('渲染：任意搭配都产出合法 SVG，且不同 variant 产生不同输出', () => {
  const s = createState();
  const p = PRINCESSES[0];
  const svg = renderFigure(s.outfit, p, s.sceneId);
  assert.match(svg, /<svg[\s\S]*<\/svg>$/);
  assert.ok(svg.length > 500);

  // 换一件上衣，输出必须不同（不是只换颜色）
  const tops = PARTS.filter((x) => x.category === 'top').slice(0, 6);
  const outs = new Set(tops.map((t) => renderFigure({ ...s.outfit, top: t.id }, p, null, { showScene: false })));
  assert.equal(outs.size, tops.length, '不同上衣 variant 应产生不同 SVG');

  // 缩略图也能渲染
  assert.match(renderThumb(PARTS[0]), /<svg/);
});

test('存档往返：序列化后反序列化保持一致', () => {
  const s = createState();
  const s2 = createState();
  const gown = PARTS.find((p) => p.category === 'gown' && p.unlocked);
  const equipped = equip(s, gown.id).state;
  const round = deserialize(serialize(equipped));
  assert.equal(round.princessId, s2.princessId);
  assert.equal(round.outfit.gown, gown.id);
  assert.equal(round.stars, equipped.stars);
  assert.deepEqual(round.unlocked.sort(), equipped.unlocked.sort());
});

test('反序列化能过滤非法 id 并补全默认解锁', () => {
  const bad = deserialize(JSON.stringify({
    princessId: 'no-such', outfit: { gown: 'no-such' }, unlocked: ['no-such'], stars: -5,
  }));
  assert.ok(PRINCESSES.some((p) => p.id === bad.princessId));
  assert.equal(bad.outfit.gown, null);
  assert.ok(bad.unlocked.length > 0, '默认解锁项应被补全');
  assert.equal(bad.stars, 0);
});

test('切换公主：加载默认搭配，未解锁部件跳过', () => {
  const s = createState();
  const target = PRINCESSES[7];
  const next = selectPrincess(s, target.id);
  assert.equal(next.princessId, target.id);
  assert.ok(next.seenPrincesses.includes(target.id));
  for (const id of Object.values(next.outfit)) {
    if (id) assert.ok(next.unlocked.includes(id), '穿上的一定是已解锁部件');
  }
});

test('穿戴：未解锁被拒，已解锁成功', () => {
  let s = createState();
  const locked = PARTS.find((p) => !p.unlocked);
  const r1 = equip(s, locked.id);
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'locked');
  const owned = PARTS.find((p) => p.category === 'prop' && p.unlocked);
  const r2 = equip(s, owned.id);
  assert.equal(r2.ok, true);
  assert.equal(r2.state.outfit.prop, owned.id);
  // 卸下
  assert.equal(unequip(r2.state, 'prop').outfit.prop, null);
});

test('解锁：扣星、重复解锁与星星不足', () => {
  let s = createState();
  s = { ...s, stars: 1000 };
  const locked = PARTS.find((p) => !p.unlocked && p.rarity === 'rare');
  const r = unlockPart(s, locked.id);
  assert.equal(r.ok, true);
  assert.equal(r.cost, UNLOCK_COST.rare);
  assert.equal(r.state.stars, 1000 - r.cost);
  assert.equal(unlockPart(r.state, locked.id).reason, 'already');
  const poor = { ...s, stars: 0 };
  assert.equal(unlockPart(poor, locked.id).reason, 'stars');
});

test('转盘：首次免费，后续扣星，必得一个未解锁部件', () => {
  let s = createState();
  const r1 = spin(s, () => 0);
  assert.equal(r1.ok, true);
  assert.equal(r1.cost, 0);
  assert.ok(!r1.state.unlocked.includes(r1.part.id) === false);
  const before = r1.state.stars;
  const r2 = spin(r1.state, () => 0.5);
  assert.equal(r2.ok, true);
  assert.equal(r2.cost, 15);
  assert.equal(r2.state.stars, before - 15);
  assert.ok(r2.part);
});

test('套装进度与领奖：凑齐后可领且不可重复', () => {
  let s = createState();
  s = { ...s, unlocked: PARTS.map((p) => p.id) };
  const set = SETS[0];
  for (const id of set.parts) s = equip(s, id).state;
  const prog = setProgress(s).find((x) => x.id === set.id);
  assert.equal(prog.done, true);
  assert.equal(prog.have, 4);
  const before = s.stars;
  const claim = claimSet(s, set.id);
  assert.equal(claim.ok, true, JSON.stringify(claim));
  assert.ok(claim.state.stars > before);
  assert.equal(claimSet(claim.state, set.id).reason, 'claimed');
});

test('拍照收藏：去重且加星', () => {
  let s = createState();
  const before = s.stars;
  const c1 = capture(s);
  assert.equal(c1.ok, true);
  assert.equal(c1.state.stars, before + 2);
  const c2 = capture(c1.state);
  assert.equal(c2.ok, false);
  assert.equal(c2.reason, 'duplicate');
});

test('随机换装：部件都来自已解锁集合', () => {
  const s = createState();
  const r = randomize(s, () => 0.3);
  const unlocked = new Set(s.unlocked);
  for (const id of Object.values(r.outfit)) if (id) assert.ok(unlocked.has(id));
});

test('统计口径正确', () => {
  const st = stats(createState());
  assert.equal(st.princessTotal, 50);
  assert.equal(st.partsTotal, 118);
  assert.equal(st.rarities.length, 4);
  assert.equal(st.rarities.reduce((a, b) => a + b.total, 0), 118);
});
