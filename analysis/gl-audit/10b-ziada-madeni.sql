-- 10b (Awamu 1b, kipengele 1): je, ziada ya siku 22 inatokana na MADENI ya siku nyingine kutolewa kwenye mauzo ya leo?
-- DB: lsms_audit_20261015_0200. Kusoma tu.
-- Kwa kila snapshot ya ziada: madeni kwenye reco hiyo (reconciliation_retail_debts) kwa tarehe ya sale yake:
--   leo = sale_date ya deni = siku ya reco; nyuma = sale_date < siku ya reco; bila_tarehe = sale_date NULL.
SET default_transaction_read_only = on;
WITH f AS (
  SELECT f.uid, f.reconciliation_uid, f.snapshot_date d, f.snapshot_version v, -f.variance_amount ziada,
         f.total_sales, f.retail_debts_total snap_rdebt
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
rd AS (
  SELECT f.uid,
         coalesce(sum(d.amount) FILTER (WHERE coalesce(d.sale_date, s.sale_date::date) = f.d),0) leo,
         coalesce(sum(d.amount) FILTER (WHERE coalesce(d.sale_date, s.sale_date::date) < f.d),0) nyuma,
         coalesce(sum(d.amount) FILTER (WHERE coalesce(d.sale_date, s.sale_date::date) > f.d),0) mbele,
         coalesce(sum(d.amount) FILTER (WHERE coalesce(d.sale_date, s.sale_date::date) IS NULL),0) bila_tarehe,
         count(d.id) n
  FROM f LEFT JOIN reconciliation_retail_debts d ON d.reconciliation_uid = f.reconciliation_uid AND NOT d.is_deleted
         LEFT JOIN sales s ON s.uid = d.sale_uid
  GROUP BY f.uid),
r AS (SELECT uid, pos_debts_total, manual_debts_total, retail_debts_total, status FROM daily_reconciliation)
SELECT f.d, f.v, f.ziada, f.total_sales, f.snap_rdebt, r.pos_debts_total pos, r.manual_debts_total manual,
       rd.n, rd.leo, rd.nyuma, rd.mbele, rd.bila_tarehe,
       least(f.ziada, rd.nyuma + rd.mbele) inaelezwa_na_madeni_ya_siku_nyingine,
       f.ziada - least(f.ziada, rd.nyuma + rd.mbele) baki
FROM f JOIN rd USING (uid) LEFT JOIN r ON r.uid = f.reconciliation_uid ORDER BY f.d, f.v;
