// HATUA 53 (4) - login ya admin@admin.com kwa (a) Root@123 na (b) password tupu: ZOTE lazima zisiwe 200 - 401, au 400 kwa password tupu (boot haikubadilisha password;
// ROOT_PASSWORD sasa ni tupu). Hakuna kitu kinachoandikwa; kila jaribio ni login iliyoshindwa kwa admin@admin.com tu.
//   TARGET=prod node 53-admin-login.mjs
// Ikiwa yoyote ni 200: SIMAMA_ADMIN_LOGIN_200 (exit 1; .cmd inaitafuta) - mmiliki aambiwe mara moja.
import { API, check, finish } from './45-lib.mjs';

const UA = { 'User-Agent': 'lsms-18/53-admin-login.mjs', 'Content-Type': 'application/json' };
let mia2 = false;
for (const [lebo, pw] of [['(a) Root@123', 'Root@123'], ['(b) password tupu', '']]) {
  let http = 'HAKUNA', msg = '';
  try {
    const r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: UA, body: JSON.stringify({ email: 'admin@admin.com', password: pw }) });
    http = r.status; msg = String((await r.json().catch(() => ({})))?.message ?? '').slice(0, 120);
  } catch (e) { msg = String(e?.message ?? e).slice(0, 120); }
  if (http === 200) mia2 = true;
  // mmiliki 22/10: kinachotakiwa ni "si 200" - password tupu inajibiwa 400 (validation) kabla ya kufika kwenye login,
  // na hiyo ni salama. Kosa la mtandao (HAKUNA) bado ni FAIL: hatujui jibu.
  check(`admin-login-${lebo.slice(1, 2)}`, typeof http === 'number' && http !== 200, `admin@admin.com ${lebo}: HTTP ${http} (lazima si 200) ${msg}`);
}
if (mia2) { console.log('SIMAMA_ADMIN_LOGIN_200: login ya admin@admin.com IMEKUBALIWA - mwambie mmiliki MARA MOJA') }
finish('53 admin login');
