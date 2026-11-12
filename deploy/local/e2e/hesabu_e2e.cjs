// Kazi 5 UI (owner bn/by/fa; BAADA §2) on the production build of feature/t2-hesabu + backend Docker-local (V146):
//   U1 "Anza kuhesabu" asks "Kuna mzigo uliofika leo ambao haujaandikwa?"; YES keeps Start off until a product is picked;
//      the picked product is left out of the count (no line), the session keeps it
//   U2 approval: a large surplus shows "a second person must count it" + the button; the second count (CEO, not the counter)
//      is saved and shown on the line
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node hesabu_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Hesabu-UI-Jaribio-Local-2026';
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
// test sessions (recent dates) go far back, each to its own day; today stays free
const freeToday = () => sql("update counting_session c set session_date = m.d - (c.id::int % 3000), started_at = m.d - (c.id::int % 3000) + time '06:00' from (select min(session_date) - 4000 as d from counting_session) m where c.session_date > current_date - 14");

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT','PENDING_APPROVAL')");
  freeToday();
  const ceo = await login(CEO); const mgr = await login(MGR);
  const D = sql("select uid || '|' || product_name from products p where not coalesce(is_deleted,false) and is_active and current_stock > 0 and not exists (select 1 from pour_product pp where pp.product_uid = p.uid and pp.active) and length(product_name) > 4 order by id limit 1").split('|');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const signIn = async (email) => {
    await ctx.clearCookies();
    await page.goto(V3 + '/login');
    await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
    await page.goto(V3 + '/login');
    await page.locator('input[autocomplete="username"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(PW);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  };
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

  // ── U1 delivery question (MGR) ──
  await signIn(MGR);
  await page.goto(V3 + '/counting?tab=count'); await page.waitForTimeout(2500); await closeBanners();
  await page.getByRole('button', { name: /^(Start counting|Anza kuhesabu)$/ }).first().click();
  await page.getByRole('button', { name: /^(Yes, start|Ndiyo, anza)$/ }).click();
  const dlg = page.locator('app-delivery-question-dialog');
  await dlg.waitFor({ timeout: 10000 });
  ok('U1a swali la mzigo linaonekana', /(Kuna mzigo uliofika leo ambao haujaandikwa|Has any delivery arrived today)/.test(await dlg.innerText()));
  const startBtn = dlg.getByRole('button', { name: /^(Start counting|Anza kuhesabu)$/ });
  ok('U1b bila jibu: Anza imezimwa', await startBtn.isDisabled());
  await dlg.getByRole('radio', { name: /^(Yes|Ndiyo)$/ }).click();
  ok('U1c NDIYO bila bidhaa: Anza imezimwa', await startBtn.isDisabled());
  await dlg.locator('input.find').fill(D[1].slice(0, 12));
  await dlg.locator('.pick label', { hasText: D[1] }).first().locator('input[type=checkbox]').check();
  await dlg.locator('input[type=text]').fill('E2E mzigo wa mchana');
  let enabled = false;
  for (let i = 0; i < 20 && !enabled; i++) { enabled = await startBtn.isEnabled(); if (!enabled) await page.waitForTimeout(250); }
  ok('U1d bidhaa imechaguliwa: Anza inawaka', enabled);
  await startBtn.click();
  await page.waitForTimeout(3000);
  const s1 = sql("select uid || '|' || coalesce(unrecorded_delivery_products,'') || '|' || coalesce(unrecorded_delivery_note,'') from counting_session where session_date = current_date and status = 'IN_PROGRESS'").split('|');
  ok('U1e zoezi limeanza; bidhaa ya mzigo haihesabiwi leo', s1[1] === D[0] && s1[2] === 'E2E mzigo wa mchana'
    && sql(`select count(*) from counting_line where session_uid = '${s1[0]}' and product_uid = '${D[0]}'`) === '0', s1.join('|'));
  sql(`update counting_session set status = 'FORCE_CLOSED', force_closed_reason = 'e2e' where uid = '${s1[0]}'`);
  freeToday();

  // ── U2 second count in the approval dialog (session by API: MGR counts, large surplus on X) ──
  const X = sql("select uid || '|' || current_average_cost || '|' || product_name from products p where not coalesce(is_deleted,false) and is_active and current_stock >= 5 and current_average_cost >= 5000 and current_average_cost < 70000 and not exists (select 1 from pour_product pp where pp.product_uid = p.uid and pp.active) order by id limit 1").split('|');
  const kX = Math.floor(60000 / Number(X[1])) + 1;
  const s = await api('POST', '/api/v1/counting/sessions', mgr, { unrecordedDelivery: false });
  const sid = s.j.data.uid;
  for (const l of sql(`select product_uid || '|' || system_qty_snapshot from counting_line where session_uid = '${sid}'`).split('\n').filter(Boolean)) {
    const [pu, q] = l.split('|');
    await api('PUT', `/api/v1/counting/sessions/${sid}/lines`, mgr, { productUid: pu, countedQty: Number(q) + (pu === X[0] ? kX : 0) });
  }
  await api('POST', `/api/v1/counting/sessions/${sid}/complete`, mgr, {});
  sql(`update counting_session set status = 'PENDING_APPROVAL' where uid = '${sid}'`);

  await signIn(CEO);
  await page.goto(V3 + '/counting?tab=approval'); await page.waitForTimeout(3000); await closeBanners();
  await page.locator('tr, .m-row, .row, li').filter({ hasText: /(Pending|Inasubiri|Kuthibitisha|approval)/i }).first().click().catch(async () => { await page.locator('tbody tr').first().click(); });
  const sd = page.locator('app-session-dialog');
  await sd.waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const lineX = sd.locator('li', { hasText: X[2] }).first();
  ok('U2a ziada kubwa: onyo + kitufe cha mtu wa pili', (await lineX.locator('.note.second').count()) === 1, (await lineX.innerText().catch(() => '')).slice(0, 300));
  await lineX.getByRole('button', { name: /^(Second count|Hesabu ya mtu wa pili)$/ }).click();
  const sc = page.locator('app-second-count-dialog');
  await sc.waitFor({ timeout: 10000 });
  const nowX = Number(sql(`select current_stock from products where uid = '${X[0]}'`));
  await sc.locator('input[type=number]').fill(String(nowX + 1));
  await sc.getByRole('button', { name: /^(Save|Hifadhi)$/ }).click();
  await page.waitForTimeout(2500);
  ok('U2b hesabu ya mtu wa pili imehifadhiwa (CEO, tofauti +1)', sql(`select (second_count_by_uid is not null) || '|' || variance_qty from counting_line where session_uid = '${sid}' and product_uid = '${X[0]}'`) === 'true|1');
  const txt = await sd.locator('li', { hasText: X[2] }).first().innerText();
  ok('U2c mstari unaonyesha "Mtu wa pili", onyo limeondoka', /(Mtu wa pili|Second person)/.test(txt) && (await sd.locator('li', { hasText: X[2] }).first().locator('.note.second').count()) === 0, txt.slice(0, 300));
  ok('Z hakuna JS error', errors.length === 0, errors.join(' | ').slice(0, 300));
  sql(`update counting_session set status = 'FORCE_CLOSED', force_closed_reason = 'e2e' where uid = '${sid}'`);
  freeToday();
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message.slice(0, 500)); process.exit(1); });
