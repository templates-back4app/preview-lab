// Loads the deployed app in a real browser and records what a person would see,
// plus what the API itself thinks happened -- which is the part that misleads.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HOST = `http://127.0.0.1:${process.env.HOST_PORT ?? 7502}`;
const LOG = process.env.API_LOG ?? '/tmp/preview-lab-api.log';
const CAP_MS = 6000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  #ws; #id = 0; #p = new Map(); #l = new Map();
  static async attach(u) {
    const c = new CDP(); c.#ws = new WebSocket(u);
    await new Promise((ok, e) => { c.#ws.onopen = ok; c.#ws.onerror = () => e(new Error('cannot attach')); });
    c.#ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
      if (m.id && c.#p.has(m.id)) { const { ok, err } = c.#p.get(m.id); c.#p.delete(m.id);
        m.error ? err(new Error(m.error.message)) : ok(m.result); }
      else if (m.method) for (const fn of c.#l.get(m.method) ?? []) fn(m.params, m.sessionId); };
    return c; }
  send(method, params = {}, sessionId) { const id = ++this.#id;
    this.#ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((ok, err) => this.#p.set(id, { ok, err })); }
  on(m, fn) { this.#l.set(m, [...(this.#l.get(m) ?? []), fn]); }
  close() { this.#ws.close(); }
}

async function startChrome() {
  const dir = await mkdtemp(join(tmpdir(), 'preview-'));
  const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--remote-debugging-port=0',
    `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  const url = await new Promise((ok, err) => { let b = '';
    proc.stderr.on('data', (d) => { b += d; const m = b.match(/ws:\/\/[^\s]+/); if (m) ok(m[0]); });
    setTimeout(() => err(new Error('no debugger url')), 15000); });
  return { proc, dir, url };
}

async function visit(cdp, url, { click } = {}) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  await S('Page.enable'); await S('Runtime.enable'); await S('Network.enable');

  let docStatus = null;
  cdp.on('Network.responseReceived', (p, sid) => {
    if (sid === sessionId && p.type === 'Document' && docStatus === null) docStatus = p.response.status;
  });

  S('Page.navigate', { url }).catch(() => {});
  const read = async (expr) => {
    const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true }).catch(() => null);
    return r?.result?.value ?? null;
  };

  const t0 = Date.now();
  let seen = null;
  while (Date.now() - t0 < CAP_MS) {
    seen = await read(`JSON.stringify({
      title: (document.getElementById('title')||{}).textContent ?? null,
      orders: document.querySelectorAll('.order').length,
      state: (document.getElementById('state')||{}).textContent ?? null,
      signin: (document.getElementById('signin')||{}).href ?? null,
      url: location.href })`);
    const o = seen ? JSON.parse(seen) : null;
    if (o?.state && o.state !== 'loading') { seen = o; break; }
    seen = o; await sleep(100);
  }

  let landed = null;
  if (click && seen?.signin) {
    await S('Page.navigate', { url: seen.signin }).catch(() => {});
    await sleep(1200);
    const here = await read('location.href');
    const body = await read('document.body ? document.body.innerText.slice(0,60) : null');
    landed = { url: here, loaded: !!body && !/ERR_|refused|not available/i.test(body) };
  }

  await cdp.send('Target.closeTarget', { targetId });
  return { docStatus, ...(seen ?? {}), landed };
}

const label = process.argv[2] ?? 'run';
const { proc, dir, url: ws } = await startChrome();
const cdp = await CDP.attach(ws);

const deep = await visit(cdp, `${HOST}/orders`);            // a url typed into the address bar
const home = await visit(cdp, `${HOST}/`, { click: true }); // the home page, then sign in

cdp.close(); proc.kill();
await new Promise((ok) => { proc.once('exit', ok); setTimeout(ok, 5000); });
await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});

const apiLog = await readFile(LOG, 'utf8').catch(() => '');
const ordersLine = apiLog.trim().split('\n').filter((l) => l.includes('/api/orders')).pop() ?? '(no request reached the api)';

const row = (a, b) => console.log(`    ${a.padEnd(38)} ${b}`);
console.log('');
console.log(`  ${label}`);
console.log('');
row('/orders typed into the address bar', deep.docStatus === 200 ? `HTTP 200, shows "${deep.title}"` : `HTTP ${deep.docStatus}`);
row('orders shown on the home page', `${home.orders} of 3${home.state?.startsWith('failed') ? ` — ${home.state}` : ''}`);
row('what the api says about that request', ordersLine.trim());
row('where "sign in" lands', home.landed ? `${home.landed.url} — ${home.landed.loaded ? 'loaded' : 'nothing there'}` : 'no link');
console.log('');
