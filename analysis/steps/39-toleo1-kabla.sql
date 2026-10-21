-- HATUA 39/40 (STAGING, KUSOMA TU): data ya kutumia kwenye jaribio la Toleo 1 + hali ya kabla.
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY_YA_MWISHO|' || version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1;
SELECT 'GL_CONFIG|posting_enabled=' || posting_enabled || '|shadow_mode=' || shadow_mode FROM gl_config LIMIT 1;
-- bidhaa 1 yenye stock, mteja 1 wa REGULAR (kama hatua 36)
SELECT 'T1DATA|' || p.uid || '|' || replace(p.product_name, '|', '/') || '|' || p.piece_sale_price || '|' || coalesce(p.current_average_cost, 0)
       || '|' || coalesce(p.pieces_per_package, 1) || '|' || coalesce(p.current_stock, 0)
FROM products p
WHERE NOT coalesce(p.is_deleted, false) AND coalesce(p.is_active, true)
  AND p.current_stock >= 20 AND p.piece_sale_price > 0 AND coalesce(p.current_average_cost, 0) > 0
  AND p.piece_sale_price > p.current_average_cost
ORDER BY p.current_stock DESC LIMIT 1;
SELECT 'T1CUST|' || c.uid || '|' || c.customer_type
FROM customers c WHERE NOT coalesce(c.is_deleted, false) AND c.customer_type = 'REGULAR'
ORDER BY c.created_at LIMIT 1;
-- H-2: sales STANDARD tangu GL live (T0 = 2026-09-30 10:32:19) zisizo na journal yoyote hai (pamoja na zilizolipwa baadaye,
-- mf. 121026-2249). Ya mwisho ni deni la sasa; AR ya journal itakuwa deni la siku ya mauzo.
SELECT 'H2SALE|' || s.uid || '|' || s.receipt_number || '|' || s.total_amount || '|' || coalesce(s.outstanding_balance, 0)
FROM sales s
WHERE NOT coalesce(s.is_deleted, false) AND coalesce(s.is_active, true) AND s.sale_source = 'STANDARD'
  AND s.created_at >= '2026-09-30 10:32:19'
  AND coalesce(s.sale_notes, '') !~ '(^|\n)QA-'  -- dokezo la backend liko MBELE (Sales.addNote); NOT LIKE 'QA-%' haikutoa sales za QA
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false))
ORDER BY s.created_at;
-- reco ya mwisho iliyoidhinishwa yenye variance na journal hai (kwa jaribio la reopen, 1.f)
SELECT 'RECON|' || r.uid || '|' || r.reconciliation_date || '|' || f.uid || '|' || f.variance_amount
FROM daily_reconciliation r JOIN daily_financial_snapshot f ON f.reconciliation_uid = r.uid AND f.is_current
WHERE r.status = 'APPROVED' AND f.variance_amount <> 0
  AND (f.variance_amount > 0 OR f.declared_cash > 0)  -- upungufu au ziada K2: itapostiwa upya na marekebisho, kisha reopen iigeuze
  AND EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = f.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false))
ORDER BY r.reconciliation_date DESC LIMIT 1;
-- reco ya Septemba iliyoidhinishwa (upungufu au K2) yenye journal hai: reopen yake baada ya kufunga Sep = tukio la mwezi uliofungwa (1.i)
SELECT 'RECONSEP|' || r.uid || '|' || r.reconciliation_date || '|' || f.uid || '|' || f.variance_amount
FROM daily_reconciliation r JOIN daily_financial_snapshot f ON f.reconciliation_uid = r.uid AND f.is_current
WHERE r.status = 'APPROVED' AND f.variance_amount <> 0 AND (f.variance_amount > 0 OR f.declared_cash > 0)
  AND r.reconciliation_date BETWEEN '2026-09-01' AND '2026-09-30'
  AND EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = f.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false))
ORDER BY r.reconciliation_date DESC LIMIT 1;
-- Q9 (uamuzi wa mmiliki 16/10): K2 za 24/06 na 04/07 kwenye PROD zinakwenda 2900, si 6700. Staging inabaki na 6700;
-- awamu A inaonyesha tofauti kwa dryRun ya pili yenye uids hizi (haiandiki chochote).
SELECT 'Q9SNAP|' || f.uid || '|' || f.snapshot_date || '|' || f.variance_amount || '|' || f.declared_cash
FROM daily_financial_snapshot f
WHERE f.is_current AND f.snapshot_date IN ('2026-06-24', '2026-07-04') AND f.variance_amount < 0 AND f.declared_cash > 0
ORDER BY f.snapshot_date;
-- AR: GL dhidi ya sub-ledger (kabla)
SELECT 'AR_GL|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code IN ('1100', '1110') AND NOT coalesce(j.is_deleted, false);
SELECT 'AR_SUBLEDGER|' || coalesce(sum(outstanding_balance), 0) FROM sales
 WHERE NOT coalesce(is_deleted, false) AND coalesce(is_active, true) AND outstanding_balance > 0;
SELECT 'GL_1000|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code = '1000' AND NOT coalesce(j.is_deleted, false);
SELECT 'FAILURES_OPEN|' || count(*) FROM gl_posting_failure WHERE resolved_at IS NULL;
-- M-7 (19/10): journals 7 za PURCHASE_PAYMENT za 04/10 zinazohamishiwa 30/09 kabla ya kufunga Septemba (awamu B)
SELECT 'M7J|' || j.uid || '|' || j.entry_number || '|' || j.total_debit FROM journal_entry j
 WHERE NOT j.is_deleted AND NOT j.is_reversal AND j.reference_type = 'PURCHASE_PAYMENT' AND j.entry_date = '2026-10-04'
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT r.is_deleted) ORDER BY j.uid;
ROLLBACK;
