-- 20 (Toleo 1): sales 3 za H-2 zitapostiwa vipi na SaleGlPostingService.postFromDb. DB: lsms_audit_20261015_0200. KUSOMA TU.
-- AR ya journal = outstanding ya sasa + marekebisho yaliyoidhinishwa + malipo yaliyopostiwa baadaye (RCPT);
-- cash ya journal = malipo ukiondoa yaliyopostiwa baadaye, kwa kikomo cha (jumla - AR).
SET default_transaction_read_only = on;
WITH s AS (
  SELECT s.uid, s.receipt_number, s.total_amount, coalesce(s.discount_amount, 0) disc, coalesce(s.outstanding_balance, 0) owed_now
  FROM sales s WHERE s.receipt_number IN ('101026-2202', '121026-2249', '131026-2227')),
p AS (
  SELECT s.uid sale_uid, p.uid, p.payment_method, p.amount_paid, p.is_active,
         coalesce((SELECT sum(j.total_debit) FROM journal_entry j
                    WHERE j.reference_uid LIKE p.uid || ':RCPT:%' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
                      AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))), 0) later
  FROM s JOIN payments p ON p.sale_uid = s.uid)
SELECT s.receipt_number, s.total_amount, s.disc, s.owed_now,
       (SELECT coalesce(sum(amount), 0) FROM debt_adjustment d WHERE d.sale_uid = s.uid AND d.status = 'APPROVED' AND NOT d.is_deleted) adj,
       (SELECT string_agg(p.payment_method || ':' || p.amount_paid || CASE WHEN p.later > 0 THEN ' (baadaye ' || p.later || ')' ELSE '' END
                          || CASE WHEN NOT coalesce(p.is_active, true) THEN ' INACTIVE' ELSE '' END, ', ') FROM p WHERE p.sale_uid = s.uid) malipo,
       s.owed_now + (SELECT coalesce(sum(p.later), 0) FROM p WHERE p.sale_uid = s.uid AND coalesce(p.is_active, true))
         + (SELECT coalesce(sum(amount), 0) FROM debt_adjustment d WHERE d.sale_uid = s.uid AND d.status = 'APPROVED' AND NOT d.is_deleted) ar_ya_journal,
       (SELECT count(*) FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT coalesce(j.is_deleted, false)) journals_sasa
FROM s ORDER BY s.receipt_number;
