// HATUA 43 - M-7 (njia B: journals 2 za mkono), BAADA ya marekebisho ya §1.8 (46), KABLA ya kufunga Jan-Sep (47).
// Kupitia API tu (kanuni ya 15/10: hakuna query kwenye DB ya prod). Mantiki ya kuandika ni ILEILE ya staging:
// kipande cha M-7 kinakatwa kutoka 39-toleo1-jaribu.mjs (awamu B) na kuendeshwa hapa bila kubadilishwa.
//   TARGET=staging|prod node analysis\steps\43-m7-prod.mjs kagua   -> journals 7, jumla, Septemba wazi?, salio kabla; HAIANDIKI
//   TARGET=staging|prod node analysis\steps\43-m7-prod.mjs andika  -> inaandika journals 2 na kukagua tofauti
// staging = mazoezi (45c): namba zinahifadhiwa 45-mazoezi\m7-*.json. prod: kabla ya kuandika, journals 7, jumla na salio
// za kabla lazima ziwe SAWA na mazoezi; baada ya kuandika, salio za baada zinalinganishwa pia.
// Akaunti: CEO (mmiliki) mwenye FINANCE_WRITE; root inakataliwa (45-lib.mjs). CEO_EMAIL na CEO_PASS; password haiandikwi popote.
import fs from 'node:fs';
import { TARGET, check, failed, today, short, money, same, login, call, pages, bal, tbAll, deltaTB, saveMazoezi, readMazoezi, finish, haliSoma, haliAndika, dakikaTangu } from './45-lib.mjs';

const MODE = (process.argv[2] || '').toLowerCase();
if (!['kagua', 'andika'].includes(MODE)) { console.log('Tumia: node 43-m7-prod.mjs kagua|andika'); process.exit(1); }
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const HALI = haliSoma('43');   // prod: andika ilishaanza leo (kurudia baada ya kukatika)

// Journals 7 = PURCHASE_PAYMENT za 04/10, si reversal, na hazijageuzwa (reversal ingekuwa PURCHASE_PAYMENT ya 04/10 au baadaye).
const pp = await pages('/api/v1/gl/journal-entries?startDate=2026-10-04&endDate=2026-10-04&referenceType=PURCHASE_PAYMENT');
const revs = new Set((await pages(`/api/v1/gl/journal-entries?startDate=2026-10-04&endDate=${today}&referenceType=PURCHASE_PAYMENT`))
  .filter((e) => e.isReversal).map((e) => e.reversedEntryUid));
const live = pp.filter((e) => !e.isReversal && !revs.has(e.uid)).sort((a, b) => a.uid.localeCompare(b.uid));
const M7J = live.map((e) => ['M7J', e.uid, e.entryNumber, String(e.totalDebit)]);
for (const x of M7J) console.log(`  ${x.join('|')}`);
const rows = (tag) => (tag === 'M7J' ? M7J : []);
// Kipimo cha delta (mmiliki 21/10, LAZIMA, TB NZIMA): TB ya 30/09 na TB ya leo zinasomwa ndani ya hatua hii kabla na baada ya kuandika.
// Kila akaunti: baada - kabla = mistari ya journals za M-7 zilizoandikwa SASA; akaunti nyingine zote (1020/1021/1023/1025, 2100 ...) = 0.
//   j1 04/10: Dr 1000 / Cr 2000 X  -> TB 30/09: hakuna;            TB leo: 1000 +X, 2000 -X
//   j2 30/09: Dr 2000 / Cr 1000 X  -> TB 30/09: 1000 -X, 2000 +X;  TB leo: 1000 -X, 2000 +X
const ROLLBACK_43 = 'ROLLBACK: USIENDELEE na 47. Journals za M-7 zilizoandikwa (43-m7-prod.json) zinaweza kugeuzwa kwa POST /api/v1/gl/reverse'
  + '?referenceUid=<referenceUid ya journal>&reason=... (FINANCE_WRITE) - USIFANYE peke yako: nitumie log hii kwanza.';
const tb2 = async () => ({ d30: await tbAll('2026-09-30'), dT: await tbAll(today) });
function deltaM7(k, b, X, j0410, j3009) {
  const t30 = {}, tT = {};
  const add = (o, ac, v) => { o[ac] = Math.round(((o[ac] ?? 0) + v) * 100) / 100; };
  if (j0410) { add(tT, '1000', X); add(tT, '2000', -X); }
  if (j3009) { add(t30, '1000', -X); add(t30, '2000', X); add(tT, '1000', -X); add(tT, '2000', X); }
  deltaTB('delta-TB-30/09', '30/09', k?.d30, b?.d30, t30, ROLLBACK_43);
  deltaTB('delta-TB-leo', today, k?.dT, b?.dT, tT, ROLLBACK_43);
}

// Salio za kabla na orodha: prod lazima ilingane na mazoezi KABLA ya kuandika.
const kabla = { m7: M7J.map((x) => x[2]), sum: Math.round(M7J.reduce((t, x) => t + Number(x[3]), 0) * 100) / 100,
  c30: await bal('1000', '2026-09-30'), a30: await bal('2000', '2026-09-30'), cT: await bal('1000', today), aT: await bal('2000', today) };
console.log(`  kabla: journals ${kabla.m7.length}, jumla ${money(kabla.sum)}; 30/09 1000 ${money(kabla.c30)} 2000 ${money(kabla.a30)}; leo 1000 ${money(kabla.cT)} 2000 ${money(kabla.aT)}`);
check('M-7-jumla', kabla.m7.length === 7 && same(kabla.sum, 6751443.39), `journals ${kabla.m7.length} (lazima 7), jumla ${money(kabla.sum)} (lazima 6,751,443.39)`);
if (TARGET === 'staging' && MODE === 'kagua') saveMazoezi('m7-kagua', kabla);
// ── KUENDELEA (prod, andika ilishaanza): journals za M-7 zilizopo zinaonyesha imefika wapi; hakuna inayoandikwa mara mbili ──
const m7Done = [];
for (const d of ['2026-10-04', '2026-09-30']) {
  m7Done.push(...(await pages(`/api/v1/gl/journal-entries?startDate=${d}&endDate=${d}&referenceType=MANUAL_ADJUSTMENT`))
    .filter((e) => !e.isReversal && String(e.referenceNumber ?? '').startsWith('M-7:')));
}
if (HALI && m7Done.length) {
  console.log(`ANDIKA_ILISHAANZA ${HALI.imeanza} - njia ya KUENDELEA: M-7 zilizopo ${m7Done.map((e) => `${e.entryDate} ${e.entryNumber}`).join(', ')}`);
  if (MODE === 'kagua') { check('kagua', null, 'andika ilishaanza leo - kagua ya kawaida inarukwa; andika itaendelea pale ilipofika'); finish('M-7 kagua'); }
  const d0410 = m7Done.filter((e) => e.entryDate === '2026-10-04'), d3009 = m7Done.filter((e) => e.entryDate === '2026-09-30');
  check('M-7-hali', d0410.length === 1 && d3009.length <= 1, `04/10: ${d0410.length}, 30/09: ${d3009.length} (lazima 1 na 0 au 1)`);
  check('M-7-subiri', dakikaTangu(HALI.saa) >= 2, `ombi la mwisho dakika ${dakikaTangu(HALI.saa).toFixed(1)} zilizopita (lazima 2+; vinginevyo subiri na urudie)`);
  check('M-7-jumla', kabla.m7.length === 7 && same(kabla.sum, 6751443.39), `journals 7 za asili: ${kabla.m7.length}, jumla ${money(kabla.sum)}`);
  if (failed()) { console.log('SIMAMA: hali ya M-7 si ya kuendelea - HAKUNA KILICHOANDIKWA; nitumie log hii.'); finish('M-7 andika'); }
  const andikaJ2 = !d3009.length;
  const tbKabla = await tb2();
  if (andikaJ2) {
    const nums = M7J.map((x) => x[2]).join(', ');
    haliAndika('43', { j2_at: new Date().toISOString() });
    // Journal ya pili ILEILE ya 39-toleo1-jaribu.mjs (M-7 njia B), kwa kuwa ya kwanza ilishaingia kabla ya kukatika.
    const j2 = await call('POST', '/api/v1/gl/journal-entries/manual', {
      entryDate: '2026-09-30', memo: 'M-7: malipo ya Feb–Jul kutoka benki (yalirekodiwa 04/10)',
      lines: [{ accountCode: '2000', debit: kabla.sum, credit: 0, description: `Malipo ya Feb–Jul kutoka benki; yalirekodiwa 04/10 (${nums})` },
              { accountCode: '1000', debit: 0, credit: kabla.sum, description: 'Malipo ya Feb–Jul kutoka benki; Cr 1000 kwa sababu benki haikufuatiliwa kabla ya D' }] });
    check('M-7-journal-ya-pili', j2.ok, `30/09 ${j2.ok ? j2.data : short(j2.message)}`);
  } else console.log('  journals zote 2 za M-7 zilishaingia - hakuna kinachoandikwa');
  const after = { c30: await bal('1000', '2026-09-30'), a30: await bal('2000', '2026-09-30'), cT: await bal('1000', today), aT: await bal('2000', today) };
  const tbBaada = await tb2();
  fs.writeFileSync(`analysis/steps/43-m7-${TARGET}.json`, JSON.stringify({ kuendelea: true, m7Done, before: kabla, after, tbKabla, tbBaada }, null, 2));
  deltaM7(tbKabla, tbBaada, kabla.sum, false, andikaJ2);
  const m = readMazoezi('m7-andika');
  if (m) {
    const d = ['c30', 'a30'].filter((kk) => !same(after[kk], m.after?.[kk]));
    for (const kk of ['cT', 'aT']) console.log(`  TAARIFA ${kk}: prod ${money(after[kk])} mazoezi ${money(m.after?.[kk])}`);
    check('M-7-baada-sawa-na-mazoezi', d.length === 0, d.length ? d.map((kk) => `${kk} prod ${money(after[kk])} mazoezi ${money(m.after?.[kk])}`).join('; ') : 'salio 2 za 30/09 baada sawa na mazoezi');
  }
  if (failed()) console.log('SIMAMA: matokeo ya M-7 hayalingani - USIENDELEE na 47; nitumie log hii.');
  else haliAndika('43', { imekamilika: new Date().toISOString() });
  finish('M-7 andika (kuendelea)');
}

if (TARGET === 'prod') {
  const m = readMazoezi('m7-kagua');
  if (m) {
    const d = ['sum', 'c30', 'a30'].filter((kk) => !same(kabla[kk], m[kk]));
    for (const kk of ['cT', 'aT']) console.log(`  TAARIFA ${kk}: prod ${money(kabla[kk])} mazoezi ${money(m[kk])} (salio za leo - shughuli za 21/10 mchana na 22/10)`);
    check('M-7-sawa-na-mazoezi', d.length === 0 && short(kabla.m7) === short(m.m7),
      d.length || short(kabla.m7) !== short(m.m7) ? `tofauti: ${d.map((kk) => `${kk} prod ${money(kabla[kk])} mazoezi ${money(m[kk])}`).join('; ')}${short(kabla.m7) !== short(m.m7) ? ' / orodha ya journals tofauti' : ''}` : 'journals 7, jumla na salio 4 za kabla sawa na mazoezi');
  }
}
if (failed()) {
  if (MODE === 'andika') console.log('SIMAMA: kagua haijapita - HAKUNA KILICHOANDIKWA');
  finish(`M-7 ${MODE}`);
}

const src = fs.readFileSync('analysis/steps/39-toleo1-jaribu.mjs', 'utf8');
const a = src.indexOf('  // ── M-7 (19/10, njia B');
const b = src.indexOf('  // ── Vipindi: funga Jan-Sep 2026 ──');
if (a < 0 || b < 0) { console.log('KIPANDE_CHA_M7_HAKIPO kwenye 39-toleo1-jaribu.mjs'); process.exit(1); }
const out = `analysis/steps/43-m7-${TARGET}.json`;
if (MODE === 'andika') haliAndika('43', { imeanza: new Date().toISOString() });
const tbKabla = MODE === 'andika' ? await tb2() : null;
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction('rows', 'check', 'call', 'money', 'short', 'today', 'fs', 'M7_OUT', 'M7_WRITE', src.slice(a, b))(
  rows, check, call, money, short, today, fs, out, MODE === 'andika');

if (MODE === 'andika' && fs.existsSync(out)) {
  const r = JSON.parse(fs.readFileSync(out, 'utf8'));
  const tbBaada = await tb2();
  fs.writeFileSync(out, JSON.stringify({ ...r, tbKabla, tbBaada }, null, 2));
  deltaM7(tbKabla, tbBaada, kabla.sum, r.j1?.ok === true, r.j2?.ok === true);
  if (TARGET === 'staging') saveMazoezi('m7-andika', { after: r.after });
  else {
    const m = readMazoezi('m7-andika');
    if (m) {
      const d = ['c30', 'a30'].filter((kk) => !same(r.after?.[kk], m.after?.[kk]));
      for (const kk of ['cT', 'aT']) console.log(`  TAARIFA ${kk}: prod ${money(r.after?.[kk])} mazoezi ${money(m.after?.[kk])}`);
      check('M-7-baada-sawa-na-mazoezi', d.length === 0, d.length ? d.map((kk) => `${kk} prod ${money(r.after?.[kk])} mazoezi ${money(m.after?.[kk])}`).join('; ') : 'salio 2 za 30/09 baada sawa na mazoezi');
    }
  }
}
if (failed() && MODE === 'andika') console.log('SIMAMA: matokeo ya M-7 hayalingani - USIENDELEE na 47; nitumie log hii.');
else if (MODE === 'andika') haliAndika('43', { imekamilika: new Date().toISOString() });
finish(`M-7 ${MODE}`);
