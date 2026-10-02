-- =====================================================================================
-- LSMS V3 — net profit check (READ-ONLY)
-- Source: prod pg_dump 2026-09-30 10:26 (backups/prod_Lsms_20260930_1026_before_gl.dump = latest),
-- restored into a throw-away local postgres:17 container. NOT production.
-- Window: 2026-07-02 .. 2026-09-29 (90 days). Change the literals to re-run.
-- All plain SELECTs. Session guard below.
-- =====================================================================================
SET default_transaction_read_only = on;
SET statement_timeout = '30s';

-- -------------------------------------------------------------------------------------
-- N1. WHERE EXPENSES LIVE
-- -------------------------------------------------------------------------------------
-- N1.1 tables/columns that can hold expenses
select table_name, column_name from information_schema.columns
where table_schema='public' and column_name ~* 'expen|accru|deduct|overhead|monthly_alloc|allocated_month|depreciation'
order by 1,2;

-- N1.2 capital_expenditure by type / frequency / status (all time)
select expenditure_type, expenditure_frequency, status, is_from_product_capital, is_recurring, is_deleted,
       count(*), sum(amount), min(transaction_date)::date, max(transaction_date)::date
from capital_expenditure group by 1,2,3,4,5,6 order by 1,2,3;

-- N1.3 every MONTHLY_EXPENSE row (allocated_month 0 = applies to every month of allocated_year)
select transaction_date::date, created_at, amount, monthly_allocation_amount, allocated_year, allocated_month,
       is_recurring, recurring_type, parent_capital_expenditure_uid is not null as child, approved_by, description
from capital_expenditure where expenditure_type='MONTHLY_EXPENSE' and not is_deleted order by transaction_date, created_at;

-- N1.4 what the "previous analysis" query (v3_queries.sql Q6.4) counts: transaction_date in window only
select c.expenditure_type, c.status, count(*), sum(amount)
from capital_expenditure c
where not c.is_deleted and not c.is_from_product_capital and c.transaction_date::date between '2026-07-02' and '2026-09-29'
group by 1,2 order by 4 desc;

-- N1.5 the P&L view (v_profit_loss_statement) — note monthly_opex 18,402.78 for Jan-Jun:
-- the view divides allocated_month=0 rows by 12 although their amount is ALREADY monthly (rent 200k/mo).
select period_month::date, total_revenue, gross_profit, daily_opex, round(monthly_opex) monthly_opex, round(total_opex) total_opex
from v_profit_loss_statement order by 1;

-- -------------------------------------------------------------------------------------
-- N2. EXPENSES IN THE WINDOW
-- -------------------------------------------------------------------------------------
-- N2.1 daily expenses by RECONCILIATION day (the day the money was spent), by category
select to_char(dr.reconciliation_date,'YYYY-MM') m, re.expense_type, count(*), sum(re.amount)
from reconciliation_expenses re join daily_reconciliation dr on dr.uid=re.reconciliation_uid
where not re.is_deleted and not dr.is_deleted and dr.reconciliation_date between '2026-07-02' and '2026-09-29'
group by rollup(1,2) order by 1,2;

-- N2.2 recon header totals agree with the lines (by recon status)
select to_char(reconciliation_date,'YYYY-MM') m, status, count(*), sum(expenses_total)
from daily_reconciliation where not is_deleted and reconciliation_date between '2026-07-02' and '2026-09-29' group by 1,2 order by 1,2;

-- N2.3 daily capex mirrors vs recon day: 15 rows / 128,500 are June (and 07-01) recon expenses typed in later
select case when re.uid is null then 'no recon line' when dr.reconciliation_date not between '2026-07-02' and '2026-09-29' then 'recon outside window' else 'ok' end k,
       count(*), sum(c.amount)
from capital_expenditure c
left join reconciliation_expenses re on re.capital_expenditure_uid=c.uid and not re.is_deleted
left join daily_reconciliation dr on dr.uid=re.reconciliation_uid
where c.expenditure_type='DAILY_EXPENSE' and not c.is_deleted and not c.is_from_product_capital
  and c.transaction_date::date between '2026-07-02' and '2026-09-29' group by 1;

-- N2.4 monthly charge per month, using the backend rule (CapitalExpenditureRepository.findMonthlyAllocation):
-- approved, not a recurring template, (year,month) match OR allocated_month = 0 for that year
with months as (select generate_series('2026-07-01'::date,'2026-09-01','1 month')::date m)
select m.m, round(sum(c.amount)) monthly_charge, extract(day from (m.m + interval '1 month - 1 day'))::int days_in_month,
       round(sum(c.amount) / extract(day from (m.m + interval '1 month - 1 day'))) per_day,
       string_agg(c.description||'='||round(c.amount), '; ' order by c.amount desc) items
from months m join capital_expenditure c on c.expenditure_type='MONTHLY_EXPENSE' and c.is_approved and not c.is_deleted and not c.is_recurring
 and ((c.allocated_year = extract(year from m.m) and c.allocated_month in (extract(month from m.m), 0))
      or (c.allocated_year is null and date_trunc('month', c.transaction_date)::date = m.m))
group by m.m order by 1;
-- window proration: Jul x 30/31, Aug x 31/31, Sep x 29/30

-- N2.5 double-count candidates: monthly items that also appear as daily (recon) expenses
select to_char(dr.reconciliation_date,'YYYY-MM') m, re.description, count(*), sum(re.amount)
from reconciliation_expenses re join daily_reconciliation dr on dr.uid=re.reconciliation_uid
where not re.is_deleted and not dr.is_deleted and dr.reconciliation_date between '2026-07-01' and '2026-09-29'
  and re.description ~* 'kingamuzi|azam|dereva|router|kodi|frame|tra|manager|wafanyakazi|mfanyakazi'
group by 1,2 order by 1,2;

-- N2.6 assets: depreciation is NOT computed (monthly_depreciation NULL) -> not in any LSMS profit figure
select transaction_date::date, amount, asset_life_months, salvage_value, monthly_depreciation,
       round((amount-coalesce(salvage_value,0))/asset_life_months) implied_monthly_dep, description
from capital_expenditure where expenditure_type='INVESTMENT' and not is_from_product_capital and not is_deleted;

-- N2.7 recon cash variance (shortage/over) — 2026-07-04 -542,000 is explained "imekosewa"
select reconciliation_date, variance_amount, shortage_reason, variance_explanation
from daily_reconciliation where not is_deleted and status='APPROVED' and reconciliation_date between '2026-07-02' and '2026-09-29'
  and abs(variance_amount) >= 20000 order by 1;
select sum(variance_amount) net, sum(variance_amount) filter (where variance_amount<0) short, sum(variance_amount) filter (where variance_amount>0) over_
from daily_reconciliation where not is_deleted and status='APPROVED' and reconciliation_date between '2026-07-02' and '2026-09-29';

-- -------------------------------------------------------------------------------------
-- N3. STOCK LOSS
-- -------------------------------------------------------------------------------------
-- N3.1 posted vs unposted count variances in the window (final = recount if any)
with l as (select coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot v, cl.unit_cost_snapshot uc, sa.uid sa_uid
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  left join stock_adjustment sa on sa.counting_line_uid=cl.uid and not sa.is_deleted
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null
    and cs.session_date between '2026-07-02' and '2026-09-29')
select (sa_uid is not null) posted, sign(v) sgn, count(*), sum(v) pcs, round(sum(v*uc)) val from l where v<>0 group by 1,2 order by 1,2;

-- N3.2 WHY unposted lines must not be summed: classify them
with l as (select cl.product_uid, cs.session_date, coalesce(cl.recount_at, cl.counted_at) t,
                  coalesce(cl.recount_qty, cl.counted_qty)-cl.system_qty_snapshot v, cl.unit_cost_snapshot uc
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  left join stock_adjustment sa on sa.counting_line_uid=cl.uid and not sa.is_deleted
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null
    and cs.session_date between '2026-07-02' and '2026-09-29' and sa.uid is null),
x as (select l.*,
        (select sum(m.quantity) from store m where m.products_uid=l.product_uid and not m.is_deleted and m.movement_type='PURCHASE'
           and m.movement_date > l.t and m.movement_date::date=l.session_date) later_pur,
        (select coalesce(cl2.recount_qty,cl2.counted_qty)-cl2.system_qty_snapshot from counting_line cl2 join counting_session cs2 on cs2.uid=cl2.session_uid
          where cl2.product_uid=l.product_uid and cs2.status='APPROVED' and not cl2.is_deleted and cs2.session_date>l.session_date
          order by cs2.session_date limit 1) next_v
      from l where v<>0)
select case when v>0 and later_pur>=v then 'surplus = purchase recorded later same day'
            when v>0 then 'surplus other'
            when v<0 and next_v=v then 'shortage repeated next day (same qty)'
            else 'shortage other' end k, count(*), sum(v) pcs, round(sum(v*uc)) val
from x group by 1 order by 1;

-- N3.3 example sequences (GILBEYS KUPIMA -9 every day = ONE shortage seen 67 times)
with l as (select cl.product_uid, cs.session_date, coalesce(cl.recount_qty, cl.counted_qty) - cl.system_qty_snapshot v, sa.uid sa
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  left join stock_adjustment sa on sa.counting_line_uid=cl.uid and not sa.is_deleted
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null
    and cs.session_date between '2026-07-02' and '2026-09-29')
select left(p.product_name,22) product, count(*) filter (where sa is null and v<>0) unposted, sum(v) filter (where sa is null) net_unposted,
       string_agg(v::text, ',' order by session_date) filter (where v<>0) seq
from l join products p on p.uid=l.product_uid group by 1 order by abs(sum(v) filter (where sa is null)) desc nulls last limit 8;

-- N3.4 TRUE loss per product, first approved count -> last approved count (telescoping):
--   loss = (cnt_last - sys_last) - (cnt_first - sys_first) + ADJUSTMENT movements between the two counts
-- (= physical change - recorded purchases + recorded sales; exact whether or not lines were posted)
with l as (select cl.product_uid, cs.session_date, coalesce(cl.recount_at, cl.counted_at, cs.started_at) t,
                  cl.system_qty_snapshot sys, coalesce(cl.recount_qty, cl.counted_qty) cnt, cl.unit_cost_snapshot uc,
                  row_number() over (partition by cl.product_uid order by cs.session_date) rf,
                  row_number() over (partition by cl.product_uid order by cs.session_date desc) rz
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null
    and cs.session_date between '2026-07-02' and '2026-09-29'),
fl as (select f.product_uid, f.session_date d1, f.t t1, f.cnt-f.sys v1, z.session_date d2, z.t t2, z.cnt-z.sys v2, z.uc
       from l f join l z on z.product_uid=f.product_uid and z.rz=1 where f.rf=1),
adj as (select fl.product_uid, sum(m.quantity) filter (where m.reference like 'COUN%') adj_count,
               sum(m.quantity) filter (where m.reference like 'ADJ-%') adj_manual
        from fl join store m on m.products_uid=fl.product_uid and not m.is_deleted and m.movement_type='ADJUSTMENT'
         and m.movement_date > fl.t1 and m.movement_date < fl.t2 group by 1),
r as (select p.product_name, fl.*, coalesce(a.adj_count,0) ac, coalesce(a.adj_manual,0) am,
        fl.v2 - fl.v1 + coalesce(a.adj_count,0) + coalesce(a.adj_manual,0) loss_pcs,
        coalesce(nullif(p.current_average_cost,0), fl.uc) cost
      from fl join products p on p.uid=fl.product_uid left join adj a using(product_uid))
select count(*) products, min(d1), max(d2), sum(v1) v1_pcs, sum(v2) v2_pcs, sum(ac) posted_count_pcs, sum(am) manual_adj_pcs,
       sum(loss_pcs) loss_pcs, round(sum(loss_pcs*cost)) loss_val,
       round(sum(v1*cost)) v1_val, round(sum(v2*cost)) v2_val, round(sum(ac*cost)) posted_count_val, round(sum(am*cost)) manual_adj_val
from r;
-- (per-product: replace the last select with
--  select left(product_name,24), d1, d2, v1, v2, ac, am, loss_pcs, round(cost), round(loss_pcs*cost) from r order by loss_pcs*cost;)

-- N3.5 endpoint check: unposted end-count differences explained by a later same-day purchase (PEPSI +288 on 09-29)
with l as (select cl.product_uid, cs.session_date, coalesce(cl.recount_at, cl.counted_at) t,
                  coalesce(cl.recount_qty, cl.counted_qty)-cl.system_qty_snapshot v
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  where not cl.is_deleted and not cs.is_deleted and cs.status='APPROVED' and cl.counted_qty is not null
    and cs.session_date in ('2026-07-07','2026-09-29'))
select left(p.product_name,24), l.session_date, l.v,
       string_agg(m.movement_type||' '||m.quantity||' @'||to_char(m.movement_date,'HH24:MI'), '; ') later_same_day
from l join products p on p.uid=l.product_uid
left join store m on m.products_uid=l.product_uid and not m.is_deleted and m.movement_type in ('PURCHASE','ADJUSTMENT')
 and m.movement_date > l.t and m.movement_date::date=l.session_date
where l.v<>0 group by 1,2,3 order by 2,1;

-- N3.6 phantom stock from deleted sales whose reversal returned more than the sale took out
-- (CASTLE LITE RCP-20260807-270000-DCCB: out 8, back 160 -> +152 phantom, then "lost" in the 08-08 count)
with mv as (select substring(reference from '^SALE(?:_REV)?-(RCP-\d+-\d+-[0-9A-Za-z]+)') rcp, products_uid pu,
                   sum(quantity) filter (where movement_type='SALE') out_, sum(quantity) filter (where movement_type='SALE_REVERSAL') back_
            from store where not is_deleted and movement_type in ('SALE','SALE_REVERSAL') and movement_date >= '2026-06-25' group by 1,2)
select mv.rcp, left(p.product_name,18), out_, back_, coalesce(back_,0)-coalesce(out_,0) phantom_pcs,
       round((coalesce(back_,0)-coalesce(out_,0))*p.current_average_cost) phantom_val
from mv join products p on p.uid=mv.pu
where coalesce(back_,0) > coalesce(out_,0) and exists (select 1 from sales s where s.receipt_number=mv.rcp and s.is_deleted);

-- N3.7 manual ADJ-* adjustments in the window (reasons)
select m.movement_date, left(p.product_name,20), m.quantity, m.stock_before, m.stock_after, round(p.current_average_cost) cost, m.notes
from store m join products p on p.uid=m.products_uid
where not m.is_deleted and m.movement_type='ADJUSTMENT' and m.reference like 'ADJ-%' and m.movement_date::date between '2026-07-02' and '2026-09-29' order by 1;

-- N3.8 staff liabilities (count shortages charged to staff) and what was collected
select status, count(*), sum(amount), min(created_at)::date, max(created_at)::date from staff_liability where not is_deleted group by 1;
select count(*), sum(amount) from staff_liability_payment where not is_deleted;

-- -------------------------------------------------------------------------------------
-- N4. STOCK VALUE AT COST
-- -------------------------------------------------------------------------------------
-- N4.1 system stock (store running balance) at end of day, valued at (a) today's moving average and
-- (b) the last purchase cost on/before that day
with pts as (select unnest(array['2026-07-01','2026-07-02','2026-09-29']::date[]) d),
bal as (select pts.d, m.products_uid pu, (array_agg(m.stock_after order by m.movement_date desc, m.id desc))[1] q
        from pts join store m on not m.is_deleted and m.movement_date < pts.d + 1 group by 1,2),
hc as (select pts.d, pu.product_uid, (array_agg(pu.cost_per_piece order by pu.purchase_date desc, pu.id desc))[1] c
       from pts join purchases pu on not pu.is_deleted and pu.status in ('RECEIVED','APPROVED') and pu.cost_per_piece>0
        and pu.purchase_date < pts.d + 1 group by 1,2)
select b.d as_of_end_of, sum(b.q) pcs, round(sum(b.q*coalesce(p.current_average_cost,0))) val_current_avg,
       round(sum(b.q*coalesce(h.c,p.current_average_cost,0))) val_last_buy_cost_then
from bal b join products p on p.uid=b.pu left join hc h on h.d=b.d and h.product_uid=b.pu group by 1 order by 1;

-- N4.2 sales DATED 07-01 whose stock left on 07-02 (inflate the 07-01 closing balance by 511 pcs)
with s as (select receipt_number rcp, min(sale_date)::date sd from sales where not is_deleted group by 1)
select min(s.sd), max(s.sd), min(m.movement_date)::date, max(m.movement_date)::date, sum(m.quantity) pcs,
       round(sum(m.quantity*p.current_average_cost)) val_cur
from store m join products p on p.uid=m.products_uid join s on s.rcp=substring(m.reference from '^SALE-(RCP-\d+-\d+-[0-9A-Za-z]+)')
where not m.is_deleted and m.movement_type='SALE' and m.movement_date >= '2026-07-02' and m.movement_date < '2026-09-30' and s.sd < '2026-07-02';

-- N4.3 physical counts (07-07 first count, 09-29 last count) at cost
select cs.session_date, count(*), sum(coalesce(cl.recount_qty,cl.counted_qty)) pcs,
       round(sum(coalesce(cl.recount_qty,cl.counted_qty)*cl.unit_cost_snapshot)) counted_val,
       sum(cl.system_qty_snapshot) sys_pcs, round(sum(cl.system_qty_snapshot*cl.unit_cost_snapshot)) sys_val
from counting_line cl join counting_session cs on cs.uid=cl.session_uid
where cs.status='APPROVED' and not cl.is_deleted and cl.counted_qty is not null and cs.session_date in ('2026-07-07','2026-09-29') group by 1;

-- N4.4 stock roll-forward in pieces and at today's cost (exact in pieces)
select coalesce(m.movement_type||' '||case when m.movement_type='ADJUSTMENT' then left(m.reference,4) else '' end,'TOTAL') k,
       sum(case when m.movement_type='SALE' then -m.quantity else m.quantity end) pcs,
       round(sum(case when m.movement_type='SALE' then -m.quantity else m.quantity end * p.current_average_cost)) val_cur_cost
from store m join products p on p.uid=m.products_uid
where not m.is_deleted and m.movement_date >= '2026-07-02' and m.movement_date < '2026-09-30'
group by rollup(m.movement_type||' '||case when m.movement_type='ADJUSTMENT' then left(m.reference,4) else '' end) order by 1;

-- -------------------------------------------------------------------------------------
-- N5. GROSS PROFIT (same rule as v3_queries.sql Q6.2)
-- -------------------------------------------------------------------------------------
select to_char(s.sale_date,'YYYY-MM') m, count(distinct s.sale_date::date) days, sum(d.sub_total) rev, sum(d.total_cost) cogs,
       sum(d.sub_total)-sum(d.total_cost) gp
from sales_details d join sales s on s.uid=d.sale_uid
where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between '2026-07-02' and '2026-09-29'
group by rollup(1) order by 1;
