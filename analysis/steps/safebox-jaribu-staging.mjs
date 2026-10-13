// Safe box "wasilisha nusu" on STAGING (tunnel localhost:8081, backend 2.2.69), as root. WRITES TO STAGING ONLY:
// reviews + approves macheda's reconciliation of 2026-10-11, submits one partial deposit (10,000 of 21,000,
// with a reason) and confirms it. Then opens the V3 of main (localhost:3456) and photographs the manager view.
// The password comes from the ROOT_PASS env var and is never written out.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const API = 'http://localhost:8081', UI = 'http://localhost:3456';
const RECON_1011 = '6c17e34d-fb0e-4424-8183-a4ff037d4dfe', ENTRY_140 = 'ab8ea4cc-1104-41db-bdea-d1667ebdf970', ENTRY_21 = '8086d119-3c22-44d4-b384-0ee2820e21d3';
let pass = 0, total = 0;
const ok = (n, c, d = '') => { total++; if (c) pass++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d !== '' ? '  -- ' + d : ''}`); return c; };
const short = (v) => JSON.stringify(v).slice(0, 500);

const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'root@system.com', password: process.env.ROOT_PASS }) });
if (!res.ok) { console.log('LOGIN_IMESHINDWA', res.status); process.exit(1); }
const H = { Authorization: `Bearer ${(await res.json()).data.tokenInfo.token}`, 'Content-Type': 'application/json' };
const call = async (method, u, body) => {
  const r = await fetch(API + u, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); }
  return { status: r.status, data: j?.data ?? j, raw: j };
};
const entry = async (uid) => (await call('GET', '/api/v1/safe-box/outstanding')).data.flatMap((c) => c.entries).find((e) => e.cashEntryUid === uid);

// ── 1. approve the day that holds the waiting 110,000 deposit ──
let recon = (await call('GET', `/api/v1/reconciliation/${RECON_1011}`)).data;
console.log(`recon 2026-10-11: status ${recon.status}, safeBoxTotal ${recon.safeBoxTotal}`);
ok('before approval the 140,000 entry is not on the outstanding list', !(await entry(ENTRY_140)));
if (recon.status === 'SUBMITTED') { const r = await call('POST', `/api/v1/reconciliation/${RECON_1011}/review`, {}); console.log('review ->', r.status, r.status >= 400 ? short(r.raw) : r.data?.status); }
recon = (await call('GET', `/api/v1/reconciliation/${RECON_1011}`)).data;
if (recon.status === 'REVIEWED') { const r = await call('POST', `/api/v1/reconciliation/${RECON_1011}/approve`, {}); console.log('approve ->', r.status, r.status >= 400 ? short(r.raw) : r.data?.status); }
recon = (await call('GET', `/api/v1/reconciliation/${RECON_1011}`)).data;
ok('the day is approved although its safe box money is not confirmed', recon.status === 'APPROVED', recon.status);
let e140 = await entry(ENTRY_140);
ok('approved day: 140,000 entry listed with remaining 140,000 and 110,000 waiting', !!e140 && e140.amount === 140000 && e140.remaining === 140000 && e140.pendingTotal === 110000, short(e140));

// ── 2. partial submission with a reason ──
const before = await entry(ENTRY_21);
console.log('21,000 entry before:', short(before));
const sub = await call('POST', '/api/v1/safe-box/deposit', { cashEntryUid: ENTRY_21, submittedAmount: 10000, depositType: 'BANK_DEPOSIT', bankName: 'NMB', receiptNumber: 'QA-SAFEBOX', recipientUid: null, remainderReason: 'QA: chenchi' });
console.log('submit 10,000 ->', sub.status, short(sub.raw));
if (ok('partial deposit accepted (10,000 of 21,000)', sub.status < 300 && sub.data?.status === 'PENDING', `status ${sub.status}`)) {
  const dep = sub.data;
  ok('deposit keeps the reason for the rest', dep.remainderReason === 'QA: chenchi', String(dep.remainderReason));
  console.log(`     deposit cashier: ${dep.cashierName} (${dep.cashierUid}) — entry owner is macheda (0d75927b…)`);
  let e21 = await entry(ENTRY_21);
  ok('outstanding: remaining stays 21,000, waiting 10,000 (so 11,000 still to bring)', e21?.remaining === 21000 && e21?.pendingTotal === 10000, short(e21));
  const over = await call('POST', '/api/v1/safe-box/deposit', { cashEntryUid: ENTRY_21, submittedAmount: 12000, depositType: 'BANK_DEPOSIT', bankName: 'NMB', receiptNumber: null, recipientUid: null, remainderReason: null });
  ok('a second deposit above the 11,000 left is refused', over.status >= 400, `${over.status} ${short(over.raw)}`);
  if (over.status < 300 && over.data?.uid) console.log('     cleanup of the wrongly accepted deposit ->', (await call('DELETE', `/api/v1/safe-box/${over.data.uid}?reason=QA`)).status);

  // ── 3. the manager view in the browser, while two deposits are waiting ──
  await ui();

  // ── 4. manager confirms the partial deposit ──
  const conf = await call('POST', `/api/v1/safe-box/${dep.uid}/confirm`, {});
  console.log('confirm ->', conf.status, conf.status >= 400 ? short(conf.raw) : '');
  e21 = await entry(ENTRY_21);
  ok('after confirming: confirmed 10,000, remaining 11,000, nothing waiting', e21?.confirmedTotal === 10000 && e21?.remaining === 11000 && e21?.pendingTotal === 0, short(e21));
} else {
  await ui();
}
console.log('\noutstanding at the end:', JSON.stringify((await call('GET', '/api/v1/safe-box/outstanding')).data));
console.log(`\n${pass}/${total} passed`);

async function ui() {
  const E2E = 'C:/Users/chief/AppData/Local/Temp/claude/D--MY-PROJECT-DUKA-PROJECT-LsmsVersion3-lsmsFrontV3/b52d2f7c-9024-4194-83c7-a51c4597330e/scratchpad/e2e';
  const OUT = path.resolve('analysis/steps/safebox-shots'); fs.mkdirSync(OUT, { recursive: true });
  let b;
  try {
    const puppeteer = createRequire(E2E + '/x.js')('puppeteer-core');
    b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--disable-gpu', '--disable-extensions'], defaultViewport: { width: 1400, height: 1100 } });
    const p = await b.newPage();
    const apiErrors = [], consoleErrors = [];
    p.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    p.on('pageerror', (e) => consoleErrors.push(String(e)));
    p.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) apiErrors.push(`${r.status()} ${r.request().method()} ${r.url().replace(UI, '')}`); });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const txt = async (sel) => (await p.$$eval(sel, (els) => els.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))).join(' || ');
    await p.goto(`${UI}/login`, { waitUntil: 'networkidle0' });
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('app_language', 'sw'); });
    await p.reload({ waitUntil: 'networkidle0' });
    await p.type('lsms-text-field[formcontrolname="email"] input', 'root@system.com');
    await p.type('lsms-text-field[formcontrolname="password"] input', process.env.ROOT_PASS);
    await p.click('form button[type="submit"]');
    await p.waitForFunction(() => location.pathname.endsWith('/dashboard'), { timeout: 30000 });
    await p.waitForSelector('app-safe-box-banner .bar', { timeout: 20000 }).catch(() => {});
    const banner = await txt('app-safe-box-banner .bar');
    console.log('     banner:', banner);
    ok('UI: banner after login tells the manager about the waiting deposits', /Deposit 2 za sefu zinakusubiri/.test(banner), banner);
    ok('UI: banner says what cashiers still hold, not yet submitted (4,500 + 11,000 + 30,000 = 45,500)', /45,500/.test(banner), banner);
    await sleep(600); await p.screenshot({ path: path.join(OUT, '1-banner.png') });
    await p.evaluate(() => [...document.querySelectorAll('app-safe-box-banner button')].find((x) => /Fungua sefu/.test(x.textContent))?.click());
    await p.waitForSelector('app-recon-safebox-tab', { timeout: 20000 });
    ok('UI: "Fungua sefu" opens Reconciliation on the Safe box tab', /tab=safebox/.test(p.url()), p.url());
    await sleep(2500);
    const blocks = await txt('app-recon-safebox-tab section.block');
    console.log('     tab:', blocks.slice(0, 1500));
    ok('UI: "to confirm" lists the partial deposit with its reason', /QA: chenchi/.test(blocks));
    await p.evaluate(() => document.querySelectorAll('app-recon-safebox-tab .owe-head').forEach((x) => x.click()));
    await sleep(600);
    const owe = await txt('app-recon-safebox-tab .owe');
    console.log('     owed:', owe.slice(0, 1200));
    ok('UI: owed list shows amount / waiting / still to bring per day', /inasubiri 110,000/.test(owe) && /bado kuleta 30,000/.test(owe) && /inasubiri 10,000/.test(owe) && /bado kuleta 11,000/.test(owe));
    await p.screenshot({ path: path.join(OUT, '2-safebox-tab.png'), fullPage: true });
    await p.setViewport({ width: 390, height: 844 });
    await sleep(800);
    ok('UI: no horizontal overflow at 390px', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await p.screenshot({ path: path.join(OUT, '3-mobile.png') });
    ok('UI: no failed API calls', apiErrors.length === 0, apiErrors.join(' ; '));
    ok('UI: no console errors', consoleErrors.length === 0, consoleErrors.join(' ; ').slice(0, 400));
  } catch (e) {
    ok('UI run finished without exception', false, String(e).slice(0, 400));
  } finally {
    await b?.close();
  }
}
