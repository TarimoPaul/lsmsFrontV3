// HATUA 47 (MPANGO §1.9): kufunga vipindi vya GL Jan-Sep 2026, BAADA ya marekebisho (46) na M-7 (43).
// Kwa akaunti ya CEO (mmiliki), si root. Kufunga kunazuia journal za mkono kwenye miezi hiyo; matukio ya mfumo yanahamia
// siku ya kwanza iliyo wazi (late entry). Kufungua upya: POST /api/v1/gl/periods/{y}/{m}/reopen {reason}.
//   TARGET=staging|prod node 47-funga-jan-sep.mjs kagua   -> HAIANDIKI: miezi 9 iko OPEN, M-7 ipo, makosa 0, TB, salio
//   TARGET=staging|prod node 47-funga-jan-sep.mjs andika  -> kagua tena, kisha funga 1..9, kisha ukaguzi
// prod: salio na checks za kabla lazima ziwe SAWA na mazoezi ya staging (45c) kabla ya kufunga.
import fs from 'node:fs';
import { TARGET, check, failed, today, short, money, same, login, call, pages, bal, saveMazoezi, readMazoezi, finish, haliSoma, haliAndika } from './45-lib.mjs';

const MODE = (process.argv[2] || '').toLowerCase();
if (!['kagua', 'andika'].includes(MODE)) { console.log('Tumia: node 47-funga-jan-sep.mjs kagua|andika'); process.exit(1); }
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const HALI = haliSoma('47');   // prod: kufunga kulishaanza leo (kurudia baada ya kukatika)

const per0 = await call('GET', '/api/v1/gl/periods');
const jan_sep = (list) => (list ?? []).filter((p) => p.year === 2026 && p.month >= 1 && p.month <= 9);
const notOpen = jan_sep(per0.data).filter((p) => p.status !== 'OPEN');
// Kuendelea: miezi iliyokwisha fungwa lazima iwe mfululizo 1..c (kufunga kunaenda kwa mpangilio), mingine OPEN.
const closedMonths = jan_sep(per0.data).filter((p) => p.status === 'CLOSED').map((p) => p.month).sort((a, b) => a - b);
const tayari = closedMonths.length;
if (HALI && MODE === 'kagua') { check('kagua', null, `kufunga kulishaanza leo (${tayari}/9 CLOSED) - kagua ya kawaida inarukwa; andika itaendelea`); finish('funga kagua'); }
if (HALI) {
  console.log(`ANDIKA_ILISHAANZA ${HALI.imeanza} - njia ya KUENDELEA: CLOSED ${closedMonths.join(',') || 'hakuna'}`);
  check('miezi-mfululizo', per0.ok && closedMonths.every((mo, i) => mo === i + 1) && notOpen.length === tayari,
    `CLOSED ${closedMonths.join(',') || 'hakuna'}; si OPEN ${notOpen.map((p) => `${p.month}=${p.status}`).join(', ') || 'hakuna'} (lazima 1..c CLOSED, mingine OPEN)`);
} else {
  check('miezi-iko-wazi', per0.ok && notOpen.length === 0, notOpen.length ? `si OPEN: ${notOpen.map((p) => `${p.month}=${p.status}`).join(', ')}` : 'Jan-Sep 2026 zote OPEN (au hazina safu)');
}

const m7 = [];
for (const d of ['2026-10-04', '2026-09-30']) {
  m7.push(...(await pages(`/api/v1/gl/journal-entries?startDate=${d}&endDate=${d}&referenceType=MANUAL_ADJUSTMENT`))
    .filter((e) => !e.isReversal && String(e.referenceNumber ?? e.memo ?? '').startsWith('M-7:')));
}
check('M-7-ipo', m7.length === 2, `journals za M-7 ${m7.length} (lazima 2: 04/10 na 30/09): ${m7.map((e) => `${e.entryDate} ${e.entryNumber}`).join(', ')}`);
const f0 = await call('GET', '/api/v1/gl/posting-failures?open=true');
check('makosa-wazi', f0.ok && f0.data?.openCount === 0, `posting-failures openCount=${f0.data?.openCount}`);
const tb = await call('GET', `/api/v1/gl/trial-balance?startDate=2025-01-01&endDate=2026-09-30`);
check('TB-30/09', tb.ok && same(tb.data?.totalDebits, tb.data?.totalCredits), `TB hadi 30/09 Dr ${money(tb.data?.totalDebits)} Cr ${money(tb.data?.totalCredits)}`);
const kabla = { salio: {} };
for (const code of ['1000', '1100', '2000', '2900', '3000', '6700']) kabla.salio[code] = await bal(code, '2026-09-30');
kabla.tbDr = Number(tb.data?.totalDebits ?? 0);
console.log(`  salio 30/09: ${Object.entries(kabla.salio).map(([c, v]) => `${c} ${money(v)}`).join('; ')}`);
check('2000-30/09', same(kabla.salio['2000'], 0), `2000 ya 30/09 = ${money(kabla.salio['2000'])} (lazima 0 baada ya M-7)`);
if (TARGET === 'staging' && MODE === 'kagua') saveMazoezi('funga-kagua', kabla);
if (TARGET === 'prod') {
  const m = readMazoezi('funga-kagua');
  if (m) {
    const d = Object.keys(m.salio).filter((c) => !same(kabla.salio[c], m.salio[c]));
    check('salio-30/09-sawa-na-mazoezi', d.length === 0 && same(kabla.tbDr, m.tbDr),
      d.length || !same(kabla.tbDr, m.tbDr) ? `tofauti: ${d.map((c) => `${c} prod ${money(kabla.salio[c])} mazoezi ${money(m.salio[c])}`).join('; ')} TB ${money(kabla.tbDr)} vs ${money(m.tbDr)}` : 'salio 6 za 30/09 na TB sawa na mazoezi');
  }
}
if (MODE === 'kagua' || failed()) {
  if (MODE === 'andika' && failed()) console.log('SIMAMA: kagua haijapita - HAKUNA MWEZI ULIOFUNGWA');
  finish(`funga ${MODE}`);
}

const reason = `MPANGO 1.9: kufunga baada ya marekebisho ya Toleo 1 (H-1, H-2, Q9) na M-7 (${TARGET} ${today})`;
if (!HALI) haliAndika('47', { imeanza: new Date().toISOString() });
for (let mo = (HALI ? tayari : 0) + 1; mo <= 9; mo++) {
  haliAndika('47', { [`funga_${mo}`]: new Date().toISOString() });
  const q = await call('POST', `/api/v1/gl/periods/2026/${mo}/close`, { reason });
  check(`funga-2026-${String(mo).padStart(2, '0')}`, q.ok, q.ok ? 'CLOSED' : short(q.message));
  if (!q.ok) break; // mwezi mmoja ukikataa, miezi inayofuata haifungwi (kufunga kunaenda kwa mpangilio)
}
const per1 = await call('GET', '/api/v1/gl/periods');
const closed = jan_sep(per1.data).filter((p) => p.status === 'CLOSED').length;
check('miezi-9-imefungwa', closed === 9, `Jan-Sep CLOSED: ${closed}/9`);
const after = {};
for (const code of ['1000', '2000', '2900']) after[code] = await bal(code, '2026-09-30');
const ch = Object.keys(after).filter((c) => !same(after[c], kabla.salio[c]));
check('salio-hazijabadilika', ch.length === 0, ch.length ? `zimebadilika: ${ch.join(', ')}` : 'kufunga hakukubadilisha salio za 30/09');
fs.writeFileSync(`analysis/steps/47-${TARGET}-funga.json`, JSON.stringify({ kabla, after, periods: jan_sep(per1.data) }, null, 2));
if (TARGET === 'staging') saveMazoezi('funga-andika', { closed });
if (!failed()) haliAndika('47', { imekamilika: new Date().toISOString() });
finish('funga andika');
