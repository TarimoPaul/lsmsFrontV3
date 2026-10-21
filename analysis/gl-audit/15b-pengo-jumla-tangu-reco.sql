-- 15b (Awamu 1b, kipengele 6): pengo la JUMLA tangu reco ya kwanza (13/06) hadi mwisho wa kila mwezi, kwa ufafanuzi uleule wa 15.
-- DB: lsms_audit_20261015_0200. Kusoma tu.
-- Pia: pesa iliyokuwa nje ya droo KABLA ya 13/06 haijulikani (hakuna reco): mtaji 10,598,755 (19/05) + mkopo 244,985 (21/05, ulilipwa 11/06).
SET default_transaction_read_only = on;
WITH r AS (
  SELECT reconciliation_date d, sum(bank_deposits_total + safe_box_total + mobile_money_total) nje_ya_droo, sum(purchases_total) rp, sum(expenses_total) rx
  FROM daily_reconciliation WHERE NOT is_deleted AND status <> 'DRAFT' AND reconciliation_date BETWEEN '2026-06-13' AND '2026-08-31' GROUP BY 1),
g AS (
  SELECT e.entry_date d,
    sum(l.credit_amount) FILTER (WHERE e.reference_type IN ('PURCHASE_INVENTORY','PURCHASE_PAYMENT')) purch,
    sum(l.credit_amount) FILTER (WHERE e.reference_type IN ('EXPENSE_DIRECT','EXPENSE_RECURRING','ASSET_PURCHASE')) exp,
    sum(l.credit_amount) FILTER (WHERE e.reference_type = 'LOAN_REPAYMENT') rep,
    sum(l.debit_amount) FILTER (WHERE e.reference_type IN ('LOAN_RECEIVED','CAPITAL_INJECTION')) fin
  FROM journal_entry e JOIN journal_entry_line l ON l.journal_entry_uid = e.uid
  WHERE NOT e.is_deleted AND l.account_code LIKE '10%' AND e.entry_date BETWEEN '2026-06-13' AND '2026-08-31' GROUP BY 1),
x AS (
  SELECT coalesce(r.d, g.d) d,
         coalesce(nje_ya_droo,0) + coalesce(fin,0) - (coalesce(purch,0) - coalesce(rp,0)) - (coalesce(exp,0) - coalesce(rx,0)) - coalesce(rep,0) siku
  FROM r FULL JOIN g ON g.d = r.d),
y AS (SELECT d, siku, sum(siku) OVER (ORDER BY d) cum, date_trunc('month', d)::date m FROM x),
mw AS (SELECT m, max(d) mwisho FROM y GROUP BY m)
SELECT y.m mwezi, round(sum(y.siku)) pengo_mwezi,
       round(max(y.cum) FILTER (WHERE y.d = mw.mwisho)) jumla_tangu_1306_mwisho_wa_mwezi,
       round(min(y.cum)) jumla_chini_kabisa, (array_agg(y.d ORDER BY y.cum))[1] siku_ya_chini_kabisa
FROM y JOIN mw ON mw.m = y.m GROUP BY y.m ORDER BY y.m;
