// Kazi 2 / G6 (owner dt/dx): pay down an expense debt (2400 / 2200) WITHOUT a new expense, on the PRODUCTION build of
// feature/t2-gharama + backend Docker-local of the same branch (V141). Throw-away local copy only; it puts a 50,000
// accrual on 2400 with a manual journal and takes it back at the end.
//   UI  "Madeni ya gharama": 2400 shows 50,000; 60,000 -> "Kinazidi", button off; 30,000 Droo -> Dr 2400 / Cr 1000, no 6xxx
//   API 25,000 more -> refused (20,000 left); MANAGER (no FINANCE_WRITE) -> 403; weak description -> refused
//   UI  reverse with a reason -> journal net 0, row REVERSED, 2400 back to 50,000
// Run: NODE_PATH=<npx playwright node_modules> node g6_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'G6-Jaribio-Local-2026';
const TAG = 'E2E-G6';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const journal = (ref) => sql(`select coalesce(string_agg(account_code || ':' || round(s), ',' order by account_code), '') from (select l.account_code, sum(l.debit_amount - l.credit_amount) s
    from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1 having round(sum(l.debit_amount - l.credit_amount)) <> 0) x`);
const owed = (code) => sql(`select round(coalesce(sum(coalesce(l.credit_amount,0) - coalesce(l.debit_amount,0)),0)) from journal_entry_line l join journal_entry e on e.uid = l.journal_entry_uid where e.status = 'POSTED' and not coalesce(e.is_deleted,false) and l.account_code = '${code}'`);
const now = new Date();
const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
const manual = (tok, dr, cr, amount, memo) => api('POST', '/api/v1/gl/journal-entries/manual', tok, { entryDate: today, memo,
  lines: [{ accountCode: dr, debit: amount, credit: 0, description: memo }, { accountCode: cr, debit: 0, credit: amount, description: memo }] });

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  const tok = await login(CEO);
  const base2400 = Number(owed('2400'));
  const tb0 = sql("select round(sum(l.debit_amount - l.credit_amount)) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)");
  const acc = await manual(tok, '6000', '2400', 50000, `${TAG} accrual ya majaribio`);
  ok('S1 deni la majaribio: 2400 +50,000 (journal ya mkono)', acc.j?.status === 'Success' && Number(owed('2400')) === base2400 + 50000, JSON.stringify(acc.j).slice(0, 160));

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
  const openDebts = async () => {
    await page.goto(V3 + '/capital?tab=expenses'); await page.waitForTimeout(2000); await closeBanners();
    await page.getByRole('button', { name: /^(Expense debts|Madeni ya gharama)$/ }).click();
    const d = page.locator('app-liability-payment-dialog'); await d.waitFor({ timeout: 15000 }); await page.waitForTimeout(1500); return d;
  };

  let d = await openDebts();
  const debt = d.locator('.debts button').filter({ hasText: /^\s*2400/ }).first();
  const debtTxt = await debt.innerText();
  ok('U1 2400 inaonyesha salio lake', new RegExp((base2400 + 50000).toLocaleString('en-US')).test(debtTxt), debtTxt.replace(/\s+/g, ' '));
  await debt.click();
  const amountIn = d.locator('label', { hasText: /^(Amount|Kiasi)/ }).locator('input');
  await amountIn.fill(String(base2400 + 60000));
  await page.waitForTimeout(300);
  const payBtn = d.getByRole('contentinfo').getByRole('button', { name: /^(Pay the debt|Lipa deni)$/ });
  ok('U2 kiasi kinachozidi deni: "Kinazidi" + kitufe kimezimwa', /Kinazidi|More than the debt/.test(await d.innerText()) && await payBtn.isDisabled());
  await amountIn.fill('30000');
  await d.locator('[data-test="chanzo"] button[data-source="DROO"]').click();
  await d.locator('label', { hasText: /What is being paid|Nini kinalipwa/ }).locator('input').fill(`Pango la Frame ${TAG} limelipwa`);
  await page.waitForTimeout(300);
  await payBtn.click();
  await page.waitForTimeout(2500);
  const lp = sql(`select uid || '|' || status || '|' || credit_account from liability_payment where description = 'Pango la Frame ${TAG} limelipwa' order by id desc limit 1`).split('|');
  ok('U3 malipo yameandikwa: Dr 2400 30,000 / Cr 1000 30,000, hakuna akaunti ya gharama', lp[1] === 'POSTED' && journal(lp[0]) === '1000:-30000,2400:30000', `${lp.join('|')} ${journal(lp[0])}`);
  ok('U4 deni la 2400 limepungua kwa 30,000', Number(owed('2400')) === base2400 + 20000, owed('2400'));
  ok('U5 orodha ya malipo kwenye dialog inaonyesha malipo mapya', /Pango la Frame E2E-G6/.test(await d.innerText()));

  const over = await api('POST', '/api/v1/gl/liability-payments', tok, { accountCode: '2400', amount: base2400 + 25000, paymentDate: today, paymentSource: 'DROO', sourceAccount: null, description: `Malipo ya ziada ${TAG}` });
  ok('A1 zaidi ya deni lililobaki -> kataa', /kinazidi deni/.test(over.j?.message || ''), over.j?.message);
  const weak = await api('POST', '/api/v1/gl/liability-payments', tok, { accountCode: '2400', amount: 1000, paymentDate: today, paymentSource: 'DROO', sourceAccount: null, description: 'aaaaaaaaaaaaa' });
  ok('A2 maelezo takataka -> kataa', weak.j?.status !== 'Success', weak.j?.message);
  const exp = await api('POST', '/api/v1/gl/liability-payments', tok, { accountCode: '6000', amount: 1000, paymentDate: today, paymentSource: 'DROO', sourceAccount: null, description: `Akaunti ya gharama ${TAG}` });
  ok('A3 akaunti ya gharama (6000) -> kataa', exp.j?.status !== 'Success', exp.j?.message);
  const mgr = await api('POST', '/api/v1/gl/liability-payments', await login(MGR), { accountCode: '2400', amount: 1000, paymentDate: today, paymentSource: 'DROO', sourceAccount: null, description: `Manager analipa ${TAG}` });
  ok('A4 MANAGER (bila FINANCE_WRITE) -> 403', mgr.status === 403, `${mgr.status}`);

  d = await openDebts();
  const row = d.locator('.pay').filter({ hasText: `Pango la Frame ${TAG}` }).first();
  await row.getByRole('button', { name: /^(Reverse|Batilisha)$/ }).click();
  await row.locator('input').fill('Jaribio la E2E G6 limekwisha');
  await row.getByRole('button', { name: /^(Reverse it|Ibatilishe)$/ }).click();
  await page.waitForTimeout(2500);
  ok('U6 kubatilisha: REVERSED, journal jumla 0, 2400 imerudi', sql(`select status from liability_payment where uid='${lp[0]}'`) === 'REVERSED' && journal(lp[0]) === '' && Number(owed('2400')) === base2400 + 50000);
  ok('U7 hakuna kosa la JavaScript', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();

  const back = await manual(tok, '2400', '6000', 50000, `${TAG} usafi - accrual imerudishwa`);
  const tb1 = sql("select round(sum(l.debit_amount - l.credit_amount)) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)");
  ok('Z1 usafi: 2400 imerudi kama mwanzo, TB haijabadilika', back.j?.status === 'Success' && Number(owed('2400')) === base2400 && tb1 === tb0, `${owed('2400')} ${tb0} ${tb1}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
