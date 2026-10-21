-- HATUA 38c (STAGING, KUSOMA TU): V134 imeingia sawa? Kila mstari una LAZIMA yake.
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY_134_MUST_BE_1|' || count(*) FROM flyway_schema_history WHERE version = '134' AND success;
SELECT 'FLYWAY_FAILED_MUST_BE_0|' || count(*) FROM flyway_schema_history WHERE NOT success;
SELECT 'TABLE_GL_POSTING_FAILURE_MUST_BE_1|' || count(*) FROM information_schema.tables WHERE table_name = 'gl_posting_failure';
SELECT 'TABLE_GL_PERIOD_AUDIT_MUST_BE_1|' || count(*) FROM information_schema.tables WHERE table_name = 'gl_period_audit';
SELECT 'COLS_MUST_BE_6|' || count(*) FROM information_schema.columns
 WHERE (table_name, column_name) IN (('daily_financial_snapshot','variance_kind'), ('daily_financial_snapshot','variance_target'), ('journal_entry','event_date'),
        ('journal_entry','is_late_entry'), ('gl_period','closed_by_uid'), ('gl_period','checks_json'));
SELECT 'VARIANCE_TARGET_SET_MUST_BE_0|' || count(*) FROM daily_financial_snapshot WHERE variance_target IS NOT NULL;
SELECT 'CHK_VARIANCE_TARGET_MUST_BE_1|' || count(*) FROM pg_constraint WHERE conname = 'chk_dfs_variance_target';
SELECT 'LATE_ENTRIES_MUST_BE_0|' || count(*) FROM journal_entry WHERE is_late_entry;
SELECT 'FAILURES_ROWS|' || count(*) FROM gl_posting_failure;
SELECT 'PERIODS_CLOSED_MUST_BE_0|' || count(*) FROM gl_period WHERE status <> 'OPEN';
SELECT 'UQ_PERIOD_INDEX_MUST_BE_1|' || count(*) FROM pg_indexes WHERE indexname = 'uq_gl_period_month_global';
SELECT 'ACCOUNT_2900_MUST_BE_1|' || count(*) FROM gl_account WHERE account_code = '2900' AND account_type = 'LIABILITY' AND is_active;
SELECT 'GL_2900_MUST_BE_0|' || coalesce(sum(l.credit_amount - l.debit_amount), 0) FROM journal_entry_line l WHERE l.account_code = '2900';
SELECT 'DAY_CLOSE_LIVE|' || count(*) FROM journal_entry j
 WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false));
SELECT 'GL_1000|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code = '1000' AND NOT coalesce(j.is_deleted, false);
ROLLBACK;
