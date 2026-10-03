-- =====================================================================================
-- LSMS V3 — debt figures of v3_ordering_findings.md (Q1) recomputed with the CORRECT balance
-- (READ-ONLY). Source: backups/prod_Lsms_20260930_1026_before_gl.dump (same dump as the report).
--
-- Change vs v3_queries.sql Q1: "still owed" = sales.outstanding_balance (= /api/reports/ar),
-- NOT SUM(payments.outstanding_balance) — a later debt payment adds its own PAID payment row
-- and leaves the first UNPAID row untouched, so that sum counted paid debts again (+345,500).
-- Also included: 2 credit sales from May 2026 (36,000) that predate reconciliation debt rows
-- (issued on their sale date at today's balance, like DailyPnlService).
-- Same ledger as DailyPnlCalculator. Window: 2026-07-02 .. 2026-09-29; aging as of 2026-09-30.
-- =====================================================================================
SET statement_timeout = '60s';
-- A session-local TEMP view only (no table is written); read-only mode starts right after it.
CREATE TEMP VIEW debt_events AS
WITH credit_sales AS (
  SELECT d.sale_uid, MIN(COALESCE(d.reference_type,'POS')) src, MAX(d.amount) issued,
         MIN(COALESCE(d.sale_date, s.sale_date::date)) issued_on, MAX(s.outstanding_balance) owed, false legacy,
         MAX(s.customer_id) customer_id
  FROM reconciliation_retail_debts d JOIN sales s ON s.uid = d.sale_uid
  WHERE NOT d.is_deleted AND NOT s.is_deleted GROUP BY d.sale_uid
  UNION ALL
  SELECT s.uid, 'POS', s.outstanding_balance, s.sale_date::date, s.outstanding_balance, true, s.customer_id
  FROM sales s WHERE NOT s.is_deleted AND s.outstanding_balance > 0
    AND NOT EXISTS (SELECT 1 FROM reconciliation_retail_debts d WHERE d.sale_uid = s.uid AND NOT d.is_deleted)),
pay AS (SELECT sale_uid, MAX(COALESCE(payment_date, updated_at))::date last_pay_date FROM payments
        WHERE is_active AND NOT is_deleted AND payment_status NOT IN ('CANCELLED','REFUNDED') GROUP BY 1),
adj AS (SELECT sale_uid, approved_at::date ev_date, amount FROM debt_adjustment WHERE status='APPROVED' AND NOT is_deleted),
adj_sum AS (SELECT sale_uid, SUM(amount) amt FROM adj GROUP BY 1),
cs AS (SELECT c.*, LEAST(GREATEST(COALESCE(c.owed,0),0), c.issued) still_owed, p.last_pay_date,
              GREATEST(c.issued - LEAST(GREATEST(COALESCE(c.owed,0),0), c.issued) - COALESCE(a.amt,0), 0) collected_total
       FROM credit_sales c LEFT JOIN pay p ON p.sale_uid = c.sale_uid
       LEFT JOIN adj_sum a ON a.sale_uid = c.sale_uid AND NOT c.legacy),
evidence AS (
  SELECT c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  FROM reconciliation_debt_collections c JOIN daily_reconciliation r ON r.uid = c.reconciliation_uid
  JOIN cs ON cs.sale_uid = c.sale_uid AND cs.src = 'POS' WHERE NOT c.is_deleted AND c.amount_collected > 0
  UNION ALL
  SELECT d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  FROM reconciliation_debt_payments dp JOIN reconciliation_retail_debts d ON d.uid = dp.debt_uid
  JOIN cs ON cs.sale_uid = d.sale_uid AND cs.src = 'MANUAL_RETAIL'
  WHERE NOT dp.is_deleted AND NOT d.is_deleted AND dp.amount_paid > 0),
ev_capped AS (
  SELECT e.sale_uid, e.ev_date,
         LEAST(e.amt, GREATEST(cs.collected_total - COALESCE(SUM(e.amt) OVER (PARTITION BY e.sale_uid ORDER BY e.ev_date, e.ord
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0), 0)) amt
  FROM evidence e JOIN cs ON cs.sale_uid = e.sale_uid),
ev_sum AS (SELECT sale_uid, SUM(amt) amt FROM ev_capped GROUP BY 1)
SELECT cs.sale_uid, cs.src, cs.customer_id, cs.issued_on, cs.still_owed, cs.issued, e.ev_date, e.kind, e.amt
FROM cs JOIN (
  SELECT sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt FROM cs
  UNION ALL SELECT sale_uid, ev_date, 'COLLECT', amt FROM ev_capped WHERE amt > 0
  UNION ALL SELECT cs.sale_uid, COALESCE(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - COALESCE(s.amt,0)
    FROM cs LEFT JOIN ev_sum s ON s.sale_uid = cs.sale_uid WHERE cs.collected_total - COALESCE(s.amt,0) > 0
  UNION ALL SELECT a.sale_uid, a.ev_date, 'ADJUST', a.amount FROM adj a JOIN cs ON cs.sale_uid = a.sale_uid AND NOT cs.legacy
) e ON e.sale_uid = cs.sale_uid;

SET default_transaction_read_only = on;

-- R1. 90-day flows (1a): issued / collected / adjusted / net, by origin
SELECT CASE WHEN src = 'MANUAL_RETAIL' THEN 'walk-in' ELSE 'POS' END origin,
       SUM(amt) FILTER (WHERE kind = 'ISSUE') issued,
       SUM(amt) FILTER (WHERE kind = 'COLLECT') collected,
       COALESCE(SUM(amt) FILTER (WHERE kind = 'ADJUST'), 0) adjusted,
       SUM(CASE WHEN kind = 'ISSUE' THEN amt ELSE -amt END) net_change
FROM debt_events WHERE ev_date BETWEEN '2026-07-02' AND '2026-09-29'
GROUP BY ROLLUP(1) ORDER BY 1;

-- R2. Month-end balances (1c), total / POS / walk-in
SELECT m::date month_end,
       SUM(CASE WHEN kind = 'ISSUE' THEN amt ELSE -amt END) total,
       SUM(CASE WHEN kind = 'ISSUE' THEN amt ELSE -amt END) FILTER (WHERE src <> 'MANUAL_RETAIL') pos,
       SUM(CASE WHEN kind = 'ISSUE' THEN amt ELSE -amt END) FILTER (WHERE src = 'MANUAL_RETAIL') walk_in
FROM unnest(array['2026-06-30','2026-07-01','2026-07-31','2026-08-31','2026-09-29','2026-09-30']::date[]) m
JOIN debt_events ON ev_date <= m GROUP BY 1 ORDER BY 1;

-- R3. Aging of open debts as of 2026-09-30 (1d): 0–7 / 8–30 / 31–60 / 60+ days since issued
WITH open_debts AS (SELECT DISTINCT sale_uid, src, issued_on, still_owed FROM debt_events WHERE still_owed > 0)
SELECT CASE WHEN age <= 7 THEN '0–7' WHEN age <= 30 THEN '8–30' WHEN age <= 60 THEN '31–60' ELSE '60+' END bucket,
       COUNT(*) debts, SUM(still_owed) amount,
       COUNT(*) FILTER (WHERE src <> 'MANUAL_RETAIL') pos_debts, COALESCE(SUM(still_owed) FILTER (WHERE src <> 'MANUAL_RETAIL'), 0) pos_amount,
       ROUND(100.0 * SUM(still_owed) / (SELECT SUM(still_owed) FROM open_debts), 1) pct
FROM (SELECT *, DATE '2026-09-30' - issued_on age FROM open_debts) x
GROUP BY ROLLUP(1) ORDER BY MIN(age);

-- R4. Walk-in share of what is owed now, and the share of walk-in value ever collected
WITH s AS (SELECT DISTINCT sale_uid, src, issued, still_owed FROM debt_events)
SELECT SUM(still_owed) owed_now, SUM(still_owed) FILTER (WHERE src = 'MANUAL_RETAIL') walk_in_owed,
       ROUND(100.0 * SUM(still_owed) FILTER (WHERE src = 'MANUAL_RETAIL') / SUM(still_owed), 1) walk_in_share_pct,
       ROUND(100.0 * (SUM(issued - still_owed) FILTER (WHERE src = 'MANUAL_RETAIL')) / SUM(issued) FILTER (WHERE src = 'MANUAL_RETAIL'), 1) walk_in_value_cleared_pct,
       (SELECT SUM(outstanding_balance) FROM v_accounts_receivable) ar_report
FROM s;

-- R5. Top 10 debtors now (1e) — customer id only
WITH s AS (SELECT DISTINCT sale_uid, src, customer_id, issued_on, still_owed FROM debt_events WHERE still_owed > 0)
SELECT COALESCE(customer_id, '(hakuna)') customer_id, COUNT(*) open_debts, SUM(still_owed) owed,
       DATE '2026-09-30' - MIN(issued_on) oldest_days,
       STRING_AGG(DISTINCT CASE WHEN src = 'MANUAL_RETAIL' THEN 'walk-in' ELSE 'POS' END, ' + ') kinds
FROM s GROUP BY 1 ORDER BY owed DESC LIMIT 10;
