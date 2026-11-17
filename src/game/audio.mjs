/**
 * 公主换装乐园 · 程序化音频引擎
 *
 * 全部声音用 Web Audio API 实时合成，不加载任何外部音频文件 —— 插件保持离线自包含。
 * - 数据层（旋律 / 音效配方 / 设置规整）是纯函数，可在 Node 里单测。
 * - 播放层懒创建 AudioContext，兼容浏览器 autoplay 策略（首次用户手势才出声）。
 */

export const AUDIO_SAVE_KEY = 'otools-princess:audio:v1';

export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicOn: true,
  sfxOn: true,
  musicVol: 0.32,
  sfxVol: 0.6,
});

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, fallback) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 把任意来源（localStorage / 宿主注入）的设置规整为合法值 */
export function normalizeAudioSettings(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    musicOn: typeof r.musicOn === 'boolean' ? r.musicOn : DEFAULT_AUDIO_SETTINGS.musicOn,
    sfxOn: typeof r.sfxOn === 'boolean' ? r.sfxOn : DEFAULT_AUDIO_SETTINGS.sfxOn,
    musicVol: clamp(num(r.musicVol, DEFAULT_AUDIO_SETTINGS.musicVol), 0, 1),
    sfxVol: clamp(num(r.sfxVol, DEFAULT_AUDIO_SETTINGS.sfxVol), 0, 1),
  };
}

/** MIDI 音高 → 频率（A4=69 → 440Hz） */
export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

/**
 * BGM 旋律库。note: { m: MIDI 音高（0=休止）, d: 拍数 }。
 * 三首童谣风旋律轮换，八音盒音色；结构短小、无半音碰撞，适合 3-8 岁。
 */
export const MELODIES = [
  {
    id: 'castle',
    name: '城堡摇篮曲',
    bpm: 92,
    notes: [
      { m: 72, d: 1 }, { m: 76, d: 0.5 }, { m: 79, d: 0.5 }, { m: 76, d: 1 },
      { m: 77, d: 1 }, { m: 81, d: 0.5 }, { m: 79, d: 0.5 }, { m: 76, d: 1 },
      { m: 74, d: 1 }, { m: 77, d: 0.5 }, { m: 81, d: 0.5 }, { m: 77, d: 1 },
      { m: 76, d: 1 }, { m: 79, d: 0.5 }, { m: 84, d: 0.5 }, { m: 0, d: 1 },
      { m: 72, d: 1 }, { m: 76, d: 0.5 }, { m: 79, d: 0.5 }, { m: 84, d: 1 },
      { m: 83, d: 1 }, { m: 81, d: 0.5 }, { m: 79, d: 0.5 }, { m: 76, d: 1 },
      { m: 77, d: 1 }, { m: 81, d: 0.5 }, { m: 79, d: 0.5 }, { m: 77, d: 1 },
      { m: 76, d: 1 }, { m: 74, d: 0.5 }, { m: 72, d: 0.5 }, { m: 0, d: 1 },
    ],
  },
  {
    id: 'starlight',
    name: '星光舞会',
    bpm: 112,
    notes: [
      { m: 77, d: 0.5 }, { m: 81, d: 0.5 }, { m: 84, d: 0.5 }, { m: 81, d: 0.5 },
      { m: 79, d: 0.5 }, { m: 81, d: 0.5 }, { m: 79, d: 0.5 }, { m: 77, d: 0.5 },
      { m: 76, d: 0.5 }, { m: 79, d: 0.5 }, { m: 84, d: 0.5 }, { m: 79, d: 0.5 },
      { m: 81, d: 1 }, { m: 77, d: 0.5 }, { m: 77, d: 0.5 },
      { m: 77, d: 0.5 }, { m: 81, d: 0.5 }, { m: 84, d: 0.5 }, { m: 86, d: 0.5 },
      { m: 84, d: 0.5 }, { m: 81, d: 0.5 }, { m: 79, d: 0.5 }, { m: 77, d: 0.5 },
      { m: 76, d: 0.5 }, { m: 79, d: 0.5 }, { m: 81, d: 0.5 }, { m: 84, d: 0.5 },
      { m: 81, d: 1 }, { m: 79, d: 0.5 }, { m: 77, d: 0.5 }, { m: 0, d: 1 },
    ],
  },
  {
    id: 'teaparty',
    name: '茶会圆舞曲',
    bpm: 104,
    notes: [
      { m: 72, d: 1 }, { m: 76, d: 0.5 }, { m: 79, d: 0.5 },
      { m: 84, d: 1 }, { m: 83, d: 0.5 }, { m: 81, d: 0.5 },
      { m: 77, d: 1 }, { m: 81, d: 0.5 }, { m: 86, d: 0.5 },
      { m: 79, d: 1.5 }, { m: 0, d: 0.5 },
      { m: 72, d: 1 }, { m: 77, d: 0.5 }, { m: 81, d: 0.5 },
      { m: 84, d: 1 }, { m: 86, d: 0.5 }, { m: 84, d: 0.5 },
      { m: 83, d: 1 }, { m: 79, d: 0.5 }, { m: 76, d: 0.5 },
      { m: 77, d: 1.5 }, { m: 0, d: 0.5 },
    ],
  },
];

/**
 * 音效配方。每个音效由若干 tone 组成：
 *   { f: 起始频率, d: 时长(秒), t: 波形, g: 增益, at: 相对起始偏移(秒), glide?: 结束频率(滑音) }
 *   noise 声: { noise: true, d, g, at, hp: 高通频率 }
 */
const T = (f, d, g = 0.5, at = 0, t = 'triangle', glide) => ({ f, d, g, at, t, ...(glide ? { glide } : {}) });
const N = (d, g = 0.3, at = 0, hp = 1800) => ({ noise: true, d, g, at, hp });

export const SFX_RECIPES = {
  // 通用 UI 点击：木琴单音
  click: [T(784, 0.09, 0.42, 0, 'triangle')],
  // 切换分类 / 标签：轻快两音上行
  tab: [T(659, 0.07, 0.38, 0, 'triangle'), T(880, 0.09, 0.38, 0.06, 'triangle')],
  // 开关切换
  toggle: [T(880, 0.1, 0.4, 0, 'sine')],
  // 换上部件：布料窸窣 + 三音上行琶音（穿衣服的动作感）
  equip: [N(0.07, 0.12, 0, 2600), T(523, 0.12, 0.4, 0.02, 'triangle'), T(659, 0.12, 0.4, 0.1, 'triangle'), T(784, 0.16, 0.42, 0.18, 'triangle')],
  // 脱下部件：柔和下行
  remove: [T(659, 0.12, 0.34, 0, 'triangle'), T(523, 0.14, 0.3, 0.09, 'triangle')],
  // 解锁成功：闪亮上行琶音 + 高频叮
  unlock: [T(523, 0.1, 0.4, 0, 'triangle'), T(659, 0.1, 0.4, 0.08, 'triangle'), T(784, 0.1, 0.4, 0.16, 'triangle'), T(1047, 0.14, 0.42, 0.24, 'triangle'), T(1568, 0.28, 0.3, 0.32, 'sine')],
  // 获得星星：清脆双叮
  star: [T(1568, 0.14, 0.34, 0, 'sine'), T(2093, 0.2, 0.3, 0.09, 'sine')],
  // 拍照：咔嚓（噪声）+ 高频完成音
  capture: [N(0.05, 0.34, 0, 3200), N(0.05, 0.28, 0.08, 2400), T(1319, 0.16, 0.32, 0.14, 'sine')],
  // 转盘单次滴答
  spin: [T(880, 0.04, 0.3, 0, 'square')],
  // 中奖 / 套装庆祝：欢快琶音 + 尾音
  win: [T(523, 0.12, 0.42, 0, 'triangle'), T(659, 0.12, 0.42, 0.1, 'triangle'), T(784, 0.12, 0.42, 0.2, 'triangle'), T(1047, 0.14, 0.44, 0.3, 'triangle'), T(1319, 0.18, 0.4, 0.42, 'triangle'), T(1568, 0.34, 0.32, 0.56, 'sine')],
  // 切换场景：柔和滑音
  scene: [T(523, 0.28, 0.32, 0, 'sine', 784)],
  // 不可操作 / 星星不足：柔和低沉两音（儿童向不刺耳）
  error: [T(392, 0.16, 0.3, 0, 'sine'), T(349, 0.22, 0.28, 0.13, 'sine')],
  // 欢迎 / 选中公主
  hello: [T(659, 0.12, 0.36, 0, 'triangle'), T(880, 0.12, 0.36, 0.1, 'triangle'), T(1047, 0.22, 0.36, 0.2, 'triangle')],
};

export const SFX_NAMES = Object.keys(SFX_RECIPES);

/** 节点名 → 建议音效（供 UI 层做语义化映射参考） */
export function sfxForAction(action) {
  const map = {
    pickPart: 'equip', confirmUnlock: 'unlock', removeLayer: 'remove',
    choosePrincess: 'hello', doRandom: 'win', toggleMood: 'toggle',
    doCapture: 'capture', chooseScene: 'scene', doClaim: 'win',
    doSpin: 'star', wearResult: 'equip', celebrate: 'win',
  };
  return map[action] || 'click';
}

/* ============================ 播放层（浏览器） ============================ */

const hasBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * 程序化音频引擎。构造不创建 AudioContext；首次 unlock()（用户手势）才初始化。
 * 所有方法在无浏览器环境安全空转，便于 SSR / 单测 import。
 */
export class AudioEngine {
  constructor(settings) {
    this.settings = normalizeAudioSettings(settings);
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.timer = null;
    this.playing = false;
    this.melodyIndex = 0;
    this.noteIndex = 0;
    this.nextNoteTime = 0;
    this.noiseBuffer = null;
    this._onVisibility = null;
  }

  /** 首次用户手势调用：创建并恢复 AudioContext */
  unlock() {
    if (!hasBrowser()) return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch { return; }
      this._buildGraph();
      this._installVisibility();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.settings.musicOn) this.startMusic();
  }

  _buildGraph() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // 音乐总线：低通柔化 + 短延迟混响感，八音盒更圆润
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.settings.musicOn ? this.settings.musicVol : 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 4200;
    this.musicBus.connect(lp);
    lp.connect(this.master);

    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.18;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.16;
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master);

    // 音效总线：不加混响，保持清脆
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfxOn ? this.settings.sfxVol : 0;
    this.sfxBus.connect(this.master);

    // 预生成一小段白噪声 buffer 供咔嚓/窸窣复用
    const len = Math.floor(ctx.sampleRate * 0.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  _installVisibility() {
    if (this._onVisibility || !hasBrowser()) return;
    this._onVisibility = () => {
      if (!this.ctx) return;
      if (document.hidden) {
        if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
        if (this.settings.musicOn && !this.playing) this.startMusic();
      }
    };
    document.addEventListener('visibilitychange', this._onVisibility);
  }

  /** 应用新设置（开关 / 音量），立即生效并持久化由 UI 层负责 */
  applySettings(next) {
    this.settings = normalizeAudioSettings(next);
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.settings.musicOn ? this.settings.musicVol : 0, t, 0.04);
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(this.settings.sfxOn ? this.settings.sfxVol : 0, t, 0.04);
    if (this.settings.musicOn) this.startMusic(); else this.stopMusic();
  }

  /** 播放一个音效名；未知名字安全回退到 click */
  play(name) {
    if (!this.ctx || !this.settings.sfxOn) return;
    const recipe = SFX_RECIPES[name] || SFX_RECIPES.click;
    const base = this.ctx.currentTime;
    for (const tone of recipe) {
      if (tone.noise) this._noise(tone, base);
      else this._tone(tone, base, this.sfxBus, 1);
    }
  }

  /** 单个音符：sine 基音 + triangle 泛音，ADSR 包络 */
  _tone(tone, base, dest, velocity = 0.8) {
    const ctx = this.ctx;
    if (!ctx || !dest) return;
    const t0 = base + (tone.at || 0);
    const dur = tone.d || 0.2;
    const peak = clamp((tone.g ?? 0.4) * velocity, 0, 1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(dest);

    const osc = ctx.createOscillator();
    osc.type = tone.t || 'triangle';
    osc.frequency.setValueAtTime(tone.f, t0);
    if (tone.glide) osc.frequency.exponentialRampToValueAtTime(tone.glide, t0 + dur * 0.9);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);

    // 高一个八度的轻泛音，增加八音盒的通透感（滑音音效不加，避免音色打架）
    if (!tone.glide && peak > 0.2) {
      const ov = ctx.createOscillator();
      const og = ctx.createGain();
      ov.type = 'sine';
      ov.frequency.value = tone.f * 2;
      og.gain.value = peak * 0.18;
      ov.connect(og); og.connect(dest);
      ov.start(t0); ov.stop(t0 + dur + 0.03);
    }
  }

  _noise(tone, base) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.sfxBus) return;
    const t0 = base + (tone.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = tone.hp || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(clamp(tone.g ?? 0.3, 0, 1), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (tone.d || 0.06));
    src.connect(hp); hp.connect(g); g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + (tone.d || 0.06) + 0.02);
  }

  startMusic() {
    if (!this.ctx || this.playing || !this.settings.musicOn) return;
    this.playing = true;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.noteIndex = 0;
    this._tick();
    this.timer = setInterval(() => this._tick(), 60);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  /** lookahead 调度：提前 0.18s 排音符，避免 setInterval 抖动造成节奏不稳 */
  _tick() {
    if (!this.ctx || !this.playing) return;
    const melody = MELODIES[this.melodyIndex % MELODIES.length];
    const beat = 60 / melody.bpm;
    const ahead = this.ctx.currentTime + 0.18;
    while (this.nextNoteTime < ahead) {
      const note = melody.notes[this.noteIndex % melody.notes.length];
      if (note.m > 0) {
        this._tone({ f: midiToFreq(note.m), d: beat * note.d * 0.92, g: 0.34, t: 'triangle' }, this.nextNoteTime, this.musicBus, 0.85);
      }
      this.nextNoteTime += beat * note.d;
      this.noteIndex++;
      if (this.noteIndex >= melody.notes.length) {
        this.noteIndex = 0;
        this.melodyIndex = (this.melodyIndex + 1) % MELODIES.length;
      }
    }
  }

  dispose() {
    this.stopMusic();
    if (this._onVisibility && hasBrowser()) document.removeEventListener('visibilitychange', this._onVisibility);
    this._onVisibility = null;
    if (this.ctx) this.ctx.close().catch(() => {});
    this.ctx = null;
  }
}

/** 工厂：从 localStorage 读取设置并创建引擎（不初始化音频上下文） */
export function createAudioEngine() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(AUDIO_SAVE_KEY) || 'null'); } catch { /* ignore */ }
  return new AudioEngine(normalizeAudioSettings(saved));
}

/** 保存设置到 localStorage */
export function saveAudioSettings(settings) {
  const clean = normalizeAudioSettings(settings);
  try { localStorage.setItem(AUDIO_SAVE_KEY, JSON.stringify(clean)); } catch { /* ignore */ }
  return clean;
}
