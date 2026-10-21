-- KUSOMA TU. Sales zenye deni (outstanding > 0 au malipo ya sehemu) tangu 2026-10-14 14:43 na kama zina journal ya GL.
SET default_transaction_read_only = on;
SELECT 'CREDIT_SALE|'||s.receipt_number||'|'||s.created_at||'|'||s.total_amount||'|'||coalesce(s.outstanding_balance,0)||'|'||coalesce(s.payment_status,'')
       ||'|JOURNAL='||(SELECT count(*) FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal)
FROM sales s
WHERE s.created_at >= '2026-10-14 14:43' AND NOT s.is_deleted AND s.sale_source = 'STANDARD'
  AND (coalesce(s.outstanding_balance,0) > 0 OR EXISTS (SELECT 1 FROM payments p WHERE p.sale_uid = s.uid AND p.payment_status <> 'PAID'))
ORDER BY s.created_at;
SELECT 'CASH_SALES_SINCE|'||count(*)||'|JOURNAL='||count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal))
FROM sales s WHERE s.created_at >= '2026-10-14 14:43' AND NOT s.is_deleted AND s.sale_source = 'STANDARD' AND coalesce(s.outstanding_balance,0) = 0;
