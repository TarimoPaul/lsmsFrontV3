-- =====================================================================================
-- LSMS V3 — auto-order (purchase suggestion) backtest: data extraction (READ-ONLY)
-- Source used for the report: prod pg_dump 2026-09-30 10:26 (prod_Lsms_20260930_1026_before_gl.dump)
-- restored into a throw-away local container (postgres:17), NOT production.
--
-- This file only EXTRACTS daily facts. The day-by-day simulation (which must use only
-- the data known on each day) is in analysis/v3_order_backtest.py, which runs every
-- "-- @name:" block below through psql --csv and reads the result.
--
-- Windows: the script passes psql variables d0 / d1 / d1next (backtest start, last full
-- day, the day after). Set LSMS_BT_END=YYYY-MM-DD to choose the last full day; the
-- backtest is the 60 days ending there. History always starts 2026-02-01.
--   first report : 2026-08-01 .. 2026-09-29 on the dump of 2026-09-30
--
-- Conventions (same as v3_queries.sql):
--   * demand   = sales.sale_source='STANDARD' AND NOT is_deleted (voided sales and the
--                RECONCILIATION_MANUAL walk-in debt rows are excluded), approved returns subtracted
--   * units    = sales_details.piece_quantity (always pieces)
--   * purchase = status RECEIVED; pieces = quantity x pieces_per_package_at_purchase for WHOLE_PACKAGE
--   * count    = coalesce(recount_qty, counted_qty) of the day's session
--   * everything is keyed by products.uid / products.id — product names are NOT unique
-- Every query is a plain SELECT.
-- =====================================================================================
SET default_transaction_read_only = on;
SET statement_timeout = '60s';

-- @name: products
select p.id, p.uid, p.product_name, coalesce(c.category_name,'') category, coalesce(p.pieces_per_package,0) ppp,
       coalesce(p.current_average_cost,0) avg_cost, coalesce(p.last_purchase_cost,0) last_cost,
       coalesce(p.piece_sale_price,0) piece_price, coalesce(p.whole_sale_price,0) crate_price,
       p.is_active, coalesce(p.current_stock,0) current_stock
from products p left join categories c on c.uid=p.category_uid
where not p.is_deleted order by p.id;

-- @name: sales_daily
-- net pieces / revenue / recorded cost per product per day
select product_uid, dt, sum(pcs) pcs, sum(rev) rev, sum(cost) cost from (
  select d.product_uid, s.sale_date::date dt, d.piece_quantity pcs, d.sub_total rev,
         coalesce(d.total_cost, d.cost_per_piece*d.piece_quantity, 0) cost
  from sales_details d join sales s on s.uid=d.sale_uid
  where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD'
    and s.sale_date::date between '2026-02-01' and :'d1'
  union all
  select ri.product_uid, r.return_date::date, -ri.return_quantity_pieces, 0, 0
  from sales_return_items ri join sales_returns r on r.uid=ri.sales_return_uid
  where r.return_status in ('APPROVED','PROCESSED','COMPLETED')
    and r.return_date::date between '2026-02-01' and :'d1') x
group by 1,2 order by 2,1;

-- @name: store_daily
-- store-level daily net sales amount (for the day-of-week / day-of-month factors)
with ret as (select original_sale_uid sale_uid, sum(coalesce(refund_amount,0)) r from sales_returns
             where return_status in ('APPROVED','PROCESSED','COMPLETED') group by 1)
select g::date dt, coalesce(sum(s.total_amount - coalesce(ret.r,0)),0) amt
from generate_series('2026-02-01'::date,:'d1','1 day') g
left join sales s on s.sale_date::date=g::date and not s.is_deleted and s.sale_source='STANDARD'
left join ret on ret.sale_uid=s.uid
group by 1 order by 1;

-- @name: sales_timing
-- When were the day's units ENTERED? The shop keys in ~10 batch "sales" a day, so created_at
-- is the entry time, not the moment the customer bought. Units entered before 13:00 on the
-- sale day were certainly sold before 13:00 (goods arrive ~13:00); units entered later may
-- also include morning sales, so pcs_pre13 / pcs_timed is a LOWER bound of the true share.
-- Sales entered on another calendar day (sale_date 00:00, back-dated) carry no timing at all.
select d.product_uid, s.sale_date::date dt,
       sum(d.piece_quantity) filter (where s.created_at::date = s.sale_date::date
                                       and extract(hour from s.created_at) < 13) pcs_pre13,
       sum(d.piece_quantity) filter (where s.created_at::date = s.sale_date::date
                                       and extract(hour from s.created_at) < 12) pcs_pre12,
       sum(d.piece_quantity) filter (where s.created_at::date = s.sale_date::date) pcs_timed,
       sum(d.piece_quantity) pcs_all
from sales_details d join sales s on s.uid=d.sale_uid
where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD'
  and s.sale_date::date between :'d0' and :'d1'
group by 1,2 order by 2,1;

-- @name: counts
-- one final count per product per day; if a day has several sessions the best status wins
select session_date dt, status, product_uid, system_qty, final_qty from (
  select cs.session_date, cs.status, cl.product_uid, cl.system_qty_snapshot system_qty,
         coalesce(cl.recount_qty, cl.counted_qty) final_qty,
         row_number() over (partition by cs.session_date, cl.product_uid
            order by case cs.status when 'APPROVED' then 0 when 'PENDING_APPROVAL' then 1 else 2 end,
                     cs.started_at desc) rn
  from counting_line cl join counting_session cs on cs.uid=cl.session_uid
  where not cl.is_deleted and not cs.is_deleted and cl.counted_qty is not null) x
where rn=1 order by 1,3;

-- @name: count_sessions
select session_date dt, status, count_mode, started_at, approved_at
from counting_session where not is_deleted order by session_date, started_at;

-- @name: purchases_daily
select product_uid, purchase_date::date dt,
       sum(case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end) pcs,
       sum(cost_per_piece*case when purchase_type='WHOLE_PACKAGE' then quantity*coalesce(pieces_per_package_at_purchase,1) else quantity end) val,
       count(*) n, min(purchase_type) ptype_min, max(purchase_type) ptype_max
from purchases
where not is_deleted and status='RECEIVED' and purchase_date::date between '2026-07-01' and :'d1next'
group by 1,2 order by 2,1;

-- @name: store_eod
-- system end-of-day stock per product per day with a movement (fallback stockout signal
-- for days that have no count the next morning). System stock is NOT used as stock on hand.
select products_uid product_uid, dt, stock_after eod from (
  select m.products_uid, m.movement_date::date dt, m.stock_after,
         row_number() over (partition by m.products_uid, m.movement_date::date order by m.movement_date desc, m.id desc) rn
  from store m where not m.is_deleted and m.movement_date::date between '2026-06-01' and :'d1') x
where rn=1 order by 1,2;

-- @name: recon
-- reconciliation fields used by the budget rule (one row per business day)
select reconciliation_date dt, min(status) status, count(*) n,
       sum(auto_total_sales) total_sales, sum(auto_cash_sales) cash_sales, sum(auto_mobile_sales) mobile_sales,
       sum(retail_debts_total) unpaid_debts, sum(auto_return_deductions) returns_ded,
       sum(debt_collections_total) debt_coll_system,
       sum(cash_debt_total) cash_debt, sum(bank_debt_total) bank_debt, sum(mobile_debt_total) mobile_debt,
       sum(expenses_total) expenses, sum(purchases_total) purchases_from_till,
       sum(cash_on_hand_declared) cash_on_hand, sum(bank_deposits_total) bank_safe_deposits, sum(safe_box_total) safe_box,
       sum(mobile_money_total) mobile_declared, sum(variance_amount) variance,
       min(submitted_at) submitted_at, min(approved_at) approved_at
from daily_reconciliation where not is_deleted
group by 1 order by 1;

-- @name: monthly_expenses
-- allocated_month = 0 rows are all-year rows whose amount is already MONTHLY (rent, TRA)
select allocated_year y, allocated_month m, sum(amount) amount, count(*) n
from capital_expenditure
where not is_deleted and expenditure_type='MONTHLY_EXPENSE' and status='APPROVED' and allocated_year is not null
group by 1,2 order by 1,2;

-- @name: suppliers
select coalesce(s.name, nullif(trim(p.supplier_name),''), '(haijajazwa)') supplier,
       (p.supplier_uid is not null) linked, count(*) purchases, count(distinct p.product_uid) products,
       round(sum(p.cost_per_piece*case when p.purchase_type='WHOLE_PACKAGE' then p.quantity*coalesce(p.pieces_per_package_at_purchase,1) else p.quantity end)) value
from purchases p left join suppliers s on s.uid=p.supplier_uid
where not p.is_deleted and p.status='RECEIVED' and p.purchase_date::date between :'d0' and :'d1'
group by 1,2 order by 5 desc;
