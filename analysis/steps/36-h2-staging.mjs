// HATUA 36 - jaribio la H-2 kwenye STAGING TU (tunnel localhost:8081). INAANDIKA KWENYE STAGING: sales 4 za jaribio
// zenye sale_notes "QA-H2 ...", bidhaa 1 kipande kimoja au viwili kila moja (stock ya staging inapungua vipande 6).
// Production HAIGUSWI. Password inatoka ROOT_PASS (set /p kwenye .cmd) na haiandikwi popote.
// Bidhaa na mteja vinasomwa kutoka analysis\steps\36-h2-data.txt (mistari H2DATA| na H2CUST| ya 36-h2-kabla.sql).
//
// Dhana inayojaribiwa (H-2): postSale (async) inasoma entity ya Sales ambayo outstandingBalance yake bado ni 0
// (syncPaymentStatusByUid ni UPDATE ya SQL inayobadilisha DB tu). Kwa hiyo mstari wa AR haupo, journal haiko balanced,
// executePost inaikataa na catch inaandika log tu. Utabiri:
//   A (cash, imelipwa yote) -> journal SALE_CASH ipo
//   B, C, D (zenye deni)    -> HAKUNA journal; log ya backend: "GL postSale failed for <risiti>: GL post failed for SALE_CASH ref=<uid>"
import fs from 'node:fs';

const API = 'http://localhost:8081';
const lines = fs.readFileSync('analysis/steps/36-h2-data.txt', 'utf8').split(/\r?\n/);
const d = lines.find((l) => l.startsWith('H2DATA|'))?.split('|');
const c = lines.find((l) => l.startsWith('H2CUST|'))?.split('|');
if (!d || !c) { console.log('DATA_HAIPO: 36-h2-data.txt haina H2DATA/H2CUST'); process.exit(1); }
const [, productUid, productName, price, cost, ppp] = d;
const customerUid = c[1];
const unit = Number(price), unitCost = Number(cost);
console.log(`bidhaa: ${productName} (${productUid}) bei ${unit} gharama ${unitCost}; mteja ${customerUid} (${c[2]})`);

const p2 = (n) => String(n).padStart(2, '0');
const now = () => { const t = new Date(); return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}T${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`; };
const short = (v) => JSON.stringify(v).slice(0, 400);

// ── login (+ branch ikiwa inahitajika) ──
let r = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'root@system.com', password: process.env.ROOT_PASS }) });
if (!r.ok) { console.log('LOGIN_IMESHINDWA', r.status); process.exit(1); }
let login = (await r.json()).data;
let token = login.tokenInfo.token;
const userUid = login.tokenInfo.userId;
if (login.requiresBranchSelection || (!login.selectedBranchUid && (login.branches ?? []).length > 1)) {
  const b = login.branches[0];
  r = await fetch(`${API}/api/auth/select-branch`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branchUid: b.uid ?? b.branchUid }) });
  const sel = (await r.json()).data;
  token = (sel?.tokenInfo ?? sel)?.token ?? token;
  console.log(`branch: ${b.name ?? b.branchName ?? b.uid}`);
}
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// ── sales 4 ──
const cases = [
  { tag: 'QA-H2 A', qty: 1, method: 'CASH', paid: 1.0, expect: 'journal SALE_CASH' },
  { tag: 'QA-H2 B', qty: 2, method: 'CASH', paid: 0.5, expect: 'deni: hakuna journal (kama dhana ni sahihi)' },
  { tag: 'QA-H2 C', qty: 1, method: 'CASH', paid: 0.0, expect: 'deni: hakuna journal (kama dhana ni sahihi)' },
  { tag: 'QA-H2 D', qty: 2, method: 'VODACOM', paid: 0.5, expect: 'deni: hakuna journal (kama dhana ni sahihi)' },
];
let created = 0;
for (const k of cases) {
  const total = unit * k.qty, paid = Math.round(total * k.paid), date = now();
  const body = {
    saleDate: date, customerUid, customerName: null, customerPhoneNumber: null, userUid, userName: 'QA H2',
    discountAmount: 0, saleNotes: `${k.tag} | jaribio la H-2 (staging)`,
    saleDetails: [{ productUid, productName, productCategory: null, saleType: 'PIECES', pieceQuantity: k.qty, packageQuantity: k.qty,
      unitPrice: unit, subTotal: total, overrideUnitPrice: null, costPerPiece: unitCost, piecesPerPackage: Number(ppp) || null, packageAbbreviation: null }],
    payments: [{ customerUid, customerName: 'QA-H2', paymentMethod: k.method, totalAmount: total, amountPaid: paid, paymentDate: date,
      paymentNotes: paid < total ? `QA-H2 deni ${total - paid}` : null }],
  };
  r = await fetch(`${API}/api/v1/sales/partial`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 300); }
  const s = j?.data?.sale;
  if (r.status < 300 && s) {
    created++;
    console.log(`${k.tag}: HTTP ${r.status} risiti ${s.receiptNumber} uid ${s.uid} jumla ${total} imelipwa ${paid} (${k.method}) deni_jibu=${s.outstandingBalance} hali=${s.paymentStatus}  | utabiri: ${k.expect}`);
    if ((j.data.failedItems ?? []).length) console.log(`   failedItems: ${short(j.data.failedItems)}`);
  } else {
    console.log(`${k.tag}: IMESHINDWA HTTP ${r.status} ${short(j)}`);
  }
}
console.log(`SALES_ZILIZOUNDWA=${created}/4`);
await new Promise((ok) => setTimeout(ok, 8000)); // postSale ni async
process.exit(created === 4 ? 0 : 1);
