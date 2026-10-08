-- READ-ONLY. Fingerprint of the existing staff-liability data. Run before and after 2.2.66:
-- the two outputs must be identical (V129 adds columns and constraints, it must not change one row).
BEGIN TRANSACTION READ ONLY;
SELECT 'ALAMA_SL', count(*), coalesce(sum(amount), 0),
       md5(coalesce(string_agg(uid || '|' || user_uid || '|' || coalesce(session_uid, '') || '|' || coalesce(counting_line_uid, '') || '|' || amount || '|' || status, ',' ORDER BY uid), ''))
FROM staff_liability;
SELECT 'ALAMA_SLI', count(*), coalesce(sum(line_amount), 0),
       md5(coalesce(string_agg(uid || '|' || liability_uid || '|' || coalesce(product_uid, '') || '|' || coalesce(counting_line_uid, '') || '|' || line_amount, ',' ORDER BY uid), ''))
FROM staff_liability_item;
SELECT 'ALAMA_SLP', count(*), coalesce(sum(amount), 0),
       md5(coalesce(string_agg(uid || '|' || liability_uid || '|' || amount || '|' || payment_type, ',' ORDER BY uid), ''))
FROM staff_liability_payment;
ROLLBACK;
