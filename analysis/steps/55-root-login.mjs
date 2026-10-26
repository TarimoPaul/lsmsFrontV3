// HATUA 55 (mwisho) - root@system.com inaingia: login MOJA (password kutoka ROOT_PASS, haiandikwi popote). Hakuna kuandika.
//   TARGET=prod PROD_API=https://elikom.co.tz ROOT_PASS=... node analysis/steps/55-root-login.mjs
// Inatoa ROOT_LOGIN_SAWA ikiwa HTTP 200 na isRoot; vinginevyo FAIL (exit 1).
import { API, check, finish } from './45-lib.mjs';

const pw = process.env.ROOT_PASS ?? '';
if (!pw) { check('root-login', false, 'ROOT_PASS haijawekwa - hakuna login iliyojaribiwa'); finish('55 root login'); }
let http = 'HAKUNA', isRoot = false, email = '', msg = '';
try {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'lsms-18/55-root-login.mjs' },
    body: JSON.stringify({ email: 'root@system.com', password: pw }),
  });
  http = r.status;
  const j = await r.json().catch(() => ({}));
  isRoot = !!(j?.data?.isRoot || j?.data?.tokenInfo?.isRoot);
  email = j?.data?.tokenInfo?.email ?? '';
  msg = String(j?.message ?? '').slice(0, 120);
} catch (e) { msg = String(e?.message ?? e).slice(0, 120); }
const ok = http === 200 && isRoot && email === 'root@system.com';
check('root-login', ok, `root@system.com: HTTP ${http}, isRoot ${isRoot}, email ${email || '-'} (lazima 200 + isRoot) ${msg}`);
if (ok) console.log('ROOT_LOGIN_SAWA');
finish('55 root login');
