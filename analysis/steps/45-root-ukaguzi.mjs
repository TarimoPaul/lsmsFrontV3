// HATUA 45f / 45g (MPANGO §1.8 (a), (b2), (d)) - UKAGUZI TU, kwa root@system.com (hatua pekee zinazotumia root).
//   TARGET=prod node 45-root-ukaguzi.mjs a   -> (a) password ya ZAMANI (default ya DataInitializer) inakataliwa KWANZA,
//                                              kisha password MPYA (ROOT_PASS) inaingia. Jaribio 1 tu la ya zamani:
//                                              LoginAttemptService inafunga email baada ya makosa 5; login sahihi inafuta hesabu.
//   TARGET=prod node 45-root-ukaguzi.mjs b2  -> (b2) admin@admin.com ni INACTIVE; FINANCE_WRITE ya CEO / Executive CEO inaonyeshwa
//   TARGET=prod node 45-root-ukaguzi.mjs d   -> (d) baada ya restart (c): (a) tena + admin INACTIVE + Executive CEO HANA
//                                              FINANCE_WRITE + CEO (mmiliki) ANAYO
// Haiandiki chochote: login na GET tu. Password ya zamani inasomwa kutoka code ya backend (haiandikwi kwenye faili hili).
import fs from 'node:fs';
import { API, TARGET, check, short, login, call, finish } from './45-lib.mjs';

const MODE = (process.argv[2] || '').toLowerCase();
if (!['a', 'b2', 'd'].includes(MODE)) { console.log('Tumia: node 45-root-ukaguzi.mjs a|b2|d'); process.exit(1); }
const ROOT = 'root@system.com', ADMIN = 'admin@admin.com', CEO = 'tarimo@gmail.com', EXEC_CEO = 'jess@elikom.co.tz';

async function rootPasswords() {
  const src = fs.readFileSync('D:/MY PROJECT/DUKA PROJECT/Lsms/Lsms/src/main/java/com/Lsms/uaa/entity/DataInitializer.java', 'utf8');
  const m = src.match(/root\.password:([^}]+)\}/);
  if (!m) { check('(a)-default', false, 'default ya root.password haikupatikana kwenye DataInitializer.java'); return false; }
  const old = m[1], neu = process.env.ROOT_PASS ?? '';
  if (!neu || neu === old) { check('(a)-mpya-si-ya-zamani', false, 'password uliyoandika ni ileile ya default - haijabadilishwa; hakuna login iliyojaribiwa'); return false; }
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ROOT, password: old }) });
  check('(a)-ya-zamani-inakataliwa', res.status === 401, `login ya ${ROOT} kwa password ya zamani: HTTP ${res.status} (lazima 401${res.status === 429 ? '; 429 = imefungwa kwa makosa 5, subiri' : ''})`);
  return res.status === 401;
}
async function user(email) {
  const q = await call('GET', `/api/users?search=${encodeURIComponent(email)}&size=20`);
  return (q.data?.content ?? []).find((u) => String(u.email).toLowerCase() === email);
}
async function fw(email) {
  const u = await user(email);
  if (!u) return { found: false };
  const q = await call('GET', `/api/users/${u.uid}/permissions/FINANCE_WRITE/check`);
  return { found: true, status: u.status, fw: q.ok ? q.data === true : null };
}

if (MODE === 'a' || MODE === 'd') {
  if (!(await rootPasswords())) finish(`root ${MODE}`);
}
const me = await login(ROOT, process.env.ROOT_PASS, { allowRoot: true });
check('(a)-mpya-inaingia', me.isRoot === true, `${ROOT} ameingia kwa password mpya; isRoot ${me.isRoot}`);
if (MODE === 'b2' || MODE === 'd') {
  const ad = await user(ADMIN);
  if (MODE === 'b2') {
    check('(b2)-admin-INACTIVE', !!ad && ad.status === 'INACTIVE', ad ? `${ADMIN}: status ${ad.status} (lazima INACTIVE)` : `${ADMIN} haikupatikana kwenye /api/users`);
  } else {
    // Mmiliki 21/10 14:xx: boot (DataInitializer, root.email) inaweza kuiwasha admin@admin.com tena baada ya restart. Kwa leo kinga ni
    // password: login ya admin@admin.com kwa Root@123 lazima 401 (jaribio 1 tu - LoginAttemptService inafunga baada ya 5).
    // Status ACTIVE baada ya restart = TAHADHARI (hotfix 2.2.72), si FAIL; is_root inaonyeshwa na 45g kutoka dump ya 45a.
    const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'lsms-18/45-root-ukaguzi.mjs' }, body: JSON.stringify({ email: ADMIN, password: 'Root@123' }) });
    check('(d)-admin-Root@123-inakataliwa', r.status === 401, `login ya ${ADMIN} kwa Root@123: HTTP ${r.status} (lazima 401${r.status === 429 ? '; 429 = imefungwa kwa makosa 5 - haithibitishi password' : ''})`);
    console.log(`  ${ADMIN}: status ${ad?.status ?? 'HAIKUPATIKANA'} baada ya restart`);
    if (ad?.status !== 'INACTIVE') console.log(`TAHADHARI admin@admin.com ni ${ad?.status ?? '?'} baada ya restart - boot ya backend inaiwasha (root.email); password imebadilishwa, hotfix 2.2.72 inahitajika`);
  }
  const c = await fw(CEO), e = await fw(EXEC_CEO);
  console.log(`  ${CEO}: ${short(c)} | ${EXEC_CEO}: ${short(e)}`);
  if (MODE === 'd') {
    check('(d)-CEO-ana-FINANCE_WRITE', c.found && c.fw === true, `${CEO} (mmiliki): FINANCE_WRITE ${c.fw}`);
    check('(d)-Executive-CEO-hana-FINANCE_WRITE', e.found && e.fw === false, `${EXEC_CEO}: FINANCE_WRITE ${e.fw} (lazima false baada ya (b))`);
  }
}
finish(`root ${MODE} ${TARGET}`);
