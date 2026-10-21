-- 17 (sehemu i, kipengele 3): gharama za Daily P&L dhidi ya GL, kwa mwezi (Jan-Okt 2026).
-- DB: lsms_audit_20261015_0200. Kusoma tu. Okt = 1-14/10.
-- Daily P&L (DailyPnlService.java:130-166, DailyPnlCalculator.java:193-245), imeigwa kwa SQL:
--   kila_siku  = reconciliation_expenses (reco isiyofutwa, HALI YOYOTE pamoja na DRAFT) kwa reconciliation_date
--   kila_mwezi = capital_expenditure MONTHLY_EXPENSE, is_approved, si recurring, si LOAN_PAYMENT; inahusika na mwezi m kama
--                allocated_year = mwaka wa m na (allocated_month = mwezi wa m AU allocated_month = 0), au (bila allocated_year) mwezi wa transaction_date
--   uchakavu   = mali APPROVED: kila mwezi tangu mwezi wa kununua, kwa life miezi, kabla ya mwezi wa disposal:
--                monthly_depreciation, au (amount - salvage) / life
-- GL: mistari ya akaunti 6xxx kwa entry_date (journals zisizofutwa; reversals zimo kama mistari kinyume).
SET default_transaction_read_only = on;
WITH m AS (SELECT generate_series('2026-01-01'::date, '2026-10-01'::date, interval '1 month')::date m),
daily AS (
  SELECT date_trunc('month', r.reconciliation_date)::date m, sum(e.amount) v
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid
  WHERE NOT e.is_deleted AND NOT r.is_deleted AND r.reconciliation_date <= '2026-10-14' GROUP BY 1),
monthly AS (
  SELECT m.m, sum(c.amount) v FROM m JOIN capital_expenditure c ON
       c.expenditure_type = 'MONTHLY_EXPENSE' AND c.is_approved AND NOT coalesce(c.is_deleted,false)
   AND NOT coalesce(c.is_recurring,false) AND c.capital_type <> 'LOAN_PAYMENT'
   AND ( (c.allocated_year IS NULL AND date_trunc('month', c.transaction_date)::date = m.m)
      OR (c.allocated_year = extract(year FROM m.m) AND (c.allocated_month = extract(month FROM m.m) OR c.allocated_month = 0)) )
  GROUP BY 1),
dep AS (
  SELECT m.m, sum(coalesce(c.monthly_depreciation, round(greatest(c.amount - coalesce(c.salvage_value,0),0) / c.asset_life_months, 2))) v
  FROM m JOIN capital_expenditure c ON c.is_asset AND c.status = 'APPROVED' AND NOT coalesce(c.is_deleted,false)
   AND coalesce(c.asset_life_months,0) > 0 AND c.amount > 0
   AND ((extract(year FROM m.m)*12 + extract(month FROM m.m)) - (extract(year FROM coalesce(c.transaction_date, c.approval_date))*12 + extract(month FROM coalesce(c.transaction_date, c.approval_date)))) BETWEEN 0 AND c.asset_life_months - 1
   AND (c.disposal_date IS NULL OR date_trunc('month', c.disposal_date)::date > m.m)
  GROUP BY 1),
gl AS (
  SELECT date_trunc('month', j.entry_date)::date m,
         sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code LIKE '6%' AND l.account_code NOT IN ('6500','6700','6110','6120','6600')) gl_uendeshaji,
         sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code = '6500') gl_uchakavu,
         sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code = '6700') gl_droo_6700,
         sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code IN ('6110','6120')) gl_madeni,
         sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code = '6600') gl_riba
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
  WHERE NOT j.is_deleted AND j.entry_date <= '2026-10-14' GROUP BY 1)
SELECT m.m mwezi,
       round(coalesce(daily.v,0)) pnl_kila_siku, round(coalesce(monthly.v,0)) pnl_kila_mwezi,
       round(coalesce(daily.v,0) + coalesce(monthly.v,0)) pnl_uendeshaji,
       round(coalesce(gl.gl_uendeshaji,0)) gl_uendeshaji,
       round(coalesce(gl.gl_uendeshaji,0) - coalesce(daily.v,0) - coalesce(monthly.v,0)) tofauti_uendeshaji_gl_minus_pnl,
       round(coalesce(dep.v,0)) pnl_uchakavu, round(coalesce(gl.gl_uchakavu,0)) gl_uchakavu,
       round(coalesce(gl.gl_droo_6700,0)) gl_6700_hakuna_kwenye_pnl, round(coalesce(gl.gl_madeni,0)) gl_6110_6120, round(coalesce(gl.gl_riba,0)) gl_riba_6600
FROM m LEFT JOIN daily USING (m) LEFT JOIN monthly USING (m) LEFT JOIN dep USING (m) LEFT JOIN gl USING (m)
ORDER BY 1;
-- Uchambuzi wa tofauti ya uendeshaji kwa kila mwezi, kwa chanzo cha GL (EXPENSE_DIRECT kwa source/expenditure_type)
SELECT date_trunc('month', j.entry_date)::date mwezi, coalesce(c.expenditure_type, '(si capex)') aina, coalesce(c.source, '-') source,
       count(DISTINCT j.uid) journals, round(sum(l.debit_amount - l.credit_amount)) gl_tzs
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
LEFT JOIN capital_expenditure c ON c.uid = j.reference_uid
WHERE NOT j.is_deleted AND j.entry_date <= '2026-10-14' AND l.account_code LIKE '6%' AND l.account_code NOT IN ('6500','6700','6110','6120','6600')
GROUP BY 1,2,3 ORDER BY 1,2,3;
-- Tarehe: gharama ya reco (P&L inatumia reconciliation_date) dhidi ya entry_date ya journal yake (capex.transaction_date)
WITH x AS (
  SELECT e.amount, r.reconciliation_date rd, c.transaction_date::date cd, j.entry_date jd, j.created_at::date posted_on
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid
  JOIN capital_expenditure c ON c.uid = e.capital_expenditure_uid
  JOIN journal_entry j ON j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal
  WHERE NOT e.is_deleted AND NOT r.is_deleted)
SELECT count(*) zote, count(*) FILTER (WHERE jd = rd) tarehe_sawa,
       count(*) FILTER (WHERE jd <> rd) tarehe_tofauti, round(sum(amount) FILTER (WHERE jd <> rd)) tofauti_tzs,
       count(*) FILTER (WHERE date_trunc('month', jd) <> date_trunc('month', rd)) mwezi_tofauti, round(sum(amount) FILTER (WHERE date_trunc('month', jd) <> date_trunc('month', rd))) mwezi_tofauti_tzs,
       min(jd - rd) min_siku, max(jd - rd) max_siku,
       count(*) FILTER (WHERE jd = cd) entry_date_ni_capex_date
FROM x;
-- mifano ya mwezi tofauti
SELECT rd reco_date, jd gl_date, cd capex_date, posted_on, amount FROM (
  SELECT e.amount, r.reconciliation_date rd, c.transaction_date::date cd, j.entry_date jd, j.created_at::date posted_on
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid
  JOIN capital_expenditure c ON c.uid = e.capital_expenditure_uid
  JOIN journal_entry j ON j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal
  WHERE NOT e.is_deleted AND NOT r.is_deleted) y
WHERE date_trunc('month', jd) <> date_trunc('month', rd) ORDER BY rd LIMIT 12;
