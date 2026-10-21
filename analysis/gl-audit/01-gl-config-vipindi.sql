-- 01: gl_config na vipindi ambavyo GL ilikuwa live / imezimwa. Read-only.
SET default_transaction_read_only = on;
SELECT * FROM gl_config;
-- journal zote za sasa ziliundwa lini (backfill ya 09-30 dhidi ya live)?
SELECT created_at::date siku, count(*) journals, min(created_at) kwanza, max(created_at) mwisho,
       count(DISTINCT posted_by) wapostaji
FROM journal_entry GROUP BY 1 ORDER BY 1;
-- 30/09: dakika kwa dakika (backfill -> live)
SELECT date_trunc('minute', created_at) dakika, count(*), string_agg(DISTINCT reference_type, ',') aina
FROM journal_entry WHERE created_at::date = '2026-09-30' GROUP BY 1 ORDER BY 1 LIMIT 60;
-- Journal za zamani (kabla ya rebuild) zilizohifadhiwa: zilianza lini?
SELECT min(created_at) kwanza, max(created_at) mwisho, count(*) FROM backup_20260930_journal_entry;
SELECT created_at::date siku, count(*) FROM backup_20260930_journal_entry GROUP BY 1 ORDER BY 1 LIMIT 80;
-- PENGO: kila siku tangu live, sales mpya vs sales zilizopata journal (kipimo cha GL kuzimwa)
WITH s AS (
  SELECT s.uid, s.created_at::date d FROM sales s
  WHERE s.created_at >= '2026-09-30 10:32:19' AND NOT s.is_deleted AND s.total_amount > 0)
SELECT d, count(*) sales_mpya,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal)) zenye_journal
FROM s GROUP BY d ORDER BY d;
