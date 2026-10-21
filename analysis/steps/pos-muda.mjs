// HATUA 36b / 38d - muda wa jibu la POS (POST /api/v1/sales/partial) kwenye STAGING TU, kupitia tunnel localhost:8081.
// INAANDIKA KWENYE STAGING: sales 2 za kupasha moto + 10 za cash + 10 za deni la nusu, sale_notes "QA-MUDA <lebo> ...",
// bidhaa 1 kipande kimoja kila moja (stock ya staging inapungua vipande 22). Production HAIGUSWI.
// Password inatoka ROOT_PASS (set /p kwenye .cmd) na haiandikwi popote.
// Bidhaa na mteja: analysis\steps\36-h2-data.txt (mistari H2DATA| na H2CUST| ya 36-h2-kabla.sql).
//
// Kwa nini: 2.2.70 inapost journal ya sale kwenye thread nyingine (jibu halisubiri GL); 2.2.71 inapost baada ya commit
// kwenye thread ileile ya ombi (H-2), kwa hiyo muda wa GL unaingia kwenye jibu la POS. Tunapima tofauti.
//   node analysis\steps\pos-muda.mjs kabla|baada
// Matokeo: mstari kwa kila sale + MUHTASARI (min / wastani / median / p90 / max, ms) na analysis\steps\pos-muda-<lebo>.json
import fs from 'node:fs';

const API = process.env.API || 'http://localhost:8081';
const LABEL = (process.argv[2] || '').toLowerCase();
if (!['kabla', 'baada'].includes(LABEL)) { console.log('Tumia: node pos-muda.mjs kabla|baada'); process.exit(1); }
const N = 10, WARMUP = 2;

const lines = fs.readFileSync('analysis/steps/36-h2-data.txt', 'utf8').split(/\r?\n/);
const d = lines.find((l) => l.startsWith('H2DATA|'))?.split('|');
const c = lines.find((l) => l.startsWith('H2CUST|'))?.split('|');
if (!d || !c) { console.log('DATA_HAIPO: 36-h2-data.txt haina H2DATA/H2CUST'); process.exit(1); }
const [, productUid, productName, price, cost, ppp] = d;
const customerUid = c[1];
const unit = Number(price), unitCost = Number(cost);

const p2 = (n) => String(n).padStart(2, '0');
const now = () => { const t = new Date(); return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}T${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`; };

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

// tunnel tu (bila backend kazi): muda wa ombi dogo, ili tofauti ya mtandao ionekane
const pingMs = [];
for (let i = 0; i < 5; i++) {
  const t0 = performance.now();
  await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  pingMs.push(performance.now() - t0);
}

async function sale(kind, i) {
  const paidShare = kind === 'deni' ? 0.5 : 1.0;
  const total = unit, paid = Math.round(total * paidShare), date = now();
  const body = {
    saleDate: date, customerUid, customerName: null, customerPhoneNumber: null, userUid, userName: 'QA MUDA',
    discountAmount: 0, saleNotes: `QA-MUDA ${LABEL} ${kind} ${i}`,
    saleDetails: [{ productUid, productName, productCategory: null, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1,
      unitPrice: unit, subTotal: total, overrideUnitPrice: null, costPerPiece: unitCost, piecesPerPackage: Number(ppp) || null, packageAbbreviation: null }],
    payments: [{ customerUid, customerName: 'QA-MUDA', paymentMethod: 'CASH', totalAmount: total, amountPaid: paid, paymentDate: date,
      paymentNotes: paid < total ? `QA-MUDA deni ${total - paid}` : null }],
  };
  const t0 = performance.now();
  const res = await fetch(`${API}/api/v1/sales/partial`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const text = await res.text();
  const ms = performance.now() - t0;
  let j; try { j = JSON.parse(text); } catch { j = null; }
  const s = j?.data?.sale;
  return { kind, i, http: res.status, ok: res.status < 300 && !!s, receipt: s?.receiptNumber ?? null, ms: Math.round(ms) };
}

const out = { lebo: LABEL, api: API, bidhaa: productName, N, pingMs: pingMs.map(Math.round), sales: [] };
for (let i = 1; i <= WARMUP; i++) {
  const x = await sale('moto', i);
  console.log(`moto ${i}: HTTP ${x.http} ${x.receipt ?? 'IMESHINDWA'} ${x.ms} ms (haihesabiwi)`);
}
// cash na deni kwa kupokezana, ili mzigo wa server uwe sawa kwa zote mbili
for (let i = 1; i <= N; i++) {
  for (const kind of ['cash', 'deni']) {
    const x = await sale(kind, i);
    out.sales.push(x);
    console.log(`${kind} ${i}: HTTP ${x.http} ${x.receipt ?? 'IMESHINDWA'} ${x.ms} ms`);
  }
}

const stats = (xs) => {
  const v = xs.slice().sort((a, b) => a - b);
  if (!v.length) return null;
  const q = (p) => v[Math.min(v.length - 1, Math.ceil(p * v.length) - 1)];
  return { n: v.length, min: v[0], wastani: Math.round(v.reduce((a, b) => a + b, 0) / v.length), median: q(0.5), p90: q(0.9), max: v[v.length - 1] };
};
const good = out.sales.filter((x) => x.ok);
out.muhtasari = {
  ping: stats(out.pingMs),
  cash: stats(good.filter((x) => x.kind === 'cash').map((x) => x.ms)),
  deni: stats(good.filter((x) => x.kind === 'deni').map((x) => x.ms)),
  zote: stats(good.map((x) => x.ms)),
};
fs.writeFileSync(`analysis/steps/pos-muda-${LABEL}.json`, JSON.stringify(out, null, 2));
const fmt = (s) => (s ? `n=${s.n} min ${s.min} wastani ${s.wastani} median ${s.median} p90 ${s.p90} max ${s.max} ms` : 'hakuna');
console.log(`MUHTASARI ${LABEL} ping(tunnel) : ${fmt(out.muhtasari.ping)}`);
console.log(`MUHTASARI ${LABEL} cash        : ${fmt(out.muhtasari.cash)}`);
console.log(`MUHTASARI ${LABEL} deni        : ${fmt(out.muhtasari.deni)}`);
console.log(`MUHTASARI ${LABEL} zote        : ${fmt(out.muhtasari.zote)}`);
console.log(`SALES_ZILIZOFAULU=${good.length}/${2 * N}; faili: analysis\\steps\\pos-muda-${LABEL}.json`);
process.exit(good.length === 2 * N ? 0 : 1);
