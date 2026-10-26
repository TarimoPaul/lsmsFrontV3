// HATUA 57d (mmiliki 26/10) - VIPIMO VYA VIPINDI VILIVYOFUNGWA kwenye STAGING (backend 2.2.72, Postgres halisi). INAANDIKA STAGING TU.
//   TARGET=staging API=http://localhost:8081 ROOT_PASS=... node analysis/steps/57d-gl-vipindi.mjs
// Inahitaji: tunnel (analysis\steps\tunnel.cmd) na /tmp/ficha-lsms.awk kwenye Contabo (57d-staging-gl-vipindi.cmd inaipeleka).
// SQL ya staging inapita ssh -> docker compose -p lsms-staging exec postgres psql -> ficha.awk (kwenye server).
//  1) lock ya close vs post: kikao cha psql kinashika lock ya SHARED ya PostingEngine (pg_advisory_xact_lock_shared(1280527699,
//     hashtext('lsms:gl_period')) - funguo mbili, ileile ya kila journal) kwa sek 20; close ya 2026-09 inayotumwa katikati lazima
//     ISUBIRI (>= sek 5) na kufanikiwa baada ya lock kuachwa. Ikiwa 2026-09 tayari CLOSED, inafunguliwa upya kwanza (sababu inaandikwa).
//     1b) post HALISI wakati close inasubiri: journal ya mkono ya leo (6100/1000 x 1) - close na post zote zinamalizika (hakuna
//     deadlock, < sek 90), kisha journal hiyo inageuzwa (reverse ya leo) ili salio lisibadilike.
//     1c) close iliendesha control-checks ndani ya transaction yake bila kosa (data.controlChecks ipo, controlChecksError haipo).
//  2) 2026-09 CLOSED: repost-sale, /reverse, journal ya mkono ya 20/09, backfill, DELETE /entries -> zote zinakataliwa, hakuna
//     journal mpya.
//  3) retry -> late entry: safu ya majaribio kwenye gl_posting_failure (EXPENSE_DIRECT, 15/09, 6100/1000 x 1,000) ->
//     POST retry -> journal entry_date = siku ya kwanza iliyo wazi (01/10), event_date 15/09, is_late_entry, safu resolved RETRIED.
//  4) reversal iliyokataliwa na scheduler: safu ya GL_REVERSAL (journal ya 09) -> retry -> bado inakataliwa (09 CLOSED), attempts 2,
//     hakuna reversal mpya; mwisho safu inafungwa (resolution QA_57D) ili isizuie kufunga Oktoba kwenye staging.
// Mwisho: 2026-09 inabaki CLOSED (kama prod tangu 47 ya 22/10); journal ya late entry ya majaribio inabaki kwenye staging.
import { spawn, spawnSync } from 'node:child_process';
import { API, TARGET, check, login, call, finish, today } from './45-lib.mjs';

if (TARGET !== 'staging') { console.log('IMEKATALIWA: 57d ni ya staging tu (TARGET=staging)'); process.exit(1); }
const SSHO = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4'];
const FICHA = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk";
const REMOTE = `set -o pipefail; cd ~/lsms-staging && { docker compose -p lsms-staging exec -T postgres psql -X -q -At -F'|' -v ON_ERROR_STOP=1 -U postgres -d Lsms; } 2>&1 | ${FICHA}`;
// ficha.awk inaandika muhtasari wake ("[ficha] ...") kwenye stdout ileile: unasomwa KANDO (26/10 o) ili usichanganywe na safu za
// SQL. Ikiwa ficha imeficha/kubadilisha mstari wowote, matokeo hayaaminiki -> ok = false.
const FICHA_MSTARI = /^\[ficha\] /;
const sql = (text) => {
  const r = spawnSync('ssh', [...SSHO, 'contabo', REMOTE], { input: text, encoding: 'utf8', timeout: 120000 });
  const all = (r.stdout || '').split('\n').map((l) => l.replace(/\r$/, ''));
  const ficha = all.filter((l) => FICHA_MSTARI.test(l));
  const fichwa = ficha.map((l) => Number((l.match(/iliyofichwa\/kubadilishwa: (\d+)/) ?? [])[1] ?? NaN)).some((n) => n !== 0);
  if (fichwa || ficha.length !== 1) console.log(`FICHA_ONYO: muhtasari wa ficha ${JSON.stringify(ficha)} - matokeo ya SQL hayaaminiki`);
  return { ok: r.status === 0 && !fichwa && ficha.length === 1, out: all.filter((l) => !FICHA_MSTARI.test(l)).join('\n').trim(), err: (r.stderr || '').trim() };
};
// boolean ya psql kwa thamani (t/true, f/false), si maandishi (26/10 o)
const bool = (v) => (v === 't' || v === 'true' ? true : v === 'f' || v === 'false' ? false : null);
const rows = (text) => { const r = sql(text); if (!r.ok) console.log('SQL_KOSA', r.out.slice(0, 300), r.err.slice(0, 200)); return r.ok ? r.out.split('\n').filter(Boolean) : null; };
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const imefungwa = (m) => /kimefungwa|imefungwa|closed/i.test(String(m ?? ''));
const journals = (ref) => Number((rows(`SELECT count(*) FROM journal_entry WHERE reference_uid = '${ref}';`) ?? ['-1'])[0]);

console.log(`57d STAGING ${API} - saa ${new Date().toISOString()}`);
const ping = sql("SELECT 'SQL_SAWA|' || current_database() || '|' || (SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1);");
check('sql-ya-staging', ping.ok && ping.out.startsWith('SQL_SAWA|'), `ssh+psql ya staging: ${ping.out.slice(0, 120)}`);
if (!ping.ok) finish('57d gl vipindi');
await login('root@system.com', process.env.ROOT_PASS, { allowRoot: true });
const st = await call('GET', '/api/v1/gl/status');
console.log('GL_STATUS', JSON.stringify(st.data ?? st.message).slice(0, 300));

// ---- 1) lock ya close vs post ----
const sep = async () => ((await call('GET', '/api/v1/gl/periods')).data ?? []).find((p) => p.year === 2026 && p.month === 9);
let p9 = await sep();
console.log('2026-09 kabla:', JSON.stringify(p9));
if (p9?.status === 'CLOSED') {
  const ro = await call('POST', '/api/v1/gl/periods/2026/9/reopen', { reason: '57d staging: kufungua upya ili kupima lock ya close (2.2.72)' });
  check('1-fungua-upya-2026-09', ro.ok, `reopen 2026-09: ${ro.message}`);
}
const holder = spawn('ssh', [...SSHO, 'contabo', REMOTE], { stdio: ['pipe', 'pipe', 'pipe'] });
let hout = '';
holder.stdout.on('data', (d) => { hout += d; });
holder.stderr.on('data', (d) => { hout += d; });
const hdone = new Promise((res) => holder.on('close', (code) => res(code)));
holder.stdin.end("BEGIN;\nSELECT pg_advisory_xact_lock_shared(1280527699, hashtext('lsms:gl_period'));\nSELECT 'LOCK_IMESHIKWA|' || clock_timestamp();\nSELECT pg_sleep(20);\nCOMMIT;\nSELECT 'LOCK_IMEACHWA|' || clock_timestamp();\n");
await sleep(8000);
const t0 = Date.now();
let tClose = null, tPost = null;
const clP = call('POST', '/api/v1/gl/periods/2026/9/close', { reason: '57d staging: jaribio la lock ya close vs post (2.2.72)' })
  .then((r) => { tClose = Date.now() - t0; return r; });
await sleep(2000);
const mjP = call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: today, memo: '57d 1b: post wakati close inasubiri',
  lines: [{ accountCode: '6100', debit: 1, credit: 0 }, { accountCode: '1000', debit: 0, credit: 1 }] })
  .then((r) => { tPost = Date.now() - t0; return r; });
const timeout = new Promise((res) => setTimeout(() => res('MUDA'), 90000));
const both = await Promise.race([Promise.all([clP, mjP]), timeout]);
if (both === 'MUDA') { check('1b-hakuna-deadlock', false, 'close/post hazikumalizika ndani ya sek 90 - DEADLOCK?'); finish('57d gl vipindi'); }
const [cl, mj1b] = both;
const d = tClose;
const hcode = await hdone;
console.log(hout.trim().split('\n').map((l) => `  holder: ${l}`).join('\n'));
check('1-lock-ilishikwa', hcode === 0 && hout.includes('LOCK_IMESHIKWA|') && hout.includes('LOCK_IMEACHWA|'), `kikao cha lock: exit ${hcode}`);
check('1-close-ilisubiri-lock', cl.ok && d >= 5000, `close 2026-09: ${cl.ok ? 'imefungwa' : cl.message} baada ya ${(d / 1000).toFixed(1)}s (lazima >= 5s - ilisubiri lock ya shared)`);
check('1b-hakuna-deadlock', mj1b.ok, `post ya leo wakati close inasubiri: ${mj1b.ok ? 'imeandikwa' : mj1b.message} baada ya ${(tPost / 1000).toFixed(1)}s; close ${(tClose / 1000).toFixed(1)}s`);
console.log(`1b-mpangilio: ${tPost >= tClose ? 'post ilimalizika BAADA ya close (ilisubiri foleni ya exclusive)' : 'post ilimalizika KABLA ya close'}`);
if (mj1b.ok && mj1b.data) {
  const rv = await call('POST', `/api/v1/gl/reverse?referenceUid=${encodeURIComponent(mj1b.data)}&reason=${encodeURIComponent('57d 1b: kurudisha journal ya majaribio')}`);
  check('1b-journal-ya-majaribio-imegeuzwa', rv.ok, `reverse ${mj1b.data}: ${rv.status} ${String(rv.message).slice(0, 160)}`);
}
const cc = cl.data ?? {};
check('1c-close-iliendesha-control-checks', cl.ok && Array.isArray(cc.controlChecks) && !('controlChecksError' in cc),
  `controlChecks ${Array.isArray(cc.controlChecks) ? cc.controlChecks.length + ' safu' : '-'}; controlChecksError ${cc.controlChecksError ?? '-'}`);
p9 = await sep();
check('1-2026-09-CLOSED', p9?.status === 'CLOSED', `2026-09 baada: ${JSON.stringify(p9)}`);
if (p9?.status !== 'CLOSED') finish('57d gl vipindi');

// ---- 2) njia za marekebisho zinakataliwa ----
// 2a: sale ya 09 isiyo na journal (ikiwepo) ndiyo inagusa kinga; sale yenye journal inajibiwa "Tayari imepostiwa" kabla ya kinga.
//   Hakuna data inayobuniwa (26/10 o): ikiwa kila sale ya 09 ina journal -> HAIKUJARIBIWA hapa.
const s = rows("SELECT s.uid || '|' || EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false)) AS hj FROM sales s WHERE s.sale_date >= '2026-09-01' AND s.sale_date < '2026-10-01' AND NOT coalesce(s.is_deleted, false) ORDER BY 2, 1 LIMIT 1;");
const [saleUid, saleHj] = s?.length ? s[0].split('|') : [];
if (saleUid && bool(saleHj) === true) {
  console.log('2a: HAIKUJARIBIWA - inafunikwa na repostSaleRefused (unit)');
  check('2a-repost-sale-ya-09', null, `kila sale ya 09/2026 ina journal tayari (mf. ${saleUid}); repost ingejibu "Tayari imepostiwa" kabla ya kinga - GlClosedPeriodGuardTest.repostSaleRefused`);
} else if (saleUid && bool(saleHj) === false) {
  const k = journals(saleUid);
  const r = await call('POST', `/api/v1/gl/corrections/repost-sale/${saleUid}`);
  check('2a-repost-sale-ya-09', !r.ok && imefungwa(r.message) && journals(saleUid) === k, `repost-sale ${saleUid} (haina journal): ${r.status} ${String(r.message).slice(0, 160)}; journal ${k} -> ${journals(saleUid)}`);
} else if (saleUid) check('2a-repost-sale-ya-09', false, `alama ya journal ya sale ${saleUid} haisomeki: ${s[0]}`);
else {
  console.log('2a: HAIKUJARIBIWA - inafunikwa na repostSaleRefused (unit)');
  check('2a-repost-sale-ya-09', null, 'hakuna sale ya 09/2026 kwenye staging');
}
const jref = rows("SELECT reference_uid FROM journal_entry j WHERE entry_date >= '2026-09-01' AND entry_date < '2026-10-01' AND NOT coalesce(is_reversal, false) AND NOT coalesce(is_deleted, false) AND reference_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) ORDER BY entry_date LIMIT 1;");
if (jref?.length) {
  const k = journals(jref[0]);
  const r = await call('POST', `/api/v1/gl/reverse?referenceUid=${encodeURIComponent(jref[0])}&reason=${encodeURIComponent('57d jaribio - lazima ikataliwe')}`);
  check('2b-reverse-ya-09-inakataliwa', !r.ok && imefungwa(r.message) && journals(jref[0]) === k, `reverse ${jref[0]}: ${r.status} ${String(r.message).slice(0, 160)}`);
} else check('2b-reverse-ya-09-inakataliwa', null, 'hakuna journal ya 09/2026');
const mj = await call('POST', '/api/v1/gl/journal-entries/manual', { entryDate: '2026-09-20', memo: '57d jaribio - lazima ikataliwe',
  lines: [{ accountCode: '6100', debit: 1000, credit: 0 }, { accountCode: '1000', debit: 0, credit: 1000 }] });
check('2c-journal-ya-mkono-20/09-inakataliwa', !mj.ok && imefungwa(mj.message), `manual 20/09: ${mj.status} ${String(mj.message).slice(0, 160)}`);
const bf = await call('POST', '/api/v1/gl/backfill');
check('2d-backfill-inakataliwa', !bf.ok, `backfill: ${bf.status} ${String(bf.message).slice(0, 160)}`);
const nAll = Number((rows('SELECT count(*) FROM journal_entry;') ?? ['-1'])[0]);
const de = await call('DELETE', '/api/v1/gl/entries');
check('2e-clear-inakataliwa', !de.ok && Number((rows('SELECT count(*) FROM journal_entry;') ?? ['-2'])[0]) === nAll, `DELETE /entries: ${de.status} ${String(de.message).slice(0, 160)}; journal ${nAll}`);

// ---- 3) retry -> late entry ----
const ref = `qa-57d-retry-${Date.now()}`;
const lines = JSON.stringify([{ accountCode: '6100', debit: 1000, credit: 0, description: '57d retry' }, { accountCode: '1000', debit: 0, credit: 1000, description: '57d retry' }]);
const ins = rows(`INSERT INTO gl_posting_failure (uid, source_type, source_uid, source_number, event_type, reference_uid, entry_date, posted_by, lines_json, error)
  VALUES (gen_random_uuid()::text, 'QA_57D', '${ref}', '${ref}', 'EXPENSE_DIRECT', '${ref}', DATE '2026-09-15', 'qa-57d', '${lines}', '57d: safu ya majaribio')
  RETURNING 'FAILURE|' || uid;`);
const fuid = ins?.find((l) => l.startsWith('FAILURE|'))?.split('|')[1];
check('3-safu-ya-majaribio', !!fuid, `gl_posting_failure ya majaribio: ${fuid ?? ins}`);
if (fuid) {
  const rt = await call('POST', `/api/v1/gl/posting-failures/${fuid}/retry`);
  const j = rows(`SELECT entry_date || '|' || coalesce(event_date::text, '-') || '|' || is_late_entry FROM journal_entry WHERE reference_uid = '${ref}' AND NOT coalesce(is_reversal, false);`) ?? [];
  const f = rows(`SELECT coalesce(resolution, '-') || '|' || (resolved_at IS NOT NULL) FROM gl_posting_failure WHERE uid = '${fuid}';`) ?? [];
  check('3-retry-imefanikiwa', rt.ok, `retry: ${rt.status} ${String(rt.message).slice(0, 160)}`);
  const [jd, je3, jl] = (j[0] ?? '').split('|');
  check('3-late-entry-01/10', j.length === 1 && jd === '2026-10-01' && je3 === '2026-09-15' && bool(jl) === true, `journal ${JSON.stringify(j)} (lazima safu 1: 2026-10-01 | 2026-09-15 | is_late_entry kweli)`);
  const [fr, fd] = (f[0] ?? '').split('|');
  check('3-safu-resolved-RETRIED', f.length === 1 && fr === 'RETRIED' && bool(fd) === true, `gl_posting_failure ${JSON.stringify(f)} (lazima safu 1: RETRIED | resolved kweli)`);
}

// ---- 4) reversal iliyokataliwa na scheduler -> retry bado inakataliwa ----
const je = rows("SELECT j.uid FROM journal_entry j WHERE j.entry_date >= '2026-09-01' AND j.entry_date < '2026-10-01' AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false) AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) ORDER BY j.entry_date LIMIT 1;");
if (je?.length) {
  const juid = je[0];
  const rev0 = Number((rows(`SELECT count(*) FROM journal_entry WHERE reversed_entry_uid = '${juid}';`) ?? ['-1'])[0]);
  const ins4 = rows(`INSERT INTO gl_posting_failure (uid, source_type, source_uid, source_number, entry_date, posted_by, error)
    SELECT gen_random_uuid()::text, 'GL_REVERSAL', uid, entry_number, CURRENT_DATE, 'qa-57d', '57d: safu ya majaribio (reversal)' FROM journal_entry WHERE uid = '${juid}'
    RETURNING 'FAILURE|' || uid;`);
  const f4 = ins4?.find((l) => l.startsWith('FAILURE|'))?.split('|')[1];
  check('4-safu-ya-GL_REVERSAL', !!f4, `gl_posting_failure GL_REVERSAL ya ${juid}: ${f4 ?? ins4}`);
  if (f4) {
    const rt4 = await call('POST', `/api/v1/gl/posting-failures/${f4}/retry`);
    const st4 = rows(`SELECT (resolved_at IS NULL) || '|' || attempts || '|' || coalesce(error, '-') FROM gl_posting_failure WHERE uid = '${f4}';`) ?? [];
    const rev1 = Number((rows(`SELECT count(*) FROM journal_entry WHERE reversed_entry_uid = '${juid}';`) ?? ['-1'])[0]);
    const [open4, att4, err4] = (st4[0] ?? '').split('|');
    check('4-retry-bado-inakataliwa', st4.length === 1 && bool(open4) === true && att4 === '2' && imefungwa(err4) && rev1 === rev0,
      `retry: ${rt4.status}; safu wazi ${open4}, attempts ${att4}, kosa ${String(err4).slice(0, 120)}; reversal ${rev0} -> ${rev1}`);
    const fu = rows(`UPDATE gl_posting_failure SET resolved_at = now(), resolved_by_uid = 'qa-57d', resolution = 'QA_57D' WHERE uid = '${f4}' RETURNING 'FUNGWA|' || uid;`);
    check('4-safu-imefungwa-QA_57D', !!fu?.some((l) => l.startsWith('FUNGWA|')), `safu ${f4}: ${fu}`);
  }
} else check('4-safu-ya-GL_REVERSAL', null, 'hakuna journal ya 09/2026 isiyogeuzwa');
finish('57d gl vipindi');
