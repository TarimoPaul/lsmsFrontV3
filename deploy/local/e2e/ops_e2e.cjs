// (ew/ex, owner 11/11) "Ondoa kwenye ripoti ya uendeshaji" on the PRODUCTION build of feature/t2-ripoti + backend
// Docker-local of the same branch (V145). Throw-away local copy only.
//   API  no CAPITAL_APPROVE -> 403; short / junk reason -> 400; a daily row -> 400; twice -> 400
//   Oct  "Malipo Ya Dereva (2026-10)" 150,000 (journal 01/10) left out: daily P&L Oct monthly -150,000, net +150,000;
//        bridge: new line "Marekebisho ya 2026 (hatua 80)" = -150,000, unexplained unchanged; GL net / TB / 6200 unchanged
//   Nov  (ew) a Nov child of Frame on top of the year's share (test row, no journal): report Nov = share only after it is
//        left out; put back -> counted again; the log has who / why for every change; auditors read the list
//   UI   CEO: "Ondoa kwenye ripoti" with a reason -> pill "nje ya ripoti ya uendeshaji" + the list "Nje ya ripoti"
// Run: NODE_PATH=<npx playwright node_modules> node ops_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const OUT = 'printer@elikom.co.tz'; // no CAPITAL_APPROVE on the 29/10 copy
const PW = 'Ops-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j?.data?.tokenInfo?.token;
const tb = () => sql("select round(sum(l.debit_amount - l.credit_amount), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)");
const acct = (c) => sql(`select round(coalesce(sum(l.debit_amount - l.credit_amount),0), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '${c}'`);
const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.02;
const pad = (n) => String(n).padStart(2, '0');
const d = new Date();
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthStart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${OUT}')`);
  const ceo = await login(CEO); const out = await login(OUT);
  const pnl = async (f, t) => (await api('GET', `/api/reports/daily-pnl?from=${f}&to=${t}`, ceo)).j?.data?.totals;
  const bridge = async (f, t) => (await api('GET', `/api/v1/reports/pnl-bridge?from=${f}&to=${t}`, ceo)).j?.data;
  const line = (b, code) => Number((b?.lines || []).find((l) => l.code === code)?.amount || 0);
  const excl = (uid, exclude, reason, tok = ceo) => api('POST', `/api/v1/capital-expenditure/${uid}/ops-report-exclusion`, tok, { exclude, reason });

  // ── Oct: a posted monthly row ──
  const R = sql("select uid from capital_expenditure where reference_number = 'OPE-MON-20261001-000000-F1C30121'");
  const DAILY = sql("select uid from capital_expenditure where expenditure_type = 'DAILY_EXPENSE' and not is_deleted order by id desc limit 1");
  const p0 = await pnl('2026-10-01', '2026-10-31'); const b0 = await bridge('2026-10-01', '2026-10-31');
  const g0 = { tb: tb(), e6200: acct('6200'), c1000: acct('1000') };
  const r403 = await excl(R, true, 'zimeshughulikiwa na hatua 80', out);
  ok('A1 bila CAPITAL_APPROVE -> 403', r403.status === 403, `${r403.status}`);
  const rShort = await excl(R, true, 'hatua 80');
  const rJunk = await excl(R, true, 'rrrrrrrrrrrrrr');
  ok('A2 sababu fupi / takataka -> 400, hakuna kilichobadilika', rShort.status === 400 && rJunk.status === 400 && sql(`select exclude_from_ops_report from capital_expenditure where uid='${R}'`) === 'f', `${rShort.status} ${rJunk.status}`);
  const rDaily = await excl(DAILY, true, 'zimeshughulikiwa na hatua 80');
  ok('A3 gharama ya siku (si ya mwezi) -> 400', rDaily.status === 400, `${rDaily.status} ${rDaily.j?.message}`);
  const r1 = await excl(R, true, 'Jaribio E2E: zimeshughulikiwa na hatua 80');
  ok('A4 CEO + sababu -> SAWA', r1.j?.status === 'Success', `${r1.status} ${r1.j?.message}`);
  const rTwice = await excl(R, true, 'Jaribio E2E: zimeshughulikiwa na hatua 80');
  ok('A5 mara ya pili -> 400', rTwice.status === 400, `${rTwice.status}`);
  const p1 = await pnl('2026-10-01', '2026-10-31'); const b1 = await bridge('2026-10-01', '2026-10-31');
  ok('O1 ripoti ya Okt: gharama za mwezi -150,000, faida +150,000', eq(Number(p0.monthlyExpenses) - Number(p1.monthlyExpenses), 150000) && eq(Number(p1.netProfit) - Number(p0.netProfit), 150000),
    `${p0.monthlyExpenses} -> ${p1.monthlyExpenses}; ${p0.netProfit} -> ${p1.netProfit}`);
  ok('O2 daraja: mstari IMEONDOLEWA_KWENYE_RIPOTI = -150,000 (hatua 80), GHARAMA_ZA_MWEZI haijabadilika, isiyoelezeka haijabadilika, GL net ileile',
    eq(line(b1, 'IMEONDOLEWA_KWENYE_RIPOTI'), -150000) && /hatua 80/.test((b1.lines.find((l) => l.code === 'IMEONDOLEWA_KWENYE_RIPOTI') || {}).nameSw || '')
    && eq(line(b1, 'GHARAMA_ZA_MWEZI'), line(b0, 'GHARAMA_ZA_MWEZI')) && eq(b1.unexplained, b0.unexplained) && eq(b1.glNet, b0.glNet),
    JSON.stringify({ l: line(b1, 'IMEONDOLEWA_KWENYE_RIPOTI'), m0: line(b0, 'GHARAMA_ZA_MWEZI'), m1: line(b1, 'GHARAMA_ZA_MWEZI'), u0: b0.unexplained, u1: b1.unexplained }));
  ok('O3 GL haijaguswa: TB, 6200, 1000 vilevile; row na journal yake bado zipo', tb() === g0.tb && acct('6200') === g0.e6200 && acct('1000') === g0.c1000
    && sql(`select count(*) from journal_entry where reference_uid='${R}' and not coalesce(is_deleted,false)`) === '1', `${tb()} ${acct('6200')}`);

  // ── Nov (ew): Frame child on top of the year's share ──
  sql("delete from capital_expenditure where reference_number = 'REN-MON-20261101-000000-E2EOPS01'");
  const share = sql("select uid from capital_expenditure where reference_number = 'OPE-MON-20260101-000000-F7C9E331'");
  const nBase = Number((await pnl(monthStart, today)).monthlyExpenses);
  sql(`insert into capital_expenditure (uid, created_at, is_active, is_deleted, capital_type, expenditure_type, expenditure_frequency, source, amount, description, transaction_date,
         reference_number, is_from_product_capital, affects_daily_profit, is_asset, salvage_value, accumulated_depreciation, is_recurring, recurring_active, is_approved, status,
         allocated_year, allocated_month, payment_method, exclude_from_ops_report)
       select gen_random_uuid()::text, now(), true, false, capital_type, 'MONTHLY_EXPENSE', expenditure_frequency, source, 200000, 'Malipo Ya Kodi YA Frame (2026-11) E2E', '${monthStart} 00:00',
         'REN-MON-20261101-000000-E2EOPS01', false, false, false, 0, 0, false, true, true, 'APPROVED', 2026, 11, 'CASH', false
       from capital_expenditure where uid = '${share}'`);
  const N = sql("select uid from capital_expenditure where reference_number = 'REN-MON-20261101-000000-E2EOPS01'");
  const nDouble = Number((await pnl(monthStart, today)).monthlyExpenses);
  ok('N1 (ew) Nov inaonyesha Frame mara mbili (share + mtoto wa Nov)', N && nDouble > nBase + 1, `${nBase} -> ${nDouble}`);
  await excl(N, true, 'zimeshughulikiwa na hatua 80');
  ok('N2 baada ya kuondolewa: Nov = share ya mwaka tu (sawa na kabla ya mtoto)', eq(Number((await pnl(monthStart, today)).monthlyExpenses), nBase), `${nBase}`);
  const back = await excl(N, false, 'Jaribio E2E: kurudisha kwenye ripoti');
  ok('N3 kurudisha -> inahesabiwa tena', back.j?.status === 'Success' && eq(Number((await pnl(monthStart, today)).monthlyExpenses), nDouble), back.j?.message);
  await excl(N, true, 'zimeshughulikiwa na hatua 80');
  const list = (await api('GET', '/api/v1/capital-expenditure/ops-report-exclusions', ceo)).j?.data;
  const lN = (list?.log || []).filter((x) => x.referenceNumber === 'REN-MON-20261101-000000-E2EOPS01');
  ok('N4 orodha: zilizoondolewa 2 (sababu, nani); historia ya Nov = 3 (EXCLUDE, INCLUDE, EXCLUDE)', (list?.excluded || []).length === 2
    && (list.excluded.find((x) => x.uid === N) || {}).reason === 'zimeshughulikiwa na hatua 80' && (list.excluded.find((x) => x.uid === N) || {}).byName
    && lN.map((x) => x.action).join(',') === 'EXCLUDE,INCLUDE,EXCLUDE', JSON.stringify(list).slice(0, 400));
  const l403 = await api('GET', '/api/v1/capital-expenditure/ops-report-exclusions', out);
  ok('N5 orodha: bila CAPITAL_READ/APPROVE -> 403', l403.status === 403, `${l403.status}`);
  ok('N6 TB haijabadilika kwa yote', tb() === g0.tb, tb());

  // ── UI ──
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };
  await page.goto(V3 + '/capital?tab=expenses'); await page.waitForTimeout(2500); await closeBanners();
  const btn = page.locator('[data-test="ops-excluded"]');
  ok('U1 kitufe "Nje ya ripoti (2)" kipo', /\(2\)/.test(await btn.innerText().catch(() => '')), await btn.innerText().catch(() => '-'));
  await btn.click(); await page.waitForTimeout(500);
  const lst = await page.locator('[data-test="ops-excluded-list"]').innerText().catch(() => '');
  ok('U2 orodha inaonyesha REN-MON ya E2E na sababu', /E2EOPS01/.test(lst) && /hatua 80/.test(lst), lst.replace(/\s+/g, ' ').slice(0, 300));
  // leave Oct "Malipo Ya Dereva (2026-11)"... use the Nov staff row through the UI
  const search = page.locator('lsms-search-bar input').first();
  await search.fill('malipo ya wafanyakazi (2026-11)'); await search.press('Enter'); await page.waitForTimeout(800);
  await page.locator('[data-test="ops-exclude"]').first().click();
  await page.locator('app-reason-dialog textarea').fill('Jaribio la UI: zimeshughulikiwa na hatua 80');
  await page.getByRole('button', { name: /^(Confirm|Thibitisha)$/ }).last().click();
  await page.locator('[data-test="ops-excluded-pill"]').first().waitFor({ timeout: 8000 }).catch(() => undefined);
  const rowTxt = (await page.locator('lsms-data-table').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  ok('U3 UI: imeondolewa (pill "nje ya ripoti", kitufe sasa "Rudisha"), DB flag + log', (await page.locator('[data-test="ops-excluded-pill"]').count()) >= 1
    && /Rudisha|Back in report/.test(rowTxt)
    && sql("select exclude_from_ops_report from capital_expenditure where reference_number = 'OPE-MON-20261101-000000-78B59FE9'") === 't', rowTxt.slice(0, 400));
  ok('U4 hakuna kosa la JavaScript', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  ok('Z1 TB 0 mwisho', tb() === g0.tb, tb());
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
