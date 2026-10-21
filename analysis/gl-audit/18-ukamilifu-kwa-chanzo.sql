-- 18 (sehemu i, kipengele 1): kwa kila chanzo kinachomeza kosa la GL, rekodi zisizo na journal hai. zote / baada ya T0.
-- DB: lsms_audit_20261015_0200. Kusoma tu. T0 = 2026-09-30 10:32:19.
SET default_transaction_read_only = on;
WITH je AS (SELECT DISTINCT reference_uid FROM journal_entry j WHERE NOT j.is_deleted AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid))
SELECT 'sales STANDARD (zisizofutwa, jumla > 0)' chanzo, count(*) zote, count(*) FILTER (WHERE s.uid NOT IN (SELECT reference_uid FROM je)) bila_journal,
       count(*) FILTER (WHERE s.created_at >= '2026-09-30 10:32:19') baada_t0, count(*) FILTER (WHERE s.created_at >= '2026-09-30 10:32:19' AND s.uid NOT IN (SELECT reference_uid FROM je)) baada_t0_bila
FROM sales s WHERE NOT s.is_deleted AND s.sale_source = 'STANDARD' AND s.total_amount > 0
UNION ALL
SELECT 'walk-in (RECONCILIATION_MANUAL) yenye deni > 0: <uid>:DEBT', count(*), count(*) FILTER (WHERE s.uid || ':DEBT' NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE s.created_at >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE s.created_at >= '2026-09-30 10:32:19' AND s.uid || ':DEBT' NOT IN (SELECT reference_uid FROM je))
FROM sales s WHERE NOT s.is_deleted AND s.sale_source = 'RECONCILIATION_MANUAL' AND s.outstanding_balance > 0
UNION ALL
SELECT 'purchases RECEIVED', count(*), count(*) FILTER (WHERE p.uid NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE p.approval_date >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE p.approval_date >= '2026-09-30 10:32:19' AND p.uid NOT IN (SELECT reference_uid FROM je))
FROM purchases p WHERE NOT coalesce(p.is_deleted,false) AND p.status = 'RECEIVED'
UNION ALL
SELECT 'supplier_payments', count(*), count(*) FILTER (WHERE sp.uid NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE sp.created_at >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE sp.created_at >= '2026-09-30 10:32:19' AND sp.uid NOT IN (SELECT reference_uid FROM je))
FROM supplier_payments sp WHERE NOT coalesce(sp.is_deleted,false)
UNION ALL
SELECT 'stock_adjustment (counting) gl_posted = false', count(*), count(*) FILTER (WHERE NOT coalesce(gl_posted,false)),
       count(*) FILTER (WHERE approved_at >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE approved_at >= '2026-09-30 10:32:19' AND NOT coalesce(gl_posted,false))
FROM stock_adjustment WHERE NOT is_deleted
UNION ALL
SELECT 'capital_expenditure APPROVED (gharama/mali, si PRODUCT/INVENTORY, si za baadaye)', count(*), count(*) FILTER (WHERE c.uid NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE c.approval_date >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE c.approval_date >= '2026-09-30 10:32:19' AND c.uid NOT IN (SELECT reference_uid FROM je))
FROM capital_expenditure c WHERE NOT coalesce(c.is_deleted,false) AND c.status = 'APPROVED' AND c.capital_type NOT IN ('PRODUCT_CAPITAL','INVENTORY_CAPITAL')
  AND c.transaction_date <= '2026-10-14 23:59:59'
UNION ALL
SELECT 'capital_injections (INJECTION/WITHDRAWAL)', count(*), count(*) FILTER (WHERE ci.uid NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE ci.created_at >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE ci.created_at >= '2026-09-30 10:32:19' AND ci.uid NOT IN (SELECT reference_uid FROM je))
FROM capital_injections ci WHERE ci.injection_type IN ('INJECTION','WITHDRAWAL')
UNION ALL
SELECT 'daily_financial_snapshot is_current, variance <> 0', count(*), count(*) FILTER (WHERE f.uid NOT IN (SELECT reference_uid FROM je)),
       count(*) FILTER (WHERE f.created_at >= '2026-09-30 10:32:19'), count(*) FILTER (WHERE f.created_at >= '2026-09-30 10:32:19' AND f.uid NOT IN (SELECT reference_uid FROM je))
FROM daily_financial_snapshot f WHERE f.is_current AND f.variance_amount <> 0;
-- payments za madeni (makusanyo) baada ya T0: journal zina reference <paymentUid>:RCPT:<cumulative>
SELECT count(*) malipo_ya_madeni_baada_t0, count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid LIKE p.uid || ':RCPT:%' AND NOT j.is_deleted)) bila_journal,
       round(sum(p.amount_paid)) tzs
FROM payments p JOIN sales s ON s.uid = p.sale_uid
WHERE NOT p.is_deleted AND p.amount_paid > 0 AND p.updated_at >= '2026-09-30 10:32:19' AND s.sale_date::date < p.payment_date::date;
-- uthibitisho: stock_adjustment zenye gl_posted = false - zina journal kwa gl_reference_uid?
SELECT coalesce(gl_posted,false) gl_posted, count(*),
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = sa.gl_reference_uid AND NOT j.is_deleted AND NOT j.is_reversal)) zina_journal,
       count(*) FILTER (WHERE coalesce(adjustment_value,0) = 0) thamani_sifuri,
       min(approved_at)::date, max(approved_at)::date
FROM stock_adjustment sa WHERE NOT is_deleted GROUP BY 1;
-- capex APPROVED zisizo na journal
SELECT c.reference_number, c.description, c.capital_type, c.expenditure_type, c.amount, c.transaction_date::date, c.approval_date::date, c.source
FROM capital_expenditure c WHERE NOT coalesce(c.is_deleted,false) AND c.status = 'APPROVED' AND c.capital_type NOT IN ('PRODUCT_CAPITAL','INVENTORY_CAPITAL')
  AND c.transaction_date <= '2026-10-14 23:59:59'
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal);
