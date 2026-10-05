-- =====================================================================================
-- LSMS V3 — does the morning count show bigger variances on days when yesterday's sales
-- were keyed in AFTER the count had started? READ-ONLY.
-- Source: prod dump lsms_20261004_0200.dump in the throw-away local container lsms_order_bt.
--   docker exec -i lsms_order_bt psql -U postgres -d lsms -q < analysis/v3_count_vs_late_sales_queries.sql
--
-- Facts used (checked on the dump):
--   * counting_line.system_qty_snapshot is the system stock at counting_session.started_at
--     (7,692 of 7,928 lines equal the stock at session start; the 5 lines whose stock moved
--     between start and their own count all equal the stock at START).
--   * a late sale = sales.created_at::date > sale_date::date; its stock movement is written at
--     created_at. So pieces of a late sale keyed in after started_at are still inside the
--     snapshot but no longer on the shelf: the line shows a false shortage of that many pieces.
--   * variance = coalesce(recount_qty, counted_qty) - system_qty_snapshot; value at unit_cost_snapshot.
--   * one session per day (best status wins), days 2026-08-06 .. 2026-10-03.
--   * soda = product ids 3, 25, 74, 98 (Pepsi/Mirinda, Coca/Fanta, and their take-away lines).
-- Plain SELECTs over four TEMP views (session-local, gone when psql exits; nothing is stored).
-- =====================================================================================
SET statement_timeout = '60s';

create temp view v_sess as
select * from (
  select cs.*, row_number() over (partition by cs.session_date
           order by case cs.status when 'APPROVED' then 0 when 'PENDING_APPROVAL' then 1 else 2 end, cs.started_at desc) rn
  from counting_session cs where not cs.is_deleted and cs.session_date between '2026-08-06' and '2026-10-03') x
where rn = 1;

-- pieces of yesterday's sales per count day and product, split by keyed in before / after the count started
create temp view v_late as
select se.session_date, d.product_uid,
       sum(d.piece_quantity) filter (where s.created_at > se.started_at) pcs_after,
       sum(d.piece_quantity) filter (where s.created_at <= se.started_at) pcs_before
from v_sess se
join sales s on s.sale_date::date = se.session_date - 1 and s.created_at::date > s.sale_date::date
            and not s.is_deleted and s.sale_source = 'STANDARD'
join sales_details d on d.sale_uid = s.uid and not d.is_deleted
group by 1, 2;

create temp view v_line as
select se.session_date, se.started_at, cl.uid line_uid, cl.product_uid, p.id product_id, (p.id in (3, 25, 74, 98)) soda,
       coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot var_qty,
       (coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot) * coalesce(cl.unit_cost_snapshot, 0) var_val,
       coalesce(l.pcs_after, 0) pcs_after, coalesce(l.pcs_before, 0) pcs_before, coalesce(cl.unit_cost_snapshot, 0) cost
from v_sess se
join counting_line cl on cl.session_uid = se.uid and not cl.is_deleted and cl.counted_qty is not null
join products p on p.uid = cl.product_uid
left join v_late l on l.session_date = se.session_date and l.product_uid = cl.product_uid;

create temp view v_day as
select session_date,
       case when sum(pcs_after) > 0 then '3 counted BEFORE yesterday''s sales were keyed in'
            when sum(pcs_before) > 0 then '2 late sales keyed in before the count'
            else '1 no late sales' end grp,
       sum(abs(var_val)) abs_val, sum(var_val) net_val, count(*) filter (where var_qty <> 0) var_lines,
       sum(abs(var_qty)) filter (where soda) soda_abs_qty, sum(var_qty) filter (where soda) soda_net_qty,
       sum(abs(var_val)) filter (where soda) soda_abs_val,
       sum(pcs_after) pcs_after, sum(pcs_after * cost) val_after,
       sum(abs(var_qty + pcs_after) * cost) abs_val_fixed, sum((var_qty + pcs_after) * cost) net_val_fixed,
       sum(abs(var_qty + pcs_after)) filter (where soda) soda_abs_qty_fixed
from v_line group by 1;

-- the temp views are in place: everything below runs read-only
SET default_transaction_read_only = on;

\echo == C1 variance per count day, by group
select grp, count(*) days, round(avg(abs_val)) avg_abs_value, round((percentile_cont(0.5) within group (order by abs_val))::numeric) median_abs_value,
       round(avg(net_val)) avg_net_value, round(avg(var_lines), 1) avg_lines_with_variance,
       round(avg(soda_abs_qty), 1) soda_avg_abs_pieces, round(avg(soda_net_qty), 1) soda_avg_net_pieces, round(avg(soda_abs_val)) soda_avg_abs_value
from v_day group by 1 order by 1;

\echo == C2 group 3 again, after adding back the pieces keyed in after the count started
select count(*) days, round(avg(pcs_after)) avg_pieces_not_yet_keyed, round(avg(val_after)) avg_value_not_yet_keyed,
       round(avg(abs_val)) avg_abs_value, round(avg(abs_val_fixed)) avg_abs_value_fixed,
       round(avg(net_val)) avg_net_value, round(avg(net_val_fixed)) avg_net_value_fixed,
       round(avg(soda_abs_qty), 1) soda_avg_abs_pieces, round(avg(soda_abs_qty_fixed), 1) soda_avg_abs_pieces_fixed
from v_day where grp like '3%';

\echo == C3 lines whose product had sales keyed in after the count started
select case when soda then 'soda' else 'other' end kind, count(*) lines, sum(pcs_after) pieces_not_yet_keyed,
       count(*) filter (where var_qty = -pcs_after) variance_is_exactly_those_pieces,
       count(*) filter (where var_qty < 0 and var_qty <> -pcs_after) other_shortage,
       count(*) filter (where var_qty = 0) no_variance, count(*) filter (where var_qty > 0) surplus,
       sum(var_qty) net_variance_pieces, round(sum(var_val)) net_variance_value
from v_line where pcs_after > 0 group by 1 order by 1;

\echo == C4 the days of group 3
select d.session_date, to_char(se.started_at, 'HH24:MI') count_started, d.pcs_after pieces_not_yet_keyed, round(d.val_after) value_not_yet_keyed,
       round(d.abs_val) abs_variance, round(d.abs_val_fixed) abs_variance_fixed, round(d.net_val) net_variance, round(d.net_val_fixed) net_variance_fixed,
       d.soda_net_qty soda_net_pieces
from v_day d join v_sess se on se.session_date = d.session_date where d.grp like '3%' order by 1;

\echo == C5 were those false shortages posted to stock? (stock_adjustment per affected line)
select count(*) affected_lines_with_shortage, count(sa.id) posted_adjustments, round(coalesce(sum(sa.adjustment_value), 0)) posted_value,
       coalesce(sum(sa.adjustment_qty), 0) posted_pieces
from v_line l left join stock_adjustment sa on sa.counting_line_uid = l.line_uid and not sa.is_deleted
where l.pcs_after > 0 and l.var_qty < 0;

\echo == C6 count start time against the last late entry, days with late sales
select count(*) days_with_late_sales,
       count(*) filter (where se.started_at < x.first_in) count_started_before_first_entry,
       count(*) filter (where se.started_at >= x.first_in and se.started_at < x.last_in) count_started_while_keying,
       count(*) filter (where se.started_at >= x.last_in) count_started_after_last_entry
from v_sess se join (select sale_date::date + 1 d, min(created_at) first_in, max(created_at) last_in from sales
                     where not is_deleted and sale_source = 'STANDARD' and created_at::date > sale_date::date group by 1) x on x.d = se.session_date;
