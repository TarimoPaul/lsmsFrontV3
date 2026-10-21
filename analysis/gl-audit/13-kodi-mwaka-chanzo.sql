-- 13 (Awamu 1b, kipengele 5): kodi ya frame (2.4M) na TRA (250k): zililipwa kwa pesa ya duka?
-- DB: lsms_audit_20261015_0200. Kusoma tu.
SET default_transaction_read_only = on;
-- 1) rekodi zenyewe
SELECT reference_number, description, capital_type, amount, monthly_allocation_amount, payment_method, source,
       transaction_date::date, allocated_month, allocated_year, expenditure_frequency, status, is_approved, created_at::date, created_by,
       left(coalesce(notes,''),80) notes
FROM capital_expenditure
WHERE NOT coalesce(is_deleted,false)
  AND (reference_number LIKE '%F7C9E331' OR reference_number LIKE '%4B42C8F1' OR reference_number LIKE '%2939F6DE'
       OR description ILIKE '%kodi%' OR description ILIKE '%tra%' OR description ILIKE '%frame%' OR capital_type IN ('RENT_EXPENSE','TAX_EXPENSE'))
ORDER BY transaction_date, created_at;
-- 2) journal zake: akaunti ya upande wa Cr (pesa ilitoka wapi kwenye GL)
SELECT c.reference_number, j.entry_date, j.reference_type, l.account_code, l.debit_amount, l.credit_amount, l.description
FROM capital_expenditure c JOIN journal_entry j ON j.reference_uid = c.uid AND NOT j.is_deleted
JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
WHERE NOT coalesce(c.is_deleted,false)
  AND (c.reference_number LIKE '%F7C9E331' OR c.reference_number LIKE '%4B42C8F1' OR c.reference_number LIKE '%2939F6DE'
       OR c.capital_type IN ('RENT_EXPENSE','TAX_EXPENSE'))
ORDER BY 1, 2, l.line_order;
-- 3) reco expenses zenye maneno kodi/tra/frame au kiasi 2,400,000 / 250,000 / 200,000 (pesa ya droo)
SELECT r.reconciliation_date, x.description, x.amount
FROM reconciliation_expenses x JOIN daily_reconciliation r ON r.uid = x.reconciliation_uid
WHERE NOT x.is_deleted AND NOT r.is_deleted
  AND (x.description ILIKE '%kodi%' OR x.description ILIKE '%tra%' OR x.description ILIKE '%frame%' OR x.description ILIKE '%pango%'
       OR x.amount IN (2400000, 250000, 200000, 20833.33))
ORDER BY 1;
-- 4) mtaji/mkopo ulioingia karibu na tarehe za malipo
SELECT injection_type, source_type, amount, transaction_date::date, left(reason,60) reason FROM capital_injections ORDER BY transaction_date;
-- 5) salio la 1000 kabla na baada ya 01/01, na tukio la kwanza la mauzo/mtaji kwenye GL
SELECT min(entry_date) journal_ya_kwanza FROM journal_entry WHERE NOT is_deleted;
SELECT (SELECT min(sale_date)::date FROM sales WHERE NOT is_deleted) sale_ya_kwanza,
       (SELECT min(entry_date) FROM journal_entry WHERE NOT is_deleted AND reference_type LIKE 'SALE_%') journal_ya_mauzo_ya_kwanza,
       (SELECT min(entry_date) FROM journal_entry WHERE NOT is_deleted AND reference_type IN ('CAPITAL_INJECTION','LOAN_RECEIVED')) mtaji_wa_kwanza_gl;
WITH d AS (
  SELECT j.entry_date, sum(l.debit_amount - l.credit_amount) mwendo
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
  WHERE NOT j.is_deleted AND l.account_code = '1000' AND j.entry_date <= '2026-05-31' GROUP BY 1),
c AS (SELECT entry_date, mwendo, sum(mwendo) OVER (ORDER BY entry_date) salio FROM d)
SELECT * FROM c WHERE entry_date <= '2026-02-28' OR salio < 0 ORDER BY entry_date LIMIT 15;
