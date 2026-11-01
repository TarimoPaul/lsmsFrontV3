// HATUA 63 (mmiliki 01/11 bo, bp) - Jagger Master: carton ya chupa 6 iliyoingizwa 11/10 kama chupa 1 kwa 53,000.
//   kagua  : SQL ya kusoma tu (63-jagger-kagua.sql) -> kiasi kwa njia mbili (A, B; lazima zilingane), J1/J2, mauzo tangu
//            11/10, preview -> analysis/steps/63-kagua-<TARGET>.json. Haiandiki kitu.
//   andika : kagua upya; namba lazima ziwe zile za preview (vinginevyo SIMAMA). Njia inategemea Oktoba (bp):
//            - Oktoba OPEN  : J1 31/10 Dr <X> / Cr 1200 = ziada ya 1200 mwisho wa 31/10; J2 01/11 Dr 1200 / Cr 5000 =
//                             COGS ya ziada ya mauzo ya Jagger kuanzia 01/11 (ikiwa tu ipo). J1 - J2 = A = B.
//            - Oktoba CLOSED: journal MOJA 01/11 Dr <X> / Cr 1200 = A.
//            <X> (bq) = akaunti iliyopewa credit na journal ya count adjustment ya 13/10, inasomwa kutoka prod (si 5100 ya kudhani).
//            Kila journal inaandikwa kupitia API na inarukwa ikiwa ipo tayari (kuendelea baada ya kukatika).
//            Kisha gharama ya Jagger -> gharama sahihi kwa SQL (transaction moja: price_history + audit_trails pamoja
//            na UPDATE), ikiwa tu gharama na stock bado ni za preview; inarukwa ikiwa tayari sahihi.
//            Ukaguzi: kila journal mara moja, gharama sahihi, thamani = chupa x gharama sahihi, delta ya TB, TB 0.
// Mazingira: TARGET=prod|staging, PROD_API / API, CEO_EMAIL, CEO_PASS; LSMS_63_SQL=local (Docker-local) au bash (jaribio
//   la amri ya server), vinginevyo ssh contabo (~/lsms-deployment, output kupitia /tmp/ficha-lsms.awk ambayo .cmd inaipakia).
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TARGET, check, failed, login, call, tbAll, deltaTB, finish, money, same } from './45-lib.mjs';

const MODE = process.argv[2];
if (!['kagua', 'andika'].includes(MODE)) { console.log('matumizi: node 63-rekebisha-jagger.mjs kagua|andika'); process.exit(1); }
const P = '886dc1ed-2793-453c-bc9f-2c1e251ec5de';
// Memo = reference_number (varchar 100) of the manual journal, and the key that finds it again.
const JR = {
  MOJA: { memo: 'Marekebisho ya Oktoba: Jagger carton kama chupa (11/10)', date: '2026-11-01' },
  J1: { memo: 'J1 31/10: Jagger carton kama chupa (11/10) - ziada ya 1200', date: '2026-10-31' },
  J2: { memo: 'J2 01/11: Jagger carton kama chupa (11/10) - COGS ya ziada Nov', date: '2026-11-01' },
};
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
function kagua({ quiet = false } = {}) {
  const lines = sql(fs.readFileSync('analysis/steps/63-jagger-kagua.sql', 'utf8'));
  if (!quiet) for (const l of lines) console.log(l);
  const row = (tag) => lines.find((l) => l.startsWith(tag + '|'))?.split('|') ?? null;
  const kv = (r) => Object.fromEntries((r ?? []).slice(1).map((x) => { const i = x.lastIndexOf(' '); return [x.slice(0, i), Number(x.slice(i + 1))]; }));
  const b = row('J63_BIDHAA'), n = row('J63_NANGA'), mw = row('J63_MWENDO_MWINGINE'), tb = row('J63_TB');
  const kip = Object.fromEntries(lines.filter((l) => l.startsWith('J63_KIPINDI|')).map((l) => l.split('|').slice(1)));
  const ipo = Object.fromEntries(lines.filter((l) => l.startsWith('J63_JOURNAL_IPO|')).map((l) => { const x = l.split('|'); return [x[1], Number(x[2])]; }));
  return {
    imekamilika: lines.includes('J63_KAGUA_IMEKAMILIKA'),
    bidhaa: b && { jina: b[2], chupaKwaCarton: Number(b[3]), gharama: Number(b[4]), stock: Number(b[6]) },
    nanga: n && { idadi: Number(n[1]), jumla: Number(n[3]), chupa: Number(n[5]), njia: n[6], stockKabla: Number(n[8]) },
    mwendoMwingine: mw ? Number(mw[1]) : NaN,
    stockMwisho: mw ? Number(mw[2].split(' ')[1]) : NaN,
    h: kv(row('J63_HESABU')),
    h2: kv(row('J63_HESABU2')),
    ipo,
    // (bq) account(s) credited by the count adjustment journal(s): J1 / MOJA debit that same account.
    cr: lines.filter((l) => l.startsWith('J63_HESABU_CR|')).map((l) => { const x = l.split('|'); return { akaunti: x[1], kiasi: Number(x[2]), journal: x[3] }; }),
    tb: tb ? Number(tb[1]) : NaN,
    oktoba: kip['10'],
    novemba: kip['11'],
  };
}

/** Which journals this correction is made of, and their amounts (bp). Once any of them exists, its path is kept. */
function mpango(k) {
  const open = k.ipo.J1 > 0 || k.ipo.J2 > 0 || (k.ipo.MOJA === 0 && k.oktoba === 'OPEN');
  const dr = k.cr.length === 1 ? k.cr[0].akaunti : null;
  if (!open) return { njia: 'OKTOBA_IMEFUNGWA', journals: [{ key: 'MOJA', dr, cr: '1200', kiasi: k.h.A }] };
  const j = [{ key: 'J1', dr, cr: '1200', kiasi: k.h2.J1 }];
  if (k.h2.J2 > 0.005 || k.ipo.J2 > 0) j.push({ key: 'J2', dr: '1200', cr: '5000', kiasi: k.h2.J2 });
  return { njia: 'OKTOBA_WAZI', journals: j };
}

function kaguaChecks(k, m) {
  const h = k.h;
  check('63.k1 kagua imekamilika', k.imekamilika, 'SQL ya kagua ilifika mwisho');
  check('63.k2 bidhaa', !!k.bidhaa && k.bidhaa.chupaKwaCarton === 6, `${k.bidhaa?.jina}: chupa ${k.bidhaa?.chupaKwaCarton} kwa carton, gharama ${money(k.bidhaa?.gharama)}, stock ${k.bidhaa?.stock}`);
  check('63.k3 manunuzi ya 11/10: moja, PER_PIECE, stock ilikuwa 0', k.nanga?.idadi === 1 && k.nanga.njia === 'PER_PIECE' && k.nanga.stockKabla === 0,
    `idadi ${k.nanga?.idadi}, ${k.nanga?.njia}, jumla ${money(k.nanga?.jumla)}, chupa kwa carton ${k.nanga?.chupa}, stock kabla ${k.nanga?.stockKabla}`);
  check('63.k4 hakuna mwendo mwingine wa stock (si manunuzi/hesabu/mauzo) tangu 11/10', k.mwendoMwingine === 0, `${k.mwendoMwingine}`);
  check('63.k5 stock ya bidhaa = stock ya mwendo wa mwisho', k.bidhaa?.stock === k.stockMwisho, `${k.bidhaa?.stock} / ${k.stockMwisho}`);
  check('63.k6 gharama sahihi = carton / chupa', same(h.gharama_sahihi, Math.round((k.nanga?.jumla / k.nanga?.chupa) * 100) / 100), money(h.gharama_sahihi));
  const fixed = same(h.gharama_ya_sasa, h.gharama_sahihi);
  // A and B are two independent counts of the same excess; once the cost is fixed, B is 0.
  check('63.k7 A = B (njia mbili zinakubaliana)', fixed ? same(h.B, 0) : Math.abs(h.A - h.B) <= 1, `A ${money(h.A)}, B ${money(h.B)}${fixed ? ' (gharama tayari sahihi)' : ''}`);
  check('63.k8 kiasi ni chanya', h.A > 0, money(h.A));
  check('63.k9 Novemba iko wazi', k.novemba === 'OPEN', String(k.novemba));
  const jumla = m.journals.reduce((s, j) => s + (j.cr === '1200' ? j.kiasi : -j.kiasi), 0);
  check(`63.k10 ${m.njia}: ${m.journals.map((j) => j.key).join(' - ')} = A`, Math.abs(jumla - h.A) <= 0.01, `${m.journals.map((j) => `${j.key} ${money(j.kiasi)}`).join(', ')} -> ${money(jumla)} / A ${money(h.A)}`);
  check('63.k11 kila journal imeandikwa mara 0 au 1', Object.values(k.ipo).every((c) => c === 0 || c === 1), JSON.stringify(k.ipo));
  check('63.k12 njia moja tu: MOJA haichanganywi na J1/J2', !(k.ipo.MOJA > 0 && (k.ipo.J1 > 0 || k.ipo.J2 > 0)), JSON.stringify(k.ipo));
  check('63.k13 J1 ya 31/10 inahitaji Oktoba wazi (au imeshaandikwa)', m.njia !== 'OKTOBA_WAZI' || k.ipo.J1 > 0 || k.oktoba === 'OPEN', `Oktoba ${k.oktoba}`);
  check('63.k14 TB 0', same(k.tb, 0), money(k.tb));
  check('63.k15 count adjustment ilipa credit akaunti MOJA tu, kiasi = marekebisho', k.cr.length === 1 && same(k.cr[0].kiasi, h.marekebisho),
    k.cr.map((c) => `Cr ${c.akaunti} ${money(c.kiasi)} (${c.journal})`).join('; ') + ` / marekebisho ${money(h.marekebisho)}`);
  if (k.cr.length === 1) console.log(`PREVIEW 63: 13/10 Cr ${k.cr[0].akaunti} ${money(k.cr[0].kiasi)} (${k.cr[0].journal}) -> ${m.journals[0].key} Dr ${k.cr[0].akaunti}`);
  console.log(`PREVIEW 63: Oktoba ${k.oktoba} -> ${m.njia}`);
  for (const j of m.journals) {
    console.log(`PREVIEW 63: ${j.key} ${JR[j.key].date} Dr ${j.dr} ${money(j.kiasi)} / Cr ${j.cr} ${money(j.kiasi)} "${JR[j.key].memo}"${k.ipo[j.key] ? ' (TAYARI IPO - itarukwa)' : ''}`);
  }
  console.log(`PREVIEW 63: gharama ya Jagger ${money(h.gharama_ya_sasa)} -> ${money(h.gharama_sahihi)}${fixed ? ' (TAYARI - itarukwa)' : ''}; chupa ${h.chupa_zilizopo}; thamani baada = ${money(h.thamani_sahihi)}`);
  console.log(`PREVIEW 63: mauzo ya Jagger tangu 11/10: chupa ${h.chupa_zilizouzwa}, COGS ${money(h.COGS)}; kuanzia 01/11: chupa ${k.h2.chupa_nov} (orodha: J63_MAUZO juu)`);
}

const k = kagua();
const m = mpango(k);
kaguaChecks(k, m);

if (MODE === 'kagua') {
  if (!failed()) {
    fs.writeFileSync(SAVED, JSON.stringify({ saa: new Date().toISOString(), njia: m.njia, journals: m.journals, A: k.h.A, B: k.h.B,
      chupa: k.h.chupa_zilizopo, gharamaYaSasa: k.h.gharama_ya_sasa, gharamaSahihi: k.h.gharama_sahihi }, null, 2));
    console.log(`preview imehifadhiwa: ${SAVED}`);
  }
  finish('63 jagger kagua');
}

// ── andika ──────────────────────────────────────────────────────────────────
if (failed()) finish('63 jagger andika');
if (!fs.existsSync(SAVED)) { check('63.a0 preview', false, `${SAVED} haipo - endesha kagua kwanza`); finish('63 jagger andika'); }
const s = JSON.parse(fs.readFileSync(SAVED, 'utf8'));
const h = k.h;
const fixedNow = same(h.gharama_ya_sasa, h.gharama_sahihi);
const sameJournals = s.njia === m.njia && s.journals.length === m.journals.length
  && s.journals.every((j, i) => j.key === m.journals[i].key && j.dr === m.journals[i].dr && same(j.kiasi, m.journals[i].kiasi));
check('63.a1 namba ni zilezile za preview', sameJournals && same(h.A, s.A) && h.chupa_zilizopo === s.chupa && same(h.gharama_sahihi, s.gharamaSahihi)
  && (fixedNow || (same(h.B, s.B) && same(h.gharama_ya_sasa, s.gharamaYaSasa))),
  `${s.njia} -> ${m.njia}; ${s.journals.map((j) => `${j.key} ${money(j.kiasi)}`).join(', ')} -> ${m.journals.map((j) => `${j.key} ${money(j.kiasi)}`).join(', ')}; chupa ${s.chupa} -> ${h.chupa_zilizopo}; gharama ${money(s.gharamaYaSasa)} -> ${money(h.gharama_ya_sasa)}`);
if (failed()) { console.log('SIMAMA: data imebadilika tangu preview (mf. mauzo ya Jagger) - endesha kagua upya'); finish('63 jagger andika'); }

const who = await login(process.env.CEO_EMAIL, process.env.CEO_PASS);
const ceoEmail = String(who.tokenInfo?.email ?? process.env.CEO_EMAIL).replace(/'/g, '');
const today = new Date().toISOString().slice(0, 10);
const tb0 = await tbAll(today);

// 1) Journals, each on its own (skipped when already there).
const tarajio = {};
const add = (code, v) => { tarajio[code] = Math.round(((tarajio[code] ?? 0) + v) * 100) / 100; };
for (const j of m.journals) {
  if (k.ipo[j.key] > 0) { check(`63.a2 ${j.key} tayari ipo - imerukwa`, true, 'haikuandikwa tena'); continue; }
  const x = Math.round(j.kiasi * 100) / 100;
  const r = await call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: JR[j.key].date, memo: JR[j.key].memo, lines: [
    { accountCode: j.dr, debit: x, credit: 0, description: `Jagger carton kama chupa (11/10): ${j.key}` },
    { accountCode: j.cr, debit: 0, credit: x, description: `Jagger carton kama chupa (11/10): ${j.key}` }] });
  check(`63.a2 ${j.key} ${JR[j.key].date} imeandikwa (API)`, r.ok, `${r.http} ${r.message} ${r.data ?? ''}`);
  if (!r.ok) finish('63 jagger andika');
  add(j.dr, x);
  add(j.cr, -x);
}

// 2) Cost, with its audit lines, in one transaction (only if cost and stock are still those of the preview).
if (!fixedNow) {
  const sababu = 'Hatua 63: Jagger carton ya chupa 6 iliingizwa 11/10 kama chupa 1 kwa 53,000 (mmiliki 01/11 bo, bp)';
  const out = sql(`\\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE c numeric; st int;
BEGIN
  SELECT current_average_cost, current_stock INTO c, st FROM products WHERE uid = '${P}' FOR UPDATE;
  IF c IS DISTINCT FROM ${s.gharamaYaSasa}::numeric OR st IS DISTINCT FROM ${s.chupa} THEN
    RAISE EXCEPTION 'SIYO: gharama % au stock % si za preview (${s.gharamaYaSasa} / ${s.chupa})', c, st;
  END IF;
  UPDATE products SET current_average_cost = ${s.gharamaSahihi}, last_purchase_cost = ${s.gharamaSahihi}, updated_at = now(),
         updated_by = '${ceoEmail}' WHERE uid = '${P}';
  IF NOT FOUND THEN RAISE EXCEPTION 'SIYO: bidhaa haikubadilika'; END IF;
  INSERT INTO price_history (uid, created_at, is_active, is_deleted, updated_by, change_date, old_purchase_price, new_purchase_price, reason, product_uid)
  VALUES (gen_random_uuid()::text, now() AT TIME ZONE 'Africa/Dar_es_Salaam', true, false, '${ceoEmail}', now() AT TIME ZONE 'Africa/Dar_es_Salaam',
          c, ${s.gharamaSahihi}, '${sababu}', '${P}');
  INSERT INTO audit_trails (uid, action, module, description, additional_data, timestamp, user_email, user_uid, endpoint)
  VALUES (replace(gen_random_uuid()::text, '-', ''), 'PRODUCT_COST_CORRECTION', 'Products',
          'Gharama ya JAGGER MASTER ' || c || ' -> ${s.gharamaSahihi}. ${sababu}',
          json_build_object('productUid', '${P}', 'oldCost', c, 'newCost', ${s.gharamaSahihi}, 'stock', st, 'step', '63',
                            'journals', '${m.journals.map((j) => j.key).join(',')}')::text,
          now() AT TIME ZONE 'Africa/Dar_es_Salaam', '${ceoEmail}', (SELECT uid FROM users WHERE email = '${ceoEmail}' LIMIT 1), 'hatua-63 SQL');
END $$;
COMMIT;
SELECT 'J63_GHARAMA_BAADA|' || current_average_cost || '|' || last_purchase_cost || '|' || current_stock FROM products WHERE uid = '${P}';
SELECT 'J63_AUDIT|' || count(*) FROM audit_trails WHERE action = 'PRODUCT_COST_CORRECTION' AND additional_data LIKE '%${P}%';
SELECT 'J63_PRICE_HISTORY|' || count(*) FROM price_history WHERE product_uid = '${P}' AND new_purchase_price = ${s.gharamaSahihi};
`, { write: true });
  for (const l of out) console.log(l);
  const g = out.find((l) => l.startsWith('J63_GHARAMA_BAADA|'))?.split('|') ?? [];
  check('63.a3 gharama ya Jagger imerekebishwa (SQL)', same(g[1], s.gharamaSahihi) && same(g[2], s.gharamaSahihi), `${g[1]} / ${g[2]}`);
  check('63.a3b audit: audit_trails 1 na price_history 1', out.includes('J63_AUDIT|1') && out.includes('J63_PRICE_HISTORY|1'),
    out.filter((l) => /J63_(AUDIT|PRICE)/.test(l)).join(' '));
} else {
  check('63.a3 gharama tayari sahihi - imerukwa', true, money(h.gharama_ya_sasa));
}

// 3) Checks after.
const tb1 = await tbAll(today);
deltaTB('63.a4', 'ya hatua hii', tb0, tb1, tarajio,
  'Rollback: reverse journal za memo hizi kupitia GL, na rudisha gharama kwa SQL - niletee log kwanza.');
const after = kagua({ quiet: true });
for (const j of m.journals) check(`63.a5 ${j.key} ipo mara moja tu`, after.ipo[j.key] === 1, `${after.ipo[j.key]}`);
check('63.a5b njia nyingine haina journal', m.njia === 'OKTOBA_WAZI' ? after.ipo.MOJA === 0 : after.ipo.J1 === 0 && after.ipo.J2 === 0, JSON.stringify(after.ipo));
check('63.a6 gharama ya Jagger = gharama sahihi', same(after.h.gharama_ya_sasa, s.gharamaSahihi), money(after.h.gharama_ya_sasa));
check('63.a7 thamani ya stock ya Jagger = chupa x gharama sahihi', same(after.h.B, 0)
  && same(after.h.chupa_zilizopo * after.h.gharama_ya_sasa, after.h.thamani_sahihi),
  `${after.h.chupa_zilizopo} x ${money(after.h.gharama_ya_sasa)} = ${money(after.h.thamani_sahihi)}`);
check('63.a8 TB 0', same(after.tb, 0), money(after.tb));
finish('63 jagger andika');
