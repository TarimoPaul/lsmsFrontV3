// KUPIMA backend on the REAL schema (PG15, prod dump 29/10 + V143) through the API (owner ef/ei/ej/ek):
//   settings: 403 without KUPIMA_SETTINGS, saved by CEO with history, warning for a measure under its cost
//   pour: no open container -> 422 KUPIMA_SHORT; open (parent -1); bar down; cost = avg/750 x ml in the sale's COGS
//   short (ek): (i) SPLIT -> old container to 0, NO loss, rest from a new one; (ii) FINISHED -> loss Dr 5100 / Cr 1200
//   delete a poured sale: container open -> ml back on the bar; closed -> that container's loss (Dr 5100 / Cr 1200)
//   custom price refused; one open container; manual finish; level check; below-cost measure -> kazi 3 reason; TB 0
// Throw-away local copy only. Run: node kupima_api_e2e.cjs
const { execFileSync } = require('child_process');

const API = 'http://127.0.0.1:18090';
const CEO = 'tarimo@gmail.com';
const MGR = 'macheda@gmail.com';
const PW = 'Kupima-Jaribio-Local-2026';
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
const pad = (n) => String(n).padStart(2, '0');
const nowLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
const tb = () => sql("select round(sum(l.debit_amount - l.credit_amount), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false)");
const acct = (code) => Number(sql(`select coalesce(round(sum(l.debit_amount - l.credit_amount), 2), 0) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid where j.status = 'POSTED' and not coalesce(j.is_deleted,false) and l.account_code = '${code}'`));
const bar = (p) => sql(`select coalesce((select ml_left from pour_container where product_uid = '${p}' and status = 'OPEN'), -1)`);
const stock = (p) => Number(sql(`select current_stock from products where uid = '${p}'`));

(async () => {
  const hash = execFileSync('python', ['-c', "import bcrypt,sys; print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10, prefix=b'2a')).decode())", PW], { encoding: 'utf8' }).trim();
  sql(`update users set password='${hash}', status='ACTIVE', is_locked=false where email in ('${CEO}','${MGR}')`);
  sql('update gl_config set posting_enabled = true');
  const ceo = await login(CEO); const mgr = await login(MGR);
  const mgrUid = sql(`select uid from users where email='${MGR}'`);
  const K = sql("select uid from products where product_name = 'KONYAGI YA KUPIMA'");
  const PARENT = sql("select uid from products where product_name = 'KONYAGI 750ML'");
  const avg = Number(sql(`select current_average_cost from products where uid='${PARENT}'`));
  const cpm = avg / 750;
  const tb0 = tb();

  // ── settings ──
  const cfg = { containerName: 'chupa', containerMl: 750, parentProductUid: PARENT, measures: [{ ml: 30, price: 1000 }, { ml: 60, price: 2000 }, { ml: 10, price: 100 }] };
  const m403 = await api('PUT', `/api/v1/kupima/products/${K}`, mgr, cfg);
  ok('S1 MANAGER bila KUPIMA_SETTINGS -> 403', m403.status === 403, `${m403.status}`);
  const s1 = await api('PUT', `/api/v1/kupima/products/${K}`, ceo, cfg);
  ok('S2 CEO anahifadhi: chupa 750ml, mzazi KONYAGI 750ML, vipimo 10/30/60', s1.j?.status === 'Success' && s1.j.data.measures.length === 3, JSON.stringify(s1.j).slice(0, 200));
  ok('S3 onyo: 10ml bei 100 < gharama (avg/750 x 10)', (s1.j?.warnings || []).some((w) => /10ml/.test(w)) && !(s1.j?.warnings || []).some((w) => /30ml/.test(w)), JSON.stringify(s1.j?.warnings));
  const m = Object.fromEntries(s1.j.data.measures.map((x) => [x.ml, x.uid]));
  ok('S4 historia: AINA, CHOMBO, MZAZI, vipimo 3', Number(sql(`select count(*) from pour_settings_history where product_uid='${K}'`)) === 6);

  const line = (measure, qty, action, extra = {}) => ({ productUid: K, productName: 'KONYAGI YA KUPIMA', saleType: 'PIECES', pieceQuantity: qty, packageQuantity: qty,
    unitPrice: 0, subTotal: 0, overrideUnitPrice: null, pourMeasureUid: measure, pourAction: action ?? null, ...extra });
  const sell = (lines, extra = {}) => api('POST', '/api/v1/sales/partial', mgr, { saleDate: nowLocal(), customerUid: null, userUid: mgrUid, discountAmount: 0, saleNotes: 'E2E-KUPIMA',
    saleDetails: lines, payments: [{ customerName: 'Walk-in Customer', paymentMethod: 'CASH', totalAmount: 100000, amountPaid: 100000, paymentDate: nowLocal() }], ...extra });

  // ── first pour: no container ──
  const p0 = stock(PARENT);
  const r1 = await sell([line(m[30], 1)]);
  ok('P1 hakuna chombo wazi -> 422 KUPIMA_SHORT (hasOpen=false), hakuna sale', r1.status === 422 && r1.j?.errorCode === 'KUPIMA_SHORT' && r1.j?.data?.hasOpen === false, `${r1.status} ${r1.j?.errorCode} ${r1.j?.message}`);
  const r2 = await sell([line(m[30], 1, 'SPLIT')]);
  const s2 = r2.j?.data?.sale;
  ok('P2 kwa jibu -> chombo kipya: mzazi -1, bar 720', r2.status === 200 && !!s2 && stock(PARENT) === p0 - 1 && bar(K) === '720.00', `${r2.status} ${r2.j?.message} bar=${bar(K)} parent=${stock(PARENT)}`);
  const d2 = sql(`select round(total_cost,2)||'|'||round(sub_total)||'|'||pour_ml from sales_details where sale_uid='${s2.uid}'`).split('|');
  ok('P3 mstari: bei 1,000 (iliyosajiliwa), gharama = avg/750 x 30, pour_ml 30', Number(d2[1]) === 1000 && Math.abs(Number(d2[0]) - cpm * 30) < 0.02 && d2[2] === '30', d2.join('|'));
  ok('P4 hakuna movement ya stock kwa bidhaa ya kupima yenyewe', sql(`select count(*) from store where reference like 'SALE-${s2.receiptNumber}%' and products_uid='${K}'`) === '0');
  // the sale journal is posted after commit: wait for it
  let cogs = '';
  for (let i = 0; i < 20 && !cogs; i++) { await new Promise((r) => setTimeout(r, 500)); cogs = sql(`select coalesce(string_agg(l.account_code||':'||round(l.debit_amount-l.credit_amount,2), ',' order by l.account_code), '') from journal_entry j join journal_entry_line l on l.journal_entry_uid=j.uid where j.reference_uid='${s2.uid}' and l.account_code in ('5000','1200')`); }
  ok('P5 GL ya sale: Dr 5000 / Cr 1200 = gharama ya kipimo', cogs === `1200:${(-cpm * 30).toFixed(2)},5000:${(cpm * 30).toFixed(2)}`, cogs);

  const r3 = await sell([line(m[30], 1, null, { overrideUnitPrice: 500 })]);
  ok('P6 bei ya kubadilishwa -> 422 KUPIMA_INVALID', r3.status === 422 && r3.j?.errorCode === 'KUPIMA_INVALID', `${r3.status} ${r3.j?.message}`);
  const o2 = await api('POST', `/api/v1/kupima/products/${K}/open`, mgr);
  ok('P7 kufungua kwa mkono wakati kuna chombo wazi -> kataa (chombo kimoja)', o2.status === 422 && /chombo kimoja/.test(o2.j?.message || ''), `${o2.status} ${o2.j?.message}`);

  // ── (i) SPLIT: 720 -> sell 60 x 11 = 660 -> 60 left; 60 x 2 = 120 -> short ──
  await sell([line(m[60], 11)]);
  ok('P8 bar 60 baada ya 60 x 11', bar(K) === '60.00', bar(K));
  const r4 = await sell([line(m[60], 2)]);
  ok('P9 haitoshi (60 < 120) -> 422 KUPIMA_SHORT, mlLeft 60, hakuna kilichobadilika', r4.status === 422 && Number(r4.j?.data?.mlLeft) === 60 && bar(K) === '60.00', `${r4.status} ${JSON.stringify(r4.j?.data)}`);
  const c1 = sql(`select uid from pour_container where product_uid='${K}' and status='OPEN'`);
  const p1 = stock(PARENT);
  const r5 = await sell([line(m[60], 2, 'SPLIT')]);
  const c1row = sql(`select status||'|'||close_kind||'|'||ml_lost||'|'||loss_cost from pour_container where uid='${c1}'`);
  ok('P10 (i) SPLIT: chombo cha zamani CLOSED SPLIT, upotevu 0; kipya: bar 750 - 60 = 690; mzazi -1', r5.status === 200 && c1row === 'CLOSED|SPLIT|0.00|0.00' && bar(K) === '690.00' && stock(PARENT) === p1 - 1, `${r5.status} ${r5.j?.message} ${c1row} bar=${bar(K)}`);
  const split = sql(`select string_agg(round(u.ml)::text, '+' order by u.id) from pour_use u join sales_details d on d.uid=u.sale_detail_uid where d.sale_uid='${r5.j?.data?.sale?.uid}'`);
  ok('P11 kipimo kimegawanywa: 60ml kutoka chombo cha zamani + 60ml kutoka kipya', split === '60+60', split);
  ok('P12 hakuna journal ya upotevu kwa SPLIT', sql(`select count(*) from journal_entry where reference_uid='${c1}'`) === '0');

  // ── (ii) FINISHED: 690 -> 60 x 11 = 660 -> 30 left; 60 -> short ──
  await sell([line(m[60], 11)]);
  const c2 = sql(`select uid from pour_container where product_uid='${K}' and status='OPEN'`);
  const l5100 = acct('5100');
  const r6 = await sell([line(m[60], 1, 'FINISHED')]);
  const c2row = sql(`select status||'|'||close_kind||'|'||ml_lost from pour_container where uid='${c2}'`);
  const lossJ = sql(`select string_agg(l.account_code||':'||round(l.debit_amount-l.credit_amount,2), ',' order by l.account_code) from journal_entry j join journal_entry_line l on l.journal_entry_uid=j.uid where j.reference_uid='${c2}'`);
  ok('P13 (ii) FINISHED: 30ml upotevu, Dr 5100 / Cr 1200 kwa gharama; kipya bar 690', r6.status === 200 && c2row === 'CLOSED|FINISHED|30.00' && lossJ === `1200:${(-cpm * 30).toFixed(2)},5100:${(cpm * 30).toFixed(2)}` && bar(K) === '690.00' && Math.abs(acct('5100') - l5100 - cpm * 30) < 0.02, `${c2row} ${lossJ} bar=${bar(K)}`);

  // ── give back ──
  const lastUid = r6.j.data.sale.uid;
  const del1 = await api('DELETE', `/api/v1/sales/${lastUid}?deleteReason=${encodeURIComponent('Jaribio la kupima E2E - kosa la kuingiza')}`, mgr);
  ok('R1 kufuta sale (chombo wazi): ml 60 zinarudi kwenye bar (690 -> 750)', del1.j?.status === 'Success' && bar(K) === '750.00', `${del1.status} ${del1.j?.message} bar=${bar(K)}`);
  const firstDetail = sql(`select uid from sales_details where sale_uid='${s2.uid}'`);
  const l5100b = acct('5100');
  const del2 = await api('DELETE', `/api/v1/sales/${s2.uid}?deleteReason=${encodeURIComponent('Jaribio la kupima E2E - chombo kimefungwa')}`, mgr);
  const lr = sql(`select kind||'|'||round(ml)||'|'||round(cost,2) from pour_use where sale_detail_uid='${firstDetail}' and kind <> 'SALE'`);
  ok('R2 kufuta sale ya chombo kilichofungwa: LOSS_RETURN 30ml + Dr 5100 / Cr 1200 (si kwenye bar)', del2.j?.status === 'Success' && lr === `LOSS_RETURN|30|${(cpm * 30).toFixed(2)}` && Math.abs(acct('5100') - l5100b - cpm * 30) < 0.02 && bar(K) === '750.00', `${del2.status} ${del2.j?.message} ${lr}`);

  // ── manual finish, level check, open ──
  const chk = await api('POST', `/api/v1/kupima/products/${K}/check?level=${encodeURIComponent('3/4')}`, mgr);
  ok('C1 kiwango 3/4 dhidi ya bar 750: tofauti -187.5ml (imehifadhiwa, hakuna GL)', chk.j?.status === 'Success' && Number(chk.j.data.differenceMl) === -187.5, JSON.stringify(chk.j?.data));
  const fin = await api('POST', `/api/v1/kupima/products/${K}/finish?note=${encodeURIComponent('chupa imevunjika')}`, mgr);
  ok('C2 "chombo kimeisha" kwa mkono: hakuna chombo wazi, upotevu 750ml', fin.j?.status === 'Success' && bar(K) === '-1' && sql(`select ml_lost from pour_container where product_uid='${K}' order by id desc limit 1`) === '750.00', `${fin.j?.message}`);
  const op = await api('POST', `/api/v1/kupima/products/${K}/open`, mgr);
  ok('C3 kufungua kwa mkono (hakuna wazi) -> bar 750', op.j?.status === 'Success' && bar(K) === '750.00', op.j?.message);

  // ── below cost measure -> kazi 3 ──
  const r7 = await sell([line(m[10], 1)]);
  ok('B1 kipimo chini ya gharama bila sababu -> 422 BELOW_COST_REASON, bar haijaguswa', r7.status === 422 && r7.j?.errorCode === 'BELOW_COST_REASON' && bar(K) === '750.00', `${r7.status} ${r7.j?.errorCode} bar=${bar(K)}`);
  const r8 = await sell([line(m[10], 1)], { belowCostReason: 'Kipimo cha kuonja kwa mteja mpya E2E' });
  ok('B2 kwa sababu -> inauzwa, BELOW_COST kwenye Kagua', r8.status === 200 && sql(`select count(*) from sale_change_audit where action='BELOW_COST' and sale_uid='${r8.j?.data?.sale?.uid}'`) === '1', `${r8.status} ${r8.j?.message}`);

  // ── settings change: history, future only ──
  const s3 = await api('PUT', `/api/v1/kupima/products/${K}`, ceo, { ...cfg, measures: [{ ml: 30, price: 1200 }, { ml: 60, price: 2000 }] });
  const h = sql(`select string_agg(field||':'||coalesce(old_value,'-')||'>'||coalesce(new_value,'-'), ';' order by id) from pour_settings_history where product_uid='${K}' and id > (select max(id) - 2 from pour_settings_history where product_uid='${K}')`);
  ok('H1 bei 30ml 1,000 -> 1,200 na 10ml kimeondolewa: historia ina zamani -> mpya', s3.j?.status === 'Success' && /KIPIMO 30ml:1,000>1,200/.test(h) && /KIPIMO 10ml:100>kimeondolewa/.test(h), h);
  const old30 = await sell([line(m[30], 1)]);
  ok('H2 kipimo cha zamani (kimebadilishwa) -> 422 KUPIMA_INVALID', old30.status === 422 && old30.j?.errorCode === 'KUPIMA_INVALID', `${old30.status} ${old30.j?.message}`);

  await new Promise((r) => setTimeout(r, 2000));
  ok('Z1 TB haijabadilika (Dr = Cr)', tb() === tb0, `${tb0} -> ${tb()}`);
  const rep = await api('GET', `/api/v1/kupima/containers?productUid=${K}`, mgr);
  ok('Z2 ripoti ya vyombo: 4, upotevu wa vilivyoisha unaonekana', rep.j?.status === 'Success' && rep.j.data.length === 4, JSON.stringify((rep.j?.data || []).map((c) => [c.status, c.close_kind, c.ml_lost])));
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
