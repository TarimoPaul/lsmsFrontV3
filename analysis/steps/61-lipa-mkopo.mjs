// HATUA 61 - MALIPO YA AWAMU 1 YA MKOPO A (04/11/2026, 386,000 CASH) KWENYE PROD 2.3.0 (mmiliki 31/10 bh, u).
// API TU (kanuni ya 15/10: hakuna query ya DB ya prod). Akaunti ya CEO yenye FINANCE_WRITE (45-lib inakataa root).
//   TARGET=prod PROD_API=... CEO_EMAIL=... CEO_PASS=... node analysis/steps/61-lipa-mkopo.mjs kagua|lipa
// Endpoint ya prod (2.3.0): POST /api/v1/capital-monitoring/loans/{uid}/repay
//   mwili { amount, principal_amount (= amount), interest_amount 0, payment_method CASH, transaction_date, notes }
//   -> LoanService.repay: Dr 2100 / Cr 1000 (bank_cutover_date haijawekwa - hatua 60 haijaendeshwa), FIFO kwenye awamu.
//   Haina dryRun, wala kinga ya kurudia: hatua hii ndiyo kinga (repaid lazima 0 kabla ya POST; hali ya kuandika).
// kagua (HAIANDIKI): A ACTIVE, deni 1,158,000, repaid 0, awamu 1 = 04/11 386,000 haijalipwa, hakuna LOAN_REPAYMENT ya A.
//   Inahifadhi analysis/steps/61-lipa-kagua.json -> ---SIMAMA-PREVIEW--- (mmiliki analeta log kwa Claude).
// lipa: leo >= 04/11; kagua ya LEO ipo na hali bado ni ileile -> POST moja -> ukaguzi: deni 772,000, repaid 386,000,
//   awamu 1 PAID (386,000), awamu 2-3 hazijaguswa, journal LOAN_REPAYMENT ya 04/11 = Dr 2100 386,000 / Cr 1000 386,000,
//   2100 delta +386,000, TB = 0. Ikirudiwa baada ya kukatika: malipo yaliyokwisha andikwa yanaonekana (repaid 386,000)
//   na POST HAIRUDIWI - inakaguliwa tu.
import fs from 'node:fs';
import { API, TARGET, check, failed, login, call, pages, bal, tbAll, finish, today, money, same, haliSoma, haliAndika } from './45-lib.mjs';

const MODE = process.argv[2];
if (TARGET !== 'prod' || !['kagua', 'lipa'].includes(MODE)) { console.log('IMEKATALIWA: TARGET=prod na kagua|lipa'); process.exit(1); }
const A = 'INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637';
const CM = '/api/v1/capital-monitoring';
const TAREHE = '2026-11-04';
const KIASI = 386000;
const KAGUA = 'analysis/steps/61-lipa-kagua.json';
const body = { amount: KIASI, principal_amount: KIASI, interest_amount: 0, payment_method: 'CASH', reason: 'Kulipa mkopo',
  notes: 'Awamu 1 ya mkopo A (04/11/2026) - hatua 61', transaction_date: `${TAREHE}T12:00:00` };
const r2 = (n) => Math.round(Number(n) * 100) / 100;

const loanA = async () => { const q = await call('GET', `${CM}/loans/${A}`); return q.ok ? q.data : null; };
const malipo = (l) => (l?.transactions ?? []).filter((t) => (t.sourceType ?? t.source_type) === 'LOAN_REPAYMENT');
const awamu = (l) => (l?.card?.installments ?? []).map((i) => `${i.seq}|${i.dueDate}|${r2(i.amount)}|${r2(i.paidAmount ?? 0)}|${i.status}`).join(' ; ');
const journalsA = async () => (await pages(`/api/v1/gl/journal-entries?startDate=2026-10-04&endDate=${today}&referenceType=LOAN_REPAYMENT`))
  .filter((j) => j.referenceNumber === A && !j.isReversal && j.status !== 'REVERSED');
const mistari = (j) => (j?.lines ?? []).map((l) => `${l.accountCode}|${r2(l.debitAmount ?? 0)}|${r2(l.creditAmount ?? 0)}`).sort().join(' ; ');
// Kipindi kilichofungwa HAKIKATAI malipo: PostingEngine.firstOpenDate inahamisha journal kimya kwenda siku ya kwanza iliyo wazi.
// Kwa hiyo Novemba 2026 lazima iwe OPEN kabla ya POST (mwezi usio kwenye orodha = OPEN, kama GlPeriodService).
const novWazi = async () => {
  const q = await call('GET', '/api/v1/gl/periods');
  if (!q.ok || !Array.isArray(q.data)) return [false, `GET /gl/periods: ${q.message ?? q.http}`];
  const p = q.data.find((x) => x.year === 2026 && x.month === 11);
  return [!p || p.status === 'OPEN', `2026-11 ${p ? p.status : '(haipo kwenye orodha = OPEN)'}`];
};
// Hali ya kabla ya malipo - kagua na lipa zinalinganisha hii (namba tu).
const sura = (l) => JSON.stringify({ status: l?.card?.loanStatus, owed: r2(l?.card?.owed), repaid: r2(l?.card?.repaid), awamu: awamu(l), malipo: malipo(l).length });

console.log(`61 LIPA MKOPO A PROD ${API} - ${MODE} - leo ${today} - saa ${new Date().toISOString()}`);
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const a0 = await loanA();
check('1-GET-mkopo-A', !!a0?.card, `GET /loans/${A}: ${a0?.card ? 'kadi ya 2.3.0 ipo' : 'imeshindwa'}`);
if (!a0?.card) finish(`61 lipa mkopo ${MODE}`);
const j0 = await journalsA();
console.log(`  A: [${a0.reason}] ${a0.card.loanStatus}, deni ${money(a0.card.owed)}, repaid ${money(a0.card.repaid)}, malipo ${malipo(a0).length}, journal LOAN_REPAYMENT ${j0.length}`);
console.log(`  awamu: ${awamu(a0)}`);
const safi = (l, j) => l.card.loanStatus === 'ACTIVE' && same(l.card.owed, 1158000) && same(l.card.repaid, 0) && malipo(l).length === 0 && j.length === 0
  && awamu(l) === '1|2026-11-04|386000|0|UNPAID ; 2|2026-12-04|386000|0|UNPAID ; 3|2027-01-04|386000|0|UNPAID';

if (MODE === 'kagua') {
  fs.rmSync(KAGUA, { force: true });
  check('2-A-ACTIVE', a0.card.loanStatus === 'ACTIVE', `hali ${a0.card.loanStatus}`);
  check('2-deni-1158000', same(a0.card.owed, 1158000), `deni (2100) ${money(a0.card.owed)} (lazima 1,158,000)`);
  check('2-bila-malipo', same(a0.card.repaid, 0) && malipo(a0).length === 0 && j0.length === 0,
    `repaid ${money(a0.card.repaid)}, malipo ${malipo(a0).length}, journal ${j0.length} (lazima 0 - vinginevyo yameshaandikwa, USILIPE tena)`);
  check('2-awamu-3-hazijalipwa', awamu(a0) === '1|2026-11-04|386000|0|UNPAID ; 2|2026-12-04|386000|0|UNPAID ; 3|2027-01-04|386000|0|UNPAID',
    `awamu: ${awamu(a0)}`);
  const [wazi, nov] = await novWazi();
  check('3-Novemba-wazi', wazi, `kipindi ${nov} (lazima OPEN - vinginevyo journal ingehamia mwezi mwingine)`);
  const tb = await tbAll(today);
  check('3-TB-0', !!tb && same(Object.values(tb).reduce((s, v) => s + v, 0), 0), tb ? 'TB inasomeka na jumla ni 0' : 'TB haikusomwa');
  console.log(`  LIPA ITAFANYA (tarehe ${TAREHE}): POST ${CM}/loans/${A}/repay ${JSON.stringify(body)}`);
  console.log(`    journal: Dr 2100 ${money(KIASI)} / Cr 1000 ${money(KIASI)} (CASH; bank cut-over haijawekwa)`);
  console.log(`    deni 1,158,000 -> 772,000; repaid 0 -> 386,000; awamu 1 -> PAID; awamu 2 (04/12) na 3 (04/01) hazibadiliki; riba (1150 -> 6600) inaendelea kwa ratiba.`);
  if (!failed()) fs.writeFileSync(KAGUA, JSON.stringify({ tarehe: today, sura: sura(a0), body }, null, 2));
  console.log(!failed() ? `  kagua imehifadhiwa: ${KAGUA}` : '  kagua HAIKUHIFADHIWA (kuna FAIL) - lipa haitaweza kuendeshwa');
  console.log('PREVIEW_TAYARI');
  finish('61 lipa mkopo kagua');
}

// ---------------- lipa ----------------
if (today < TAREHE) { check('0-tarehe', false, `leo ${today} ni kabla ya ${TAREHE} - backend inakataa tarehe ya baadaye; endesha tarehe ${TAREHE} au baadaye`); finish('61 lipa mkopo lipa'); }
const H0 = haliSoma('61');
const tayari = same(a0.card.repaid, KIASI) && malipo(a0).length === 1 && j0.length === 1;
if (tayari) {
  console.log(`  malipo yameshaandikwa (hali ${H0 ? H0.hatua : 'haipo'}) - POST HAIRUDIWI, inakaguliwa tu`);
} else {
  if (!fs.existsSync(KAGUA)) { check('0-kagua-ipo', false, `${KAGUA} haipo - endesha kagua kwanza`); finish('61 lipa mkopo lipa'); }
  const K = JSON.parse(fs.readFileSync(KAGUA, 'utf8'));
  check('0-kagua-ya-leo', K.tarehe === today, `kagua ya ${K.tarehe} (lazima ya leo ${today})`);
  check('0-hali-=-kagua', safi(a0, j0) && sura(a0) === K.sura, `sasa ${sura(a0)} | kagua ${K.sura}`);
  check('0-mwili-=-kagua', JSON.stringify(K.body) === JSON.stringify(body), 'mwili wa POST ni uleule ulioonyeshwa kwenye kagua');
  const [wazi, nov] = await novWazi();
  check('0-Novemba-wazi', wazi, `kipindi ${nov} (lazima OPEN)`);
  if (failed()) finish('61 lipa mkopo lipa');
  if (H0?.hatua === 'POST-IMEANZA') {
    // POST ilianza lakini malipo hayaonekani: huenda ombi bado linaendelea kwenye server, au lilikatika.
    // Kujaribu tena kunaweza kulipa mara mbili, kwa hiyo SIMAMA: Claude akague kwanza.
    check('0-hali-ya-kukatika', false, `POST ilianza ${H0.saa} lakini malipo hayaonekani - SIMAMA, nitumie log (usijaribu tena)`);
    finish('61 lipa mkopo lipa');
  }
}
const b2100 = await bal('2100', today);
if (!tayari) {
  haliAndika('61', { hatua: 'POST-IMEANZA', b2100 });
  const r = await call('POST', `${CM}/loans/${A}/repay`, body);
  haliAndika('61', { hatua: r.ok ? 'POST-SAWA' : 'POST-IMESHINDWA', http: r.http, message: r.message ?? null });
  check('1-POST-repay', r.ok && r.http === 201, `POST /repay: HTTP ${r.http} ${r.ok ? 'sawa' : r.message}`);
  if (!r.ok) finish('61 lipa mkopo lipa');
}

// Ukaguzi kwa API
const a1 = await loanA();
const j1 = await journalsA();
const c = a1?.card ?? {};
check('2-deni-772000', same(c.owed, 772000), `deni (2100) ${money(c.owed)} (lazima 772,000)`);
check('2-repaid-386000', same(c.repaid, KIASI) && malipo(a1).length === 1, `repaid ${money(c.repaid)}, malipo ${malipo(a1).length} (lazima 386,000 na 1)`);
check('3-awamu', awamu(a1) === '1|2026-11-04|386000|386000|PAID ; 2|2026-12-04|386000|0|UNPAID ; 3|2027-01-04|386000|0|UNPAID',
  `awamu: ${awamu(a1)} (lazima 1 PAID 386,000; 2 na 3 UNPAID 0)`);
check('3-A-bado-ACTIVE', c.loanStatus === 'ACTIVE', `hali ${c.loanStatus} (lazima ACTIVE - 2100 na 1150 bado si 0)`);
const j = j1[0];
check('4-journal', j1.length === 1 && j.entryDate === TAREHE && mistari(j) === '1000|0|386000 ; 2100|386000|0',
  `journal ${j1.length}: ${j?.entryNumber} ${j?.entryDate} late ${j?.isLateEntry} | ${mistari(j)} (lazima ${TAREHE}, 1000|0|386000 ; 2100|386000|0)`);
if (!tayari) {
  const b1 = await bal('2100', today);
  check('5-2100-delta', same(r2(b1 - b2100), KIASI), `2100 ${money(b2100)} -> ${money(b1)} = ${money(b1 - b2100)} (lazima +386,000)`);
}
const tb1 = await tbAll(today);
check('5-TB-0', !!tb1 && same(Object.values(tb1).reduce((s, v) => s + v, 0), 0), tb1 ? `jumla ya TB ${r2(Object.values(tb1).reduce((s, v) => s + v, 0))}` : 'TB haikusomwa');
console.log(`  awamu ijayo: 2 tarehe 04/12/2026 386,000; riba iliyoandikwa ${money(c.interestBooked)}, inayobaki ${money(c.interestRemaining)}`);
finish('61 lipa mkopo lipa');
