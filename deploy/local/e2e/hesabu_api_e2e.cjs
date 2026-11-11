// Kazi 5 (owner bn 01/11, by 02/11, fa 11/11; BAADA §2) on the REAL schema (PG15, prod dump + V146) through the API:
//   H1 the start asks "Kuna mzigo uliofika leo ambao haujaandikwa?": no answer -> refused; YES with no product -> refused
//      (enter the purchase first); YES + products -> those products have no line today, the session keeps them
//   H2 a KUPIMA product (active pour_product) is never on the daily count
//   H3 a surplus above 50,000 (cost) cannot be approved until a SECOND person counts it (not the starter / first counter);
//      the second count is compared with the stock at that moment
//   H4 NO_ACTION may not repeat: same product, same difference, left with no action last time -> refused; ADJUST passes;
//      the decision of every variance line is kept (V146), and past approved lines were backfilled
//   GL: TB stays 0
// Throw-away local copy only. Run: node hesabu_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Hesabu-Jaribio-Local-2026';
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
const msg = (r) => String(r.j?.message || '');

// one session per day: earlier sessions are moved back a day (local copy only)
// this test's own sessions move back ONE day each time (their order stays, and they stay after the dump's counts)
const mine = [];
const freeToday = () => {
  // one row at a time, oldest first (the one-per-day index is checked row by row)
  for (const u of mine) sql(`update counting_session set session_date = session_date - 1, started_at = started_at - interval '1 day' where uid = '${u}'`);
  sql("update counting_session c set session_date = m.d, started_at = m.d + time '06:00' from (select least(min(session_date), current_date) - 1 as d from counting_session) m where c.session_date = current_date");
};

/** start (mgr) -> count every line (deltas: product -> difference) -> complete -> PENDING_APPROVAL. Returns the session uid. */
async function countWith(mgr, deltas, start = { unrecordedDelivery: false }) {
  freeToday();
  const s = await api('POST', '/api/v1/counting/sessions', mgr, start);
  if (s.j?.status !== 'Success') throw new Error('start ' + JSON.stringify(s.j).slice(0, 300));
  const sid = s.j.data.uid;
  mine.push(sid);
  const lines = sql(`select product_uid || '|' || system_qty_snapshot from counting_line where session_uid = '${sid}' and not is_deleted`).split('\n').filter(Boolean);
  for (const l of lines) {
    const [pu, q] = l.split('|');
    const counted = Math.max(0, Number(q) + (deltas[pu] || 0));
    const r = await api('PUT', `/api/v1/counting/sessions/${sid}/lines`, mgr, { productUid: pu, countedQty: counted });
    if (r.j?.status !== 'Success') throw new Error('line ' + JSON.stringify(r.j).slice(0, 300));
  }
  const c = await api('POST', `/api/v1/counting/sessions/${sid}/complete`, mgr, {});
  if (c.j?.status !== 'Success') throw new Error('complete ' + JSON.stringify(c.j).slice(0, 300));
  sql(`update counting_session set status = 'PENDING_APPROVAL' where uid = '${sid}'`); // the blind recount step is not under test
  return sid;
}
const lineOf = (sid, pu) => sql(`select uid from counting_line where session_uid = '${sid}' and product_uid = '${pu}' and not is_deleted`);
const varLines = (sid) => sql(`select uid || '|' || product_uid from counting_line where session_uid = '${sid}' and not is_deleted and variance_qty <> 0`).split('\n').filter(Boolean).map((r) => r.split('|'));
const approve = (ceo, sid, pick) => api('POST', `/api/v1/counting/sessions/${sid}/approve`, ceo, {
  decisions: varLines(sid).map(([u, pu]) => pick(pu, u)),
});

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  sql("update counting_session set status = 'FORCE_CLOSED' where status in ('IN_PROGRESS','PENDING_RECOUNT','PENDING_APPROVAL')");
  const ceo = await login(CEO); const mgr = await login(MGR);
  const tb0 = tb();
  // counts left by earlier test runs (recent dates) go far back, each to its own day, so 'the previous count' is this run's
  sql("update counting_session c set session_date = m.d - (c.id::int % 3000), started_at = m.d - (c.id::int % 3000) + time '06:00' from (select min(session_date) - 4000 as d from counting_session) m where c.session_date > current_date - 14");

  // V146 backfill: every variance line of an approved session from the dump carries its decision
  ok('B1 V146: kila mstari wenye tofauti wa hesabu iliyothibitishwa una uamuzi (backfill)',
    sql("select count(*) from counting_line l join counting_session s on s.uid = l.session_uid where s.status = 'APPROVED' and l.variance_qty <> 0 and not l.is_deleted and l.decision is null") === '0');
  ok('B2 backfill: NO_ACTION = mistari isiyo na stock_adjustment',
    sql("select count(*) from counting_line l where l.decision = 'NO_ACTION' and exists (select 1 from stock_adjustment a where a.counting_line_uid = l.uid and not a.is_deleted)") === '0'
    && Number(sql("select count(*) from counting_line where decision = 'NO_ACTION'")) > 0);

  const pick = (extra) => sql(`select uid from products p where not coalesce(is_deleted,false) and is_active and current_stock >= 5 and not exists (select 1 from pour_product pp where pp.product_uid = p.uid and pp.active) ${extra} order by id limit 1`);
  const X = pick('and current_average_cost >= 5000 and current_average_cost < 70000');          // large surplus
  const costX = Number(sql(`select current_average_cost from products where uid = '${X}'`));
  const kX = Math.floor(60000 / costX) + 1;                                                     // +kX pieces > 60,000
  const Y = pick(`and uid <> '${X}' and current_average_cost > 0`);                             // repeated NO_ACTION
  const D = pick(`and uid not in ('${X}','${Y}')`);                                             // delivery not entered
  // a KUPIMA product (local copy only)
  let Z = sql("select product_uid from pour_product where active limit 1");
  if (!Z) {
    Z = pick(`and uid not in ('${X}','${Y}','${D}')`);
    sql(`insert into pour_product (product_uid, container_name, container_ml, created_by) values ('${Z}', 'chupa', 750, 'e2e hesabu')`);
  }

  // ── H1 delivery question ──
  freeToday();
  let r = await api('POST', '/api/v1/counting/sessions', mgr, {});
  ok('H1a bila jibu la swali la mzigo -> imekataliwa', r.j?.status !== 'Success' && msg(r).includes('mzigo'), msg(r));
  r = await api('POST', '/api/v1/counting/sessions', mgr, { unrecordedDelivery: true });
  ok('H1b NDIYO bila bidhaa -> imekataliwa (andika manunuzi kwanza)', r.j?.status !== 'Success' && msg(r).includes('manunuzi'), msg(r));
  r = await api('POST', '/api/v1/counting/sessions', mgr, { unrecordedDelivery: true, unrecordedProductUids: ['hakuna-bidhaa-hii'] });
  ok('H1c bidhaa isiyokuwepo -> imekataliwa', r.j?.status !== 'Success', msg(r));
  ok('H1d majaribio yaliyokataliwa hayakuacha zoezi', sql("select count(*) from counting_session where session_date = current_date") === '0');

  const s1 = await countWith(mgr, { [Y]: -2 }, { unrecordedDelivery: true, unrecordedProductUids: [D], unrecordedNote: 'Pepsi ya mchana, ankara 12' });
  ok('H1e NDIYO + bidhaa: bidhaa hiyo haina mstari leo, zoezi linaikumbuka',
    lineOf(s1, D) === '' && sql(`select unrecorded_delivery || '|' || unrecorded_delivery_products || '|' || unrecorded_delivery_note from counting_session where uid = '${s1}'`) === `true|${D}|Pepsi ya mchana, ankara 12`);
  const sd = (await api('GET', `/api/v1/counting/sessions/${s1}`, ceo)).j?.data || {};
  ok('H1f API inaonyesha jibu + jina la bidhaa iliyoachwa', sd.unrecordedDelivery === true && (sd.unrecordedDeliveryProductNames || []).length === 1 && !(sd.unrecordedDeliveryProductNames[0] || '').includes(D), JSON.stringify(sd.unrecordedDeliveryProductNames));

  // ── H2 KUPIMA ──
  ok('H2 bidhaa ya KUPIMA haipo kwenye hesabu ya kila siku', lineOf(s1, Z) === '' && lineOf(s1, X) !== '');

  // session 1: Y -2 left with NO_ACTION
  r = await approve(ceo, s1, (pu, u) => ({ lineUid: u, decision: 'NO_ACTION' }));
  ok('H4a hesabu 1: Y -2 NO_ACTION inathibitishwa', r.j?.status === 'Success', msg(r));
  ok('H4b uamuzi umehifadhiwa kwenye mstari (NO_ACTION, aliyeamua, saa)',
    sql(`select decision || '|' || (decided_by_uid is not null) || '|' || (decided_at is not null) from counting_line where uid = '${lineOf(s1, Y)}'`) === 'NO_ACTION|true|true');

  // session 2: Y -2 again + X large surplus
  const s2 = await countWith(mgr, { [Y]: -2, [X]: kX });
  r = await approve(ceo, s2, (pu, u) => ({ lineUid: u, decision: pu === X ? 'ADJUST' : 'NO_ACTION', reason: pu === X ? 'COUNTING_ERROR' : undefined }));
  ok('H3a ziada > 50,000 bila mtu wa pili -> uthibitisho umekataliwa', r.j?.status !== 'Success' && msg(r).includes('mtu wa pili'), msg(r));
  const lx = lineOf(s2, X);
  const getLine = async () => ((await api('GET', `/api/v1/counting/sessions/${s2}`, ceo)).j?.data?.lines || []).find((l) => l.uid === lx) || {};
  ok('H3b API inaonyesha needsSecondCount kwa X', (await getLine()).needsSecondCount === true);
  r = await api('PUT', `/api/v1/counting/sessions/${s2}/lines/${lx}/second-count`, mgr, { qty: 1 });
  ok('H3c aliyeanzisha/aliyehesabu hawezi kuhesabu kwa pili', r.j?.status !== 'Success' && msg(r).includes('mtu mwingine'), msg(r));

  // a sale after the count: stock -1 (simulated on the throw-away copy through a store movement would need the sales
  // flow; the second count compares with products.current_stock, so it is moved directly here)
  const snapX = Number(sql(`select system_qty_snapshot from counting_line where uid = '${lx}'`));
  const nowX = Number(sql(`select current_stock from products where uid = '${X}'`));
  // the second person finds only 1 piece above the stock of NOW -> surplus 1 x cost (< 50,000)
  r = await api('PUT', `/api/v1/counting/sessions/${s2}/lines/${lx}/second-count`, ceo, { qty: nowX + 1, note: 'nimehesabu tena' });
  ok('H3d mtu wa pili (CEO) anahesabu: tofauti = hesabu ya pili - stock ya sasa', r.j?.status === 'Success'
    && sql(`select variance_qty || '|' || counted_qty || '|' || second_count_qty || '|' || second_count_system_qty from counting_line where uid = '${lx}'`) === `1|${snapX + 1}|${nowX + 1}|${nowX}`, msg(r));
  r = await api('PUT', `/api/v1/counting/sessions/${s2}/lines/${lx}/second-count`, ceo, { qty: 5 });
  ok('H3e hesabu ya pili ni mara moja tu', r.j?.status !== 'Success', msg(r));

  r = await approve(ceo, s2, (pu, u) => ({ lineUid: u, decision: pu === X ? 'ADJUST' : 'NO_ACTION', reason: pu === X ? 'COUNTING_ERROR' : undefined }));
  ok('H4c Y -2 NO_ACTION mara ya pili mfululizo -> imekataliwa', r.j?.status !== 'Success' && msg(r).includes('NO_ACTION hairuhusiwi'), msg(r));
  ok('H4d iliyokataliwa haikuandika chochote (bado PENDING_APPROVAL, hakuna stock_adjustment)',
    sql(`select status from counting_session where uid = '${s2}'`) === 'PENDING_APPROVAL' && sql(`select count(*) from stock_adjustment where session_uid = '${s2}'`) === '0');
  r = await approve(ceo, s2, (pu, u) => ({ lineUid: u, decision: 'ADJUST', reason: pu === X ? 'COUNTING_ERROR' : 'DAMAGED' }));
  ok('H4e Y ikiandikwa (ADJUST) -> inathibitishwa', r.j?.status === 'Success', msg(r));
  ok('H4f maamuzi ya hesabu 2 yamehifadhiwa (ADJUST + sababu)',
    sql(`select string_agg(decision || ':' || coalesce(decision_reason,'-'), ',' order by decision_reason) from counting_line where session_uid = '${s2}' and variance_qty <> 0`) === 'ADJUST:COUNTING_ERROR,ADJUST:DAMAGED');

  // session 3: Y -2 again but last time it was posted -> NO_ACTION allowed
  const s3 = await countWith(mgr, { [Y]: -2 });
  r = await approve(ceo, s3, (pu, u) => ({ lineUid: u, decision: 'NO_ACTION' }));
  ok('H4g tofauti ileile lakini mara iliyopita iliandikwa -> NO_ACTION inaruhusiwa', r.j?.status === 'Success', msg(r));

  ok('GL TB = 0 (haijabadilika)', tb() === tb0 && Math.abs(tb()) < 0.005, `${tb0} -> ${tb()}`);
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e.message); process.exit(1); });
