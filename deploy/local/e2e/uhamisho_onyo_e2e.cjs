// (owner 12/11 fv) the Transfer dialog warns (never blocks) when a CEO Transfer 1000 -> bank has the same amount, bank and
// day as a deposit the seller already wrote on his reco; Selcom -> NMB gets no warning. PRODUCTION build of V3 t2-cutover +
// backend Docker-local of t2-cutover, D set. Run after pengo_d_api (its reco of 2026-11-05 has NMB 300,000 "cash ya mauzo").
//   U1 Taslimu -> NMB 300,000 on 2026-11-05: the warning names the reco of that day; Cancel -> nothing posted
//   U2 the same, "Yes, record it" -> posted (a warning, not a block)
//   U3 Selcom -> NMB 5,000: no warning, posted
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node uhamisho_onyo_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const PW = 'Onyo-Uhamisho-Local-2026';
const DAY = '2026-11-05';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const transfers = (why) => Number(sql(`select count(*) from journal_entry where status = 'POSTED' and reference_number ilike '%${why}%'`));

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  ok('U0 reco ya 2026-11-05 ina amana NMB 300,000 (pengo_d_api)', sql(`select count(*) from reconciliation_cash_entries e join daily_reconciliation r on r.uid = e.reconciliation_uid where r.reconciliation_date = '${DAY}' and e.bank_name = 'NMB' and e.amount = 300000 and not e.is_deleted`) === '1');

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

  /** Opens the dialog, fills it, presses "Record transfer"; returns the warning dialog (count 0 = none). */
  const fill = async (from, to, amount, why) => {
    await page.goto(V3 + '/general-ledger?tab=journal'); await sleep(2500); await closeBanners();
    await page.getByRole('button', { name: /^(Transfer|Uhamisho)$/ }).first().click(); await sleep(1000);
    const dlg = page.getByRole('dialog').last();
    await dlg.locator('.chips').nth(0).getByRole('button', { name: from }).click(); await sleep(400);
    await dlg.locator('.chips').nth(1).getByRole('button', { name: to }).click(); await sleep(400);
    await dlg.locator('input[lsmsMoneyInput]').first().fill(String(amount));
    await dlg.locator('input[type="date"]').fill(DAY); await dlg.locator('input[type="date"]').dispatchEvent('change');
    await dlg.locator('[data-test="sababu"]').fill(why);
    await dlg.getByRole('button', { name: /^(Record transfer|Andika uhamisho)$/ }).click(); await sleep(1500);
    return page.getByRole('dialog').filter({ hasText: /(Possible double entry|Huenda ni mara mbili)/ });
  };

  let w = await fill(/^(Cash|Taslimu)$/, /^NMB$/, 300000, 'E2E onyo U1 droo NMB');
  const text = (await w.count()) ? await w.innerText() : '';
  await w.getByRole('button', { name: /^(Cancel|Ghairi)$/ }).click(); await sleep(800);
  ok('U1 Taslimu -> NMB 300,000: onyo "Huenda imeshaandikwa kwenye reco ya 2026-11-05"; Ghairi -> haikuandikwa',
    /(reco ya 2026-11-05|reco of 2026-11-05)/.test(text) && transfers('E2E onyo U1') === 0, text.slice(0, 200));
  await page.keyboard.press('Escape'); await sleep(300);

  w = await fill(/^(Cash|Taslimu)$/, /^NMB$/, 300000, 'E2E onyo U2 droo NMB');
  await w.getByRole('button', { name: /(Yes, record it|Ndiyo, andika)/ }).click(); await sleep(1500);
  ok('U2 "Ndiyo, andika" -> imeandikwa (onyo, si kizuizi)', transfers('E2E onyo U2') === 1);

  w = await fill(/^Selcom$/, /^NMB$/, 5000, 'E2E onyo U3 Selcom NMB');
  const none = await w.count();
  await sleep(500);
  ok('U3 Selcom -> NMB: hakuna onyo, imeandikwa; hakuna makosa ya ukurasa', none === 0 && transfers('E2E onyo U3') === 1 && errors.length === 0, `onyo=${none} ${errors.join(' | ').slice(0, 200)}`);

  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
