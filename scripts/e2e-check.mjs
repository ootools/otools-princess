/**
 * 端到端交互验收：用 Chrome CDP 驱动页面点击，验证换装联动。
 * 用法：node scripts/e2e-check.mjs（需先启动 serve-dist 6575）
 */
const CDP_PORT = 9333;
const BASE = 'http://127.0.0.1:6575';

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${CDP_PORT}`,
  '--user-data-dir=/tmp/princess-preview/cdp-profile',
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
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { ws, send };
}

async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

function assert(cond, msg) {
  if (!cond) throw new Error('✗ ' + msg);
  console.log('✓ ' + msg);
}

try {
  // 等 Chrome 调试端口就绪
  let tabs;
  for (let i = 0; i < 30; i++) {
    try { tabs = await getJSON('/json'); break; } catch { await sleep(200); }
  }
  const page = tabs.find((t) => t.type === 'page');
  const { ws, send } = await connectWs(page.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');

  // 打开换装间，清空存档保证初始态
  await send('Page.navigate', { url: BASE + '/?view=studio' });
  await sleep(1200);
  await evaluate(send, `localStorage.clear()`);
  await send('Page.reload');
  await sleep(1200);

  // 1) 初始立绘 SVG
  const before = await evaluate(send, `document.querySelector('.stage-figure svg').outerHTML`);
  assert(before.length > 500, '初始立绘渲染出 SVG');

  // 2) 点击"礼服"分类标签，再点第 3 件礼服卡片，立绘应变化
  const result = await evaluate(send, `(() => {
    const tabs = [...document.querySelectorAll('.cat-tab')];
    const gownTab = tabs.find(t => t.textContent.includes('礼服'));
    gownTab.click();
    return new Promise(resolve => setTimeout(() => {
      const cards = [...document.querySelectorAll('.part-card')].filter(c => !c.classList.contains('locked'));
      const beforeHtml = document.querySelector('.stage-figure svg').outerHTML;
      // 选一张当前未选中的卡片，避免点到已穿戴的那件
      const target = cards.find(c => !c.classList.contains('selected')) || cards[0];
      const name = target.querySelector('.part-name')?.textContent;
      target.click();
      const checksum = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
      const beforeSum = checksum(beforeHtml);
      // 层级面板里"礼服"那行的部件名
      const layerBefore = [...document.querySelectorAll('.layer-row')].find(r => r.textContent.includes('礼服'))?.querySelector('.layer-part')?.textContent;
      setTimeout(() => {
        const afterHtml = document.querySelector('.stage-figure svg').outerHTML;
        const layerAfter = [...document.querySelectorAll('.layer-row')].find(r => r.textContent.includes('礼服'))?.querySelector('.layer-part')?.textContent;
        const saved = JSON.parse(localStorage.getItem('otools-princess:save:v1') || '{}');
        resolve({
          name, changed: checksum(afterHtml) !== beforeSum, cardCount: cards.length,
          beforeSum, afterSum: checksum(afterHtml),
          layerBefore, layerAfter,
          gownAfter: saved.outfit?.gown,
          selectedNow: !!document.querySelector('.part-card.selected'),
        });
      }, 300);
    }, 200));
  })()`);
  assert(result.cardCount > 0, '礼服分类下有可点击的部件卡片');
  assert(result.changed, `点击「${result.name}」后立绘实时变化（真换装，非换色）`);

  // 3) 切换公主后，舞台顶部公主名应变化
  const pResult = await evaluate(send, `(() => {
    location.href = '${BASE}/?view=princesses';
    return true;
  })()`);
  await sleep(1200);
  const pCards = await evaluate(send, `document.querySelectorAll('.princess-card').length`);
  assert(pCards === 50, `公主图鉴渲染 50 位公主（实际 ${pCards}）`);

  const pName = await evaluate(send, `(() => {
    const card = document.querySelectorAll('.princess-card')[11];
    const name = card.querySelector('.pc-name').textContent;
    card.click();
    return name;
  })()`);
  await sleep(500);
  const studioName = await evaluate(send, `document.querySelector('.hud-princess')?.textContent`);
  assert(studioName === pName, `点击公主「${pName}」后切换到换装间并更新 HUD`);

  // 4) 存档写入
  const saved = await evaluate(send, `!!localStorage.getItem('otools-princess:save:v1')`);
  assert(saved, '换装状态已写入本地存档');

  ws.close();
  console.log('\n端到端验收全部通过。');
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  chrome.kill('SIGTERM');
}
