-- 21: Kwa nini 1000 baada ya marekebisho = +620,450 na si makadirio +606,550 (MPANGO-PAMOJA §1.2).
-- DB: lsms_audit_20261015_0200 (kusoma tu). Kanuni: variance = expected − declared, chanya = UPUNGUFU.
SET default_transaction_read_only = on;

-- (a) Journals 9 za H-5: snapshot ya zamani (is_current = false) yenye DAY_CLOSE_VARIANCE hai.
WITH live AS (
  SELECT j.uid, j.entry_number, j.reference_uid
  FROM journal_entry j
  WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT j.is_deleted
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT r.is_deleted))
SELECT f.snapshot_date, f.snapshot_version, f.variance_amount,
       CASE WHEN f.variance_amount > 0 THEN 'UPUNGUFU' ELSE 'ZIADA/K1' END AS aina_kwa_kanuni_mpya,
       l.entry_number,
       (SELECT sum(x.debit_amount - x.credit_amount) FROM journal_entry_line x
         WHERE x.journal_entry_uid = l.uid AND x.account_code = '1000') AS cash_sasa,
       -- makadirio ya §1.2 yalidhani nakala inapostiwa upya kwa kanuni mpya:
       CASE WHEN f.variance_amount > 0 THEN -f.variance_amount ELSE 0 END AS cash_kwenye_makadirio,
       -- code: nakala inageuzwa tu, haipostiwi upya:
       0::numeric AS cash_kwenye_code
FROM live l JOIN daily_financial_snapshot f ON f.uid = l.reference_uid
WHERE NOT f.is_current
ORDER BY f.snapshot_date;

-- (b) Jumla: makadirio dhidi ya code.
WITH live AS (
  SELECT j.reference_uid
  FROM journal_entry j
  WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT j.is_deleted
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT r.is_deleted)),
s AS (SELECT f.* FROM live l JOIN daily_financial_snapshot f ON f.uid = l.reference_uid)
SELECT
  sum(variance_amount) FILTER (WHERE variance_amount > 0)                     AS upungufu_wote_65,
  sum(variance_amount) FILTER (WHERE variance_amount > 0 AND is_current)      AS upungufu_hai_58,
  sum(variance_amount) FILTER (WHERE variance_amount > 0 AND NOT is_current)  AS upungufu_nakala_7,
  sum(least(-variance_amount, declared_cash)) FILTER (WHERE variance_amount < 0 AND declared_cash > 0 AND is_current) AS ziada_k2_baada_ya_guard,
  sum(least(-variance_amount, declared_cash)) FILTER (WHERE variance_amount < 0 AND declared_cash > 0 AND is_current)
    - sum(variance_amount) FILTER (WHERE variance_amount > 0)                 AS makadirio_1000,
  sum(least(-variance_amount, declared_cash)) FILTER (WHERE variance_amount < 0 AND declared_cash > 0 AND is_current)
    - sum(variance_amount) FILTER (WHERE variance_amount > 0 AND is_current)  AS code_1000
FROM s;
