-- 09: UKAMILIFU (source dhidi ya journal), UFUATILIAJI (orphans), VIPINDI (tarehe), COGS. Read-only.
SET default_transaction_read_only = on;

-- 9.1 Ukamilifu kwa aina ya tukio (zote / baada ya T0 = 2026-09-30 10:32:19)
WITH src AS (
  SELECT 'purchase RECEIVED' aina, p.uid ref, p.total_amount amt, p.created_at FROM purchases p WHERE p.status='RECEIVED' AND NOT p.is_deleted AND p.total_amount > 0
  UNION ALL SELECT 'supplier_payment', sp.uid, sp.amount, sp.created_at FROM supplier_payments sp WHERE NOT sp.is_deleted AND sp.amount > 0
  UNION ALL SELECT 'staff_liability_payment', 'LIABPAY:'||lp.uid, lp.amount, lp.created_at FROM staff_liability_payment lp WHERE NOT lp.is_deleted AND lp.amount > 0
  UNION ALL SELECT 'stock_adjustment (count)', sa.gl_reference_uid, abs(sa.adjustment_value), sa.created_at FROM stock_adjustment sa
     WHERE NOT sa.is_deleted AND sa.gl_reference_uid IS NOT NULL AND sa.adjustment_value <> 0
  UNION ALL SELECT 'sales_return APPROVED', r.uid, r.refund_amount, r.created_at FROM sales_returns r WHERE r.return_status IN ('APPROVED','COMPLETED','PROCESSED') AND NOT r.is_deleted
  UNION ALL SELECT 'capital_injection', i.uid, i.amount, i.created_at FROM capital_injections i WHERE i.injection_type <> 'VOID'
  UNION ALL SELECT 'debt_adjustment APPROVED', d.uid, d.amount, d.created_at FROM debt_adjustment d WHERE d.status='APPROVED' AND NOT d.is_deleted)
SELECT aina, count(*) idadi, sum(amt) tzs,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = src.ref)) bila_journal,
       sum(amt) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = src.ref)) tzs_bila_journal,
       count(*) FILTER (WHERE created_at >= '2026-09-30 10:32:19' AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = src.ref)) bila_journal_baada_T0
FROM src GROUP BY 1 ORDER BY 1;
-- debt_adjustment bila journal (maelezo)
SELECT d.uid, d.type, d.amount, d.approved_at, s.receipt_number, s.sale_source FROM debt_adjustment d JOIN sales s ON s.uid=d.sale_uid
WHERE d.status='APPROVED' AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=d.uid);
-- malipo ya madeni (collections) baada ya T0: payments za sales za zamani zisizo na PAYMENT_RECEIVED
SELECT count(*) payments_baada_T0_za_sale_za_zamani, sum(p.amount_paid) tzs,
       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid LIKE p.uid||':RCPT:%')) bila_journal,
       sum(p.amount_paid) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid LIKE p.uid||':RCPT:%')) tzs_bila_journal
FROM payments p JOIN sales s ON s.uid=p.sale_uid
WHERE p.created_at >= '2026-09-30 10:32:19' AND p.created_at > s.created_at + interval '5 minutes' AND p.amount_paid > 0 AND p.is_active AND NOT p.is_deleted;
-- Malipo ya 175,000 ya 121026-2249 (sale isiyopostiwa): AR imepunguzwa bila kuongezwa
SELECT j.entry_number, j.reference_type, j.entry_date, j.total_debit FROM journal_entry j
WHERE j.reference_uid LIKE ANY (SELECT p.uid||':RCPT:%' FROM payments p JOIN sales s ON s.uid=p.sale_uid WHERE s.receipt_number IN ('101026-2202','121026-2249','131026-2227'));

-- 9.2 Ufuatiliaji: journal ambazo reference haipo kwenye source (orphans), kwa aina
WITH j AS (SELECT j.uid, j.reference_type rt, j.reference_uid ru, j.total_debit FROM journal_entry j WHERE NOT j.is_reversal)
SELECT rt, count(*) journals,
  count(*) FILTER (WHERE NOT (
       EXISTS (SELECT 1 FROM sales s WHERE s.uid = split_part(ru, ':', 1))
    OR EXISTS (SELECT 1 FROM payments p WHERE p.uid = split_part(ru, ':', 1))
    OR EXISTS (SELECT 1 FROM purchases p WHERE p.uid = ru)
    OR EXISTS (SELECT 1 FROM supplier_payments p WHERE p.uid = ru)
    OR EXISTS (SELECT 1 FROM capital_expenditure c WHERE c.uid = split_part(ru, '-DEP-', 1) OR c.uid = ru)
    OR EXISTS (SELECT 1 FROM capital_injections i WHERE i.uid = ru)
    OR EXISTS (SELECT 1 FROM daily_financial_snapshot f WHERE f.uid = ru)
    OR EXISTS (SELECT 1 FROM stock_adjustment a WHERE a.gl_reference_uid = ru)
    OR EXISTS (SELECT 1 FROM staff_liability_payment p WHERE 'LIABPAY:'||p.uid = ru)
    OR EXISTS (SELECT 1 FROM staff_liability_item i WHERE i.uid = split_part(ru, ':', 2) OR i.uid = ru)
    OR EXISTS (SELECT 1 FROM staff_liability l WHERE l.uid = split_part(ru, ':', 2) OR l.uid = ru)
    OR EXISTS (SELECT 1 FROM asset_count_line a WHERE 'ASSETCHG:'||a.uid = ru)
    OR EXISTS (SELECT 1 FROM sales_returns r WHERE r.uid = ru)
    OR EXISTS (SELECT 1 FROM debt_adjustment d WHERE d.uid = ru)
    OR EXISTS (SELECT 1 FROM store s WHERE 'STOCK:'||s.uid = ru)
    OR ru LIKE 'TRUEUP:%' OR ru LIKE 'TRF:%' OR ru LIKE 'MANUAL:%' OR ru LIKE 'OPENING:%')) orphans
FROM j GROUP BY 1 ORDER BY 3 DESC, 1;
-- mifano ya orphans
WITH j AS (SELECT j.entry_number, j.reference_type rt, j.reference_uid ru, j.total_debit, j.entry_date FROM journal_entry j WHERE NOT j.is_reversal)
SELECT * FROM j WHERE rt IN ('STAFF_LIABILITY_CHARGE','STAFF_LIABILITY_WAIVER','STOCK_ADJUSTMENT','OPENING_BALANCE','SHRINKAGE_LOSS') LIMIT 0;
-- muundo wa reference_uid kwa aina (kuona prefixes)
SELECT reference_type, regexp_replace(reference_uid, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uid>', 'g') umbo, count(*)
FROM journal_entry GROUP BY 1,2 ORDER BY 1,3 DESC;

-- 9.3 Vipindi: entry_date dhidi ya created_at kwa journal za LIVE (zisizo za rebuild)
SELECT reference_type,
       count(*) journals_live,
       count(*) FILTER (WHERE entry_date < created_at::date) zimerudishwa_nyuma,
       max(created_at::date - entry_date) siku_nyingi_zaidi,
       count(*) FILTER (WHERE entry_date > created_at::date) za_mbele
FROM journal_entry WHERE created_at >= '2026-09-30 10:32:19' GROUP BY 1 ORDER BY 3 DESC;
-- Sales zilizoingizwa kwa kuchelewa: sale_date dhidi ya created_at (siku)
SELECT (created_at::date - sale_date::date) siku_za_kuchelewa, count(*), sum(total_amount)
FROM sales WHERE NOT is_deleted GROUP BY 1 HAVING (created_at::date - sale_date::date) <> 0 ORDER BY 1 LIMIT 30;
-- journals zilizopostiwa ndani ya mwezi uliopita (entry_date ya Septemba, created_at Oktoba) - live tu
SELECT reference_type, count(*), sum(total_debit) FROM journal_entry
WHERE created_at >= '2026-10-01' AND entry_date < '2026-10-01' GROUP BY 1 ORDER BY 3 DESC;
-- gl_period
SELECT count(*) gl_period_rows FROM gl_period;

-- 9.4 COGS: GL 5000 (sales) dhidi ya gharama ya sale items
SELECT
 (SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
   WHERE l.account_code='5000' AND j.reference_type IN ('SALE_CASH','SALE_CREDIT','SALE_MIXED')) gl_cogs_sales_net,
 (SELECT sum(CASE WHEN d.total_cost > 0 THEN d.total_cost ELSE d.cost_per_piece*d.piece_quantity END)
    FROM sales_details d JOIN sales s ON s.uid=d.sale_uid WHERE NOT s.is_deleted AND NOT d.is_deleted
     AND EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=s.uid AND NOT j.is_reversal)) items_cost_sales_zenye_journal,
 (SELECT sum(CASE WHEN d.total_cost > 0 THEN d.total_cost ELSE d.cost_per_piece*d.piece_quantity END)
    FROM sales_details d JOIN sales s ON s.uid=d.sale_uid WHERE NOT s.is_deleted AND NOT d.is_deleted) items_cost_sales_zote,
 (SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry_line l WHERE l.account_code='5000') gl_5000_jumla;
-- Mistari ya sale yenye gharama 0 (COGS haipo)
SELECT count(*) mistari_gharama_0, sum(d.sub_total) mauzo_yake FROM sales_details d JOIN sales s ON s.uid=d.sale_uid
WHERE NOT s.is_deleted AND NOT d.is_deleted AND coalesce(nullif(d.total_cost,0), d.cost_per_piece*d.piece_quantity, 0) = 0 AND d.sub_total > 0;
-- cost_source (njia ya gharama) kwa mistari ya sale
SELECT coalesce(cost_source,'(null)') cost_source, count(*), min(created_at)::date, max(created_at)::date FROM sales_details GROUP BY 1 ORDER BY 2 DESC;
