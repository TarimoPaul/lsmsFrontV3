// (owner 12/11 fj) every bank / phone account stays open; guards instead, on the PRODUCTION build of V3 feature/t2-cutover
// + backend Docker-local of t2-cutover (GET /api/v1/gl/money-accounts/usage).
//   A1 the usage list: 10 money accounts (1000, 1020-1024, 1030-1033); on the 29/10 copy NBC never used, CRDB last 24/08
//   A2 transfer dialog: the accounts in use (cash, NMB, Selcom, M-Pesa, Tigo) come before CRDB / NBC / PCB / Halopesa / Airtel
//   A3 picking NBC (never used) asks "are you sure?"; Cancel leaves it unpicked, Yes picks it; CRDB asks with its last day
//   A4 picking Selcom (in use, no history before D) or NMB asks nothing
//   A5 "Balance per account" tab: all 10 accounts, the books balance, a typed statement shows the difference; no page errors
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node akaunti_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const PW = 'Akaunti-UI-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IN_USE = /^(Cash|Taslimu|NMB|Selcom|M-Pesa|Tigo Pesa)$/;
const OFF_USE = /^(CRDB|NBC|PCB|HaloPesa|Airtel Money)$/;

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const tok = (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz' }, body: JSON.stringify({ email: CEO, password: PW }) }).then((r) => r.json())).data.tokenInfo.token;
  const usage = (await fetch(API + '/api/v1/gl/money-accounts/usage', { headers: { Origin: 'https://elikom.co.tz', Authorization: 'Bearer ' + tok } }).then((r) => r.json())).data || [];
  const u = Object.fromEntries(usage.map((x) => [x.code, x]));
  const nmbDays = u['1021']?.lastUsed ? (Date.now() - new Date(u['1021'].lastUsed + 'T00:00:00').getTime()) / 86400000 : 999;
  ok('A1 orodha ya matumizi: akaunti 10 za pesa; NBC haijawahi kutumika, CRDB mwisho 2026-08-24', usage.length === 10 && u['1022']?.lastUsed === null && u['1020']?.lastUsed === '2026-08-24' && u['1000'].uses30 > 0, JSON.stringify(usage));

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((x) => !x.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

  await page.goto(V3 + '/general-ledger?tab=journal'); await sleep(3000); await closeBanners();
  await page.getByRole('button', { name: /^(Transfer|Uhamisho)$/ }).first().click(); await sleep(1200);
  const dlg = page.getByRole('dialog').last();
  const toRow = dlg.locator('.chips').nth(1);
  const names = (await toRow.locator('button').allInnerTexts()).map((s) => s.trim());
  const lastIn = Math.max(...names.map((n, i) => (IN_USE.test(n) ? i : -1)));
  const firstOff = Math.min(...names.map((n, i) => (OFF_USE.test(n) ? i : 99)));
  ok('A2 Uhamisho: zinazotumika (taslimu, NMB, Selcom, M-Pesa, Tigo) kabla ya CRDB/NBC/PCB/Halopesa/Airtel', names.length === 10 && lastIn < firstOff, names.join(', '));

  const crdb = toRow.getByRole('button', { name: /^NBC$/ });
  await crdb.click(); await sleep(600);
  const ask = page.getByRole('dialog').filter({ hasText: /(never been used|haijawahi kutumika)/ });
  const asked = await ask.count();
  await ask.getByRole('button', { name: /^(Cancel|Ghairi)$/ }).click(); await sleep(400);
  const offAfterCancel = !(await crdb.getAttribute('class') || '').includes('on');
  await crdb.click(); await sleep(600);
  await page.getByRole('dialog').filter({ hasText: /(never been used|haijawahi kutumika)/ }).getByRole('button', { name: /(Yes, use it|Ndiyo, tumia)/ }).click(); await sleep(400);
  await toRow.getByRole('button', { name: /^CRDB$/ }).click(); await sleep(600);
  const askCrdb = page.getByRole('dialog').filter({ hasText: /(not been used since 2026-08-24|haijatumika tangu 2026-08-24)/ });
  const askedCrdb = await askCrdb.count();
  if (askedCrdb) await askCrdb.getByRole('button', { name: /^(Cancel|Ghairi)$/ }).click(); await sleep(300);
  ok('A3 NBC (haijawahi kutumika): inauliza; Ghairi = haichaguliwi; Ndiyo = imechaguliwa; CRDB inauliza "tangu 2026-08-24"', asked === 1 && offAfterCancel && (await crdb.getAttribute('class') || '').includes('on') && askedCrdb === 1);

  const ask0 = async (name) => { await toRow.getByRole('button', { name }).click(); await sleep(600); return page.getByRole('dialog').filter({ hasText: /(are you sure|una uhakika)/ }).count(); };
  const aSel = await ask0(/^Selcom$/); const selOn = (await toRow.getByRole('button', { name: /^Selcom$/ }).getAttribute('class') || '').includes('on');
  const aNmb = await ask0(/^NMB$/);
  ok(`A4 Selcom (inatumika, haina historia kabla ya D) na NMB (siku ${Math.round(nmbDays)}): haziulizi`, aSel === 0 && selOn && aNmb === 0, `selcom=${aSel} nmb=${aNmb}`);
  await page.keyboard.press('Escape'); await sleep(400);

  await page.goto(V3 + '/general-ledger?tab=money'); await sleep(3500); await closeBanners();
  const t = page.locator('[data-test="salio-kwa-akaunti"]');
  await t.waitFor({ timeout: 20000 });
  const rows = await t.locator('tbody tr').count();
  const cashRow = t.locator('tbody tr[data-code="1000"]');
  const books = Number((await cashRow.locator('td').nth(1).innerText()).replace(/[^\d.-]/g, ''));
  await cashRow.locator('input').fill(String(books + 500)); await sleep(300);
  const diff = (await cashRow.locator('td').nth(3).innerText()).replace(/[^\d.-]/g, '');
  ok('A5 "Salio kwa akaunti": akaunti 10, tofauti ya taarifa inaonyeshwa (+500); hakuna makosa ya ukurasa', rows === 10 && books !== 0 && diff === '500' && errors.length === 0, `rows=${rows} books=${books} diff=${diff} ${errors.join(' | ').slice(0, 200)}`);

  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
