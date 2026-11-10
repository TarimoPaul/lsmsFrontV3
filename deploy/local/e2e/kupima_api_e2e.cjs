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

  // ── UHAMISHO (el): Moon Light Kupima is CHANGED (sales history kept): fake pieces -> 0, GL Dr 3900 / Cr 1200,
  //    container at the counted ml WITHOUT taking the parent ──
  const ML = sql("select uid from products where product_name = 'Moon Light Kupima'");
  const MLP = sql("select uid from products where product_name = 'MOON LIGHT'");
  const mlLines0 = sql(`select count(*) from sales_details where product_uid='${ML}'`);
  const mlPieces = Number(sql(`select current_stock from products where uid='${ML}'`));
  const mlParent0 = stock(MLP);
  await api('PUT', `/api/v1/kupima/products/${ML}`, ceo, { containerName: 'chupa', containerMl: 750, parentProductUid: MLP, measures: [{ ml: 50, price: 2000 }] });
  const mig403 = await api('POST', `/api/v1/kupima/products/${ML}/migrate`, mgr, { countedMl: 375, writeOffGl: 18000 });
  ok('M1 uhamisho bila KUPIMA_SETTINGS -> 403', mig403.status === 403, `${mig403.status}`);
  const migBig = await api('POST', `/api/v1/kupima/products/${ML}/migrate`, ceo, { countedMl: 375, writeOffGl: mlPieces * 2000 + 1 });
  ok('M2 GL zaidi ya vipande x avg -> kataa, hakuna kilichobadilika', migBig.status === 422 && Number(sql(`select current_stock from products where uid='${ML}'`)) === mlPieces, `${migBig.status} ${migBig.j?.message}`);
  const t3900 = acct('3900'), t1200 = acct('1200');
  const mig = await api('POST', `/api/v1/kupima/products/${ML}/migrate`, ceo, { countedMl: 375, writeOffGl: 18000, note: 'hesabu ya E2E' });
  ok('M3 uhamisho: vipande -> 0, Dr 3900 / Cr 1200 18,000, chombo 375ml, mzazi HAJAPUNGUZWA', mig.j?.status === 'Success'
    && Number(sql(`select current_stock from products where uid='${ML}'`)) === 0 && bar(ML) === '375.00' && stock(MLP) === mlParent0
    && Math.abs(acct('3900') - t3900 - 18000) < 0.01 && Math.abs(acct('1200') - t1200 + 18000) < 0.01, `${mig.status} ${mig.j?.message} bar=${bar(ML)} parent=${stock(MLP)}/${mlParent0}`);
  ok('M4 historia ya mauzo imebaki (bidhaa ileile, mistari ileile)', sql(`select count(*) from sales_details where product_uid='${ML}'`) === mlLines0);
  await api('POST', `/api/v1/kupima/products/${ML}/finish?note=${encodeURIComponent('imeisha')}`, mgr);
  const mig2 = await api('POST', `/api/v1/kupima/products/${ML}/migrate`, ceo, { countedMl: 100, writeOffGl: 0 });
  ok('M5 uhamisho mara ya pili -> kataa (hata baada ya chombo kufungwa kwa maelezo)', mig2.status === 422 && /umeshafanyika/.test(mig2.j?.message || ''), `${mig2.status} ${mig2.j?.message}`);

  // ── (es)(eu) WINE: many parents (GREPA WINE 5L base prices, MA-LOT own 70ml price); the till chooses the parent ──
  const W = sql("select uid from products where product_name = 'WINE ZA KUPIMA'");
  const G = sql("select uid from products where product_name = 'GREPA WINE'");
  const L = sql("select uid from products where product_name = 'MA-LOT BOX WINE'");
  sql(`update products set current_stock = greatest(current_stock, 3) where uid in ('${G}','${L}')`); // stock to open from (local copy only)
  const gAvg = Number(sql(`select current_average_cost from products where uid='${G}'`));
  const lAvg = Number(sql(`select current_average_cost from products where uid='${L}'`));
  const cfgW = { containerName: 'dumu', containerMl: 5000, parentProductUids: [G, L], measures: [{ ml: 70, price: 2000 }, { ml: 80, price: 3000 }],
    parentPrices: [{ parentProductUid: L, ml: 70, price: 2500 }] };
  const bad = await api('PUT', `/api/v1/kupima/products/${W}`, ceo, { ...cfgW, parentPrices: [{ parentProductUid: PARENT, ml: 70, price: 2500 }] });
  ok('W1 bei ya mzazi asiye kwenye orodha -> 422', bad.status === 422, `${bad.status} ${bad.j?.message}`);
  const sw = await api('PUT', `/api/v1/kupima/products/${W}`, ceo, cfgW);
  const pv = Object.fromEntries((sw.j?.data?.parents || []).map((x) => [x.uid, x]));
  const p70 = (u) => (pv[u]?.prices || []).find((x) => x.ml === 70) || {};
  ok('W2 wazazi 2: GREPA 70ml = msingi 2,000; MA-LOT 70ml = yake 2,500; 80ml = msingi kwa wote', sw.j?.status === 'Success' && Object.keys(pv).length === 2
    && Number(p70(G).price) === 2000 && p70(G).own === false && Number(p70(L).price) === 2500 && p70(L).own === true
    && (pv[L].prices.find((x) => x.ml === 80) || {}).own === false, JSON.stringify(sw.j?.data?.parents || sw.j).slice(0, 400));
  const hW = sql(`select string_agg(field||':'||coalesce(old_value,'-')||'>'||coalesce(new_value,'-'), ';' order by id) from pour_settings_history where product_uid='${W}'`);
  ok('W3 historia: wazazi wote 2 + bei ya MA-LOT (msingi -> 2,500)', /MZAZI:->GREPA WINE/.test(hW) && /MZAZI:->MA-LOT BOX WINE/.test(hW) && /BEI MA-LOT BOX WINE 70ml:msingi>2,500/.test(hW), hW);
  const mw = Object.fromEntries(sw.j.data.measures.map((x) => [x.ml, x.uid]));
  const lineW = (qty, action, parent) => ({ productUid: W, productName: 'WINE ZA KUPIMA', saleType: 'PIECES', pieceQuantity: qty, packageQuantity: qty,
    unitPrice: 0, subTotal: 0, overrideUnitPrice: null, pourMeasureUid: mw[70], pourAction: action ?? null, pourParentUid: parent ?? null });
  const g0 = stock(G), l0 = stock(L);
  const w1 = await sell([lineW(1)]);
  ok('W4 hakuna chombo wazi -> KUPIMA_SHORT yenye wazazi 2', w1.status === 422 && w1.j?.errorCode === 'KUPIMA_SHORT' && (w1.j?.data?.parents || []).length === 2, `${w1.status} ${w1.j?.errorCode}`);
  const w2 = await sell([lineW(1, 'SPLIT')]);
  ok('W5 kufungua bila kuchagua mzazi (wazazi 2) -> 422 KUPIMA_PARENT, hakuna stock iliyoguswa', w2.status === 422 && w2.j?.errorCode === 'KUPIMA_PARENT'
    && (w2.j?.data?.parents || []).length === 2 && stock(G) === g0 && stock(L) === l0 && bar(W) === '-1', `${w2.status} ${w2.j?.errorCode} ${w2.j?.message}`);
  const w3 = await sell([lineW(1, 'SPLIT', PARENT)]);
  ok('W6 mzazi asiyeruhusiwa -> 422', w3.status === 422 && stock(PARENT) >= 0 && bar(W) === '-1', `${w3.status} ${w3.j?.message}`);
  const w4 = await sell([lineW(1, 'SPLIT', L)]);
  const dW4 = sql(`select round(sub_total)||'|'||round(total_cost,2) from sales_details where sale_uid='${w4.j?.data?.sale?.uid}'`).split('|');
  const cW4 = sql(`select parent_product_uid from pour_container where product_uid='${W}' and status='OPEN'`);
  ok('W7 MA-LOT imechaguliwa: MA-LOT -1 (GREPA haijaguswa), chombo kinakumbuka MA-LOT, bei 2,500 (yake), gharama = avg MA-LOT / 5000 x 70',
    w4.status === 200 && stock(L) === l0 - 1 && stock(G) === g0 && cW4 === L && Number(dW4[0]) === 2500 && Math.abs(Number(dW4[1]) - lAvg / 5000 * 70) < 0.02,
    `${w4.status} ${w4.j?.message} ${dW4} parent=${cW4}`);
  const vw = await api('GET', `/api/v1/kupima/products/${W}`, mgr);
  const v70 = (vw.j?.data?.measures || []).find((x) => x.ml === 70) || {};
  ok('W8 POS inaonyesha bei za chombo kilicho wazi: 70ml = 2,500 (msingi 2,000), chombo = MA-LOT', Number(v70.price) === 2500 && Number(v70.basePrice) === 2000
    && vw.j?.data?.open?.parentName === 'MA-LOT BOX WINE', JSON.stringify({ v70, open: vw.j?.data?.open }).slice(0, 300));
  await api('POST', `/api/v1/kupima/products/${W}/finish?note=${encodeURIComponent('E2E es')}`, mgr);
  const opNo = await api('POST', `/api/v1/kupima/products/${W}/open`, mgr, {});
  ok('W9 "Fungua chombo" kwa mkono bila mzazi (wazazi 2) -> 422 KUPIMA_PARENT', opNo.status === 422 && opNo.j?.errorCode === 'KUPIMA_PARENT', `${opNo.status} ${opNo.j?.errorCode}`);
  const opG = await api('POST', `/api/v1/kupima/products/${W}/open`, mgr, { parentProductUid: G });
  const w5 = await sell([lineW(1)]);
  const dW5 = sql(`select round(sub_total)||'|'||round(total_cost,2) from sales_details where sale_uid='${w5.j?.data?.sale?.uid}'`).split('|');
  ok('W10 GREPA imefunguliwa kwa mkono: GREPA -1, bei 2,000 (msingi), gharama = avg GREPA / 5000 x 70', opG.j?.status === 'Success' && stock(G) === g0 - 1
    && Number(dW5[0]) === 2000 && Math.abs(Number(dW5[1]) - gAvg / 5000 * 70) < 0.02, `${opG.j?.message} ${dW5}`);
  const repW = await api('GET', `/api/v1/kupima/containers?productUid=${W}`, mgr);
  const byParent = Object.fromEntries((repW.j?.data || []).map((c) => [c.parent_name, Number(c.revenue)]));
  ok('W11 faida ya chombo: kila chombo kina mzazi wake na mapato yake (MA-LOT 2,500, GREPA 2,000)', byParent['MA-LOT BOX WINE'] === 2500 && byParent['GREPA WINE'] === 2000, JSON.stringify(byParent));
  const sw2 = await api('PUT', `/api/v1/kupima/products/${W}`, ceo, { ...cfgW, parentPrices: [{ parentProductUid: L, ml: 70, price: 2800 }] });
  const w6 = await sell([lineW(1)]);
  ok('W12 bei ya MA-LOT 2,500 -> 2,800: historia ipo; chombo cha GREPA kilicho wazi bado 2,000 (bei ni ya mzazi wa chombo)', sw2.j?.status === 'Success'
    && /BEI MA-LOT BOX WINE 70ml:2,500>2,800/.test(sql(`select string_agg(field||':'||coalesce(old_value,'-')||'>'||coalesce(new_value,'-'), ';' order by id) from pour_settings_history where product_uid='${W}'`))
    && Number(sql(`select round(sub_total) from sales_details where sale_uid='${w6.j?.data?.sale?.uid}'`)) === 2000, `${sw2.j?.message}`);

  await new Promise((r) => setTimeout(r, 2000));
  ok('Z1 TB haijabadilika (Dr = Cr)', tb() === tb0, `${tb0} -> ${tb()}`);
  const rep = await api('GET', `/api/v1/kupima/containers?productUid=${K}`, mgr);
  ok('Z2 ripoti ya vyombo: 4, upotevu wa vilivyoisha unaonekana', rep.j?.status === 'Success' && rep.j.data.length === 4, JSON.stringify((rep.j?.data || []).map((c) => [c.status, c.close_kind, c.ml_lost])));
  console.log(`MWISHO PASS ${P} FAIL ${F}`);
  process.exit(F ? 1 : 0);
})().catch((e) => { console.log('FAIL exception', e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : e); process.exit(1); });
