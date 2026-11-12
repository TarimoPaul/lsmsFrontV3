// C4 sales returns (owner 03/11 ci, 11/11 fa 8) on the REAL schema (PG15, prod dump + V148) through the API.
// Needs the backend started WITH the switch: APP_FEATURES_SALES_RETURNS_ENABLED=true deploy/local/local.sh up <image>.
// With the switch OFF (default, as on prod) the script only checks that returns are refused (F1) and stops.
//   R1 a return request (MGR) of 1 good piece of a paid cash sale -> PENDING, nothing posted yet
//   R2 approval (CEO), refund CASH: stock +1; GL Dr 4020 sale value / Cr 1000; Dr 1200 / Cr 5000 at the line's cost; sale total down
//   R3 more than is left on the line -> refused
//   R4 a DAMAGED piece refunded by M-Pesa (VODACOM): Cr 1030, no stock back, no 1200 line
//   R5 a KUPIMA (poured) line is never returned through C4
//   R8 (fg) a return approved on a LATER day: the sale day's reco sales stay as they were (no false excess / drift);
//      today's reco deducts the CASH refund only (M-Pesa refund not from the drawer)
//   TB stays 0
// Throw-away local copy only. Run: node marejesho_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Marejesho-Jaribio-Local-2026';
let P = 0, F = 0;
const ok = (name, cond, info = '') => { if (cond) { P++; console.log('PASS', name); } else { F++; console.log('FAIL', name, info); } };
const sql = (q) => execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'psql', '-U', 'postgres', '-d', 'Lsms', '-At', '-F', '|', '-c', q], { encoding: 'utf8' }).trim();
async function api(method, path, token, body) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', Origin: 'https://elikom.co.tz', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j = {};
  try { j = await r.json(); } catch { /* empty */ }
  return { status: r.status, j };
}
const login = async (email) => (await api('POST', '/api/auth/login', null, { email, password: PW })).j.data.tokenInfo.token;
const tb = () => Number(sql("select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)"));
const jl = (ref) => sql(`select string_agg(account_code || ':' || v, ',' order by account_code) from (select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) v from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1) x`);
const stock = (pu) => Number(sql(`select current_stock from products where uid = '${pu}'`));
const msg = (r) => String(r.j?.message || '');

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT')");
  const ceo = await login(CEO); const mgr = await login(MGR);

  const on = (await api('GET', '/api/v1/sales/returns/enabled', mgr)).j?.data;
  if (on !== true) {
    const r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: 'x', returnType: 'PARTIAL_RETURN', returnReason: 'e2e', returnItems: [{ productUid: 'x', quantity: 1 }] });
    ok('F1 swichi IMEZIMWA (default): marejesho yanakataliwa', on === false && /hayajawashwa/.test(msg(r)), `${on} ${msg(r)}`);
    console.log(`MWISHO PASS ${P} FAIL ${F}`);
    process.exit(F ? 1 : 0);
  }
  ok('R0 swichi IMEWASHWA kwa jaribio hili', on === true);
  const tb0 = tb();

  // a paid cash sale (no customer, no discount) of the last 25 days with two normal lines
  const row = sql("select s.uid || '|' || d.uid || '|' || d.product_uid || '|' || d.piece_quantity || '|' || d.sub_total || '|' || d.total_cost from sales s join sales_details d on d.sale_uid = s.uid and not d.is_deleted where not s.is_deleted and s.payment_status = 'PAID' and s.customer_id is null and s.sale_date >= now() - interval '25 days' and (s.sale_source is null or s.sale_source = 'STANDARD') and d.pour_measure_uid is null and d.piece_quantity >= 2 and d.total_cost > 0 and coalesce(s.discount_amount,0) = 0 and (select count(*) from sales_details x where x.sale_uid = s.uid and not x.is_deleted and x.pour_measure_uid is null and x.piece_quantity >= 2) >= 2 and not exists (select 1 from sales_returns r where r.original_sale_uid = s.uid) order by s.sale_date desc, d.id limit 1").split('|');
  const [sid, dA, pA, qA, subA, costA] = row;
  const [dB, pB, qB, subB] = sql(`select d.uid || '|' || d.product_uid || '|' || d.piece_quantity || '|' || d.sub_total from sales_details d where d.sale_uid = '${sid}' and not d.is_deleted and d.uid <> '${dA}' and d.pour_measure_uid is null and d.piece_quantity >= 2 order by d.id limit 1`).split('|');
  const unitA = Number(subA) / Number(qA), unitCostA = Number(costA) / Number(qA), unitB = Number(subB) / Number(qB);
  const total0 = Number(sql(`select total_amount from sales where uid = '${sid}'`));
  const s0 = stock(pA), sB0 = stock(pB);
  const saleDay = sql(`select sale_date::date from sales where uid = '${sid}'`), today = sql('select current_date');
  const auto = async (d) => (await api('GET', `/api/v1/reconciliation/auto-summary/${d}`, ceo)).j?.data || {};
  const day0 = Number((await auto(saleDay)).totalSales), ded0 = Number((await auto(today)).returnDeductions);

  // ── R1 / R2 good piece, refund CASH ──
  let r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'PARTIAL_RETURN', returnReason: 'E2E C4 mteja amerudisha',
    returnItems: [{ saleDetailUid: dA, productUid: pA, quantity: 1, itemCondition: 'GOOD' }] });
  const ret1 = r.j?.data?.uid;
  ok('R1 ombi la marejesho -> PENDING, hakuna GL bado', r.j?.status === 'Success' && sql(`select return_status from sales_returns where uid = '${ret1}'`) === 'PENDING' && !jl(ret1), msg(r));
  r = await api('POST', `/api/v1/sales/returns/${ret1}/approve`, ceo, { refundMethod: 'CASH', approvalNotes: 'E2E C4' });
  const want1 = `1000:${(-unitA).toFixed(2)},1200:${unitCostA.toFixed(2)},4020:${unitA.toFixed(2)},5000:${(-unitCostA).toFixed(2)}`;
  ok('R2a kuidhinisha -> APPROVED, stock +1', r.j?.status === 'Success' && sql(`select return_status from sales_returns where uid = '${ret1}'`) === 'APPROVED' && stock(pA) === s0 + 1, `${msg(r)} stock ${s0}->${stock(pA)}`);
  ok('R2b GL: Dr 4020 / Cr 1000 bei ya kuuza; Dr 1200 / Cr 5000 gharama', jl(ret1) === want1, `${jl(ret1)} (lazima ${want1})`);
  ok('R2c jumla ya mauzo imepungua', Math.abs(Number(sql(`select total_amount from sales where uid = '${sid}'`)) - (total0 - unitA)) < 0.01);
  { const d1 = Number((await auto(saleDay)).totalSales), e1 = Number((await auto(today)).returnDeductions);
    ok(`R8a siku ya mauzo (${saleDay} < ${today}): mauzo ya reco hayajabadilika`, saleDay < today && Math.abs(d1 - day0) < 0.01, `${day0} -> ${d1}`);
    ok('R8b leo: marejesho ya CASH yanatolewa kwenye pesa ya droo', Math.abs(e1 - ded0 - unitA) < 0.01, `${ded0} -> ${e1} (lazima +${unitA})`); }

  // ── R3 more than is left ──
  r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'PARTIAL_RETURN', returnReason: 'E2E C4 zaidi',
    returnItems: [{ saleDetailUid: dA, productUid: pA, quantity: Number(qA) }] });
  ok('R3 zaidi ya kilichobaki -> imekataliwa', r.j?.status !== 'Success' && /vinazidi/.test(msg(r)), msg(r));

  // ── R4 damaged, refund by M-Pesa ──
  r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'DAMAGED_RETURN', returnReason: 'E2E C4 imeharibika',
    returnItems: [{ saleDetailUid: dB, productUid: pB, quantity: 1, itemCondition: 'DAMAGED' }] });
  const ret2 = r.j?.data?.uid;
  r = await api('POST', `/api/v1/sales/returns/${ret2}/approve`, ceo, { refundMethod: 'VODACOM', approvalNotes: 'E2E C4' });
  const want2 = `1030:${(-unitB).toFixed(2)},4020:${unitB.toFixed(2)}`;
  ok('R8c M-Pesa haitolewi kwenye droo; siku ya mauzo ileile', Math.abs(Number((await auto(today)).returnDeductions) - ded0 - unitA) < 0.01 && Math.abs(Number((await auto(saleDay)).totalSales) - day0) < 0.01);
  ok('R4 imeharibika + M-Pesa: Cr 1030, haikurudi stock, hakuna 1200', r.j?.status === 'Success' && jl(ret2) === want2 && stock(pB) === sB0, `${msg(r)} ${jl(ret2)} (lazima ${want2}) stock ${sB0}->${stock(pB)}`);

  // ── R5 KUPIMA line (made so on the throw-away copy) ──
  sql(`update sales_details set pour_measure_uid = 'e2e-pour', pour_ml = 30 where uid = '${dB}'`);
  r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'PARTIAL_RETURN', returnReason: 'E2E C4 kupima',
    returnItems: [{ saleDetailUid: dB, productUid: pB, quantity: 1 }] });
  ok('R5 mstari wa KUPIMA hauriudishwi kupitia C4', r.j?.status !== 'Success' && /KUPIMA/.test(msg(r)), msg(r));
  sql(`update sales_details set pour_measure_uid = null, pour_ml = null where uid = '${dB}'`);

  // ── R6 EXCHANGE: 1 more piece of A back, 1 piece of A given (same value, nothing paid) ──
  const sA1 = stock(pA);
  r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'EXCHANGE', returnReason: 'E2E C4 kubadilisha',
    returnItems: [{ saleDetailUid: dA, productUid: pA, quantity: 1, itemCondition: 'GOOD' }],
    exchangeLines: [{ productUid: pA, saleType: 'PIECES', packageQuantity: 1 }] });
  const ret3 = r.j?.data?.uid;
  r = await api('POST', `/api/v1/sales/returns/${ret3}/approve`, ceo, { approvalNotes: 'E2E C4 exchange' });
  const ex = sql(`select coalesce(exchange_sale_uid,'') from sales_returns where uid = '${ret3}'`);
  ok('R6 exchange: mauzo mapya yameundwa, stock ileile (+1 -1)', r.j?.status === 'Success' && ex !== ''
    && sql(`select count(*) from sales_details where sale_uid = '${ex}' and not is_deleted and product_uid = '${pA}'`) === '1' && stock(pA) === sA1,
    `${msg(r)} ex=${ex} stock ${sA1}->${stock(pA)}`);
  // ── R7 an exchange may not hand out a KUPIMA product ──
  const Z = sql("select uid from products p where not coalesce(is_deleted,false) and is_active order by id limit 1 offset 3");
  sql(`insert into pour_product (product_uid, container_name, container_ml, created_by) values ('${Z}', 'chupa', 750, 'e2e c4') on conflict (product_uid) do update set active = true`);
  r = await api('POST', '/api/v1/sales/returns', mgr, { saleUid: sid, returnType: 'EXCHANGE', returnReason: 'E2E C4 kupima',
    returnItems: [{ saleDetailUid: dB, productUid: pB, quantity: 1 }], exchangeLines: [{ productUid: Z, saleType: 'PIECES', packageQuantity: 1 }] });
  ok('R7 exchange haitoi bidhaa ya KUPIMA', r.j?.status !== 'Success' && /KUPIMA/.test(msg(r)), msg(r));
  sql(`update pour_product set active = false where product_uid = '${Z}' and created_by = 'e2e c4'`);

  ok('TB = 0', Math.abs(tb()) < 0.005 && Math.abs(tb() - tb0) < 0.005, `${tb0} -> ${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
