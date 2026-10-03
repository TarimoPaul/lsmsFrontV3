-- LSMS V3 — P&L ya kila siku: hesabu za mfano wa Septemba (READ-ONLY). Chanzo: backups/prod_Lsms_20260930_1026_before_gl.dump
-- Q1 = jedwali la kila siku; Q2 = jumla + salio la madeni (AR) mwanzo/mwisho
-- ===== Q1 =====
set default_transaction_read_only=on;
set statement_timeout='60s';
\set f '2026-09-01'
\set t '2026-09-29'
with
days as (select d::date dt from generate_series(:'f'::date, :'t'::date, '1 day') d),
gp as (select s.sale_date::date dt, sum(d.sub_total) rev, sum(d.total_cost) cogs
       from sales_details d join sales s on s.uid=d.sale_uid
       where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between :'f' and :'t' group by 1),
gm_month as (select (sum(rev)-sum(cogs))/sum(rev) gm from gp),
sloss as (select dt, sum(v) v from (
   select approved_at::date dt, adjustment_value v from stock_adjustment where not is_deleted and approved_at::date between :'f' and :'t'
   union all select m.movement_date::date, m.quantity*p.current_average_cost from store m join products p on p.uid=m.products_uid
   where not m.is_deleted and m.movement_type='ADJUSTMENT' and m.reference like 'ADJ-%' and m.movement_date::date between :'f' and :'t') x group by 1),
dexp as (select dr.reconciliation_date dt, sum(re.amount) amt from reconciliation_expenses re join daily_reconciliation dr on dr.uid=re.reconciliation_uid
         where not re.is_deleted and not dr.is_deleted and dr.reconciliation_date between :'f' and :'t' group by 1),
credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, max(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on
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
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS' where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL' where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid)),
dflow as (select e.ev_date dt,
  sum(e.amt) filter (where kind='ISSUE' and cs.src='POS') iss_pos,
  sum(e.amt) filter (where kind='ISSUE' and cs.src<>'POS') iss_walk,
  sum(e.amt) filter (where kind='COLLECT') coll,
  sum(e.amt) filter (where kind='ADJUST') adj
  from debt_events e join cs using(sale_uid) where e.ev_date between :'f' and :'t' group by 1),
-- POS margin per sale from its own lines
pos_margin as (select d.sale_uid, (sum(d.sub_total)-sum(d.total_cost))/nullif(sum(d.sub_total),0) m from sales_details d where not d.is_deleted group by 1),
bado as (select cs.issued_on dt,
  sum(cs.still_owed) filter (where src='POS') bado_pos,
  sum(cs.still_owed) filter (where src<>'POS') bado_walk,
  sum(cs.still_owed * coalesce(pm.m,0)) filter (where src='POS') margin_pos_exact,
  sum(cs.still_owed) filter (where src<>'POS') * (select gm from gm_month) margin_walk_est
  from cs left join pos_margin pm using(sale_uid) where cs.issued_on between :'f' and :'t' group by 1)
select to_char(days.dt,'DD') d, round(coalesce(rev,0)) rev, round(coalesce(rev-cogs,0)) gp, round(coalesce(dexp.amt,0)) dexp,
  round((768833+74889)/30.0) accr_dep, round(coalesce(sloss.v,0)) stock,
  round(coalesce(rev-cogs,0) - coalesce(dexp.amt,0) - (768833+74889)/30.0 + coalesce(sloss.v,0)) net,
  round(coalesce(iss_pos,0)+coalesce(iss_walk,0)) issued, round(coalesce(coll,0)) coll,
  round(coalesce(bado_pos,0)+coalesce(bado_walk,0)) bado,
  round(coalesce(margin_pos_exact,0)+coalesce(margin_walk_est,0)) margin_bado,
  round(coalesce(rev-cogs,0) - coalesce(dexp.amt,0) - (768833+74889)/30.0 + coalesce(sloss.v,0) - coalesce(margin_pos_exact,0)-coalesce(margin_walk_est,0)) faida_kus
from days left join gp using(dt) left join dexp using(dt) left join dflow using(dt) left join bado using(dt) left join sloss using(dt)
order by days.dt;
-- ===== Q2 =====
set default_transaction_read_only=on;
set statement_timeout='60s';
\set f '2026-09-01'
\set t '2026-09-29'
with
days as (select d::date dt from generate_series(:'f'::date, :'t'::date, '1 day') d),
gp as (select s.sale_date::date dt, sum(d.sub_total) rev, sum(d.total_cost) cogs
       from sales_details d join sales s on s.uid=d.sale_uid
       where not d.is_deleted and not s.is_deleted and s.sale_source='STANDARD' and s.sale_date::date between :'f' and :'t' group by 1),
gm_month as (select (sum(rev)-sum(cogs))/sum(rev) gm from gp),
dexp as (select dr.reconciliation_date dt, sum(re.amount) amt from reconciliation_expenses re join daily_reconciliation dr on dr.uid=re.reconciliation_uid
         where not re.is_deleted and not dr.is_deleted and dr.reconciliation_date between :'f' and :'t' group by 1),
credit_sales as (
  select d.sale_uid, min(coalesce(d.reference_type,'POS')) src, max(d.amount) issued,
         min(coalesce(d.sale_date, s.sale_date::date)) issued_on
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
  join cs on cs.sale_uid=c.sale_uid and cs.src='POS' where not c.is_deleted and c.amount_collected>0
  union all
  select d.sale_uid, dp.paid_at::date, dp.amount_paid, dp.id
  from reconciliation_debt_payments dp join reconciliation_retail_debts d on d.uid=dp.debt_uid
  join cs on cs.sale_uid=d.sale_uid and cs.src='MANUAL_RETAIL' where not dp.is_deleted and not d.is_deleted and dp.amount_paid>0),
ev_capped as (
  select e.sale_uid, e.ev_date,
         least(e.amt, greatest(cs.collected_total - coalesce(sum(e.amt) over (partition by e.sale_uid order by e.ev_date, e.ord rows between unbounded preceding and 1 preceding),0),0)) amt
  from evidence e join cs using(sale_uid)),
debt_events as (
  select sale_uid, issued_on ev_date, 'ISSUE'::text kind, issued amt from cs
  union all select sale_uid, ev_date, 'COLLECT', amt from ev_capped where amt>0
  union all select cs.sale_uid, coalesce(cs.last_pay_date, cs.issued_on), 'COLLECT', cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0)
  from cs where cs.collected_total - coalesce((select sum(amt) from ev_capped e where e.sale_uid=cs.sale_uid),0) > 0
  union all select a.sale_uid, a.ev_date, 'ADJUST', a.amount from adj a join cs using(sale_uid)),
dflow as (select e.ev_date dt,
  sum(e.amt) filter (where kind='ISSUE' and cs.src='POS') iss_pos,
  sum(e.amt) filter (where kind='ISSUE' and cs.src<>'POS') iss_walk,
  sum(e.amt) filter (where kind='COLLECT') coll,
  sum(e.amt) filter (where kind='ADJUST') adj
  from debt_events e join cs using(sale_uid) where e.ev_date between :'f' and :'t' group by 1),
-- POS margin per sale from its own lines
pos_margin as (select d.sale_uid, (sum(d.sub_total)-sum(d.total_cost))/nullif(sum(d.sub_total),0) m from sales_details d where not d.is_deleted group by 1),
bado as (select cs.issued_on dt,
  sum(cs.still_owed) filter (where src='POS') bado_pos,
  sum(cs.still_owed) filter (where src<>'POS') bado_walk,
  sum(cs.still_owed * coalesce(pm.m,0)) filter (where src='POS') margin_pos_exact,
  sum(cs.still_owed) filter (where src<>'POS') * (select gm from gm_month) margin_walk_est
  from cs left join pos_margin pm using(sale_uid) where cs.issued_on between :'f' and :'t' group by 1)
select round(sum(rev)) rev, round(sum(rev-cogs)) gp, round(100*sum(rev-cogs)/sum(rev),2) gm_pct,
 (select round(sum(amt)) from dexp) dexp, round(768833*29/30.0) monthly_29, round(74889*29/30.0) dep_29,
 (select round(sum(coalesce(iss_pos,0))) from dflow) iss_pos, (select round(sum(coalesce(iss_walk,0))) from dflow) iss_walk,
 (select round(sum(coalesce(coll,0))) from dflow) coll, (select round(sum(coalesce(adj,0))) from dflow) adj,
 (select round(sum(coalesce(bado_pos,0)+coalesce(bado_walk,0))) from bado) bado, (select round(sum(bado_walk)) from bado) bado_walk,
 (select round(sum(coalesce(margin_pos_exact,0)+coalesce(margin_walk_est,0))) from bado) margin_bado,
 (select round(sum(amt) filter (where kind='ISSUE') - sum(amt) filter (where kind<>'ISSUE')) from debt_events where ev_date < :'f') ar_open,
 (select round(sum(amt) filter (where kind='ISSUE') - sum(amt) filter (where kind<>'ISSUE')) from debt_events where ev_date <= :'t') ar_close,
 (select round(sum(still_owed)) from cs) ar_now
from gp;