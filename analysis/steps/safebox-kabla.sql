-- READ-ONLY. Before backend 2.2.69 (V132 = safe_box_deposits.remainder_reason).
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY', version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
SELECT 'FLYWAY_FAILED_MUST_BE_0', count(*) FROM flyway_schema_history WHERE success = false;
SELECT 'FLYWAY_ALL', string_agg(version, ' ' ORDER BY installed_rank) FROM flyway_schema_history WHERE version IS NOT NULL;
SELECT 'FLYWAY_132_MUST_BE_0', count(*) FROM flyway_schema_history WHERE version = '132';
SELECT 'REMAINDER_REASON_COL_MUST_BE_0', count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'safe_box_deposits' AND column_name = 'remainder_reason';
SELECT 'SAFE_BOX_DEPOSITS_BY_STATUS', status, count(*), sum(submitted_amount) FROM safe_box_deposits WHERE is_deleted = false GROUP BY status ORDER BY status;
SELECT 'SAFE_BOX_ENTRIES', count(*), sum(amount) FROM reconciliation_cash_entries WHERE entry_type = 'SAFE_BOX' AND is_deleted = false;
ROLLBACK;
