-- HATUA 71e (INABADILISHA PROD, print_jobs TU) - A4 (b) (mmiliki 29/10 aw). Inaendeshwa BAADA ya 71e-soma.sql na SAFISHA.
-- Transaction moja: akaunti ya print-agent lazima iwe imezimwa, na idadi ya kazi lazima iwe ILEILE ya dryRun (:idadi);
-- vinginevyo RAISE -> ROLLBACK, hakuna kilichobadilika. Rollback ya baadaye: uid zote ziko kwenye log ya 71e (PJ_SAFU).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('a4.idadi', :'idadi', true);  -- psql haibadilishi :idadi ndani ya DO $$...$$
CREATE TEMP TABLE a4_jobs ON COMMIT DROP AS
  SELECT uid FROM print_jobs WHERE status = 'PRINTING' AND created_at < '2026-07-01';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE uid = 'd89760f8-56d3-4b52-9131-53eef5778890'
             AND status = 'ACTIVE' AND NOT is_deleted AND NOT is_locked) THEN
    RAISE EXCEPTION 'A4_KATAA: akaunti ya print-agent bado ni ACTIVE - izime kwanza (V3 Users)';
  END IF;
  IF (SELECT count(*) FROM a4_jobs) <> current_setting('a4.idadi')::int THEN
    RAISE EXCEPTION 'A4_KATAA: kazi % si % za dryRun', (SELECT count(*) FROM a4_jobs), current_setting('a4.idadi');
  END IF;
END $$;
UPDATE print_jobs
   SET status = 'FAILED',
       error_message = 'A4 29/10 (aw): imeachwa - print-agent haitumiki tangu 28/07',
       updated_at = now()
 WHERE uid IN (SELECT uid FROM a4_jobs);
SELECT 'PJ_IMEBADILISHWA ' || count(*) FROM print_jobs
 WHERE uid IN (SELECT uid FROM a4_jobs) AND status = 'FAILED';
COMMIT;
SELECT 'PJ_PRINTING_BAADA ' || count(*) FROM print_jobs WHERE status = 'PRINTING';
