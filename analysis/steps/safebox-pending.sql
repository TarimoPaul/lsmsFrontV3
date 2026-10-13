-- READ-ONLY. Why the one PENDING safe box deposit (110,000) is not on any outstanding row,
-- and why entries - confirmed (15,000) differs from the outstanding remaining (25,500).
BEGIN TRANSACTION READ ONLY;
SELECT concat_ws('|', 'PENDING_DEPOSIT', sbd.submitted_amount, COALESCE(rce.amount::text, 'NO_ENTRY'), rce.entry_type, rce.is_deleted, dr.reconciliation_date, dr.status, CONCAT(u.first_name, ' ', u.last_name))
FROM safe_box_deposits sbd
LEFT JOIN reconciliation_cash_entries rce ON rce.uid = sbd.cash_entry_uid
LEFT JOIN daily_reconciliation dr ON dr.uid = rce.reconciliation_uid
LEFT JOIN users u ON u.uid = dr.user_uid
WHERE sbd.status = 'PENDING' AND sbd.is_deleted = false;
SELECT concat_ws('|', 'SAFE_BOX_ENTRIES_BY_RECON_STATUS', dr.status, count(*), sum(rce.amount))
FROM reconciliation_cash_entries rce
JOIN daily_reconciliation dr ON dr.uid = rce.reconciliation_uid
WHERE rce.entry_type = 'SAFE_BOX' AND rce.is_deleted = false
GROUP BY dr.status ORDER BY dr.status;
SELECT concat_ws('|', 'CONFIRMED_WITHOUT_LIVE_SAFE_BOX_ENTRY', count(*), COALESCE(sum(sbd.submitted_amount), 0))
FROM safe_box_deposits sbd
LEFT JOIN reconciliation_cash_entries rce ON rce.uid = sbd.cash_entry_uid AND rce.is_deleted = false AND rce.entry_type = 'SAFE_BOX'
WHERE sbd.status = 'CONFIRMED' AND sbd.is_deleted = false AND rce.uid IS NULL;
SELECT concat_ws('|', 'ENTRY_OVER_CONFIRMED', dr.reconciliation_date, dr.status, CONCAT(u.first_name, ' ', u.last_name), rce.amount, c.total, c.n)
FROM reconciliation_cash_entries rce
JOIN daily_reconciliation dr ON dr.uid = rce.reconciliation_uid
JOIN users u ON u.uid = dr.user_uid
JOIN (
    SELECT cash_entry_uid, SUM(submitted_amount) AS total, count(*) AS n
    FROM safe_box_deposits
    WHERE status = 'CONFIRMED' AND is_deleted = false
    GROUP BY cash_entry_uid
) c ON c.cash_entry_uid = rce.uid
WHERE rce.entry_type = 'SAFE_BOX' AND rce.is_deleted = false AND c.total > rce.amount
ORDER BY dr.reconciliation_date DESC LIMIT 40;
ROLLBACK;
