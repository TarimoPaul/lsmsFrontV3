// B3 (V3 loans: card, Lipa mkopo, details, new loan with terms) end to end on the PRODUCTION build: V3 Docker-local
// + backend Docker-local (release/2.4.0, PG15, 29/10 copy). Setup touches only the local copy:
//  - test passwords;
//  - loan A corrected and loan B given its terms exactly as step 69 did on prod (once; skipped when already done),
//    so A and B look like prod and are only READ here;
//  - every run registers its OWN test loan and repays that one, so the test can run again on the same copy.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CM = '/api/v1/capital-monitoring';
const CEO = 'tarimo@gmail.com', EXE = 'jess@elikom.co.tz';
const A = 'INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637', B = 'INJ-4e3c01c3-122e-4e92-bdf0-a09c5d532f79';
const PW = 'B3-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const p2 = (x) => String(x).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const addDays = (s, k) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + k); return iso(d); };
const TODAY = iso(new Date());
const num = (t) => Number(String(t).replace(/[^0-9.-]/g, ''));

async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const apiToken = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
async function login(page, email) {
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
}
async function toast(page, re) {
  try { await page.locator('lsms-toast-host, [role="status"], [role="alert"]').filter({ hasText: re }).first().waitFor({ timeout: 15000 }); return true; } catch { return false; }
}
async function loansTab(page) {
  await page.goto(V3 + '/capital?tab=loans');
  await page.locator('app-loans-tab').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const closeAll = page.getByRole('button', { name: /^(Close all|Funga zote)$/ });
  if (await closeAll.count()) await closeAll.first().click();
}
const card = (page, uid) => page.locator(`article[data-loan="${uid}"]`);
const loanCard = async (token, uid) => (await api('GET', `${CM}/loans/${uid}`, token)).j.data?.card;

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${EXE}')`);
  const ct = await apiToken(CEO);

  // ---- setup: A and B as step 69 left them on prod (same bodies), once
  if (sql(`select count(*) from journal_entry where reference_uid like '${A}:MAREKEBISHO-%'`) === '0') {
    const r = await api('POST', `${CM}/loans/${A}/corrections`, ct, { date: '2026-10-04', reason: 'M-1/M-16: A 1,186,000 -> 1,158,000; riba 158,000 iende 1150',
      lines: [{ accountCode: '2100', debit: 28000 }, { accountCode: '1150', debit: 158000 }, { accountCode: '1021', credit: 186000 }],
      terms: { principal: 1000000, interestTotal: 158000, startDate: '2026-10-04', endDate: '2027-01-04', repaymentType: 'MONTHLY', receiveAccount: '1021' }, dryRun: false });
    console.log('setup A:', r.status, r.j.message);
  }
  if (sql(`select count(*) from loan_installment where loan_uid = '${B}'`) === '0') {
    const r = await api('POST', `${CM}/loans/${B}/corrections`, ct, { date: TODAY, reason: 'M-2: masharti ya B (ONCE 28/11, bila riba)', lines: [],
      terms: { principal: 1200000, interestTotal: 0, startDate: '2026-09-26', endDate: '2026-11-28', repaymentType: 'ONCE' }, dryRun: false });
    console.log('setup B:', r.status, r.j.message);
  }

  const browser = await chromium.launch();
  const errors = [];
  const newPage = async () => { const p = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); p.on('pageerror', (e) => errors.push(String(e))); return p; };

  // ---- A. the card (loan A and B as on prod)
  const ceo = await newPage();
  await login(ceo, CEO);
  await loansTab(ceo);
  const a = card(ceo, A);
  await a.waitFor({ timeout: 20000 });
  const at = await a.innerText();
  ok('A1 kadi ya A: kiasi 1,000,000, riba 158,000, jumla 1,158,000', /1,000,000/.test(at) && /158,000/.test(at) && /1,158,000/.test(at), at.slice(0, 200));
  // money is shown in whole shillings everywhere (Money.format): 1,717.39 -> 1,717 etc.
  ok('A2 A: makato ya siku riba 1,717 + akiba 10,870 = 12,587', /1,717 TZS/.test(at) && /10,870 TZS/.test(at) && /12,587 TZS/.test(at), at.slice(0, 600));
  ok('A3 A: awamu 3 (04/11, 04/12, 04/01) 386,000 kila moja', (await a.locator('li[data-seq]').count()) === 3 && /4 Nov 2026/.test(at) && /4 Dec 2026/.test(at) && /4 Jan 2027/.test(at) && (at.match(/386,000/g) ?? []).length >= 3);
  const ac = await loanCard(ct, A);
  ok('A4 A: deni la kadi = GL (owed)', new RegExp(Number(ac.owed).toLocaleString('en-US')).test(at), `owed ${ac.owed}`);
  const b = card(ceo, B);
  const bt = await b.innerText();
  ok('A5 B: mara moja, awamu 1 tarehe 28/11 1,200,000, akiba 19,048', /Once|Mara moja/.test(bt) && (await b.locator('li[data-seq]').count()) === 1 && /28 Nov 2026/.test(bt) && /19,048 TZS/.test(bt), bt.slice(0, 600));
  ok('A6 mkopo wa tatu (umelipwa) uko kwenye Historia, si kwenye orodha hai', (await ceo.locator('article[data-loan^="INJ-7a64c10a"]').count()) === 0 && /MKOPO WA BANK/.test(await ceo.locator('details.hist').textContent()));  // closed <details>: innerText hides it

  // ---- B. new loan with terms (this run's own loan)
  const lender = `Jaribio B3 ${Date.now().toString(36)}`;
  // MONTHLY over 3 months: the last installment is start + 3 months (same day, as the server requires)
  const start = addDays(TODAY, -10);
  const sd = new Date(`${start}T12:00:00`); const ed = new Date(sd); ed.setMonth(ed.getMonth() + 3);
  const end = iso(ed), days = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
  const tz = (v) => `${Math.round(v).toLocaleString('en-US')} TZS`;
  await ceo.getByRole('button', { name: /Loan received|Mkopo mpya/ }).click();
  const rd = ceo.locator('app-loan-register-dialog');
  await rd.waitFor();
  const inputs = rd.locator('input');
  await inputs.nth(0).fill(lender);
  await inputs.nth(1).fill('600000');
  await inputs.nth(2).fill('36000');
  await rd.locator('input[type="date"]').nth(0).fill(start);
  await rd.locator('input[type="date"]').nth(0).dispatchEvent('change');
  await rd.locator('input[type="number"]').fill('3');
  await rd.locator('.sum').waitFor({ timeout: 10000 }).catch(() => {});
  const rdt = await rd.innerText();
  ok(`B1 muhtasari: deni lote 636,000, siku ${days}, mwisho ${end}, riba/siku ${tz(36000 / days)}, akiba/siku ${tz(600000 / days)}`,
    /636,000/.test(rdt) && new RegExp(`\\b${days}\\b`).test(rdt) && rdt.includes(end) && rdt.includes(tz(36000 / days)) && rdt.includes(tz(600000 / days)), rdt.slice(-300));
  await rd.getByRole('button', { name: /Record loan|Rekodi mkopo/ }).click();
  const recorded = await toast(ceo, /Loan recorded|Mkopo umerekodiwa/);
  ok('B2 toast: mkopo umerekodiwa', recorded, recorded ? '' : (await rd.innerText().catch(() => '')).slice(-300));
  const nu = sql(`select uid from capital_injections where reason = '${lender}' and source_type = 'LOAN'`);
  ok('B3 DB: mkopo mpya 636,000 (600,000 + 36,000), MONTHLY, awamu 3', nu !== '' && sql(`select amount::int || '|' || principal_amount::int || '|' || interest_total::int || '|' || repayment_type from capital_injections where uid = '${nu}'`) === '636000|600000|36000|MONTHLY'
    && sql(`select count(*) from loan_installment where loan_uid = '${nu}'`) === '3', nu);
  const jReg = sql(`select string_agg(l.account_code || ':' || l.debit_amount::int || ':' || l.credit_amount::int, ',' order by l.account_code) from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where j.reference_uid = '${nu}' and j.reference_type in ('CAPITAL_INJECTION', 'LOAN_RECEIVED')`);
  ok('B4 GL: Dr 1000 600,000 + Dr 1150 36,000 / Cr 2100 636,000', jReg === '1000:600000:0,1150:36000:0,2100:0:636000', jReg);
  const ints = sql(`select count(*) from journal_entry where reference_uid like 'LOANINT:${nu}:%'`);
  ok('B5 riba ya kufidia: siku 11 (tarehe ya kuanza hadi leo)', ints === '11', ints);

  // ---- C. repay (this run's loan) through the dialog
  await loansTab(ceo);
  const n = card(ceo, nu);
  await n.waitFor({ timeout: 20000 });
  const c0 = await loanCard(ct, nu);
  await n.getByRole('button', { name: /^(Repay|Lipa mkopo)$/ }).click();
  let pd = ceo.locator('app-repay-dialog');
  await pd.waitFor();
  const amt = pd.locator('input[lsmsMoneyInput]');
  ok('C1 kiasi kimejazwa = awamu inayofuata (212,000)', num(await amt.inputValue()) === 212000, await amt.inputValue());
  ok('C2 hakuna sehemu ya riba kwenye fomu', !/Interest|Riba \(/.test(await pd.locator('label').allInnerTexts().then((x) => x.join('|'))));
  ok('C3 picker: taslimu na benki tu (hakuna M-Pesa)', (await pd.getByRole('radio', { name: /M-Pesa/ }).count()) === 0 && (await pd.getByRole('radio', { name: /^(Cash|Taslimu)/ }).count()) === 1);
  await amt.fill('700000');
  ok('C4 zaidi ya deni -> ujumbe na kitufe kimezimwa', /More than is owed|Zaidi ya deni/.test(await pd.innerText()) && (await pd.getByRole('button', { name: /Record repayment|Rekodi malipo/ }).isDisabled()));
  await amt.fill('212000');
  ok('C5 hakiki: awamu #1 inalipwa', /#1 (paid|imelipwa)/.test(await pd.innerText()));
  await pd.getByRole('button', { name: /Record repayment|Rekodi malipo/ }).click();
  ok('C6 toast: malipo yamerekodiwa', await toast(ceo, /Repayment recorded|Malipo ya mkopo yamerekodiwa/));
  const c1 = await loanCard(ct, nu);
  ok('C7 deni 636,000 -> 424,000; awamu #1 PAID', Number(c0.owed) === 636000 && Number(c1.owed) === 424000 && c1.installments[0].status === 'PAID', `${c0.owed} -> ${c1.owed} ${c1.installments.map((i) => i.status)}`);
  const jRep = sql(`select string_agg(l.account_code || ':' || l.debit_amount::int || ':' || l.credit_amount::int, ',' order by l.account_code) from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid where j.reference_number = '${nu}' and j.reference_type = 'LOAN_REPAYMENT'`);
  ok('C8 GL: Dr 2100 / Cr 1000 212,000 (bank cut-over haijawekwa)', jRep === '1000:0:212000,2100:212000:0', jRep);
  // a second payment over two installments: FIFO, preview says so
  await loansTab(ceo);
  await card(ceo, nu).getByRole('button', { name: /^(Repay|Lipa mkopo)$/ }).click();
  pd = ceo.locator('app-repay-dialog');
  await pd.waitFor();
  await pd.locator('input[lsmsMoneyInput]').fill('250000');
  const pv = await pd.innerText();
  ok('C9 hakiki ya FIFO: #2 imelipwa, #3 sehemu', /#2 (paid|imelipwa)/.test(pv) && /#3 (part|sehemu)/.test(pv), pv.slice(-300));
  await pd.getByRole('button', { name: /Record repayment|Rekodi malipo/ }).click();
  await toast(ceo, /Repayment recorded|Malipo ya mkopo yamerekodiwa/);
  const c2 = await loanCard(ct, nu);
  ok('C10 deni 174,000; #2 PAID; #3 PARTIAL 38,000', Number(c2.owed) === 174000 && c2.installments[1].status === 'PAID' && c2.installments[2].status === 'PARTIAL' && Number(c2.installments[2].paidAmount) === 38000,
    `${c2.owed} ${c2.installments.map((i) => i.status + ':' + i.paidAmount)}`);
  await loansTab(ceo);
  const nt = await card(ceo, nu).innerText();
  ok('C11 kadi: deni 174,000 na malipo 2 kwenye orodha', /174,000/.test(nt) && (await card(ceo, nu).locator('ul.tx li').count()) === 2);

  // ---- D. details (no journal)
  const journals0 = sql('select count(*) from journal_entry');
  await card(ceo, nu).getByRole('button', { name: /^(Details|Maelezo)$/ }).click();
  const dd = ceo.locator('app-loan-details-dialog');
  await dd.waitFor();
  const dates = dd.locator('input[type="date"]');
  const d3 = await dates.nth(2).inputValue();
  await dates.nth(1).fill(addDays(d3, 5));
  await dates.nth(1).dispatchEvent('change');
  ok('D1 tarehe zisizo na mpangilio -> ujumbe na kitufe kimezimwa', /must fall after|lazima iwe baada/.test(await dd.innerText()) && (await dd.getByRole('button', { name: /^(Save|Hifadhi)$/ }).isDisabled()));
  await dates.nth(1).fill(addDays(d3, -3));
  await dates.nth(1).dispatchEvent('change');
  await dd.locator('input[type="text"]').first().fill(lender + ' (jina sahihi)');
  await dd.getByRole('button', { name: /^(Save|Hifadhi)$/ }).click();
  ok('D2 toast: maelezo yamehifadhiwa', await toast(ceo, /Loan details saved|Maelezo ya mkopo yamehifadhiwa/));
  ok('D3 DB: jina na tarehe ya awamu #2 zimebadilika', sql(`select reason from capital_injections where uid = '${nu}'`) === `${lender} (jina sahihi)` && sql(`select due_date from loan_installment where loan_uid = '${nu}' and seq = 2`) === addDays(d3, -3));
  ok('D4 hakuna journal mpya', sql('select count(*) from journal_entry') === journals0);

  // ---- E. read only for Executive CEO (FINANCE_READ, no FINANCE_WRITE)
  const exe = await newPage();
  await login(exe, EXE);
  await loansTab(exe);
  let exeSees = true;
  try { await card(exe, A).waitFor({ timeout: 20000 }); } catch { exeSees = false; }
  ok('E1 Executive CEO anaona kadi', exeSees);
  ok('E2 Executive CEO: hakuna kitufe cha kuandika', (await exe.getByRole('button', { name: /Loan received|Mkopo mpya|^(Repay|Lipa mkopo)$|^(Details|Maelezo)$|Convert to capital|Geuza kuwa mtaji/ }).count()) === 0);
  const et = await apiToken(EXE);
  const r403 = await api('POST', `${CM}/loans/${nu}/repay`, et, { amount: 1000, principal_amount: 1000, interest_amount: 0, payment_method: 'CASH' });
  ok('E3 API: Executive CEO kulipa -> 403', r403.status === 403, String(r403.status));

  ok('Z hakuna JS error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
