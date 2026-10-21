// HATUA 50 (STAGING TU): wakati backend 2.2.70 inaendesha juu ya DB yenye V134 (jaribio la rollback), sale 1 ya cash
// "QA-RB" inaundwa na journal yake (SALE_CASH) inakaguliwa: inathibitisha kwamba 2.2.70 inaandika kwenye schema ya V134
// (safu mpya is_late_entry n.k. zina DEFAULT). Data ya bidhaa/mteja: analysis\steps\39-toleo1-data.txt (staging).
//   TARGET=staging node 50-rollback-sale.mjs   (ROOT_PASS = password ya root ya STAGING; haiandikwi popote)
import fs from 'node:fs';
import { check, today, short, money, login, call, pages, finish } from './45-lib.mjs';

const lines = fs.readFileSync('analysis/steps/39-toleo1-data.txt', 'utf8').split(/\r?\n/);
const d = lines.find((l) => l.startsWith('T1DATA|'))?.split('|'), c = lines.find((l) => l.startsWith('T1CUST|'))?.split('|');
if (!d || !c) { console.log('DATA_HAIPO: 39-toleo1-data.txt haina T1DATA/T1CUST'); process.exit(1); }
const [, productUid, productName, price, cost, ppp] = d;
const me = await login('root@system.com', process.env.ROOT_PASS, { allowRoot: true });
const p2 = (n) => String(n).padStart(2, '0');
const t = new Date(), at = `${today}T${p2(t.getHours())}:${p2(t.getMinutes())}:${p2(t.getSeconds())}`;
const unit = Number(price);
const q = await call('POST', '/api/v1/sales/partial', {
  saleDate: at, customerUid: c[1], customerName: null, customerPhoneNumber: null, userUid: me.tokenInfo.userId, userName: 'QA RB',
  discountAmount: 0, saleNotes: 'QA-RB | jaribio la rollback: 2.2.70 juu ya V134 (staging)',
  saleDetails: [{ productUid, productName, productCategory: null, saleType: 'PIECES', pieceQuantity: 1, packageQuantity: 1, unitPrice: unit, subTotal: unit,
    overrideUnitPrice: null, costPerPiece: Number(cost), piecesPerPackage: Number(ppp) || null, packageAbbreviation: null }],
  payments: [{ customerUid: c[1], customerName: 'QA-RB', paymentMethod: 'CASH', totalAmount: unit, amountPaid: unit, paymentDate: at, paymentNotes: null }],
});
const sale = q.data?.sale;
check('2.2.70-sale', q.ok && !!sale, `sale ${sale?.receiptNumber ?? '-'} jumla ${money(unit)}: HTTP ${q.http} ${q.ok ? '' : short(q.message)}`);
if (sale) {
  await new Promise((ok) => setTimeout(ok, 4000));
  const js = (await pages(`/api/v1/gl/journal-entries?startDate=${today}&endDate=${today}`)).filter((e) => e.referenceUid === sale.uid && !e.isReversal);
  check('2.2.70-journal', js.length === 1 && js[0].referenceType === 'SALE_CASH', `journal: ${js.map((e) => `${e.referenceType} ${e.entryNumber} Dr ${money(e.totalDebit)}`).join(', ') || 'HAKUNA'}`);
}
const st = await call('GET', '/api/v1/gl/status');
check('2.2.70-gl-status', st.ok, `GL posting=${st.data?.postingEnabled} journals=${st.data?.totalEntriesPosted}`);
finish('rollback 2.2.70');
