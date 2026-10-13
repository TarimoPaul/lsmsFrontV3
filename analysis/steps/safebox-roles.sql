-- READ-ONLY. Before V133 (permission SAFEBOX_DEPOSIT_ON_BEHALF granted to the role named CEO):
-- which roles exist, who holds them, and which roles can already submit / confirm safe box deposits.
-- Also names the people behind the two totals of step 30a. Lines come out as NAME|value|value...
BEGIN TRANSACTION READ ONLY;
SELECT concat_ws('|', 'ROLE', r.name, CASE WHEN r.is_deleted THEN 'IMEFUTWA' ELSE 'HAI' END,
       (SELECT count(*) FROM user_roles ur WHERE ur.role_uid = r.uid),
       COALESCE((SELECT string_agg(CONCAT(u.first_name, ' ', u.last_name), ', ' ORDER BY u.first_name)
                 FROM user_roles ur JOIN users u ON u.uid = ur.user_uid WHERE ur.role_uid = r.uid), '-'))
FROM roles r ORDER BY r.name;
SELECT concat_ws('|', 'ROLE_CEO_MUST_BE_1', count(*)) FROM roles WHERE UPPER(name) = 'CEO' AND is_deleted = false;
SELECT concat_ws('|', 'RUHUSA_KWA_ROLE', p.name, COALESCE(string_agg(r.name, ', ' ORDER BY r.name), '-'))
FROM permissions p
LEFT JOIN role_permissions rp ON rp.permission_uid = p.uid
LEFT JOIN roles r ON r.uid = rp.role_uid
WHERE p.name IN ('RECONCILIATION_CREATE', 'SAFE_BOX_CONFIRM', 'RECONCILIATION_APPROVE', 'SAFEBOX_DEPOSIT_ON_BEHALF')
GROUP BY p.name ORDER BY p.name;
-- ALIJITHIBITISHIA | submitted at | amount | submitter = confirmer | owner of the recon | type | handed to
SELECT concat_ws('|', 'ALIJITHIBITISHIA',
       to_char(sbd.submitted_at, 'YYYY-MM-DD HH24:MI'), sbd.submitted_amount,
       CONCAT(s.first_name, ' ', s.last_name), CONCAT(o.first_name, ' ', o.last_name),
       sbd.deposit_type, COALESCE(NULLIF(CONCAT(r.first_name, ' ', r.last_name), ' '), '-'))
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
LEFT JOIN users s ON s.uid = sbd.cashier_uid
LEFT JOIN users o ON o.uid = dr.user_uid
LEFT JOIN users r ON r.uid = sbd.recipient_uid
WHERE sbd.status = 'CONFIRMED' AND sbd.confirmed_by_uid = sbd.cashier_uid
ORDER BY sbd.submitted_at DESC;
-- ALIJIKABIDHI | submitted at | amount | submitter = recipient | owner of the recon | status | confirmed by
SELECT concat_ws('|', 'ALIJIKABIDHI',
       to_char(sbd.submitted_at, 'YYYY-MM-DD HH24:MI'), sbd.submitted_amount,
       CONCAT(s.first_name, ' ', s.last_name), CONCAT(o.first_name, ' ', o.last_name),
       sbd.status, COALESCE(NULLIF(CONCAT(c.first_name, ' ', c.last_name), ' '), '-'))
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
LEFT JOIN users s ON s.uid = sbd.cashier_uid
LEFT JOIN users o ON o.uid = dr.user_uid
LEFT JOIN users c ON c.uid = sbd.confirmed_by_uid
WHERE sbd.deposit_type = 'HAND_OVER' AND sbd.recipient_uid = sbd.cashier_uid
ORDER BY sbd.submitted_at DESC;
ROLLBACK;
