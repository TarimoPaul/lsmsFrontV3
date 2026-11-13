// KUPIMA in the browser, on the PRODUCTION build of feature/t2-kupima + backend Docker-local (V143) (owner ef/ek):
//   CEO   Bidhaa -> "Kupima" -> "+ Mipangilio": Konyagi ya kupima, chupa 750ml, mzazi KONYAGI 750ML, 30ml = 1,000, 60ml = 2,000
//   MGR   no "+ Mipangilio"; POS (hq, 3.3.1): one ROW per drink at the top of the list, bar, measure buttons in RETAIL;
//         registered price cannot be edited
//         no open container -> RETAIL = "Fungua chupa (n)" (no measures) -> opened 750, parent -1 -> 30ml sold, bar 720
//   (hq) colours by ml (ok / mid / low / empty), 0 ml -> "Fungua chupa", parent stock 0 -> text, no button; wine 2 buttons;
//         chip "Kupima (n)"; rows on top, same height; screenshots light + dark (KUPIMA_SHOTS=<folder>)
//         (i)  container 40ml, 60ml -> "Tumia ml zilizobaki + fungua kipya" -> old CLOSED SPLIT, no loss, bar 730
//         (ii) container 20ml, 30ml -> "Chombo kimeisha kweli" -> 20ml loss Dr 5100 / Cr 1200, bar 720
//         "Kupima" dialog: "Chombo kimeisha" -> loss; containers tab shows the loss
// Throw-away local copy only. Run: NODE_PATH=<npx playwright node_modules> node kupima_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Kupima-UI-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const K = () => sql("select uid from products where product_name = 'KONYAGI YA KUPIMA'");
const bar = (p) => sql(`select coalesce((select ml_left from pour_container where product_uid = '${p}' and status = 'OPEN'), -1)`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function session(browser, email, colorScheme = 'light') {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 }, colorScheme })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.evaluate(() => sessionStorage.setItem('lsms.missingDaysAck', '1'));
  return { page, errors };
}
const closeBanners = async (page) => { const c = page.getByRole('button', { name: /^(Close all|Funga zote)$/ }); if (await c.count()) await c.first().click(); };

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  const k = K();
  const parent = sql("select uid from products where product_name = 'KONYAGI 750ML'");
  // independent of kupima_api_e2e on the same copy: start from "not set up, nothing open" (throw-away copy only)
  sql(`update pour_container set status='CLOSED', close_kind='FINISHED', closed_at=now(), closed_by='E2E-RESET', ml_left=0 where product_uid='${k}' and status='OPEN'`);
  // es/eu: the wine too (kupima_api_e2e configures it with two parents)
  const WK = sql("select uid from products where product_name = 'WINE ZA KUPIMA'");
  const GR = sql("select uid from products where product_name = 'GREPA WINE'");
  const ML = sql("select uid from products where product_name = 'MA-LOT BOX WINE'");
  for (const u of [k, WK]) {
    sql(`update pour_container set status='CLOSED', close_kind='FINISHED', closed_at=now(), closed_by='E2E-RESET', ml_left=0 where product_uid='${u}' and status='OPEN'`);
    for (const t of ['pour_measure', 'pour_parent', 'pour_parent_price', 'pour_product']) sql(`delete from ${t} where product_uid='${u}'`);
  }
  sql(`update products set current_stock = greatest(current_stock, 3) where uid in ('${GR}','${ML}')`);
  // (gq) the test opens 3 bottles of the parent (U4, U7, U8) and kupima_api before it opens some too: on the 12/11 dump the
  // parent had too few left, so U8 could not open a new bottle (refused and rolled back - correct). Stock to open from, as above.
  sql(`update products set current_stock = greatest(current_stock, 6) where uid = '${parent}'`);
  const browser = await chromium.launch();

  // ── CEO: settings through the dialog ──
  const ceo = await session(browser, CEO);
  await ceo.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(ceo.page);
  await ceo.page.locator('[data-test="kupima"]').click();
  const dlg = ceo.page.locator('app-kupima-dialog');
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('[data-test="new"]').click();
  await sleep(1500);
  await dlg.locator('[data-test="product"]').selectOption(k);
  await dlg.locator('[data-test="cname"]').fill('chupa');
  await dlg.locator('[data-test="cml"]').fill('750');
  await dlg.locator('[data-test="parent"]').selectOption(parent);
  await dlg.locator('[data-test="ml-0"]').fill('30');
  await dlg.locator('[data-test="price-0"]').fill('1000');
  await dlg.locator('[data-test="add-measure"]').click();
  await dlg.locator('[data-test="ml-1"]').fill('60');
  await dlg.locator('[data-test="price-1"]').fill('2000');
  await dlg.locator('[data-test="save"]').click();
  await sleep(2500);
  ok('S1 CEO: mipangilio imehifadhiwa kupitia dialog (vipimo 30/60, mzazi KONYAGI 750ML)',
    sql(`select string_agg(ml||'='||round(price), ',' order by ml) from pour_measure where product_uid='${k}' and active`) === '30=1000,60=2000'
    && sql(`select string_agg(parent_product_uid, ',') from pour_parent where product_uid='${k}' and active`) === parent);
  ok('S2 orodha ya dialog inaonyesha Konyagi ya kupima', /KONYAGI YA KUPIMA/.test(await dlg.innerText()));

  // ── MGR: no settings, POS pouring ──
  const mgr = await session(browser, MGR);
  await mgr.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(mgr.page);
  await mgr.page.locator('[data-test="kupima"]').click();
  const mdlg = mgr.page.locator('app-kupima-dialog');
  await mdlg.waitFor({ timeout: 15000 });
  ok('M1 MANAGER: hakuna "+ Mipangilio" wala "Mipangilio" (KUPIMA_SETTINGS tu)', (await mdlg.locator('[data-test="new"]').count()) === 0 && (await mdlg.locator('[data-test="edit"]').count()) === 0);
  await mgr.page.keyboard.press('Escape');

  const pos = async () => { await mgr.page.goto(V3 + '/sales/new'); await sleep(3000); await closeBanners(mgr.page); return mgr.page.locator(`[data-pour="KONYAGI YA KUPIMA"]`); };
  const pay = () => mgr.page.getByRole('button', { name: /(Complete sale|Kamilisha mauzo)/ }).first();
  const shortDlg = () => mgr.page.locator('app-kupima-short-dialog');
  const done = async () => { await mgr.page.locator('app-sale-done-dialog').waitFor({ timeout: 20000 }); await mgr.page.keyboard.press('Escape'); await sleep(800); };

  let card = await pos();
  const p0 = Number(sql(`select current_stock from products where uid='${parent}'`));
  ok('U1 POS (hq): Konyagi ya kupima ni MSTARI ndani ya orodha (.item), "Hakuna wazi", bar tupu (empty)',
    (await card.count()) === 1 && (await card.evaluate((e) => e.classList.contains('item'))) && /Hakuna wazi|None open/.test(await card.innerText())
    && (await card.getAttribute('data-level')) === 'empty', await card.innerText().catch(() => ''));
  ok('U3 (hq) hakuna chombo wazi -> RETAIL ni "Fungua chupa (n)" (n = stock ya mzazi), hakuna vitufe vya vipimo',
    (await card.locator('[data-test="pour-open"]').count()) === 1 && (await card.locator('[data-test="pour-open"]').innerText()).includes(`(${p0})`)
    && (await card.locator('[data-ml]').count()) === 0, await card.innerText().catch(() => ''));
  await card.locator('[data-test="pour-open"]').click();
  await sleep(2500);
  card = mgr.page.locator(`[data-pour="KONYAGI YA KUPIMA"]`);
  ok('U3b "Fungua chupa": chombo 750 wazi, mzazi -1, bar kijani (ok), vitufe 30/60 vinaonekana', bar(k) === '750.00'
    && Number(sql(`select current_stock from products where uid='${parent}'`)) === p0 - 1 && (await card.getAttribute('data-level')) === 'ok'
    && (await card.locator('[data-ml]').count()) === 2, `bar=${bar(k)} ${await card.innerText().catch(() => '')}`);
  await card.locator('[data-ml="30"]').click();
  await sleep(700);
  const line = mgr.page.locator('.price-btn').filter({ hasText: '1,000' }).first();
  ok('U2 mstari wa 30ml kwa 1,000; bei haibadilishwi (kitufe kimezimwa)', (await line.count()) === 1 && await line.isDisabled());
  ok('H6a kipimo kwenye kapu kinashusha bar papo hapo: "720 / 750 ml", "30 ml kwenye kapu"', /720 \/ 750 ml/.test(await card.innerText()) && /30 ml (kwenye kapu|in cart)/.test(await card.innerText()), await card.innerText());
  await pay().click();
  await done();
  ok('U4 imeuzwa: bar 720, mzazi -1 (mara moja tu - kufungua)', bar(k) === '720.00' && Number(sql(`select current_stock from products where uid='${parent}'`)) === p0 - 1, `bar=${bar(k)}`);
  card = await pos();
  const w96 = await card.locator('[data-test="pour-bar"] i').evaluate((e) => e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width);
  ok('H6 baada ya kuuza: mstari unaonyesha 720 / 750 ml, upana wa bar 96%', /720 \/ 750 ml/.test(await card.innerText()) && Math.abs(w96 - 0.96) < 0.02, `w=${w96}`);

  // (i) SPLIT
  const c1 = sql(`select uid from pour_container where product_uid='${k}' and status='OPEN'`);
  sql(`update pour_container set ml_left = 40 where uid='${c1}'`);
  card = await pos();
  ok('U5 bar inaonyesha 40 / 750 ml', /40 \/ 750 ml/.test(await card.innerText()), await card.innerText());
  await card.locator('[data-ml="60"]').click();
  await pay().click();
  await shortDlg().waitFor({ timeout: 15000 });
  ok('U6 haitoshi -> chaguo mbili: (i) tumia zilizobaki + fungua kipya, (ii) kimeisha kweli', (await shortDlg().locator('[data-choice="SPLIT"]').count()) === 1 && (await shortDlg().locator('[data-choice="FINISHED"]').count()) === 1);
  await shortDlg().locator('[data-choice="SPLIT"]').click();
  await done();
  ok('U7 (i): chombo cha zamani CLOSED SPLIT bila upotevu; kipya bar 730 (40 + 20)', sql(`select status||'|'||close_kind||'|'||ml_lost from pour_container where uid='${c1}'`) === 'CLOSED|SPLIT|0.00' && bar(k) === '730.00' && sql(`select count(*) from journal_entry where reference_uid='${c1}'`) === '0', `${sql(`select status||'|'||close_kind||'|'||ml_lost from pour_container where uid='${c1}'`)} bar=${bar(k)}`);

  // (ii) FINISHED
  const c2 = sql(`select uid from pour_container where product_uid='${k}' and status='OPEN'`);
  sql(`update pour_container set ml_left = 20 where uid='${c2}'`);
  card = await pos();
  await card.locator('[data-ml="30"]').click();
  await pay().click();
  await shortDlg().waitFor({ timeout: 15000 });
  await shortDlg().locator('[data-choice="FINISHED"]').click();
  await done();
  const loss = sql(`select string_agg(l.account_code||':'||sign(l.debit_amount-l.credit_amount), ',' order by l.account_code) from journal_entry j join journal_entry_line l on l.journal_entry_uid=j.uid where j.reference_uid='${c2}'`);
  ok('U8 (ii): 20ml upotevu, Dr 5100 / Cr 1200; kipya bar 720', sql(`select close_kind||'|'||ml_lost from pour_container where uid='${c2}'`) === 'FINISHED|20.00' && loss === '1200:-1,5100:1' && bar(k) === '720.00', `${loss} bar=${bar(k)}`);

  // dialog: manual finish + containers report
  await mgr.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(mgr.page);
  await mgr.page.locator('[data-test="kupima"]').click();
  await mdlg.waitFor({ timeout: 15000 });
  await sleep(1000);
  await mdlg.locator('[data-product="KONYAGI YA KUPIMA"] [data-test="finish"]').click();
  await mgr.page.getByRole('button', { name: /(Yes, finished|Ndiyo, kimeisha)/ }).click();
  await sleep(2000);
  ok('U9 "Chombo kimeisha" kwa mkono: hakuna chombo wazi, 720ml upotevu', bar(k) === '-1' && sql(`select ml_lost from pour_container where product_uid='${k}' order by id desc limit 1`) === '720.00');
  await mdlg.getByRole('button', { name: /(Containers & loss|Vyombo na upotevu)/ }).click();
  await sleep(1500);
  const rep = await mdlg.innerText();
  ok('U10 ripoti ya vyombo inaonyesha upotevu (720ml ≈ 24 × 30ml)', /Upotevu 720ml|Lost 720ml/.test(rep) && /24 × 30ml/.test(rep), rep.replace(/\s+/g, ' ').slice(0, 300));
  // (et) profit per container + the profit tab (week card, per drink, per month)
  const cps = await mdlg.locator('[data-test="container-profit"]').allInnerTexts();
  ok('E1 kila chombo kinaonyesha FAIDA na gharama yake', cps.length >= 2 && cps.every((t) => /(Faida|Profit)/.test(t) && !/NaN/.test(t)) && /(gharama|cost) [\d,]/.test(rep), cps.join(' | '));
  await mdlg.locator('[data-test="profit-tab"]').click();
  await sleep(1500);
  const wk = await mdlg.locator('[data-test="week-card"]').innerText().catch(() => '');
  const kRow = await mdlg.locator('tr[data-drink="KONYAGI YA KUPIMA"]').innerText().catch(() => '');
  const month = new Date().toISOString().slice(0, 7);
  ok('E2 kichupo cha Faida: kadi ya wiki, KONYAGI kwenye jedwali la kinywaji, mwezi huu kwenye jedwali la mwezi', /(Faida|Profit)/.test(wk) && !/NaN/.test(wk + kRow)
    && kRow.length > 0 && (await mdlg.locator(`tr[data-month="${month}"]`).count()) === 1, `${wk.replace(/\s+/g, ' ')} || ${kRow.replace(/\s+/g, ' ')}`);
  // ── (es)(eu) WINE: two parents set in the dialog (MA-LOT has its own 70ml price); the till chooses the parent ──
  await ceo.page.goto(V3 + '/products'); await sleep(2500); await closeBanners(ceo.page);
  await ceo.page.locator('[data-test="kupima"]').click();
  await dlg.waitFor({ timeout: 15000 });
  await dlg.locator('[data-test="new"]').click();
  await sleep(1500);
  await dlg.locator('[data-test="product"]').selectOption(WK);
  await dlg.locator('[data-test="cname"]').fill('dumu');
  await dlg.locator('[data-test="cml"]').fill('5000');
  await dlg.locator('[data-test="ml-0"]').fill('70');
  await dlg.locator('[data-test="price-0"]').fill('2000');
  await dlg.locator('[data-test="add-measure"]').click();
  await dlg.locator('[data-test="ml-1"]').fill('80');
  await dlg.locator('[data-test="price-1"]').fill('3000');
  await dlg.locator('[data-test="parent"]').selectOption(GR);
  await dlg.locator('[data-test="add-parent"]').click();
  await dlg.locator('[data-test="parent-1"]').selectOption(ML);
  await sleep(300);
  await dlg.locator('[data-test="own-1-70"]').fill('2500');
  await dlg.locator('[data-test="save"]').click();
  await sleep(2500);
  ok('W1 dialog: wazazi 2 (GREPA, MA-LOT) na bei ya MA-LOT 70ml = 2,500 (msingi 2,000)',
    sql(`select count(*) from pour_parent where product_uid='${WK}' and active`) === '2'
    && sql(`select round(price) from pour_parent_price where product_uid='${WK}' and parent_product_uid='${ML}' and ml=70 and active`) === '2500'
    && sql(`select round(price) from pour_measure where product_uid='${WK}' and ml=70 and active`) === '2000');
  const posW = async () => { await mgr.page.goto(V3 + '/sales/new'); await sleep(3000); await closeBanners(mgr.page); return mgr.page.locator(`[data-pour="WINE ZA KUPIMA"]`); };
  let wcard = await posW();
  const ml0 = Number(sql(`select current_stock from products where uid='${ML}'`)), gr0 = Number(sql(`select current_stock from products where uid='${GR}'`));
  ok('W2 (hq) POS: hakuna chombo wazi -> "Fungua dumu (n)", n = GREPA + MA-LOT', (await wcard.locator('[data-test="pour-open"]').innerText().catch(() => '')).includes(`(${ml0 + gr0})`),
    await wcard.innerText().catch(() => ''));
  await wcard.locator('[data-test="pour-open"]').click();
  await shortDlg().waitFor({ timeout: 15000 });
  const openBtn = shortDlg().locator('[data-choice="OPEN"]');
  ok('W3 dialog inauliza mzazi: GREPA na MA-LOT; "Fungua" imezimwa mpaka uchague', (await shortDlg().locator('[data-parent="GREPA WINE"]').count()) === 1
    && (await shortDlg().locator('[data-parent="MA-LOT BOX WINE"]').count()) === 1 && await openBtn.isDisabled());
  await shortDlg().locator('[data-parent="MA-LOT BOX WINE"]').click();
  await openBtn.click();
  await sleep(2500);
  wcard = mgr.page.locator(`[data-pour="WINE ZA KUPIMA"]`);
  ok('W4 (hq) dumu imefunguliwa kutoka MA-LOT (MA-LOT -1, GREPA haijaguswa); vitufe 2 (70 / 80), 70ml = 2,500 (bei ya MA-LOT)',
    Number(sql(`select current_stock from products where uid='${ML}'`)) === ml0 - 1 && Number(sql(`select current_stock from products where uid='${GR}'`)) === gr0
    && (await wcard.locator('[data-ml]').count()) === 2 && /2,500/.test(await wcard.locator('[data-ml="70"]').innerText()), (await wcard.innerText()).replace(/\s+/g, ' '));
  await wcard.locator('[data-ml="70"]').click();
  await sleep(700);
  ok('W4b kapu: 70ml kwa 2,500', (await mgr.page.locator('.price-btn').filter({ hasText: '2,500' }).count()) === 1);
  await pay().click();
  await done();
  const sold = sql(`select round(d.sub_total)||'|'||c.parent_product_uid from sales_details d join pour_use u on u.sale_detail_uid=d.uid join pour_container c on c.uid=u.container_uid where d.product_uid='${WK}' order by d.id desc limit 1`).split('|');
  ok('W5 imeuzwa 2,500 kutoka chombo cha MA-LOT: MA-LOT -1, GREPA haijaguswa', sold[0] === '2500' && sold[1] === ML
    && Number(sql(`select current_stock from products where uid='${ML}'`)) === ml0 - 1 && Number(sql(`select current_stock from products where uid='${GR}'`)) === gr0, sold.join('|'));
  const wcard2 = await posW();
  ok('W6 POS inaonyesha bei za chombo kilicho wazi (MA-LOT): 70ml 2,500', /2,500/.test(await wcard2.innerText()), (await wcard2.innerText()).replace(/\s+/g, ' '));
  ok('H5 (hq) wine: vitufe 2 kwenye safu ya RETAIL (70 / 80), QUARTER/HALF/WHOLESALE = "—"', (await wcard2.locator('.pour-ms [data-ml]').count()) === 2
    && (await wcard2.locator('.price.none').count()) === 3);

  // ── (hq) colours, 0 ml, stock 0, chip, row height, screenshots ──
  const cK = () => sql(`select uid from pour_container where product_uid='${k}' and status='OPEN'`);
  if (!cK()) { const kc = await pos(); await kc.locator('[data-test="pour-open"]').click(); await sleep(2500); }
  const level = async (ml) => {
    sql(`update pour_container set ml_left = ${ml} where uid='${cK()}'`);
    const r = await pos();
    return r.evaluate((e) => {
      const i = e.querySelector('[data-test="pour-bar"]');
      const probe = (v) => { const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
      const lv = getComputedStyle(i).getPropertyValue('--lv').trim();
      return { level: e.getAttribute('data-level'), track: getComputedStyle(i).backgroundColor, fill: i.firstElementChild ? getComputedStyle(i.firstElementChild).backgroundColor : '',
        ok: probe('var(--c-success)'), mid: probe('var(--c-warning)'), low: probe('var(--c-error)'), lv: probe(lv), open: !!e.querySelector('[data-test="pour-open"]') };
    });
  };
  const l1 = await level(600), l2 = await level(300), l3 = await level(100), l4 = await level(0);
  ok('H1 rangi 4 kwa ml: 600 (80%) kijani, 300 (40%) njano, 100 (13%) nyekundu, 0 nyekundu iliyokolea + "Fungua chupa"',
    l1.level === 'ok' && l1.fill === l1.ok && l2.level === 'mid' && l2.fill === l2.mid && l3.level === 'low' && l3.fill === l3.low
    && l4.level === 'empty' && l4.track === l4.lv && l4.track !== l4.low && l4.open,
    JSON.stringify({ l1, l2, l3, l4 }));
  // 0 ml -> "Fungua chupa": the 0 ml container is closed (no loss) and a new one opened (parent -1)
  const c0 = cK(), pk0 = Number(sql(`select current_stock from products where uid='${parent}'`));
  await (await pos()).locator('[data-test="pour-open"]').click();
  await sleep(3000);
  ok('H3 0 ml -> "Fungua chupa": chombo cha 0 ml CLOSED bila upotevu wala journal, kipya 750, mzazi -1',
    sql(`select status||'|'||ml_lost from pour_container where uid='${c0}'`) === 'CLOSED|0.00' && sql(`select count(*) from journal_entry where reference_uid='${c0}'`) === '0'
    && bar(k) === '750.00' && Number(sql(`select current_stock from products where uid='${parent}'`)) === pk0 - 1,
    `${sql(`select status||'|'||ml_lost from pour_container where uid='${c0}'`)} bar=${bar(k)}`);
  // parent stock 0: no button, the warning text
  const ps = sql(`select current_stock from products where uid='${parent}'`);
  sql(`update pour_container set status='CLOSED', close_kind='FINISHED', closed_at=now(), closed_by='E2E-hq', ml_left=0 where uid='${cK()}'`);
  sql(`update products set current_stock = 0 where uid='${parent}'`);
  const z = await pos();
  ok('H4 mzazi stock 0: "Stock 0 — andika manunuzi", HAKUNA kitufe (wala cha kukataliwa)', (await z.locator('[data-test="pour-zero"]').count()) === 1
    && (await z.locator('[data-test="pour-open"]').count()) === 0 && (await z.locator('button').count()) === 0 && /Stock 0/.test(await z.innerText()), await z.innerText());
  sql(`update products set current_stock = ${ps} where uid='${parent}'`);
  // rows on top, same height; the chip
  await pos();
  const rows = await mgr.page.locator('.board .item').evaluateAll((els) => els.map((e) => ({ pour: e.hasAttribute('data-pour'), h: Math.round(e.getBoundingClientRect().height) })));
  const firstNormal = rows.findIndex((r) => !r.pour), lastPour = rows.map((r) => r.pour).lastIndexOf(true);
  const hp = rows.filter((r) => r.pour).map((r) => r.h), hn = rows.filter((r) => !r.pour).slice(0, 5).map((r) => r.h);
  ok('H8 mistari ya kupima iko JUU ya bidhaa za kawaida, urefu sawa (+-4px)', lastPour >= 0 && firstNormal > lastPour && hp.every((h) => Math.abs(h - hn[0]) <= 4), JSON.stringify({ hp, hn, firstNormal, lastPour }));
  const chip = mgr.page.locator('[data-test="chip-kupima"]');
  const nP = rows.filter((r) => r.pour).length;
  ok('H7a chip "Kupima (n)" kwenye mstari wa makundi', (await chip.count()) === 1 && (await chip.innerText()).includes(String(nP)), await chip.innerText().catch(() => ''));
  await chip.click(); await sleep(500);
  const only = await mgr.page.locator('.board .item').evaluateAll((els) => els.map((e) => e.hasAttribute('data-pour')));
  await chip.click(); await sleep(500);
  const back = await mgr.page.locator('.board .item:not([data-pour])').count();
  ok('H7 chip: inaonyesha mistari ya kupima TU; ikibonyezwa tena bidhaa zinarudi', only.length === nP && only.every(Boolean) && back > 0, JSON.stringify({ only: only.length, nP, back }));
  // screenshots (light + dark): Konyagi at 650 ml
  if (!cK()) { await (await pos()).locator('[data-test="pour-open"]').click(); await sleep(2500); }
  sql(`update pour_container set ml_left = 650 where uid='${cK()}'`);
  const SHOT = process.env.KUPIMA_SHOTS;
  if (SHOT) {
    await pos(); await sleep(500);
    await mgr.page.locator('section.products').screenshot({ path: `${SHOT}/pos-kupima-light.png` });
    const dark = await session(browser, MGR, 'dark');
    await dark.page.goto(V3 + '/sales/new'); await sleep(3000); await closeBanners(dark.page);
    await dark.page.locator('section.products').screenshot({ path: `${SHOT}/pos-kupima-dark.png` });
    ok('H9 screenshot light + dark (dark: data-theme=dark)', (await dark.page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark');
    mgr.errors.push(...dark.errors);
  }

  ok('U11 hakuna kosa la JavaScript', ceo.errors.length + mgr.errors.length === 0, [...ceo.errors, ...mgr.errors].join(' | ').slice(0, 300));
  await browser.close();
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
