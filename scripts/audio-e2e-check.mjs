/**
 * 音频端到端验收：用 Chrome CDP 注入 AudioContext 计数器，
 * 验证首次手势解锁、BGM 调度、交互音效、静音开关都真的驱动了 Web Audio 节点。
 * 用法：node scripts/audio-e2e-check.mjs（需先启动 serve-dist 6575）
 */
const CDP_PORT = 9336;
const BASE = 'http://127.0.0.1:6575';

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=/tmp/princess-preview/cdp-audio-profile',
  'about:blank',
], { stdio: 'ignore' });

async function getJSON(path) {
  const r = await fetch(`http://127.0.0.1:${CDP_PORT}${path}`);
  return r.json();
}
async function connectWs(url) {
  const ws = new WebSocket(url);
  await new Promise((ok, err) => { ws.onopen = ok; ws.onerror = err; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { ws, send };
}
async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + (r.exceptionDetails.exception?.description || ''));
  return r.result.value;
}
function assert(cond, msg) {
  if (!cond) throw new Error('✗ ' + msg);
  console.log('✓ ' + msg);
}

try {
  let tabs;
  for (let i = 0; i < 30; i++) { try { tabs = await getJSON('/json'); break; } catch { await sleep(200); } }
  const page = tabs.find((t) => t.type === 'page');
  const { ws, send } = await connectWs(page.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');

  // 在任何脚本执行前注入 AudioContext 探针，统计真正 start() 的音源节点
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      (() => {
        window.__audioProbe = { contexts: 0, oscStarts: 0, noiseStarts: 0, convolvers: 0 };
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const OrigAC = AC;
        window.AudioContext = class extends OrigAC {
          constructor(...a) { super(...a); window.__audioProbe.contexts++; }
          createOscillator() {
            const o = super.createOscillator();
            const orig = o.start.bind(o);
            o.start = (...x) => { window.__audioProbe.oscStarts++; return orig(...x); };
            return o;
          }
          createBufferSource() {
            const b = super.createBufferSource();
            const orig = b.start.bind(b);
            b.start = (...x) => { window.__audioProbe.noiseStarts++; return orig(...x); };
            return b;
          }
          createConvolver() {
            window.__audioProbe.convolvers++;
            return super.createConvolver();
          }
        };
      })();
    `,
  });

  await send('Page.navigate', { url: BASE + '/?view=studio' });
  await sleep(1000);
  await evaluate(send, `localStorage.clear()`);
  await send('Page.reload');
  await sleep(1000);

  // 1) 首次手势前：没有创建 AudioContext（autoplay 策略）
  const beforeGesture = await evaluate(send, `JSON.parse(JSON.stringify(window.__audioProbe))`);
  assert(beforeGesture.contexts === 0, '首次手势前未创建 AudioContext（遵守 autoplay 策略）');

  // 2) 首次手势后：AudioContext 建立，BGM 开始调度（oscStarts 增长）
  await evaluate(send, `document.querySelector('.hud-crown').dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}))`);
  await sleep(1600);
  const afterGesture = await evaluate(send, `JSON.parse(JSON.stringify(window.__audioProbe))`);
  assert(afterGesture.contexts === 1, '首次手势后创建了 1 个 AudioContext');
  assert(afterGesture.convolvers === 1, `卷积混响节点已建立（convolvers=${afterGesture.convolvers}，真实空间余韵）`);
  // 高保真合成：每个音符由 5 个泛音分音合成。1600ms/92BPM≈2.4 拍 → 旧实现约 6 个振荡器，新实现 >10
  assert(afterGesture.oscStarts > 10, `加法合成在跑：分音振荡器数远超音符数（oscStarts=${afterGesture.oscStarts}）`);
  assert(afterGesture.noiseStarts >= 2, `锤击瞬态噪声已合成（noiseStarts=${afterGesture.noiseStarts}）`);

  // 3) 点击换装部件 → 音效叠加（osc/noise 计数继续增长）
  const beforeEquip = await evaluate(send, `window.__audioProbe.oscStarts + window.__audioProbe.noiseStarts`);
  await evaluate(send, `(() => {
    const tab = [...document.querySelectorAll('.cat-tab')].find(t => t.textContent.includes('礼服'));
    if (tab) tab.click();
    return true;
  })()`);
  await sleep(250);
  await evaluate(send, `(() => {
    const cards = [...document.querySelectorAll('.part-card')].filter(c => !c.classList.contains('locked'));
    const t = cards.find(c => !c.classList.contains('selected')) || cards[0];
    if (t) t.click();
    return true;
  })()`);
  await sleep(300);
  const afterEquip = await evaluate(send, `window.__audioProbe.oscStarts + window.__audioProbe.noiseStarts`);
  assert(afterEquip > beforeEquip, `换装触发了动作音效（音源计数 ${beforeEquip} → ${afterEquip}）`);

  // 4) 家长中心：声音设置 UI 齐全
  await evaluate(send, `location.href = '${BASE}/?view=parents'`);
  await sleep(1000);
  const ui = await evaluate(send, `(() => ({
    switches: document.querySelectorAll('.audio-settings .switch').length,
    sliders: document.querySelectorAll('.audio-settings .audio-slider').length,
    preview: !!document.querySelector('.audio-settings .preview-btn'),
  }))()`);
  assert(ui.switches === 2 && ui.sliders === 2 && ui.preview, '家长中心含音乐/音效两个开关、两个音量滑块与试听按钮');

  // 5) 关闭背景音乐后，停止排出新音符（计数在静止期不再因 BGM 增长）
  await evaluate(send, `document.querySelectorAll('.audio-settings .switch')[0].click()`);
  await sleep(300);
  const afterMuteMusic = await evaluate(send, `window.__audioProbe.oscStarts`);
  await sleep(900);
  const idle = await evaluate(send, `window.__audioProbe.oscStarts`);
  assert(idle - afterMuteMusic <= 1, `关闭背景音乐后停止排音符（静止期新增 ${idle - afterMuteMusic}）`);

  // 6) 设置已持久化
  const savedAudio = await evaluate(send, `JSON.parse(localStorage.getItem('otools-princess:audio:v1') || 'null')`);
  assert(savedAudio && savedAudio.musicOn === false, '声音设置已写入 localStorage');

  // 7) HUD 一键静音按钮存在且可切换
  const muteBtn = await evaluate(send, `(() => {
    const b = [...document.querySelectorAll('.hud-stats .icon-btn')].find(x => x.title.includes('静音') || x.title.includes('声音'));
    if (!b) return null;
    const before = b.textContent;
    b.click();
    return new Promise(resolve => setTimeout(() => resolve({ before, after: b.textContent }), 150));
  })()`);
  assert(muteBtn && muteBtn.before !== muteBtn.after, `HUD 一键静音按钮可切换（${muteBtn?.before} → ${muteBtn?.after}）`);

  ws.close();
  console.log('\n音频端到端验收全部通过。');
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
}
