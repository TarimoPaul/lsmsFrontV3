// HATUA 64 (mmiliki 02/11 bu) - malipo ya deni ya 15/10 (ripoti RIPOTI-BT-02-11.md §2).
//   kagua  : SQL ya kusoma tu (64-kagua.sql) -> journal za chanzo (lazima ziwe kama zilivyoonekana kwenye nakala), Oktoba wazi,
//            1120 ya GL = daftari la madai, preview -> analysis/steps/64-kagua-<TARGET>.json. Haiandiki kitu.
//   andika : kagua upya; namba lazima ziwe zile za preview (vinginevyo SIMAMA).
//            J1 (daima): 15/10 Dr 6700 / Cr 1000 28,500 - ziada ya reco 10/10 na malipo ya 15/10 ni pesa ileile.
//            J2 (tu J2_NDIYO=1, mmiliki ameandika "J2 ndiyo"): 15/10 Dr 1120 / Cr 4000 17,000 kupitia API, KISHA kwa SQL (transaction
//               moja, pamoja na audit_trails) malipo 81e32020 (15,000) na f6d20485 (2,000) yanafutwa kwenye daftari la madai na
//               hali ya madeni yake inahesabiwa upya - vinginevyo 1120 ya GL ingezidi daftari kwa 17,000.
//            Kila sehemu inarukwa ikiwa imeshafanyika (kuendelea baada ya kukatika).
//            Ukaguzi: delta ya TB (6700, 1000, na 1120/4000 kwa J2), kila journal mara moja, 1120 ya GL = daftari, TB 0.
// Mazingira: TARGET=prod|staging, PROD_API / API, CEO_EMAIL, CEO_PASS, J2_NDIYO; LSMS_64_SQL=local (Docker-local) au bash
//   (jaribio la amri ya server), vinginevyo ssh contabo (~/lsms-deployment, output kupitia /tmp/ficha-lsms.awk ambayo .cmd inaipakia).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TARGET, check, failed, login, call, tbAll, deltaTB, finish, money, same } from './45-lib.mjs';

const MODE = process.argv[2];
if (!['kagua', 'andika'].includes(MODE)) { console.log('matumizi: node 64-rekebisha-15-10.mjs kagua|andika'); process.exit(1); }
const J2_NDIYO = process.env.J2_NDIYO === '1';
// Memo = reference_number (varchar 100) of the manual journal, and the key that finds it again (same text as 64-kagua.sql).
const JR = {
  J1: { memo: 'J1 15/10: 28,500 mara mbili kwenye 1000 (JE-...6802 + JE-...7163)', date: '2026-10-15', dr: '6700', cr: '1000', kiasi: 28500,
        maelezo: 'Ziada ya reco 10/10 (JE-2026-364983712136802) na malipo ya deni 15/10 (JE-2026-1170142847527163) ni pesa ileile' },
  J2: { memo: 'J2 15/10: 17,000 ni mauzo, si malipo ya deni (JE-...6819 + JE-...1062)', date: '2026-10-15', dr: '1120', cr: '4000', kiasi: 17000,
        maelezo: 'Malipo ya 15/10 (JE-2026-1170272232836819 15,000, JE-2026-1170382823731062 2,000) yalikuwa mauzo yasiyoandikwa (reco 12/10, 13/10)' },
};
const CHANZO = {
  RECO_10_10: { nambari: 'JE-2026-364983712136802', tarehe: '2026-10-10', aina: 'DAY_CLOSE_VARIANCE', mistari: '1000 28500.00 0.00;6700 0.00 28500.00' },
  MALIPO_28500: { nambari: 'JE-2026-1170142847527163', tarehe: '2026-10-15', aina: 'STAFF_LIABILITY_PAYMENT', mistari: '1000 28500.00 0.00;1120 0.00 28500.00' },
  MALIPO_15000: { nambari: 'JE-2026-1170272232836819', tarehe: '2026-10-15', aina: 'STAFF_LIABILITY_PAYMENT', mistari: '1000 15000.00 0.00;1120 0.00 15000.00' },
  MALIPO_2000: { nambari: 'JE-2026-1170382823731062', tarehe: '2026-10-15', aina: 'STAFF_LIABILITY_PAYMENT', mistari: '1000 2000.00 0.00;1120 0.00 2000.00' },
};
const MALIPO = { '81e32020-b10f-454c-89cf-1c93c574aff4': 15000, 'f6d20485-7263-4d11-b8ba-670cb6cf43ed': 2000 };
const SAVED = `analysis/steps/64-kagua-${TARGET}.json`;
const SSHO = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
const FICHA = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk";

/** psql on the target DB; read-only unless write. Returns the output lines. Throws on a psql error. */
function sql(text, { write = false } = {}) {
  const opts = write ? '-c statement_timeout=60000' : '-c default_transaction_read_only=on -c statement_timeout=120000';
  const psql = `PGOPTIONS="${opts}" psql -X -q -v ON_ERROR_STOP=1 -At -U "\${POSTGRES_USER:-postgres}" -d "\${POSTGRES_DB:-Lsms}"`;
  let out;
  if (process.env.LSMS_64_SQL === 'local') {
    out = execFileSync('docker', ['exec', '-i', 'lsms-local-postgres-1', 'sh', '-c', psql], { input: text, encoding: 'utf8' });
  } else {
    const remote = `set -o pipefail; cd ~/lsms-deployment && { docker compose exec -T postgres sh -c '${psql}'; } 2>&1 | ${FICHA}`;
    out = process.env.LSMS_64_SQL === 'bash'
      ? execFileSync('bash', ['-c', remote], { input: text, encoding: 'utf8' })
      : execFileSync('ssh', [...SSHO, 'contabo', remote], { input: text, encoding: 'utf8' });
  }
  return out.split(/\r?\n/).filter(Boolean);
}

function kagua({ quiet = false } = {}) {
  const lines = sql(fs.readFileSync('analysis/steps/64-kagua.sql', 'utf8'));
  if (!quiet) for (const l of lines) console.log(l);
  const rows = (tag) => lines.filter((l) => l.startsWith(tag + '|')).map((l) => l.split('|'));
  const chanzo = Object.fromEntries(rows('J64_CHANZO').map((x) => [x[1], { nambari: x[2], tarehe: x[3], aina: x[4], imefutwa: x[5] === 'true', reversal: Number(x[6]), mistari: x[7] }]));
  const malipo = Object.fromEntries(rows('J64_MALIPO').map((x) => [x[1], { kiasi: Number(x[2]), imefutwa: x[3] === 'true', deni: x[4], deniKiasi: Number(x[5]), hali: x[6], imelipwa: Number(x[7]) }]));
  const g = rows('J64_1120')[0] ?? [];
  return {
    imekamilika: lines.includes('J64_KAGUA_IMEKAMILIKA'),
    oktoba: rows('J64_KIPINDI').find((x) => x[1] === '10')?.[2],
    chanzo,
    reco1010: Number(rows('J64_RECO_10_10')[0]?.[1]),
    malipo,
    gl1120: Number(g[1]), daftari: Number(g[2]),
    ipo: Object.fromEntries(rows('J64_JOURNAL_IPO').map((x) => [x[1], Number(x[2])])),
    tb: Number(rows('J64_TB')[0]?.[1]),
  };
}

function kaguaChecks(k) {
  const j2Ipo = k.ipo.J2 > 0;
  check('64.k1 kagua imekamilika', k.imekamilika, 'SQL ya kagua ilifika mwisho');
  check('64.k2 Oktoba iko wazi (au journal zimeshaandikwa)', k.oktoba === 'OPEN' || (k.ipo.J1 > 0 && (!J2_NDIYO || j2Ipo)), `Oktoba ${k.oktoba}`);
  for (const [key, e] of Object.entries(CHANZO)) {
    const c = k.chanzo[key];
    check(`64.k3 ${key}: ${e.nambari} ipo, hai, haina reversal, mistari kama nakala`,
      !!c && c.nambari === e.nambari && c.tarehe === e.tarehe && c.aina === e.aina && !c.imefutwa && c.reversal === 0 && c.mistari === e.mistari,
      c ? `${c.nambari} ${c.tarehe} ${c.aina} imefutwa=${c.imefutwa} reversal=${c.reversal} [${c.mistari}]` : 'HAIPO');
  }
  check('64.k4 reco 10/10: net ya 1000 kwa DAY_CLOSE_VARIANCE = +28,500', same(k.reco1010, 28500), money(k.reco1010));
  for (const [uid, kiasi] of Object.entries(MALIPO)) {
    const m = k.malipo[uid];
    // Before J2: live. After J2's SQL (resume): deleted.
    check(`64.k5 malipo ${uid.slice(0, 8)} ${money(kiasi)} yapo kwenye daftari`, !!m && same(m.kiasi, kiasi) && (!m.imefutwa || j2Ipo),
      m ? `kiasi ${money(m.kiasi)}, imefutwa=${m.imefutwa}, deni ${m.deni.slice(0, 8)} ${money(m.deniKiasi)} ${m.hali}, imelipwa ${money(m.imelipwa)}` : 'HAYAPO');
  }
  // Mid-J2 resume (journal written, SQL not yet): GL is 17,000 above the ledger - allowed only then.
  const j2Nusu = j2Ipo && Object.keys(MALIPO).some((u) => k.malipo[u] && !k.malipo[u].imefutwa);
  check('64.k6 1120 ya GL = daftari la madai', j2Nusu ? same(k.gl1120 - k.daftari, 17000) : same(k.gl1120, k.daftari),
    `GL ${money(k.gl1120)} / daftari ${money(k.daftari)}${j2Nusu ? ' (J2 nusu: journal ipo, daftari bado - itaendelea)' : ''}`);
  check('64.k7 kila journal imeandikwa mara 0 au 1', Object.values(k.ipo).every((c) => c === 0 || c === 1), JSON.stringify(k.ipo));
  check('64.k8 TB 0', same(k.tb, 0), money(k.tb));
  for (const key of ['J1', 'J2']) {
    const j = JR[key];
    const hali = k.ipo[key] ? 'TAYARI IPO - itarukwa' : key === 'J2' && !J2_NDIYO ? 'ITARUKWA isipokuwa mmiliki aandike "J2 ndiyo"' : 'itaandikwa';
    console.log(`PREVIEW 64: ${key} ${j.date} Dr ${j.dr} ${money(j.kiasi)} / Cr ${j.cr} ${money(j.kiasi)} "${j.memo}" (${hali})`);
  }
  console.log('PREVIEW 64: J2 pia inafuta malipo 81e32020 (15,000) na f6d20485 (2,000) kwenye daftari la madai (SQL + audit),'
    + ` ili 1120 ibaki = daftari: baada ya J2 deni la macheda = ${money(k.daftari + (j2Ipo ? 0 : 17000))}`);
}

const k = kagua();
kaguaChecks(k);

if (MODE === 'kagua') {
  if (!failed()) {
    fs.writeFileSync(SAVED, JSON.stringify({ saa: new Date().toISOString(), gl1120: k.gl1120, daftari: k.daftari, ipo: k.ipo,
      malipo: k.malipo, chanzo: k.chanzo }, null, 2));
    console.log(`preview imehifadhiwa: ${SAVED}`);
  }
  finish('64 15-10 kagua');
}

// ── andika ──────────────────────────────────────────────────────────────────
if (failed()) finish('64 15-10 andika');
if (!fs.existsSync(SAVED)) { check('64.a0 preview', false, `${SAVED} haipo - endesha kagua kwanza`); finish('64 15-10 andika'); }
const s = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
// The sources must be the very rows of the preview; the ledger may only have moved by what this step itself did.
const sameSources = Object.keys(CHANZO).every((key) => JSON.stringify(s.chanzo[key]) === JSON.stringify(k.chanzo[key]));
const moved = (k.ipo.J2 > 0 && !(s.ipo.J2 > 0)) || Object.keys(MALIPO).some((u) => k.malipo[u]?.imefutwa !== s.malipo[u]?.imefutwa);
check('64.a1 namba ni zilezile za preview', sameSources && (moved || (same(k.gl1120, s.gl1120) && same(k.daftari, s.daftari))),
  `1120 GL ${money(s.gl1120)} -> ${money(k.gl1120)}, daftari ${money(s.daftari)} -> ${money(k.daftari)}`);
if (failed()) { console.log('SIMAMA: data imebadilika tangu preview - endesha kagua upya'); finish('64 15-10 andika'); }

const who = await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const ceoEmail = String(who.tokenInfo?.email ?? process.env.CEO_EMAIL).replace(/'/g, '');
const today = new Date().toISOString().slice(0, 10);
const tb0 = await tbAll(today);
const tarajio = {};
const add = (code, v) => { tarajio[code] = Math.round(((tarajio[code] ?? 0) + v) * 100) / 100; };

async function journal(key) {
  const j = JR[key];
  if (k.ipo[key] > 0) { check(`64.a2 ${key} tayari ipo - imerukwa`, true, 'haikuandikwa tena'); return; }
  const r = await call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: j.date, memo: j.memo, lines: [
    { accountCode: j.dr, debit: j.kiasi, credit: 0, description: j.maelezo },
    { accountCode: j.cr, debit: 0, credit: j.kiasi, description: j.maelezo }] });
  check(`64.a2 ${key} ${j.date} imeandikwa (API)`, r.ok, `${r.http} ${r.message} ${r.data ?? ''}`);
  if (!r.ok) finish('64 15-10 andika');
  add(j.dr, j.kiasi);
  add(j.cr, -j.kiasi);
}

await journal('J1');

if (!J2_NDIYO) {
  check('64.a3 J2 imerukwa (mmiliki hakuandika "J2 ndiyo")', null, 'hakuna kilichoandikwa kwa J2');
} else {
  await journal('J2');
  const hai = Object.keys(MALIPO).filter((u) => !k.malipo[u].imefutwa);
  if (hai.length === 0) {
    check('64.a4 malipo ya J2 tayari yamefutwa kwenye daftari - imerukwa', true, 'hakuna SQL');
  } else {
    const sababu = 'Hatua 64 J2: malipo ya 15/10 yalikuwa mauzo yasiyoandikwa (reco 12/10, 13/10), si malipo ya deni (mmiliki 02/11 bu)';
    const out = sql(`\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE r record; paid numeric; n int := 0;
BEGIN
  FOR r IN SELECT p.uid, p.amount, p.liability_uid FROM staff_liability_payment p
            WHERE p.uid IN (${hai.map((u) => `'${u}'`).join(', ')}) AND NOT coalesce(p.is_deleted, false) FOR UPDATE LOOP
    IF r.amount <> (CASE r.uid ${hai.map((u) => `WHEN '${u}' THEN ${MALIPO[u]}`).join(' ')} END) THEN
      RAISE EXCEPTION 'SIYO: malipo % kiasi % si cha preview', r.uid, r.amount;
    END IF;
    UPDATE staff_liability_payment SET is_deleted = true, deleted_at = now() AT TIME ZONE 'Africa/Dar_es_Salaam', deleted_by = '${ceoEmail}',
           updated_at = now() AT TIME ZONE 'Africa/Dar_es_Salaam', updated_by = '${ceoEmail}',
           notes = left(coalesce(notes, '') || ' | ${sababu}', 1000)
     WHERE uid = r.uid;
    SELECT coalesce(sum(amount), 0) INTO paid FROM staff_liability_payment WHERE liability_uid = r.liability_uid AND NOT coalesce(is_deleted, false);
    UPDATE staff_liability SET status = CASE WHEN paid = 0 THEN 'OPEN' WHEN paid >= amount THEN 'SETTLED' ELSE 'PARTIALLY_PAID' END,
           updated_at = now() AT TIME ZONE 'Africa/Dar_es_Salaam', updated_by = '${ceoEmail}'
     WHERE uid = r.liability_uid AND status <> 'WAIVED';
    INSERT INTO audit_trails (uid, action, module, description, additional_data, timestamp, user_email, user_uid, endpoint)
    VALUES (replace(gen_random_uuid()::text, '-', ''), 'STAFF_LIABILITY_PAYMENT_REMOVED', 'Liabilities',
            'Malipo ' || r.uid || ' (' || r.amount || ') yamefutwa. ${sababu}',
            json_build_object('paymentUid', r.uid, 'amount', r.amount, 'liabilityUid', r.liability_uid, 'paidAfter', paid, 'step', '64',
                              'journal', 'J2')::text,
            now() AT TIME ZONE 'Africa/Dar_es_Salaam', '${ceoEmail}', (SELECT uid FROM users WHERE email = '${ceoEmail}' LIMIT 1), 'hatua-64 SQL');
    n := n + 1;
  END LOOP;
  IF n <> ${hai.length} THEN RAISE EXCEPTION 'SIYO: malipo % tu kati ya ${hai.length} yalipatikana hai', n; END IF;
END $$;
COMMIT;
SELECT 'J64_MALIPO_BAADA|' || uid || '|' || is_deleted FROM staff_liability_payment WHERE uid IN (${Object.keys(MALIPO).map((u) => `'${u}'`).join(', ')});
SELECT 'J64_AUDIT|' || count(*) FROM audit_trails WHERE action = 'STAFF_LIABILITY_PAYMENT_REMOVED' AND additional_data LIKE '%"step" : "64"%';
`, { write: true });
    for (const l of out) console.log(l);
    check('64.a4 malipo ya J2 yamefutwa kwenye daftari (SQL)', Object.keys(MALIPO).every((u) => out.includes(`J64_MALIPO_BAADA|${u}|true`)),
      out.filter((l) => l.startsWith('J64_MALIPO_BAADA')).join(' '));
  }
}

const tb1 = await tbAll(today);
deltaTB('64.a5', 'ya hatua hii', tb0, tb1, tarajio,
  'Rollback: reverse journal za memo hizi kupitia GL; kwa J2 pia rudisha malipo (is_deleted=false) - niletee log kwanza.');
const after = kagua({ quiet: true });
check('64.a6 J1 ipo mara moja tu', after.ipo.J1 === 1, `${after.ipo.J1}`);
check(`64.a7 J2 ipo mara ${J2_NDIYO ? 'moja' : '0'}`, after.ipo.J2 === (J2_NDIYO ? 1 : 0), `${after.ipo.J2}`);
check('64.a8 1120 ya GL = daftari la madai', same(after.gl1120, after.daftari), `GL ${money(after.gl1120)} / daftari ${money(after.daftari)}`);
check('64.a9 TB 0', same(after.tb, 0), money(after.tb));
finish('64 15-10 andika');
