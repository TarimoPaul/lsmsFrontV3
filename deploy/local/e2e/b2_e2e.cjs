// B2 (Security · Logins) end to end on the PRODUCTION build: V3 Docker-local + backend Docker-local (release/2.4.0,
// PG15, 29/10 copy) with the TEST GeoIP files (deploy/local/geoip). Setup touches only the local copy.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');

const V3 = 'http://127.0.0.1:4300/v3';
const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com', MGR = 'macheda@gmail.com', EXE = 'jess@elikom.co.tz';
const PW = 'B2-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();

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
// a login as it arrives from Cloudflare on prod (X-Real-IP = a Cloudflare edge, CF-Connecting-IP = the client)
const cfLogin = (email, ip) => fetch(API + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Real-IP': '162.158.10.20', 'CF-Connecting-IP': ip, 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/140.0.0.0 Mobile Safari/537.36 OPR/91.0.0.0' },
  body: JSON.stringify({ email, password: PW, deviceId: 'jess-simu' }),
}).then((r) => r.status);

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}','${EXE}')`);
  // (bi) re-runnable on the same local copy: counts are deltas from here, not totals
  const jessDc = () => Number(sql(`select count(*) from login_audit where email_attempted='${EXE}' and network_flag='DATACENTER' and asn=12876`));
  const jessKnown = () => Number(sql(`select count(*) from login_audit_ack a join users u on u.uid=a.user_uid where u.email='${EXE}' and a.asn=12876 and a.kind='KNOWN_NETWORK'`));
  const dc0 = jessDc(), kn0 = jessKnown();
  ok('S1 login 2 za Jess kutoka Scaleway (Cloudflare)', (await cfLogin(EXE, '51.158.200.7')) === 200 && (await cfLogin(EXE, '51.158.200.7')) === 200);
  await new Promise((r) => setTimeout(r, 1500));
  ok('S2 DB: safu za Jess ni DATACENTER AS12876', jessDc() - dc0 === 2, `+${jessDc() - dc0}`);

  const browser = await chromium.launch();
  const errors = [];
  const newPage = async () => { const p = await (await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true })).newPage(); p.on('pageerror', (e) => errors.push(String(e))); return p; };

  // ---- CEO: card → page → known network → seen → revoke → CSV
  const ceo = await newPage();
  await login(ceo, CEO);
  await new Promise((r) => setTimeout(r, 1000));
  ok('A1 DB: login ya V3 inatuma deviceId (hash ipo)', sql(`select count(*) from login_audit where email_attempted='${CEO}' and device_id_hash is not null`) !== '0');
  const card = ceo.locator('app-login-alerts-card a');
  await card.waitFor({ timeout: 20000 });
  ok('A2 kadi ya dashibodi: login zinahitaji kuangaliwa', /need a look|zinahitaji kuangaliwa/.test(await card.innerText()));
  await card.click();
  await ceo.waitForURL(/\/v3\/security\/logins/);
  const jessRow = ceo.locator('tr, .m-row, .row, li').filter({ hasText: EXE }).filter({ hasText: 'DATACENTER' }).first();
  await jessRow.waitFor({ timeout: 20000 });
  ok('A3 tab "Za kuangalia" ina login ya Jess (DATACENTER, AS12876)', /12876/.test(await jessRow.innerText()));
  await jessRow.getByRole('button', { name: /Known network|VPN inayojulikana/ }).click();
  const rd = ceo.locator('app-reason-dialog');
  await rd.waitFor();
  const confirm = rd.getByRole('button', { name: /Mark as known|Weka kama unaojulikana/ });
  await rd.locator('textarea').fill('fupi');
  ok('A4 sababu fupi -> imezimwa', await confirm.isDisabled());
  await rd.locator('textarea').fill('Jess hutumia Opera VPN kwenye simu');
  await confirm.click();
  ok('A5 mtandao unaojulikana umehifadhiwa', await toast(ceo, /Known network saved|umehifadhiwa/));
  ok('A6 DB: ack KNOWN_NETWORK ya Jess AS12876', jessKnown() - kn0 === 1, `+${jessKnown() - kn0}`);
  ok('A7 login inayofuata ya Jess: KNOWN_VPN (haipigi tahadhari)', (await cfLogin(EXE, '51.158.200.7')) === 200
    && (await new Promise((r) => setTimeout(r, 1200)), sql(`select alert from login_audit where email_attempted='${EXE}' order by id desc limit 1`)) === 'KNOWN_VPN');

  // Nimeona on one alerting row
  await ceo.reload();
  const anyAlert = ceo.locator('tr, .m-row, .row, li').filter({ has: ceo.getByRole('button', { name: /^(Seen|Nimeona)$/ }) }).first();
  await anyAlert.waitFor({ timeout: 20000 });
  const before = Number(sql("select count(*) from login_audit_ack where kind='SEEN'"));
  await anyAlert.getByRole('button', { name: /^(Seen|Nimeona)$/ }).click();
  ok('A8 Nimeona: toast', await toast(ceo, /Marked as seen|Nimeona/));
  ok('A9 DB: ack SEEN imeongezeka', Number(sql("select count(*) from login_audit_ack where kind='SEEN'")) === before + 1);

  // known networks tab → revoke
  await ceo.getByRole('radio', { name: /Known networks|Mitandao inayojulikana/ }).click();
  const net = ceo.locator('.nets li').filter({ hasText: '12876' });
  await net.waitFor({ timeout: 15000 });
  ok('A10 tab ya mitandao: Jess AS12876', (await net.innerText()).includes('12876'));
  await net.getByRole('button', { name: /Revoke|Ondoa/ }).click();
  await ceo.locator('app-reason-dialog textarea').fill('Jess ameacha kutumia VPN hii');
  await ceo.locator('app-reason-dialog').getByRole('button', { name: /^(Revoke|Ondoa)$/ }).click();
  ok('A11 imeondolewa', await toast(ceo, /Revoked|Imeondolewa/));
  // (bi) the list reloads after the toast: wait for it instead of counting at once
  let nets = -1;
  for (let i = 0; i < 40 && nets !== 0; i++) { nets = await ceo.locator('.nets li').count(); if (nets) await ceo.waitForTimeout(250); }
  ok('A12 orodha ya mitandao iko tupu', nets === 0, `mitandao ${nets}`);

  // CSV (export is audited by the server)
  await ceo.getByRole('radio', { name: /^(Logins|Login)/ }).first().click();
  const audits = Number(sql("select count(*) from audit_trails where action='LOGIN_AUDIT_EXPORT'"));
  const [dl] = await Promise.all([ceo.waitForEvent('download', { timeout: 30000 }), ceo.getByRole('button', { name: 'CSV' }).click()]);
  ok('A13 CSV imepakuliwa', /login-audit-.*\.csv/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('A14 DB: export imeandikwa kwenye audit_trails', Number(sql("select count(*) from audit_trails where action='LOGIN_AUDIT_EXPORT'")) === audits + 1);
  ok('A15 attribution ya DB-IP inaonyeshwa', /DB-IP/.test(await ceo.locator('.attr').innerText()));

  // ---- without LOGIN_AUDIT_VIEW: no card, no page (MANAGER, Executive CEO)
  for (const [tag, who] of [['B', MGR], ['C', EXE]]) {
    const p = await newPage();
    await login(p, who);
    await p.waitForTimeout(2500);
    ok(`${tag}1 ${who}: hakuna kadi ya login`, (await p.locator('app-login-alerts-card a').count()) === 0);
    await p.goto(V3 + '/security/logins');
    await p.waitForTimeout(2000);
    ok(`${tag}2 ${who}: ukurasa umezuiwa`, !/\/security\/logins/.test(new URL(p.url()).pathname), p.url());
  }

  ok('Z hakuna JS error', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  console.log(`JUMLA PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('ERROR', e.message); console.log(`JUMLA PASS ${P} FAIL ${F + 1}`); process.exit(2); });
