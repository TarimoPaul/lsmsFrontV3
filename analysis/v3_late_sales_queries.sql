-- =====================================================================================
-- LSMS V3 — sales keyed in late (after their sale day has ended). READ-ONLY.
-- Source: prod dump lsms_20261004_0200.dump restored into a throw-away local container
-- (postgres:17, container lsms_order_bt) — NOT production, NOT staging.
--   docker exec -i lsms_order_bt psql -U postgres -d lsms -q < analysis/v3_late_sales_queries.sql
--
-- Conventions:
--   * sales.sale_date  = the day the sale belongs to (a back-dated sale is stored at 00:00:00)
--   * sales.created_at = when the row was keyed in
--   * "late" = created_at::date > sale_date::date
--   * sale_source = 'STANDARD' and not deleted (walk-in debt rows are excluded), as in the P&L
--   * window L1..L7 = 2026-08-05 .. 2026-10-03 (the 60 backtest days); L8 = all history
-- Every query is a plain SELECT.
-- =====================================================================================
SET default_transaction_read_only = on;
SET statement_timeout = '60s';

\echo == L1 totals
select count(*) sales, round(sum(total_amount)) value,
       count(*) filter (where created_at::date > sale_date::date) late_sales,
       round(sum(total_amount) filter (where created_at::date > sale_date::date)) late_value,
       round(100.0 * count(*) filter (where created_at::date > sale_date::date) / count(*), 1) late_pct_n,
       round(100.0 * sum(total_amount) filter (where created_at::date > sale_date::date) / sum(total_amount), 1) late_pct_value,
       count(distinct sale_date::date) days,
       count(distinct sale_date::date) filter (where created_at::date > sale_date::date) days_with_late,
       count(*) filter (where created_at::date < sale_date::date) dated_in_future,
       count(*) filter (where created_at::date > sale_date::date and sale_date::time <> '00:00:00') late_not_at_midnight,
       max(created_at::date - sale_date::date) max_days_late
from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03';

\echo == L2 by sale day (only days with late entries)
with s as (
  select sale_date::date d, count(*) n, sum(total_amount) val,
         count(*) filter (where created_at::date > sale_date::date) late_n,
         sum(total_amount) filter (where created_at::date > sale_date::date) late_val,
         min(created_at) filter (where created_at::date > sale_date::date) first_in,
         max(created_at) filter (where created_at::date > sale_date::date) last_in
  from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03'
  group by 1)
select d sale_day, to_char(d, 'Dy') dow, late_n, n day_sales, round(late_val) late_value, round(val) day_value,
       round(100.0 * late_val / val, 1) pct_of_day, to_char(first_in, 'HH24:MI') first_entry, to_char(last_in, 'HH24:MI') last_entry,
       round((extract(epoch from last_in - (d + 1)) / 3600)::numeric, 1) hours_after_day_end
from s where late_n > 0 order by d;

\echo == L3 by entry hour (the morning after)
select extract(hour from created_at)::int entry_hour, count(*) late_sales, round(sum(total_amount)) late_value,
       count(distinct sale_date::date) days
from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03'
  and created_at::date > sale_date::date
group by 1 order by 1;

\echo == L4 how much is in by a given time the next morning (cumulative)
with l as (select created_at::time t, total_amount from sales where not is_deleted and sale_source = 'STANDARD'
           and sale_date::date between '2026-08-05' and '2026-10-03' and created_at::date > sale_date::date)
select c::time by_time, count(*) filter (where t <= c::time) sales_in, round(coalesce(sum(total_amount) filter (where t <= c::time), 0)) value_in,
       round(100.0 * coalesce(sum(total_amount) filter (where t <= c::time), 0) / sum(total_amount), 1) pct_value
from l cross join (values ('06:00'), ('07:00'), ('08:00'), ('08:30'), ('09:00'), ('09:30'), ('10:00'), ('10:30'), ('11:00')) x(c)
group by 1 order by 1;

\echo == L5 delay after the sale day ended (hours)
select round(min(h)::numeric, 2) min_h, round((percentile_cont(0.5) within group (order by h))::numeric, 2) median_h,
       round((percentile_cont(0.9) within group (order by h))::numeric, 2) p90_h, round(max(h)::numeric, 2) max_h
from (select extract(epoch from created_at - (sale_date::date + 1)) / 3600 h from sales
      where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03'
        and created_at::date > sale_date::date) x;

\echo == L6 by weekday of the sale day
select extract(isodow from sale_date)::int dow, to_char(min(sale_date), 'Dy') weekday,
       count(distinct sale_date::date) filter (where created_at::date > sale_date::date) days_with_late, count(distinct sale_date::date) days,
       count(*) filter (where created_at::date > sale_date::date) late_sales, count(*) sales,
       round(sum(total_amount) filter (where created_at::date > sale_date::date)) late_value,
       round(100.0 * sum(total_amount) filter (where created_at::date > sale_date::date) / sum(total_amount), 1) pct_value
from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03'
group by 1 order by 1;

\echo == L7 which day do the books put a late sale on?
-- (a) General Ledger entry date
select 'GL journal_entry.entry_date' book, count(*) n,
       count(*) filter (where je.entry_date::date = s.sale_date::date) on_sale_day,
       count(*) filter (where je.entry_date::date = s.created_at::date) on_entry_day
from sales s join journal_entry je on je.reference_uid = s.uid and not je.is_deleted
where not s.is_deleted and s.sale_source = 'STANDARD' and s.sale_date::date between '2026-08-05' and '2026-10-03'
  and s.created_at::date > s.sale_date::date
union all
-- (b) stock movements
select 'store.movement_date (stock)', count(*),
       count(*) filter (where m.movement_date::date = s.sale_date::date),
       count(*) filter (where m.movement_date::date = s.created_at::date)
from sales s join store m on m.reference like 'SALE-' || s.receipt_number || '%' and not m.is_deleted and m.movement_type = 'SALE'
where not s.is_deleted and s.sale_source = 'STANDARD' and s.sale_date::date between '2026-08-05' and '2026-10-03'
  and s.created_at::date > s.sale_date::date;

\echo == L7c reconciliation auto_total_sales against sales by sale_date, on days with late entries
with s as (select sale_date::date d, sum(total_amount) tot, sum(total_amount) filter (where created_at::date > sale_date::date) late,
                  max(created_at) filter (where created_at::date > sale_date::date) last_late
           from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03' group by 1),
     r as (select reconciliation_date d, sum(auto_total_sales) auto_sales, min(submitted_at) submitted_at
           from daily_reconciliation where not is_deleted group by 1)
select count(*) filter (where late > 0) days_with_late,
       count(*) filter (where late > 0 and abs(r.auto_sales - s.tot) < 1) recon_includes_late,
       count(*) filter (where late > 0 and abs(r.auto_sales - (s.tot - s.late)) < 1) recon_misses_late,
       count(*) filter (where late > 0 and r.d is null) no_recon,
       count(*) filter (where late > 0 and r.submitted_at < s.last_late) recon_submitted_before_late_entry
from s left join r on r.d = s.d;

\echo == L7d sales keyed in before 11:00 and dated the SAME day (could be sales of the day before, not back-dated; cannot be proven)
select sale_date::date sale_day, to_char(created_at, 'HH24:MI') entered, round(total_amount) value,
       (select count(*) from sales y where not y.is_deleted and y.sale_source = 'STANDARD' and y.sale_date::date = s.sale_date::date - 1
          and y.created_at::date = s.created_at::date) late_entries_same_morning
from sales s where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-08-05' and '2026-10-03'
  and created_at::date = sale_date::date and extract(hour from created_at) < 11
order by created_at;

\echo == L8 trend by month (all history) and entry hours of every late sale ever
select to_char(sale_date, 'YYYY-MM') ym, count(*) sales, count(*) filter (where created_at::date > sale_date::date) late_sales,
       round(sum(total_amount)) value, round(coalesce(sum(total_amount) filter (where created_at::date > sale_date::date), 0)) late_value,
       round(100.0 * coalesce(sum(total_amount) filter (where created_at::date > sale_date::date), 0) / sum(total_amount), 1) pct_value
from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date >= '2026-02-01' group by 1 order by 1;

select min(created_at::time) earliest_late_entry, max(created_at::time) latest_late_entry,
       count(*) filter (where extract(hour from created_at) < 7) entered_00_to_07,
       count(*) filter (where created_at::date - sale_date::date > 1) more_than_1_day_late, count(*) late_sales
from sales where not is_deleted and sale_source = 'STANDARD' and sale_date::date between '2026-07-01' and '2026-10-03'
  and created_at::date > sale_date::date;

\echo == L9 pieces inside late sales (stock the 00:00 order does not see yet)
select count(distinct s.uid) late_sales, sum(d.piece_quantity) pieces, count(*) lines
from sales_details d join sales s on s.uid = d.sale_uid
where not d.is_deleted and not s.is_deleted and s.sale_source = 'STANDARD' and s.sale_date::date between '2026-08-05' and '2026-10-03'
  and s.created_at::date > s.sale_date::date;
