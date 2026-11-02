// B5 (owner as/be, 02/11): V3 write buttons of the books only for FINANCE_WRITE, on the PRODUCTION build
// (http://127.0.0.1:4300/v3/ + backend Docker-local). Real roles of the copy: CEO = FINANCE_READ + FINANCE_WRITE,
// Executive CEO = FINANCE_READ without FINANCE_WRITE. Both open the same pages; only CEO gets the buttons, and the
// server refuses Executive CEO's write (403). NO WRITES: the only API write is an invalid transfer sent as
// Executive CEO (refused before validation); setup sets test passwords on the throw-away copy only.
// Run: NODE_PATH=<npx playwright node_modules> node b5_e2e.cjs
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com', EXEC = 'jess@elikom.co.tz';
const PW = 'B1-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-c', q], { encoding: 'utf8' }).trim();

const WRITE = {
  journal: /^(Manual journal|Journal ya mkono|Transfer|Uhamisho)$/,
  periods: /^(Close|Funga|Reopen|Fungua upya)$/,
  overview: /^(Correct|Rekebisha|Count|Hesabu|Retry|Jaribu tena)$/,
  loans: /^(Loan received|Mkopo mpya|Repay|Lipa mkopo|Details|Maelezo|Convert to capital|Geuza kuwa mtaji)$/,
};
const HOST = { journal: 'app-gl-journal', periods: 'app-gl-periods', overview: 'app-gl-overview', loans: 'app-loans-tab' };
const URL = { journal: '/general-ledger?tab=journal', periods: '/general-ledger?tab=periods', overview: '/general-ledger?tab=overview', loans: '/capital?tab=loans' };

async function counts(browser, email, errors) {
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(`${email}: ${e}`));
  await page.goto(V3 + '/login');
  await page.locator('input[autocomplete="username"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PW);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/v3/login'), { timeout: 30000 });
  const out = {};
  for (const k of Object.keys(URL)) {
    await page.goto(V3 + URL[k]);
    const host = page.locator(HOST[k]);
    let shown = true;
    try { await host.waitFor({ timeout: 30000 }); } catch { shown = false; }
    // the content, not the skeleton: wait until it stops loading
    await page.waitForTimeout(2500);
    for (let i = 0; i < 40 && (await host.locator('lsms-skeleton').count()); i++) await page.waitForTimeout(250);
    out[k] = { shown, write: shown ? await host.getByRole('button', { name: WRITE[k] }).count() : -1, text: shown ? (await host.innerText()).length : 0 };
  }
  await page.context().close();
  return out;
}

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${EXEC}')`);
  const perms = (role) => sql(`select string_agg(p.name, ',' order by p.name) from roles r join role_permissions rp on rp.role_uid = r.uid join permissions p on p.uid = rp.permission_uid where r.name = '${role}' and p.name like 'FINANCE_%'`);
  ok('S1 nakala: CEO = FINANCE_READ+WRITE, Executive CEO = FINANCE_READ tu', perms('CEO') === 'FINANCE_READ,FINANCE_WRITE' && perms('Executive CEO') === 'FINANCE_READ', `${perms('CEO')} | ${perms('Executive CEO')}`);

  const browser = await chromium.launch();
  const errors = [];
  const ceo = await counts(browser, CEO, errors);
  const ex = await counts(browser, EXEC, errors);
  console.log('CEO', JSON.stringify(ceo), '| EXEC', JSON.stringify(ex));

  ok('B1 CEO: Journal ina vitufe 2 (Journal ya mkono, Uhamisho)', ceo.journal.write === 2, ceo.journal.write);
  ok('B2 CEO: Vipindi vina Funga/Fungua upya', ceo.periods.write >= 1, ceo.periods.write);
  ok('B3 CEO: Mikopo ina "Mkopo mpya" (na vitufe vya mkopo)', ceo.loans.write >= 1, ceo.loans.write);
  ok('B4 CEO: Muhtasari wa GL una vitufe vya kuandika (Hesabu/Rekebisha)', ceo.overview.write >= 1, ceo.overview.write);
  for (const k of Object.keys(URL)) {
    ok(`E-${k} Executive CEO: ukurasa unaonekana bila kitufe chochote cha kuandika`, ex[k].shown && ex[k].text > 50 && ex[k].write === 0, JSON.stringify(ex[k]));
  }

  const token = (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EXEC, password: PW }) })).json()).data.tokenInfo.token;
  const r = await fetch(API + '/api/v1/gl/transfers', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' });
  ok('API Executive CEO POST /gl/transfers -> 403 (server inakubaliana na V3)', r.status === 403, r.status);

  ok('Z hakuna JS error kwenye kurasa', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
