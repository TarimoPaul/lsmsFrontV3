-- 08: DAY_CLOSE_VARIANCE: alama (sign) ya variance dhidi ya upande uliopostiwa. Read-only.
-- DailyReconciliation.recalculateTotals: variance = mauzo - makato - pesa iliyotangazwa  => CHANYA = UPUNGUFU.
-- PostingEngine.postDayCloseVariance: variance > 0 => "Cash over" Dr 1000 / Cr 6700.
SET default_transaction_read_only = on;
WITH a AS (
  SELECT f.snapshot_date, f.user_name, f.expected_cash, f.declared_cash, f.variance_amount, f.is_current,
         (SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry_line l WHERE l.journal_entry_uid=j.uid AND l.account_code='1000') gl_cash
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid=j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
SELECT count(*) journals_hai,
       count(*) FILTER (WHERE variance_amount > 0) upungufu_siku, sum(variance_amount) FILTER (WHERE variance_amount > 0) upungufu_tzs,
       count(*) FILTER (WHERE variance_amount < 0) ziada_siku, sum(-variance_amount) FILTER (WHERE variance_amount < 0) ziada_tzs,
       sum(gl_cash) gl_cash_athari,
       -sum(variance_amount) cash_sahihi_kama_variance_ni_upungufu,
       sum(gl_cash) + sum(variance_amount) kosa_kwenye_cash   -- = 2 x sum(variance)
FROM a;
-- mifano 10 ya karibuni
SELECT f.snapshot_date, f.expected_cash, f.declared_cash, f.variance_amount,
       string_agg(l.account_code||(CASE WHEN l.debit_amount>0 THEN ' Dr ' ELSE ' Cr ' END)||(l.debit_amount+l.credit_amount)||' ('||l.description||')', '; ') posting
FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid=j.reference_uid JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
GROUP BY j.uid, 1,2,3,4 ORDER BY 1 DESC LIMIT 10;
