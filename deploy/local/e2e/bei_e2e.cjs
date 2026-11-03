// Bei ya kununua (owner 03/11 cj): the product list shows the buying price per piece = cost per piece of the
// last APPROVED/RECEIVED purchase (products.last_purchase_cost), on the PRODUCTION build
// (http://127.0.0.1:4300/v3/ + backend Docker-local with lastPurchaseCost in ProductDto).
// - CEO (PURCHASE_READ) sees the column; 4 bought products show the DB value, a never-bought one shows "—".
// - A user with PRODUCT_READ but none of PURCHASE_READ / PROFIT_REPORT / FINANCE_READ does not see it.
//   No such role exists on the copy, so the printer role gets PRODUCT_READ for this run and loses it again.
// Writes on the throw-away copy only: test passwords + that temporary role permission (removed at the end).
// Run: NODE_PATH=<npx playwright node_modules> node bei_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const CEO = 'tarimo@gmail.com', PRINTER = 'printer@elikom.co.tz';
const PW = 'B1-Jaribio-Local-2026';
const HEAD = /^(Buying \/ pc|Kununua \/ kip)$/i;
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const firstNumber = (s) => { const m = (s || '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

async function login(browser, email, errors) {
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(`${email}: ${e}`));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  await page.goto(V3 + '/products');
  await page.locator('app-products-page table thead').waitFor({ timeout: 30000 });
  for (let i = 0; i < 40 && (await page.locator('app-products-page lsms-skeleton').count()); i++) await page.waitForTimeout(250);
  await page.waitForTimeout(800);
  return page;
}

async function headers(page) {
  // header text is upper-cased by CSS and followed by the sort icon name on its own line
  return (await page.locator('app-products-page table thead th').allInnerTexts()).map((t) => t.split('\n')[0].trim());
}

/** Search one product by name and read the buying-price cell of the row whose title is that product. */
async function buyingCell(page, name, col) {
  const box = page.locator('app-products-page lsms-filter-panel input').first();
  await box.fill(name);
  await page.waitForTimeout(700);
  const rows = page.locator('app-products-page table tbody tr');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const cells = rows.nth(i).locator('td');
    const titles = (await rows.nth(i).locator('td .prod strong').allInnerTexts()).map((t) => t.trim());
    if (titles.includes(name)) return (await cells.nth(col).innerText()).trim();
  }
  return null;
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${PRINTER}')`);

  // Products whose name is unique (the cell lookup goes by name): 4 bought ones with different costs, 1 never bought.
  const bought = sql(`select product_name, last_purchase_cost from products p where coalesce(is_deleted,false)=false and last_purchase_cost is not null
      and (select count(*) from products q where q.product_name=p.product_name and coalesce(q.is_deleted,false)=false)=1
      order by last_purchase_cost desc`).split('\n').filter(Boolean).map((l) => l.split('|'));
  const pick = [bought[0], bought[Math.floor(bought.length / 3)], bought[Math.floor((2 * bought.length) / 3)], bought[bought.length - 1]];
  const never = sql(`select product_name from products p where coalesce(is_deleted,false)=false and last_purchase_cost is null
      and (select count(*) from products q where q.product_name=p.product_name and coalesce(q.is_deleted,false)=false)=1 limit 1`);
  ok('S1 nakala: bidhaa 4 zenye gharama + 1 isiyonunuliwa zimepatikana', pick.every(Boolean) && !!never, `${pick.length} | ${never}`);
  // DB rule the column relies on: last_purchase_cost = cost_per_piece of the newest APPROVED/RECEIVED purchase.
  const mismatch = sql(`with l as (select distinct on (product_uid) product_uid, cost_per_piece from purchases
      where status in ('APPROVED','RECEIVED') and coalesce(is_deleted,false)=false order by product_uid, purchase_date desc, created_at desc)
      select count(*) from products p join l on l.product_uid=p.uid where p.last_purchase_cost is null or abs(l.cost_per_piece-p.last_purchase_cost)>=0.01`);
  ok('S2 DB: last_purchase_cost = gharama/kipande ya manunuzi ya mwisho (tofauti 0)', mismatch === '0', mismatch);

  const browser = await chromium.launch();
  const errors = [];

  // ── CEO sees the column with the DB values ──
  const ceo = await login(browser, CEO, errors);
  const h = await headers(ceo);
  const col = h.findIndex((t) => HEAD.test(t));
  const pieceCol = h.findIndex((t) => /^(Piece|Kipande)$/i.test(t));
  ok('C1 CEO: column "Kununua / kip" ipo', col >= 0, JSON.stringify(h));
  ok('C2 CEO: iko kabla ya bei ya kuuza kipande', col >= 0 && pieceCol === col + 1, `${col} ${pieceCol}`);
  for (const [name, cost] of pick) {
    const cell = await buyingCell(ceo, name, col);
    const v = firstNumber(cell);
    // owner rule 28/09: money is shown in whole shillings (291.67 -> 292), as on the purchases page
    ok(`C3 ${name}: ${cost} -> ${Math.round(Number(cost))}`, v === Math.round(Number(cost)), JSON.stringify(cell));
  }
  const nc = await buyingCell(ceo, never, col);
  ok(`C4 ${never} (haijanunuliwa): "—"`, nc === '—', JSON.stringify(nc));
  await ceo.context().close();

  // ── PRODUCT_READ without cost permissions: no column ──
  const role = sql(`select uid from roles where name='printer'`);
  const perm = sql(`select uid from permissions where name='PRODUCT_READ'`);
  const had = sql(`select count(*) from role_permissions where role_uid='${role}' and permission_uid='${perm}'`) !== '0';
  const costPerms = sql(`select count(*) from users u join user_roles ur on ur.user_uid=u.uid join role_permissions rp on rp.role_uid=ur.role_uid
      join permissions p on p.uid=rp.permission_uid where u.email='${PRINTER}' and p.name in ('PURCHASE_READ','PROFIT_REPORT','FINANCE_READ')`);
  ok('H0 printer hana PURCHASE_READ/PROFIT_REPORT/FINANCE_READ', costPerms === '0', costPerms);
  if (!had) sql(`insert into role_permissions(role_uid, permission_uid) values ('${role}','${perm}')`);
  try {
    const pr = await login(browser, PRINTER, errors);
    const ph = await headers(pr);
    ok('H1 printer (PRODUCT_READ tu): orodha inaonekana', ph.some((t) => /^(Product|Bidhaa)$/i.test(t)), JSON.stringify(ph));
    ok('H2 printer: column ya bei ya kununua HAIPO', !ph.some((t) => HEAD.test(t)), JSON.stringify(ph));
    await pr.context().close();
  } finally {
    if (!had) sql(`delete from role_permissions where role_uid='${role}' and permission_uid='${perm}'`);
  }
  ok('H3 ruhusa ya muda imeondolewa', had || sql(`select count(*) from role_permissions where role_uid='${role}' and permission_uid='${perm}'`) === '0');

  ok('E0 hakuna page error', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
