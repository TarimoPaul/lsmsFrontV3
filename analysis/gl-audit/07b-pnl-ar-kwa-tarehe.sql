-- 07b: AR ya Daily P&L (nakala ya DailyPnlCalculator) hadi tarehe :cut (matukio < cut). Endesha: psql -v cut=YYYY-MM-DD
-- kwa kila credit sale. Iendeshwe kwenye lsms_audit (14/10) NA lsms_audit_1004 (04/10), kisha linganisha.
-- Matokeo: CSV (psql \o). Read-only kabisa.
SET default_transaction_read_only = on;
\pset format csv
\o pnl_ar_cut.csv
WITH cs AS (   -- DailyPnlService.creditSales()
  SELECT d.sale_uid, MIN(COALESCE(d.reference_type, 'POS')) src, MAX(d.amount) issued,
         MIN(COALESCE(d.sale_date, CAST(s.sale_date AS date))) issued_on, MAX(s.outstanding_balance) owed_raw, false legacy
  FROM reconciliation_retail_debts d JOIN sales s ON s.uid = d.sale_uid
  WHERE d.is_deleted = false AND s.is_deleted = false GROUP BY d.sale_uid
  UNION ALL
  SELECT s.uid, 'POS', s.outstanding_balance, CAST(s.sale_date AS date), s.outstanding_balance, true
  FROM sales s WHERE s.is_deleted = false AND s.outstanding_balance > 0
    AND NOT EXISTS (SELECT 1 FROM reconciliation_retail_debts d WHERE d.sale_uid = s.uid AND d.is_deleted = false)),
c AS (
  SELECT cs.*, cs.src = 'MANUAL_RETAIL' walk_in,
         least(greatest(coalesce(cs.owed_raw,0),0), coalesce(cs.issued,0)) owed,
         CASE WHEN cs.legacy THEN 0 ELSE coalesce((SELECT sum(a.amount) FROM debt_adjustment a
              WHERE a.sale_uid=cs.sale_uid AND a.status='APPROVED' AND NOT a.is_deleted AND a.approved_at IS NOT NULL),0) END adj_total,
         CASE WHEN cs.legacy THEN 0 ELSE coalesce((SELECT sum(a.amount) FROM debt_adjustment a
              WHERE a.sale_uid=cs.sale_uid AND a.status='APPROVED' AND NOT a.is_deleted AND a.approved_at IS NOT NULL
                AND a.approved_at::date < :'cut'),0) END adj_before
  FROM cs),
c2 AS (SELECT c.*, greatest(coalesce(c.issued,0) - c.owed - c.adj_total, 0) collected_total FROM c),
ev AS (        -- posEvidence / walkInEvidence
  SELECT c2.sale_uid, e.d, e.amt, e.id FROM c2
  JOIN LATERAL (
    SELECT r.reconciliation_date d, x.amount_collected amt, x.id FROM reconciliation_debt_collections x
      JOIN daily_reconciliation r ON r.uid = x.reconciliation_uid
     WHERE NOT c2.walk_in AND x.sale_uid = c2.sale_uid AND NOT x.is_deleted AND x.amount_collected > 0
    UNION ALL
    SELECT dp.paid_at::date, dp.amount_paid, dp.id FROM reconciliation_debt_payments dp
      JOIN reconciliation_retail_debts rd ON rd.uid = dp.debt_uid
     WHERE c2.walk_in AND rd.sale_uid = c2.sale_uid AND NOT dp.is_deleted AND NOT rd.is_deleted AND dp.amount_paid > 0 AND dp.paid_at IS NOT NULL
  ) e ON true),
evc AS (
  SELECT ev.*, c2.collected_total,
         least(ev.amt, greatest(c2.collected_total - coalesce(sum(ev.amt) OVER (PARTITION BY ev.sale_uid ORDER BY ev.d, ev.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0), 0)) capped
  FROM ev JOIN c2 USING (sale_uid)),
lastpay AS (
  SELECT p.sale_uid, max(CAST(COALESCE(p.payment_date, p.updated_at) AS date)) lp
  FROM payments p WHERE p.is_active AND NOT p.is_deleted AND p.payment_status NOT IN ('CANCELLED','REFUNDED')
  GROUP BY 1)
SELECT c2.sale_uid, s.receipt_number, c2.src, c2.legacy, c2.issued, c2.issued_on, c2.owed, c2.adj_total, c2.collected_total,
       coalesce((SELECT sum(capped) FROM evc WHERE evc.sale_uid=c2.sale_uid AND capped > 0),0) dated,
       coalesce((SELECT sum(capped) FROM evc WHERE evc.sale_uid=c2.sale_uid AND capped > 0 AND evc.d < :'cut'),0) dated_before,
       coalesce(lp.lp, c2.issued_on) remainder_on,
       -- mchango kwenye AR opening ya 09-01
       (CASE WHEN c2.issued_on < :'cut' THEN c2.issued ELSE 0 END)
       - c2.adj_before
       - coalesce((SELECT sum(capped) FROM evc WHERE evc.sale_uid=c2.sale_uid AND capped > 0 AND evc.d < :'cut'),0)
       - (CASE WHEN coalesce(lp.lp, c2.issued_on) < :'cut'
               THEN greatest(c2.collected_total - coalesce((SELECT sum(capped) FROM evc WHERE evc.sale_uid=c2.sale_uid AND capped > 0),0),0)
               ELSE 0 END) ar_0109
FROM c2 JOIN sales s ON s.uid=c2.sale_uid LEFT JOIN lastpay lp ON lp.sale_uid=c2.sale_uid
WHERE c2.issued_on IS NOT NULL
ORDER BY 1;
\o
