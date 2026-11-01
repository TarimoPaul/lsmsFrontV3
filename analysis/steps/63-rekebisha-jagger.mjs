// HATUA 63 (mmiliki 01/11 bo) - Jagger Master: carton ya chupa 6 iliyoingizwa 11/10 kama chupa 1 kwa 53,000.
//   kagua  : SQL ya kusoma tu (63-jagger-kagua.sql) -> kiasi A na B (lazima zilingane), mauzo tangu 11/10, preview ->
//            inahifadhi analysis/steps/63-kagua-<TARGET>.json. Haiandiki kitu.
//   andika : kagua upya; namba lazima ziwe zilezile za preview iliyohifadhiwa (vinginevyo SIMAMA, kagua upya). Kisha:
//            1) journal moja kupitia API: Dr 5100 / Cr 1200 = A, tarehe 2026-11-01 (Novemba lazima iwe wazi),
//               memo "Marekebisho ya Oktoba: Jagger carton kama chupa (11/10)" - inarukwa ikiwa ipo tayari;
//            2) SQL ya transaction moja: gharama ya Jagger (current_average_cost, last_purchase_cost) -> gharama sahihi,
//               ikiwa tu gharama na stock bado ni zile za preview - inarukwa ikiwa tayari ni sahihi;
//            3) ukaguzi: journal ipo mara moja, gharama sahihi, thamani ya Jagger = chupa x gharama sahihi, delta ya TB
//               = 5100 +A / 1200 -A tu, TB 0.
// Mazingira: TARGET=prod|staging, PROD_API / API, CEO_EMAIL, CEO_PASS; LSMS_63_SQL=local = Docker-local (majaribio),
//   vinginevyo ssh contabo (~/lsms-deployment, kila output kupitia /tmp/ficha-lsms.awk ambayo .cmd inaipakia).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TARGET, check, failed, login, call, tbAll, deltaTB, finish, money, same } from './45-lib.mjs';

const MODE = process.argv[2];
if (!['kagua', 'andika'].includes(MODE)) { console.log('matumizi: node 63-rekebisha-jagger.mjs kagua|andika'); process.exit(1); }
const P = '886dc1ed-2793-453c-bc9f-2c1e251ec5de';
const MEMO = 'Marekebisho ya Oktoba: Jagger carton kama chupa (11/10)';
const DATE = '2026-11-01';
const SAVED = `analysis/steps/63-kagua-${TARGET}.json`;
const SSHO = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
const FICHA = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk";

/** psql on the target DB; read-only unless write. Returns the output lines. Throws on a psql error. */
function sql(text, { write = false } = {}) {
  const opts = write ? '-c statement_timeout=60000' : '-c default_transaction_read_only=on -c statement_timeout=120000';
  const psql = `PGOPTIONS="${opts}" psql -X -q -v ON_ERROR_STOP=1 -At -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-Lsms}"`;
  let out;
  if (process.env.LSMS_63_SQL === 'local') {
    out = execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'sh', '-c', psql], { input: text, encoding: 'utf8' });
  } else {
    const remote = `set -o pipefail; cd ~/lsms-deployment && { docker compose exec -T postgres sh -c '${psql}'; } 2>&1 | ${FICHA}`;
    // LSMS_63_SQL=bash: the same remote command in a local bash (test of its quoting against a fake ~/lsms-deployment).
    out = process.env.LSMS_63_SQL === 'bash'
      ? execFileSync('bash', ['-c', remote], { input: text, encoding: 'utf8' })
      : execFileSync('ssh', [...SSHO, 'contabo', remote], { input: text, encoding: 'utf8' });
  }
  return out.split(/\r?\n/).filter(Boolean);
}

/** The read-only preview: every J63_ line, plus the numbers it is decided on. */
function kagua() {
  const lines = sql(fs.readFileSync('analysis/steps/63-jagger-kagua.sql', 'utf8'));
  for (const l of lines) console.log(l);
  const row = (tag) => lines.find((l) => l.startsWith(tag + '|'))?.split('|') ?? null;
  const kv = (r) => Object.fromEntries((r ?? []).slice(1).map((x) => { const i = x.lastIndexOf(' '); return [x.slice(0, i), x.slice(i + 1)]; }));
  const b = row('J63_BIDHAA'), n = row('J63_NANGA'), h = kv(row('J63_HESABU')), mw = row('J63_MWENDO_MWINGINE');
  const jr = row('J63_JOURNAL_IPO'), tb = row('J63_TB');
  const kip = Object.fromEntries(lines.filter((l) => l.startsWith('J63_KIPINDI|')).map((l) => l.split('|').slice(1)));
  return {
    imekamilika: lines.includes('J63_KAGUA_IMEKAMILIKA'),
    bidhaa: b && { uid: b[1], jina: b[2], chupaKwaCarton: Number(b[3]), gharama: Number(b[4]), gharamaMwisho: Number(b[5]), stock: Number(b[6]) },
    nanga: n && { idadi: Number(n[1]), uid: n[2], jumla: Number(n[3]), gharamaKwaChupa: Number(n[4]), chupa: Number(n[5]), njia: n[6], stockKabla: Number(n[8]) },
    mwendoMwingine: mw ? Number(mw[1]) : NaN,
    stockMwisho: mw ? Number(mw[2].split(' ')[1]) : NaN,
    hesabu: Object.fromEntries(Object.entries(h).map(([k, v]) => [k, Number(v)])),
    journal: jr ? Number(jr[1]) : NaN,
    tb: tb ? Number(tb[1]) : NaN,
    novemba: kip['11'],
  };
}

function kaguaChecks(k) {
  check('63.k1 kagua imekamilika', k.imekamilika, 'SQL ya kagua ilifika mwisho');
  check('63.k2 bidhaa', !!k.bidhaa && k.bidhaa.chupaKwaCarton === 6, `${k.bidhaa?.jina}: chupa ${k.bidhaa?.chupaKwaCarton} kwa carton, gharama ${money(k.bidhaa?.gharama)}, stock ${k.bidhaa?.stock}`);
  check('63.k3 manunuzi ya 11/10: moja, PER_PIECE, stock ilikuwa 0', k.nanga?.idadi === 1 && k.nanga.njia === 'PER_PIECE' && k.nanga.stockKabla === 0,
    `idadi ${k.nanga?.idadi}, ${k.nanga?.njia}, jumla ${money(k.nanga?.jumla)}, chupa kwa carton ${k.nanga?.chupa}, stock kabla ${k.nanga?.stockKabla}`);
  check('63.k4 hakuna mwendo mwingine wa stock (si manunuzi/hesabu/mauzo) tangu 11/10', k.mwendoMwingine === 0, `${k.mwendoMwingine}`);
  check('63.k5 stock ya bidhaa = stock ya mwendo wa mwisho', k.bidhaa?.stock === k.stockMwisho, `${k.bidhaa?.stock} / ${k.stockMwisho}`);
  const h = k.hesabu;
  check('63.k6 gharama sahihi = carton / chupa', same(h.gharama_sahihi, Math.round((k.nanga?.jumla / k.nanga?.chupa) * 100) / 100), money(h.gharama_sahihi));
  const fixed = same(h.gharama_ya_sasa, h.gharama_sahihi);
  // A and B are two independent counts of the same excess; once the cost is fixed, B is 0 and A is what the journal took out.
  check('63.k7 A = B (njia mbili zinakubaliana)', fixed ? same(h.B, 0) : Math.abs(h.A - h.B) <= 1, `A ${money(h.A)}, B ${money(h.B)}${fixed ? ' (gharama tayari sahihi)' : ''}`);
  check('63.k8 kiasi ni chanya', h.A > 0, money(h.A));
  check('63.k9 Novemba iko wazi (journal ya 01/11)', k.novemba === 'OPEN', String(k.novemba));
  check('63.k10 journal hii imeandikwa mara 0 au 1', k.journal === 0 || k.journal === 1, `${k.journal}`);
  check('63.k11 TB 0', same(k.tb, 0), money(k.tb));
  console.log(`PREVIEW 63: journal ${DATE} Dr 5100 ${money(h.A)} / Cr 1200 ${money(h.A)} "${MEMO}"${k.journal ? ' (TAYARI IPO - itarukwa)' : ''}`);
  console.log(`PREVIEW 63: gharama ya Jagger ${money(h.gharama_ya_sasa)} -> ${money(h.gharama_sahihi)}${fixed ? ' (TAYARI - itarukwa)' : ''}; chupa ${h.chupa_zilizopo}; thamani baada = ${money(h.thamani_sahihi)}`);
  console.log(`PREVIEW 63: mauzo ya Jagger tangu 11/10: chupa ${h.chupa_zilizouzwa}, COGS ${money(h.COGS)} (orodha: mistari J63_MAUZO juu)`);
}

const k = kagua();
kaguaChecks(k);

if (MODE === 'kagua') {
  if (!failed()) {
    fs.writeFileSync(SAVED, JSON.stringify({ saa: new Date().toISOString(), A: k.hesabu.A, B: k.hesabu.B, chupa: k.hesabu.chupa_zilizopo,
      gharamaYaSasa: k.hesabu.gharama_ya_sasa, gharamaSahihi: k.hesabu.gharama_sahihi, journal: k.journal }, null, 2));
    console.log(`preview imehifadhiwa: ${SAVED}`);
  }
  finish('63 jagger kagua');
}

// ── andika ──────────────────────────────────────────────────────────────────
if (failed()) finish('63 jagger andika');
if (!fs.existsSync(SAVED)) { check('63.a0 preview', false, `${SAVED} haipo - endesha kagua kwanza`); finish('63 jagger andika'); }
const s = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
const h = k.hesabu;
const fixedNow = same(h.gharama_ya_sasa, h.gharama_sahihi);
check('63.a1 namba ni zilezile za preview', same(h.A, s.A) && h.chupa_zilizopo === s.chupa && same(h.gharama_sahihi, s.gharamaSahihi)
  && (fixedNow || (same(h.B, s.B) && same(h.gharama_ya_sasa, s.gharamaYaSasa))),
  `A ${money(s.A)} -> ${money(h.A)}, chupa ${s.chupa} -> ${h.chupa_zilizopo}, gharama ${money(s.gharamaYaSasa)} -> ${money(h.gharama_ya_sasa)}`);
if (failed()) { console.log('SIMAMA: data imebadilika tangu preview (mf. mauzo ya Jagger) - endesha kagua upya'); finish('63 jagger andika'); }

const X = Math.round(s.A * 100) / 100;
await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const tb0 = await tbAll(new Date().toISOString().slice(0, 10));

// 1) Journal (skipped when it is already there).
let journalYaHatuaHii = false;
if (k.journal === 0) {
  const r = await call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: DATE, memo: MEMO, lines: [
    { accountCode: '5100', debit: X, credit: 0, description: 'Jagger: ziada ya hesabu 13/10 ilikuwa carton ya 11/10' },
    { accountCode: '1200', debit: 0, credit: X, description: 'Jagger: thamani ya stock kwa 8,833.33 kwa chupa' }] });
  check('63.a2 journal imeandikwa (API)', r.ok, `${r.http} ${r.message} ${r.data ?? ''}`);
  journalYaHatuaHii = r.ok;
  if (!r.ok) finish('63 jagger andika');
} else {
  check('63.a2 journal tayari ipo - imerukwa', true, 'haikuandikwa tena');
}

// 2) Cost (one transaction; only if cost and stock are still those of the preview).
if (!fixedNow) {
  const out = sql(`\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE c numeric; st int;
BEGIN
  SELECT current_average_cost, current_stock INTO c, st FROM products WHERE uid = '${P}' FOR UPDATE;
  IF c IS DISTINCT FROM ${s.gharamaYaSasa}::numeric OR st IS DISTINCT FROM ${s.chupa} THEN
    RAISE EXCEPTION 'SIYO: gharama % au stock % si za preview (${s.gharamaYaSasa} / ${s.chupa})', c, st;
  END IF;
  UPDATE products SET current_average_cost = ${s.gharamaSahihi}, last_purchase_cost = ${s.gharamaSahihi}, updated_at = now() WHERE uid = '${P}';
  IF NOT FOUND THEN RAISE EXCEPTION 'SIYO: bidhaa haikubadilika'; END IF;
END $$;
COMMIT;
SELECT 'J63_GHARAMA_BAADA|' || current_average_cost || '|' || last_purchase_cost || '|' || current_stock FROM products WHERE uid = '${P}';
`, { write: true });
  for (const l of out) console.log(l);
  const g = out.find((l) => l.startsWith('J63_GHARAMA_BAADA|'))?.split('|') ?? [];
  check('63.a3 gharama ya Jagger imerekebishwa (SQL)', same(g[1], s.gharamaSahihi) && same(g[2], s.gharamaSahihi), `${g[1]} / ${g[2]}`);
} else {
  check('63.a3 gharama tayari sahihi - imerukwa', true, money(h.gharama_ya_sasa));
}

// 3) Checks after.
const tb1 = await tbAll(new Date().toISOString().slice(0, 10));
deltaTB('63.a4', 'ya hatua hii', tb0, tb1, journalYaHatuaHii ? { '5100': X, '1200': -X } : {},
  'Rollback: reverse journal ya MJ (memo hii) kupitia GL, na rudisha gharama kwa SQL - niletee log kwanza.');
const after = kagua();
check('63.a5 journal ipo mara moja tu', after.journal === 1, `${after.journal}`);
check('63.a6 gharama ya Jagger = gharama sahihi', same(after.hesabu.gharama_ya_sasa, s.gharamaSahihi), money(after.hesabu.gharama_ya_sasa));
check('63.a7 thamani ya stock ya Jagger = chupa x gharama sahihi', same(after.hesabu.B, 0)
  && same(after.hesabu.chupa_zilizopo * after.hesabu.gharama_ya_sasa, after.hesabu.thamani_sahihi),
  `${after.hesabu.chupa_zilizopo} x ${money(after.hesabu.gharama_ya_sasa)} = ${money(after.hesabu.thamani_sahihi)}`);
check('63.a8 TB 0', same(after.tb, 0), money(after.tb));
finish('63 jagger andika');
