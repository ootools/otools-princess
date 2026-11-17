/**
 * 公主换装乐园 · 分层 SVG 渲染引擎（纯 JS / ESM）
 * ------------------------------------------------------------------
 * 给定一套搭配（每类选中的部件）+ 公主肤色，拼出一整张立绘 SVG。
 * 每个部件按 variant 绘制**不同的廓形**（不是同一件换色）：
 * 裙摆、袖型、领口、发式、道具各有独立 path。
 * viewBox 固定 400×520，人物居中。
 */

import { PART_BY_ID, SCENE_BY_ID, THEMES } from './data.mjs';

/* ----------------------------- 颜色工具 ----------------------------- */
function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function parseHex(hex) {
  const s = String(hex || '#cccccc').replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const v = parseInt(full, 16);
  if (Number.isNaN(v)) return { r: 204, g: 204, b: 204 };
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
function toHex({ r, g, b }) { return `#${[r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('')}`; }
export function lighten(hex, amt = 0.18) {
  const { r, g, b } = parseHex(hex);
  return toHex({ r: r + (255 - r) * amt, g: g + (255 - g) * amt, b: b + (255 - b) * amt });
}
export function darken(hex, amt = 0.16) {
  const { r, g, b } = parseHex(hex);
  return toHex({ r: r * (1 - amt), g: g * (1 - amt), b: b * (1 - amt) });
}

/* ----------------------------- 通用装饰 ----------------------------- */
function bow(x, y, color, s = 1) {
  const d = darken(color, 0.18), l = lighten(color, 0.35);
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M0 0 C-18 -16 -34 -10 -32 4 C-30 16 -12 12 0 3Z" fill="${color}" stroke="${d}" stroke-width="1.5"/>
    <path d="M0 0 C18 -16 34 -10 32 4 C30 16 12 12 0 3Z" fill="${color}" stroke="${d}" stroke-width="1.5"/>
    <ellipse cx="-16" cy="0" rx="6" ry="8" fill="${l}" opacity=".55"/>
    <ellipse cx="16" cy="0" rx="6" ry="8" fill="${l}" opacity=".55"/>
    <circle cx="0" cy="2" r="6" fill="${d}"/><circle cx="0" cy="1" r="3.4" fill="${l}"/>
  </g>`;
}
function gem(x, y, color, r = 7) {
  return `<g transform="translate(${x} ${y})"><path d="M0 ${-r} L${r} 0 L0 ${r} L${-r} 0Z" fill="${color}" stroke="#fff" stroke-width="1.4"/><path d="M0 ${-r} L0 ${r} M${-r} 0 L${r} 0" stroke="#fff" stroke-width=".8" opacity=".6"/></g>`;
}
function star(x, y, color, r = 8) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const ang = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(Math.cos(ang) * rad).toFixed(1)},${(Math.sin(ang) * rad).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" transform="translate(${x} ${y})" fill="${color}" stroke="#fff" stroke-width="1.2"/>`;
}
function pearlStrand(cx, cy, rx, ry, color = '#FFF6FA', count = 9) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const t = Math.PI * (i / (count - 1));
    const x = cx - Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="${color}" stroke="${darken(color, 0.15)}" stroke-width=".8"/>`;
  }
  return s;
}

/* =========================== 图层绘制函数 =========================== */

/** 场景背景 */
function drawScene(sceneId, uid) {
  const scene = SCENE_BY_ID.get(sceneId);
  const v = scene?.variant || 'castle';
  const base = scene?.color || '#FCE6F0';
  let decor = '';
  switch (v) {
    case 'castle':
      decor = `<path d="M40 400 L40 250 L70 250 L70 220 L92 220 L92 250 L116 250 L116 200 L140 200 L140 250 L164 250 L164 224 L186 224 L186 250 L210 250 L210 270 L40 270Z" fill="#F6D0DF" opacity=".55"/>
        <path d="M300 410 L300 260 L324 260 L324 232 L344 232 L344 260 L366 260 L366 214 L388 214 L388 410Z" fill="#EFCFDA" opacity=".5"/>`;
      break;
    case 'sakura':
      decor = `<path d="M0 120 Q100 150 200 118 T400 126" fill="none" stroke="#F6BFD2" stroke-width="16" opacity=".5"/>` +
        [50, 110, 175, 240, 310, 370].map((x, i) => `<flower/>`).join('').replace(/<flower\/>/g, '') +
        [46, 108, 176, 246, 312, 372].map((x, i) => star(x, 150 + (i % 3) * 30, '#F7C6D9', 9)).join('');
      break;
    case 'star': case 'moon':
      decor = [[50, 90, 8], [110, 60, 5], [350, 100, 9], [300, 70, 5], [70, 200, 6], [360, 220, 7]]
        .map(([x, y, r]) => star(x, y, '#D9C8FF', r)).join('') +
        `<circle cx="340" cy="150" r="30" fill="#FFF3C4" opacity=".8"/>`;
      break;
    case 'beach': case 'ocean':
      decor = `<path d="M0 380 Q100 360 200 382 T400 378 L400 520 L0 520Z" fill="#BFE8EF" opacity=".7"/>
        <circle cx="330" cy="100" r="26" fill="#FFE6A6" opacity=".9"/>`;
      break;
    case 'forest': case 'tea':
      decor = `<path d="M0 430 Q60 380 120 430 T240 430 T400 430 L400 520 L0 520Z" fill="#CDEBD6" opacity=".7"/>` +
        [[40, 400], [360, 410], [90, 440]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="26" fill="#A8DBBC" opacity=".7"/>`).join('');
      break;
    case 'ice': case 'cloud':
      decor = [[60, 130, 34], [330, 90, 40], [280, 180, 24]].map(([x, y, r]) =>
        `<g opacity=".6"><circle cx="${x}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x + r * 0.7}" cy="${y + 6}" r="${r * 0.8}" fill="#fff"/></g>`).join('');
      break;
    case 'candy': case 'pumpkin':
      decor = [[46, 90], [360, 110], [300, 60], [90, 180]].map(([x, y]) => star(x, y, '#F7C7DD', 10)).join('');
      break;
    default:
      decor = [[60, 100], [340, 90], [300, 180]].map(([x, y]) => star(x, y, '#F3D9EA', 9)).join('');
  }
  return `<rect x="0" y="0" width="400" height="520" fill="${base}"/>
    <ellipse cx="200" cy="500" rx="150" ry="20" fill="#B98AA8" opacity=".13"/>
    ${decor}`;
}

/** 翅膀 / 宠物（身后） */
function drawWingsBack(part, uid) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.3), d = darken(c, 0.2);
  switch (part.variant) {
    case 'butterfly':
      return `<g><path d="M200 300 C120 210 60 240 74 320 C88 392 150 360 200 320Z" fill="${c}" opacity=".85" stroke="${d}" stroke-width="2"/>
        <path d="M200 300 C280 210 340 240 326 320 C312 392 250 360 200 320Z" fill="${c}" opacity=".85" stroke="${d}" stroke-width="2"/>
        <ellipse cx="130" cy="300" rx="22" ry="28" fill="${l}" opacity=".7"/><ellipse cx="270" cy="300" rx="22" ry="28" fill="${l}" opacity=".7"/></g>`;
    case 'angel':
      return `<g><path d="M198 310 C140 240 92 250 80 300 C70 344 110 356 150 340 C120 366 150 386 196 344Z" fill="#FFFDF8" stroke="#EADFCB" stroke-width="2"/>
        <path d="M202 310 C260 240 308 250 320 300 C330 344 290 356 250 340 C280 366 250 386 204 344Z" fill="#FFFDF8" stroke="#EADFCB" stroke-width="2"/>
        <path d="M198 310 C150 268 110 278 100 310" fill="none" stroke="#EFE4D2" stroke-width="2"/></g>`;
    case 'fairy':
      return `<g><path d="M198 312 C130 250 96 276 104 330 C112 372 160 356 198 326Z" fill="${c}" opacity=".7" stroke="${d}" stroke-width="1.6"/>
        <path d="M202 312 C270 250 304 276 296 330 C288 372 240 356 202 326Z" fill="${c}" opacity=".7" stroke="${d}" stroke-width="1.6"/>
        <path d="M198 320 L120 320 M202 320 L280 320" stroke="${l}" stroke-width="1.4"/></g>`;
    case 'star':
      return `<g>${[[130, 280, 20], [96, 320, 14], [270, 280, 20], [304, 320, 14], [160, 250, 12], [240, 250, 12]].map(([x, y, r]) => star(x, y, c, r)).join('')}</g>`;
    case 'flower':
      return `<g>${[[128, 290], [272, 290], [100, 330], [300, 330]].map(([x, y]) =>
        `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-16" rx="9" ry="17" fill="${c}" opacity=".8" transform="rotate(${a})"/>`).join('')}<circle r="8" fill="#FFE08A"/></g>`).join('')}</g>`;
    default: return ''; // 宠物画在身前
  }
}

/** 后发 */
function drawHairBack(part, skin) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.22), d = darken(c, 0.2);
  const v = part.variant;
  let shape = '';
  if (v === 'longWave' || v === 'mermaid' || v === 'goldLong' || v === 'starLong' || v === 'longStraight') {
    shape = `<path d="M132 168 C120 250 118 360 128 452 Q150 470 162 452 C158 360 160 250 160 168Z" fill="${c}" stroke="${d}" stroke-width="2"/>
      <path d="M240 168 C252 250 254 360 244 452 Q222 470 210 452 C214 360 212 250 212 168Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
    if (v === 'longWave') shape += `<path d="M128 300 Q140 320 128 340 M244 300 Q232 320 244 340" fill="none" stroke="${l}" stroke-width="4" opacity=".7"/>`;
    if (v === 'mermaid') shape += [360, 400, 440].map((y) => `<path d="M126 ${y} Q150 ${y + 14} 126 ${y + 28}" fill="none" stroke="${l}" stroke-width="4" opacity=".6"/>`).join('');
    if (v === 'starLong') shape += [[136, 260], [242, 300], [138, 380], [240, 410]].map(([x, y]) => star(x, y, '#E7DBFF', 6)).join('');
    if (v === 'goldLong') shape += `<path d="M132 180 Q126 300 130 440" fill="none" stroke="${l}" stroke-width="5" opacity=".6"/>`;
  } else if (v === 'twinBun' || v === 'spaceBun' || v === 'peachUpdo') {
    shape = `<circle cx="126" cy="130" r="34" fill="${c}" stroke="${d}" stroke-width="2"/><circle cx="274" cy="130" r="34" fill="${c}" stroke="${d}" stroke-width="2"/>
      <path d="M136 160 Q200 210 264 160 L264 210 Q200 240 136 210Z" fill="${c}" opacity=".9"/>`;
    if (v === 'spaceBun') shape += star(126, 130, '#F0E6FF', 9) + star(274, 130, '#F0E6FF', 9);
  } else if (v === 'highPony' || v === 'twinTail') {
    shape = `<path d="M250 120 Q320 100 300 210 Q292 250 276 236 Q300 160 244 160Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
    if (v === 'twinTail') shape += `<path d="M150 120 Q80 100 100 210 Q108 250 124 236 Q100 160 156 160Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  } else if (v === 'braid') {
    shape = `<path d="M258 150 Q300 200 270 360 Q260 400 246 380 Q272 240 244 176Z" fill="${c}" stroke="${d}" stroke-width="2"/>` +
      [230, 270, 310, 350].map((y) => `<ellipse cx="262" cy="${y}" rx="13" ry="18" fill="${l}" opacity=".55"/>`).join('');
  } else if (v === 'curly') {
    shape = [[126, 200], [274, 200], [120, 250], [280, 250], [132, 300], [268, 300], [140, 350], [260, 350]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="30" fill="${c}" stroke="${d}" stroke-width="1.6"/>`).join('');
  } else if (v === 'flowerUpdo' || v === 'roseCurl') {
    shape = `<path d="M134 160 Q130 230 150 260 L250 260 Q270 230 266 160Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  } else {
    // 短发 bob / bobClips / chestnut / snowBob / starLong 兜底
    shape = `<path d="M126 150 Q120 250 150 270 L250 270 Q280 250 274 150Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  }
  return `<g>${shape}</g>`;
}

/** 腿 + 鞋 */
function drawLegs(skin) {
  return `<g><path d="M172 430 L172 492 Q172 502 182 502 L188 502 Q196 502 196 490 L196 430Z" fill="${skin}" stroke="${darken(skin, 0.15)}" stroke-width="1.5"/>
    <path d="M204 430 L204 490 Q204 502 212 502 L218 502 Q228 502 228 492 L228 430Z" fill="${skin}" stroke="${darken(skin, 0.15)}" stroke-width="1.5"/></g>`;
}
function drawShoes(part) {
  if (!part) return '';
  const c = part.color, d = darken(c, 0.2), l = lighten(c, 0.35);
  let s = '';
  switch (part.variant) {
    case 'crystal':
      s = `<path d="M164 486 Q184 480 196 496 L196 508 L162 508 Q156 498 164 486Z" fill="${c}" stroke="#B7D6E6" stroke-width="2"/>
           <path d="M204 496 Q216 480 236 486 Q244 498 238 508 L204 508Z" fill="${c}" stroke="#B7D6E6" stroke-width="2"/>` + gem(180, 492, '#fff', 5) + gem(220, 492, '#fff', 5);
      break;
    case 'boots': case 'lace': case 'snow':
      s = `<path d="M170 430 L170 496 Q170 506 182 506 L196 506 L196 430Z" fill="${c}" stroke="${d}" stroke-width="2"/>
           <path d="M204 430 L204 506 L218 506 Q230 506 230 496 L230 430Z" fill="${c}" stroke="${d}" stroke-width="2"/>
           <rect x="168" y="440" width="30" height="8" rx="3" fill="${l}"/><rect x="202" y="440" width="30" height="8" rx="3" fill="${l}"/>`;
      break;
    case 'mermaid':
      s = `<path d="M160 488 Q184 484 196 500 L190 512 L156 512Z" fill="${c}" stroke="${d}" stroke-width="2"/>
           <path d="M204 500 Q216 484 240 488 L244 512 L210 512Z" fill="${c}" stroke="${d}" stroke-width="2"/>` + gem(180, 496, '#EAFBF8', 4) + gem(220, 496, '#EAFBF8', 4);
      break;
    case 'gold':
      s = `<path d="M164 486 Q184 478 196 496 L196 508 L160 508 Q154 496 164 486Z" fill="${c}" stroke="${d}" stroke-width="2"/>
           <path d="M204 496 Q216 478 236 486 Q246 496 240 508 L204 508Z" fill="${c}" stroke="${d}" stroke-width="2"/>` + bow(180, 488, '#FFF0B8', 0.5) + bow(220, 488, '#FFF0B8', 0.5);
      break;
    default: // bow / ballet / sandal / star / rose / garden
      s = `<path d="M164 488 Q184 482 196 498 L196 508 L160 508 Q154 498 164 488Z" fill="${c}" stroke="${d}" stroke-width="2"/>
           <path d="M204 498 Q216 482 236 488 Q242 498 236 508 L204 508Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      if (part.variant === 'bow') s += bow(180, 490, l, 0.45) + bow(220, 490, l, 0.45);
      if (part.variant === 'star') s += star(180, 492, '#EDE2FF', 6) + star(220, 492, '#EDE2FF', 6);
      if (part.variant === 'rose') s += gem(180, 490, l, 5) + gem(220, 490, l, 5);
  }
  return `<g>${s}</g>`;
}

/** 躯干 + 手臂（肤色） */
function drawBody(skin) {
  const d = darken(skin, 0.14);
  return `<g>
    <path d="M168 236 Q200 224 232 236 L232 300 Q200 312 168 300Z" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
    <path d="M168 244 Q142 250 132 300 Q128 330 140 344 Q152 344 152 326 Q150 288 172 272Z" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
    <path d="M232 244 Q258 250 268 300 Q272 330 260 344 Q248 344 248 326 Q250 288 228 272Z" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
    <circle cx="140" cy="342" r="11" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
    <circle cx="260" cy="342" r="11" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
    <rect x="190" y="214" width="20" height="26" rx="9" fill="${skin}" stroke="${d}" stroke-width="1.6"/>
  </g>`;
}

/** 礼服（主体 + 裙摆）—— 20 种廓形 */
function drawGown(part, theme) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.3), d = darken(c, 0.2), dl = darken(c, 0.1);
  const v = part.variant;
  const waistY = 296, cx = 200;
  let skirt = '', bodice = '', extra = '';

  // 上身抹胸/衣身
  bodice = `<path d="M170 246 Q200 240 230 246 L234 300 Q200 308 166 300Z" fill="${dl}" stroke="${d}" stroke-width="2"/>
    <path d="M170 246 Q200 258 230 246" fill="none" stroke="${l}" stroke-width="2"/>`;

  const puffSleeve = () => `<ellipse cx="156" cy="252" rx="20" ry="16" fill="${c}" stroke="${d}" stroke-width="2"/>
    <ellipse cx="244" cy="252" rx="20" ry="16" fill="${c}" stroke="${d}" stroke-width="2"/>`;

  switch (v) {
    case 'ball':
      skirt = `<path d="M168 296 Q90 320 60 470 Q200 500 340 470 Q310 320 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M168 300 Q120 400 92 470 M232 300 Q280 400 308 470 M200 302 L200 488" fill="none" stroke="${l}" stroke-width="3" opacity=".55"/>
        <path d="M62 468 Q200 496 338 468" fill="none" stroke="${l}" stroke-width="5" opacity=".7"/>` + puffSleeve();
      break;
    case 'mermaid':
      skirt = `<path d="M168 296 Q160 380 176 440 Q200 452 224 440 Q240 380 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>
        <path d="M176 440 Q120 470 96 500 Q200 528 304 500 Q280 470 224 440Z" fill="${l}" stroke="${d}" stroke-width="2"/>`;
      extra = `<path d="M200 300 L200 440 M182 460 Q200 476 218 460" fill="none" stroke="${dl}" stroke-width="2.5" opacity=".6"/>` + [[130, 486], [270, 486], [200, 470]].map(([x, y]) => gem(x, y, '#EAFEFF', 5)).join('');
      break;
    case 'aline':
      skirt = `<path d="M168 296 L112 478 Q200 500 288 478 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M168 300 L124 476 M232 300 L276 476 M200 300 L200 490" fill="none" stroke="${l}" stroke-width="3" opacity=".5"/>` + star(200, 400, l, 12);
      break;
    case 'tiered':
      skirt = `<path d="M168 296 L138 372 L262 372 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2"/>
        <path d="M138 370 Q114 382 110 416 L290 416 Q286 382 262 370Z" fill="${l}" stroke="${d}" stroke-width="2"/>
        <path d="M110 414 Q86 428 82 478 Q200 500 318 478 Q314 428 290 414Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      extra = `<path d="M134 372 Q200 386 266 372 M108 416 Q200 434 292 416" fill="none" stroke="${dl}" stroke-width="3"/>` + puffSleeve();
      break;
    case 'tutu': case 'short':
      skirt = `<path d="M168 296 Q108 300 74 396 Q200 424 326 396 Q292 300 232 296Z" fill="${l}" stroke="${d}" stroke-width="2.5"/>`;
      extra = [400, 360, 320].map((w, i) => `<ellipse cx="200" cy="${330 + i * 22}" rx="${w / 2}" ry="14" fill="${i % 2 ? c : l}" opacity=".8" stroke="${d}" stroke-width="1.4"/>`).join('') + puffSleeve();
      break;
    case 'column':
      skirt = `<path d="M168 296 L166 486 Q200 496 234 486 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M200 300 L200 488 M180 300 L180 486 M220 300 L220 486" fill="none" stroke="${l}" stroke-width="2.5" opacity=".55"/>` + pearlStrand(200, 320, 26, 12);
      break;
    case 'princessSleeve': case 'butterfly':
      skirt = `<path d="M168 296 Q96 320 66 476 Q200 504 334 476 Q304 320 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = puffSleeve() + bow(200, 300, l, 1.1) + `<path d="M66 474 Q200 502 334 474" fill="none" stroke="${l}" stroke-width="5"/>` +
        (v === 'butterfly' ? star(120, 380, l, 10) + star(280, 380, l, 10) : '');
      break;
    case 'train':
      skirt = `<path d="M168 296 Q100 330 60 490 L250 490 Q300 340 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>
        <path d="M250 490 Q320 470 356 500 Q280 516 250 508Z" fill="${l}" stroke="${d}" stroke-width="2"/>`;
      extra = `<path d="M200 302 L200 486" fill="none" stroke="${l}" stroke-width="3" opacity=".5"/>`;
      break;
    case 'ruffle':
      skirt = [0, 1, 2, 3].map((i) => {
        const y = 320 + i * 42, w = 70 + i * 30;
        return `<path d="M${cx - w / 2} ${y} Q${cx} ${y + 34} ${cx + w / 2} ${y} Q${cx + w / 2} ${y + 16} ${cx} ${y + 30} Q${cx - w / 2} ${y + 16} ${cx - w / 2} ${y}Z" fill="${i % 2 ? l : c}" stroke="${d}" stroke-width="1.6"/>`;
      }).join('');
      break;
    case 'sunflower':
      skirt = `<path d="M168 296 L120 478 Q200 500 280 478 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = [280, 330, 380, 430].map((y, i) => [150, 200, 250].map((x) =>
        `<circle cx="${x}" cy="${y}" r="10" fill="${l}" opacity=".7"/>`).join('')).join('') + bow(200, 300, '#8A5A2E', 0.9);
      break;
    case 'ice':
      skirt = `<path d="M168 296 L108 470 L140 450 L160 490 L200 452 L240 490 L260 450 L292 470 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M200 300 L200 450 M150 340 L130 460 M250 340 L270 460" fill="none" stroke="${l}" stroke-width="3" opacity=".7"/>` + gem(200, 360, '#fff', 9);
      break;
    case 'lace':
      skirt = `<path d="M168 296 Q104 330 76 480 Q200 502 324 480 Q296 330 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M78 478 Q200 500 322 478" fill="none" stroke="${l}" stroke-width="6" stroke-dasharray="2 8"/>` +
        [360, 400, 440].map((y) => `<path d="M${110 - (y - 360)} ${y} Q200 ${y + 20} ${290 + (y - 360)} ${y}" fill="none" stroke="${l}" stroke-width="3" stroke-dasharray="3 7"/>`).join('');
      break;
    case 'golden':
      skirt = `<path d="M168 296 Q88 320 56 480 Q200 510 344 480 Q312 320 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M168 300 Q120 400 92 478 M232 300 Q280 400 308 478 M200 302 L200 494" fill="none" stroke="#FFF0B0" stroke-width="4" opacity=".75"/>` +
        gem(200, 340, '#FFF3C0', 12) + bow(200, 300, '#FFF0B0', 1) + puffSleeve();
      break;
    case 'candy':
      skirt = `<path d="M168 296 Q104 330 74 478 Q200 500 326 478 Q296 330 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = [130, 170, 210, 250, 290].map((x) => `<path d="M${x} 306 Q${x - 30} 400 ${x - 20} 486" fill="none" stroke="#fff" stroke-width="7" opacity=".6"/>`).join('');
      break;
    case 'velvet': case 'sage':
      skirt = `<path d="M168 296 L110 484 Q200 504 290 484 L232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M200 300 L200 492" fill="none" stroke="${l}" stroke-width="3" opacity=".4"/>` + pearlStrand(200, 316, 24, 10);
      break;
    case 'moon':
      skirt = `<path d="M168 296 Q108 330 78 486 Q200 506 322 486 Q292 330 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = [[120, 380], [280, 360], [200, 440], [160, 470]].map(([x, y]) => star(x, y, '#FFF2C8', 9)).join('') + `<circle cx="200" cy="392" r="22" fill="#FFF0B8" opacity=".8"/>`;
      break;
    case 'apple':
      skirt = `<path d="M168 296 Q120 300 118 420 Q200 448 282 420 Q280 300 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<ellipse cx="160" cy="380" rx="16" ry="22" fill="${l}" opacity=".6"/><ellipse cx="240" cy="380" rx="16" ry="22" fill="${l}" opacity=".6"/>` + bow(200, 302, l, 0.9);
      break;
    default:
      skirt = `<path d="M168 296 Q100 330 72 482 Q200 504 328 482 Q300 330 232 296Z" fill="${c}" stroke="${d}" stroke-width="2.5"/>`;
      extra = `<path d="M72 480 Q200 502 328 480" fill="none" stroke="${l}" stroke-width="5"/>`;
  }
  return `<g>${bodice}${skirt}${extra}</g>`;
}

/** 上衣（叠穿在礼服上身）—— 24 种造型，不同袖型/领口/衣身 */
function drawTop(part) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.3), d = darken(c, 0.2);
  const v = part.variant;
  let body = `<path d="M166 244 Q200 236 234 244 L236 300 Q200 310 164 300Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  let sleeves = '', collar = '', detail = '';

  const shortSleeve = () => `<path d="M166 246 Q146 248 142 272 L166 278Z" fill="${c}" stroke="${d}" stroke-width="1.6"/><path d="M234 246 Q254 248 258 272 L234 278Z" fill="${c}" stroke="${d}" stroke-width="1.6"/>`;
  const puff = () => `<ellipse cx="150" cy="256" rx="19" ry="15" fill="${c}" stroke="${d}" stroke-width="1.8"/><ellipse cx="250" cy="256" rx="19" ry="15" fill="${c}" stroke="${d}" stroke-width="1.8"/>`;
  const longSleeve = () => `<path d="M166 246 Q138 252 130 316 Q130 336 144 340 L152 320 Q150 276 170 268Z" fill="${c}" stroke="${d}" stroke-width="1.8"/><path d="M234 246 Q262 252 270 316 Q270 336 256 340 L248 320 Q250 276 230 268Z" fill="${c}" stroke="${d}" stroke-width="1.8"/>`;
  const cape = () => `<path d="M164 244 Q120 250 104 330 Q150 344 200 330 Q250 344 296 330 Q280 250 236 244 Q200 268 164 244Z" fill="${c}" opacity=".92" stroke="${d}" stroke-width="2"/>`;

  switch (v) {
    case 'roundTee': sleeves = shortSleeve(); collar = `<path d="M184 244 Q200 254 216 244" fill="none" stroke="${l}" stroke-width="3"/>`; break;
    case 'sailor':
      sleeves = shortSleeve();
      collar = `<path d="M170 244 L200 272 L230 244 L216 242 L200 258 L184 242Z" fill="#fff" stroke="${d}" stroke-width="1.4"/>`;
      detail = `<path d="M200 258 Q200 280 200 292" stroke="${l}" stroke-width="3"/>`; break;
    case 'puffBlouse': sleeves = puff(); collar = `<path d="M184 244 Q200 252 216 244" fill="none" stroke="${l}" stroke-width="2.5"/>`; detail = bow(200, 258, l, 0.7); break;
    case 'camisole':
      body = `<path d="M176 244 L180 300 Q200 306 220 300 L224 244 Q200 254 176 244Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      detail = `<path d="M178 246 L182 300 M222 246 L218 300" stroke="${l}" stroke-width="2" stroke-dasharray="3 5"/>`; break;
    case 'hooded':
      sleeves = longSleeve();
      collar = `<path d="M166 244 Q200 210 234 244 Q200 236 166 244Z" fill="${l}" stroke="${d}" stroke-width="2"/>`;
      detail = `<circle cx="140" cy="340" r="8" fill="${l}" stroke="${d}"/><circle cx="260" cy="340" r="8" fill="${l}" stroke="${d}"/>`; break;
    case 'ruffleCollar': case 'laceBlouse':
      sleeves = shortSleeve();
      collar = `<path d="M168 244 Q180 262 200 250 Q220 262 232 244 Q216 252 200 244 Q184 252 168 244Z" fill="${l}" stroke="${d}" stroke-width="1.4"/>`;
      detail = `<path d="M180 274 Q200 282 220 274" fill="none" stroke="${l}" stroke-width="2" stroke-dasharray="2 5"/>`; break;
    case 'capelet': case 'longCape':
      sleeves = ''; collar = cape(); detail = bow(200, 258, l, 0.9); break;
    case 'vVest':
      body = `<path d="M174 244 L200 268 L226 244 L232 300 Q200 310 168 300Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      detail = `<path d="M174 244 L200 268 L226 244" fill="none" stroke="${l}" stroke-width="3"/>` + [[186, 280], [214, 280]].map(([x, y]) => gem(x, y, l, 4)).join(''); break;
    case 'offShoulder':
      body = `<path d="M160 250 Q200 268 240 250 L236 300 Q200 310 164 300Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      detail = `<path d="M160 250 Q200 270 240 250" fill="none" stroke="${l}" stroke-width="3"/>`; break;
    case 'turtleneck':
      body = `<path d="M166 250 Q200 240 234 250 L236 300 Q200 310 164 300Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
      collar = `<rect x="184" y="226" width="32" height="20" rx="9" fill="${l}" stroke="${d}" stroke-width="1.6"/>`;
      sleeves = longSleeve(); break;
    case 'doubleBreasted':
      collar = `<path d="M170 244 L200 264 L230 244 L200 252Z" fill="${l}" stroke="${d}" stroke-width="1.4"/>`;
      detail = [[188, 266], [212, 266], [188, 284], [212, 284]].map(([x, y]) => gem(x, y, '#FFF0C0', 3)).join('');
      sleeves = longSleeve(); break;
    case 'wrap':
      detail = `<path d="M170 250 L228 288 M228 250 L172 288" stroke="${l}" stroke-width="4"/>` + bow(206, 288, l, 0.7); sleeves = shortSleeve(); break;
    case 'armor':
      detail = `<path d="M158 248 Q168 236 184 246 L176 264Z" fill="${l}" stroke="${d}" stroke-width="1.6"/><path d="M242 248 Q232 236 216 246 L224 264Z" fill="${l}" stroke="${d}" stroke-width="1.6"/>` + gem(200, 262, '#FFF0B0', 7);
      sleeves = shortSleeve(); break;
    case 'pinafore': case 'suspender':
      detail = `<path d="M180 246 L176 300 M220 246 L224 300" stroke="${c}" stroke-width="7"/>` + gem(180, 272, l, 4) + gem(220, 272, l, 4);
      body = `<path d="M172 268 Q200 262 228 268 L232 300 Q200 308 168 300Z" fill="${c}" stroke="${d}" stroke-width="2"/>`; break;
    case 'flaredSleeve': case 'bubble':
      sleeves = `<path d="M166 246 Q138 250 126 288 Q140 300 160 292 L170 268Z" fill="${c}" stroke="${d}" stroke-width="1.8"/><path d="M234 246 Q262 250 274 288 Q260 300 240 292 L230 268Z" fill="${c}" stroke="${d}" stroke-width="1.8"/>`;
      detail = bow(200, 258, l, 0.7); break;
    case 'knit': case 'cardigan':
      detail = `<path d="M200 250 L200 300 M176 256 L176 296 M224 256 L224 296" stroke="${l}" stroke-width="2" stroke-dasharray="3 4"/>`;
      sleeves = longSleeve(); break;
    case 'tieredCake':
      detail = [262, 278, 294].map((y, i) => `<path d="M${172 - i * 3} ${y} Q200 ${y + 12} ${228 + i * 3} ${y}" fill="none" stroke="${l}" stroke-width="4"/>`).join('');
      sleeves = puff(); break;
    case 'bowTie':
      detail = bow(200, 252, l, 0.75); sleeves = shortSleeve(); break;
    case 'goldenBolero':
      collar = cape(); detail = gem(200, 260, '#FFF3C0', 8); sleeves = puff(); break;
    default:
      sleeves = shortSleeve(); detail = bow(200, 258, l, 0.6);
  }
  return `<g>${body}${sleeves}${collar}${detail}</g>`;
}

/** 脸（Q 版大眼 + 腮红 + 微笑） */
function drawFace(skin, mood = 'smile') {
  const eyeY = 172;
  let mouth = `<path d="M188 196 Q200 208 212 196" fill="none" stroke="#C05379" stroke-width="3" stroke-linecap="round"/>`;
  if (mood === 'wink') mouth = `<path d="M190 198 Q200 206 210 198" fill="none" stroke="#C05379" stroke-width="3" stroke-linecap="round"/>`;
  const winkL = mood === 'wink' ? `<path d="M168 172 Q180 166 192 172" fill="none" stroke="#4A3350" stroke-width="3.5" stroke-linecap="round"/>` : '';
  const normalL = mood === 'wink' ? '' : `<ellipse cx="180" cy="${eyeY}" rx="9" ry="12" fill="#4A3350"/><circle cx="177" cy="168" r="3" fill="#fff"/>`;
  return `<g>
    <ellipse cx="200" cy="176" rx="62" ry="66" fill="${skin}" stroke="${darken(skin, 0.14)}" stroke-width="2"/>
    <ellipse cx="168" cy="190" rx="12" ry="7" fill="#F59EB6" opacity=".55"/>
    <ellipse cx="232" cy="190" rx="12" ry="7" fill="#F59EB6" opacity=".55"/>
    ${normalL}${winkL}
    <ellipse cx="220" cy="${eyeY}" rx="9" ry="12" fill="#4A3350"/><circle cx="217" cy="168" r="3" fill="#fff"/>
    <path d="M166 154 Q180 148 194 154" fill="none" stroke="#7A5060" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M206 154 Q220 148 234 154" fill="none" stroke="#7A5060" stroke-width="2.5" stroke-linecap="round"/>
    ${mouth}
    <circle cx="140" cy="176" r="8" fill="${skin}" stroke="${darken(skin, 0.14)}" stroke-width="1.6"/>
    <circle cx="260" cy="176" r="8" fill="${skin}" stroke="${darken(skin, 0.14)}" stroke-width="1.6"/>
  </g>`;
}

/** 前发 / 刘海 */
function drawHairFront(part) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.25), d = darken(c, 0.18);
  const v = part.variant;
  let s = '';
  if (v === 'longWave' || v === 'longStraight' || v === 'goldLong' || v === 'starLong' || v === 'mermaid') {
    s = `<path d="M138 168 Q136 104 200 102 Q264 104 262 168 Q246 138 224 146 Q214 128 200 140 Q186 128 176 146 Q154 138 138 168Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  } else if (v === 'twinBun' || v === 'spaceBun' || v === 'peachUpdo' || v === 'flowerUpdo' || v === 'roseCurl') {
    s = `<path d="M138 166 Q134 106 200 104 Q266 106 262 166 Q250 132 232 144 Q216 124 200 138 Q184 124 168 144 Q150 132 138 166Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  } else if (v === 'curly') {
    s = [[156, 140], [180, 130], [204, 128], [228, 132], [250, 144]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" fill="${c}" stroke="${d}" stroke-width="1.4"/>`).join('');
  } else if (v === 'braid' || v === 'highPony' || v === 'twinTail') {
    s = `<path d="M138 168 Q136 106 200 104 Q264 106 262 168 Q252 134 236 142 Q218 126 200 136 Q182 126 164 142 Q148 134 138 168Z" fill="${c}" stroke="${d}" stroke-width="2"/>`;
  } else {
    // bob 类齐刘海
    s = `<path d="M136 168 Q134 104 200 102 Q266 104 264 168 L264 208 Q252 196 250 174 Q200 158 150 174 Q148 196 136 208Z" fill="${c}" stroke="${d}" stroke-width="2"/>
      <path d="M140 170 Q200 152 260 170" fill="none" stroke="${l}" stroke-width="2" opacity=".6"/>`;
  }
  return `<g>${s}</g>`;
}

/** 头饰 */
function drawHeadwear(part) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.35), d = darken(c, 0.2);
  let s = '';
  switch (part.variant) {
    case 'tiara': case 'goldTiara':
      s = `<path d="M150 118 L162 92 L178 110 L200 82 L222 110 L238 92 L250 118 Q200 132 150 118Z" fill="${c}" stroke="${d}" stroke-width="2"/>` +
        gem(200, 96, '#FFF6C8', 7) + gem(162, 108, '#FFF', 4) + gem(238, 108, '#FFF', 4); break;
    case 'bow':
      s = bow(254, 128, c, 1.1); break;
    case 'flowerCrown': case 'roseBand': case 'leafCrown':
      s = [150, 176, 200, 224, 250].map((x, i) =>
        `<g transform="translate(${x} ${112 + (i % 2) * 6})"><circle r="11" fill="${c}" stroke="${d}" stroke-width="1.4"/><circle r="4" fill="${l}"/></g>`).join(''); break;
    case 'starClips':
      s = star(158, 138, c, 10) + star(242, 130, c, 9) + star(228, 154, l, 7); break;
    case 'bonnet':
      s = `<path d="M138 140 Q138 84 200 84 Q262 84 262 140 Q232 120 200 122 Q168 120 138 140Z" fill="${c}" stroke="${d}" stroke-width="2"/>` +
        `<path d="M138 140 Q200 156 262 140" fill="none" stroke="${l}" stroke-width="4"/>` + bow(200, 92, l, 0.8); break;
    case 'witchHat':
      s = `<path d="M150 120 L200 44 L250 120 Q200 136 150 120Z" fill="${c}" stroke="${d}" stroke-width="2"/><ellipse cx="200" cy="122" rx="60" ry="12" fill="${d}"/>` + star(200, 88, '#FFE9A8', 8); break;
    case 'shellCrown':
      s = [168, 200, 232].map((x, i) => `<path d="M${x - 14} 122 Q${x} ${92 - i * 4} ${x + 14} 122Z" fill="${c}" stroke="${d}" stroke-width="1.6"/>`).join('') + gem(200, 116, '#FFF', 5); break;
    case 'pearlBand': case 'candyBow':
      s = pearlStrand(200, 116, 58, 14, c, 9); break;
    case 'halo':
      s = `<ellipse cx="200" cy="86" rx="44" ry="12" fill="none" stroke="${c}" stroke-width="6"/>` + star(200, 74, l, 7); break;
    case 'moonClip':
      s = `<path d="M236 118 A20 20 0 1 0 236 154 A16 16 0 1 1 236 118Z" fill="${c}" stroke="${d}" stroke-width="1.6"/>` + star(252, 120, l, 6); break;
    default:
      s = bow(200, 116, c, 1);
  }
  return `<g>${s}</g>`;
}

/** 首饰（项链 / 耳环 / 胸针，画在胸前） */
function drawJewelry(part) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.3);
  let s = '';
  switch (part.variant) {
    case 'pearlNecklace':
      s = pearlStrand(200, 268, 30, 16, '#FFF6FA', 9); break;
    case 'gemNecklace':
      s = pearlStrand(200, 266, 28, 14, c, 7) + gem(200, 282, c, 9); break;
    case 'bowChoker': case 'roseChoker':
      s = `<rect x="182" y="250" width="36" height="9" rx="4" fill="${c}"/>` + bow(200, 258, l, 0.6); break;
    case 'starPendant':
      s = `<path d="M180 252 Q200 272 220 252" fill="none" stroke="${l}" stroke-width="2"/>` + star(200, 280, c, 11); break;
    case 'moonPendant':
      s = `<path d="M180 252 Q200 272 220 252" fill="none" stroke="${l}" stroke-width="2"/><path d="M196 276 A11 11 0 1 0 196 292 A9 9 0 1 1 196 276Z" fill="${c}"/>`; break;
    case 'earrings':
      s = `<circle cx="140" cy="184" r="5" fill="${c}"/><circle cx="260" cy="184" r="5" fill="${c}"/>` + gem(140, 194, l, 4) + gem(260, 194, l, 4); break;
    case 'bracelet':
      s = `<ellipse cx="142" cy="338" rx="12" ry="7" fill="none" stroke="${c}" stroke-width="4"/><ellipse cx="258" cy="338" rx="12" ry="7" fill="none" stroke="${c}" stroke-width="4"/>`; break;
    case 'brooch':
      s = gem(226, 262, c, 9); break;
    case 'goldSet':
      s = pearlStrand(200, 268, 30, 16, c, 9) + gem(200, 286, '#FFF3C0', 10) + gem(140, 184, c, 5) + gem(260, 184, c, 5); break;
    default:
      s = gem(200, 272, c, 8);
  }
  return `<g>${s}</g>`;
}

/** 手持道具（身前最上层） */
function drawProp(part) {
  if (!part) return '';
  const c = part.color, l = lighten(c, 0.3), d = darken(c, 0.2);
  const x = 286, y = 268;
  let s = '';
  switch (part.variant) {
    case 'starWand':
      s = `<path d="M${x} ${y + 70} L${x} ${y}" stroke="#B99AD8" stroke-width="6" stroke-linecap="round"/>` + star(x, y - 6, c, 20) + star(x - 22, y + 18, l, 8); break;
    case 'ribbonWand':
      s = `<path d="M${x} ${y + 70} L${x} ${y}" stroke="${d}" stroke-width="6" stroke-linecap="round"/>` +
        `<path d="M${x} ${y} Q${x - 30} ${y - 10} ${x - 24} ${y + 30} Q${x - 10} ${y + 16} ${x} ${y}Z" fill="${c}"/><path d="M${x} ${y} Q${x + 30} ${y - 10} ${x + 24} ${y + 30} Q${x + 10} ${y + 16} ${x} ${y}Z" fill="${l}"/>` + star(x, y - 4, l, 8); break;
    case 'parasol':
      s = `<path d="M${x} ${y} L${x} ${y + 90}" stroke="#C49A86" stroke-width="5"/><path d="M${x - 46} ${y + 6} Q${x} ${y - 40} ${x + 46} ${y + 6} Q${x + 24} ${y - 4} ${x} ${y + 6} Q${x - 24} ${y - 4} ${x - 46} ${y + 6}Z" fill="${c}" stroke="${d}" stroke-width="2"/>` + bow(x, y + 4, l, 0.6); break;
    case 'flowerBasket':
      s = `<path d="M${x - 30} ${y + 18} Q${x} ${y + 54} ${x + 30} ${y + 18}Z" fill="#D9A86A" stroke="#A87C48" stroke-width="2"/>` +
        [[-18, 12], [0, 4], [18, 12], [-8, 20], [10, 20]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y - dy}" r="9" fill="${c}" stroke="${d}" stroke-width="1"/>`).join(''); break;
    case 'mirror':
      s = `<circle cx="${x}" cy="${y}" r="26" fill="#EAF3FA" stroke="${c}" stroke-width="5"/><path d="M${x} ${y + 26} L${x} ${y + 74}" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` + star(x - 8, y - 8, '#fff', 6); break;
    case 'book':
      s = `<path d="M${x - 30} ${y - 18} L${x} ${y - 10} L${x} ${y + 40} L${x - 30} ${y + 32}Z" fill="${c}" stroke="${d}" stroke-width="2"/><path d="M${x + 30} ${y - 18} L${x} ${y - 10} L${x} ${y + 40} L${x + 30} ${y + 32}Z" fill="${l}" stroke="${d}" stroke-width="2"/>` + star(x, y + 4, '#FFE9A8', 8); break;
    case 'balloon':
      s = `<path d="M${x} ${y + 20} Q${x + 40} ${y + 60} ${x + 30} ${y + 90}" fill="none" stroke="#CBBBD8" stroke-width="2"/>` +
        `<path d="M${x} ${y - 30} C${x + 34} ${y - 30} ${x + 30} ${y + 20} ${x} ${y + 22} C${x - 30} ${y + 20} ${x - 34} ${y - 30} ${x} ${y - 30}Z" fill="${c}" stroke="${d}" stroke-width="2"/>` + `<path d="M${x - 6} ${y - 18} Q${x - 12} ${y - 8} ${x - 8} ${y + 2}" fill="none" stroke="#fff" stroke-width="3" opacity=".7"/>`; break;
    case 'staff': case 'crownScepter':
      s = `<path d="M${x} ${y + 80} L${x} ${y}" stroke="${c}" stroke-width="7" stroke-linecap="round"/>` +
        `<path d="M${x - 16} ${y - 8} L${x - 10} ${y - 26} L${x} ${y - 12} L${x + 10} ${y - 26} L${x + 16} ${y - 8}Z" fill="${c}" stroke="${d}" stroke-width="2"/>` + gem(x, y - 6, '#FFF6C8', 7); break;
    case 'fan':
      s = `<path d="M${x} ${y + 34} L${x - 40} ${y - 10} Q${x} ${y - 30} ${x + 40} ${y - 10}Z" fill="${c}" stroke="${d}" stroke-width="2"/>` +
        `<path d="M${x} ${y + 34} L${x - 20} ${y - 16} M${x} ${y + 34} L${x} ${y - 24} M${x} ${y + 34} L${x + 20} ${y - 16}" stroke="${l}" stroke-width="2"/>`; break;
    case 'lantern':
      s = `<path d="M${x} ${y - 18} Q${x + 26} ${y - 18} ${x + 26} ${y + 14} Q${x} ${y + 32} ${x - 26} ${y + 14} Q${x - 26} ${y - 18} ${x} ${y - 18}Z" fill="${c}" stroke="${d}" stroke-width="2" opacity=".92"/>` +
        star(x, y, '#FFF3C0', 10) + `<path d="M${x} ${y - 18} L${x} ${y - 34}" stroke="${d}" stroke-width="3"/>`; break;
    case 'candy':
      s = `<path d="M${x} ${y + 80} L${x} ${y}" stroke="#fff" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M${x - 8} ${y - 4} L${x + 8} ${y + 12} M${x - 4} ${y - 12} L${x + 12} ${y + 4}" stroke="${c}" stroke-width="6"/>`; break;
    default:
      s = star(x, y, c, 14);
  }
  return `<g>${s}</g>`;
}

/** 身前宠物 */
function drawPet(part) {
  if (!part) return '';
  const c = part.color, d = darken(c, 0.2);
  const x = 316, y = 452;
  let s = '';
  switch (part.variant) {
    case 'cat':
      s = `<ellipse cx="${x}" cy="${y}" rx="24" ry="20" fill="${c}" stroke="${d}" stroke-width="2"/><circle cx="${x}" cy="${y - 20}" r="17" fill="${c}" stroke="${d}" stroke-width="2"/>` +
        `<path d="M${x - 15} ${y - 30} L${x - 12} ${y - 44} L${x - 2} ${y - 34}Z M${x + 15} ${y - 30} L${x + 12} ${y - 44} L${x + 2} ${y - 34}Z" fill="${c}" stroke="${d}" stroke-width="1.6"/>` +
        `<circle cx="${x - 6}" cy="${y - 20}" r="2.6" fill="#4A3350"/><circle cx="${x + 6}" cy="${y - 20}" r="2.6" fill="#4A3350"/>`; break;
    case 'bunny':
      s = `<ellipse cx="${x}" cy="${y}" rx="22" ry="19" fill="${c}" stroke="${d}" stroke-width="2"/><circle cx="${x}" cy="${y - 18}" r="16" fill="${c}" stroke="${d}" stroke-width="2"/>` +
        `<ellipse cx="${x - 8}" cy="${y - 44}" rx="6" ry="16" fill="${c}" stroke="${d}" stroke-width="1.6"/><ellipse cx="${x + 8}" cy="${y - 44}" rx="6" ry="16" fill="${c}" stroke="${d}" stroke-width="1.6"/>` +
        `<circle cx="${x - 6}" cy="${y - 18}" r="2.6" fill="#4A3350"/><circle cx="${x + 6}" cy="${y - 18}" r="2.6" fill="#4A3350"/>`; break;
    case 'unicorn':
      s = `<ellipse cx="${x}" cy="${y}" rx="26" ry="18" fill="${c}" stroke="${d}" stroke-width="2"/><path d="M${x - 20} ${y - 6} L${x - 34} ${y - 24} L${x - 16} ${y - 18}Z" fill="${d}"/>` +
        `<circle cx="${x + 18}" cy="${y - 16}" r="14" fill="${c}" stroke="${d}" stroke-width="2"/><path d="M${x + 18} ${y - 30} L${x + 22} ${y - 46} L${x + 28} ${y - 28}Z" fill="#FFE08A" stroke="${d}" stroke-width="1.4"/>` +
        `<circle cx="${x + 14}" cy="${y - 18}" r="2.4" fill="#4A3350"/>`; break;
    default: return '';
  }
  return `<g>${s}</g>`;
}

/* ============================== 组合 ============================== */
const CAT_ORDER = ['hair', 'gown', 'top', 'shoes', 'headwear', 'jewelry', 'prop', 'wings'];

/**
 * 渲染整张立绘。
 * @param outfit {Object} 各类选中的 partId（category -> id 或 null）
 * @param princess {Object} 公主（含 skin）
 * @param sceneId {string|null} 场景 id
 * @param opts {Object} { mood, showScene, uid }
 * @returns {string} 完整 <svg> 字符串
 */
export function renderFigure(outfit, princess, sceneId, opts = {}) {
  const uid = opts.uid || 'fig';
  const skin = princess?.skin || '#FFE0C4';
  const get = (cat) => {
    const id = outfit?.[cat];
    return id ? (PART_BY_ID.get(id) || null) : null;
  };
  const hair = get('hair'), gown = get('gown'), top = get('top');
  const shoes = get('shoes'), headwear = get('headwear'), jewelry = get('jewelry');
  const prop = get('prop'), wings = get('wings');

  const isPet = wings && ['cat', 'bunny', 'unicorn'].includes(wings.variant);
  const g = [
    opts.showScene === false ? `<rect width="400" height="520" fill="transparent"/>` : drawScene(sceneId, uid),
    isPet ? '' : drawWingsBack(wings, uid),
    drawHairBack(hair, skin),
    drawLegs(skin),
    drawShoes(shoes),
    drawGown(gown, princess?.themeColor),
    drawBody(skin),
    drawTop(top),
    drawFace(skin, opts.mood || 'smile'),
    drawHairFront(hair),
    drawHeadwear(headwear),
    drawJewelry(jewelry),
    drawProp(prop),
    isPet ? drawPet(wings) : '',
  ].join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="公主换装立绘">${g}</svg>`;
}

/** 单独渲染一个部件的缩略图（用于衣柜卡片）——按类别裁到正确视窗 */
export function renderThumb(part, uid = 'thumb') {
  if (!part) return '';
  // 每类部件绘制的坐标区间不同，viewBox 必须对准才能让卡片看清（否则裁到画面外）
  const views = {
    gown: '48 232 304 282',
    top: '130 216 140 132',
    shoes: '150 424 100 94',
    hair: '120 92 160 190',
    headwear: '128 78 144 96',
    jewelry: '128 214 144 128',
    prop: '238 224 96 150',
    wings: '70 200 260 200',
  };
  const vb = views[part.category] || '120 100 160 220';
  let inner = '';
  switch (part.category) {
    case 'gown': inner = drawGown(part, null); break;
    case 'top': inner = drawBody('#FFE0C4') + drawTop(part); break;
    case 'shoes': inner = drawLegs('#FFE0C4') + drawShoes(part); break;
    case 'hair': inner = drawHairBack(part) + drawFace('#FFE0C4', 'wink') + drawHairFront(part); break;
    case 'headwear': inner = drawFace('#FFE0C4') + drawHairFront({ id: 'h', variant: 'bob', color: '#6B4028' }) + drawHeadwear(part); break;
    case 'jewelry': inner = drawBody('#FFE0C4') + drawJewelry(part); break;
    case 'prop': inner = drawProp(part); break;
    case 'wings': inner = (['cat', 'bunny', 'unicorn'].includes(part.variant) ? drawPet(part) : drawWingsBack(part, uid)); break;
    default: inner = '';
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}
