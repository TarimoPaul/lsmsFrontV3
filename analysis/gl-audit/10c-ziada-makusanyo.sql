-- 10c (Awamu 1b, kipengele 1): ziada dhidi ya MAKUSANYO YA MADENI (Formula 2) yaliyochanganywa na pesa ya mauzo (Formula 1).
-- DB: lsms_audit_20261015_0200. Kusoma tu.
-- Formula 1 (DailyReconciliation.java:483-491) haihesabu makusanyo ya madeni ya siku nyingine. Kama pesa ya makusanyo
-- imewekwa benki/safe box/droo kama BANK_DEPOSIT/SAFE_BOX/CASH_IN_HAND (Formula 1) badala ya CASH_DEBT/BANK_DEBT/MOBILE_DEBT
-- (Formula 2), Formula 1 inaonyesha "ziada".
-- haijatangazwa_f2 = makusanyo (debt_collections_total) - pesa ya madeni iliyotangazwa kwenye Formula 2 (cash/bank/mobile debt).
-- Aina: K1 = declared 0 na expected hasi (hakuna pesa iliyohesabiwa ya ziada; makato > mauzo);
--       K2 = pesa iliyohesabiwa (declared) > expected.
SET default_transaction_read_only = on;
WITH f AS (
  SELECT f.uid, f.reconciliation_uid, f.snapshot_date d, f.snapshot_version v, -f.variance_amount ziada,
         f.expected_cash, f.declared_cash, f.debt_collections_total makusanyo
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
x AS (
  SELECT f.*, r.cash_debt_total + r.bank_debt_total + r.mobile_debt_total f2_iliyotangazwa,
         greatest(f.makusanyo - (r.cash_debt_total + r.bank_debt_total + r.mobile_debt_total), 0) haijatangazwa_f2,
         CASE WHEN f.declared_cash = 0 AND f.expected_cash < 0 THEN 'K1' ELSE 'K2' END aina,
         count(*) OVER (PARTITION BY f.d) nakala_za_siku
  FROM f LEFT JOIN daily_reconciliation r ON r.uid = f.reconciliation_uid)
SELECT d, v, aina, ziada, expected_cash, declared_cash, makusanyo, f2_iliyotangazwa, haijatangazwa_f2,
       least(ziada, haijatangazwa_f2) inaelezwa_na_makusanyo, ziada - least(ziada, haijatangazwa_f2) baki,
       CASE WHEN nakala_za_siku > 1 THEN 'nakala (H-5)' ELSE '' END h5
FROM x ORDER BY d, v;
-- jumla kwa aina (nakala za H-5 zimehesabiwa mara moja kwa kila siku: toleo la juu tu)
WITH f AS (
  SELECT f.uid, f.reconciliation_uid, f.snapshot_date d, f.snapshot_version v, -f.variance_amount ziada,
         f.expected_cash, f.declared_cash, f.debt_collections_total makusanyo
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
x AS (
  SELECT f.*, greatest(f.makusanyo - (r.cash_debt_total + r.bank_debt_total + r.mobile_debt_total), 0) h,
         CASE WHEN f.declared_cash = 0 AND f.expected_cash < 0 THEN 'K1' ELSE 'K2' END aina,
         row_number() OVER (PARTITION BY f.d ORDER BY f.v DESC) rn
  FROM f LEFT JOIN daily_reconciliation r ON r.uid = f.reconciliation_uid)
SELECT coalesce(aina,'JUMLA') aina, count(*) journals, count(*) FILTER (WHERE rn=1) siku_halisi,
       sum(ziada) ziada_journals, sum(ziada) FILTER (WHERE rn=1) ziada_siku_halisi,
       sum(least(ziada,h)) FILTER (WHERE rn=1) inaelezwa_na_makusanyo,
       sum(ziada - least(ziada,h)) FILTER (WHERE rn=1) baki
FROM x GROUP BY ROLLUP (aina) ORDER BY aina NULLS LAST;
