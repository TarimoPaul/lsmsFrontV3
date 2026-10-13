-- READ-ONLY. "Bado kukabidhiwa": every live SAFE_BOX entry not confirmed in full yet, on EVERY reconciliation
-- status (the screen and the banner only count APPROVED / CLOSED days).
--   submitted = confirmed + waiting ; not submitted = amount - confirmed - waiting.
-- Lines come out as NAME|value|value...
BEGIN TRANSACTION READ ONLY;
WITH e AS (
    SELECT rce.uid, rce.amount, dr.reconciliation_date, dr.status AS recon_status,
           (dr.status IN ('APPROVED', 'CLOSED')) AS approved,
           (CURRENT_DATE - dr.reconciliation_date) AS age_days,
           CONCAT(u.first_name, ' ', u.last_name) AS cashier,
           COALESCE((SELECT SUM(d.submitted_amount) FROM safe_box_deposits d
                     WHERE d.cash_entry_uid = rce.uid AND d.status = 'CONFIRMED' AND d.is_deleted = false), 0) AS confirmed,
           COALESCE((SELECT SUM(d.submitted_amount) FROM safe_box_deposits d
                     WHERE d.cash_entry_uid = rce.uid AND d.status = 'PENDING' AND d.is_deleted = false), 0) AS waiting
    FROM reconciliation_cash_entries rce
    JOIN daily_reconciliation dr ON dr.uid = rce.reconciliation_uid
    JOIN users u ON u.uid = dr.user_uid
    WHERE rce.entry_type = 'SAFE_BOX' AND rce.is_deleted = false
), o AS (
    SELECT *, (amount - confirmed) AS remaining, GREATEST(amount - confirmed - waiting, 0) AS not_submitted
    FROM e WHERE amount - confirmed > 0
), lines AS (
    SELECT 1 AS ord, NULL::date AS d, concat_ws('|', 'JUMLA', count(*), sum(amount), sum(confirmed + waiting), sum(confirmed), sum(waiting), sum(not_submitted), sum(remaining)) AS line FROM o
    UNION ALL
    -- KWA_HALI | approved or not | recon status | entries | amount | submitted | confirmed | waiting | not submitted | not confirmed
    SELECT 2, NULL, concat_ws('|', 'KWA_HALI', CASE WHEN approved THEN 'IMEIDHINISHWA' ELSE 'HAIJAIDHINISHWA' END, recon_status,
           count(*), sum(amount), sum(confirmed + waiting), sum(confirmed), sum(waiting), sum(not_submitted), sum(remaining))
    FROM o GROUP BY approved, recon_status
    UNION ALL
    SELECT 3, NULL, concat_ws('|', 'KWA_CASHIER', cashier, count(*), sum(not_submitted), sum(waiting), sum(remaining), max(age_days)) FROM o GROUP BY cashier
    UNION ALL
    -- ENTRY | recon date | age in days | cashier | amount | submitted | confirmed | waiting | not submitted | recon status | approved or not
    SELECT 4, reconciliation_date, concat_ws('|', 'ENTRY', reconciliation_date, age_days, cashier, amount, confirmed + waiting, confirmed, waiting, not_submitted,
           recon_status, CASE WHEN approved THEN 'IMEIDHINISHWA' ELSE 'HAIJAIDHINISHWA' END)
    FROM o
)
SELECT line FROM lines ORDER BY ord, d ASC NULLS LAST, line;
ROLLBACK;
