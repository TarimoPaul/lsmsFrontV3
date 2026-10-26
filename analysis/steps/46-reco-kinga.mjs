// HATUA 46a - KINGA (mmiliki 21/10 16:xx): reco / day close ya SIKU ILIYOPITA (21/10) lazima iwe imekamilika kabla ya 46a.
//   TARGET=prod node 46-reco-kinga.mjs 2026-10-21
// "Imekamilika": kuna reco >= 1 ya tarehe hiyo, KILA reco iko APPROVED au CLOSED (hakuna DRAFT, SUBMITTED, REVIEWED wala
// REOPENED - ambazo bado zinaweza kubadilika / hazina snapshot), na kila moja ina snapshot ya day close (inaundwa wakati wa APPROVE).
// HAIANDIKI: GET tu, kwa akaunti ya CEO. Ishara: RECO_IMEFUNGWA (exit 0) au "IMEKATALIWA: reco ya <tarehe> haijaisha" (exit 1).
import { check, failed, short, login, call, finish } from './45-lib.mjs';

const D = process.argv[2] || '';
if (!/^\d{4}-\d{2}-\d{2}$/.test(D)) { console.log('Tumia: node 46-reco-kinga.mjs YYYY-MM-DD'); process.exit(1); }
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);

const list = await call('GET', `/api/v1/reconciliation/list?fromDate=${D}&toDate=${D}&page=0&size=200`);
const recos = (list.raw?.data ?? []).filter((r) => String(r.reconciliationDate) === D);
check('reco-orodha', list.ok, list.ok ? `reco za ${D}: ${recos.length}` : `HTTP ${list.http} ${short(list.message)}`);
for (const r of recos) console.log(`  reco ${r.uid} ${r.userName ?? ''} ${r.status} (approved ${r.approvedAt ?? '-'}, closed ${r.closedAt ?? '-'})`);
const wazi = recos.filter((r) => !['APPROVED', 'CLOSED'].includes(String(r.status)));
check('reco-ipo', recos.length > 0, `reco ${recos.length} za ${D} (lazima >= 1)`);
check('reco-imefungwa', recos.length > 0 && wazi.length === 0, wazi.length ? `bado wazi: ${wazi.map((r) => `${r.userName ?? r.uid} ${r.status}`).join(', ')}` : 'zote APPROVED / CLOSED');

const sn = await call('GET', `/api/v1/reconciliation/snapshots?fromDate=${D}&toDate=${D}`);
const snaps = (sn.data ?? []).filter((s) => String(s.snapshotDate) === D);
const bila = recos.filter((r) => !snaps.some((s) => s.reconciliationUid === r.uid));
check('day-close-snapshot', sn.ok && snaps.length > 0 && bila.length === 0,
  sn.ok ? `snapshots ${snaps.length} za ${D}${bila.length ? `; reco bila snapshot: ${bila.map((r) => r.userName ?? r.uid).join(', ')}` : ''}` : `HTTP ${sn.http} ${short(sn.message)}`);

if (failed()) console.log(`IMEKATALIWA: reco ya ${D} haijaisha`);
else console.log('RECO_IMEFUNGWA');
finish(`reco ${D}`);
