// 6e (owner 12/11 ga) the "Compare purchases" warning in the UI (PRODUCTION build of V3 t2-cutover + backend t2-cutover up
// with LSMS_PURCHASE_CHECK_FROM=2026-11-01). Run after manunuzi_onyo_api (its day X is settled).
//   W1 a reco of 2026-11-08 with drawer purchases 150,000 and nothing paid from the drawer around it -> the purchases page
//      shows "Reco ya 2026-11-08 inaonyesha manunuzi ya droo 150,000; yaliyoandikwa 0"; no page errors
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node manunuzi_onyo_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const { ensureSeller } = require('./e2e-muuzaji.cjs');

const V3 = 'http://127.0.0.1:4300/v3';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Manunuzi-Onyo-UI-Local-2026';
const DAY = '2026-11-08';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const realMgrUid = sql(`select uid from users where email = '${MGR}'`);
  const mgrUid = ensureSeller(MGR, PW); // (ge) E2E seller: its days are always free; the real manager's day is never locked
  const brUid = sql(`select branch_uid from daily_reconciliation where user_uid = '${realMgrUid}' and branch_uid is not null order by reconciliation_date desc limit 1`);
  // (ge) the reco total of the day before this test (a dump with real data may already have reco purchases on that day)
  const r0 = Number(sql(`select coalesce(sum(p.amount), 0) from reconciliation_purchases p join daily_reconciliation r on r.uid = p.reconciliation_uid where not p.is_deleted and not r.is_deleted and r.reconciliation_date = '${DAY}'`));
  const want = (r0 + 150000).toLocaleString('en-US');
  const ru = `e2e-6e-ui-${Date.now()}`;
  sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status) values ('${ru}', now(), '${DAY}', '${mgrUid}', 'E2E Muuzaji', '${brUid}', 'DRAFT')`);
  sql(`insert into reconciliation_purchases (uid, created_at, is_active, is_deleted, is_verified, reconciliation_uid, supplier_name, description, amount) values ('${ru}-p', now(), true, false, true, '${ru}', 'Coca', 'E2E 6e UI Coca malipo ya droo', 150000)`);

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
  await page.goto(V3 + '/purchases'); await sleep(3500);
  const box = page.locator('[data-test="linganisha-manunuzi"]');
  const text = (await box.count()) ? (await box.innerText()).replace(/\s+/g, ' ') : '';
  ok('W1 ukurasa wa manunuzi: "Linganisha manunuzi — Reco ya 2026-11-08 inaonyesha manunuzi ya droo 150,000; yaliyoandikwa 0"; hakuna makosa ya ukurasa',
    /(Compare purchases|Linganisha manunuzi)/.test(text) && /2026-11-08/.test(text) && text.includes(want) && errors.length === 0, `want=${want} ${text.slice(0, 300)} | ${errors.join(' | ').slice(0, 200)}`);

  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
