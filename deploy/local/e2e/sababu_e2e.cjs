// (bv) 02/11 reason quality end to end on the PRODUCTION build: V3 Docker-local (127.0.0.1:4300/v3) in front of the
// backend Docker-local (release/2.4.0 with ReasonQuality). Junk reasons ("6666666666", "rrrrrrrrrr") are refused by the
// UI (button off + hint) AND by the server (direct API), for: sale delete, reco unsubmit, reco reopen, variance
// explanation. Setup touches ONLY the throw-away local copy, and puts back what it changed (reco status).
// Run: NODE_PATH=<npx playwright node_modules> node sababu_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const { countingGuardFresh } = require('./e2e-muuzaji.cjs');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const MGR = 'macheda@gmail.com', CEO = 'tarimo@gmail.com';
const PW = 'Sababu-Jaribio-Local-2026';
const JUNK = ['6666666666', 'rrrrrrrrrr', 'ab ab ab ab ab'];
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const shortReceipt = (r) => (/^RCP-\d{8}-(.+)$/.exec(r) || [null, r])[1];

function sql(q) {
  return execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
}
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const apiToken = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
const refused = (r) => r.j && r.j.status !== 'Success' && /haieleweki/.test(String(r.j.message || '') + JSON.stringify(r.j.data || ''));

async function login(page, email) {
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${MGR}','${CEO}')`);
  sql("update counting_session set started_at = '2026-06-01 06:00' where started_at > '2026-06-01 06:00'");
  await countingGuardFresh(); // (gq) the guard caches the latest count for 60 s: a test that ran just before (a6) had loaded the real one
  const [suid, srcpt, sday] = sql("select s.uid, s.receipt_number, s.sale_date::date from sales s where s.is_active and not exists (select 1 from daily_reconciliation dr where dr.reconciliation_date = s.sale_date::date and dr.user_uid = s.user_uid) and exists (select 1 from sales_details d where d.sale_uid = s.uid) order by s.sale_date desc limit 1").split('|');
  // newest APPROVED reco of MANAGER: R1 is put to SUBMITTED for the unsubmit test (and put back), R2 stays APPROVED for reopen
  const recos = sql("select d.uid || ':' || d.reconciliation_date || ':' || d.status from daily_reconciliation d join users u on u.uid = d.user_uid where u.email = 'macheda@gmail.com' and not d.is_deleted and d.status = 'APPROVED' order by d.reconciliation_date desc limit 2").split('\n');
  const [r1, r1day] = recos[0].split(':');
  const [r2] = recos[1].split(':');
  sql(`update daily_reconciliation set status = 'SUBMITTED' where uid = '${r1}'`);
  const r1expl = sql(`select coalesce(variance_explanation, '<null>') from daily_reconciliation where uid = '${r1}'`);
  console.log('SALE', srcpt, sday, '| R1', r1, r1day, '| R2', r2);

  const browser = await chromium.launch();
  const errors = [];
  try {
    // ---- A. sale delete dialog (UI)
    const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await login(page, MGR);
    await page.goto(`${V3}/sales?date=${sday}`);
    const row = page.locator('tr, .m-row, li, .row').filter({ hasText: shortReceipt(srcpt) }).first();
    await row.waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    const closeAll = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
    if (await closeAll.count()) await closeAll.first().click();
    await row.getByRole('button', { name: /Actions|Vitendo/ }).first().click();
    await page.getByRole('menuitem', { name: /^(Delete|Futa)$/ }).click();
    const dlg = page.locator('app-reason-dialog');
    await dlg.locator('textarea').waitFor();
    const confirm = dlg.getByRole('button', { name: /^(Delete|Futa)$/ });
    for (const j of JUNK) {
      await dlg.locator('textarea').fill(j);
      ok(`A1 "${j}" -> kitufe kimezimwa`, await confirm.isDisabled());
      ok(`A2 "${j}" -> maelezo ya kosa yanaonekana`, (await dlg.locator('.junk').count()) === 1);
    }
    await dlg.locator('textarea').fill('Mteja alibadilisha mawazo');
    ok('A3 sababu halisi -> kitufe kinawaka, maelezo ya kosa yanaondoka', !(await confirm.isDisabled()) && (await dlg.locator('.junk').count()) === 0);
    await dlg.getByRole('button', { name: /^(Cancel|Ghairi)$/ }).click();
    ok('A4 DB: mauzo bado hai (tuliahirisha)', sql(`select is_active from sales where uid='${suid}'`) === 't');

    // ---- B. server refuses junk even without the UI
    const mt = await apiToken(MGR);
    const ct = await apiToken(CEO);
    const d = await api('DELETE', `/api/v1/sales/${suid}?deleteReason=${encodeURIComponent('6666666666')}`, mt);
    ok('B1 API: kufuta kwa "6666666666" kunakataliwa', refused(d), JSON.stringify(d.j).slice(0, 200));
    ok('B2 DB: mauzo bado hai', sql(`select is_active from sales where uid='${suid}'`) === 't');
    const u = await api('POST', `/api/v1/reconciliation/${r1}/unsubmit`, mt, { reason: 'rrrrrrrrrr' });
    ok('B3 API: unsubmit kwa "rrrrrrrrrr" kunakataliwa', refused(u), JSON.stringify(u.j).slice(0, 200));
    ok('B4 DB: reco bado SUBMITTED', sql(`select status from daily_reconciliation where uid='${r1}'`) === 'SUBMITTED');
    const ro = await api('POST', `/api/v1/reconciliation/${r2}/reopen?reason=${encodeURIComponent('6666666666666')}`, ct, {});
    ok('B5 API: reopen kwa "6666666666666" kunakataliwa', refused(ro), JSON.stringify(ro.j).slice(0, 200));
    ok('B6 DB: reco ya pili bado APPROVED', sql(`select status from daily_reconciliation where uid='${r2}'`) === 'APPROVED');

    // ---- C. reco approval tab: unsubmit prompt (UI)
    await page.addInitScript(() => { try { localStorage.setItem('lsms.recon.tab', 'approval'); } catch { /* */ } });
    await page.goto(`${V3}/reconciliation?date=${r1day}`);
    const back = page.getByRole('button', { name: /^(Take back to fix|Rudisha kwa marekebisho)$/ });
    await back.waitFor({ timeout: 30000 });
    await back.click();
    const prompt = page.locator('section.prompt');
    await prompt.locator('textarea').waitFor();
    const pc = prompt.getByRole('button', { name: /^(Confirm|Thibitisha)$/ });
    await prompt.locator('textarea').fill('rrrrrrrrrr');
    ok('C1 unsubmit "rrrrrrrrrr" -> kitufe kimezimwa', await pc.isDisabled());
    ok('C2 maelezo ya kosa yanaonekana', (await prompt.locator('.junk-hint').count()) === 1);
    await prompt.locator('textarea').fill('Nilisahau expense ya umeme');
    ok('C3 sababu halisi -> kitufe kinawaka', !(await pc.isDisabled()));
    await prompt.getByRole('button', { name: /^(Cancel|Ghairi)$/ }).click();
    ok('C4 DB: reco bado SUBMITTED', sql(`select status from daily_reconciliation where uid='${r1}'`) === 'SUBMITTED');
    ok('C5 hakuna makosa ya ukurasa', errors.length === 0, errors.join(' | ').slice(0, 300));
  } finally {
    await browser.close();
    sql(`update daily_reconciliation set status = 'APPROVED' where uid = '${r1}'`);
  }
  ok('D1 reco imerudishwa APPROVED na maelezo hayakubadilika',
    sql(`select status || '|' || coalesce(variance_explanation, '<null>') from daily_reconciliation where uid='${r1}'`) === 'APPROVED|' + r1expl);
  console.log(`MUHTASARI sababu: PASS ${P}, FAIL ${F}`);
  process.exit(F === 0 ? 0 : 1);
})().catch((e) => { console.log('FAIL kosa', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); process.exit(1); });
