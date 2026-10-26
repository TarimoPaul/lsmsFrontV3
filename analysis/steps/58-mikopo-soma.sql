-- HATUA 58 (mmiliki 26/10, 2.3.0 hatua 0 + orodha D2) - KUSOMA TU kwenye DB ya prod (BEGIN READ ONLY ... ROLLBACK).
-- 1) mikopo kwenye capital_injections (LOAN) na malipo yake (LOAN_REPAYMENT); 2) kila journal ya mikopo hiyo (tarehe, aina,
--    reversal, mistari Dr/Cr kwa akaunti); 3) salio la GL la 1000, 1021, 1200, 2100, 6600 leo na tarehe muhimu;
-- 4) D2: backup_20260930_journal_entry - ukubwa, idadi, na kitu chochote kinacholitegemea (view / MV / function / trigger).
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'READ_ONLY|' || current_setting('transaction_read_only') || '|' || now();
SELECT 'MKOPO|' || id || '|' || uid || '|' || transaction_date::date || '|' || amount || '|' || coalesce(payment_method, '-')
       || '|' || coalesce(reason, '-') || '|' || coalesce(notes, '-') || '|' || created_at || '|' || coalesce(created_by, '-')
       || '|reclass ' || coalesce(reclassified_from, '-')
  FROM capital_injections WHERE source_type = 'LOAN' OR reclassified_from = 'LOAN' ORDER BY transaction_date, id;
SELECT 'MALIPO|' || id || '|' || uid || '|' || transaction_date::date || '|' || amount || '|principal ' || coalesce(principal_amount, 0)
       || '|interest ' || coalesce(interest_amount, 0) || '|' || coalesce(payment_method, '-') || '|loan ' || coalesce(related_loan_uid, '-')
  FROM capital_injections WHERE source_type = 'LOAN_REPAYMENT' ORDER BY transaction_date, id;
WITH refs AS (
  SELECT uid FROM capital_injections WHERE source_type IN ('LOAN', 'LOAN_REPAYMENT') OR reclassified_from = 'LOAN'
)
SELECT 'JOURNAL|' || j.entry_number || '|' || j.entry_date || '|event ' || coalesce(j.event_date::text, '-') || '|' || j.reference_type
       || '|ref ' || coalesce(j.reference_uid, '-') || '|reversal ' || coalesce(j.is_reversal, false) || '|reverses ' || coalesce(j.reversed_entry_uid, '-')
       || '|imereversiwa ' || EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))
       || '|posted ' || j.posted_at || '|' || coalesce(j.posted_by, '-')
  FROM journal_entry j
 WHERE NOT coalesce(j.is_deleted, false)
   AND (j.reference_uid IN (SELECT uid FROM refs) OR j.reference_type LIKE 'LOAN%'
        OR j.uid IN (SELECT l.journal_entry_uid FROM journal_entry_line l WHERE l.account_code IN ('2100', '6600')))
 ORDER BY j.entry_date, j.posted_at;
WITH refs AS (
  SELECT uid FROM capital_injections WHERE source_type IN ('LOAN', 'LOAN_REPAYMENT') OR reclassified_from = 'LOAN'
)
SELECT 'MSTARI|' || j.entry_number || '|' || l.account_code || '|Dr ' || coalesce(l.debit_amount, 0) || '|Cr ' || coalesce(l.credit_amount, 0)
       || '|' || coalesce(l.description, '-')
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE NOT coalesce(j.is_deleted, false)
   AND (j.reference_uid IN (SELECT uid FROM refs) OR j.reference_type LIKE 'LOAN%'
        OR j.uid IN (SELECT l2.journal_entry_uid FROM journal_entry_line l2 WHERE l2.account_code IN ('2100', '6600')))
 ORDER BY j.entry_date, j.posted_at, l.line_order NULLS LAST, l.account_code;
SELECT 'SALIO|' || d::date || '|' || a.code || '|' || coalesce((
         SELECT sum(coalesce(l.debit_amount, 0) - coalesce(l.credit_amount, 0))
           FROM journal_entry_line l JOIN journal_entry j ON j.uid = l.journal_entry_uid
          WHERE l.account_code = a.code AND NOT coalesce(j.is_deleted, false) AND j.entry_date <= d::date), 0)
  FROM (VALUES ('1000'), ('1021'), ('1200'), ('2100'), ('6600')) a(code),
       (VALUES (DATE '2026-09-30'), (DATE '2026-10-03'), (DATE '2026-10-04'), (DATE '2026-10-10'), (DATE '2026-10-11'), (current_date)) t(d)
 ORDER BY 1;
SELECT 'AKAUNTI|' || account_code || '|' || account_name || '|' || account_type || '|active ' || is_active
  FROM gl_account WHERE account_code IN ('1000', '1021', '1025', '1150', '1200', '2100', '2110', '6600') ORDER BY account_code;
SELECT 'VIPINDI|' || period_year || '-' || lpad(period_month::text, 2, '0') || '|' || status FROM gl_period WHERE branch_uid IS NULL ORDER BY 1;
-- D2: backup_20260930_journal_entry
SELECT 'D2_JEDWALI|' || CASE WHEN to_regclass('public.backup_20260930_journal_entry') IS NULL THEN 'HALIPO' ELSE 'LIPO' END;
SELECT 'D2_UKUBWA|' || pg_size_pretty(pg_total_relation_size('public.backup_20260930_journal_entry')) || '|safu ' || (SELECT count(*) FROM public.backup_20260930_journal_entry)
 WHERE to_regclass('public.backup_20260930_journal_entry') IS NOT NULL;
SELECT 'D2_INALITEGEMEA|' || d.classid::regclass || '|' || coalesce(v.oid::regclass::text, d.objid::text) || '|' || d.deptype
  FROM pg_depend d LEFT JOIN pg_rewrite rw ON d.classid = 'pg_rewrite'::regclass AND rw.oid = d.objid LEFT JOIN pg_class v ON v.oid = rw.ev_class
 WHERE d.refobjid = to_regclass('public.backup_20260930_journal_entry') AND d.classid <> 'pg_type'::regclass AND (rw.oid IS NULL OR v.oid <> d.refobjid);
SELECT 'D2_VIEW|' || schemaname || '.' || viewname FROM pg_views WHERE definition ILIKE '%backup_20260930_journal_entry%';
SELECT 'D2_MV|' || schemaname || '.' || matviewname FROM pg_matviews WHERE definition ILIKE '%backup_20260930_journal_entry%';
SELECT 'D2_FUNCTION|' || n.nspname || '.' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND p.prosrc ILIKE '%backup_20260930_journal_entry%';
SELECT 'D2_TRIGGER|' || tgname FROM pg_trigger WHERE tgrelid = to_regclass('public.backup_20260930_journal_entry') AND NOT tgisinternal;
SELECT 'D2_FK|' || conname FROM pg_constraint WHERE contype = 'f' AND (conrelid = to_regclass('public.backup_20260930_journal_entry') OR confrelid = to_regclass('public.backup_20260930_journal_entry'));
ROLLBACK;
SELECT 'MWISHO_58';
