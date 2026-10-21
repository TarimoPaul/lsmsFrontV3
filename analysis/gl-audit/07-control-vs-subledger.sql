-- 07: CONTROL vs SUB-LEDGER. Read-only.
-- GL kwa tarehe 31/07, 31/08, 01/09, 30/09, 13/10 (entry_date <= D) na sub-ledger za SASA (dump 14/10 00:24).
-- Sub-ledger za mfumo hazina "as-of" (GlReconciliationService.controlChecks hutumia hali ya sasa), kwa hiyo
-- ulinganisho wa moja kwa moja ni wa 13/10 tu; tarehe za nyuma zinaonyesha GL tu (AR ya nyuma: 07b).
SET default_transaction_read_only = on;

-- 7.1 GL kwa tarehe
SELECT d::date tarehe,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code IN ('1100','1110')) ar,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code='1200') inventory,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code='1120') staff,
  sum(l.credit_amount - l.debit_amount) FILTER (WHERE l.account_code='2000') ap,
  sum(l.credit_amount - l.debit_amount) FILTER (WHERE l.account_code='2100') loans,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code='1000') cash,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code LIKE '10%' AND l.account_code <> '1000') bank_mobile,
  sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code LIKE '15%') fixed_net
FROM (VALUES ('2026-07-31'::date),('2026-08-31'),('2026-09-01'),('2026-09-30'),('2026-10-13')) v(d)
JOIN journal_entry j ON j.entry_date <= v.d JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
GROUP BY 1 ORDER BY 1;

-- 7.2 Sub-ledger za sasa
SELECT 'AR: sales.outstanding (mteja hai) = controlChecks' kipimo, sum(s.outstanding_balance) tzs
  FROM sales s JOIN customers c ON c.uid=s.customer_id WHERE NOT s.is_deleted AND s.outstanding_balance > 0 AND NOT c.is_deleted
UNION ALL SELECT 'AR: sales.outstanding zote', sum(outstanding_balance) FROM sales WHERE NOT is_deleted AND outstanding_balance > 0
UNION ALL SELECT 'AR: kati yake MANUAL_RETAIL', sum(outstanding_balance) FROM sales WHERE NOT is_deleted AND outstanding_balance > 0 AND sale_source='RECONCILIATION_MANUAL'
UNION ALL SELECT 'Inventory: current_stock x current_average_cost (fallback last_purchase_cost)',
  sum(p.current_stock * coalesce(nullif(p.current_average_cost,0), p.last_purchase_cost, 0)) FROM products p WHERE p.current_stock > 0
UNION ALL SELECT 'Inventory: bidhaa zenye stock lakini gharama 0/NULL (idadi)', count(*) FROM products p
  WHERE p.current_stock > 0 AND coalesce(nullif(p.current_average_cost,0), p.last_purchase_cost, 0) = 0
UNION ALL SELECT 'Inventory: bidhaa zenye stock hasi (idadi)', count(*) FROM products p WHERE p.current_stock < 0
UNION ALL SELECT 'Staff: amount - malipo (si WAIVED)', sum(greatest(l.amount - coalesce((SELECT sum(p.amount) FROM staff_liability_payment p WHERE p.liability_uid=l.uid),0),0))
  FROM staff_liability l WHERE NOT l.is_deleted AND l.status <> 'WAIVED'
UNION ALL SELECT 'Staff: jumla iliyotozwa (si WAIVED)', sum(l.amount) FROM staff_liability l WHERE NOT l.is_deleted AND l.status <> 'WAIVED'
UNION ALL SELECT 'Staff: jumla iliyolipwa', sum(p.amount) FROM staff_liability_payment p
UNION ALL SELECT 'AP: purchases RECEIVED (total - amount_paid) - supplier_payments',
  (SELECT sum(greatest(x,0)) FROM (SELECT p.supplier_uid, sum(p.total_amount - coalesce(p.amount_paid,0))
     - coalesce((SELECT sum(sp.amount) FROM supplier_payments sp WHERE sp.supplier_uid=p.supplier_uid AND NOT sp.is_deleted),0) x
     FROM purchases p WHERE p.status='RECEIVED' AND NOT p.is_deleted AND p.supplier_uid IS NOT NULL GROUP BY p.supplier_uid) y)
UNION ALL SELECT 'Loans: LOAN - LOAN_REPAYMENT', sum(CASE WHEN source_type='LOAN' AND injection_type='INJECTION' THEN amount
                                                     WHEN source_type='LOAN_REPAYMENT' THEN -coalesce(principal_amount, amount) ELSE 0 END) FROM capital_injections
UNION ALL SELECT 'Fixed: capex OFFICE/TECH APPROVED (gross)', sum(amount) FROM capital_expenditure
  WHERE status='APPROVED' AND NOT coalesce(is_deleted,false) AND capital_type IN ('OFFICE_CAPITAL','TECHNOLOGY_ASSET')
UNION ALL SELECT 'Fixed: accumulated_depreciation kwenye capex', sum(accumulated_depreciation) FROM capital_expenditure
  WHERE status='APPROVED' AND NOT coalesce(is_deleted,false) AND capital_type IN ('OFFICE_CAPITAL','TECHNOLOGY_ASSET')
UNION ALL SELECT 'Fixed: asset_item register (unit_value)', sum(unit_value) FROM asset_item WHERE NOT is_deleted;

-- 7.3 Fedha: safe box na recon (kwa kulinganisha na GL 1000)
SELECT status, count(*), sum(amount) FROM safe_box_deposits GROUP BY 1 ORDER BY 1;
SELECT snapshot_date, user_name, expected_cash, declared_cash, variance_amount, safe_box_total
FROM daily_financial_snapshot WHERE is_current ORDER BY snapshot_date DESC LIMIT 5;
