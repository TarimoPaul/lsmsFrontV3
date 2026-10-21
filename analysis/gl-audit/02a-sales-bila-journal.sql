-- 02a: Sales tangu GL live (2026-09-30 10:32:19) zisizo na journal yoyote ya sale. Read-only.
SET default_transaction_read_only = on;
SELECT s.sale_source, count(*) idadi, sum(s.total_amount) jumla,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid||':DEBT')) zenye_debt_journal
FROM sales s
WHERE s.created_at >= '2026-09-30 10:32:19' AND NOT s.is_deleted AND s.total_amount > 0
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal)
GROUP BY 1;
-- Kwa ulinganisho: sale_source ya sales zote tangu live
SELECT sale_source, count(*), sum(total_amount) FROM sales
WHERE created_at >= '2026-09-30 10:32:19' AND NOT is_deleted GROUP BY 1;
-- STANDARD zisizo na journal (pengo halisi), LIMIT 40
SELECT s.receipt_number, s.sale_date, s.created_at, s.total_amount, s.outstanding_balance, s.payment_status,
       (SELECT count(*) FROM sales_details d WHERE d.sale_uid=s.uid) mistari
FROM sales s
WHERE s.created_at >= '2026-09-30 10:32:19' AND NOT s.is_deleted AND s.total_amount > 0
  AND coalesce(s.sale_source,'STANDARD') <> 'RECONCILIATION_MANUAL'
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal)
ORDER BY s.created_at LIMIT 40;
