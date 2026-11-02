// HATUA 63 v3 (mmiliki 02/11 bw) - Jagger Master 886dc1ed: hesabu ya 13/10 iliandika 6 badala ya 1.
//   Chief: CHUPA moja = 53,000 (TAKAWEDO), bei ya kuuza 60,000, dukani ipo 1. Gharama INABAKI 53,000 (hakuna UPDATE ya
//   gharama, hakuna price_history). Njia ya "carton" ya v1/v2 imefutwa.
//   kagua  : SQL ya kusoma tu (63-jagger-kagua.sql): stock ya mfumo bado 6, gharama 53,000, hakuna mauzo wala mwendo wa
//            stock tangu 13/10, akaunti iliyopewa credit na journal ya 13/10 (moja tu) na kiasi chake (= 265,000 kutoka data),
//            Oktoba wazi -> preview analysis/steps/63-kagua-<TARGET>.json. Haiandiki kitu.
//   andika : kagua upya; namba lazima ziwe zile za preview (vinginevyo SIMAMA).
//            1) Journal 31/10 kupitia API: Dr <akaunti ya 13/10> / Cr 1200 = kiasi cha 13/10; inarukwa ikiwa ipo.
//            2) SQL (transaction moja): stock movement ADJUSTMENT -5 (6 -> 1, bei 53,000, rejea MAREKEBISHO-COUNT-ADJ-<line>)
//               + audit_trails; ikiwa tu stock bado 6 na gharama 53,000; inarukwa ikiwa movement ipo.
//            Ukaguzi: stock 1, thamani 1 x 53,000, journal na movement mara moja, delta ya TB, TB 0.
// Mazingira: TARGET=prod|staging, PROD_API / API, CEO_EMAIL, CEO_PASS; LSMS_63_SQL=local (Docker-local) au bash (jaribio
//   la amri ya server), vinginevyo ssh contabo (~/lsms-deployment, output kupitia /tmp/ficha-lsms.awk ambayo .cmd inaipakia).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TARGET, check, failed, login, call, tbAll, deltaTB, finish, money, same } from './45-lib.mjs';

const MODE = process.argv[2];
if (!['kagua', 'andika'].includes(MODE)) { console.log('matumizi: node 63-rekebisha-jagger.mjs kagua|andika'); process.exit(1); }
const P = '886dc1ed-2793-453c-bc9f-2c1e251ec5de';
const LINE = 'ba9c1a62-8d71-49e5-b345-9cb44144da2c';
const GHARAMA = 53000;
const KABLA = 6, BAADA = 1;
const SABABU = 'Hesabu ya 13/10 ilikosewa: 6 badala ya 1 (Chief, 02/11)';   // also the journal memo = reference_number
const TAREHE = '2026-10-31';
const REJEA = `MAREKEBISHO-COUNT-ADJ-${LINE}`;
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
    out = process.env.LSMS_63_SQL === 'bash'
      ? execFileSync('bash', ['-c', remote], { input: text, encoding: 'utf8' })
      : execFileSync('ssh', [...SSHO, 'contabo', remote], { input: text, encoding: 'utf8' });
  }
  return out.split(/\r?\n/).filter(Boolean);
}

function kagua({ quiet = false } = {}) {
  const lines = sql(fs.readFileSync('analysis/steps/63-jagger-kagua.sql', 'utf8'));
  if (!quiet) for (const l of lines) console.log(l);
  const row = (tag) => lines.find((l) => l.startsWith(tag + '|'))?.split('|') ?? null;
  const b = row('J63_BIDHAA'), n = row('J63_NANGA');
  return {
    imekamilika: lines.includes('J63_KAGUA_IMEKAMILIKA'),
    oktoba: lines.find((l) => l.startsWith('J63_KIPINDI|10|'))?.split('|')[2],
    bidhaa: b && { stock: Number(b[3]), gharama: Number(b[4]), ya_mwisho: Number(b[5]), imefutwa: b[6] === 'true' },
    nanga: n && { qty: Number(n[2]), kiasi: Number(n[3]), ref: n[4], movement: n[6], bei: Number(n[7]) },
    cr: lines.filter((l) => l.startsWith('J63_HESABU_CR|')).map((l) => { const x = l.split('|'); return { akaunti: x[1], kiasi: Number(x[2]), journal: x[3] }; }),
    nanga1200: Number(row('J63_NANGA_1200')?.[1]),
    mwendoBaada: Number(row('J63_MWENDO_BAADA')?.[1]), mwendoBaadaOrodha: row('J63_MWENDO_BAADA')?.[2],
    mauzo: Number(row('J63_MAUZO_TANGU')?.[1]), mauzoOrodha: row('J63_MAUZO_TANGU')?.[2],
    mwendoIpo: Number(row('J63_MWENDO_IPO')?.[1]),
    journalIpo: Number(row('J63_JOURNAL_IPO')?.[1]),
    auditIpo: Number(row('J63_AUDIT_IPO')?.[1]),
    tb: Number(row('J63_TB')?.[1]),
  };
}

function kaguaChecks(k) {
  check('63.k1 kagua imekamilika', k.imekamilika, 'SQL ya kagua ilifika mwisho');
  check('63.k2 Oktoba iko wazi (au journal ya 31/10 imeshaandikwa)', k.oktoba === 'OPEN' || k.journalIpo === 1, `Oktoba ${k.oktoba}`);
  check('63.k3 gharama ya Jagger ni 53,000 (inabaki)', !!k.bidhaa && !k.bidhaa.imefutwa && same(k.bidhaa.gharama, GHARAMA) && same(k.bidhaa.ya_mwisho, GHARAMA),
    `wastani ${money(k.bidhaa?.gharama)}, ya mwisho ${money(k.bidhaa?.ya_mwisho)}, imefutwa=${k.bidhaa?.imefutwa}`);
  check('63.k4 hesabu ya 13/10: +5 kwa 53,000 (1 -> 6), 265,000', !!k.nanga && k.nanga.qty === 5 && same(k.nanga.kiasi, 265000) && k.nanga.movement === '1->6' && same(k.nanga.bei, GHARAMA),
    k.nanga ? `qty ${k.nanga.qty}, ${money(k.nanga.kiasi)}, ${k.nanga.movement}, bei ${k.nanga.bei}` : 'HAIPO');
  check('63.k5 journal ya 13/10 ilipa credit akaunti MOJA tu, kiasi = marekebisho', k.cr.length === 1 && same(k.cr[0].kiasi, k.nanga?.kiasi) && same(k.nanga1200, k.nanga?.kiasi),
    k.cr.map((c) => `Cr ${c.akaunti} ${money(c.kiasi)} (${c.journal})`).join('; ') + ` / Dr 1200 ${money(k.nanga1200)}`);
  check('63.k6 hakuna mwendo wa stock wa Jagger tangu 13/10 (isipokuwa wa hatua hii)', k.mwendoBaada === 0, `${k.mwendoBaada}: ${k.mwendoBaadaOrodha}`);
  check('63.k7 hakuna mauzo ya Jagger tangu 13/10', k.mauzo === 0, `${k.mauzo}: ${k.mauzoOrodha}`);
  const stockSawa = k.mwendoIpo === 0 ? k.bidhaa?.stock === KABLA : k.bidhaa?.stock === BAADA;
  check(`63.k8 stock ya mfumo ${k.mwendoIpo === 0 ? `bado ${KABLA}` : `${BAADA} (marekebisho yapo)`}`, stockSawa, `stock ${k.bidhaa?.stock}`);
  check('63.k9 kila sehemu imeandikwa mara 0 au 1', [k.journalIpo, k.mwendoIpo, k.auditIpo].every((c) => c === 0 || c === 1),
    `journal ${k.journalIpo}, movement ${k.mwendoIpo}, audit ${k.auditIpo}`);
  check('63.k10 TB 0', same(k.tb, 0), money(k.tb));
  const dr = k.cr.length === 1 ? k.cr[0].akaunti : '?';
  if (k.cr.length === 1) console.log(`PREVIEW 63: 13/10 Cr ${dr} ${money(k.cr[0].kiasi)} (${k.cr[0].journal}) -> journal Dr ${dr}`);
  console.log(`PREVIEW 63: journal ${TAREHE} Dr ${dr} ${money(k.nanga?.kiasi)} / Cr 1200 ${money(k.nanga?.kiasi)} "${SABABU}"${k.journalIpo ? ' (TAYARI IPO - itarukwa)' : ''}`);
  console.log(`PREVIEW 63: stock movement ADJUSTMENT -5 (${KABLA} -> ${BAADA}), bei ${money(GHARAMA)}, rejea ${REJEA}${k.mwendoIpo ? ' (TAYARI IPO - itarukwa)' : ''}`);
  console.log(`PREVIEW 63: gharama inabaki ${money(GHARAMA)}; baada: stock ${BAADA}, thamani ${money(BAADA * GHARAMA)}`);
}

const k = kagua();
kaguaChecks(k);

if (MODE === 'kagua') {
  if (!failed()) {
    fs.writeFileSync(SAVED, JSON.stringify({ saa: new Date().toISOString(), dr: k.cr[0].akaunti, kiasi: k.nanga.kiasi, journal13: k.cr[0].journal,
      stock: k.bidhaa.stock, gharama: k.bidhaa.gharama }, null, 2));
    console.log(`preview imehifadhiwa: ${SAVED}`);
  }
  finish('63 jagger kagua');
}

// ── andika ──────────────────────────────────────────────────────────────────
if (failed()) finish('63 jagger andika');
if (!fs.existsSync(SAVED)) { check('63.a0 preview', false, `${SAVED} haipo - endesha kagua kwanza`); finish('63 jagger andika'); }
const s = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
check('63.a1 namba ni zilezile za preview', s.dr === k.cr[0].akaunti && same(s.kiasi, k.nanga.kiasi) && s.journal13 === k.cr[0].journal
  && same(s.gharama, k.bidhaa.gharama) && (s.stock === k.bidhaa.stock || (k.mwendoIpo === 1 && k.bidhaa.stock === BAADA)),
  `Dr ${s.dr} -> ${k.cr[0].akaunti}; ${money(s.kiasi)} -> ${money(k.nanga.kiasi)}; stock ${s.stock} -> ${k.bidhaa.stock}`);
if (failed()) { console.log('SIMAMA: data imebadilika tangu preview - endesha kagua upya'); finish('63 jagger andika'); }

const who = await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const ceoEmail = String(who.tokenInfo?.email ?? process.env.CEO_EMAIL).replace(/'/g, '');
const today = new Date().toISOString().slice(0, 10);
const tb0 = await tbAll(today);
const tarajio = {};

// 1) Journal 31/10.
if (k.journalIpo > 0) {
  check('63.a2 journal ya 31/10 tayari ipo - imerukwa', true, 'haikuandikwa tena');
} else {
  const x = Math.round(s.kiasi * 100) / 100;
  const r = await call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: TAREHE, memo: SABABU, lines: [
    { accountCode: s.dr, debit: x, credit: 0, description: `${SABABU} - rejea ${s.journal13} (COUNT-ADJ-${LINE})` },
    { accountCode: '1200', debit: 0, credit: x, description: `${SABABU} - Jagger 886dc1ed chupa 5 x 53,000` }] });
  check(`63.a2 journal ${TAREHE} Dr ${s.dr} / Cr 1200 ${money(x)} imeandikwa (API)`, r.ok, `${r.http} ${r.message} ${r.data ?? ''}`);
  if (!r.ok) finish('63 jagger andika');
  tarajio[s.dr] = x;
  tarajio['1200'] = -x;
}

// 2) Stock movement -5 + audit, one transaction, only if stock is still 6 at 53,000 and nothing moved since 13/10.
if (k.mwendoIpo > 0) {
  check('63.a3 movement ya marekebisho tayari ipo - imerukwa', true, 'hakuna SQL');
} else {
  const out = sql(`\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE st int; c numeric; n int; mv text := gen_random_uuid()::text; t timestamp := now() AT TIME ZONE 'Africa/Dar_es_Salaam';
BEGIN
  SELECT current_stock, current_average_cost INTO st, c FROM products WHERE uid = '${P}' FOR UPDATE;
  IF st IS DISTINCT FROM ${KABLA} OR c IS DISTINCT FROM ${GHARAMA}::numeric THEN
    RAISE EXCEPTION 'SIYO: stock % au gharama % si za preview (${KABLA} / ${GHARAMA})', st, c;
  END IF;
  SELECT count(*) INTO n FROM store s WHERE s.products_uid = '${P}' AND NOT coalesce(s.is_deleted, false)
     AND s.movement_date > (SELECT s2.movement_date FROM store s2 WHERE s2.reference = 'COUNT-ADJ-${LINE}' LIMIT 1);
  IF n <> 0 THEN RAISE EXCEPTION 'SIYO: kuna mwendo % wa stock tangu 13/10', n; END IF;
  IF EXISTS (SELECT 1 FROM store WHERE reference = '${REJEA}' AND NOT coalesce(is_deleted, false)) THEN
    RAISE EXCEPTION 'SIYO: movement ${REJEA} ipo tayari';
  END IF;
  INSERT INTO store (uid, created_at, is_active, is_deleted, updated_at, updated_by, initiated_by, location, movement_date, movement_type,
                     notes, quantity, reference, stock_after, stock_before, stock_status, unit_price, update_products_prices, products_uid)
  VALUES (mv, t, true, false, t, '${ceoEmail}', '${ceoEmail}', 'STORE', t, 'ADJUSTMENT',
          '${SABABU} | rejea COUNT-ADJ-${LINE} | hatua 63', ${BAADA - KABLA}, '${REJEA}', ${BAADA}, ${KABLA}, 'IN_STOCK', ${GHARAMA}, false, '${P}');
  SELECT current_stock INTO st FROM products WHERE uid = '${P}';
  IF st <> ${BAADA} THEN RAISE EXCEPTION 'SIYO: baada ya movement stock ni % (si ${BAADA})', st; END IF;
  INSERT INTO audit_trails (uid, action, module, description, additional_data, timestamp, user_email, user_uid, endpoint)
  VALUES (replace(gen_random_uuid()::text, '-', ''), 'STOCK_COUNT_CORRECTION', 'Stock',
          'JAGGER MASTER ${KABLA} -> ${BAADA} (ADJUSTMENT ${BAADA - KABLA}, bei ${GHARAMA}). ${SABABU}',
          json_build_object('productUid', '${P}', 'countingLine', '${LINE}', 'movementUid', mv, 'from', ${KABLA}, 'to', ${BAADA},
                            'unitCost', ${GHARAMA}, 'step', '63', 'journalDate', '${TAREHE}')::text,
          t, '${ceoEmail}', (SELECT uid FROM users WHERE email = '${ceoEmail}' LIMIT 1), 'hatua-63 SQL');
END $$;
COMMIT;
SELECT 'J63_BAADA|' || current_stock || '|' || current_average_cost FROM products WHERE uid = '${P}';
`, { write: true });
  for (const l of out) console.log(l);
  check('63.a3 movement -5 imeandikwa, stock 1 (SQL)', out.includes(`J63_BAADA|${BAADA}|${GHARAMA}.00`), out.filter((l) => l.startsWith('J63_BAADA')).join(' '));
}

// 3) Checks after.
const tb1 = await tbAll(today);
deltaTB('63.a4', 'ya hatua hii', tb0, tb1, tarajio,
  'Rollback: reverse journal ya memo hii kupitia GL, na futa (is_deleted) movement ya marekebisho kwa SQL - niletee log kwanza.');
const after = kagua({ quiet: true });
check('63.a5 journal ipo mara moja tu', after.journalIpo === 1, `${after.journalIpo}`);
check('63.a6 movement na audit vipo mara moja tu', after.mwendoIpo === 1 && after.auditIpo === 1, `movement ${after.mwendoIpo}, audit ${after.auditIpo}`);
check(`63.a7 stock ${BAADA}, gharama ${money(GHARAMA)}, thamani ${money(BAADA * GHARAMA)}`, after.bidhaa.stock === BAADA && same(after.bidhaa.gharama, GHARAMA),
  `stock ${after.bidhaa.stock} x ${money(after.bidhaa.gharama)} = ${money(after.bidhaa.stock * after.bidhaa.gharama)}`);
check('63.a8 TB 0', same(after.tb, 0), money(after.tb));
finish('63 jagger andika');
