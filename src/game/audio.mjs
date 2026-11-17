/**
 * 公主换装乐园 · 程序化音频引擎（高保真合成）
 *
 * 全部声音用 Web Audio API 实时合成，不加载任何外部音频文件 —— 插件保持离线自包含。
 * 音色设计：基于真实乐器的发声特征做加法合成，而非单振荡器提示音。
 *   - 八音盒/钢片琴：谐波列 + 高次泛音更快衰减 + 锤击瞬态 + 双段 ADSR
 *   - 铃铛：非谐波泛音列（钟形比例）+ 长衰减
 *   - 布料：带通扫频噪声模拟织物窸窣
 *   - 空间感：程序生成 impulse response 的卷积混响
 *   - 人性化：音高微漂移、力度与发声时长随机，避免机械重复
 *   - BGM：低音铺底 + 和弦根音，营造厚度
 *
 * 数据层（旋律 / 音效配方 / 设置规整）是纯函数，可在 Node 里单测。
 * 播放层懒创建 AudioContext，兼容浏览器 autoplay 策略（首次用户手势才出声）。
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
const rnd = (a, b) => a + Math.random() * (b - a);

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
 * 三首童谣风旋律轮换，结构短小、无半音碰撞，适合 3-8 岁。
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
 *   { f: 起始频率, d: 时长(秒), g: 增益, at: 相对起始偏移(秒), t: 波形, glide?: 结束频率(滑音), v?: 音色 }
 *   noise 声: { noise: true, d, g, at, hp: 高通频率, v?: 音色 }
 * v 音色：mallet 八音盒 / bell 铃铛 / wood 木琴 / soft 柔和 / cloth 布料(仅 noise)
 */
const T = (f, d, g = 0.5, at = 0, t = 'triangle', glide, v) => ({ f, d, g, at, t, ...(glide ? { glide } : {}), ...(v ? { v } : {}) });
const N = (d, g = 0.3, at = 0, hp = 1800, v) => ({ noise: true, d, g, at, hp, ...(v ? { v } : {}) });

export const SFX_RECIPES = {
  // 通用 UI 点击：短促木琴
  click: [T(784, 0.12, 0.42, 0, 'triangle', null, 'wood')],
  // 切换分类 / 标签：轻快两音上行
  tab: [T(659, 0.12, 0.38, 0, 'triangle', null, 'wood'), T(880, 0.14, 0.38, 0.06, 'triangle', null, 'wood')],
  // 开关切换
  toggle: [T(880, 0.16, 0.4, 0, 'sine', null, 'soft')],
  // 换上部件：布料窸窣 + 三音上行琶音（穿衣服的动作感）
  equip: [N(0.12, 0.16, 0, 1600, 'cloth'), T(523, 0.2, 0.4, 0.02, 'triangle', null, 'mallet'), T(659, 0.2, 0.4, 0.1, 'triangle', null, 'mallet'), T(784, 0.3, 0.42, 0.18, 'triangle', null, 'mallet')],
  // 脱下部件：柔和下行
  remove: [T(659, 0.18, 0.34, 0, 'sine', null, 'soft'), T(523, 0.22, 0.3, 0.09, 'sine', null, 'soft')],
  // 解锁成功：闪亮上行琶音 + 铃铛尾音
  unlock: [T(523, 0.16, 0.4, 0, 'triangle', null, 'mallet'), T(659, 0.16, 0.4, 0.08, 'triangle', null, 'mallet'), T(784, 0.16, 0.4, 0.16, 'triangle', null, 'mallet'), T(1047, 0.24, 0.42, 0.24, 'triangle', null, 'mallet'), T(1568, 0.5, 0.3, 0.32, 'sine', null, 'bell')],
  // 获得星星：清脆铃铛双叮
  star: [T(1568, 0.4, 0.34, 0, 'sine', null, 'bell'), T(2093, 0.5, 0.3, 0.11, 'sine', null, 'bell')],
  // 拍照：机械快门咔嚓（双脉冲噪声）+ 铃铛完成音
  capture: [N(0.05, 0.3, 0, 2800, 'click'), N(0.05, 0.28, 0.07, 2200, 'click'), T(1319, 0.35, 0.3, 0.14, 'sine', null, 'bell')],
  // 转盘单次滴答：木琴短促
  spin: [T(880, 0.08, 0.3, 0, 'triangle', null, 'wood')],
  // 中奖 / 套装庆祝：欢快琶音 + 铃铛尾音
  win: [T(523, 0.16, 0.42, 0, 'triangle', null, 'mallet'), T(659, 0.16, 0.42, 0.1, 'triangle', null, 'mallet'), T(784, 0.16, 0.42, 0.2, 'triangle', null, 'mallet'), T(1047, 0.2, 0.44, 0.3, 'triangle', null, 'mallet'), T(1319, 0.26, 0.4, 0.42, 'triangle', null, 'mallet'), T(1568, 0.6, 0.32, 0.56, 'sine', null, 'bell')],
  // 切换场景：柔和滑音
  scene: [T(523, 0.34, 0.32, 0, 'sine', 784, 'soft')],
  // 不可操作 / 星星不足：柔和低沉两音（儿童向不刺耳）
  error: [T(392, 0.2, 0.3, 0, 'sine', null, 'soft'), T(349, 0.28, 0.28, 0.13, 'sine', null, 'soft')],
  // 欢迎 / 选中公主
  hello: [T(659, 0.16, 0.36, 0, 'triangle', null, 'mallet'), T(880, 0.16, 0.36, 0.1, 'triangle', null, 'mallet'), T(1047, 0.34, 0.36, 0.2, 'triangle', null, 'mallet')],
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

// 真实乐器泛音结构（比例 + 相对增益 + 相对衰减长度）
const MALLET_PARTIALS = [
  { r: 1, g: 1, d: 1 }, { r: 2.01, g: 0.5, d: 0.62 },
  { r: 3.02, g: 0.27, d: 0.42 }, { r: 4.17, g: 0.13, d: 0.28 },
  { r: 5.43, g: 0.07, d: 0.2 },
];
const WOOD_PARTIALS = [
  { r: 1, g: 1, d: 1 }, { r: 2.76, g: 0.32, d: 0.4 }, { r: 5.4, g: 0.12, d: 0.22 },
];
const BELL_PARTIALS = [
  { r: 0.5, g: 0.3, d: 1.1 }, { r: 1, g: 1, d: 1 }, { r: 1.2, g: 0.55, d: 0.85 },
  { r: 1.56, g: 0.4, d: 0.7 }, { r: 2, g: 0.48, d: 0.55 }, { r: 2.66, g: 0.22, d: 0.4 },
  { r: 3.01, g: 0.16, d: 0.32 }, { r: 4.16, g: 0.09, d: 0.25 },
];
// C 大调正向进行根音（低八度铺底）：C3 G3 A3 F3
const BASS_ROOTS = [48, 55, 57, 53];

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
    this.convolver = null;
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
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // 卷积混响：程序生成 impulse response，营造柔和空间感（八音盒在城堡里的余韵）
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this._makeImpulse(1.9, 2.8);
    const revWet = ctx.createGain();
    revWet.gain.value = 0.24;
    this.convolver.connect(revWet);
    revWet.connect(this.master);

    // 音乐总线：低通柔化 + 混响 send + 极轻早期反射延迟
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.settings.musicOn ? this.settings.musicVol : 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    this.musicBus.connect(lp);
    lp.connect(this.master);
    const musicSend = ctx.createGain();
    musicSend.gain.value = 0.34;
    lp.connect(musicSend);
    musicSend.connect(this.convolver);
    const delay = ctx.createDelay(0.4);
    delay.delayTime.value = 0.16;
    const fb = ctx.createGain();
    fb.gain.value = 0.16;
    const dWet = ctx.createGain();
    dWet.gain.value = 0.1;
    lp.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(dWet); dWet.connect(this.master);

    // 音效总线：轻混响 send，保持清晰但有空间
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfxOn ? this.settings.sfxVol : 0;
    this.sfxBus.connect(this.master);
    const sfxSend = ctx.createGain();
    sfxSend.gain.value = 0.12;
    this.sfxBus.connect(sfxSend);
    sfxSend.connect(this.convolver);

    // 预生成白噪声 buffer 供快门/布料/瞬态复用（0.6s，足够扫频）
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  /** 生成卷积混响用的 impulse response（指数衰减噪声 + 稀疏早期反射） */
  _makeImpulse(seconds = 1.8, decay = 2.6) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
    }
    return buf;
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
      else this._tone(tone, base, this.sfxBus, rnd(0.92, 1.08));
    }
  }

  /**
   * 单个音符入口：按音色分派到不同的加法合成器。
   * 所有音色都带人性化微扰（音高 ±0.3%、力度随机），避免电子琴般的机械重复。
   */
  _tone(tone, base, dest, velocity = 1) {
    const ctx = this.ctx;
    if (!ctx || !dest) return;
    const t0 = base + (tone.at || 0);
    const dur = tone.d || 0.2;
    const peak = clamp((tone.g ?? 0.4) * velocity, 0.0002, 1);
    const voice = tone.v || (tone.t === 'sine' ? 'soft' : tone.t === 'square' ? 'wood' : 'mallet');

    if (voice === 'bell') this._partialTone(t0, tone.f, dur, peak, dest, BELL_PARTIALS, 0.014, 'sine');
    else if (voice === 'wood') {
      this._partialTone(t0, tone.f, dur, peak, dest, WOOD_PARTIALS, 0.003, 'sine');
      this._transient(t0, 0.012, peak * 0.35, dest, 2600);
    } else if (voice === 'soft') this._soft(t0, tone.f, dur, peak, dest, tone.glide);
    else this._mallet(t0, tone.f, dur, peak, dest); // mallet（含默认）
  }

  /** 加法合成：按泛音结构叠加正弦分音，高次泛音衰减更快 —— 真实金属/木质乐器特征 */
  _partialTone(t0, freq, dur, peak, dest, partials, attack, type = 'sine') {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(dest);
    const detune = rnd(0.997, 1.003); // 整音人性化漂移
    for (let i = 0; i < partials.length; i++) {
      const p = partials[i];
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * p.r * detune * (1 + (i > 0 ? rnd(-0.0015, 0.0015) : 0)), t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.g, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur * p.d));
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }

  /** 八音盒/钢片琴音色：谐波列 + 锤击瞬态 + 双段衰减 */
  _mallet(t0, freq, dur, peak, dest) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const a = 0.004;
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(peak, t0 + a);
    // 双段衰减：先快后慢，模拟金属片被敲击后的余振
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.3), t0 + Math.min(dur * 0.32, 0.2));
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    out.connect(dest);
    const detune = rnd(0.997, 1.003);
    for (let i = 0; i < MALLET_PARTIALS.length; i++) {
      const p = MALLET_PARTIALS[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * p.r * detune, t0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.g, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.03, dur * p.d));
      osc.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
    // 锤击瞬态：极短高通噪声，模拟拨片/小锤触弦的一瞬间
    this._transient(t0, 0.008, peak * 0.28, dest, 3000);
  }

  /** 柔和音色：正弦基音 + 轻二次泛音，慢起音，用于滑音/提示 */
  _soft(t0, freq, dur, peak, dest, glide) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t0 + dur * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.03);
    g.gain.setValueAtTime(peak * 0.85, t0 + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    const ov = ctx.createOscillator();
    const og = ctx.createGain();
    ov.type = 'sine';
    ov.frequency.value = freq * 2;
    og.gain.value = peak * 0.14;
    ov.connect(og);
    og.connect(dest);
    ov.start(t0);
    ov.stop(t0 + dur + 0.02);
  }

  /** 低音铺底：柔和正弦，长起音长衰减，营造和声厚度 */
  _bass(t0, freq, dur, peak, dest) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    osc.connect(lp);
    lp.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** 极短噪声瞬态（锤击 / 快门） */
  _transient(t0, dur, peak, dest, hp = 2000) {
    const ctx = this.ctx;
    if (!this.noiseBuffer || !dest) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, peak), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  /** 噪声类音效：cloth 带通扫频（织物窸窣），其余为高通瞬态（快门咔嚓） */
  _noise(tone, base) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuffer || !this.sfxBus) return;
    const t0 = base + (tone.at || 0);
    const dur = tone.d || 0.06;
    const peak = clamp(tone.g ?? 0.3, 0.0002, 1);
    if (tone.v === 'cloth') {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 0.85;
      bp.frequency.setValueAtTime(900, t0);
      bp.frequency.exponentialRampToValueAtTime(2200, t0 + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(700, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + dur * 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.sfxBus);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
      return;
    }
    // 快门/咔嚓：两个紧邻的高通噪声脉冲
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = tone.hp || 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
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

  /** lookahead 调度：提前 0.18s 排音符 + 低音铺底 + 人性化发声 */
  _tick() {
    if (!this.ctx || !this.playing) return;
    const melody = MELODIES[this.melodyIndex % MELODIES.length];
    const beat = 60 / melody.bpm;
    const ahead = this.ctx.currentTime + 0.18;
    while (this.nextNoteTime < ahead) {
      const note = melody.notes[this.noteIndex % melody.notes.length];
      if (note.m > 0) {
        // 人性化：力度与发声时长轻微随机，音高由 _mallet 内部微漂移
        const vel = rnd(0.86, 1.0);
        const len = beat * note.d * rnd(1.05, 1.35); // 略微重叠，更连贯
        this._mallet(this.nextNoteTime, midiToFreq(note.m), len, 0.32 * vel, this.musicBus);
      }
      // 每 8 个音符换一次和弦根音，铺一层低音（长音、轻）
      if (this.noteIndex % 8 === 0 && note.m > 0) {
        const root = BASS_ROOTS[Math.floor(this.noteIndex / 8) % BASS_ROOTS.length];
        this._bass(this.nextNoteTime, midiToFreq(root), beat * 3.6, 0.09, this.musicBus);
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
