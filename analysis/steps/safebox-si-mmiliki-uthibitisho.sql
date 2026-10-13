-- READ-ONLY. For the Safe box deposits whose submitter is not the owner of the reconciliation (step 30):
-- who confirmed each one and when, who it was handed to, and who cancelled it.
-- Lines come out as NAME|value|value... ; an empty value is written as '-'.
BEGIN TRANSACTION READ ONLY;
-- UTHIBITISHO | deposit uid | submitted at | amount | status | submitter | confirmed by | confirmed at | flag
--             | handed to | bank | receipt | cancelled by | cancelled at | cancel reason
SELECT concat_ws('|', 'UTHIBITISHO',
       sbd.uid,
       to_char(sbd.submitted_at, 'YYYY-MM-DD HH24:MI'),
       sbd.submitted_amount,
       sbd.status,
       COALESCE(NULLIF(CONCAT(s.first_name, ' ', s.last_name), ' '), sbd.cashier_uid),
       COALESCE(NULLIF(CONCAT(c.first_name, ' ', c.last_name), ' '), sbd.confirmed_by_uid, '-'),
       COALESCE(to_char(sbd.confirmed_at, 'YYYY-MM-DD HH24:MI'), '-'),
       CASE WHEN sbd.confirmed_by_uid IS NULL THEN 'HAIJATHIBITISHWA'
            WHEN sbd.confirmed_by_uid = sbd.cashier_uid THEN 'ALIYEWASILISHA_NDIYE_ALIYETHIBITISHA'
            ELSE 'MTU_MWINGINE' END,
       COALESCE(NULLIF(CONCAT(r.first_name, ' ', r.last_name), ' '), sbd.recipient_uid, '-'),
       COALESCE(sbd.bank_name, '-'),
       COALESCE(sbd.receipt_number, '-'),
       COALESCE(NULLIF(CONCAT(x.first_name, ' ', x.last_name), ' '), sbd.cancelled_by_uid, '-'),
       COALESCE(to_char(sbd.cancelled_at, 'YYYY-MM-DD HH24:MI'), '-'),
       COALESCE(sbd.cancellation_reason, '-'))
FROM safe_box_deposits sbd
JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
LEFT JOIN users s ON s.uid = sbd.cashier_uid
LEFT JOIN users c ON c.uid = sbd.confirmed_by_uid
LEFT JOIN users r ON r.uid = sbd.recipient_uid
LEFT JOIN users x ON x.uid = sbd.cancelled_by_uid
WHERE sbd.cashier_uid IS DISTINCT FROM dr.user_uid
ORDER BY sbd.submitted_at DESC NULLS LAST;
-- The same check over EVERY deposit: how many were confirmed by the person who submitted them.
SELECT concat_ws('|', 'ZOTE_ALIYEWASILISHA_NDIYE_ALIYETHIBITISHA', count(*), COALESCE(sum(submitted_amount), 0))
FROM safe_box_deposits WHERE status = 'CONFIRMED' AND confirmed_by_uid = cashier_uid;
SELECT concat_ws('|', 'ZOTE_ALIYEKABIDHIWA_NDIYE_ALIYEWASILISHA', count(*), COALESCE(sum(submitted_amount), 0))
FROM safe_box_deposits WHERE deposit_type = 'HAND_OVER' AND recipient_uid = cashier_uid;
ROLLBACK;
