// B4 + daraja (owner 01/11 bm) on the PRODUCTION build: V3 Docker-local + backend Docker-local (release/2.4.0, PG15).
//  D. "Daraja na GL" card on the operating report (October): every line of /api/v1/reports/pnl-bridge is shown, the
//     unexplained row is not red at 0; control: +1,000 on one sale's 4000/1000 lines -> the row turns red with
//     +1,000.00 (reverted at the end, also after a failure).
//  E. "Baada ya mikopo" on the GL profit tab: net (GL) - each loan's reserve = what is left, red when < 0, and the
//     days below zero - all as /api/v1/reports/gl-pnl says. Loans A and B get their terms as step 69 did on prod
//     (once; same as b3).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CM = '/api/v1/capital-monitoring';
const CEO = 'tarimo@gmail.com';
const A = 'INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637', B = 'INJ-4e3c01c3-122e-4e92-bdf0-a09c5d532f79';
const PW = 'B3-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const num = (t) => Number(String(t).replace(/[^0-9.-]/g, ''));
const p2 = (x) => String(x).padStart(2, '0');
const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; })();

async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
async function login(page) {
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(CEO);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
}

// Control: one October sale journal gets +1,000 on 4000 (Cr) and 1000 (Dr) - balanced, but no named cause.
let tampered = null;
function tamper() {
  const l = sql("select l.uid from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid join sales s on s.uid = j.reference_uid where j.reference_type = 'SALE_CASH' and l.account_code = '4000' and j.entry_date = '2026-10-15' and not s.is_deleted order by l.uid limit 1");
  const c = sql(`select l2.uid from journal_entry_line l join journal_entry_line l2 on l2.journal_entry_uid = l.journal_entry_uid and l2.account_code = '1000' where l.uid = '${l}' limit 1`);
  sql(`begin; update journal_entry_line set credit_amount = credit_amount + 1000 where uid = '${l}'; update journal_entry_line set debit_amount = debit_amount + 1000 where uid = '${c}'; commit;`);
  tampered = [l, c];
}
function untamper() {
  if (!tampered) return;
  const [l, c] = tampered;
  sql(`begin; update journal_entry_line set credit_amount = credit_amount - 1000 where uid = '${l}'; update journal_entry_line set debit_amount = debit_amount - 1000 where uid = '${c}'; commit;`);
  tampered = null;
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const ct = (await api('POST', '/api/auth/login', null, { email: CEO, password: PW })).j.data.tokenInfo.token;
  // Loans A and B as step 69 left them on prod (same bodies as b3), once.
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
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await login(page);

  // ---- D. Daraja na GL (October)
  const br = (await api('GET', '/api/v1/reports/pnl-bridge?from=2026-10-01&to=2026-10-31', ct)).j.data;
  const openProfit = async () => {
    await page.goto(V3 + '/reports/profit?from=2026-10-01&to=2026-10-31');
    await page.locator('[data-test="daraja"] table').waitFor({ timeout: 60000 });
  };
  await openProfit();
  const card = page.locator('[data-test="daraja"]');
  const codes = await card.locator('tr[data-code]').evaluateAll((trs) => trs.map((t) => t.getAttribute('data-code')));
  ok(`D1 mistari yote ya daraja inaonekana (${br.lines.length} + isiyoelezeka)`, JSON.stringify(codes) === JSON.stringify([...br.lines.map((l) => l.code), 'ISIYOELEZEKA']), JSON.stringify(codes));
  let same = true;
  for (const l of br.lines) {
    const t = await card.locator(`tr[data-code="${l.code}"] td.n`).innerText();
    if (Math.abs(num(t) - Math.round(l.amount)) > 1) { same = false; console.log('  tofauti', l.code, t, l.amount); }
  }
  ok('D2 kiasi cha kila mstari = API', same);
  const ct0 = await card.innerText();
  ok(`D3 net ya uendeshaji ${Math.round(br.operatingNet)} na ya GL ${Math.round(br.glNet)} zinaonekana`,
    ct0.includes(Math.round(br.operatingNet).toLocaleString('en-US')) && ct0.includes(Math.round(br.glNet).toLocaleString('en-US')), ct0.slice(0, 300));
  const un0 = card.locator('tr[data-code="ISIYOELEZEKA"]');
  ok('D4 isiyoelezeka 0.00, si nyekundu', Math.abs(br.unexplained) < 0.005 && !(await un0.getAttribute('class')).includes('bad') && /0\.00/.test(await un0.innerText()), await un0.innerText());

  tamper();
  await openProfit();
  const un1 = page.locator('[data-test="daraja"] tr[data-code="ISIYOELEZEKA"]');
  ok('D5 kinga: +1,000 bila sababu -> isiyoelezeka +1,000.00 nyekundu', (await un1.getAttribute('class')).includes('bad') && /\+1,000\.00/.test(await un1.innerText()), await un1.innerText());
  untamper();

  // ---- E. Baada ya mikopo (GL profit tab, this year up to today)
  const g = (await api('GET', `/api/v1/reports/gl-pnl?from=${TODAY.slice(0, 4)}-01-01&to=${TODAY}&group=day`, ct)).j.data;
  await page.goto(V3 + '/general-ledger?tab=pnl');
  const loans = page.locator('section.loans');
  await loans.waitFor({ timeout: 60000 });
  const lt = await loans.innerText();
  ok(`E1 akiba ya kila mkopo (${g.totals.reserves.length}) = API`, (await loans.locator('.row[data-loan]').count()) === g.totals.reserves.length
    && g.totals.reserves.every((r) => lt.includes(Math.round(r.amount).toLocaleString('en-US'))), lt.slice(0, 300));
  const rem = page.locator('.grand.remaining');
  const rt = await rem.innerText();
  ok(`E2 inayobaki ${Math.round(g.totals.remaining)} = API, nyekundu ikiwa < 0`, Math.abs(num(rt.split('\n').pop()) - Math.round(g.totals.remaining)) <= 1
    && (await rem.getAttribute('class')).includes('negative') === !!g.totals.negative, rt);
  const negApi = g.periods.filter((p) => p.negative).length;
  ok(`E3 siku chini ya sifuri (${negApi}) = API`, (await page.locator('.neg-days .chip').count()) === negApi);

  ok('Z hakuna JS error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => {
  console.log('ERROR', e.message);
  try { untamper(); } catch (c) { console.log('KUREJESHA KUMESHINDWA', c.message); }
  console.log(`JUMLA PASS ${P} FAIL ${F + 1}`);
  process.exit(2);
});
