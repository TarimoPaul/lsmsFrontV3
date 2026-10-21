-- 19 (Toleo 1): utabiri wa POST /api/v1/gl/corrections/day-close-variance?dryRun=true kwa SQL.
-- DB: lsms_audit_20261015_0200 (dump lsms_20261015_0200.dump). KUSOMA TU.
-- Inafuata DayCloseVarianceService.correct + PostingEngine.classifyDayCloseVariance:
--   variance > 0 -> SHORTAGE, 1000 baada = -variance
--   variance < 0, declared > 0 -> SURPLUS, 1000 baada = +min(|variance|, declared)
--   variance < 0, declared = 0 -> OVER_DEDUCTION, 1000 baada = 0 (reverse tu)
--   snapshot si current -> SUPERSEDED, 1000 baada = 0 (reverse tu)
--   snapshot current bila journal hai, kuna cha kupost -> POST_MISSING
SET default_transaction_read_only = on;

-- 1) kwa kundi
WITH live AS (
  SELECT j.uid, j.entry_number, j.entry_date, j.reference_uid,
         (SELECT coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
           WHERE l.journal_entry_uid = j.uid AND l.account_code = '1000') cash_kabla
  FROM journal_entry j
  WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))),
k AS (
  SELECT f.uid, f.snapshot_date, f.user_name, f.is_current, f.snapshot_version, f.variance_amount v, f.declared_cash d,
         CASE WHEN NOT f.is_current THEN 'SUPERSEDED'
              WHEN f.variance_amount = 0 THEN 'ZERO'
              WHEN f.variance_amount > 0 THEN 'SHORTAGE'
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 'OVER_DEDUCTION'
              ELSE 'SURPLUS' END kundi,
         CASE WHEN NOT f.is_current OR f.variance_amount = 0 THEN 0
              WHEN f.variance_amount > 0 THEN -f.variance_amount
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
              ELSE least(-f.variance_amount, f.declared_cash) END cash_baada,
         CASE WHEN f.variance_amount < 0 AND f.is_current
              THEN -f.variance_amount - CASE WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
                                             ELSE least(-f.variance_amount, f.declared_cash) END
              ELSE 0 END makato_yaliyozidi
  FROM daily_financial_snapshot f),
x AS (
SELECT k.snapshot_date, k.user_name, k.snapshot_version, k.is_current, k.v variance, k.d declared, k.kundi,
       live.entry_number, coalesce(live.cash_kabla, 0) cash_kabla, k.cash_baada, k.makato_yaliyozidi,
       CASE WHEN live.uid IS NULL THEN 'POST_MISSING'
            WHEN coalesce(live.cash_kabla, 0) = k.cash_baada THEN 'ALREADY_CORRECT'
            WHEN k.cash_baada = 0 THEN 'REVERSE_ONLY'
            ELSE 'REVERSE_AND_REPOST' END hatua
FROM k LEFT JOIN live ON live.reference_uid = k.uid
WHERE live.uid IS NOT NULL OR (k.is_current AND k.cash_baada <> 0))
SELECT kundi, hatua, count(*) idadi, sum(abs(variance)) variance_tzs, sum(cash_kabla) cash_kabla,
       sum(cash_baada) cash_baada, sum(cash_baada - cash_kabla) mabadiliko_1000, sum(makato_yaliyozidi) makato_yaliyozidi
FROM x GROUP BY kundi, hatua ORDER BY kundi, hatua;

-- 2) jumla
WITH live AS (
  SELECT j.uid, j.entry_number, j.entry_date, j.reference_uid,
         (SELECT coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
           WHERE l.journal_entry_uid = j.uid AND l.account_code = '1000') cash_kabla
  FROM journal_entry j
  WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))),
k AS (
  SELECT f.uid, f.snapshot_date, f.user_name, f.is_current, f.snapshot_version, f.variance_amount v, f.declared_cash d,
         CASE WHEN NOT f.is_current THEN 'SUPERSEDED'
              WHEN f.variance_amount = 0 THEN 'ZERO'
              WHEN f.variance_amount > 0 THEN 'SHORTAGE'
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 'OVER_DEDUCTION'
              ELSE 'SURPLUS' END kundi,
         CASE WHEN NOT f.is_current OR f.variance_amount = 0 THEN 0
              WHEN f.variance_amount > 0 THEN -f.variance_amount
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
              ELSE least(-f.variance_amount, f.declared_cash) END cash_baada,
         CASE WHEN f.variance_amount < 0 AND f.is_current
              THEN -f.variance_amount - CASE WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
                                             ELSE least(-f.variance_amount, f.declared_cash) END
              ELSE 0 END makato_yaliyozidi
  FROM daily_financial_snapshot f),
x AS (
SELECT k.snapshot_date, k.user_name, k.snapshot_version, k.is_current, k.v variance, k.d declared, k.kundi,
       live.entry_number, coalesce(live.cash_kabla, 0) cash_kabla, k.cash_baada, k.makato_yaliyozidi,
       CASE WHEN live.uid IS NULL THEN 'POST_MISSING'
            WHEN coalesce(live.cash_kabla, 0) = k.cash_baada THEN 'ALREADY_CORRECT'
            WHEN k.cash_baada = 0 THEN 'REVERSE_ONLY'
            ELSE 'REVERSE_AND_REPOST' END hatua
FROM k LEFT JOIN live ON live.reference_uid = k.uid
WHERE live.uid IS NOT NULL OR (k.is_current AND k.cash_baada <> 0))
SELECT count(*) mistari, count(*) FILTER (WHERE hatua <> 'ALREADY_CORRECT') zitabadilika,
       sum(cash_kabla) cash_kabla, sum(cash_baada) cash_baada, sum(cash_baada - cash_kabla) mabadiliko_1000,
       (SELECT coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l JOIN journal_entry j ON j.uid = l.journal_entry_uid
         WHERE l.account_code = '1000' AND NOT coalesce(j.is_deleted, false)) gl_1000_sasa
FROM x;

-- 3) siku kubwa (|variance| >= 10,000) na K2 iliyokatwa na guard
WITH live AS (
  SELECT j.uid, j.entry_number, j.entry_date, j.reference_uid,
         (SELECT coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
           WHERE l.journal_entry_uid = j.uid AND l.account_code = '1000') cash_kabla
  FROM journal_entry j
  WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))),
k AS (
  SELECT f.uid, f.snapshot_date, f.user_name, f.is_current, f.snapshot_version, f.variance_amount v, f.declared_cash d,
         CASE WHEN NOT f.is_current THEN 'SUPERSEDED'
              WHEN f.variance_amount = 0 THEN 'ZERO'
              WHEN f.variance_amount > 0 THEN 'SHORTAGE'
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 'OVER_DEDUCTION'
              ELSE 'SURPLUS' END kundi,
         CASE WHEN NOT f.is_current OR f.variance_amount = 0 THEN 0
              WHEN f.variance_amount > 0 THEN -f.variance_amount
              WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
              ELSE least(-f.variance_amount, f.declared_cash) END cash_baada,
         CASE WHEN f.variance_amount < 0 AND f.is_current
              THEN -f.variance_amount - CASE WHEN coalesce(f.declared_cash, 0) <= 0 THEN 0
                                             ELSE least(-f.variance_amount, f.declared_cash) END
              ELSE 0 END makato_yaliyozidi
  FROM daily_financial_snapshot f),
x AS (
SELECT k.snapshot_date, k.user_name, k.snapshot_version, k.is_current, k.v variance, k.d declared, k.kundi,
       live.entry_number, coalesce(live.cash_kabla, 0) cash_kabla, k.cash_baada, k.makato_yaliyozidi,
       CASE WHEN live.uid IS NULL THEN 'POST_MISSING'
            WHEN coalesce(live.cash_kabla, 0) = k.cash_baada THEN 'ALREADY_CORRECT'
            WHEN k.cash_baada = 0 THEN 'REVERSE_ONLY'
            ELSE 'REVERSE_AND_REPOST' END hatua
FROM k LEFT JOIN live ON live.reference_uid = k.uid
WHERE live.uid IS NOT NULL OR (k.is_current AND k.cash_baada <> 0))
SELECT snapshot_date, user_name, snapshot_version, variance, declared, kundi, hatua, cash_kabla, cash_baada, makato_yaliyozidi
FROM x WHERE abs(variance) >= 10000 OR makato_yaliyozidi > 0 ORDER BY snapshot_date;

