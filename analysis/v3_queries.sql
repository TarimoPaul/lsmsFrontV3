-- =====================================================================================
-- LSMS V3 — auto-ordering data analysis (READ-ONLY)
-- Source used for the report: prod pg_dump 2026-09-30 10:26 (prod_Lsms_20260930_1026_before_gl.dump)
-- restored into a throw-away local container (postgres:17), NOT production.
--
-- Analysis windows (change these literals to re-run for another period):
--   last 90 days   : 2026-07-02 .. 2026-09-29  (2026-09-30 is a partial day in the dump)
--   full history   : 2026-02-01 .. 2026-09-29
--
-- Conventions / data-quirk handling used everywhere:
--   * "Sales / demand" = sales.sale_source = 'STANDARD' AND NOT sales.is_deleted
--     (RECONCILIATION_MANUAL rows = MANUAL_RETAIL walk-in debts -> excluded from sales/P&L;
--      their goods already left through a normal POS sale).
--   * Voided sales = is_deleted (soft delete, stock reversed via SALE_REVERSAL). Excluded.
--   * Returns: approved sales_returns are subtracted (the only one: 2026-05-21, 31,000 / 20 pcs;
--     its sale total was NOT reduced, so it must be subtracted).
--   * Refund Payment rows: payments with payment_status='REFUNDED' or is_active=false or
--     total_amount<0 are ignored (fix commit 58b761e, 2026-08-10; prod has exactly 1 such row,
--     2026-05-21, already is_active=false).
--   * Units = sales_details.piece_quantity (always pieces; crates = pieces / pieces_per_package).
--   * Purchases valued as cost_per_piece x pieces (purchases.total_amount is NULL/understated
--     for Feb-Jun 2026 in this dump; Jul-Sep they agree).
-- Every query is plain SELECT. Read-only mode also forbids temp views, so shared logic is
-- repeated as a CTE block in each query.
-- =====================================================================================
SET default_transaction_read_only = on;
SET statement_timeout = '30s';

-- -------------------------------------------------------------------------------------
-- Q0. Coverage checks
-- -------------------------------------------------------------------------------------
-- Q0.1 sales by source/status (what is excluded)
select sale_source, payment_status, is_deleted, count(*), sum(total_amount)
from sales group by 1,2,3 order by 1,2,3;

-- Q0.2 sales history per month + days with no sales (gaps)
with d as (select sale_date::date dt, count(*) n, sum(total_amount) amt from sales
           where not is_deleted and sale_source='STANDARD' group by 1)
select to_char(g,'YYYY-MM') m, count(d.dt) days_with_sales, count(*) days, sum(d.n) sales, sum(d.amt) amount
from generate_series('2026-02-01'::date,'2026-09-29','1 day') g left join d on d.dt=g::date group by 1 order by 1;

-- Q0.3 refund rows (quirk check)
select uid, created_at, sale_uid, amount_paid, total_amount, payment_status, is_active
from payments where payment_status='REFUNDED' or total_amount<0;

-- Q0.4 where credit lives: retail debts by source and month
select to_char(coalesce(d.sale_date, r.reconciliation_date),'YYYY-MM') m, coalesce(d.reference_type,'POS') src,
       count(*), sum(d.amount)
from reconciliation_retail_debts d join daily_reconciliation r on r.uid=d.reconciliation_uid
where not d.is_deleted group by 1,2 order by 1,2;

-- Q0.5 AR at snapshot: payment rows vs sales header (they disagree for walk-in debts)
select s.sale_source, sum(p.outstanding_balance) payments_outstanding, sum(s.outstanding_balance) sales_header_outstanding
from payments p join sales s on s.uid=p.sale_uid
where p.is_active and not p.is_deleted and p.payment_status not in ('CANCELLED','REFUNDED') and not s.is_deleted
group by 1;

-- -------------------------------------------------------------------------------------
-- Q1. CREDIT / CAPITAL DRAIN
-- -------------------------------------------------------------------------------------

-- Q1.1 daily credit issued vs collected, last 90 days (avg / median / total)
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, days as (select d::date dt from generate_series('2026-07-02'::date,'2026-09-29','1 day') d),
daily as (select dt,
  coalesce(sum(e.amt) filter (where e.kind='ISSUE'),0) issued,
  coalesce(sum(e.amt) filter (where e.kind='ISSUE' and cs.src='POS'),0) issued_pos,
  coalesce(sum(e.amt) filter (where e.kind='ISSUE' and cs.src<>'POS'),0) issued_walkin,
  coalesce(sum(e.amt) filter (where e.kind='COLLECT'),0) collected,
  coalesce(sum(e.amt) filter (where e.kind='ADJUST'),0) adjusted
  from days left join debt_events e on e.ev_date=days.dt left join cs on cs.sale_uid=e.sale_uid group by dt)
select 'avg' stat, round(avg(issued)) issued, round(avg(issued_pos)) pos, round(avg(issued_walkin)) walkin, round(avg(collected)) collected, round(avg(issued-collected-adjusted)) net from daily
union all select 'median', percentile_cont(.5) within group (order by issued), percentile_cont(.5) within group (order by issued_pos), percentile_cont(.5) within group (order by issued_walkin), percentile_cont(.5) within group (order by collected), percentile_cont(.5) within group (order by issued-collected-adjusted) from daily
union all select 'total', sum(issued), sum(issued_pos), sum(issued_walkin), sum(collected), sum(issued-collected-adjusted) from daily
union all select 'days_with_activity', count(*) filter (where issued>0), count(*) filter (where issued_pos>0), count(*) filter (where issued_walkin>0), count(*) filter (where collected>0), null from daily;

-- Q1.2 weekly totals, last 90 days
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, days as (select d::date dt from generate_series('2026-07-02'::date,'2026-09-29','1 day') d),
daily as (select dt, coalesce(sum(e.amt) filter (where e.kind='ISSUE'),0) issued, coalesce(sum(e.amt) filter (where e.kind='ISSUE' and cs.src='POS'),0) pos,
  coalesce(sum(e.amt) filter (where e.kind='COLLECT'),0) collected, coalesce(sum(e.amt) filter (where e.kind='ADJUST'),0) adjusted
  from days left join debt_events e on e.ev_date=days.dt left join cs on cs.sale_uid=e.sale_uid group by dt)
select date_trunc('week',dt)::date week_mon, min(dt) from_d, max(dt) to_d, sum(issued) issued, sum(pos) pos, sum(issued)-sum(pos) walkin,
       sum(collected) collected, sum(adjusted) adj, sum(issued-collected-adjusted) net
from daily group by 1 order by 1;

-- Q1.3 receivables outstanding at each month end (last 12 months)
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, me as (select (date_trunc('month',d)+interval '1 month - 1 day')::date month_end from generate_series('2025-10-01'::date,'2026-09-01','1 month') d)
select me.month_end, coalesce(sum(case e.kind when 'ISSUE' then e.amt else -e.amt end),0) receivables,
 coalesce(sum(case e.kind when 'ISSUE' then e.amt else -e.amt end) filter (where cs.src='POS'),0) pos,
 coalesce(sum(case e.kind when 'ISSUE' then e.amt else -e.amt end) filter (where cs.src<>'POS'),0) walkin
from me left join debt_events e on e.ev_date<=me.month_end left join cs on cs.sale_uid=e.sale_uid group by 1 order by 1;

-- Q1.4 aging of open debts at 2026-09-30
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, bal as (select sale_uid, sum(case kind when 'ISSUE' then amt else -amt end) bal from debt_events group by 1)
select case when '2026-09-30'::date-cs.issued_on<=7 then '0-7' when '2026-09-30'::date-cs.issued_on<=30 then '8-30'
            when '2026-09-30'::date-cs.issued_on<=60 then '31-60' else '60+' end bucket,
 count(*), sum(bal), count(*) filter (where src='POS') pos_cnt, sum(bal) filter (where src='POS') pos_amt
from bal join cs using(sale_uid) where bal>0 group by 1 order by min('2026-09-30'::date-cs.issued_on);

-- Q1.5 top 10 debtors (customer id only, no names/phones)
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, bal as (select sale_uid, sum(case kind when 'ISSUE' then amt else -amt end) bal from debt_events group by 1)
select coalesce(cs.customer_id,'(no customer_id)') customer_id, count(*) open_debts, sum(bal) outstanding,
       max('2026-09-30'::date-cs.issued_on) oldest_days, string_agg(distinct cs.src, ',') src
from bal join cs using(sale_uid) where bal>0 group by cs.customer_id order by 3 desc limit 10;

-- Q1.6 days from credit sale to full payment (fully-paid debts only)
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, s as (select sale_uid, sum(case kind when 'ISSUE' then amt else -amt end) bal, max(ev_date) filter (where kind<>'ISSUE') last_pay from debt_events group by 1),
paid as (select cs.src, cs.issued, greatest(s.last_pay - cs.issued_on,0) days from s join cs using(sale_uid) where s.bal<=0 and s.last_pay is not null)
select src, count(*), round(avg(days),1) avg_days, percentile_cont(.5) within group (order by days) median_days,
       round(sum(days*issued)/sum(issued),1) amount_weighted_days, percentile_cont(.9) within group (order by days) p90
from paid group by rollup(src);

-- -------------------------------------------------------------------------------------
-- Q2. CREDIT CONTROL
-- -------------------------------------------------------------------------------------
-- Q2.1 credit issued per user (last 90 days)
-- ===== Debt ledger CTEs (one "credit sale" = a sale that has a reconciliation_retail_debts row) =====
-- issued  : reconciliation_retail_debts.amount on its sale_date (POS credit and MANUAL_RETAIL walk-in debts)
-- final   : still-owed = payments.outstanding_balance (the AR truth; = GL 1100)
-- adjust  : approved debt_adjustment rows (CORRECTION) on approved_at
-- collect : total collected = issued - still_owed - adjusted, dated by the best evidence:
--           POS  -> reconciliation_debt_collections (dated by the recon day the cash was declared)
--           walk-in -> reconciliation_debt_payments.paid_at
--           any remainder -> payments.payment_date (last payment date on the sale's payment row)
with credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, sum(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on, max(s.customer_id) customer_id, max(s.user_uid) user_uid
  from reconciliation_retail_debts d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted group by d.sale_uid),
pay as (select sale_uid, sum(outstanding_balance) still_owed, max(coalesce(payment_date,updated_at))::date last_pay_date
        from payments where is_active and not is_deleted and payment_status not in ('CANCELLED','REFUNDED') group by 1),
adj as (select sale_uid, approved_at::date ev_date, amount from debt_adjustment where status='APPROVED' and not is_deleted),
cs as (select c.*, least(coalesce(p.still_owed,0), c.issued) still_owed, p.last_pay_date,
              greatest(c.issued - least(coalesce(p.still_owed,0),c.issued) - coalesce((select sum(amount) from adj where adj.sale_uid=c.sale_uid),0),0) collected_total
       from credit_sales c left join pay p on p.sale_uid=c.sale_uid),
evidence as (
  select c.sale_uid, r.reconciliation_date ev_date, c.amount_collected amt, c.id ord
  from reconciliation_debt_collections c join daily_reconciliation r on r.uid=c.reconciliation_uid
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS'
  where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL'
  where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all  -- remainder with no dated evidence
  select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid))
, bal as (select sale_uid, sum(case kind when 'ISSUE' then amt else -amt end) bal from debt_events group by 1)
select coalesce(u.first_name||' '||u.last_name, cs.user_uid) user_name,
 count(*) filter (where cs.src='POS') pos_n, sum(cs.issued) filter (where cs.src='POS') pos_amt,
 count(*) filter (where cs.src<>'POS') walkin_n, sum(cs.issued) filter (where cs.src<>'POS') walkin_amt,
 sum(cs.issued) total, sum(greatest(bal,0)) still_open
from cs join bal using(sale_uid) left join users u on u.uid=cs.user_uid
where cs.issued_on between '2026-07-02' and '2026-09-29' group by 1 order by total desc;

-- Q2.2 who records sales at all (shared login check)
select coalesce(u.first_name||' '||u.last_name, s.user_uid) usr, s.sale_source, count(*), sum(total_amount)
from sales s left join users u on u.uid=s.user_uid
where not s.is_deleted and s.sale_date::date between '2026-07-02' and '2026-09-29' group by 1,2 order by 4 desc;

-- Q2.3 credit-limit fields in the data
select count(*) customers, count(credit_limit) with_limit_value, count(*) filter (where credit_limit>0) limit_gt0
from customers where not is_deleted;
select default_credit_limit, default_credit_term_days from business_settings;

-- -------------------------------------------------------------------------------------
-- Q3. DAY-OF-MONTH PATTERN  (f_month = day sales / that month's average day; removes growth trend)
-- -------------------------------------------------------------------------------------
-- Q3.1 factor per day of month, overall and per month
-- daily net sales (STANDARD POS sales only; MANUAL walk-in debts excluded; deleted sales excluded; approved returns subtracted)
with ret as (select original_sale_uid sale_uid, sum(coalesce(refund_amount,0)) r from sales_returns where return_status in ('APPROVED','PROCESSED','COMPLETED') group by 1),
daily as (
  select g::date dt, coalesce(sum(s.total_amount - coalesce(ret.r,0)),0) amt
  from generate_series('2026-02-01'::date,'2026-09-29','1 day') g
  left join sales s on s.sale_date::date=g::date and not s.is_deleted and s.sale_source='STANDARD'
  left join ret on ret.sale_uid=s.uid
  group by 1),
dm as (select dt, amt, date_trunc('month',dt)::date mon, extract(day from dt)::int dom, extract(isodow from dt)::int dow,
              amt / nullif(avg(amt) over (partition by date_trunc('month',dt)),0) f_month from daily)
select dom, round(avg(amt)) avg_sales, round(avg(amt)/(select avg(amt) from dm),2) f_overall, round(avg(f_month),2) f_mnorm,
 round(avg(f_month) filter (where mon='2026-02-01'),2) feb, round(avg(f_month) filter (where mon='2026-03-01'),2) mar,
 round(avg(f_month) filter (where mon='2026-04-01'),2) apr, round(avg(f_month) filter (where mon='2026-05-01'),2) may,
 round(avg(f_month) filter (where mon='2026-06-01'),2) jun, round(avg(f_month) filter (where mon='2026-07-01'),2) jul,
 round(avg(f_month) filter (where mon='2026-08-01'),2) aug, round(avg(f_month) filter (where mon='2026-09-01'),2) sep
from dm group by dom order by dom;

-- Q3.2 window factors per month (20->1 vs 2->19; and 24-29 / 30-3 / 4-23)
-- daily net sales (STANDARD POS sales only; MANUAL walk-in debts excluded; deleted sales excluded; approved returns subtracted)
with ret as (select original_sale_uid sale_uid, sum(coalesce(refund_amount,0)) r from sales_returns where return_status in ('APPROVED','PROCESSED','COMPLETED') group by 1),
daily as (
  select g::date dt, coalesce(sum(s.total_amount - coalesce(ret.r,0)),0) amt
  from generate_series('2026-02-01'::date,'2026-09-29','1 day') g
  left join sales s on s.sale_date::date=g::date and not s.is_deleted and s.sale_source='STANDARD'
  left join ret on ret.sale_uid=s.uid
  group by 1),
dm as (select dt, amt, date_trunc('month',dt)::date mon, extract(day from dt)::int dom, extract(isodow from dt)::int dow,
              amt / nullif(avg(amt) over (partition by date_trunc('month',dt)),0) f_month from daily)
, w as (select *, case when dom>=20 or dom=1 then '20-1' else 'rest' end win_a,
   case when dom between 24 and 29 then '24-29' when dom>=30 or dom<=3 then '30-3' else '4-23' end win_b from dm)
select to_char(mon,'YYYY-MM') m, round(avg(f_month) filter (where win_a='20-1'),2) f_20_1, round(avg(f_month) filter (where win_a='rest'),2) f_2_19,
 round(avg(f_month) filter (where win_b='24-29'),2) f_24_29, round(avg(f_month) filter (where win_b='30-3'),2) f_30_3,
 round(avg(f_month) filter (where win_b='4-23'),2) f_4_23, round(stddev(amt)/avg(amt),2) cv_daily
from w group by rollup(mon) order by mon;

-- -------------------------------------------------------------------------------------
-- Q4. DAY-OF-WEEK PATTERN (inside vs outside the 20->1 window)
-- -------------------------------------------------------------------------------------
-- daily net sales (STANDARD POS sales only; MANUAL walk-in debts excluded; deleted sales excluded; approved returns subtracted)
with ret as (select original_sale_uid sale_uid, sum(coalesce(refund_amount,0)) r from sales_returns where return_status in ('APPROVED','PROCESSED','COMPLETED') group by 1),
daily as (
  select g::date dt, coalesce(sum(s.total_amount - coalesce(ret.r,0)),0) amt
  from generate_series('2026-02-01'::date,'2026-09-29','1 day') g
  left join sales s on s.sale_date::date=g::date and not s.is_deleted and s.sale_source='STANDARD'
  left join ret on ret.sale_uid=s.uid
  group by 1),
dm as (select dt, amt, date_trunc('month',dt)::date mon, extract(day from dt)::int dom, extract(isodow from dt)::int dow,
              amt / nullif(avg(amt) over (partition by date_trunc('month',dt)),0) f_month from daily)
, w as (select *, (dom>=20 or dom=1) in_win from dm)
select dow, to_char(min(dt),'Dy') d, count(*) n_days, round(avg(amt)) avg_sales, round(avg(f_month),2) f_mnorm,
 round(avg(f_month) filter (where in_win),2) f_in_20_1, round(avg(f_month) filter (where not in_win),2) f_outside,
 round(avg(f_month) filter (where mon='2026-06-01'),2) jun, round(avg(f_month) filter (where mon='2026-07-01'),2) jul,
 round(avg(f_month) filter (where mon='2026-08-01'),2) aug, round(avg(f_month) filter (where mon='2026-09-01'),2) sep
from w group by dow order by dow;

-- -------------------------------------------------------------------------------------
-- Q5. PRODUCT DEMAND — top 20 by pieces sold, last 90 days
-- Stockout method: store.stock_after is the running balance the backend writes on every movement
-- (backend blocks negative stock). stockout_days = days when (a) any movement that day left stock
-- at 0, or (b) the carried-forward end-of-day stock is 0, or (c) a counting line counted 0.
-- eod_zero_days = only (b): the stricter "closed the day with nothing" measure.
-- NOTE: correlated sub-select on store; fine on the snapshot (14.6k rows); don't run on prod in business hours.
-- -------------------------------------------------------------------------------------
with win as (select '2026-07-02'::date d0, '2026-09-29'::date d1),
units as (  -- net pieces sold per product per day (STANDARD, live sales; returns subtracted)
  select d.product_uid, s.sale_date::date dt, sum(d.piece_quantity) pcs
  from sales_details d join sales s on s.uid=d.sale_uid, win
  where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between win.d0 and win.d1
  group by 1,2
  union all
  select ri.product_uid, r.return_date::date, -sum(ri.return_quantity_pieces)
  from sales_return_items ri join sales_returns r on r.uid=ri.sales_return_uid, win
  where r.return_status in ('APPROVED','PROCESSED','COMPLETED') and r.return_date::date between win.d0 and win.d1 group by 1,2),
top20 as (select product_uid, sum(pcs) pcs from units group by 1 order by 2 desc limit 20),
grid as (select t.product_uid, g::date dt from top20 t, win, generate_series(win.d0, win.d1, '1 day') g),
series as (select g.product_uid, g.dt, coalesce(sum(u.pcs),0) pcs from grid g left join units u on u.product_uid=g.product_uid and u.dt=g.dt group by 1,2),
-- stock level per day from store movement log (stock_after is the running balance written by the backend)
mv as (select m.products_uid product_uid, m.movement_date::date dt, m.stock_after,
              row_number() over (partition by m.products_uid, m.movement_date::date order by m.movement_date desc, m.id desc) rn_last
       from store m join top20 t on t.product_uid=m.products_uid, win where not m.is_deleted and m.movement_date::date <= win.d1),
day_stock as (select product_uid, dt, min(stock_after) min_after, max(stock_after) filter (where rn_last=1) end_after from mv group by 1,2),
filled as (  -- carry the last known end-of-day stock forward over days with no movement
  select g.product_uid, g.dt, ds.min_after,
         (select d2.end_after from day_stock d2 where d2.product_uid=g.product_uid and d2.dt<=g.dt order by d2.dt desc limit 1) eod
  from grid g left join day_stock ds on ds.product_uid=g.product_uid and ds.dt=g.dt),
counted_zero as (select cl.product_uid, cs.session_date dt from counting_line cl join counting_session cs on cs.uid=cl.session_uid
                 where not cl.is_deleted and not cs.is_deleted and coalesce(cl.recount_qty, cl.counted_qty)=0),
stockout as (select f.product_uid, count(*) filter (where coalesce(f.min_after, f.eod)<=0 or f.eod<=0
                     or exists (select 1 from counted_zero z where z.product_uid=f.product_uid and z.dt=f.dt)) so_days,
                     count(*) filter (where f.eod<=0) eod_zero_days
             from filled f group by 1),
stats as (select s.product_uid, avg(pcs) mean, stddev_samp(pcs) sd,
          avg(pcs) filter (where extract(isodow from dt)=1) mon, avg(pcs) filter (where extract(isodow from dt)=2) tue, avg(pcs) filter (where extract(isodow from dt)=3) wed,
          avg(pcs) filter (where extract(isodow from dt)=4) thu, avg(pcs) filter (where extract(isodow from dt)=5) fri, avg(pcs) filter (where extract(isodow from dt)=6) sat,
          avg(pcs) filter (where extract(isodow from dt)=7) sun,
          avg(pcs) filter (where extract(day from dt)>=20 or extract(day from dt)=1) win_in, avg(pcs) filter (where not (extract(day from dt)>=20 or extract(day from dt)=1)) win_out,
          count(*) filter (where pcs>0) sell_days
          from series s group by 1)
select row_number() over (order by t.pcs desc) rk, left(p.product_name,26) product, p.pieces_per_package ppp, t.pcs total_pcs, round(t.pcs::numeric/nullif(p.pieces_per_package,0),1) crates,
  round(st.mean,1) avg_day_pcs, round(st.mean/nullif(p.pieces_per_package,0),2) avg_day_crates, round(st.sd,1) sd, round(st.sd/nullif(st.mean,0),2) cv, st.sell_days,
  round(st.mon/st.mean,2) f_mon, round(st.tue/st.mean,2) f_tue, round(st.wed/st.mean,2) f_wed, round(st.thu/st.mean,2) f_thu, round(st.fri/st.mean,2) f_fri, round(st.sat/st.mean,2) f_sat, round(st.sun/st.mean,2) f_sun,
  round(st.win_in/st.mean,2) f_20_1, round(st.win_out/st.mean,2) f_2_19, so.so_days stockout_days, so.eod_zero_days, p.current_stock
from top20 t join products p on p.uid=t.product_uid join stats st on st.product_uid=t.product_uid join stockout so on so.product_uid=t.product_uid order by rk;

-- Q5.2 purchase frequency of the stockout-prone products (just-in-time buying check)
select left(p.product_name,22) p, count(*) filter (where movement_type='PURCHASE') purchases_90d,
       sum(quantity) filter (where movement_type='PURCHASE') purchased_pcs_90d
from store m join products p on p.uid=m.products_uid
where not m.is_deleted and m.movement_date::date between '2026-07-02' and '2026-09-29'
group by 1 order by 2 desc limit 25;

-- -------------------------------------------------------------------------------------
-- Q6. MARGINS
-- -------------------------------------------------------------------------------------
-- Q6.1 per product (top 20 by units + top 10 by gross profit)
with win as (select '2026-07-02'::date d0, '2026-09-29'::date d1),
lines as (select d.product_uid, d.piece_quantity pcs, d.sub_total rev, coalesce(d.total_cost, d.cost_per_piece*d.piece_quantity) cost
  from sales_details d join sales s on s.uid=d.sale_uid, win
  where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between win.d0 and win.d1),
per as (select product_uid, sum(pcs) pcs, sum(rev) rev, sum(cost) cost, count(*) filter (where cost is null) no_cost from lines group by 1),
tot as (select sum(rev) rev, sum(cost) cost, sum(rev-coalesce(cost,rev)) gp from per),
purch as (select product_uid, sum(cost_per_piece * case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end)
                 / nullif(sum(case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end),0) buy_cpp
          from purchases, win where not is_deleted and status in ('RECEIVED','APPROVED') and purchase_date::date between win.d0 and win.d1 group by 1),
ranked as (select per.*, row_number() over (order by pcs desc) rk_units, row_number() over (order by rev-cost desc nulls last) rk_gp from per)
select r.rk_units rk, r.rk_gp, left(p.product_name,24) product, p.pieces_per_package ppp,
  round(r.cost/nullif(r.pcs,0)) cost_pc_sold, round(pu.buy_cpp) buy_cpp_90d, round(p.current_average_cost) avg_cost_now,
  round(r.rev/nullif(r.pcs,0)) sell_pc_real, p.piece_sale_price list_pc, p.whole_sale_price list_crate,
  round(100*(r.rev-r.cost)/nullif(r.rev,0),1) gm_pct, round((r.rev-r.cost)/nullif(r.pcs,0)) gp_per_pc, round((r.rev-r.cost)/nullif(r.pcs,0)*p.pieces_per_package) gp_per_crate,
  round(r.rev-r.cost) gp_90d, round(100*(r.rev-r.cost)/(select gp from tot),1) gp_share_pct,
  round(100*(r.rev - r.pcs*pu.buy_cpp)/nullif(r.rev,0),1) gm_at_buy_cost
from ranked r join products p on p.uid=r.product_uid left join purch pu on pu.product_uid=r.product_uid
where r.rk_units<=20 or r.rk_gp<=10 order by r.rk_units;

-- Q6.2 overall 90-day gross margin + cross-check at 90-day purchase cost
with lines as (select d.product_uid, d.piece_quantity pcs, d.sub_total rev, d.total_cost cost from sales_details d join sales s on s.uid=d.sale_uid
               where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between '2026-07-02' and '2026-09-29'),
purch as (select product_uid, sum(cost_per_piece*case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end)
                 / nullif(sum(case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end),0) cpp
          from purchases where not is_deleted and status in ('RECEIVED','APPROVED') and purchase_date::date between '2026-07-02' and '2026-09-29' group by 1)
select sum(rev) rev, sum(cost) cogs_recorded, sum(rev)-sum(cost) gp, round(100*(sum(rev)-sum(cost))/sum(rev),2) gm_pct,
       round(100*(sum(rev)-sum(coalesce(pcs*pu.cpp,cost)))/sum(rev),2) gm_at_buy_cost_pct,
       round((sum(rev)-sum(cost))/90) gp_per_day, round(sum(rev)/90) rev_per_day
from lines l left join purch pu using(product_uid);

-- Q6.3 monthly gross margin trend
select to_char(s.sale_date,'YYYY-MM') m, sum(d.sub_total) rev, sum(d.total_cost) cogs,
       round(100*(sum(d.sub_total)-sum(d.total_cost))/sum(d.sub_total),2) gm_pct
from sales_details d join sales s on s.uid=d.sale_uid where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' group by 1 order by 1;

-- Q6.4 operating expenses in the window (recon daily expenses are mirrored into capital_expenditure; counted once here)
select c.expenditure_type, c.status, count(*), sum(amount)
from capital_expenditure c
where not c.is_deleted and not c.is_from_product_capital and c.transaction_date::date between '2026-07-02' and '2026-09-29'
group by 1,2 order by 4 desc;

-- -------------------------------------------------------------------------------------
-- Q7. STOCK & CAPITAL TREND
-- -------------------------------------------------------------------------------------
-- Q7.1 weekly purchases vs COGS
-- Q7a: weekly purchases (received, at cost) vs COGS (recorded cost of goods sold), last 90 days
with days as (select g::date dt from generate_series('2026-07-02'::date,'2026-09-29','1 day') g),
pur as (select purchase_date::date dt, sum(cost_per_piece*case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end) v
        from purchases where not is_deleted and status in ('RECEIVED','APPROVED') group by 1),
cogs as (select s.sale_date::date dt, sum(d.total_cost) v from sales_details d join sales s on s.uid=d.sale_uid
         where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' group by 1),
daily as (select days.dt, coalesce(pur.v,0) purchases, coalesce(cogs.v,0) cogs from days left join pur using(dt) left join cogs using(dt))
select coalesce(to_char(date_trunc('week',dt),'YYYY-MM-DD'),'TOTAL') week, round(sum(purchases)) purchases, round(sum(cogs)) cogs, round(sum(purchases-cogs)) net_to_stock,
       round(avg(purchases)) avg_day_purch, round(avg(cogs)) avg_day_cogs
from daily group by rollup(date_trunc('week',dt)) order by date_trunc('week',dt) nulls last;

-- Q7.2 stock value at points in time (store running balance x products.current_average_cost)
with pts as (select unnest(array['2026-06-01','2026-07-01','2026-08-01','2026-09-01','2026-09-29']::date[]) d),
lastmv as (select pts.d, m.products_uid, (array_agg(m.stock_after order by m.movement_date desc, m.id desc))[1] stock
           from pts join store m on not m.is_deleted and m.movement_date::date <= pts.d group by 1,2)
select l.d as_of_end_of, sum(l.stock) pieces, round(sum(l.stock*coalesce(p.current_average_cost,p.last_purchase_cost,0))) value_at_avg_cost
from lastmv l join products p on p.uid=l.products_uid group by 1 order by 1;

-- Q7.3 stock write-downs in the window (counting adjustments COUN* + manual ADJ-*), and sale reversals
select m.movement_type, left(coalesce(m.reference,''),4) ref, sign(m.quantity) sgn, count(*), sum(m.quantity) pcs,
       round(sum(m.quantity*coalesce(p.current_average_cost,0))) value
from store m join products p on p.uid=m.products_uid
where not m.is_deleted and m.movement_date::date between '2026-07-02' and '2026-09-29' and m.movement_type in ('ADJUSTMENT','SALE_REVERSAL')
group by 1,2,3 order by 1,2,3;

-- -------------------------------------------------------------------------------------
-- Q8. DATA QUALITY FOR ORDERING
-- -------------------------------------------------------------------------------------
-- Q8.1 per-product counting variance profile
-- Q8a: per-product counting variance profile (approved sessions; final count = recount if any, else first count)
with l as (select cl.product_uid, cs.session_date, cl.system_qty_snapshot sys, coalesce(cl.recount_qty, cl.counted_qty) cnt,
                  coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot v, cl.unit_cost_snapshot uc, sa.uid sa_uid
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  left join stock_adjustment sa on sa.counting_line_uid=cl.uid and not sa.is_deleted
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null),
sold as (select d.product_uid, sum(d.piece_quantity) pcs from sales_details d join sales s on s.uid=d.sale_uid
         where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between '2026-07-02' and '2026-09-29' group by 1),
agg as (select l.product_uid, count(*) counts, count(*) filter (where v<>0) var_counts, count(*) filter (where v<0) short_n, count(*) filter (where v>0) surplus_n,
          round(avg(abs(v)) filter (where v<>0),1) avg_abs_var, sum(v) filter (where v<0) short_pcs, sum(v) filter (where v>0) surplus_pcs,
          round(sum(v*uc) filter (where v<0 and sa_uid is not null)) posted_loss_value,
          count(*) filter (where v<>0 and sa_uid is null) unposted_n, sum(v) filter (where sa_uid is null) unposted_net_pcs
        from l group by 1)
select left(p.product_name,24) product, a.counts, a.var_counts, round(100.0*a.var_counts/a.counts) var_pct, a.short_n, a.surplus_n, a.avg_abs_var,
       a.short_pcs, a.surplus_pcs, a.posted_loss_value, a.unposted_n, a.unposted_net_pcs, coalesce(s.pcs,0) sold_90d,
       round(100.0*abs(coalesce(a.short_pcs,0))/nullif(s.pcs,0),1) short_pct_of_sold
from agg a join products p on p.uid=a.product_uid left join sold s on s.product_uid=a.product_uid
where a.var_counts>0 order by a.var_counts desc, coalesce(s.pcs,0) desc limit 40;

-- Q8.2 counting sessions per month by status
select to_char(session_date,'YYYY-MM') m, status, count_mode, count(*), count(distinct session_date) days,
       sum(items_with_variance) var_items, round(sum(total_variance_value)) var_value
from counting_session where not is_deleted group by 1,2,3 order by 1,2,3;

-- Q8.3 days with no APPROVED counting session
with d as (select g::date dt from generate_series('2026-07-05'::date,'2026-09-29','1 day') g)
select dt, to_char(dt,'Dy') dy,
       coalesce((select string_agg(status||'/'||count_mode, ',') from counting_session s where s.session_date=d.dt and not s.is_deleted),'NONE') sessions
from d where not exists (select 1 from counting_session s where s.session_date=d.dt and not s.is_deleted and s.status='APPROVED') order by 1;

-- Q8.4 approved variance lines that never reached stock_adjustment (the NULL cashier_reason quirk)
with l as (select cl.*, coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot final_var, sa.uid sa_uid
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  left join stock_adjustment sa on sa.counting_line_uid=cl.uid and not sa.is_deleted
  where not cl.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null)
select (sa_uid is not null) posted, sign(final_var) sgn, (cashier_reason is null and explained_at is null) no_reason,
       count(*), sum(final_var) qty, round(sum(final_var*unit_cost_snapshot)) value
from l where final_var<>0 group by 1,2,3 order by 1,2,3;
