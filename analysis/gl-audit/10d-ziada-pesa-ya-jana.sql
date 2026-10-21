-- 10d (Awamu 1b, kipengele 1): ziada dhidi ya PESA YA JANA (cash_previous_total ya reco + CASH_IN_HAND iliyotangazwa siku iliyopita).
-- DB: lsms_audit_20261015_0200. Kusoma tu. Formula 1 haiongezi pesa ya jana; ikiwekwa benki leo inaonekana "ziada".
-- Nakala za H-5: toleo la juu tu la kila siku.
SET default_transaction_read_only = on;
WITH f AS (
  SELECT f.uid, f.reconciliation_uid, f.snapshot_date d, f.snapshot_version v, f.user_uid, -f.variance_amount ziada,
         f.expected_cash, f.declared_cash,
         row_number() OVER (PARTITION BY f.snapshot_date ORDER BY f.snapshot_version DESC) rn
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
x AS (
  SELECT f.d, f.ziada, f.expected_cash, f.declared_cash, r.cash_previous_total jana_kwenye_reco,
         (SELECT p.cash_on_hand_declared + p.petty_cash_total FROM daily_reconciliation p
           WHERE NOT p.is_deleted AND p.user_uid = f.user_uid AND p.reconciliation_date < f.d AND p.status <> 'DRAFT'
           ORDER BY p.reconciliation_date DESC LIMIT 1) jana_droo,
         (SELECT p.reconciliation_date FROM daily_reconciliation p
           WHERE NOT p.is_deleted AND p.user_uid = f.user_uid AND p.reconciliation_date < f.d AND p.status <> 'DRAFT'
           ORDER BY p.reconciliation_date DESC LIMIT 1) reco_iliyopita
  FROM f LEFT JOIN daily_reconciliation r ON r.uid = f.reconciliation_uid WHERE f.rn = 1)
SELECT d, ziada, expected_cash, declared_cash, reco_iliyopita, jana_droo, jana_kwenye_reco,
       least(ziada, greatest(coalesce(jana_droo,0) - coalesce(jana_kwenye_reco,0), 0)) inaelezwa_na_pesa_ya_jana,
       ziada - least(ziada, greatest(coalesce(jana_droo,0) - coalesce(jana_kwenye_reco,0), 0)) baki
FROM x ORDER BY d;
WITH f AS (
  SELECT f.reconciliation_uid, f.snapshot_date d, f.user_uid, -f.variance_amount ziada,
         row_number() OVER (PARTITION BY f.snapshot_date ORDER BY f.snapshot_version DESC) rn
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
x AS (
  SELECT f.ziada, r.cash_previous_total jr,
         (SELECT p.cash_on_hand_declared + p.petty_cash_total FROM daily_reconciliation p
           WHERE NOT p.is_deleted AND p.user_uid = f.user_uid AND p.reconciliation_date < f.d AND p.status <> 'DRAFT'
           ORDER BY p.reconciliation_date DESC LIMIT 1) jd
  FROM f LEFT JOIN daily_reconciliation r ON r.uid = f.reconciliation_uid WHERE f.rn = 1)
SELECT count(*) siku, sum(ziada) ziada, sum(least(ziada, greatest(coalesce(jd,0)-coalesce(jr,0),0))) inaelezwa_na_pesa_ya_jana,
       sum(ziada - least(ziada, greatest(coalesce(jd,0)-coalesce(jr,0),0))) baki FROM x;
