// HATUA 39 (awamu A) na 40 (awamu B): jaribio la Toleo 1 (backend 2.2.71) kwenye STAGING TU, kupitia tunnel localhost:8081.
// INAANDIKA KWENYE STAGING. Production HAIGUSWI. Password inatoka ROOT_PASS (set /p kwenye .cmd) na haiandikwi popote.
// Data inasomwa kutoka analysis\steps\39-toleo1-data.txt (mistari ya 39-toleo1-kabla.sql).
//
//   node 39-toleo1-jaribu.mjs A   -> 1.b sales mpya za deni zina journal; 1.h repost ya sales za H-2; 1.g dryRun (haiandiki GL)
//   node 39-toleo1-jaribu.mjs B   -> 1.g marekebisho halisi + dryRun ya pili = 0; 1.f reopen; vipindi Jan-Sep;
//                                   1.j journal ya mkono kwenye mwezi uliofungwa; 1.i reopen ya reco ya Septemba baada ya kufunga
//   node 39-toleo1-jaribu.mjs C   -> 1.c (hatua 41, constraint ya muda imewekwa na .cmd): sale ya cash -> gl_posting_failure 1
//   node 39-toleo1-jaribu.mjs D   -> 1.c (baada ya .cmd kuondoa constraint): retry -> journal ipo, kosa limetatuliwa
// Kila jaribio linaandika PASS / FAIL / SKIP; mstari wa mwisho ni MUHTASARI.
import fs from 'node:fs';

const API = process.env.API || 'http://localhost:8081';
const PHASE = (process.argv[2] || '').toUpperCase();
if (!['A', 'B', 'C', 'D'].includes(PHASE)) { console.log('Tumia: node 39-toleo1-jaribu.mjs A|B|C|D'); process.exit(1); }

const lines = fs.readFileSync('analysis/steps/39-toleo1-data.txt', 'utf8').split(/\r?\n/);
const rows = (tag) => lines.filter((l) => l.startsWith(tag + '|')).map((l) => l.split('|'));
const d = rows('T1DATA')[0], c = rows('T1CUST')[0];
if (!d || !c) { console.log('DATA_HAIPO: 39-toleo1-data.txt haina T1DATA/T1CUST'); process.exit(1); }
const [, productUid, productName, price, cost, ppp] = d;
const customerUid = c[1];
const unit = Number(price), unitCost = Number(cost);

const results = [];
const check = (id, ok, msg) => { results.push([id, ok]); console.log(`${ok === null ? 'SKIP' : ok ? 'PASS' : 'FAIL'} ${id}: ${msg}`); };
const p2 = (n) => String(n).padStart(2, '0');
const ymd = (t) => `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
const stamp = (t) => `${ymd(t)}T${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
const today = ymd(new Date());
const short = (v) => JSON.stringify(v).slice(0, 300);
const money = (v) => Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// ── login (+ branch ikiwa inahitajika) ──
let r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'root@system.com', password: process.env.ROOT_PASS }) });
if (!r.ok) { console.log('LOGIN_IMESHINDWA', r.status); process.exit(1); }
const login = (await r.json()).data;
let token = login.tokenInfo.token;
const userUid = login.tokenInfo.userId;
if (login.requiresBranchSelection || (!login.selectedBranchUid && (login.branches ?? []).length > 1)) {
  const b = login.branches[0];
  r = await fetch(`${API}/api/auth/select-branch`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branchUid: b.uid ?? b.branchUid }) });
  const sel = (await r.json()).data;
  token = (sel?.tokenInfo ?? sel)?.token ?? token;
}
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await res.text();
  let j; try { j = JSON.parse(t); } catch { j = { status: 'Error', message: t.slice(0, 300) }; }
  return { http: res.status, ok: res.status < 300 && j?.status !== 'Error' && j?.status !== 'Failure', status: j?.status, data: j?.data, message: j?.message, raw: j };
}
async function journalsFor(refUid, start, end) {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const q = await call('GET', `/api/v1/gl/journal-entries?startDate=${start}&endDate=${end}&page=${page}&size=200`);
    const list = q.raw?.data ?? [];
    out.push(...list.filter((e) => e.referenceUid === refUid));
    if (list.length < 200) break;
  }
  return out;
}
async function sale(tag, qty, paidShare, method, when) {
  const total = unit * qty, paid = Math.round(total * paidShare), at = stamp(when ?? new Date());
  const body = {
    saleDate: at, customerUid, customerName: null, customerPhoneNumber: null, userUid, userName: 'QA T1',
    discountAmount: 0, saleNotes: `${tag} | jaribio la Toleo 1 (staging)`,
    saleDetails: [{ productUid, productName, productCategory: null, saleType: 'PIECES', pieceQuantity: qty, packageQuantity: qty,
      unitPrice: unit, subTotal: total, overrideUnitPrice: null, costPerPiece: unitCost, piecesPerPackage: Number(ppp) || null, packageAbbreviation: null }],
    payments: [{ customerUid, customerName: 'QA-T1', paymentMethod: method, totalAmount: total, amountPaid: paid, paymentDate: at,
      paymentNotes: paid < total ? `QA-T1 deni ${total - paid}` : null }],
  };
  const q = await call('POST', '/api/v1/sales/partial', body);
  return { ...q, sale: q.data?.sale, total, paid };
}
const lineSum = (e, code, side) => (e?.lines ?? []).filter((l) => l.accountCode === code).reduce((s, l) => s + Number(side === 'dr' ? l.debitAmount : l.creditAmount), 0);

const status = await call('GET', '/api/v1/gl/status');
console.log(`GL: posting=${status.data?.postingEnabled} shadow=${status.data?.shadowMode} journals=${status.data?.totalEntriesPosted}`);

if (PHASE === 'A') {
  // ── 1.a: endpoint mpya ipo, makosa wazi 0 ──
  const f0 = await call('GET', '/api/v1/gl/posting-failures?open=true');
  check('1.a', f0.ok && f0.data?.openCount === 0, `posting-failures openCount=${f0.data?.openCount} (${f0.http})`);

  // ── 1.b: sales mpya za deni (nusu imelipwa; hakuna kilicholipwa) zina journal yenye AR ──
  for (const [tag, share, want] of [['QA-T1 B', 0.5, 'SALE_MIXED'], ['QA-T1 C', 0, 'SALE_CREDIT']]) {
    const s = await sale(tag, 2, share, 'CASH');
    if (!s.ok || !s.sale) { check('1.b', false, `${tag}: sale imeshindwa ${s.http} ${short(s.message)}`); continue; }
    const owed = s.total - s.paid;
    // ── 1.b-jibu (hatua 36, 20/10): jibu la POST /sales/partial lisomwe kutoka DB baada ya sync, si entity ya kumbukumbu
    //    (2.2.70 ilijibu deni=0 hali=PAID kwa sales za deni). POS/risiti ya V3 haitumii sehemu hizi, lakini jibu lazima liwe kweli.
    const wantStatus = owed <= 0 ? 'PAID' : s.paid > 0 ? 'PARTIAL' : 'UNPAID';
    check('1.b-jibu', Math.abs(Number(s.sale.outstandingBalance ?? -1) - owed) < 0.01 && s.sale.paymentStatus === wantStatus,
      `${tag} ${s.sale.receiptNumber}: jibu deni=${money(s.sale.outstandingBalance)} hali=${s.sale.paymentStatus} (lazima deni=${money(owed)} hali=${wantStatus})`);
    await sleep(2500);
    const js = await journalsFor(s.sale.uid, today, today);
    const e = js.find((x) => !x.isReversal);
    check('1.b', !!e && e.referenceType === want && Math.abs(lineSum(e, '1100', 'dr') + lineSum(e, '1110', 'dr') - owed) < 0.01
        && Math.abs(Number(e.totalDebit) - Number(e.totalCredit)) < 0.01,
      `${tag} ${s.sale.receiptNumber}: jumla ${money(s.total)} deni ${money(owed)} -> ${e ? `${e.referenceType} AR=${money(lineSum(e, '1100', 'dr') + lineSum(e, '1110', 'dr'))} Dr=${money(e.totalDebit)} Cr=${money(e.totalCredit)}` : 'HAKUNA JOURNAL'}`);
  }

  // ── 1.h: sales za H-2 (tangu GL live, bila journal) zinapostiwa kutoka DB, kwa deni la siku ya mauzo ──
  const h2 = rows('H2SALE');
  if (!h2.length) check('1.h', null, 'hakuna sale ya H-2 bila journal kwenye data hii');
  for (const [, uid, receipt, total, owed] of h2) {
    const q = await call('POST', `/api/v1/gl/corrections/repost-sale/${uid}`, {});
    check('1.h', q.ok && q.data === true, `${receipt} jumla ${money(total)} deni la sasa ${money(owed)} -> ${q.ok ? q.message : `IMESHINDWA ${short(q.message)}`}`);
  }
  // ── 1.h-mara-ya-pili (ukaguzi 19/10, idempotency): repost ya sale ileile tena -> "Tayari imepostiwa", journal 1 tu ──
  if (h2.length) {
    const [, uid, receipt] = h2[0];
    const q = await call('POST', `/api/v1/gl/corrections/repost-sale/${uid}`, {});
    const day = `20${receipt.slice(4, 6)}-${receipt.slice(2, 4)}-${receipt.slice(0, 2)}`; // risiti ddmmyy-....
    const js = (await journalsFor(uid, day, today)).filter((e) => !e.isReversal && String(e.referenceType).startsWith('SALE_'));
    check('1.h-mara-ya-pili', q.ok && /Tayari imepostiwa/.test(q.message ?? '') && js.length === 1,
      `${receipt}: ${q.ok ? q.message : short(q.message)}; journal za SALE_* zisizo reversal: ${js.length} (lazima 1)`);
  }

  // ── 1.g (sehemu ya 1): dryRun ya marekebisho ya variance - HAIANDIKI ──
  const dr = await call('POST', '/api/v1/gl/corrections/day-close-variance?dryRun=true', {});
  if (!dr.ok) {
    check('1.g-dryRun', false, `IMESHINDWA ${dr.http} ${short(dr.message)}`);
  } else {
    const x = dr.data;
    fs.writeFileSync('analysis/steps/39-dryrun.json', JSON.stringify(x, null, 2));
    console.log(`dryRun: mistari ${x.journals}, zitabadilika ${x.toChange}, 1000 kabla ${money(x.cashBefore)} baada ${money(x.cashAfter)} mabadiliko ${money(x.cashChange)}`);
    for (const [g, v] of Object.entries(x.groups ?? {})) console.log(`  kundi ${g}: idadi ${v[0]}, variance ${money(v[1])}`);
    const byAction = {};
    for (const row of x.rows ?? []) byAction[row.action] = (byAction[row.action] ?? 0) + 1;
    console.log(`  hatua: ${short(byAction)}`);
    for (const row of (x.rows ?? []).filter((q) => Math.abs(Number(q.variance)) >= 10000 || Number(q.overDeducted) > 0)) {
      console.log(`  ${row.date} ${row.group} ${row.action} variance ${money(row.variance)} declared ${money(row.declared)} 1000: ${money(row.cashBefore)} -> ${money(row.cashAfter)}${Number(row.overDeducted) > 0 ? ` (makato yaliyozidi ${money(row.overDeducted)})` : ''}`);
    }
    check('1.g-dryRun', x.dryRun === true && x.toChange >= 87 && x.errors === 0, `toChange ${x.toChange} (>= 87 kwa dump ya 15/10), errors ${x.errors}; orodha kamili: analysis\\steps\\39-dryrun.json`);

    // ── 1.g-Q9: dryRun ya PROD (K2 za 24/06 na 04/07 -> 2900). HAIANDIKI; staging inabaki na kanuni ya 6700 kwenye awamu B ──
    const q9 = rows('Q9SNAP');
    if (q9.length !== 2) {
      check('1.g-Q9', false, `Q9SNAP: snapshot ${q9.length} (lazima 2: 24/06 na 04/07)`);
    } else {
      const qs = q9.map(([, uid]) => `&suspenseSnapshotUid=${uid}`).join('');
      const ds = await call('POST', `/api/v1/gl/corrections/day-close-variance?dryRun=true${qs}`, {});
      if (!ds.ok) {
        check('1.g-Q9', false, `IMESHINDWA ${ds.http} ${short(ds.message)}`);
      } else {
        const y = ds.data;
        fs.writeFileSync('analysis/steps/39-dryrun-q9.json', JSON.stringify(y, null, 2));
        const k2 = (o) => (o.rows ?? []).filter((q) => q.group === 'SURPLUS' && q.cashAfter > 0);
        const sum = (list, acct) => list.filter((q) => q.counterAfter === acct).reduce((s, q) => s + Number(q.cashAfter), 0);
        console.log('TOFAUTI Q9 (kanuni ya staging dhidi ya PROD) - 1000 haibadiliki, ni upande wa credit tu:');
        for (const [, uid, date, variance, declared] of q9) {
          const a = (x.rows ?? []).find((q) => q.snapshotUid === uid), b = (y.rows ?? []).find((q) => q.snapshotUid === uid);
          console.log(`  ${date} variance ${money(variance)} declared ${money(declared)}: staging Dr 1000 / Cr ${a?.counterAfter} ${money(a?.cashAfter)}  |  PROD Dr 1000 / Cr ${b?.counterAfter} ${money(b?.cashAfter)}`);
        }
        console.log(`  K2 kwenda 6700: staging ${money(sum(k2(x), '6700'))}  |  PROD ${money(sum(k2(y), '6700'))}`);
        console.log(`  K2 kwenda 2900: staging ${money(sum(k2(x), '2900'))}  |  PROD ${money(sum(k2(y), '2900'))} (suspenseAmount ${money(y.suspenseAmount)})`);
        console.log(`  1000 mabadiliko: staging ${money(x.cashChange)}  |  PROD ${money(y.cashChange)}; zitabadilika ${x.toChange} | ${y.toChange}`);
        check('1.g-Q9', y.errors === 0 && (y.suspenseNotApplicable ?? []).length === 0
            && Math.abs(Number(y.cashChange) - Number(x.cashChange)) < 0.01 && Math.abs(Number(y.suspenseAmount) - 742500) < 0.01,
          `2900 = ${money(y.suspenseAmount)} (lazima 742,500 = 210,500 + 532,000); 1000 sawa na staging; hazitumiki: ${short(y.suspenseNotApplicable)}; orodha: analysis\\steps\\39-dryrun-q9.json`);
      }
    }
  }
}

if (PHASE === 'B') {
  // ── 1.g: marekebisho halisi, kisha dryRun ya pili lazima iwe 0 ──
  const real = await call('POST', '/api/v1/gl/corrections/day-close-variance?dryRun=false', {});
  check('1.g-halisi', real.ok && real.data?.errors === 0 && real.data?.done === real.data?.toChange,
    `done ${real.data?.done} / ${real.data?.toChange}, errors ${real.data?.errors}, 1000 mabadiliko ${money(real.data?.cashChange)} ${real.ok ? '' : short(real.message)}`);
  for (const row of (real.data?.rows ?? []).filter((q) => q.error)) console.log(`  KOSA ${row.date} ${row.snapshotUid}: ${row.error}`);
  fs.writeFileSync('analysis/steps/40-marekebisho-halisi.json', JSON.stringify(real, null, 2));
  console.log('  matokeo kamili: analysis\\steps\\40-marekebisho-halisi.json');
  const again = await call('POST', '/api/v1/gl/corrections/day-close-variance?dryRun=true', {});
  fs.writeFileSync('analysis/steps/40-dryrun-ya-pili.json', JSON.stringify(again, null, 2));
  check('1.g-mara-ya-pili', again.ok && again.data?.toChange === 0, `dryRun ya pili: toChange ${again.data?.toChange} (lazima 0)`);
  const pos = await call('GET', `/api/v1/gl/financial-position?asOfDate=${today}`);
  check('1.g-mizania', pos.ok && pos.data?.isBalanced === true, `mali ${money(pos.data?.totalAssets)} = madeni ${money(pos.data?.totalLiabilities)} + mtaji ${money(pos.data?.totalEquity)}`);
  const tb = await call('GET', `/api/v1/gl/trial-balance?startDate=2026-01-01&endDate=${today}`);
  check('1.g-TB', tb.ok && Math.abs(Number(tb.data?.totalDebits) - Number(tb.data?.totalCredits)) < 0.01, `TB Dr ${money(tb.data?.totalDebits)} Cr ${money(tb.data?.totalCredits)}`);
  const cc = await call('GET', `/api/v1/gl/control-checks?asOfDate=${today}`);
  for (const k of cc.data ?? []) console.log(`  check ${k.key}: GL ${money(k.glBalance)} kumbukumbu ${money(k.subLedgerBalance)} tofauti ${money(k.difference)} ${k.reconciled ? 'sawa' : 'SI SAWA'}`);

  // ── 1.f: reopen ya reco iliyoidhinishwa inageuza journal ya variance (ukaguzi kwenye 40-toleo1-baada.sql) ──
  const rc = rows('RECON')[0];
  if (!rc) check('1.f', null, 'hakuna reco iliyoidhinishwa yenye variance na journal hai');
  else {
    const q = await call('POST', `/api/v1/reconciliation/${rc[1]}/reopen?reason=${encodeURIComponent('QA Toleo 1: jaribio la reopen kwenye staging')}`);
    check('1.f', q.ok, `reco ${rc[2]} (snapshot ${rc[3]}, variance ${money(rc[4])}) reopen -> ${q.ok ? 'sawa' : short(q.message)}; reversal inakaguliwa na SQL ya baada`);
    // ── 1.f-correct (ukaguzi 19/10): reopen -> marekebisho HALISI -> hakuna journal mpya ya snapshot hiyo ──
    const rr = await call('POST', '/api/v1/gl/corrections/day-close-variance?dryRun=false', {});
    fs.writeFileSync('analysis/steps/40-marekebisho-baada-ya-reopen.json', JSON.stringify(rr, null, 2));
    const mine = (rr.data?.rows ?? []).filter((x) => x.snapshotUid === rc[3]);
    const live = (await journalsFor(rc[3], rc[2], today)).filter((e) => e.referenceType === 'DAY_CLOSE_VARIANCE');
    const net = live.reduce((a, e) => a + (e.isReversal ? -1 : 1), 0);
    check('1.f-correct', rr.ok && rr.data?.errors === 0 && mine.every((x) => x.action !== 'POST_MISSING' && x.action !== 'REVERSE_AND_REPOST') && net === 0,
      `rows za snapshot ${rc[3]}: ${mine.map((x) => `${x.group}/${x.action}`).join(',') || 'hakuna'}; journal hai (asili - reversal) = ${net} (lazima 0); toChange ${rr.data?.toChange}`);
  }

  // ── M-7 (19/10, njia B: journals 2 za mkono, bila code mpya), KABLA ya kufunga Septemba ──
  // Malipo 7 ya wasambazaji ya 04/10 (6,751,443.39) yalikuwa kufuta madeni ya Feb–Jul yaliyolipwa benki zamani.
  // (1) 04/10: Dr 1000 / Cr 2000 (inafuta athari ya 04/10); (2) 30/09: Dr 2000 / Cr 1000. Journals 7 za asili zinabaki.
  // Ukaguzi kwa tofauti (si namba kamili): marekebisho ya 1.g yamebadilisha 1000 tayari.
  // Kipande hiki kinatumiwa pia na hatua ya prod (43-m7-prod.mjs), inayokikata kutoka faili hili: kibadilishe hapa tu.
  const m7 = rows('M7J');
  const m7Sum = Math.round(m7.reduce((t, x) => t + Number(x[3]), 0) * 100) / 100;
  const m7Out = typeof M7_OUT === 'string' ? M7_OUT : 'analysis/steps/40-m7-journals.json';
  const m7Write = typeof M7_WRITE === 'boolean' ? M7_WRITE : true;
  if (m7.length !== 7 || Math.abs(m7Sum - 6751443.39) > 0.005) {
    check('M-7', false, `M7J: journals ${m7.length}, jumla ${money(m7Sum)} (lazima 7 na 6,751,443.39); hakuna kilichoandikwa`);
  } else {
    const bal = async (code, end) => {
      const t = await call('GET', `/api/v1/gl/trial-balance?startDate=2025-01-01&endDate=${end}`);
      const l = (t.data?.lines ?? []).find((x) => x.accountCode === code);
      return l ? Number(l.debitBalance ?? 0) - Number(l.creditBalance ?? 0) : 0;
    };
    const nums = m7.map((x) => x[2]).join(', ');
    // Kinga ya kuendesha mara mbili: journal ya mkono yenye memo "M-7:" tarehe 04/10 au 30/09 ikiwepo, hakuna kinachoandikwa.
    const done = [];
    for (const d of ['2026-10-04', '2026-09-30']) {
      const q = await call('GET', `/api/v1/gl/journal-entries?startDate=${d}&endDate=${d}&referenceType=MANUAL_ADJUSTMENT&page=0&size=200`);
      done.push(...(q.raw?.data ?? []).filter((e) => !e.isReversal && String(e.referenceNumber ?? '').startsWith('M-7:')));
    }
    // Septemba lazima iwe wazi: journal ya mkono kwenye mwezi uliofungwa inakataliwa.
    const per = await call('GET', '/api/v1/gl/periods');
    const sep = (per.data ?? []).find((x) => x.year === 2026 && x.month === 9);
    const sepOpen = !sep || sep.status === 'OPEN';
    const before = { c30: await bal('1000', '2026-09-30'), a30: await bal('2000', '2026-09-30'), cT: await bal('1000', today), aT: await bal('2000', today) };
    console.log(`  M-7 kabla: 30/09 1000 ${money(before.c30)}, 2000 ${money(before.a30)}; ${today} 1000 ${money(before.cT)}, 2000 ${money(before.aT)}; Septemba ${sep ? sep.status : 'OPEN (hakuna safu)'}; entry numbers: ${nums}`);
    if (done.length) {
      check('M-7', false, `M-7 imeshaandikwa (${done.map((e) => `${e.entryDate} ${e.entryNumber}`).join(', ')}); hakuna kilichoandikwa tena`);
    } else if (!sepOpen) {
      check('M-7', false, `Septemba ni ${sep.status}; M-7 lazima iandikwe KABLA ya kufunga. Hakuna kilichoandikwa`);
    } else if (!m7Write) {
      check('M-7-kagua', true, `tayari kuandika: journals 7, jumla ${money(m7Sum)}; 30/09 1000 itakuwa ${money(before.c30 - m7Sum)}, 2000 itakuwa ${money(before.a30 + m7Sum)}`);
    } else {
      const j1 = await call('POST', '/api/v1/gl/journal-entries/manual', {
        entryDate: '2026-10-04', memo: 'M-7: kufuta malipo 7 ya 04/10 (madeni ya Feb–Jul yalilipwa benki zamani)',
        lines: [{ accountCode: '1000', debit: m7Sum, credit: 0, description: `Kufuta malipo 7 ya wasambazaji ya 04/10 (${nums}); yalikuwa malipo ya zamani ya Feb–Jul kutoka benki` },
                { accountCode: '2000', debit: 0, credit: m7Sum, description: `Kufuta malipo 7 ya wasambazaji ya 04/10 (${nums})` }] });
      const j2 = j1.ok ? await call('POST', '/api/v1/gl/journal-entries/manual', {
        entryDate: '2026-09-30', memo: 'M-7: malipo ya Feb–Jul kutoka benki (yalirekodiwa 04/10)',
        lines: [{ accountCode: '2000', debit: m7Sum, credit: 0, description: `Malipo ya Feb–Jul kutoka benki; yalirekodiwa 04/10 (${nums})` },
                { accountCode: '1000', debit: 0, credit: m7Sum, description: 'Malipo ya Feb–Jul kutoka benki; Cr 1000 kwa sababu benki haikufuatiliwa kabla ya D' }] }) : { ok: false, message: 'journal ya kwanza imeshindwa' };
      const after = { c30: await bal('1000', '2026-09-30'), a30: await bal('2000', '2026-09-30'), cT: await bal('1000', today), aT: await bal('2000', today) };
      fs.writeFileSync(m7Out, JSON.stringify({ m7, m7Sum, j1, j2, before, after }, null, 2));
      check('M-7-journals', j1.ok && j2.ok, `04/10 ${j1.ok ? j1.data : short(j1.message)}; 30/09 ${j2.ok ? j2.data : short(j2.message)}`);
      check('M-7-30/09', Math.abs(after.c30 - before.c30 + m7Sum) < 0.01 && Math.abs(after.a30) < 0.01,
        `1000: ${money(before.c30)} -> ${money(after.c30)} (lazima -${money(m7Sum)}); 2000: ${money(before.a30)} -> ${money(after.a30)} (lazima 0)`);
      check('M-7-leo', Math.abs(after.cT - before.cT) < 0.01 && Math.abs(after.aT - before.aT) < 0.01,
        `${today}: 1000 ${money(before.cT)} -> ${money(after.cT)}, 2000 ${money(before.aT)} -> ${money(after.aT)} (lazima visibadilike); matokeo: ${m7Out}`);
    }
  }

  // ── Vipindi: funga Jan-Sep 2026 ──
  let closedAll = true;
  for (let m = 1; m <= 9; m++) {
    const q = await call('POST', `/api/v1/gl/periods/2026/${m}/close`, { reason: 'QA Toleo 1 staging: baada ya marekebisho' });
    if (!q.ok) { closedAll = false; console.log(`  kufunga 2026-${p2(m)}: ${short(q.message)}`); }
  }
  const per = await call('GET', '/api/v1/gl/periods');
  const closed = (per.data ?? []).filter((p) => p.year === 2026 && p.month <= 9 && p.status === 'CLOSED').length;
  check('1.9-funga', closedAll && closed === 9, `miezi iliyofungwa Jan-Sep: ${closed}/9`);

  // ── 1.j: journal ya mkono ya 20/09 inakataliwa; reopen -> inapita; funga tena; audit ──
  const manual = (memo, drCode, crCode) => call('POST', '/api/v1/gl/journal-entries/manual', {
    entryDate: '2026-09-20', memo, lines: [{ accountCode: drCode, debit: 1, credit: 0, description: memo }, { accountCode: crCode, debit: 0, credit: 1, description: memo }] });
  const refused = await manual('QA-T1 J: inapaswa kukataliwa', '1010', '1000');
  check('1.j-kataa', !refused.ok && /imefungwa|closed/i.test(refused.message ?? ''), `ikiwa Sep imefungwa: ${refused.ok ? 'IMEPITA (kosa)' : short(refused.message)}`);
  const re = await call('POST', '/api/v1/gl/periods/2026/9/reopen', { reason: 'QA Toleo 1: jaribio la kufungua upya Septemba' });
  const passed = await manual('QA-T1 J: baada ya kufungua upya', '1010', '1000');
  const undo = await manual('QA-T1 J: kurudisha shilingi 1', '1000', '1010');
  const reclose = await call('POST', '/api/v1/gl/periods/2026/9/close', { reason: 'QA Toleo 1: kufunga tena' });
  check('1.j-reopen', re.ok && passed.ok && undo.ok && reclose.ok, `reopen ${re.ok}, journal ${passed.ok ? passed.data : short(passed.message)}, kurudisha ${undo.ok}, kufunga tena ${reclose.ok}`);
  const audit = await call('GET', '/api/v1/gl/periods/audit?year=2026&month=9');
  const acts = (audit.data ?? []).map((a) => a.action).reverse();
  check('1.j-audit', acts.join(',') === 'CLOSE,REOPEN,CLOSE', `audit ya 2026-09: ${acts.join(',')} (lazima CLOSE,REOPEN,CLOSE)`);

  // ── 1.i: tukio la mfumo kwenye mwezi uliofungwa: reopen ya reco ya Septemba -> reversal ya variance yake
  //         inaandikwa 01/10 (siku ya kwanza iliyo wazi), tarehe ya tukio = tarehe ya reco, alama "imechelewa".
  //         (Sale ya tarehe ya nyuma haitumiki: kinga ya counting inazuia mauzo ya kabla ya kuhesabu - kanuni sahihi.)
  const rs = rows('RECONSEP')[0];
  if (!rs) check('1.i', null, 'hakuna reco ya Septemba iliyoidhinishwa yenye journal hai');
  else {
    const q = await call('POST', `/api/v1/reconciliation/${rs[1]}/reopen?reason=${encodeURIComponent('QA Toleo 1: reopen ya Septemba baada ya kufunga')}`);
    const day1 = '2026-10-01'; // Jan-Sep zimefungwa hapo juu, Oktoba iko wazi
    const js = await journalsFor(rs[3], day1, day1);
    const rev = js.find((x) => x.isReversal);
    check('1.i', q.ok && !!rev && rev.isLateEntry === true && rev.eventDate === rs[2] && rev.entryDate === day1,
      `reco ${rs[2]} reopen ${q.ok ? 'sawa' : short(q.message)} -> ${rev ? `reversal entry ${rev.entryDate} tukio ${rev.eventDate} late ${rev.isLateEntry}` : `HAKUNA REVERSAL TAREHE ${day1}`}`);
  }
  const f1 = await call('GET', '/api/v1/gl/posting-failures?open=true');
  check('makosa-wazi', f1.ok && f1.data?.openCount === 0, `posting-failures openCount=${f1.data?.openCount}`);
}

if (PHASE === 'C') {
  const s = await sale('QA-T1 K', 1, 1, 'CASH');
  if (!s.ok || !s.sale) check('1.c-kosa', false, `sale imeshindwa ${s.http} ${short(s.message)}`);
  else {
    fs.writeFileSync('analysis/steps/41-risiti.txt', s.sale.receiptNumber);
    await sleep(2500);
    const f = await call('GET', '/api/v1/gl/posting-failures?open=true');
    const mine = (f.data?.items ?? []).filter((x) => x.sourceType === 'SALE' && x.sourceNumber === s.sale.receiptNumber);
    const js = await journalsFor(s.sale.uid, today, today);
    check('1.c-kosa', s.ok && mine.length === 1 && js.length === 0,
      `sale ${s.sale.receiptNumber} imehifadhiwa (HTTP ${s.http}); journal ${js.length}; gl_posting_failure ${mine.length}: ${short(mine[0]?.error ?? '')}`);
  }
}

if (PHASE === 'D') {
  const receipt = fs.readFileSync('analysis/steps/41-risiti.txt', 'utf8').trim();
  const f = await call('GET', '/api/v1/gl/posting-failures?open=true');
  const mine = (f.data?.items ?? []).find((x) => x.sourceType === 'SALE' && x.sourceNumber === receipt);
  if (!mine) check('1.c-retry', false, `hakuna kosa wazi la ${receipt}`);
  else {
    const q = await call('POST', `/api/v1/gl/posting-failures/${mine.uid}/retry`, {});
    const js = await journalsFor(mine.sourceUid, today, today);
    check('1.c-retry', q.ok && q.data?.resolvedAt && js.some((e) => !e.isReversal && e.referenceType === 'SALE_CASH'),
      `retry ${q.ok ? 'sawa' : short(q.message)}; majaribio ${q.data?.attempts}; journal ${js.map((e) => e.referenceType).join(',') || 'HAKUNA'}`);
  }
  // ── 1.c-mara-ya-pili (ukaguzi 19/10): repost tena baada ya retry -> ALREADY_POSTED, journal 1 tu ──
  if (mine) {
    const q2 = await call('POST', `/api/v1/gl/corrections/repost-sale/${mine.sourceUid}`, {});
    const js2 = (await journalsFor(mine.sourceUid, today, today)).filter((e) => !e.isReversal && e.referenceType === 'SALE_CASH');
    check('1.c-mara-ya-pili', q2.ok && /Tayari imepostiwa/.test(q2.message ?? '') && js2.length === 1,
      `${receipt}: ${q2.ok ? q2.message : short(q2.message)}; SALE_CASH ${js2.length} (lazima 1)`);
  }
  const after = await call('GET', '/api/v1/gl/posting-failures?open=true');
  check('makosa-wazi', after.ok && after.data?.openCount === 0, `posting-failures openCount=${after.data?.openCount}`);
}

const fails = results.filter(([, ok]) => ok === false).length, skips = results.filter(([, ok]) => ok === null).length;
console.log(`MUHTASARI awamu ${PHASE}: PASS ${results.length - fails - skips}, FAIL ${fails}, SKIP ${skips}`);
process.exit(fails ? 1 : 0);
