-- READ-ONLY. Safe box deposits whose submitter (safe_box_deposits.cashier_uid) is NOT the owner of the
-- reconciliation the money belongs to (daily_reconciliation.user_uid via source_recon_uid).
-- Every status and soft-deleted rows included. Lines come out as NAME|value|value...
BEGIN TRANSACTION READ ONLY;
SELECT concat_ws('|', 'DEPOSITS_ZOTE', count(*), COALESCE(sum(submitted_amount), 0)) FROM safe_box_deposits;
SELECT concat_ws('|', 'SI_MMILIKI_JUMLA', count(*), COALESCE(sum(sbd.submitted_amount), 0))
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
WHERE sbd.cashier_uid IS DISTINCT FROM dr.user_uid;
SELECT concat_ws('|', 'SI_MMILIKI_KWA_HALI', sbd.status, count(*), sum(sbd.submitted_amount))
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
WHERE sbd.cashier_uid IS DISTINCT FROM dr.user_uid
GROUP BY sbd.status ORDER BY sbd.status;
-- SI_MMILIKI | submitted at | recon date | amount | entry amount | type | submitter | owner | status | deleted | deposit uid
SELECT concat_ws('|', 'SI_MMILIKI',
       to_char(sbd.submitted_at, 'YYYY-MM-DD HH24:MI'),
       dr.reconciliation_date,
       sbd.submitted_amount,
       COALESCE(rce.amount::text, 'ENTRY_IMEFUTWA'),
       sbd.deposit_type,
       COALESCE(NULLIF(CONCAT(s.first_name, ' ', s.last_name), ' '), sbd.cashier_uid),
       COALESCE(NULLIF(CONCAT(o.first_name, ' ', o.last_name), ' '), dr.user_uid),
       sbd.status,
       CASE WHEN sbd.is_deleted THEN 'IMEFUTWA' ELSE 'HAI' END,
       sbd.uid)
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
LEFT JOIN reconciliation_cash_entries rce ON rce.uid = sbd.cash_entry_uid
LEFT JOIN users s ON s.uid = sbd.cashier_uid
LEFT JOIN users o ON o.uid = dr.user_uid
WHERE sbd.cashier_uid IS DISTINCT FROM dr.user_uid
ORDER BY sbd.submitted_at DESC NULLS LAST;
ROLLBACK;
