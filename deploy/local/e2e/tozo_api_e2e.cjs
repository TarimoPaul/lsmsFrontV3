// Kazi 4 (owner bt 02/11, dx 10/11) on the REAL schema (PG15, prod dump 29/10 + V144) through the API:
//   a count shortage charged to the counter -> Dr 1120 / Cr 1200 AT COST only, 4900 untouched; the debt is the selling price
//   payment: cost first (Cr 1120), then the margin (Cr 4900 only now, when paid)
//   written agreement: Dr 1120 / Cr 4900, who/when/amount/document; junk note refused; MANAGER 403
//   waiver: margin forgiven with no GL, agreed margin Dr 4900, cost Dr 5100 - never a loss bigger than the cost
//   a debt raised before V144 keeps the V130 rule (no split stored); TB 0 throughout
// Throw-away local copy only. Run: node tozo_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Tozo-Jaribio-Local-2026';
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
const acct = (code) => Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '${code}'`));
/** account -> net (Dr - Cr) of the journal(s) with this reference_uid */
const jl = (ref) => Object.fromEntries(sql(`select l.account_code, round(sum(l.debit_amount - l.credit_amount), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and j.reference_uid = '${ref}' group by 1`).split('\n').filter(Boolean).map((r) => { const [a, v] = r.split('|'); return [a, Number(v)]; }));
const eq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

/** One count session by MGR where `product` is short by `short`; CEO approves CHARGE_TO_CASHIER. Returns the new debt. */
async function chargedCount(mgr, ceo, product, short) {
  // one session per day: earlier test sessions are moved back (local copy only)
  sql("update counting_session c set session_date = m.d, started_at = m.d + time '06:00' from (select min(session_date) - 1 as d from counting_session) m where c.session_date = current_date");
  const s = await api('POST', '/api/v1/counting/sessions', mgr, {});
  if (s.j?.status !== 'Success') throw new Error('start ' + JSON.stringify(s.j).slice(0, 300));
  const sid = s.j.data.uid;
  const lines = sql(`select product_uid || '|' || system_qty_snapshot from counting_line where session_uid = '${sid}' and not is_deleted`).split('\n').filter(Boolean);
  for (const l of lines) {
    const [pu, q] = l.split('|');
    const counted = pu === product ? Math.max(0, Number(q) - short) : Number(q);
    const r = await api('PUT', `/api/v1/counting/sessions/${sid}/lines`, mgr, { productUid: pu, countedQty: counted });
    if (r.j?.status !== 'Success') throw new Error('line ' + JSON.stringify(r.j).slice(0, 300));
  }
  const c = await api('POST', `/api/v1/counting/sessions/${sid}/complete`, mgr, {});
  if (c.j?.status !== 'Success') throw new Error('complete ' + JSON.stringify(c.j).slice(0, 300));
  // the blind recount step is not under test here
  sql(`update counting_session set status = 'PENDING_APPROVAL' where uid = '${sid}'`);
  const varLines = sql(`select uid from counting_line where session_uid = '${sid}' and not is_deleted and counted_qty <> system_qty_snapshot`).split('\n').filter(Boolean);
  const decisions = varLines.map((u) => ({ lineUid: u, decision: 'CHARGE_TO_CASHIER', reason: 'THEFT_SUSPECTED', notes: 'E2E kazi 4' }));
  const a = await api('POST', `/api/v1/counting/sessions/${sid}/approve`, ceo, { decisions });
  if (a.j?.status !== 'Success') throw new Error('approve ' + JSON.stringify(a.j).slice(0, 300));
  const line = sql(`select uid || '|' || abs(variance_value) || '|' || charge_value from counting_line where session_uid = '${sid}' and product_uid = '${product}' and not is_deleted`).split('|');
  const adj = sql(`select gl_reference_uid from stock_adjustment where counting_line_uid = '${line[0]}'`);
  const liab = sql(`select uid from staff_liability where session_uid = '${sid}' and not is_deleted`);
  return { sid, cost: Number(line[1]), charge: Number(line[2]), adjRef: adj, liab };
}

const header = (uid) => { const r = sql(`select amount || '|' || coalesce(cost_open::text,'null') || '|' || coalesce(agreed_open::text,'null') || '|' || coalesce(margin_open::text,'null') || '|' || status from staff_liability where uid = '${uid}'`).split('|'); return { amount: Number(r[0]), cost: r[1], agreed: r[2], margin: r[3], status: r[4] }; };
const lastPay = (uid) => sql(`select uid || '|' || coalesce(cost_part::text,'null') || '|' || coalesce(agreed_part::text,'null') || '|' || coalesce(margin_part::text,'null') from staff_liability_payment where liability_uid = '${uid}' order by id desc limit 1`).split('|');

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  // no open count from the dump may block a new one (local copy only)
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT','PENDING_APPROVAL')");
  const ceo = await login(CEO); const mgr = await login(MGR);
  // a product with stock for several shortages and a selling price above its cost (local copy only)
  const X = sql("select uid from products where not coalesce(is_deleted,false) and current_stock >= 12 and current_average_cost > 0 and piece_sale_price > current_average_cost * 1.05 and product_name not ilike '%pima%' order by current_stock desc, id limit 1");
  const tb0 = tb();

  // ── A: charge at cost, then pay cost first and the margin last ──
  const a0 = { r: acct('1120'), i: acct('1200'), o: acct('4900') };
  const A = await chargedCount(mgr, ceo, X, 1);
  const hA = header(A.liab);
  ok('A1 deni = bei ya kuuza (charge > gharama)', A.charge > A.cost && eq(hA.amount, A.charge), JSON.stringify({ A, hA }));
  const gA = jl(A.adjRef);
  ok('A2 GL ya tozo: Dr 1120 = gharama, Cr 1200 = gharama, HAKUNA 4900', eq(gA['1120'], A.cost) && eq(gA['1200'], -A.cost) && gA['4900'] === undefined, JSON.stringify(gA));
  ok('A3 4900 haijaguswa; 1120 +gharama tu', eq(acct('4900'), a0.o) && eq(acct('1120') - a0.r, A.cost), `${acct('4900')} ${a0.o}`);
  ok('A4 ndoo: cost=gharama, agreed=0, margin=tofauti', eq(hA.cost, A.cost) && eq(hA.agreed, 0) && eq(hA.margin, A.charge - A.cost), JSON.stringify(hA));
  const part1 = Math.floor(A.cost / 2);
  const p1 = await api('POST', `/api/liabilities/${A.liab}/payments`, ceo, { amount: part1, paymentType: 'CASH', paymentMethod: 'CASH', notes: 'E2E nusu' });
  const lp1 = lastPay(A.liab); const g1 = jl('LIABPAY:' + lp1[0]);
  ok('A5 malipo ya nusu: yote Cr 1120, 4900 bado 0', p1.j?.status === 'Success' && eq(g1['1120'], -part1) && g1['4900'] === undefined && eq(lp1[1], part1) && eq(lp1[3], 0), JSON.stringify({ g1, lp1, m: p1.j?.message }));
  const rest = Math.round((A.charge - part1) * 100) / 100;
  const p2 = await api('POST', `/api/liabilities/${A.liab}/payments`, ceo, { amount: rest, paymentType: 'CASH', paymentMethod: 'CASH', notes: 'E2E iliyobaki' });
  const lp2 = lastPay(A.liab); const g2 = jl('LIABPAY:' + lp2[0]);
  ok('A6 malipo ya mwisho: Cr 1120 gharama iliyobaki + Cr 4900 tofauti (sasa ndipo mapato)', p2.j?.status === 'Success' && eq(g2['1120'], -(A.cost - part1)) && eq(g2['4900'], -(A.charge - A.cost)), JSON.stringify(g2));
  ok('A7 deni SETTLED; ndoo zote 0; 1120 imerudi; 4900 = tofauti tu', header(A.liab).status === 'SETTLED' && eq(header(A.liab).cost, 0) && eq(header(A.liab).margin, 0)
    && eq(acct('1120'), a0.r) && eq(acct('4900') - a0.o, -(A.charge - A.cost)), JSON.stringify(header(A.liab)));
  ok('A8 TB 0', eq(tb(), tb0), `${tb()}`);
  const over = await api('POST', `/api/liabilities/${A.liab}/payments`, ceo, { amount: 1, paymentType: 'CASH', paymentMethod: 'CASH' });
  ok('A9 malipo zaidi ya deni -> 400', over.status === 400, `${over.status}`);

  // ── B: written agreement, then waiver ──
  const b0 = { r: acct('1120'), o: acct('4900'), s: acct('5100') };
  const B = await chargedCount(mgr, ceo, X, 2);
  const marginB = Math.round((B.charge - B.cost) * 100) / 100;
  const AG = Math.floor(marginB / 2); // the part agreed in writing
  ok('B1 deni la pili: chupa 2, kwa gharama', eq(jl(B.adjRef)['1120'], B.cost) && marginB > 0, JSON.stringify({ B }));
  const junk = await api('POST', `/api/liabilities/${B.liab}/margin-agreement`, ceo, { amount: 1000, documentRef: 'Daftari 1', note: 'rrrrrrrrrrrr' });
  ok('B2 makubaliano yenye maelezo dhaifu -> 400', junk.status === 400, `${junk.status} ${junk.j?.message}`);
  const big = await api('POST', `/api/liabilities/${B.liab}/margin-agreement`, ceo, { amount: marginB + 1, documentRef: 'Daftari 1', note: 'Amekubali kulipa tofauti yote' });
  ok('B3 makubaliano zaidi ya tofauti -> 400', big.status === 400, `${big.status}`);
  const m403 = await api('POST', `/api/liabilities/${B.liab}/margin-agreement`, mgr, { amount: 1000, documentRef: 'Daftari 1', note: 'Amekubali kulipa tofauti yote' });
  ok('B4 MANAGER (bila LIABILITY_MANAGE) -> 403', m403.status === 403, `${m403.status}`);
  const ag = await api('POST', `/api/liabilities/${B.liab}/margin-agreement`, ceo, { amount: AG, documentRef: 'Daftari la madeni uk. 12', note: 'Macheda amekubali kwa maandishi kulipa sehemu ya tofauti' });
  const agRow = sql(`select uid || '|' || amount || '|' || recorded_by || '|' || document_ref from staff_liability_agreement where liability_uid = '${B.liab}'`).split('|');
  const gAg = jl('LIABAGREE:' + agRow[0]);
  ok('B5 makubaliano: Dr 1120 / Cr 4900 = AG; rekodi (nani, kiasi, hati)', ag.j?.status === 'Success' && AG > 0 && eq(gAg['1120'], AG) && eq(gAg['4900'], -AG) && eq(agRow[1], AG) && agRow[2] && agRow[3] === 'Daftari la madeni uk. 12', JSON.stringify({ gAg, agRow }));
  ok('B6 ndoo: agreed = AG, margin = tofauti - AG; API inaonyesha makubaliano', eq(header(B.liab).agreed, AG) && eq(header(B.liab).margin, marginB - AG)
    && ag.j.data.chargedAtCost === true && (ag.j.data.agreements || []).length === 1, JSON.stringify(header(B.liab)));
  const w = await api('POST', `/api/liabilities/${B.liab}/payments`, ceo, { amount: B.charge, paymentType: 'WAIVER_PARTIAL', paymentMethod: 'CASH', notes: 'E2E msamaha' });
  const lw = lastPay(B.liab); const gW = jl('LIABPAY:' + lw[0]);
  ok('B7 msamaha: tofauti nje ya vitabu haina GL; agreed Dr 4900 AG; gharama Dr 5100; Cr 1120 gharama+AG', w.j?.status === 'Success' && eq(gW['5100'], B.cost) && eq(gW['4900'], AG) && eq(gW['1120'], -(B.cost + AG))
    && eq(lw[3], marginB - AG), JSON.stringify({ gW, lw }));
  ok('B8 upotevu (5100) = gharama tu, si bei ya kuuza; 4900 jumla 0 kwa deni hili', eq(acct('5100') - b0.s, B.cost) && eq(acct('4900'), b0.o) && eq(acct('1120'), b0.r), `${acct('5100') - b0.s} ${acct('4900') - b0.o}`);
  ok('B9 SETTLED, TB 0', header(B.liab).status === 'SETTLED' && eq(tb(), tb0), `${header(B.liab).status} ${tb()}`);

  // ── C: a debt raised before V144 keeps the V130 rule ──
  const old = sql("select h.uid from staff_liability h where not h.is_deleted and h.cost_open is null and h.status in ('OPEN','PARTIALLY_PAID') and h.amount - coalesce((select sum(amount) from staff_liability_payment p where p.liability_uid = h.uid and not p.is_deleted), 0) >= 1 order by h.id limit 1");
  if (old) {
    const po = await api('POST', `/api/liabilities/${old}/payments`, ceo, { amount: 1, paymentType: 'CASH', paymentMethod: 'CASH', notes: 'E2E deni la zamani' });
    const lo = lastPay(old); const gO = jl('LIABPAY:' + lo[0]);
    ok('C1 deni la zamani: hakuna mgawanyo (null), Cr 1120 1 kama zamani', po.j?.status === 'Success' && lo[1] === 'null' && eq(gO['1120'], -1) && gO['4900'] === undefined, JSON.stringify({ gO, lo }));
    const agOld = await api('POST', `/api/liabilities/${old}/margin-agreement`, ceo, { amount: 1, documentRef: 'Daftari 1', note: 'Amekubali kulipa tofauti yote' });
    ok('C2 makubaliano kwa deni la zamani -> 400 (tofauti iko 4900 tayari)', agOld.status === 400, `${agOld.status}`);
  } else {
    ok('C1 deni la zamani lipo kwenye nakala', false, 'hakuna deni la zamani lililo wazi');
  }
  ok('C3 TB 0 mwisho', eq(tb(), tb0), `${tb()}`);
  console.log(`MATOKEO ${P}/${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
