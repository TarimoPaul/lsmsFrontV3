// HATUA 46 (MPANGO §1.8 "marekebisho"): H-2 (repost ya sales zisizo na journal) + H-1 (marekebisho ya DAY_CLOSE_VARIANCE),
// suspense ya Q9 (snapshots 2: 24/06 na 04/07 -> 2900). Kwa akaunti ya CEO (mmiliki), si root.
//   TARGET=staging node 46-marekebisho.mjs kagua|andika  -> mazoezi (45c): namba zinahifadhiwa 45-mazoezi\marekebisho-*.json
//   TARGET=prod    node 46-marekebisho.mjs kagua         -> HAIANDIKI: dryRun ya prod = ya mazoezi, mstari kwa mstari
//   TARGET=prod    node 46-marekebisho.mjs andika        -> kagua tena (lazima ilingane), kisha H-2 + marekebisho halisi + ukaguzi
// Data (uids za H-2 na Q9) inatoka 45-mazoezi\data.txt: SQL kwenye staging iliyorejeshwa kutoka dump ya usiku huu (45b),
// kwa hiyo hakuna query kwenye DB ya prod (kanuni ya 15/10).
import fs from 'node:fs';
import { TARGET, check, failed, today, short, money, same, login, call, pages, bal, saveMazoezi, readMazoezi, dataRows, finish, haliSoma, haliAndika, dakikaTangu } from './45-lib.mjs';

const MODE = (process.argv[2] || '').toLowerCase();
if (!['kagua', 'andika'].includes(MODE)) { console.log('Tumia: node 46-marekebisho.mjs kagua|andika'); process.exit(1); }
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const HALI = haliSoma('46');   // prod: andika ilishaanza leo (kurudia baada ya kukatika)

// Namba za staging ya 20/10 (hatua 39/40) - kinga ya ziada juu ya ulinganisho na mazoezi ya usiku huu.
const Q9_UIDS = ['6c9e781d-4e31-4696-9247-9f23c2da4b07', '850ff8e2-7393-4af1-b830-48a9a8c06d10']; // 24/06, 04/07
const SUSPENSE = 742500;            // 210,500 + 532,000
const H2_JUZI = ['101026-2202', '121026-2249', '131026-2227'];
const TOCHANGE_MIN = 95;            // dryRun ya staging 20/10 (dump ya 20/10 02:00)

const saleDay = (receipt) => `20${receipt.slice(4, 6)}-${receipt.slice(2, 4)}-${receipt.slice(0, 2)}`; // risiti ddmmyy-....
async function liveSaleJournals(uid, receipt) {
  return (await pages(`/api/v1/gl/journal-entries?startDate=${saleDay(receipt)}&endDate=${today}`))
    .filter((e) => e.referenceUid === uid && !e.isReversal && String(e.referenceType).startsWith('SALE_'));
}
const rowKey = (r) => `${r.snapshotUid}|${r.journalUid ?? '-'}`;
const rowSig = (r) => `${r.group}/${r.action}/${Number(r.cashBefore).toFixed(2)}/${Number(r.cashAfter).toFixed(2)}/${r.counterAfter ?? '-'}`;
// Namba za jumla za matokeo ya marekebisho (dryRun au halisi) ziwe sawa na za mazoezi; na kila mstari uwe sawa.
function compareRun(id, x, m) {
  const keys = ['journals', 'toChange', 'errors', 'cashBefore', 'cashAfter', 'cashChange', 'suspenseAmount'];
  const diff = keys.filter((k) => !same(x[k], m[k]));
  const mine = new Map((x.rows ?? []).map((r) => [rowKey(r), rowSig(r)]));
  const theirs = new Map((m.rows ?? []).map((r) => [rowKey(r), rowSig(r)]));
  const rowDiff = [...new Set([...mine.keys(), ...theirs.keys()])].filter((k) => mine.get(k) !== theirs.get(k));
  for (const k of rowDiff.slice(0, 15)) console.log(`  TOFAUTI ${k}: ${TARGET} ${mine.get(k) ?? 'HAIPO'} | mazoezi ${theirs.get(k) ?? 'HAIPO'}`);
  check(id, diff.length === 0 && rowDiff.length === 0,
    `${diff.length ? `namba tofauti: ${diff.map((k) => `${k} ${money(x[k])} vs ${money(m[k])}`).join('; ')}; ` : ''}mistari ${mine.size} (mazoezi ${theirs.size}), tofauti ${rowDiff.length}`);
}
const groupsTxt = (x) => Object.entries(x.groups ?? {}).map(([g, v]) => `${g} ${v[0]}/${money(v[1])}`).join(', ');
const q9qs = Q9_UIDS.map((u) => `&suspenseSnapshotUid=${u}`).join('');

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
  } else if (m && t === m.dry.toChange) {
    check('halisi-haijaingia', age >= 10, HALI.real_at ? `ombi la halisi lilitumwa dakika ${age.toFixed(1)} zilizopita na halijaingia - ${age >= 10 ? 'litatumwa tena' : 'SUBIRI hadi dakika 10 zipite, kisha endesha 46b tena'}` : 'halisi bado haijatumwa');
    compareRun('dryRun-sawa-na-mazoezi', out.dry, m.dry);
  } else {
    check('halisi-nusu', false, `dryRun toChange ${t} (mazoezi ${m?.dry?.toChange}) - huenda halisi bado inaendelea kwenye server: SUBIRI dakika 5 na uendeshe 46b tena; ikibaki hivyo SIMAMA na uniambie`);
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
      if (k.dry) compareRun('dryRun-sawa-na-mazoezi', k.dry, m.dry);
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
  const ar = (e?.lines ?? []).filter((l) => ['1100', '1110'].includes(l.accountCode)).reduce((s, l) => s + Number(l.debitAmount), 0);
  out.h2.push({ receipt: h.receipt, ok: q.ok, message: q.message, journals: js.length, type: e?.referenceType, ar, dr: e?.totalDebit, cr: e?.totalCredit });
  check('H-2-repost', q.ok && q.data === true && js.length === 1 && same(e.totalDebit, e.totalCredit),
    `${h.receipt}: ${q.ok ? q.message : short(q.message)} -> ${e ? `${e.referenceType} AR ${money(ar)} Dr ${money(e.totalDebit)} Cr ${money(e.totalCredit)}` : 'HAKUNA JOURNAL'}`);
}
let r = {};
if (realPending) {
  haliAndika('46', { real_at: new Date().toISOString() });
  const real = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=false${q9qs}`, {});
  r = real.data ?? {};
  out.real = r;
  for (const row of (r.rows ?? []).filter((q) => q.error)) console.log(`  KOSA ${row.date} ${row.snapshotUid}: ${row.error}`);
  check('halisi', real.ok && r.errors === 0 && r.done === r.toChange && r.toChange === k.dry.toChange && same(r.cashChange, k.dry.cashChange) && same(r.suspenseAmount, SUSPENSE),
    `done ${r.done}/${r.toChange} (dryRun ${k.dry.toChange}), errors ${r.errors}, 1000 ${money(r.cashChange)} (dryRun ${money(k.dry.cashChange)}), 2900 ${money(r.suspenseAmount)} ${real.ok ? '' : short(real.message)}`);
} else {
  out.real = null;
  console.log('  halisi: yaliingia kabla ya kukatika - hayatumwi tena; ukaguzi wa mwisho unalinganisha salio na checks na mazoezi');
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
    if (realPending) compareRun('halisi-sawa-na-mazoezi', r, m.real);
    const sd = Object.keys(m.salio).filter((kk) => !same(out.salio[kk], m.salio[kk]));
    check('salio-sawa-na-mazoezi', sd.length === 0, sd.length ? sd.map((kk) => `${kk} prod ${money(out.salio[kk])} mazoezi ${money(m.salio[kk])}`).join('; ') : 'salio zote 6 sawa');
    const cd = out.checks.filter((c) => { const z = m.checks.find((q) => q.key === c.key); return !z || !same(z.diff, c.diff); });
    check('checks-sawa-na-mazoezi', cd.length === 0, cd.length ? cd.map((c) => c.key).join(', ') : `checks ${out.checks.length} sawa`);
  }
}
if (failed()) console.log('SIMAMA: matokeo hayalingani - USIENDELEE na 43; nitumie log hii.');
else haliAndika('46', { imekamilika: new Date().toISOString() });
finish('marekebisho andika');
