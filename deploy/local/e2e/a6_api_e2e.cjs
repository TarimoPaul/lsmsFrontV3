// (owner 12/11 gi, gf 4) A6 GUARD over HTTP: once a reco is APPROVED, that day's sales cannot be changed - not by the seller,
// not by the CEO - until the reco is reopened. The unit matrix is SaleChangeGuardTest (suite); this runs the same rule
// through the real API on a dump copy. Runs as the E2E SELLER on two FREE past days, so the real manager's days are untouched.
//   A1 control: before approval the seller edits the sale with a reason -> Success, audit ALLOWED (the test can see a pass)
//   A2 reco of day X approved (CEO) -> APPROVED
//   A3 seller edits the day-X sale -> refused RECO_APPROVED, sale unchanged, audit REFUSED by the seller
//   A4 CEO edits the day-X sale -> refused RECO_APPROVED (CEO too), audit by_is_ceo
//   A5 CEO deletes the day-X sale -> refused, sale not deleted
//   A6 a sale of day Y moved onto day X -> refused, its date unchanged
//   A7 the real manager: no new sale / reco from this test
//   A8 (gk) the way out: the seller cannot reopen (refused); the CEO reopens with a reason -> the seller still cannot change
//      the day (NEEDS_CEO), the CEO deletes the day-X sale -> allowed, audit ALLOWED (reopened reco) -> approved again ->
//      the sale's GL nets 0 on every account, TB = 0; A8e (gl) the reversal is dated on the sale's day: the day's GL revenue =
//      the re-approved reco, the day of the change has no line of this sale
// Throw-away local copy only. Run: node a6_api_e2e.cjs
const { execFileSync } = require('child_process');
const { SELLER, ensureSeller } = require('./e2e-muuzaji.cjs');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'A6-Kinga-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const msg = (r) => String(r?.j?.message || '').slice(0, 160);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
const TAG = `E2E-A6-${Date.now()}`;

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email = '${CEO}'`);
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT')");
  const sUid = ensureSeller(MGR, PW);
  const realMgr = sql(`select uid from users where email = '${MGR}'`);
  const ceo = await login(CEO);
  const sel = await login(SELLER);
  const real0 = sql(`select (select count(*) from sales where user_uid = '${realMgr}') || '/' || (select count(*) from daily_reconciliation where user_uid = '${realMgr}')`);
  const brUid = sql(`select branch_uid from daily_reconciliation where user_uid = '${realMgr}' and branch_uid is not null order by reconciliation_date desc limit 1`);
  // two free days of the seller (no sale, no reco), after the last stock count (a sale dated before it is refused by
  // CountingGuardService) and not a day another seller test uses: today/yesterday (cutover T10, manunuzi_onyo), 01-08/11 (cutover, pengo, manunuzi_onyo)
  const free = sql(`select string_agg(d::date::text, ',' order by d desc) from (select d from generate_series(current_date - 2, (select coalesce(max(started_at)::date, date '2026-01-01') + 1 from counting_session where status <> 'FORCE_CLOSED'), interval '-1 day') d
      where d::date not between date '2026-11-01' and date '2026-11-08'
        and not exists (select 1 from sales s where s.user_uid = '${sUid}' and s.sale_date::date = d::date)
        and not exists (select 1 from daily_reconciliation r where r.user_uid = '${sUid}' and r.reconciliation_date = d::date) limit 2) x`).split(',');
  const [X, Y] = free;
  if (!X || !Y) { console.log('FAIL hakuna siku 2 huru za muuzaji kati ya kuhesabu mali na jana', free); process.exit(1); }
  const [pu, pn, pr] = sql("select uid || '|' || product_name || '|' || round(piece_sale_price) from products where not coalesce(is_deleted,false) and is_active and current_stock >= 10 and piece_sale_price > coalesce(current_average_cost,0) * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1").split('|');
  const P1 = Number(pr);
  const sale = async (day, tag) => {
    const r = await api('POST', '/api/v1/sales/partial', sel, { saleDate: `${day}T11:00:00`, customerUid: null, userUid: sUid, discountAmount: 0, saleNotes: `${TAG} ${tag}`,
      saleDetails: [{ productUid: pu, productName: pn, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: P1, subTotal: P1, overrideUnitPrice: null }],
      payments: [{ customerName: 'Walk-in Customer', paymentMethod: 'CASH', totalAmount: P1, amountPaid: P1, paymentDate: `${day}T11:00:00` }] });
    await sleep(700);
    return { r, sid: sql(`select coalesce((select uid from sales where sale_notes like '%${TAG} ${tag}' order by id desc limit 1),'')` ) };
  };
  const edit = (tok, sid, day, notes, why) => api('PUT', `/api/v1/sales/${sid}?reason=${encodeURIComponent(why)}`, tok, { uid: sid, saleDate: `${day}T11:00:00`, discountAmount: 0, saleNotes: notes, customerUid: null });
  const audit = (sid, extra) => sql(`select count(*) from sale_change_audit where sale_uid = '${sid}' and ${extra}`);
  console.log(`MUUZAJI ${SELLER} | siku X ${X} | siku Y ${Y} | bidhaa ${pn} ${P1}`);

  // A1 control before approval
  const sx = await sale(X, 'X');
  const e1 = sx.sid ? await edit(sel, sx.sid, X, `${TAG} X-edit`, 'Mteja aliomba risiti ibadilishwe jina') : null;
  ok(`A1 kabla ya kuidhinisha: muuzaji anabadilisha sale ya ${X} kwa sababu -> Success, audit ALLOWED`, sx.r.j?.status === 'Success' && e1?.j?.status === 'Success'
    && audit(sx.sid, "result = 'ALLOWED' and action = 'UPDATE'") === '1', `${msg(sx.r)} | ${msg(e1)}`);

  // A2 approve the reco of day X
  const ru = `e2e-a6-${Date.now()}`;
  sql(`insert into daily_reconciliation (uid, created_at, reconciliation_date, user_uid, user_name, branch_uid, status) values ('${ru}', now(), '${X}', '${sUid}', 'E2E Muuzaji', '${brUid}', 'DRAFT')`);
  await api('POST', `/api/v1/reconciliation/${ru}/refresh`, sel);
  sql(`update daily_reconciliation set status = 'SUBMITTED', variance_explanation = 'E2E A6 maelezo ya tofauti ya jaribio' where uid = '${ru}'`);
  for (const t of ['reconciliation_cash_entries', 'reconciliation_mobile_entries', 'reconciliation_expenses', 'reconciliation_purchases', 'reconciliation_debt_collections', 'reconciliation_retail_debts']) {
    try { sql(`update ${t} set is_verified = true where reconciliation_uid = '${ru}'`); } catch { /* table without the flag */ }
  }
  const ap = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('E2E A6')}`, ceo);
  const st = sql(`select status from daily_reconciliation where uid = '${ru}'`);
  ok(`A2 reco ya ${X} IMEIDHINISHWA na CEO`, ap.j?.status === 'Success' && st === 'APPROVED', `${msg(ap)} | ${st}`);

  const notes = () => sql(`select sale_notes || '|' || coalesce(is_deleted,false) || '|' || sale_date::date from sales where uid = '${sx.sid}'`);
  const n0 = notes();
  // A3 seller edit -> refused
  const e3 = await edit(sel, sx.sid, X, `${TAG} X-baada`, 'Mteja aliomba risiti ibadilishwe tena');
  ok('A3 muuzaji anabadilisha sale ya siku iliyoidhinishwa -> IMEKATALIWA (RECO_APPROVED), sale haijabadilika', e3.j?.status !== 'Success' && /umeshaidhinishwa/.test(msg(e3))
    && notes() === n0 && audit(sx.sid, `result = 'REFUSED' and refuse_code = 'RECO_APPROVED' and by_email = '${SELLER}'`) === '1', `${e3.status} ${msg(e3)} | ${notes()}`);
  // A4 CEO edit -> refused
  const e4 = await edit(ceo, sx.sid, X, `${TAG} X-ceo`, 'CEO anarekebisha maelezo ya sale');
  ok('A4 CEO pia -> IMEKATALIWA (RECO_APPROVED), audit by_is_ceo', e4.j?.status !== 'Success' && /umeshaidhinishwa/.test(msg(e4))
    && notes() === n0 && audit(sx.sid, `result = 'REFUSED' and refuse_code = 'RECO_APPROVED' and by_email = '${CEO}' and by_is_ceo`) === '1', `${e4.status} ${msg(e4)} | ${notes()}`);
  // A5 CEO delete -> refused
  const d5 = await api('DELETE', `/api/v1/sales/${sx.sid}?deleteReason=${encodeURIComponent('Sale ilirudiwa kwa makosa ya mfumo')}`, ceo);
  ok('A5 CEO anafuta sale ya siku iliyoidhinishwa -> IMEKATALIWA, sale haijafutwa', d5.j?.status !== 'Success' && notes() === n0
    && audit(sx.sid, "result = 'REFUSED' and refuse_code = 'RECO_APPROVED' and action = 'DELETE'") === '1', `${d5.status} ${msg(d5)} | ${notes()}`);
  // A6 move a day-Y sale onto day X -> refused
  const sy = await sale(Y, 'Y');
  const e6 = sy.sid ? await edit(sel, sy.sid, X, `${TAG} Y-hamisha`, 'Sale iliandikwa tarehe isiyo sahihi') : null;
  const yDay = sql(`select sale_date::date from sales where uid = '${sy.sid}'`);
  ok(`A6 sale ya ${Y} inahamishiwa ${X} (imeidhinishwa) -> IMEKATALIWA, tarehe haijabadilika`, sy.r.j?.status === 'Success' && e6?.j?.status !== 'Success' && yDay === Y
    && audit(sy.sid, "result = 'REFUSED' and refuse_code = 'RECO_APPROVED'") === '1', `${msg(sy.r)} | ${e6?.status} ${msg(e6)} | ${yDay}`);
  // A8 (gk) reopen -> change -> approve again
  const tb = () => Number(sql("select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"));
  const saleGl = () => sql(`select coalesce(string_agg(a || ':' || n, ',' order by a), '') from (select l.account_code a, round(sum(l.debit_amount - l.credit_amount), 2) n from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${sx.sid}' group by 1) x where n <> 0`);
  const gl0 = saleGl();
  const why8 = 'Mteja alirudisha bidhaa yote siku hiyo';
  const ro1 = await api('POST', `/api/v1/reconciliation/${ru}/reopen?reason=${encodeURIComponent('Muuzaji anajaribu kufungua reco')}`, sel);
  const st1 = sql(`select status from daily_reconciliation where uid = '${ru}'`);
  const ro2 = await api('POST', `/api/v1/reconciliation/${ru}/reopen?reason=${encodeURIComponent('Marekebisho ya sale iliyorudishwa na mteja')}`, ceo);
  const st2 = sql(`select status || '|' || coalesce(reopen_count,0) from daily_reconciliation where uid = '${ru}'`);
  const e8 = await api('DELETE', `/api/v1/sales/${sx.sid}?deleteReason=${encodeURIComponent(why8)}`, sel);
  const d8 = await api('DELETE', `/api/v1/sales/${sx.sid}?deleteReason=${encodeURIComponent(why8)}`, ceo);
  await sleep(800);
  const del8 = sql(`select coalesce(is_deleted,false) from sales where uid = '${sx.sid}'`);
  const aud8 = audit(sx.sid, `result = 'ALLOWED' and action = 'DELETE' and by_email = '${CEO}' and reason = '${why8}' and reco_status = 'REOPENED'`);
  sql(`update daily_reconciliation set status = 'SUBMITTED' where uid = '${ru}'`);
  for (const t of ['reconciliation_cash_entries', 'reconciliation_mobile_entries', 'reconciliation_expenses', 'reconciliation_purchases', 'reconciliation_debt_collections', 'reconciliation_retail_debts']) {
    try { sql(`update ${t} set is_verified = true where reconciliation_uid = '${ru}'`); } catch { /* table without the flag */ }
  }
  const ap8 = await api('POST', `/api/v1/reconciliation/${ru}/approve?notes=${encodeURIComponent('E2E A6 baada ya marekebisho')}`, ceo);
  const st8 = sql(`select status from daily_reconciliation where uid = '${ru}'`);
  const gl8 = saleGl();
  const days8 = sql(`select coalesce(string_agg(distinct j.entry_date::text, ','), '') from journal_entry j where j.reference_uid = '${sx.sid}' and j.status = 'POSTED'`);
  const tb8 = tb();
  ok('A8a muuzaji HAWEZI kufungua reco iliyoidhinishwa -> imekataliwa, bado APPROVED', ro1.j?.status !== 'Success' && st1 === 'APPROVED', `${ro1.status} ${msg(ro1)} | ${st1}`);
  ok('A8b CEO anafungua kwa sababu -> REOPENED; muuzaji bado hawezi kubadilisha (NEEDS_CEO)', ro2.j?.status === 'Success' && /^REOPENED\|[1-9]/.test(st2) && e8.j?.status !== 'Success'
    && audit(sx.sid, `result = 'REFUSED' and refuse_code = 'NEEDS_CEO' and by_email = '${SELLER}'`) === '1', `${msg(ro2)} | ${st2} | ${e8.status} ${msg(e8)}`);
  ok('A8c CEO anafuta sale ya siku iliyofunguliwa -> imeruhusiwa, audit ALLOWED (REOPENED, sababu)', d8.j?.status === 'Success' && del8 === 't' && aud8 === '1', `${msg(d8)} | deleted=${del8} audit=${aud8}`);
  ok(`A8d imeidhinishwa tena; GL ya sale ${gl0} -> imefutwa (net 0 kila akaunti); TB = 0`, ap8.j?.status === 'Success' && st8 === 'APPROVED'
    && gl0 !== '' && gl8 === '' && Math.abs(tb8) < 0.005, `${msg(ap8)} | ${st8} | GL ${gl0} -> '${gl8}' | tb ${tb8}`);
  // A8e (gl) a change inside a REOPENED reco is dated on the sale's day: the day's GL revenue of the seller's sales equals
  // the re-approved reco, and the day of the change carries no line of this sale
  const today = sql('select current_date::text');
  const glRev = Number(sql(`select coalesce(round(sum(l.credit_amount - l.debit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid
      join sales s on s.uid = j.reference_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '4000' and s.user_uid = '${sUid}' and j.entry_date = '${X}'`));
  const recoSales = Number(sql(`select coalesce(round(auto_total_sales, 2), 0) from daily_reconciliation where uid = '${ru}'`));
  const onToday = sql(`select count(*) from journal_entry where reference_uid = '${sx.sid}' and entry_date = '${today}'`);
  ok(`A8e journal zote za sale ni tarehe ${X} (siku ya reco); GL ${X} mapato ${glRev} = reco ${recoSales}; ${today} haina mstari wa sale hii`,
    days8 === X && Math.abs(glRev - recoSales) < 0.005 && onToday === '0', `tarehe ${days8} | GL ${glRev} reco ${recoSales} | leo ${onToday}`);
  // A7 the real manager untouched
  const real1 = sql(`select (select count(*) from sales where user_uid = '${realMgr}') || '/' || (select count(*) from daily_reconciliation where user_uid = '${realMgr}')`);
  ok('A7 Macheda halisi: hakuna sale wala reco mpya kutoka jaribio hili', real1 === real0, `${real0} -> ${real1}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
