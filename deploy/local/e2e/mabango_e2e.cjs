// (bj) "Deni limelipwa" banners on the PRODUCTION build (V3 Docker-local + backend Docker-local): with 50 fresh
// unread debt collections and 10 older than 24 h, at most 3 banners show, the rest are "+N zaidi kwenye kengele"
// (a link to the debt inbox), nothing older than 24 h is a banner, and every button at the bottom right of a page
// can still be clicked once the page is scrolled to its end. The 60 notifications are this run's own (one unique
// marker) and are deleted at the end, also after a failure.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const PW = 'B3-Jaribio-Local-2026';
const RUN = `Jaribio mabango ${Date.now().toString(36)}`;
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
const cleanup = () => sql(`delete from notifications where message like '${RUN}%'`);

async function api(method, path, token) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
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

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  const ceoUid = sql(`select uid from users where email = '${CEO}'`);
  // Server time is EAT (LocalDateTime.now() of the backend); 50 within the last 20 hours, 10 from 2-11 days ago.
  sql(`insert into notifications (uid, created_at, is_active, is_deleted, is_read, message, recipient_user_uid, title, type, total_amount)
       select gen_random_uuid()::text, (now() at time zone 'Africa/Dar_es_Salaam') - make_interval(mins => g * 20), true, false, false,
              '${RUN} FRESH ' || g, '${ceoUid}', 'Deni limelipwa', 'DEBT_COLLECTED', 1000 * g from generate_series(1, 50) g`);
  sql(`insert into notifications (uid, created_at, is_active, is_deleted, is_read, message, recipient_user_uid, title, type, total_amount)
       select gen_random_uuid()::text, (now() at time zone 'Africa/Dar_es_Salaam') - make_interval(days => g + 1), true, false, false,
              '${RUN} OLD ' || g, '${ceoUid}', 'Deni limelipwa', 'DEBT_COLLECTED', 500 * g from generate_series(1, 10) g`);
  const token = (await (await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: CEO, password: PW }) })).json()).data.tokenInfo.token;
  const debtUnread = Number((await api('GET', '/api/v1/notifications/unread-counts', token)).j.data?.DEBT_COLLECTED ?? 0);
  ok('S0 arifa 60 za jaribio zimeingia (50 mpya, 10 za zamani)', sql(`select count(*) from notifications where message like '${RUN}%'`) === '60' && debtUnread >= 60, `unread DEBT ${debtUnread}`);

  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await login(page);
  await page.goto(V3 + '/capital?tab=loans');
  const stack = page.locator('app-debt-banners');
  await stack.locator('.banner').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);

  const banners = await stack.locator('.banner').allInnerTexts();
  ok('M1 mabango si zaidi ya 3', banners.length === 3, String(banners.length));
  ok('M2 mabango ni ya karibuni zaidi (FRESH 1-3), hakuna la zaidi ya saa 24', banners.every((t) => t.includes(`${RUN} FRESH`)) && !banners.some((t) => t.includes(' OLD ')),
    banners.map((t) => t.split('\n')[1]).join(' | '));
  const more = stack.locator('.foot .more');
  const moreText = (await more.count()) ? await more.innerText() : '';
  ok(`M3 "+${debtUnread - 3} zaidi kwenye kengele"`, new RegExp(`\\+${debtUnread - 3} (more in the bell|zaidi kwenye kengele)`).test(moreText), moreText);

  // Every button at the bottom right (right half, lowest part of the page) can be clicked once the page is at its end.
  const covered = [];
  let checked = 0;
  for (const path of ['/capital?tab=loans', '/customers', '/capital']) {
    await page.goto(V3 + path);
    await page.locator('main#main').waitFor();
    await page.waitForTimeout(2500);
    await page.locator('main#main').evaluate((m) => { const el = m.closest('.scroll'); el.scrollTo(0, el.scrollHeight); });
    await page.waitForTimeout(400);
    const box = await stack.boundingBox();
    const buttons = page.locator('main#main button:visible');
    const n = await buttons.count();
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      const r = await b.boundingBox();
      if (!r || !box || r.x + r.width < box.x || r.y + r.height < 900 - box.height - 200) continue; // only the bottom-right area
      checked++;
      // Covered = the button's centre is on screen and not clipped by a scrolling box (a table row scrolled out of its
      // own table is not "visible"), yet what is on top there is not the button. A disabled one counts too.
      const state = await b.evaluate((el) => {
        const q = el.getBoundingClientRect();
        const x = q.x + q.width / 2, y = q.y + q.height / 2;
        if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return 'nje';
        for (let a = el.parentElement; a; a = a.parentElement) {
          if (getComputedStyle(a).overflowY === 'visible' && getComputedStyle(a).overflowX === 'visible') continue;
          const r = a.getBoundingClientRect();
          if (y < r.top || y > r.bottom || x < r.left || x > r.right) return 'nje';
        }
        return el.contains(document.elementFromPoint(x, y)) ? 'juu' : 'chini';
      });
      if (state === 'nje') { checked--; continue; }
      if (state === 'chini') covered.push(`${path} "${(await b.innerText()).trim().slice(0, 30)}"`);
    }
  }
  ok(`M4 vitufe vya chini kulia vinabofyeka (${checked} vimekaguliwa)`, checked > 0 && covered.length === 0, covered.join(', '));

  await page.goto(V3 + '/capital?tab=loans');
  await stack.locator('.foot .more').click();
  await page.waitForURL(/\/account\/notifications\?tab=DEBT/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  ok('M5 "+N zaidi" inafungua arifa za madeni (kengele), mabango hayaonekani juu yake',
    (await stack.locator('.banner').count()) === 0 && /Debt collections|Madeni yaliyolipwa/.test(await page.locator('lsms-segmented-filter-bar [aria-checked="true"]').first().innerText().catch(() => '')));

  // Closing one banner brings the next fresh one, still 3.
  await page.goto(V3 + '/capital?tab=loans');
  await stack.locator('.banner').first().waitFor();
  const tag = (t) => (t.match(/FRESH \d+/) ?? [''])[0];
  const first = tag(await stack.locator('.banner').first().innerText());
  await stack.locator('.banner .x').first().click();
  await page.waitForTimeout(500);
  const after = (await stack.locator('.banner').allInnerTexts()).map(tag);
  ok('M6 kufunga moja: bado 3, lililofungwa halipo', first !== '' && after.length === 3 && !after.includes(first), `${first} | ${after.join(' | ')}`);

  // Only collections older than 24 h left unread: no banner at all, the bell still counts them.
  sql(`delete from notifications where message like '${RUN} FRESH %'`);
  await page.goto(V3 + '/capital?tab=loans');
  await page.locator('app-loans-tab').waitFor();
  await page.waitForTimeout(3000);
  const bell = await page.locator('app-topbar [matBadge], app-topbar .mat-badge').first().getAttribute('aria-label').catch(() => '');
  ok('M7 za zaidi ya saa 24 tu: hakuna bango, kengele inazihesabu', (await stack.locator('.banner').count()) === 0 && /\(\d+\)/.test(bell ?? ''), `bango ${await stack.locator('.banner').count()} kengele "${bell}"`);

  ok('Z hakuna JS error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  cleanup();
  ok('Z2 usafi: arifa za jaribio zimefutwa', sql(`select count(*) from notifications where message like '${RUN}%'`) === '0');
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => {
  console.log('ERROR', e.message);
  try { cleanup(); console.log('usafi umefanyika baada ya kosa'); } catch (c) { console.log('USAFI UMESHINDWA', c.message); }
  console.log(`JUMLA PASS ${P} FAIL ${F + 1}`);
  process.exit(2);
});
