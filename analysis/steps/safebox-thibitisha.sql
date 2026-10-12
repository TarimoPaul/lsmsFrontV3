-- READ-ONLY. After backend 2.2.69: V132 applied, and the outstanding query of
-- ReconciliationCashEntryRepository.OUTSTANDING_SAFE_BOX_SQL runs on a real database
-- (the unit tests only mock it). Same SQL, without the branch / cashier filter;
-- its lines come out as one text column: NAME|value|value...
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY', version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
SELECT 'FLYWAY_FAILED_MUST_BE_0', count(*) FROM flyway_schema_history WHERE success = false;
SELECT 'FLYWAY_132_MUST_BE_1', count(*) FROM flyway_schema_history WHERE version = '132' AND success;
SELECT 'REMAINDER_REASON_COL_MUST_BE_1', count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'safe_box_deposits' AND column_name = 'remainder_reason' AND is_nullable = 'YES';
SELECT 'REMAINDER_REASON_FILLED_MUST_BE_0', count(remainder_reason) FROM safe_box_deposits;
SELECT 'SAFE_BOX_DEPOSITS_BY_STATUS', status, count(*), sum(submitted_amount) FROM safe_box_deposits WHERE is_deleted = false GROUP BY status ORDER BY status;
SELECT 'SAFE_BOX_ENTRIES', count(*), sum(amount) FROM reconciliation_cash_entries WHERE entry_type = 'SAFE_BOX' AND is_deleted = false;
WITH o AS (
SELECT rce.uid, rce.amount, rce.deposit_date,
       dr.reconciliation_date, dr.uid AS recon_uid, dr.user_uid, dr.branch_uid,
       CONCAT(u.first_name, ' ', u.last_name) AS cashier,
       COALESCE(confirmed.total, 0) AS confirmed_total,
       (rce.amount - COALESCE(confirmed.total, 0)) AS remaining,
       COALESCE(pending.total, 0) AS pending_total
FROM reconciliation_cash_entries rce
JOIN daily_reconciliation dr ON dr.uid = rce.reconciliation_uid
JOIN users u ON u.uid = dr.user_uid
LEFT JOIN (
    SELECT sbd.cash_entry_uid, SUM(sbd.submitted_amount) AS total
    FROM safe_box_deposits sbd
    WHERE sbd.status = 'CONFIRMED' AND sbd.is_deleted = false
    GROUP BY sbd.cash_entry_uid
) confirmed ON confirmed.cash_entry_uid = rce.uid
LEFT JOIN (
    SELECT sbd.cash_entry_uid, SUM(sbd.submitted_amount) AS total
    FROM safe_box_deposits sbd
    WHERE sbd.status = 'PENDING' AND sbd.is_deleted = false
    GROUP BY sbd.cash_entry_uid
) pending ON pending.cash_entry_uid = rce.uid
WHERE rce.entry_type = 'SAFE_BOX'
  AND rce.is_deleted = false
  AND dr.status IN ('APPROVED', 'CLOSED')
  AND (rce.amount - COALESCE(confirmed.total, 0)) > 0
), lines AS (
    SELECT 1 AS ord, NULL::date AS d, concat_ws('|', 'OUTSTANDING_TOTALS', count(*), sum(amount), sum(confirmed_total), sum(remaining), sum(pending_total)) AS line FROM o
    UNION ALL
    SELECT 2, NULL, concat_ws('|', 'PENDING_OVER_REMAINING_MUST_BE_0', count(*)) FROM o WHERE pending_total > remaining
    UNION ALL
    SELECT 3, NULL, concat_ws('|', 'OUTSTANDING_BY_CASHIER', cashier, count(*), sum(remaining), sum(pending_total), sum(remaining - pending_total)) FROM o GROUP BY cashier
    UNION ALL
    SELECT 4, reconciliation_date, concat_ws('|', 'OUTSTANDING_ROW', reconciliation_date, cashier, amount, confirmed_total, remaining, pending_total) FROM o
)
SELECT line FROM lines ORDER BY ord, d DESC NULLS LAST, line LIMIT 60;
ROLLBACK;
