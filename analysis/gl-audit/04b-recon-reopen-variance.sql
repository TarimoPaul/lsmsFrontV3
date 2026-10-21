-- 04b: Recon iliyofunguliwa upya: kila snapshot yenye DAY_CLOSE_VARIANCE hai. Read-only.
SET default_transaction_read_only = on;
WITH v AS (
  SELECT f.reconciliation_uid, f.snapshot_date, f.user_name, f.snapshot_version, f.is_current, f.variance_amount,
         j.entry_number, j.entry_date, j.created_at, j.total_debit
  FROM daily_financial_snapshot f
  JOIN journal_entry j ON j.reference_uid = f.uid AND j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
SELECT * FROM v WHERE reconciliation_uid IN (SELECT reconciliation_uid FROM v GROUP BY 1 HAVING count(*) > 1)
ORDER BY snapshot_date, snapshot_version;
-- Athari halisi kwenye 6700/1000: jumla ya variance za snapshot za ZAMANI zilizo hai (zinahesabiwa mara mbili)
WITH v AS (
  SELECT f.reconciliation_uid, f.is_current, f.variance_amount FROM daily_financial_snapshot f
  JOIN journal_entry j ON j.reference_uid = f.uid AND j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
SELECT sum(variance_amount) FILTER (WHERE variance_amount < 0) upungufu_wa_ziada_tzs,
       sum(variance_amount) FILTER (WHERE variance_amount > 0) ziada_ya_ziada_tzs,
       sum(abs(variance_amount)) jumla_abs
FROM v WHERE NOT is_current;
-- Payment isiyo hai (deletePayment) na sale yake: ilihesabiwa kwenye journal ya backfill?
SELECT p.uid, s.receipt_number, p.amount_paid, p.payment_method, p.updated_at, s.total_amount, s.outstanding_balance,
       (SELECT string_agg(l.account_code||' Dr '||l.debit_amount||' Cr '||l.credit_amount, '; ')
          FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid WHERE j.reference_uid=s.uid) sale_journal
FROM payments p JOIN sales s ON s.uid=p.sale_uid WHERE NOT p.is_active AND NOT p.is_deleted;
-- Payments is_deleted=true: ni za sales zilizofutwa?
SELECT s.is_deleted sale_imefutwa, count(*), sum(p.amount_paid) FROM payments p JOIN sales s ON s.uid=p.sale_uid
WHERE p.is_deleted GROUP BY 1;
