// C4 sales returns in the browser (owner ci/fa 8, fg), on the PRODUCTION build of V3 feature/t2-cutover (= t2-marejesho UI)
// + backend Docker-local of t2-marejesho WITH the switch: APP_FEATURES_SALES_RETURNS_ENABLED=true deploy/local/local.sh up <image>.
// With the switch OFF (default, as on prod) only U0 runs: the sale's menu has no "Return items" / "Exchange goods".
//   U1 MANAGER: sales of that day -> the sale's menu -> "Return items": the dialog lists the lines, 1 piece -> money back = its price
//   U2 "Request return" with a reason -> PENDING, 1 piece, nothing in the GL yet
//   U3 CEO: the sale's menu -> "Return — approve / reject" -> Approve, paid back with M-Pesa -> APPROVED, Cr 1030 / Dr 4020
//   U4 the sale is flagged as partly returned; no page errors
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node marejesho_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Marejesho-UI-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const jl = (ref) => sql(`select string_agg(account_code || ':' || v, ',' order by account_code) from (select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) v from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1) x`);

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT')");
  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz' }, body: JSON.stringify({ email: MGR, password: PW }) }).then((r) => r.json());
  const on = (await fetch(API + '/api/v1/sales/returns/enabled', { headers: { Origin: 'https://elikom.co.tz', Authorization: 'Bearer ' + login.data.tokenInfo.token } }).then((r) => r.json())).data === true;

  // a paid cash walk-in sale of an earlier day (not today), no discount, a normal line of >= 2 pieces, never returned
  const [sid, receipt, day, dA, unit] = sql("select s.uid || '|' || s.receipt_number || '|' || s.sale_date::date || '|' || d.uid || '|' || round(d.sub_total / d.piece_quantity, 2) from sales s join sales_details d on d.sale_uid = s.uid and not d.is_deleted where not s.is_deleted and s.is_active and s.payment_status = 'PAID' and s.customer_id is null and s.sale_date >= now() - interval '25 days' and s.sale_date::date < current_date and (s.sale_source is null or s.sale_source = 'STANDARD') and d.pour_measure_uid is null and d.piece_quantity >= 2 and d.total_cost > 0 and coalesce(s.discount_amount,0) = 0 and not exists (select 1 from sales_returns r where r.original_sale_uid = s.uid) and (select count(*) from sales_details x where x.sale_uid = s.uid and not x.is_deleted) = 1 order by s.sale_date desc limit 1").split('|');
  let price = Number(unit);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const signIn = async (email) => {
    await ctx.clearCookies();
    await page.goto(V3 + '/login');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto(V3 + '/login');
    await page.locator('input[autocomplete="username"]').fill(email);
    await page.locator('input[autocomplete="current-password"]').fill(PW);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
    await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  };
  const closeBanners = async () => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };
  const saleMenu = async () => {
    await page.goto(`${V3}/sales?date=${day}`); await sleep(3000); await closeBanners();
    await page.getByPlaceholder(/(Search receipt|Tafuta risiti)/).first().fill(receipt); await sleep(800);
    const row = page.locator('tbody tr').filter({ has: page.getByText(receipt, { exact: true }) }).first();
    await row.waitFor({ timeout: 20000 });
    await row.getByRole('button', { name: /^(Actions|Vitendo)$/ }).click(); await sleep(400);
    return page.locator('.lsms-menu');
  };

  await signIn(MGR);
  let menu = await saleMenu();
  const menuText = await menu.innerText();
  if (!on) {
    ok('U0 swichi IMEZIMWA: menyu ya mauzo haina "Rudisha bidhaa" wala "Badilisha bidhaa"', !/(Return items|Rudisha bidhaa|Exchange goods|Badilisha bidhaa)/.test(menuText), menuText);
  } else {
    await menu.getByRole('menuitem', { name: /(Return items|Rudisha bidhaa)/ }).click();
    const dlg = page.getByRole('dialog').last();
    await dlg.locator('ul.rows li').first().waitFor({ timeout: 20000 });
    const li = dlg.locator('ul.rows li').first();
    const full = await dlg.locator('section.money').innerText();  // opens on "Full return": everything left is ticked
    await li.locator('.stepper input').fill('1'); await li.locator('.stepper input').press('Tab'); await sleep(400);
    const per = Number((await li.locator('.nm small').innerText()).match(/·\s*([\d,]+(?:\.\d+)?)\s*\//)[1].replace(/,/g, ''));
    price = per;
    const money = await dlg.locator('section.money').innerText();
    const partial = await dlg.getByRole('radio', { name: /(Some items|Baadhi ya bidhaa)/ }).getAttribute('aria-checked');
    ok(`U1 kidirisha: kinaanza na vyote; kipande 1 -> "sehemu", pesa ya kurudisha = bei ya kipande ${fmt(per)}`,
      /(pcs|vip)/.test(full) && (await dlg.locator('ul.rows li').count()) === 1 && partial === 'true' && money.includes(`· 1 `) && money.includes(fmt(per)), `${full} || ${money} || ${partial}`);
    await dlg.locator('textarea').first().fill('E2E C4 UI mteja amerudisha chupa moja');
    await dlg.getByRole('button', { name: /(Request return|Omba kurudisha)/ }).click(); await sleep(2500);
    const ret = sql(`select uid || '|' || return_status || '|' || (select coalesce(sum(return_quantity_pieces),0) from sales_return_items i where i.sales_return_uid = r.uid) from sales_returns r where r.original_sale_uid = '${sid}' order by r.id desc limit 1`).split('|');
    ok('U2 ombi -> PENDING, kipande 1, hakuna GL bado', ret[1] === 'PENDING' && Number(ret[2]) === 1 && !jl(ret[0]), ret.join(' '));

    await signIn(CEO);
    menu = await saleMenu();
    await menu.getByRole('menuitem', { name: /(Return — approve \/ reject|Marejesho — idhinisha \/ kataa)/ }).click();
    const rd = page.getByRole('dialog').last();
    await rd.getByRole('button', { name: /^(Approve|Idhinisha)$/ }).click(); await sleep(600);
    await rd.getByRole('radio', { name: /M-Pesa/ }).click();
    await rd.getByRole('button', { name: /^(Approve|Idhinisha)$/ }).last().click(); await sleep(3000);
    const after = sql(`select return_status || '|' || coalesce(refund_method,'') || '|' || coalesce(net_refund_amount,0) from sales_returns where uid = '${ret[0]}'`).split('|');
    const paid = Number(after[2]);  // the dialog shows whole shillings; the server keeps the cents
    const want = `1030:${(-paid).toFixed(2)},4020:${paid.toFixed(2)}`;
    const got = jl(ret[0]).split(',').filter((x) => /^(1030|4020):/.test(x)).join(',');
    ok('U3 CEO anaidhinisha kwa M-Pesa -> APPROVED, Cr 1030 / Dr 4020', after[0] === 'APPROVED' && after[1] === 'VODACOM' && Math.abs(paid - price) < 1 && got === want, `${after.join(' ')} ${jl(ret[0])} (lazima ${want})`);
    await page.keyboard.press('Escape'); await sleep(400);
    await page.goto(`${V3}/sales?date=${day}`); await sleep(3000); await closeBanners();
    await page.getByPlaceholder(/(Search receipt|Tafuta risiti)/).first().fill(receipt); await sleep(800);
    const rowText = await page.locator('tbody tr').filter({ has: page.getByText(receipt, { exact: true }) }).first().innerHTML();
    ok('U4 mauzo yanaonyesha "imerudishwa sehemu"; hakuna makosa ya ukurasa', /(Partly returned|Imerudishwa sehemu)/.test(rowText) && errors.length === 0, `${errors.join(' | ').slice(0, 300)}`);
  }
  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
