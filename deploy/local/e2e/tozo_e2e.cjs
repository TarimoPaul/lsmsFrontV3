// Kazi 4 UI (owner bt/dx) on the PRODUCTION build of feature/t2-tozo + backend Docker-local of the same branch (V144).
//   a debt raised by a count (3 short, charged to the counter) shows the split: cost (in the books) + price difference
//   (income only when paid); "Makubaliano ya maandishi": Record is off until the paper + a real note are given;
//   recording -> Dr 1120 / Cr 4900, the card lists the agreement; MANAGER sees no agreement button (no LIABILITY_MANAGE)
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node tozo_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Tozo-UI-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
/** The card whose header says "of <charge>" exactly (a bare number also matches other debts, e.g. 146,000). */
const cardOf = (page, charge) => page.locator('app-liability-card').filter({ has: page.locator('.amt small', { hasText: new RegExp(`(^|\\s)(of|kati ya)\\s+${fmt(charge)}(\\.00)?\\s*(TZS)?\\s*$`) }) }).first();
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const jl = (ref) => Object.fromEntries(sql(`select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1`).split('\n').filter(Boolean).map((r) => { const [a, v] = r.split('|'); return [a, Number(v)]; }));

async function chargedCount(mgr, ceo, product, short) {
  sql("update counting_session c set session_date = m.d, started_at = m.d + time '06:00' from (select min(session_date) - 1 as d from counting_session) m where c.session_date = current_date");
  const s = await api('POST', '/api/v1/counting/sessions', mgr, {});
  if (s.j?.status !== 'Success') throw new Error('start ' + JSON.stringify(s.j).slice(0, 300));
  const sid = s.j.data.uid;
  for (const l of sql(`select product_uid || '|' || system_qty_snapshot from counting_line where session_uid = '${sid}' and not is_deleted`).split('\n').filter(Boolean)) {
    const [pu, q] = l.split('|');
    const r = await api('PUT', `/api/v1/counting/sessions/${sid}/lines`, mgr, { productUid: pu, countedQty: pu === product ? Math.max(0, Number(q) - short) : Number(q) });
    if (r.j?.status !== 'Success') throw new Error('line ' + JSON.stringify(r.j).slice(0, 300));
  }
  const c = await api('POST', `/api/v1/counting/sessions/${sid}/complete`, mgr, {});
  if (c.j?.status !== 'Success') throw new Error('complete ' + JSON.stringify(c.j).slice(0, 300));
  sql(`update counting_session set status = 'PENDING_APPROVAL' where uid = '${sid}'`); // blind recount is not under test
  const decisions = sql(`select uid from counting_line where session_uid = '${sid}' and not is_deleted and counted_qty <> system_qty_snapshot`).split('\n').filter(Boolean)
    .map((u) => ({ lineUid: u, decision: 'CHARGE_TO_CASHIER', reason: 'THEFT_SUSPECTED', notes: 'E2E kazi 4 UI' }));
  const a = await api('POST', `/api/v1/counting/sessions/${sid}/approve`, ceo, { decisions });
  if (a.j?.status !== 'Success') throw new Error('approve ' + JSON.stringify(a.j).slice(0, 300));
  const r = sql(`select h.uid || '|' || h.amount || '|' || h.cost_open || '|' || h.margin_open from staff_liability h where h.session_uid = '${sid}' and not h.is_deleted`).split('|');
  return { liab: r[0], charge: Number(r[1]), cost: Number(r[2]), margin: Number(r[3]) };
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT','PENDING_APPROVAL')");
  const ceo = await login(CEO); const mgr = await login(MGR);
  // a product with stock for several shortages and a selling price above its cost (local copy only)
  const X = sql("select uid from products where not coalesce(is_deleted,false) and current_stock >= 12 and current_average_cost > 0 and piece_sale_price > current_average_cost * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1");
  const D = await chargedCount(mgr, ceo, X, 3);
  ok('S1 deni la UI: chupa 3, kwa gharama + tofauti', D.margin > 0 && Math.abs(D.cost + D.margin - D.charge) < 0.01, JSON.stringify(D));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const signIn = async (email) => {
    await page.goto(V3 + '/login');
    await page.locator('input[autocomplete="username"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(PW);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
    await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  };
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };
  const openCard = async () => {
    await page.goto(V3 + '/counting?tab=staff-liabilities'); await page.waitForTimeout(2500); await closeBanners();
    const card = cardOf(page, D.charge);
    await card.waitFor({ timeout: 20000 });
    await card.locator('button.top').click();
    await page.waitForTimeout(500);
    return card;
  };

  await signIn(CEO);
  let card = await openCard();
  const split = card.locator('[data-testid="tozo-split"]');
  const splitTxt = (await split.count()) ? await split.innerText() : '';
  ok('U1 kadi inaonyesha mgawanyo: gharama + tofauti ya bei (mapato yakilipwa tu)', splitTxt.includes(fmt(D.cost)) && splitTxt.includes(fmt(D.margin)) && /income only when paid|mapato yakilipwa tu/.test(splitTxt), splitTxt.replace(/\s+/g, ' '));
  await card.getByRole('button', { name: /^(Written agreement|Makubaliano ya maandishi)$/ }).click();
  const dlg = page.locator('app-margin-agreement-dialog');
  await dlg.waitFor({ timeout: 10000 });
  const rec = dlg.getByRole('button', { name: /^(Record|Rekodi)$/ });
  ok('U2 dialogi: kiasi = tofauti yote; Rekodi imezimwa bila karatasi na maelezo', (await dlg.innerText()).includes(fmt(D.margin)) && await rec.isDisabled());
  await dlg.locator('[data-testid="agree-doc"]').fill('Daftari la madeni uk. 7');
  await dlg.locator('[data-testid="agree-note"]').fill('Macheda amesaini kwamba atalipa tofauti ya bei');
  await page.waitForTimeout(300);
  await rec.click();
  await dlg.waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  const ag = sql(`select uid || '|' || amount || '|' || document_ref from staff_liability_agreement where liability_uid = '${D.liab}'`).split('|');
  const g = ag[0] ? jl('LIABAGREE:' + ag[0]) : {};
  const left = Number(sql(`select margin_open from staff_liability where uid = '${D.liab}'`));
  ok('U3a tofauti yote imekubaliwa, hakuna senti iliyobaki (margin_open = 0)', left === 0, `${left}`);
  ok('U3 imehifadhiwa: Dr 1120 / Cr 4900 = tofauti yote, hati imeandikwa', Math.abs(Number(ag[1]) - D.margin) < 0.01 && ag[2] === 'Daftari la madeni uk. 7' && Math.abs(g['4900'] + D.margin) < 0.01 && Math.abs(g['1120'] - D.margin) < 0.01, JSON.stringify({ ag, g }));
  const cardTxt = await card.innerText();
  ok('U4 kadi inaorodhesha makubaliano; kitufe cha makubaliano kimeondoka (tofauti nje ya vitabu = 0)', cardTxt.includes('Daftari la madeni uk. 7')
    && (await card.getByRole('button', { name: /^(Written agreement|Makubaliano ya maandishi)$/ }).count()) === 0, cardTxt.replace(/\s+/g, ' ').slice(0, 400));

  // MANAGER: LIABILITY_READ_OWN only - sees his own debt, never the agreement button
  await ctx.clearCookies(); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  const D2 = await chargedCount(mgr, ceo, X, 4);
  await signIn(MGR);
  await page.goto(V3 + '/counting?tab=my-liabilities'); await page.waitForTimeout(2500); await closeBanners();
  const mine = cardOf(page, D2.charge);
  await mine.waitFor({ timeout: 20000 });
  if ((await mine.locator('button.top').getAttribute('aria-expanded')) !== 'true') { await mine.locator('button.top').click(); await page.waitForTimeout(500); }
  ok('U5 MANAGER anaona mgawanyo wa deni lake, bila kitufe cha makubaliano', (await mine.locator('[data-testid="tozo-split"]').count()) === 1
    && (await mine.getByRole('button', { name: /^(Written agreement|Makubaliano ya maandishi)$/ }).count()) === 0, (await mine.innerText()).replace(/\s+/g, ' ').slice(0, 500));
  ok('U6 hakuna page error', errors.length === 0, errors.join(' | ').slice(0, 300));
  await browser.close();
  console.log(`MATOKEO ${P}/${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
