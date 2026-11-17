/**
 * 公主换装乐园 · 游戏逻辑层（纯 JS / ESM，无 DOM 依赖）
 * ------------------------------------------------------------------
 * 状态：当前公主、当前搭配、已解锁部件、星星、收藏相册、任务进度。
 * 提供纯函数 + 一个可序列化的 store（存档到 localStorage，由 UI 层注入存储）。
 */

import { PARTS, PART_BY_ID, PRINCESSES, PRINCESS_BY_ID, SCENES, SETS, RARITY, CATEGORIES } from './data.mjs';

export const SAVE_KEY = 'otools-princess:save:v1';

export function defaultUnlockSet() {
  return new Set(PARTS.filter((p) => p.unlocked).map((p) => p.id));
}

export function createState() {
  const first = PRINCESSES[0];
  return {
    princessId: first.id,
    outfit: { ...first.outfit },
    sceneId: 'scene-castle',
    unlocked: [...defaultUnlockSet()],
    stars: 30,
    album: [],           // [{ id, princessId, outfit, sceneId, createdAt }]
    seenPrincesses: [first.id],
    spinUsed: 0,
    mood: 'smile',
  };
}

/** JSON 存档：把 Set 转数组，读取时再还原 */
export function serialize(state) {
  return JSON.stringify({
    princessId: state.princessId,
    outfit: state.outfit,
    sceneId: state.sceneId,
    unlocked: state.unlocked,
    stars: state.stars,
    album: state.album,
    seenPrincesses: state.seenPrincesses,
    spinUsed: state.spinUsed,
    mood: state.mood,
  });
}

export function deserialize(raw) {
  const base = createState();
  if (!raw) return base;
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const outfit = { ...base.outfit, ...(data.outfit || {}) };
    // 过滤掉不存在或已失效的部件 id
    for (const cat of Object.keys(outfit)) {
      if (outfit[cat] && !PART_BY_ID.has(outfit[cat])) outfit[cat] = null;
    }
    const unlocked = Array.isArray(data.unlocked)
      ? data.unlocked.filter((id) => PART_BY_ID.has(id))
      : base.unlocked;
    return {
      princessId: PRINCESS_BY_ID.has(data.princessId) ? data.princessId : base.princessId,
      outfit,
      sceneId: SCENES.some((s) => s.id === data.sceneId) ? data.sceneId : base.sceneId,
      unlocked: [...new Set([...unlocked, ...base.unlocked])], // 默认解锁项始终保留
      stars: Number.isFinite(data.stars) ? Math.max(0, Math.floor(data.stars)) : base.stars,
      album: Array.isArray(data.album) ? data.album.slice(0, 60) : [],
      seenPrincesses: Array.isArray(data.seenPrincesses) ? [...new Set(data.seenPrincesses)] : base.seenPrincesses,
      spinUsed: Number.isFinite(data.spinUsed) ? data.spinUsed : 0,
      mood: data.mood === 'wink' ? 'wink' : 'smile',
    };
  } catch {
    return base;
  }
}

/** 切换公主：载入她的默认搭配（部件未解锁则跳过） */
export function selectPrincess(state, princessId) {
  const p = PRINCESS_BY_ID.get(princessId);
  if (!p) return state;
  const unlocked = new Set(state.unlocked);
  const outfit = {};
  for (const [cat, id] of Object.entries(p.outfit)) {
    outfit[cat] = id && unlocked.has(id) ? id : null;
  }
  const seen = state.seenPrincesses.includes(princessId)
    ? state.seenPrincesses
    : [...state.seenPrincesses, princessId];
  return { ...state, princessId, outfit, seenPrincesses: seen };
}

/** 穿戴部件：未解锁返回原状态 + 原因 */
export function equip(state, partId) {
  const part = PART_BY_ID.get(partId);
  if (!part) return { state, ok: false, reason: 'not-found' };
  if (!state.unlocked.includes(partId)) return { state, ok: false, reason: 'locked' };
  const next = { ...state.outfit, [part.category]: partId };
  return { state: { ...state, outfit: next }, ok: true };
}

/** 卸下某类部件 */
export function unequip(state, category) {
  if (!(category in state.outfit)) return state;
  return { ...state, outfit: { ...state.outfit, [category]: null } };
}

/** 解锁部件（消耗星星），价格按稀有度 */
export const UNLOCK_COST = { common: 10, rare: 20, shiny: 35, limited: 60 };
export function unlockPart(state, partId) {
  const part = PART_BY_ID.get(partId);
  if (!part) return { state, ok: false, reason: 'not-found' };
  if (state.unlocked.includes(partId)) return { state, ok: false, reason: 'already' };
  const cost = UNLOCK_COST[part.rarity] ?? 20;
  if (state.stars < cost) return { state, ok: false, reason: 'stars', cost };
  return {
    state: { ...state, stars: state.stars - cost, unlocked: [...state.unlocked, partId] },
    ok: true, cost,
  };
}

/** 转盘：从"未解锁"部件里按稀有度加权抽一个，免费一次后每次 15 星 */
export const SPIN_COST = 15;
export function spinCost(state) { return state.spinUsed === 0 ? 0 : SPIN_COST; }
export function spin(state, rng = Math.random) {
  const cost = spinCost(state);
  if (state.stars < cost) return { state, ok: false, reason: 'stars', cost };
  const locked = PARTS.filter((p) => !state.unlocked.includes(p.id));
  if (locked.length === 0) return { state, ok: false, reason: 'all-unlocked', cost };
  // 权重：普通 6 / 稀有 3 / 闪亮 2 / 限定 1
  const weight = { common: 6, rare: 3, shiny: 2, limited: 1 };
  const total = locked.reduce((s, p) => s + (weight[p.rarity] || 1), 0);
  let r = Math.min(Math.max(rng(), 0), 0.999999) * total;
  let picked = locked[locked.length - 1];
  for (const p of locked) {
    r -= weight[p.rarity] || 1;
    if (r <= 0) { picked = p; break; }
  }
  return {
    state: {
      ...state,
      stars: state.stars - cost,
      spinUsed: state.spinUsed + 1,
      unlocked: [...state.unlocked, picked.id],
    },
    ok: true, part: picked, cost,
  };
}

/** 套装进度：返回每套 已凑齐件数/总数、是否完成 */
export function setProgress(state) {
  const eq = new Set(Object.values(state.outfit).filter(Boolean));
  return SETS.map((set) => {
    const have = set.parts.filter((id) => eq.has(id)).length;
    return { ...set, have, total: set.parts.length, done: have === set.parts.length };
  });
}

/** 完成套装领奖：每套只可领一次（记在 album 的 special 标记里简化处理） */
export function claimSet(state, setId) {
  const prog = setProgress(state).find((s) => s.id === setId);
  if (!prog || !prog.done) return { state, ok: false, reason: 'not-done' };
  const claimedKey = `claim:${setId}`;
  if (state.album.some((a) => a.id === claimedKey)) return { state, ok: false, reason: 'claimed' };
  const reward = 20 + prog.total * 5;
  return {
    state: {
      ...state,
      stars: state.stars + reward,
      album: [...state.album, { id: claimedKey, special: true, setId, createdAt: Date.now() }],
    },
    ok: true, reward,
  };
}

/** 拍照收藏：同一搭配不重复保存 */
export function capture(state) {
  const sig = `${state.princessId}|${JSON.stringify(state.outfit)}|${state.sceneId}`;
  if (state.album.some((a) => a.id === sig)) return { state, ok: false, reason: 'duplicate' };
  const entry = {
    id: sig,
    princessId: state.princessId,
    outfit: { ...state.outfit },
    sceneId: state.sceneId,
    createdAt: Date.now(),
  };
  return { state: { ...state, stars: state.stars + 2, album: [entry, ...state.album].slice(0, 60) }, ok: true, entry };
}

/** 随机换装：在当前已解锁部件里随机搭配（保留发型） */
export function randomize(state, rng = Math.random) {
  const unlocked = new Set(state.unlocked);
  const outfit = { ...state.outfit };
  for (const cat of CATEGORIES) {
    const candidates = PARTS.filter((p) => p.category === cat.id && unlocked.has(p.id));
    if (!candidates.length) { outfit[cat.id] = null; continue; }
    // 翅膀/上衣有概率为空，让造型更多变
    if ((cat.id === 'wings' || cat.id === 'top') && rng() < 0.45) { outfit[cat.id] = null; continue; }
    outfit[cat.id] = candidates[Math.floor(rng() * candidates.length)].id;
  }
  return { ...state, outfit };
}

/** 统计：供首页与家长中心展示 */
export function stats(state) {
  const rarities = Object.keys(RARITY).map((r) => ({
    id: r,
    name: RARITY[r].name,
    color: RARITY[r].color,
    total: PARTS.filter((p) => p.rarity === r).length,
    owned: PARTS.filter((p) => p.rarity === r && state.unlocked.includes(p.id)).length,
  }));
  return {
    princessTotal: PRINCESSES.length,
    princessSeen: state.seenPrincesses.length,
    partsTotal: PARTS.length,
    partsOwned: state.unlocked.length,
    rarities,
    albumCount: state.album.filter((a) => !a.special).length,
    stars: state.stars,
  };
}
