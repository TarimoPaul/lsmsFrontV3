-- 10 (Awamu 1b, kipengele 1): siku za ZIADA (variance < 0 = pesa iliyotangazwa > inayotarajiwa) zenye DAY_CLOSE_VARIANCE hai.
-- DB: lsms_audit_20261015_0200 (dump lsms_20261015_0200.dump, sha256 52e34fe4...d6d2). Kusoma tu.
-- Kwa kila snapshot: (a) sales za siku hiyo za mtumiaji huyo zilizoingizwa BAADA ya snapshot (hazikuwa kwenye expected),
-- (b) malipo ya madeni ya zamani (sale ya siku ya nyuma) yaliyopokelewa na mtumiaji huyo siku hiyo dhidi ya debt_collections_total ya snapshot,
-- (c) kinachobaki = ziada - (a) - (b), kisichopungua 0 kwa kila sehemu.
SET default_transaction_read_only = on;
WITH f AS (
  SELECT f.uid, f.snapshot_date d, f.user_uid, f.user_name, f.created_at snap_at, -f.variance_amount ziada,
         f.cash_sales, f.debt_collections_total, f.expected_cash, f.declared_cash, j.created_at je_at
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid)
    AND f.variance_amount < 0),
late AS (
  SELECT f.uid, count(s.uid) n, coalesce(sum(s.total_amount - coalesce(s.outstanding_balance,0)),0) kiasi,
         max(s.created_at - f.snap_at) kuchelewa_max
  FROM f LEFT JOIN sales s ON s.user_uid = f.user_uid AND s.sale_date::date = f.d AND s.created_at > f.snap_at AND NOT s.is_deleted
  GROUP BY f.uid),
debt AS (
  SELECT f.uid, count(p.uid) n, coalesce(sum(p.amount_paid),0) kiasi
  FROM f LEFT JOIN payments p ON p.received_by_uid = f.user_uid AND p.payment_date::date = f.d AND NOT p.is_deleted
       AND coalesce(p.is_reversal,false) = false AND p.amount_paid > 0
       AND EXISTS (SELECT 1 FROM sales s WHERE s.uid = p.sale_uid AND s.sale_date::date < f.d)
  GROUP BY f.uid),
x AS (
  SELECT f.d, f.user_name, f.ziada, f.expected_cash, f.declared_cash, f.je_at::date posted_on,
         late.n late_n, late.kiasi late_tzs, debt.n debt_n, debt.kiasi debt_tzs, f.debt_collections_total reco_debt,
         least(f.ziada, late.kiasi) a_sales,
         least(f.ziada - least(f.ziada, late.kiasi), greatest(debt.kiasi - f.debt_collections_total, 0)) b_madeni
  FROM f JOIN late USING (uid) JOIN debt USING (uid))
SELECT d, user_name, ziada, expected_cash, declared_cash, posted_on, late_n, late_tzs, debt_n, debt_tzs, reco_debt,
       a_sales, b_madeni, ziada - a_sales - b_madeni c_baki
FROM x ORDER BY d;
-- jumla
WITH f AS (
  SELECT f.uid, f.snapshot_date d, f.user_uid, f.created_at snap_at, -f.variance_amount ziada, f.debt_collections_total, j.created_at je_at
  FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
  WHERE j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid) AND f.variance_amount < 0),
late AS (SELECT f.uid, coalesce(sum(s.total_amount - coalesce(s.outstanding_balance,0)),0) kiasi FROM f LEFT JOIN sales s
         ON s.user_uid=f.user_uid AND s.sale_date::date=f.d AND s.created_at>f.snap_at AND NOT s.is_deleted GROUP BY f.uid),
debt AS (SELECT f.uid, coalesce(sum(p.amount_paid),0) kiasi FROM f LEFT JOIN payments p ON p.received_by_uid=f.user_uid
         AND p.payment_date::date=f.d AND NOT p.is_deleted AND coalesce(p.is_reversal,false)=false AND p.amount_paid>0
         AND EXISTS (SELECT 1 FROM sales s WHERE s.uid=p.sale_uid AND s.sale_date::date<f.d) GROUP BY f.uid),
x AS (SELECT f.ziada, f.je_at, least(f.ziada, late.kiasi) a,
             least(f.ziada - least(f.ziada, late.kiasi), greatest(debt.kiasi - f.debt_collections_total,0)) b
      FROM f JOIN late USING (uid) JOIN debt USING (uid))
SELECT count(*) siku, sum(ziada) ziada, sum(a) a_sales_zilizochelewa, sum(b) b_madeni, sum(ziada-a-b) c_baki,
       count(*) FILTER (WHERE je_at::date >= '2026-10-14') mpya_tangu_1410, sum(ziada) FILTER (WHERE je_at::date >= '2026-10-14') mpya_tzs
FROM x;
