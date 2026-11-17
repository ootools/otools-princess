<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  THEMES, RARITY, CATEGORIES, PARTS, PART_BY_ID, SCENES, SCENE_BY_ID, SETS, PRINCESSES, PRINCESS_BY_ID,
} from './game/data.mjs';
import { renderFigure, renderThumb } from './game/render.mjs';
import { createAudioEngine, saveAudioSettings, normalizeAudioSettings } from './game/audio.mjs';
import {
  SAVE_KEY, createState, serialize, deserialize, selectPrincess, equip, unequip,
  unlockPart, UNLOCK_COST, spinCost, spin, setProgress, claimSet, capture, randomize, stats,
} from './game/logic.mjs';

/* ----------------------------- 状态 ----------------------------- */
function loadState() {
  try {
    return deserialize(localStorage.getItem(SAVE_KEY));
  } catch {
    return createState();
  }
}
const state = reactive(loadState());
watch(state, () => {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); } catch { /* ignore */ }
}, { deep: true });

type View = 'home' | 'studio' | 'princesses' | 'wardrobe' | 'quests' | 'spin' | 'album' | 'parents';
const VALID_VIEWS: View[] = ['home', 'studio', 'princesses', 'wardrobe', 'quests', 'spin', 'album', 'parents'];
const initialView = (() => {
  try {
    const v = new URLSearchParams(location.search).get('view') as View;
    return VALID_VIEWS.includes(v) ? v : 'studio';
  } catch { return 'studio'; }
})();
const view = ref<View>(initialView);
const NAV: { id: View; icon: string; label: string }[] = [
  { id: 'home', icon: '🏰', label: '首页' },
  { id: 'studio', icon: '💄', label: '换装间' },
  { id: 'princesses', icon: '👑', label: '公主图鉴' },
  { id: 'wardrobe', icon: '👗', label: '魔法衣柜' },
  { id: 'quests', icon: '🏅', label: '套装任务' },
  { id: 'spin', icon: '🎡', label: '幸运转盘' },
  { id: 'album', icon: '📖', label: '我的相册' },
  { id: 'parents', icon: '⚙️', label: '家长中心' },
];

const toast = ref('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function say(msg: string) {
  toast.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.value = ''; }, 2200);
}

/* ----------------------------- 音频 ----------------------------- */
function loadAudioSettings() {
  try { return normalizeAudioSettings(JSON.parse(localStorage.getItem('otools-princess:audio:v1') || 'null')); }
  catch { return normalizeAudioSettings(null); }
}
const audioState = reactive(loadAudioSettings());
const audio = createAudioEngine(audioState);
const audioUnlocked = ref(false);

function sfx(name: string) { audio.play(name); }
function applyAudio() {
  audio.applySettings(audioState);
  saveAudioSettings(audioState);
}
/** 浏览器 autoplay 策略：首次真实手势才初始化音频上下文 */
function unlockAudio() {
  if (audioUnlocked.value) return;
  audioUnlocked.value = true;
  audio.unlock();
  audio.applySettings(audioState);
}
function toggleMusic() { audioState.musicOn = !audioState.musicOn; applyAudio(); sfx('toggle'); }
function toggleSfx() { audioState.sfxOn = !audioState.sfxOn; applyAudio(); if (audioState.sfxOn) sfx('toggle'); }
function setMusicVol(e: Event) { audioState.musicVol = Number((e.target as HTMLInputElement).value) / 100; applyAudio(); }
function setSfxVol(e: Event) { audioState.sfxVol = Number((e.target as HTMLInputElement).value) / 100; applyAudio(); }
function previewMusic() { unlockAudio(); sfx('win'); }
/** HUD 一键静音：同时切换音乐与音效，记住各自原状态 */
const muted = computed(() => !audioState.musicOn && !audioState.sfxOn);
function toggleMute() {
  if (muted.value) {
    audioState.musicOn = true; audioState.sfxOn = true;
  } else {
    audioState.musicOn = false; audioState.sfxOn = false;
  }
  applyAudio();
  if (audioState.sfxOn) sfx('toggle');
}

/* ----------------------------- 派生数据 ----------------------------- */
const princess = computed(() => PRINCESS_BY_ID.get(state.princessId) || PRINCESSES[0]);
const figureSvg = computed(() => renderFigure(state.outfit, princess.value, state.sceneId, { uid: 'stage', mood: state.mood }));
const st = computed(() => stats(state));
const progs = computed(() => setProgress(state));
const unlockedSet = computed(() => new Set(state.unlocked));
const scene = computed(() => SCENE_BY_ID.get(state.sceneId) || SCENES[0]);

// 换装间分类与部件
const activeCat = ref('hair');
const catParts = computed(() => PARTS.filter((p: any) => p.category === activeCat.value));
const activeCatInfo = computed(() => CATEGORIES.find((c: any) => c.id === activeCat.value));
const equippedInCat = computed(() => state.outfit[activeCat.value]);

// 衣柜筛选
const wardrobeCat = ref('all');
const wardrobeList = computed(() => wardrobeCat.value === 'all' ? PARTS : PARTS.filter((p: any) => p.category === wardrobeCat.value));

// 图鉴主题筛选
const themeFilter = ref('all');
const princessList = computed(() => themeFilter.value === 'all' ? PRINCESSES : PRINCESSES.filter((p: any) => p.theme === themeFilter.value));

// 相册中的照片（排除套装领取标记）
const photos = computed(() => state.album.filter((a: any) => !a.special));

/* ----------------------------- 交互 ----------------------------- */
/** 逻辑层返回不可变新 state，这里统一写回 reactive 对象（保持引用） */
function applyState(next: any) {
  for (const k of Object.keys(next)) (state as any)[k] = next[k];
}

function pickPart(part: any) {
  if (unlockedSet.value.has(part.id)) {
    const r = equip(state, part.id);
    if (r.ok) { applyState(r.state); say(`换上了「${part.name}」✨`); sfx('equip'); }
  } else {
    pendingUnlock.value = part;
    sfx('error');
  }
}

const pendingUnlock = ref<any>(null);
const unlockCost = computed(() => pendingUnlock.value ? (UNLOCK_COST[pendingUnlock.value.rarity] ?? 20) : 0);
function confirmUnlock() {
  const part = pendingUnlock.value;
  if (!part) return;
  const r = unlockPart(state, part.id);
  if (r.ok) {
    applyState(r.state);
    const worn = equip(state, part.id);
    if (worn.ok) applyState(worn.state);
    say(`解锁「${part.name}」成功，花费 ${r.cost} ⭐`);
    sfx('unlock');
    pendingUnlock.value = null;
  } else if (r.reason === 'stars') {
    say(`星星不够啦，还差 ${r.cost - state.stars} ⭐`);
    sfx('error');
  }
}

function removeLayer(cat: string) {
  applyState(unequip(state, cat));
  say('已经脱下这一层啦');
  sfx('remove');
}

function choosePrincess(p: any) {
  applyState(selectPrincess(state, p.id));
  view.value = 'studio';
  say(`欢迎公主「${p.name}」👑`);
  sfx('hello');
}

function doRandom() {
  Object.assign(state, randomize(state));
  say('随机搭配完成，看看新造型 🎀');
  sfx('win');
}

function toggleMood() {
  state.mood = state.mood === 'smile' ? 'wink' : 'smile';
  sfx('toggle');
}

function doCapture() {
  const r = capture(state);
  if (r.ok) { applyState(r.state); say('拍下美美的照片，+2 ⭐'); sfx('capture'); }
  else { say('这张已经拍过啦'); sfx('error'); }
}

function chooseScene(s: any) {
  state.sceneId = s.id;
  say(`切换到「${s.name}」场景`);
  sfx('scene');
}

function doClaim(set: any) {
  const r = claimSet(state, set.id);
  if (r.ok) { applyState(r.state); say(`恭喜集齐「${set.name}」，+${r.reward} ⭐🎉`); celebrate(); }
  else { say('这套还不能领奖哦'); sfx('error'); }
}

/* 转盘 */
const spinning = ref(false);
const spinResult = ref<any>(null);
let spinTickTimer: ReturnType<typeof setInterval> | null = null;
function doSpin() {
  if (spinning.value) return;
  const cost = spinCost(state);
  if (state.stars < cost) { say('星星不够转啦'); sfx('error'); return; }
  spinning.value = true;
  spinResult.value = null;
  sfx('spin');
  spinTickTimer = setInterval(() => sfx('spin'), 110);
  setTimeout(() => {
    if (spinTickTimer) { clearInterval(spinTickTimer); spinTickTimer = null; }
    const r = spin(state);
    spinning.value = false;
    if (r.ok) { applyState(r.state); spinResult.value = r.part; celebrate(); }
    else say('没有可抽的部件了');
  }, 1100);
}
function wearResult() {
  if (!spinResult.value) return;
  const r = equip(state, spinResult.value.id);
  if (r.ok) applyState(r.state);
  say(`穿上了「${spinResult.value.name}」`);
  sfx('equip');
  spinResult.value = null;
}

/* 庆祝动画 */
const celebrating = ref(false);
function celebrate() {
  celebrating.value = true;
  sfx('win');
  setTimeout(() => { celebrating.value = false; }, 1600);
}
const confetti = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  delay: `${(i % 8) * 0.08}s`,
  color: ['#FF79B0', '#FFD469', '#8FD8FF', '#B9A5FF', '#8FE3C4'][i % 5],
  rotate: `${(i * 47) % 360}deg`,
}));

/* 家长中心 */
function resetGame() {
  if (!window.confirm('确定要重置所有进度吗？星星、解锁和相册都会清空。')) return;
  Object.assign(state, createState());
  view.value = 'home';
  say('已重置为新游戏');
  sfx('toggle');
}
function toggleTheme() {
  const root = document.documentElement;
  const dark = root.classList.toggle('dark');
  root.classList.toggle('light', !dark);
  root.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('otools:theme-mode', dark ? 'dark' : 'light'); } catch { /* ignore */ }
}

onMounted(() => {
  // 首次真实手势（点按/键盘）解锁音频上下文；只触发一次
  const onFirstGesture = () => { unlockAudio(); };
  window.addEventListener('pointerdown', onFirstGesture, { once: true });
  window.addEventListener('keydown', onFirstGesture, { once: true });
});

const viewTitle = computed(() => NAV.find((n) => n.id === view.value)?.label || '');
function go(target: View) { view.value = target; sfx('tab'); }
/** 分类 / 筛选切换的轻音效（值本身用 v-model 式赋值，这里只出声） */
function tick() { sfx('tab'); }
</script>

<template>
  <div class="princess-app">
    <!-- 顶部 HUD -->
    <header class="hud">
      <div class="hud-brand">
        <span class="hud-crown">👑</span>
        <div>
          <div class="hud-title">公主换装乐园</div>
          <div class="hud-sub">Princess Dress Up</div>
        </div>
      </div>
      <div class="hud-center">
        <span class="hud-princess">{{ princess.name }}</span>
        <span class="hud-theme" :style="{ background: princess.themeColor }">{{ princess.themeName }}</span>
      </div>
      <div class="hud-stats">
        <div class="star-pill" title="我的星星"><span>⭐</span><b>{{ state.stars }}</b></div>
        <div class="lv-pill" title="收集等级">Lv.{{ Math.min(9, 1 + Math.floor(st.partsOwned / 14)) }}</div>
        <button class="icon-btn" :class="{ 'is-off': muted }" :title="muted ? '开启声音' : '一键静音'" @click="toggleMute">{{ muted ? '🔇' : '🔊' }}</button>
        <button class="icon-btn" title="切换亮暗" @click="toggleTheme">🌗</button>
      </div>
    </header>

    <div class="body">
      <!-- 左侧导航 -->
      <nav class="nav">
        <button
          v-for="n in NAV" :key="n.id"
          class="nav-item" :class="{ active: view === n.id }"
          @click="go(n.id)"
        >
          <span class="nav-icon">{{ n.icon }}</span>
          <span class="nav-label">{{ n.label }}</span>
        </button>
      </nav>

      <!-- 主内容 -->
      <main class="content">
        <!-- ============ 首页 ============ -->
        <section v-if="view === 'home'" class="view home">
          <div class="home-hero">
            <div class="hero-text">
              <div class="hero-badge">✨ 欢迎来到换装乐园</div>
              <h1>今天，你想成为<br /><em>哪位公主</em>呢？</h1>
              <p>50 位主题公主 · 118 件精绘造型 · 自由搭配，天天不一样</p>
              <div class="hero-actions">
                <button class="btn primary big" @click="go('studio')">💄 开始换装</button>
                <button class="btn ghost big" @click="go('princesses')">👑 认识公主</button>
              </div>
            </div>
            <div class="hero-figure" v-html="figureSvg"></div>
          </div>
          <div class="home-cards">
            <button class="feature-card fc-pink" @click="go('studio')">
              <span class="fc-icon">🎀</span><div><b>自由换装</b><small>8 大类部件分层搭配</small></div><span class="fc-arrow">›</span>
            </button>
            <button class="feature-card fc-blue" @click="go('princesses')">
              <span class="fc-icon">🌈</span><div><b>50 位公主</b><small>5 大主题等你收集</small></div><span class="fc-arrow">›</span>
            </button>
            <button class="feature-card fc-green" @click="go('quests')">
              <span class="fc-icon">🏅</span><div><b>套装加成</b><small>凑齐一套领大奖</small></div><span class="fc-arrow">›</span>
            </button>
            <button class="feature-card fc-yellow" @click="go('spin')">
              <span class="fc-icon">🎡</span><div><b>幸运转盘</b><small>首次免费抽部件</small></div><span class="fc-arrow">›</span>
            </button>
          </div>
          <div class="home-progress">
            <div class="hp-item"><b>{{ st.princessSeen }}/{{ st.princessTotal }}</b><span>已认识公主</span></div>
            <div class="hp-item"><b>{{ st.partsOwned }}/{{ st.partsTotal }}</b><span>已收集部件</span></div>
            <div class="hp-item"><b>{{ st.albumCount }}</b><span>相册照片</span></div>
            <div class="hp-item"><b>{{ state.stars }}</b><span>星星总数</span></div>
          </div>
        </section>

        <!-- ============ 换装间 ============ -->
        <section v-else-if="view === 'studio'" class="view studio">
          <div class="stage-wrap">
            <div class="stage" :class="'scene-' + scene.variant" :style="{ background: scene.color }">
              <div class="stage-figure" v-html="figureSvg"></div>
              <div class="stage-name">{{ princess.name }} · {{ princess.themeName }}</div>
              <button class="mood-btn" @click="toggleMood" title="换表情">{{ state.mood === 'smile' ? '😊' : '😉' }}</button>
            </div>
            <div class="layer-panel">
              <div class="layer-title">当前造型 <small>点一下脱下</small></div>
              <div class="layer-list">
                <div v-for="c in CATEGORIES" :key="c.id" class="layer-row" :class="{ empty: !state.outfit[c.id] }">
                  <span class="layer-dot" :style="{ background: c.color }"></span>
                  <span class="layer-cat">{{ c.name }}</span>
                  <span class="layer-part">{{ state.outfit[c.id] ? PART_BY_ID.get(state.outfit[c.id])?.name : '未穿戴' }}</span>
                  <button v-if="state.outfit[c.id]" class="layer-x" @click="removeLayer(c.id)">×</button>
                </div>
              </div>
              <button class="btn soft w-full" @click="doRandom">🎲 随机搭一套</button>
            </div>
          </div>

          <div class="wardrobe-strip">
            <div class="strip-head">
              <div class="cat-tabs">
                <button
                  v-for="c in CATEGORIES" :key="c.id"
                  class="cat-tab" :class="{ active: activeCat === c.id }"
                  @click="activeCat = c.id; tick()"
                >
                  <span>{{ c.icon }}</span>{{ c.name }}
                </button>
              </div>
              <span class="strip-hint">{{ activeCatInfo?.name }} · 已解锁 {{ catParts.filter((p:any)=>unlockedSet.has(p.id)).length }}/{{ catParts.length }}</span>
            </div>
            <div class="part-grid">
              <button
                v-for="p in catParts" :key="p.id"
                class="part-card"
                :class="{ selected: equippedInCat === p.id, locked: !unlockedSet.has(p.id) }"
                :style="{ '--rar': RARITY[p.rarity].color }"
                @click="pickPart(p)"
                :title="p.name"
              >
                <span class="rar-badge">{{ RARITY[p.rarity].name }}</span>
                <div class="part-thumb" v-html="renderThumb(p, 'w'+p.id)"></div>
                <span class="part-name">{{ p.name }}</span>
                <span v-if="!unlockedSet.has(p.id)" class="lock">🔒</span>
              </button>
            </div>
          </div>

          <div class="scene-bar">
            <span class="scene-label">🏞️ 场景</span>
            <button
              v-for="s in SCENES" :key="s.id"
              class="scene-chip" :class="{ active: state.sceneId === s.id }"
              :style="{ background: s.color }"
              @click="chooseScene(s)"
            >{{ s.name }}</button>
            <button class="btn primary capture-btn" @click="doCapture">📷 拍照收藏</button>
          </div>
        </section>

        <!-- ============ 公主图鉴 ============ -->
        <section v-else-if="view === 'princesses'" class="view">
          <div class="view-head">
            <div><h2>👑 公主图鉴</h2><p>50 位公主，5 大主题，点一下就能请她来换装</p></div>
            <div class="filter-row">
              <button class="chip" :class="{ active: themeFilter === 'all' }" @click="themeFilter = 'all'; tick()">全部 50</button>
              <button v-for="t in THEMES" :key="t.id" class="chip" :class="{ active: themeFilter === t.id }" @click="themeFilter = t.id; tick()">
                {{ t.name }} 10
              </button>
            </div>
          </div>
          <div class="princess-grid">
            <button
              v-for="p in princessList" :key="p.id"
              class="princess-card" :class="{ current: state.princessId === p.id }"
              :style="{ '--theme': p.themeColor, '--soft': THEMES[p.theme].soft }"
              @click="choosePrincess(p)"
            >
              <div class="pc-avatar">
                <div v-html="renderFigure(p.outfit, p, null, { uid: 'pc'+p.id, showScene: false })"></div>
              </div>
              <div class="pc-name">{{ p.name }}</div>
              <div class="pc-theme">{{ p.themeName }}</div>
              <span v-if="state.princessId === p.id" class="pc-check">✓ 当前</span>
              <span v-else-if="!state.seenPrincesses.includes(p.id)" class="pc-new">NEW</span>
            </button>
          </div>
        </section>

        <!-- ============ 魔法衣柜 ============ -->
        <section v-else-if="view === 'wardrobe'" class="view">
          <div class="view-head">
            <div><h2>👗 魔法衣柜</h2><p>118 件独立精绘造型，件件都是不同的廓形与细节</p></div>
            <div class="filter-row">
              <button class="chip" :class="{ active: wardrobeCat === 'all' }" @click="wardrobeCat = 'all'; tick()">全部 118</button>
              <button v-for="c in CATEGORIES" :key="c.id" class="chip" :class="{ active: wardrobeCat === c.id }" @click="wardrobeCat = c.id; tick()">
                {{ c.icon }} {{ c.name }}
              </button>
            </div>
          </div>
          <div class="wardrobe-grid">
            <button
              v-for="p in wardrobeList" :key="p.id"
              class="wardrobe-card" :class="{ locked: !unlockedSet.has(p.id), worn: Object.values(state.outfit).includes(p.id) }"
              :style="{ '--rar': RARITY[p.rarity].color }"
              @click="pickPart(p)"
            >
              <div class="wc-thumb" v-html="renderThumb(p, 'g'+p.id)"></div>
              <div class="wc-meta">
                <b>{{ p.name }}</b>
                <small>{{ p.categoryName }} · <span :style="{color: RARITY[p.rarity].color}">{{ RARITY[p.rarity].name }}</span></small>
              </div>
              <span v-if="!unlockedSet.has(p.id)" class="wc-lock">🔒 {{ UNLOCK_COST[p.rarity] }}⭐</span>
              <span v-else-if="Object.values(state.outfit).includes(p.id)" class="wc-worn">穿着中</span>
            </button>
          </div>
        </section>

        <!-- ============ 套装任务 ============ -->
        <section v-else-if="view === 'quests'" class="view">
          <div class="view-head"><div><h2>🏅 套装任务</h2><p>凑齐同主题 4 件核心部件，领取星星大奖</p></div></div>
          <div class="quest-grid">
            <div v-for="set in progs" :key="set.id" class="quest-card" :style="{ '--set': set.color }">
              <div class="q-head">
                <span class="q-icon">💎</span>
                <div><b>{{ set.name }}</b><small>{{ set.themeName || set.theme }}</small></div>
                <span class="q-count">{{ set.have }}/{{ set.total }}</span>
              </div>
              <div class="q-parts">
                <div v-for="id in set.parts" :key="id" class="q-part" :class="{ got: Object.values(state.outfit).includes(id) }">
                  <div class="qp-thumb" v-html="renderThumb(PART_BY_ID.get(id), 'q'+id)"></div>
                  <span>{{ PART_BY_ID.get(id)?.name }}</span>
                </div>
              </div>
              <div class="q-bar"><div :style="{ width: (set.have / set.total * 100) + '%' }"></div></div>
              <button class="btn w-full" :class="set.done ? 'primary' : 'disabled'" :disabled="!set.done" @click="doClaim(set)">
                {{ set.done ? '🎉 领取 40 ⭐' : `还差 ${set.total - set.have} 件` }}
              </button>
            </div>
          </div>
        </section>

        <!-- ============ 幸运转盘 ============ -->
        <section v-else-if="view === 'spin'" class="view spin-view">
          <div class="view-head"><div><h2>🎡 幸运转盘</h2><p>首次免费，之后每次 15 ⭐，抽已解锁之外的造型</p></div></div>
          <div class="spin-stage">
            <div class="wheel" :class="{ spinning: spinning }">
              <div class="wheel-inner">
                <div v-for="(p, i) in PARTS.filter((x:any)=>!unlockedSet.has(x.id)).slice(0,8)" :key="p.id"
                  class="wheel-slice" :style="{ transform: `rotate(${i*45}deg)`, background: RARITY[p.rarity].color }">
                  <span>{{ p.icon || '🎁' }}</span>
                </div>
                <div v-for="i in 8" v-show="PARTS.filter((x:any)=>!unlockedSet.has(x.id)).length===0" :key="'e'+i"
                  class="wheel-slice" :style="{ transform: `rotate(${(i-1)*45}deg)`, background: ['#FF79B0','#FFD469','#8FD8FF','#B9A5FF','#8FE3C4'][i%5] }">
                  <span>⭐</span>
                </div>
              </div>
              <div class="wheel-pointer">▼</div>
              <button class="wheel-hub" @click="doSpin" :disabled="spinning">
                <span>{{ spinning ? '…' : 'GO' }}</span>
                <small>{{ spinCost(state) === 0 ? '免费' : spinCost(state) + '⭐' }}</small>
              </button>
            </div>
            <div class="spin-info">
              <h3>转出惊喜造型</h3>
              <p>转盘只会抽到<b>还没解锁</b>的部件，越稀有的越难抽到。</p>
              <div class="spin-tip">💡 攒够星星，把 118 件全部收集齐！</div>
              <div class="spin-count">已收集 <b>{{ st.partsOwned }}</b> / {{ st.partsTotal }} 件</div>
            </div>
          </div>
        </section>

        <!-- ============ 我的相册 ============ -->
        <section v-else-if="view === 'album'" class="view">
          <div class="view-head"><div><h2>📖 我的相册</h2><p>拍下最喜欢的造型，留住每一个漂亮的公主</p></div><span class="album-count">{{ photos.length }} 张照片</span></div>
          <div v-if="photos.length === 0" class="empty-state">
            <span>📷</span><h3>相册还空着呢</h3><p>去换装间搭配好造型，点「拍照收藏」吧</p>
            <button class="btn primary" @click="go('studio')">去换装</button>
          </div>
          <div v-else class="album-grid">
            <div v-for="photo in photos" :key="photo.id" class="album-card">
              <div class="al-figure" :style="{ background: (SCENE_BY_ID.get(photo.sceneId) || SCENES[0]).color }" v-html="renderFigure(photo.outfit, PRINCESS_BY_ID.get(photo.princessId) || PRINCESSES[0], photo.sceneId, { uid: 'al'+photo.id })"></div>
              <div class="al-name">{{ (PRINCESS_BY_ID.get(photo.princessId) || PRINCESSES[0]).name }}</div>
              <div class="al-date">{{ new Date(photo.createdAt).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) }}</div>
            </div>
          </div>
        </section>

        <!-- ============ 家长中心 ============ -->
        <section v-else-if="view === 'parents'" class="view parents-view">
          <div class="view-head"><div><h2>⚙️ 家长中心</h2><p>游戏进度概览与本地设置，所有数据仅保存在本机</p></div></div>
          <div class="parent-grid">
            <div class="panel-card">
              <h3>📊 收集进度</h3>
              <div class="pstat"><span>认识公主</span><b>{{ st.princessSeen }} / {{ st.princessTotal }}</b></div>
              <div class="pstat"><span>收集部件</span><b>{{ st.partsOwned }} / {{ st.partsTotal }}</b></div>
              <div class="pstat"><span>相册照片</span><b>{{ st.albumCount }}</b></div>
              <div class="pstat"><span>现有星星</span><b>{{ st.stars }} ⭐</b></div>
            </div>
            <div class="panel-card">
              <h3>💎 稀有度分布</h3>
              <div v-for="r in st.rarities" :key="r.id" class="rar-row">
                <span class="rar-dot" :style="{ background: r.color }"></span>
                <span>{{ r.name }}</span>
                <div class="rar-bar"><div :style="{ width: (r.owned / r.total * 100) + '%', background: r.color }"></div></div>
                <b>{{ r.owned }}/{{ r.total }}</b>
              </div>
            </div>
            <div class="panel-card">
              <h3>🛡️ 说明</h3>
              <ul class="parent-notes">
                <li>本游戏为离线单机，无需联网、无需登录。</li>
                <li>所有进度保存在本机浏览器中，不会上传。</li>
                <li>适合 3-8 岁儿童，无广告、无内购。</li>
                <li>部件与公主均为原创绘制的独立造型。</li>
              </ul>
            </div>
            <div class="panel-card audio-settings">
              <h3>🔊 声音设置</h3>
              <div class="audio-row">
                <span class="audio-label">🎵 背景音乐</span>
                <button class="switch" :class="{ on: audioState.musicOn }" role="switch" :aria-checked="audioState.musicOn" @click="toggleMusic"><i></i></button>
              </div>
              <div class="audio-row slider-row">
                <span class="audio-mini">音量</span>
                <input class="audio-slider" type="range" min="0" max="100" :value="Math.round(audioState.musicVol * 100)" @input="setMusicVol" :disabled="!audioState.musicOn" />
                <span class="audio-pct">{{ Math.round(audioState.musicVol * 100) }}%</span>
              </div>
              <div class="audio-row">
                <span class="audio-label">✨ 动作音效</span>
                <button class="switch" :class="{ on: audioState.sfxOn }" role="switch" :aria-checked="audioState.sfxOn" @click="toggleSfx"><i></i></button>
              </div>
              <div class="audio-row slider-row">
                <span class="audio-mini">音量</span>
                <input class="audio-slider" type="range" min="0" max="100" :value="Math.round(audioState.sfxVol * 100)" @input="setSfxVol" :disabled="!audioState.sfxOn" />
                <span class="audio-pct">{{ Math.round(audioState.sfxVol * 100) }}%</span>
              </div>
              <button class="btn soft w-full preview-btn" @click="previewMusic">▶ 试听一下</button>
            </div>
            <div class="panel-card">
              <h3>🔧 其他</h3>
              <button class="btn soft w-full" @click="toggleTheme">切换亮色 / 暗色</button>
              <button class="btn danger w-full" @click="resetGame">重置游戏进度</button>
            </div>
          </div>
        </section>
      </main>
    </div>

    <!-- 解锁确认弹窗 -->
    <div v-if="pendingUnlock" class="modal-mask" @click.self="pendingUnlock = null">
      <div class="modal">
        <span class="modal-icon">🔒</span>
        <h3>解锁「{{ pendingUnlock.name }}」</h3>
        <p>这是一件<span :style="{color: RARITY[pendingUnlock.rarity].color}">{{ RARITY[pendingUnlock.rarity].name }}</span>造型，解锁后即可自由穿戴。</p>
        <div class="modal-cost">需要 <b>{{ unlockCost }} ⭐</b> · 现有 {{ state.stars }} ⭐</div>
        <div class="modal-actions">
          <button class="btn ghost" @click="pendingUnlock = null">再想想</button>
          <button class="btn primary" @click="confirmUnlock">确认解锁</button>
        </div>
      </div>
    </div>

    <!-- 转盘结果弹窗 -->
    <div v-if="spinResult" class="modal-mask" @click.self="spinResult = null">
      <div class="modal result-modal">
        <div class="result-confetti">🎉</div>
        <h3>抽到了！</h3>
        <div class="result-thumb" v-html="renderThumb(spinResult, 'res')"></div>
        <p><b>{{ spinResult.name }}</b> · <span :style="{color: RARITY[spinResult.rarity].color}">{{ RARITY[spinResult.rarity].name }}</span></p>
        <div class="modal-actions">
          <button class="btn ghost" @click="spinResult = null">收下</button>
          <button class="btn primary" @click="wearResult">立即穿上</button>
        </div>
      </div>
    </div>

    <!-- 庆祝彩带 -->
    <div v-if="celebrating" class="confetti-layer">
      <span v-for="(c, i) in confetti" :key="i" :style="{ left: c.left, background: c.color, animationDelay: c.delay, transform: `rotate(${c.rotate})` }"></span>
    </div>

    <!-- 轻提示 -->
    <transition name="toast"><div v-if="toast" class="toast">{{ toast }}</div></transition>
  </div>
</template>
