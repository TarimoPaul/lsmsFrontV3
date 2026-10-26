// HATUA 46 (MPANGO §1.8 "marekebisho"): H-2 (repost ya sales zisizo na journal) + H-1 (marekebisho ya DAY_CLOSE_VARIANCE),
// suspense ya Q9 (snapshots 2: 24/06 na 04/07 -> 2900). Kwa akaunti ya CEO (mmiliki), si root.
//   TARGET=staging node 46-marekebisho.mjs kagua|andika  -> mazoezi (45c): namba zinahifadhiwa 45-mazoezi\marekebisho-*.json
//   TARGET=prod    node 46-marekebisho.mjs kagua         -> HAIANDIKI: dryRun ya prod = ya mazoezi, mstari kwa mstari
//   TARGET=prod    node 46-marekebisho.mjs andika        -> kagua tena (lazima ilingane), kisha H-2 + marekebisho halisi + ukaguzi
// Data (uids za H-2 na Q9) inatoka 45-mazoezi\data.txt: SQL kwenye staging iliyorejeshwa kutoka dump ya usiku huu (45b),
// kwa hiyo hakuna query kwenye DB ya prod (kanuni ya 15/10).
import fs from 'node:fs';
import { TARGET, check, failed, today, short, money, same, login, call, pages, bal, tbAll, mistariYaJournals, deltaTB, saveMazoezi, readMazoezi, dataRows, finish, haliSoma, haliAndika, dakikaTangu } from './45-lib.mjs';

const MODE = (process.argv[2] || '').toLowerCase();
if (!['kagua', 'andika'].includes(MODE)) { console.log('Tumia: node 46-marekebisho.mjs kagua|andika'); process.exit(1); }
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const HALI = haliSoma('46');   // prod: andika ilishaanza leo (kurudia baada ya kukatika)

// Namba za staging ya 20/10 (hatua 39/40) - kinga ya ziada juu ya ulinganisho na mazoezi ya usiku huu.
const Q9_UIDS = ['6c9e781d-4e31-4696-9247-9f23c2da4b07', '850ff8e2-7393-4af1-b830-48a9a8c06d10']; // 24/06, 04/07
const SUSPENSE = 742500;            // 210,500 + 532,000
const H2_JUZI = ['101026-2202', '121026-2249', '131026-2227'];
const TOCHANGE_MIN = 95;            // dryRun ya staging 20/10 (dump ya 20/10 02:00)
// Mmiliki 21/10 (16:xx): 46a/46b zinaendeshwa 22/10 baada ya reco ya 21/10. Mistari ya tarehe <= KATA lazima ilingane SAWASAWA
// na mazoezi ya 21/10 (dump ya 11:53); mistari ya 21/10 na baadaye ni MPYA (siku kamili sasa) - inaonyeshwa, hailinganishwi.
// 46b haitumii mazoezi kama msingi wa dryRun / halisi: inatumia matokeo ya 46a ya leo (46-prod-kagua.json), pamoja na
// suspenseSnapshotUid zake.
const KATA = '2026-10-20';
const A46 = 'analysis/steps/46-prod-kagua.json';

const saleDay = (receipt) => `20${receipt.slice(4, 6)}-${receipt.slice(2, 4)}-${receipt.slice(0, 2)}`; // risiti ddmmyy-....
async function liveSaleJournals(uid, receipt) {
  return (await pages(`/api/v1/gl/journal-entries?startDate=${saleDay(receipt)}&endDate=${today}`))
    .filter((e) => e.referenceUid === uid && !e.isReversal && String(e.referenceType).startsWith('SALE_'));
}
const rowKey = (r) => `${r.snapshotUid}|${r.journalUid ?? '-'}`;
const rowSig = (r) => `${r.group}/${r.action}/${Number(r.cashBefore).toFixed(2)}/${Number(r.cashAfter).toFixed(2)}/${r.counterAfter ?? '-'}`;
// Namba za jumla za matokeo ya marekebisho (dryRun au halisi) ziwe sawa na za mazoezi; na kila mstari uwe sawa.
function compareRun(id, x, m, keys = ['journals', 'toChange', 'errors', 'cashBefore', 'cashAfter', 'cashChange', 'suspenseAmount']) {
  const diff = keys.filter((k) => !same(x[k], m[k]));
  const mine = new Map((x.rows ?? []).map((r) => [rowKey(r), rowSig(r)]));
  const theirs = new Map((m.rows ?? []).map((r) => [rowKey(r), rowSig(r)]));
  const rowDiff = [...new Set([...mine.keys(), ...theirs.keys()])].filter((k) => mine.get(k) !== theirs.get(k));
  for (const k of rowDiff.slice(0, 15)) console.log(`  TOFAUTI ${k}: ${TARGET} ${mine.get(k) ?? 'HAIPO'} | mazoezi ${theirs.get(k) ?? 'HAIPO'}`);
  check(id, diff.length === 0 && rowDiff.length === 0,
    `${diff.length ? `namba tofauti: ${diff.map((k) => `${k} ${money(x[k])} vs ${money(m[k])}`).join('; ')}; ` : ''}mistari ${mine.size} (mazoezi ${theirs.size}), tofauti ${rowDiff.length}`);
}
// Mmiliki 22/10 (jioni): mstari wa <= KATA usio kwenye mazoezi unaruhusiwa IKIWA (a) ALREADY_CORRECT (hakuna kinachoandikwa),
// (b) journal yake ilipostiwa BAADA ya dump ya 45a (msingi wa mazoezi), NA (c) toChange, delta ya 1000, 2900, errors na kila kundi
// (idadi ya toChange + kiasi kinachobadilika, kutoka mistari) SAWASAWA na mazoezi; makundi ya server yanatofautiana kwa mistari
// isiyo kwenye mazoezi TU. Kitu kingine chochote -> FAIL kama awali.
const DUMP_45A = '2026-10-21T11:53:14';   // 45a: lsms_20261021_1153.dump (EAT) - mazoezi yalifanywa kwenye dump hii
const eat = (v) => String(v ?? '').replace(' ', 'T').slice(0, 19);   // LocalDateTime ya server = EAT
function kundiMabadiliko(rows) {
  const g = {};
  for (const r of rows ?? []) {
    if (r.action === 'ALREADY_CORRECT') continue;
    const v = (g[r.group] ??= [0, 0]); v[0] += 1; v[1] = Math.round((v[1] + Number(r.cashAfter) - Number(r.cashBefore)) * 100) / 100;
  }
  return g;
}
async function asiliYaMstari(r) {
  if (r.action !== 'ALREADY_CORRECT' || !same(r.cashBefore, r.cashAfter) || String(r.counterBefore) !== String(r.counterAfter))
    return { ok: false, sababu: `si ALREADY_CORRECT isiyobadilika (${rowSig(r)})` };
  const e = r.journalUid ? (await pages(`/api/v1/gl/journal-entries?startDate=${r.date}&endDate=${today}`)).find((j) => j.uid === r.journalUid) : null;
  const sn = await call('GET', `/api/v1/reconciliation/snapshots?fromDate=${r.date}&toDate=${r.date}`);
  const s = (sn.data ?? []).find((q) => q.uid === r.snapshotUid);
  const sTxt = s ? ['snapshotVersion', 'createdAt', 'approvedAt', 'reconciliationUid', 'status'].filter((k) => s[k] != null).map((k) => `${k} ${s[k]}`).join(', ') : 'snapshot haikupatikana kwenye API';
  console.log(`  ASILI ${r.snapshotUid}: day close ya ${r.date} (${r.userName ?? '-'}), snapshot v${r.snapshotVersion ?? '?'} - ${sTxt}`);
  if (!e) return { ok: false, sababu: `journal ${r.journalUid ?? '-'} haikupatikana - postedAt haijulikani` };
  const t = eat(e.postedAt);
  console.log(`  ASILI journal ${e.entryNumber} ${e.referenceType} ref ${e.referenceUid === r.snapshotUid ? 'snapshot hii' : e.referenceUid} - postedAt ${t || '-'} EAT na ${e.postedBy ?? '-'}; dump ya 45a ${DUMP_45A} -> ${t > DUMP_45A ? 'BAADA ya dump (haikuwa kwenye dump)' : 'KABLA ya dump'}`);
  if (!t || t <= DUMP_45A) return { ok: false, sababu: `journal ilipostiwa ${t || '-'} - si baada ya dump ya 45a ${DUMP_45A}` };
  return { ok: true, sababu: `ALREADY_CORRECT (hakuna kitakachoandikwa), journal ${e.entryNumber} ilipostiwa ${t} EAT baada ya dump ya 45a ${DUMP_45A}` };
}
// <= KATA: sawasawa na mazoezi; > KATA: MPYA (taarifa)
async function compareKata(id, x, m) {
  const pick = (rows, old) => (rows ?? []).filter((r) => (old ? r.date <= KATA : r.date > KATA));
  for (const r of pick(x.rows, false)) console.log(`  MPYA ${r.date} ${r.snapshotUid} ${r.userName ?? ''}: ${rowSig(r)}`);
  const mNew = pick(m.rows, false).length;
  if (mNew) console.log(`  (mazoezi yalikuwa na mistari ${mNew} ya baada ya ${KATA} - hailinganishwi)`);
  const xo = pick(x.rows, true), mo = pick(m.rows, true);
  const mKeys = new Set(mo.map(rowKey));
  let ruhusa = [];
  for (const r of xo.filter((q) => !mKeys.has(rowKey(q)))) {
    if (r.action !== 'ALREADY_CORRECT') continue;
    const a = await asiliYaMstari(r);
    if (a.ok) ruhusa.push({ r, sababu: a.sababu }); else console.log(`  HAIRUHUSIWI ${rowKey(r)}: ${a.sababu}`);
  }
  if (ruhusa.length) {
    const tot = ['toChange', 'cashChange', 'suspenseAmount', 'errors'].filter((k) => !same(x[k], m[k]));
    const gx = kundiMabadiliko(x.rows), gm = kundiMabadiliko(m.rows);
    const gd = [...new Set([...Object.keys(gx), ...Object.keys(gm)])].filter((g) => !((gx[g]?.[0] ?? 0) === (gm[g]?.[0] ?? 0) && same(gx[g]?.[1] ?? 0, gm[g]?.[1] ?? 0)));
    const allM = new Set((m.rows ?? []).map(rowKey)), nje = {};
    for (const r of (x.rows ?? []).filter((q) => !allM.has(rowKey(q)))) { const v = (nje[r.group] ??= [0, 0]); v[0] += 1; v[1] += Number(r.variance ?? 0); }
    const sx = x.groups ?? {}, sm = m.groups ?? {};
    const sd = [...new Set([...Object.keys(sx), ...Object.keys(sm), ...Object.keys(nje)])].filter((g) =>
      (sx[g]?.[0] ?? 0) - (sm[g]?.[0] ?? 0) !== (nje[g]?.[0] ?? 0) || !same((sx[g]?.[1] ?? 0) - (sm[g]?.[1] ?? 0), nje[g]?.[1] ?? 0));
    const txt = (g) => Object.entries(g).map(([k, v]) => `${k} ${v[0]}/${money(v[1])}`).join(', ');
    check(`${id}-RUHUSIWA-jumla-na-makundi`, tot.length === 0 && gd.length === 0 && sd.length === 0,
      `toChange ${x.toChange}/${m.toChange}, 1000 ${money(x.cashChange)}/${money(m.cashChange)}, 2900 ${money(x.suspenseAmount)}/${money(m.suspenseAmount)}, errors ${x.errors}/${m.errors} (${TARGET}/mazoezi)`
      + `${tot.length ? ` - TOFAUTI: ${tot.join(', ')}` : ''}; makundi (toChange/kiasi) ${TARGET} [${txt(gx)}] mazoezi [${txt(gm)}]${gd.length ? ` - TOFAUTI: ${gd.join(', ')}` : ''}`
      + `; makundi ya server yanatofautiana kwa mistari isiyo kwenye mazoezi tu: ${sd.length ? `HAPANA (${sd.join(', ')})` : 'ndiyo'}`);
    if (tot.length || gd.length || sd.length) ruhusa = [];
    for (const a of ruhusa) console.log(`  RUHUSIWA-ALREADY_CORRECT ${rowKey(a.r)}: ${a.sababu}; jumla na makundi SAWA na mazoezi`);
  }
  compareRun(id, { rows: xo.filter((r) => !ruhusa.some((a) => a.r === r)) }, { rows: mo }, []);   // mistari tu: jumla zina 21/10 ndani
  check(`${id}-errors-2900`, x.errors === 0 && same(x.suspenseAmount, m.suspenseAmount),
    `errors ${x.errors}, 2900 ${money(x.suspenseAmount)} (mazoezi ${money(m.suspenseAmount)}); jumla ya leo: journals ${x.journals}, toChange ${x.toChange}, 1000 ${money(x.cashChange)} (mazoezi ${m.toChange} / ${money(m.cashChange)})`);
}
const suspenseUids = (x) => (x.rows ?? []).filter((r) => r.counterAfter === '2900').map((r) => r.snapshotUid).sort();
function soma46a() {
  if (!fs.existsSync(A46)) { check('46a-matokeo', false, `${A46} haipo - endesha 46a kwanza`); return null; }
  const a = JSON.parse(fs.readFileSync(A46, 'utf8'));
  if (a.tarehe !== today) { check('46a-matokeo', false, `${A46} ni ya ${a.tarehe}, si ya leo ${today} - endesha 46a leo`); return null; }
  const ok = Array.isArray(a.suspenseSnapshotUids) && short(a.suspenseSnapshotUids) === short([...Q9_UIDS].sort());
  check('46a-suspenseSnapshotUid', ok, `46a (${a.saa}): ${short(a.suspenseSnapshotUids)}`);
  return ok ? a : null;
}
// Delta inayotarajiwa kwa kila akaunti kutoka mistari ya dryRun (DayCloseVarianceService.correct): kila journal ya variance ina
// mistari 2 - 1000 (Dr-Cr = cash) na akaunti moja ya upande wa pili (-cash). Kugeuza ya zamani + kuandika mpya:
//   1000 += cashAfter - cashBefore;  counterBefore += cashBefore;  counterAfter -= cashAfter   (Dr - Cr, kama bal()).
function deltaInayotarajiwa(rows) {
  const d = { '1000': 0 };
  const add = (a, v) => { if (a) d[a] = Math.round(((d[a] ?? 0) + v) * 100) / 100; };
  for (const r of rows ?? []) {
    const cb = Number(r.cashBefore ?? 0), ca = Number(r.cashAfter ?? 0);
    add('1000', ca - cb); add(r.counterBefore, cb); add(r.counterAfter, -ca);
  }
  return d;
}
const ROLLBACK_H2 = 'ROLLBACK: USIENDELEE (marekebisho ya variance, 43, 47). Journal za H-2 zilizoandikwa sasa (46-prod-andika.json -> h2) zinaweza '
  + 'kugeuzwa kwa POST /api/v1/gl/reverse?referenceUid=<sale uid>&reason=... (FINANCE_WRITE) - USIFANYE peke yako: nitumie log hii kwanza.';
const ROLLBACK_46 = 'ROLLBACK: USIENDELEE na 43/47. Marekebisho ni append-only: journal mpya za DAY_CLOSE_VARIANCE za snapshots zilizobadilika '
  + '(46-prod-andika.json -> real.rows) zinaweza kugeuzwa kwa POST /api/v1/gl/reverse?referenceUid=<snapshotUid>&reason=... (FINANCE_WRITE), '
  + 'lakini journal za zamani hazirudi zenyewe - USIFANYE peke yako: nitumie log hii kwanza.';
const groupsTxt = (x) => Object.entries(x.groups ?? {}).map(([g, v]) => `${g} ${v[0]}/${money(v[1])}`).join(', ');
// 46b (prod andika): suspenseSnapshotUid na dryRun ya msingi ni za 46a ya leo
const A = TARGET === 'prod' && MODE === 'andika' ? soma46a() : null;
if (TARGET === 'prod' && MODE === 'andika' && !A) finish('marekebisho andika');
const q9qs = (A ? A.suspenseSnapshotUids : Q9_UIDS).map((u) => `&suspenseSnapshotUid=${u}`).join('');

// ── KAGUA (haiandiki) ──
async function kagua() {
  const out = {};
  const f0 = await call('GET', '/api/v1/gl/posting-failures?open=true');
  check('makosa-wazi-kabla', f0.ok && f0.data?.openCount === 0, `posting-failures openCount=${f0.data?.openCount}`);

  // Q9: uids 2 kutoka dump ya usiku huu = uids za uamuzi wa mmiliki
  const q9 = dataRows('Q9SNAP');
  check('Q9-uids', q9.length === 2 && Q9_UIDS.every((u) => q9.some((r) => r[1] === u)),
    `Q9SNAP ${q9.length}: ${q9.map((r) => `${r[2]} ${r[1]} variance ${money(r[3])} declared ${money(r[4])}`).join('; ')}`);

  // H-2: sales zisizo na journal (kutoka dump ya usiku huu) - lazima bado zisiwe na journal kwenye TARGET
  const h2 = dataRows('H2SALE');
  out.h2 = [];
  check('H-2-orodha', H2_JUZI.every((rc) => h2.some((r) => r[2] === rc)), `H2SALE ${h2.length}: ${h2.map((r) => r[2]).join(', ') || 'hakuna'} (lazima ziwemo ${H2_JUZI.join(', ')})`);
  for (const [, uid, receipt, total, owed] of h2) {
    const js = await liveSaleJournals(uid, receipt);
    out.h2.push({ uid, receipt, total: Number(total), owed: Number(owed), journals: js.length });
    check('H-2-bado-haina-journal', js.length === 0, `${receipt} jumla ${money(total)} deni ${money(owed)}: journal za SALE_* hai ${js.length} (lazima 0 kabla ya repost)`);
  }

  // H-1: dryRun pamoja na Q9 -> 2900
  const dr = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=true${q9qs}`, {});
  if (!dr.ok) { check('dryRun', false, `IMESHINDWA ${dr.http} ${short(dr.message)}`); return out; }
  const x = dr.data; out.dry = x;
  fs.writeFileSync(`analysis/steps/46-${TARGET}-dryrun.json`, JSON.stringify(x, null, 2));
  console.log(`dryRun: journals ${x.journals}, zitabadilika ${x.toChange}, 1000 ${money(x.cashBefore)} -> ${money(x.cashAfter)} (${money(x.cashChange)}), 2900 ${money(x.suspenseAmount)}; makundi: ${groupsTxt(x)}`);
  check('dryRun', x.dryRun === true && x.errors === 0 && (x.suspenseNotApplicable ?? []).length === 0 && x.toChange >= TOCHANGE_MIN && same(x.suspenseAmount, SUSPENSE),
    `toChange ${x.toChange} (>= ${TOCHANGE_MIN}), errors ${x.errors}, 2900 ${money(x.suspenseAmount)} (lazima ${money(SUSPENSE)}), hazitumiki ${short(x.suspenseNotApplicable)}`);
  return out;
}

// ── KUENDELEA (prod, andika ilishaanza): kila kipande kinakaguliwa kimefika wapi; hakuna kinachoandikwa mara mbili ──
let realPending = true;
async function endelea() {
  const m = readMazoezi('marekebisho-kagua');
  const out = { h2: [] };
  for (const [, uid, receipt, total, owed] of dataRows('H2SALE')) {
    const js = await liveSaleJournals(uid, receipt);
    out.h2.push({ uid, receipt, total: Number(total), owed: Number(owed), journals: js.length });
    check('H-2-hali', js.length <= 1, `${receipt}: journal za SALE_* hai ${js.length} - ${js.length === 1 ? 'repost ilishafanyika' : js.length === 0 ? 'repost bado' : 'ZAIDI YA MOJA'}`);
  }
  if (m) check('H-2-sawa-na-mazoezi', short(out.h2.map((h) => h.receipt)) === short(m.h2.map((h) => h.receipt)), `${out.h2.map((h) => h.receipt).join(',')} | mazoezi ${m.h2.map((h) => h.receipt).join(',')}`);
  const dr = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=true${q9qs}`, {});
  if (!dr.ok) { check('dryRun', false, `IMESHINDWA ${dr.http} ${short(dr.message)}`); return out; }
  out.dry = dr.data;
  const t = dr.data.toChange, age = dakikaTangu(HALI.real_at);
  if (t === 0) {
    realPending = false;
    check('halisi-hali', true, 'marekebisho halisi yalishaingia (dryRun toChange 0) - hayatumwi tena');
  } else if (A && t === A.dry.toChange) {
    check('halisi-haijaingia', age >= 10, HALI.real_at ? `ombi la halisi lilitumwa dakika ${age.toFixed(1)} zilizopita na halijaingia - ${age >= 10 ? 'litatumwa tena' : 'SUBIRI hadi dakika 10 zipite, kisha endesha 46b tena'}` : 'halisi bado haijatumwa');
    compareRun('dryRun-sawa-na-46a', out.dry, A.dry);
  } else {
    check('halisi-nusu', false, `dryRun toChange ${t} (46a ${A?.dry?.toChange}) - huenda halisi bado inaendelea kwenye server: SUBIRI dakika 5 na uendeshe 46b tena; ikibaki hivyo SIMAMA na uniambie`);
  }
  return out;
}

let k;
if (HALI) {
  console.log(`ANDIKA_ILISHAANZA ${HALI.imeanza} - njia ya KUENDELEA (hali: ${short(HALI)})`);
  if (MODE === 'kagua') { check('kagua', null, 'andika ilishaanza leo - kagua ya kawaida inarukwa; andika itaendelea pale ilipofika'); finish('marekebisho kagua'); }
  k = await endelea();
} else {
  k = await kagua();
  if (TARGET === 'staging' && MODE === 'kagua') saveMazoezi('marekebisho-kagua', k);
  if (TARGET === 'prod') {
    const m = readMazoezi('marekebisho-kagua');
    if (m) {
      check('H-2-sawa-na-mazoezi', short(k.h2.map((h) => h.receipt)) === short(m.h2.map((h) => h.receipt)), `${TARGET} ${k.h2.map((h) => h.receipt).join(',')} | mazoezi ${m.h2.map((h) => h.receipt).join(',')}`);
      if (k.dry) await compareKata(`dryRun-hadi-${KATA}-sawa-na-mazoezi`, k.dry, m.dry);
    }
    if (k.dry) {
      const su = suspenseUids(k.dry);
      check('suspenseSnapshotUid', short(su) === short([...Q9_UIDS].sort()), `snapshots kwenda 2900: ${short(su)}`);
      if (MODE === 'andika' && A) compareRun('dryRun-sawa-na-46a', k.dry, A.dry);
      if (MODE === 'kagua' && !failed()) {
        fs.writeFileSync(A46, JSON.stringify({ tarehe: today, saa: new Date().toISOString(), suspenseSnapshotUids: su, h2: k.h2, dry: k.dry }, null, 2));
        console.log(`  matokeo ya 46a yamehifadhiwa: ${A46} (46b inayatumia)`);
      }
    }
  }
}
if (MODE === 'kagua' || failed()) {
  if (MODE === 'andika' && failed()) console.log('SIMAMA: kagua haijapita - HAKUNA KILICHOANDIKWA');
  finish(`marekebisho ${MODE}`);
}

// ── ANDIKA (kagua imepita) ──
if (!HALI) haliAndika('46', { imeanza: new Date().toISOString() });
const out = { kagua: k, h2: [], kuendelea: !!HALI };
// Kipimo cha delta cha H-2 (mmiliki 21/10, TB NZIMA): kabla ya repost ya kwanza na baada ya ya mwisho, ndani ya hatua hii.
const h2Sasa = k.h2.filter((h) => h.journals === 0);
const tbH2Kabla = h2Sasa.length ? await tbAll(today) : null;
const h2Mpya = [];
for (const h of k.h2) {
  if (h.journals > 0) {
    const e = (await liveSaleJournals(h.uid, h.receipt))[0];
    out.h2.push({ receipt: h.receipt, ok: true, message: 'ilishafanyika', journals: h.journals, type: e?.referenceType, dr: e?.totalDebit, cr: e?.totalCredit });
    check('H-2-repost', h.journals === 1 && same(e?.totalDebit, e?.totalCredit), `${h.receipt}: ilishafanyika kabla ya kukatika -> ${e ? `${e.referenceType} Dr ${money(e.totalDebit)} Cr ${money(e.totalCredit)}` : 'HAKUNA'}`);
    continue;
  }
  haliAndika('46', { [`h2_${h.receipt}`]: new Date().toISOString() });
  const q = await call('POST', `/api/v1/gl/corrections/repost-sale/${h.uid}`, {});
  const js = await liveSaleJournals(h.uid, h.receipt);
  const e = js[0];
  if (js.length === 1) h2Mpya.push(e);
  const ar = (e?.lines ?? []).filter((l) => ['1100', '1110'].includes(l.accountCode)).reduce((s, l) => s + Number(l.debitAmount), 0);
  out.h2.push({ receipt: h.receipt, ok: q.ok, message: q.message, journals: js.length, type: e?.referenceType, ar, dr: e?.totalDebit, cr: e?.totalCredit });
  check('H-2-repost', q.ok && q.data === true && js.length === 1 && same(e.totalDebit, e.totalCredit),
    `${h.receipt}: ${q.ok ? q.message : short(q.message)} -> ${e ? `${e.referenceType} AR ${money(ar)} Dr ${money(e.totalDebit)} Cr ${money(e.totalCredit)}` : 'HAKUNA JOURNAL'}`);
}
if (h2Sasa.length) {
  const tbH2Baada = await tbAll(today);
  out.deltaH2 = { kabla: tbH2Kabla, baada: tbH2Baada, tarajio: mistariYaJournals(h2Mpya) };
  if (h2Mpya.length !== h2Sasa.length) check('delta-H-2', false, `journals mpya ${h2Mpya.length} kati ya repost ${h2Sasa.length} - delta haiwezi kupimwa. ${ROLLBACK_H2}`);
  else deltaTB('delta-H-2', 'H-2', tbH2Kabla, tbH2Baada, out.deltaH2.tarajio, ROLLBACK_H2);
  if (failed()) { console.log('SIMAMA: H-2 haikulingana - marekebisho ya variance HAYATUMWI; nitumie log hii.'); fs.writeFileSync(`analysis/steps/46-${TARGET}-andika.json`, JSON.stringify(out, null, 2)); finish('marekebisho andika'); }
}
let r = {};
if (realPending) {
  // Kipimo cha delta (mmiliki 21/10, LAZIMA, TB NZIMA): TB kabla na baada ya ombi la halisi, ndani ya hatua hii hii
  const tarajio = deltaInayotarajiwa(k.dry.rows);
  const kabla = await tbAll(today);
  out.delta = { tarajio, kabla };
  haliAndika('46', { real_at: new Date().toISOString() });
  const real = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=false${q9qs}`, {});
  const baada = await tbAll(today);
  out.delta.baada = baada;
  // TB NZIMA: akaunti za mistari ya dryRun = jumla ya mistari hiyo; akaunti nyingine zote = 0
  deltaTB('delta-sawa-na-dryRun', 'variance', kabla, baada, tarajio, ROLLBACK_46);
  r = real.data ?? {};
  out.real = r;
  for (const row of (r.rows ?? []).filter((q) => q.error)) console.log(`  KOSA ${row.date} ${row.snapshotUid}: ${row.error}`);
  check('halisi', real.ok && r.errors === 0 && r.done === r.toChange && r.toChange === k.dry.toChange && same(r.cashChange, k.dry.cashChange) && same(r.suspenseAmount, SUSPENSE),
    `done ${r.done}/${r.toChange} (dryRun ${k.dry.toChange}), errors ${r.errors}, 1000 ${money(r.cashChange)} (dryRun ${money(k.dry.cashChange)}), 2900 ${money(r.suspenseAmount)} ${real.ok ? '' : short(real.message)}`);
} else {
  out.real = null;
  console.log('  halisi: yaliingia kabla ya kukatika - hayatumwi tena; delta haiwezi kupimwa (salio za kabla hazikusomwa kabla ya kukatika) -');
  console.log('  ukaguzi unaobaki: dryRun ya pili = 0, 2900, salio za 30/09, mizania, TB na makosa 0.');
}
const again = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=true${q9qs}`, {});
check('dryRun-ya-pili', again.ok && again.data?.toChange === 0, `toChange ${again.data?.toChange} (lazima 0)`);
const pos = await call('GET', `/api/v1/gl/financial-position?asOfDate=${today}`);
check('mizania', pos.ok && pos.data?.isBalanced === true, `mali ${money(pos.data?.totalAssets)} = madeni ${money(pos.data?.totalLiabilities)} + mtaji ${money(pos.data?.totalEquity)}`);
const tb = await call('GET', `/api/v1/gl/trial-balance?startDate=2025-01-01&endDate=${today}`);
check('TB', tb.ok && same(tb.data?.totalDebits, tb.data?.totalCredits), `TB Dr ${money(tb.data?.totalDebits)} Cr ${money(tb.data?.totalCredits)}`);
const cc = await call('GET', `/api/v1/gl/control-checks?asOfDate=${today}`);
out.checks = (cc.data ?? []).map((c) => ({ key: c.key, gl: c.glBalance, sub: c.subLedgerBalance, diff: c.difference, ok: c.reconciled }));
for (const c of out.checks) console.log(`  check ${c.key}: GL ${money(c.gl)} kumbukumbu ${money(c.sub)} tofauti ${money(c.diff)} ${c.ok ? 'sawa' : 'SI SAWA'}`);
const f1 = await call('GET', '/api/v1/gl/posting-failures?open=true');
check('makosa-wazi-baada', f1.ok && f1.data?.openCount === 0, `posting-failures openCount=${f1.data?.openCount}`);
out.salio = {};
for (const [code, d] of [['1000', today], ['1000', '2026-09-30'], ['2900', today], ['6700', today], ['1100', today], ['2000', '2026-09-30']]) out.salio[`${code}@${d}`] = await bal(code, d);
console.log(`  salio: ${Object.entries(out.salio).map(([kk, v]) => `${kk} ${money(v)}`).join('; ')}`);
check('2900', same(out.salio[`2900@${today}`], -SUSPENSE), `2900 = ${money(out.salio[`2900@${today}`])} (lazima Cr ${money(SUSPENSE)})`);
fs.writeFileSync(`analysis/steps/46-${TARGET}-andika.json`, JSON.stringify(out, null, 2));
if (TARGET === 'staging') saveMazoezi('marekebisho-andika', out);
else {
  const m = readMazoezi('marekebisho-andika');
  if (m) {
    if (realPending) { compareRun('halisi-sawa-na-46a', r, A.dry); await compareKata(`halisi-hadi-${KATA}-sawa-na-mazoezi`, r, m.real); }
    // salio za 30/09 hazibadiliki kwa shughuli za 21/10 mchana na 22/10 -> SAWASAWA; za leo zinatofautiana kwa shughuli hizo -> taarifa
    const kali = Object.keys(m.salio).filter((kk) => kk.endsWith('@2026-09-30'));
    const sd = kali.filter((kk) => !same(out.salio[kk], m.salio[kk]));
    check('salio-30/09-sawa-na-mazoezi', sd.length === 0, sd.length ? sd.map((kk) => `${kk} prod ${money(out.salio[kk])} mazoezi ${money(m.salio[kk])}`).join('; ') : `salio ${kali.length} za 30/09 sawa`);
    for (const kk of Object.keys(m.salio).filter((x) => !kali.includes(x))) console.log(`  TAARIFA ${kk}: prod ${money(out.salio[kk])} mazoezi ${money(m.salio[kk])} (shughuli za 21/10 mchana na 22/10 hazikuwa kwenye mazoezi)`);
    for (const c of out.checks) { const z = m.checks.find((q) => q.key === c.key); console.log(`  TAARIFA check ${c.key}: tofauti prod ${money(c.diff)} mazoezi ${money(z?.diff)}`); }
  }
}
if (failed()) console.log('SIMAMA: matokeo hayalingani - USIENDELEE na 43; nitumie log hii.');
else haliAndika('46', { imekamilika: new Date().toISOString() });
finish('marekebisho andika');
