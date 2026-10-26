// Maktaba ya hatua za §1.8 (45-47): login, call, pages, PASS/FAIL, na mazoezi ya staging.
// Kanuni (mmiliki 20/10):
//  - TARGET=staging : mazoezi kwenye staging (dump ya usiku huo huo) - matokeo yanahifadhiwa analysis\steps\45-mazoezi\*.json.
//  - TARGET=prod    : prod; kila hatua inayoandika inalinganisha namba zake na mazoezi KABLA ya kuandika, na inasimama zikitofautiana.
//  - Akaunti: marekebisho / M-7 / kufunga = akaunti ya CEO (mmiliki), si root: root inakataliwa (isRoot kutoka login).
//    Root inatumika tu kwa (a) / (b2) / (d) (45-root-ukaguzi.mjs, allowRoot).
//  - Password inatoka kwenye variable ya mazingira (Read-Host -AsSecureString kwenye .cmd) na haiandikwi popote.
import fs from 'node:fs';

export const TARGET = (process.env.TARGET || '').toLowerCase();
if (!['staging', 'prod'].includes(TARGET)) { console.log('TARGET lazima iwe staging au prod'); process.exit(1); }
export const API = TARGET === 'staging' ? (process.env.API || 'http://localhost:8081') : process.env.PROD_API;
if (!API) { console.log('PROD_API haijawekwa (set PROD_API=https://elikom.co.tz au tunnel yako ya prod)'); process.exit(1); }
export const MAZOEZI = 'analysis/steps/45-mazoezi';

export const results = [];
export const check = (id, ok, msg) => { results.push([id, ok]); console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${id}: ${msg}`); };
export const failed = () => results.some(([, ok]) => ok === false);
export const p2 = (n) => String(n).padStart(2, '0');
const t0 = new Date();
export const today = `${t0.getFullYear()}-${p2(t0.getMonth() + 1)}-${p2(t0.getDate())}`;
export const short = (v) => JSON.stringify(v).slice(0, 300);
export const money = (v) => Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const same = (a, b) => Math.abs(Number(a ?? NaN) - Number(b ?? NaN)) < 0.005;

let H = null;
// User-Agent ya hatua za §1.8: 45-maandishi.sh (kinga ya nginx) haihesabu maombi haya kama matumizi ya duka.
const UA = { 'User-Agent': `lsms-18/${(process.argv[1] ?? '').split(/[\\/]/).pop()}` };
export async function login(email, password, { allowRoot = false } = {}) {
  let r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!r.ok) { console.log('LOGIN_IMESHINDWA', r.status); process.exit(1); }
  const login = (await r.json()).data;
  const perms = (login.permissions ?? []).map((p) => (typeof p === 'string' ? p : p?.name));
  const isRoot = !!(login.isRoot || login.tokenInfo?.isRoot);
  console.log(`MTUMIAJI ${login.tokenInfo?.email} | roles: ${(login.roles ?? []).join(',') || '-'} | isRoot: ${isRoot} | FINANCE_WRITE: ${perms.includes('FINANCE_WRITE')} | ${TARGET} ${API}`);
  if (!allowRoot) {
    if (isRoot) { console.log('IMEKATALIWA: akaunti ya ROOT haitumiki kwa marekebisho ya prod - tumia akaunti yako ya CEO'); process.exit(1); }
    if (!perms.includes('FINANCE_WRITE')) { console.log('IMEKATALIWA: akaunti hii haina FINANCE_WRITE'); process.exit(1); }
  }
  let token = login.tokenInfo.token;
  if (login.requiresBranchSelection || (!login.selectedBranchUid && (login.branches ?? []).length > 1)) {
    const b = login.branches[0];
    r = await fetch(`${API}/api/auth/select-branch`, { method: 'POST', headers: { ...UA, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branchUid: b.uid ?? b.branchUid }) });
    const sel = (await r.json()).data;
    token = (sel?.tokenInfo ?? sel)?.token ?? token;
  }
  H = { ...UA, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  return { ...login, perms, isRoot };
}
export async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let j; try { j = JSON.parse(t); } catch { j = { status: 'Error', message: t.slice(0, 300) }; }
  return { http: res.status, ok: res.status < 300 && j?.status !== 'Error' && j?.status !== 'Failure', status: j?.status, data: j?.data, message: j?.message, raw: j };
}
export async function pages(path) {
  const out = [];
  for (let page = 0; page < 50; page++) {
    const q = await call('GET', `${path}${path.includes('?') ? '&' : '?'}page=${page}&size=200`);
    const list = q.raw?.data ?? [];
    out.push(...list);
    if (list.length < 200) break;
  }
  return out;
}
// Salio la akaunti (Dr - Cr) tangu 2025-01-01 hadi tarehe.
export async function bal(code, end) {
  const t = await call('GET', `/api/v1/gl/trial-balance?startDate=2025-01-01&endDate=${end}`);
  const l = (t.data?.lines ?? []).find((x) => x.accountCode === code);
  return l ? Number(l.debitBalance ?? 0) - Number(l.creditBalance ?? 0) : 0;
}
// TB NZIMA (mmiliki 21/10): { akaunti: Dr - Cr } tangu 2025-01-01 hadi tarehe; null ikishindwa kusomwa.
export async function tbAll(end) {
  const t = await call('GET', `/api/v1/gl/trial-balance?startDate=2025-01-01&endDate=${end}`);
  if (!t.ok || !Array.isArray(t.data?.lines)) return null;
  const m = {};
  for (const l of t.data.lines) m[l.accountCode] = Math.round(((m[l.accountCode] ?? 0) + Number(l.debitBalance ?? 0) - Number(l.creditBalance ?? 0)) * 100) / 100;
  return m;
}
// Jumla ya mistari ya journals kwa akaunti (Dr - Cr) - tarajio la delta.
export function mistariYaJournals(journals) {
  const d = {};
  for (const e of journals) for (const l of e?.lines ?? []) d[l.accountCode] = Math.round(((d[l.accountCode] ?? 0) + Number(l.debitAmount ?? 0) - Number(l.creditAmount ?? 0)) * 100) / 100;
  return d;
}
// Delta ya TB nzima ndani ya hatua: KILA akaunti (iliyo kwenye TB ya kabla, ya baada au tarajio): baada - kabla = tarajio[akaunti],
// na akaunti isiyo kwenye tarajio lazima iwe 0. Tofauti yoyote -> FAIL (pamoja na maelekezo ya rollback).
export function deltaTB(id, lebo, kabla, baada, tarajio, rollback) {
  if (!kabla || !baada) { check(id, false, `TB ${lebo}: ${!kabla ? 'ya kabla' : 'ya baada'} haikusomwa - delta haikupimwa. ${rollback}`); return; }
  const codes = [...new Set([...Object.keys(kabla), ...Object.keys(baada), ...Object.keys(tarajio)])].sort();
  const bad = [];
  let sifuri = 0;
  for (const c of codes) {
    const d = Math.round(((baada[c] ?? 0) - (kabla[c] ?? 0)) * 100) / 100, t = tarajio[c] ?? 0, ok = same(d, t);
    if (!ok) bad.push(c);
    if (!ok || !same(t, 0)) console.log(`  delta ${lebo} ${c}: ${money(kabla[c])} -> ${money(baada[c])} = ${money(d)} (inatarajiwa ${money(t)})${ok ? '' : ' TOFAUTI'}`);
    else sifuri++;
  }
  console.log(`  delta ${lebo}: akaunti nyingine ${sifuri} - delta 0 kama inavyotarajiwa`);
  check(id, bad.length === 0, bad.length ? `TB ${lebo}: akaunti ${bad.join(', ')} hazilingani na journals. ${rollback}`
    : `TB ${lebo}: akaunti ${codes.length} zote - zilizoguswa = journals, nyingine zote 0`);
}

// Mazoezi: staging inaandika, prod inasoma. Faili la mazoezi lazima liwe la usiku huu (tarehe ya dump = leo).
export function saveMazoezi(name, obj) {
  if (TARGET !== 'staging') return;
  fs.mkdirSync(MAZOEZI, { recursive: true });
  fs.writeFileSync(`${MAZOEZI}/${name}.json`, JSON.stringify({ tarehe: today, ...obj }, null, 2));
  console.log(`  mazoezi yamehifadhiwa: ${MAZOEZI}/${name}.json`);
}
export function readMazoezi(name) {
  const p = `${MAZOEZI}/${name}.json`;
  if (!fs.existsSync(p)) { check(`mazoezi-${name}`, false, `${p} haipo - endesha mazoezi ya staging (45c) kwanza`); return null; }
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  // Mmiliki 21/10: 46a/46b/43/47 zimehamia asubuhi ya 22/10 (baada ya reco ya 21/10) - mazoezi ya 21/10 (dump ya 11:53) ndiyo msingi.
  const halali = m.tarehe === today || (m.tarehe === '2026-10-21' && today === '2026-10-22');
  if (!halali) { check(`mazoezi-${name}`, false, `${p} ni ya ${m.tarehe}, si ya leo ${today} - mazoezi lazima yawe ya usiku huu (au ya 21/10 kwa 22/10)`); return null; }
  return m;
}
// Data ya dump ya usiku huu (45b: SQL kwenye staging iliyorejeshwa): H2SALE / Q9SNAP / ... kama mistari "TAG|a|b|..."
export function dataRows(tag) {
  const p = `${MAZOEZI}/data.txt`;
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter((l) => l.startsWith(tag + '|')).map((l) => l.split('|'));
}
// Kukatika kwa umeme/mtandao (mmiliki 21/10): hatua ya prod inayoandika inaandika hali yake KABLA ya kila ombi la kuandika
// (analysis/steps/<n>-prod-hali-<leo>.json, fsync). Ikirudiwa, inaona andika ilishaanza na inaendelea pale ilipofika
// badala ya kusimama (kagua ya kawaida haiwezi kupita tena baada ya kuandika nusu). Staging haitumii hali (45c -> 45b upya).
export const haliPath = (n) => `analysis/steps/${n}-${TARGET}-hali-${today}.json`;
export function haliSoma(n) {
  if (TARGET !== 'prod' || !fs.existsSync(haliPath(n))) return null;
  return JSON.parse(fs.readFileSync(haliPath(n), 'utf8'));
}
export function haliAndika(n, obj) {
  if (TARGET !== 'prod') return;
  const data = JSON.stringify({ ...(haliSoma(n) ?? {}), ...obj, saa: new Date().toISOString() }, null, 2);
  const fd = fs.openSync(haliPath(n), 'w');
  try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
export const dakikaTangu = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 60000 : Infinity);
export function finish(label) {
  const fails = results.filter(([, ok]) => ok === false).length, skips = results.filter(([, ok]) => ok === null).length;
  console.log(`MUHTASARI ${label} (${TARGET}): PASS ${results.length - fails - skips}, FAIL ${fails}, SKIP ${skips}`);
  process.exit(fails ? 1 : 0);
}
