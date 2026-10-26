// HATUA 45i (d) - UTHIBITISHO WA PC baada ya .env mpya: KUSOMA TU, kwa root@system.com.
//   TARGET=prod node 45i-thibitisha.mjs
// 1) root@system.com inaingia - JARIBIO 1 TU la login (makosa ya leo tayari 3-4; LoginAttemptService inafunga baada ya 5).
// 2) admin@admin.com bado INACTIVE baada ya restart (boot haiigusi tena kwa sababu ROOT_EMAIL=root@system.com).
// Ishara: THIBITISHO_45I_SAWA (exit 0). Ikishindwa (mmiliki 21/10): exit 1, HAKUNA rollback wala restart - .env mpya inabaki,
// kwa sababu rollback inarudisha ROOT_EMAIL=admin@admin.com (boot ingeifufua admin) na login ya pili ingeongeza kosa.
import { API, check, failed, short, finish } from './45-lib.mjs';

const ROOT = 'root@system.com', ADMIN = 'admin@admin.com';
const UA = { 'User-Agent': 'lsms-18/45i-thibitisha.mjs' };
const simama = (sababu) => { console.log(`ENV IMEFANIKIWA — ${sababu}; usirudie; leta log`); finish('45i thibitisha'); };
// login() ya 45-lib inaondoka (exit 1) ikishindwa; hapa tunataka ujumbe wazi, kwa hiyo ombi moja la moja kwa moja.
let r, j = {};
try {
  r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ROOT, password: process.env.ROOT_PASS ?? '' }) });
  j = await r.json().catch(() => ({}));
} catch (e) {
  check('root-inaingia', false, `login ya ${ROOT} haikukamilika: ${short(String(e?.message ?? e))}`);
  simama('login ya root haikukamilika (mtandao) - huenda ilifika kwenye server');
}
const ok = r.status === 200 && (j?.data?.isRoot === true || j?.data?.tokenInfo?.isRoot === true);
check('root-inaingia', ok, `login ya ${ROOT}: HTTP ${r.status}${r.status === 429 ? ' (imefungwa kwa makosa 5)' : ''}; isRoot ${j?.data?.isRoot ?? j?.data?.tokenInfo?.isRoot}`);
if (!ok) simama(r.status === 200 ? `login ya ${ROOT} ilikubaliwa lakini isRoot si true` : 'password ya root haikukubaliwa');
// token ya login ileile (hakuna login ya pili)
const token = j.data?.tokenInfo?.token ?? j.data?.token;
const ur = await fetch(`${API}/api/users?search=${encodeURIComponent(ADMIN)}&size=20`, { headers: { ...UA, Authorization: `Bearer ${token}` } });
const q = { http: ur.status, ...(await ur.json().catch(() => ({}))) };
const ad = (q.data?.content ?? []).find((u) => String(u.email).toLowerCase() === ADMIN);
check('admin-INACTIVE', !!ad && ad.status === 'INACTIVE', ad ? `${ADMIN}: status ${ad.status} baada ya restart (lazima INACTIVE)` : `${ADMIN} haikupatikana: HTTP ${q.http} ${short(q.message)}`);
if (failed()) simama(ad ? `${ADMIN} ni ${ad.status} baada ya restart - izime kwenye V3 mara moja` : `hali ya ${ADMIN} haikusomwa`);
console.log('THIBITISHO_45I_SAWA');
finish('45i thibitisha');
