-- 06b: AR ya 01/09 kwenye Daily P&L (DailyPnlService.creditSales/payments, si GL):
-- rekodi zenye tarehe kabla ya 2026-09-01 zilizoundwa/kubadilishwa baada ya 2026-10-03. Read-only.
SET default_transaction_read_only = on;
-- a) madeni ya recon (reconciliation_retail_debts) ya kabla ya 09-01 yaliyoguswa baada ya 10-03
SELECT 'retail_debt' chanzo, d.uid, s.receipt_number, coalesce(d.sale_date, s.sale_date::date) tarehe, d.amount, d.is_deleted,
       d.created_at, d.updated_at, s.outstanding_balance owed_sasa
FROM reconciliation_retail_debts d JOIN sales s ON s.uid=d.sale_uid
WHERE coalesce(d.sale_date, s.sale_date::date) < '2026-09-01' AND greatest(d.created_at, coalesce(d.updated_at, d.created_at)) >= '2026-10-03'
ORDER BY greatest(d.created_at, coalesce(d.updated_at, d.created_at)) LIMIT 30;
-- b) sales za kabla ya 09-01 zenye deni zilizoguswa baada ya 10-03
SELECT 'sale' chanzo, s.receipt_number, s.sale_date::date, s.total_amount, s.outstanding_balance, s.payment_status, s.updated_at, s.is_deleted
FROM sales s WHERE s.sale_date < '2026-09-01' AND s.updated_at >= '2026-10-03'
ORDER BY s.updated_at LIMIT 30;
-- c) payments za sales za kabla ya 09-01 (zenye deni) zilizoundwa/kubadilishwa baada ya 10-03
SELECT 'payment' chanzo, s.receipt_number, s.sale_date::date, p.amount_paid, p.outstanding_balance, p.payment_status,
       p.payment_date, p.created_at, p.updated_at, p.is_active, p.is_deleted
FROM payments p JOIN sales s ON s.uid=p.sale_uid
WHERE s.sale_date < '2026-09-01' AND greatest(p.created_at, coalesce(p.updated_at,p.created_at)) >= '2026-10-03'
ORDER BY greatest(p.created_at, coalesce(p.updated_at,p.created_at)) LIMIT 30;
-- d) payments zisizo na payment_date (zinatumia updated_at kama tarehe ya malipo)
SELECT count(*) bila_payment_date, sum(p.amount_paid) tzs FROM payments p WHERE p.payment_date IS NULL AND p.amount_paid > 0;
