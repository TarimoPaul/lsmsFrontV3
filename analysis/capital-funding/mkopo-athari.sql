-- mkopo-athari.sql — KUSOMA TU. DB: lsms_audit_20261015_0200 (dump ya usiku 15/10 02:00, Flyway 133).
-- Endesha: PGOPTIONS="-c default_transaction_read_only=on" psql -d lsms_audit_20261015_0200 -f mkopo-athari.sql
set default_transaction_read_only = on;
set statement_timeout = '120s';

-- ===== M1. Rekodi za mikopo (capital_injections) =====
select id, transaction_date::date tarehe, created_at::timestamp(0) iliundwa, created_by, injection_type, source_type,
       payment_method, amount, principal_amount, interest_amount, related_loan_uid, left(reason, 70) sababu
from capital_injections where source_type in ('LOAN', 'LOAN_REPAYMENT') order by transaction_date;

-- ===== M2. Journals za GL za mikopo + kila mstari wa 2100 / 6600 =====
select j.entry_date, j.created_at::timestamp(0) iliandikwa, j.entry_number, j.reference_type, j.is_reversal,
       l.account_code, l.debit_amount, l.credit_amount
from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
where not j.is_deleted and (j.reference_type like 'LOAN%' or l.account_code in ('2100', '6600'))
order by j.created_at, j.id, l.account_code;

-- ===== M3. Salio la GL: 1021 NMB, 2100 Mikopo, 6600 Riba =====
select l.account_code, sum(l.debit_amount - l.credit_amount) dr_minus_cr
from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
where not j.is_deleted and l.account_code in ('1021', '2100', '6600') group by 1 order by 1;

-- ===== M4. Malipo ya Mkopo A popote tangu 04/10 (capital_injections, capex, reco, safe box, GL) =====
select 'capital_injections' chanzo, transaction_date::date, amount, left(reason, 60) maelezo from capital_injections
 where source_type = 'LOAN_REPAYMENT' and transaction_date >= '2026-10-04'
union all
select 'capital_expenditure', transaction_date::date, amount, left(description, 60) from capital_expenditure
 where not is_deleted and transaction_date >= '2026-10-04'
   and (description ~* '(mkopo|riba|loan|interest|rejesho)' or notes ~* '(mkopo|riba|loan|interest|rejesho)'
        or coalesce(loan_principal_amount, 0) + coalesce(loan_interest_amount, 0) > 0)
union all
select 'reconciliation_expenses', r.reconciliation_date, e.amount, left(e.description, 60)
 from reconciliation_expenses e join daily_reconciliation r on r.uid = e.reconciliation_uid
 where r.reconciliation_date >= '2026-10-04' and (e.description ~* '(mkopo|riba|loan|rejesho)' or e.notes ~* '(mkopo|riba|loan|rejesho)')
union all
select 'gl_2100_6600', j.entry_date, l.debit_amount, j.reference_type from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
 where not j.is_deleted and j.entry_date >= '2026-10-04' and l.account_code in ('2100', '6600') and l.debit_amount > 0 and j.reference_type <> 'LOAN_RECEIVED';

-- ===== M5. Msingi kwa siku 01/08–14/10: mauzo, faida ghafi, stockouts za fast-movers =====
-- Fast-movers = top 20 kwa vipande 01/08–25/09 (kabla ya mikopo, ili mkopo usibadilishe orodha).
-- Stockout ya siku = salio la mwisho wa siku (store.stock_after, likibebwa mbele) <= 0, au count ya siku hiyo = 0.
with win as (select '2026-08-01'::date d0, '2026-10-14'::date d1),
days as (select g::date dt from win, generate_series(win.d0, win.d1, '1 day') g),
gp as (select s.sale_date::date dt, sum(d.sub_total) rev, sum(d.total_cost) cogs, count(distinct s.uid) risiti
       from sales_details d join sales s on s.uid = d.sale_uid, win
       where not d.is_deleted and not s.is_deleted and s.sale_source = 'STANDARD' and s.sale_date::date between win.d0 and win.d1
       group by 1),
top20 as (select d.product_uid from sales_details d join sales s on s.uid = d.sale_uid
          where not d.is_deleted and not s.is_deleted and s.sale_source = 'STANDARD'
            and s.sale_date::date between '2026-08-01' and '2026-09-25'
          group by 1 order by sum(d.piece_quantity) desc limit 20),
mv as (select m.products_uid pu, m.movement_date::date dt, m.stock_after,
              row_number() over (partition by m.products_uid, m.movement_date::date order by m.movement_date desc, m.id desc) rn
       from store m join top20 t on t.product_uid = m.products_uid, win
       where not m.is_deleted and m.movement_date::date <= win.d1),
eod_known as (select pu, dt, stock_after eod from mv where rn = 1),
grid as (select t.product_uid pu, d.dt from top20 t, days d),
filled as (select g.pu, g.dt,
                  (select e.eod from eod_known e where e.pu = g.pu and e.dt <= g.dt order by e.dt desc limit 1) eod
           from grid g),
counted_zero as (select distinct cl.product_uid pu, cs.session_date dt from counting_line cl join counting_session cs on cs.uid = cl.session_uid
                 where not cl.is_deleted and not cs.is_deleted and coalesce(cl.recount_qty, cl.counted_qty) = 0),
so as (select f.dt, count(*) filter (where coalesce(f.eod, 0) <= 0
                                     or exists (select 1 from counted_zero z where z.pu = f.pu and z.dt = f.dt)) stockouts
       from filled f group by 1)
select d.dt, to_char(d.dt, 'Dy') siku, coalesce(gp.risiti, 0) risiti, round(coalesce(gp.rev, 0)) mauzo,
       round(coalesce(gp.rev - gp.cogs, 0)) faida_ghafi,
       round(100 * (gp.rev - gp.cogs) / nullif(gp.rev, 0), 2) gm_pct, so.stockouts
from days d left join gp using (dt) left join so using (dt) order by d.dt;

-- ===== M6. Wastani: Ago–Sep (01/08–25/09) dhidi ya 26/09–14/10, na 04/10–14/10 =====
with gp as (select s.sale_date::date dt, sum(d.sub_total) rev, sum(d.total_cost) cogs
            from sales_details d join sales s on s.uid = d.sale_uid
            where not d.is_deleted and not s.is_deleted and s.sale_source = 'STANDARD'
              and s.sale_date::date between '2026-08-01' and '2026-10-14' group by 1),
p as (select dt, rev, cogs, case when dt <= '2026-09-25' then '1 Ago-Sep (01/08-25/09)'
                                 when dt <= '2026-10-03' then '2 B tu (26/09-03/10)'
                                 else '3 A+B (04/10-14/10)' end kipindi from gp)
select kipindi, count(*) siku, round(avg(rev)) mauzo_kwa_siku, round(avg(rev - cogs)) faida_ghafi_kwa_siku,
       round(100 * sum(rev - cogs) / sum(rev), 2) gm_pct
from p group by 1
union all
select '4 26/09-14/10 (zote)', count(*), round(avg(rev)), round(avg(rev - cogs)), round(100 * sum(rev - cogs) / sum(rev), 2)
from gp where dt >= '2026-09-26' order by 1;

-- ===== M7. Gharama za uendeshaji kwa siku (kwa margin halisi) =====
-- reco (dated by recon day) + monthly rows (allocated_month>0, kwa mwezi wake ÷ siku za mwezi) + all-year rows (allocated_month=0: kiasi tayari ni cha MWEZI)
with dexp as (select r.reconciliation_date dt, sum(e.amount) amt from reconciliation_expenses e
              join daily_reconciliation r on r.uid = e.reconciliation_uid
              where not e.is_deleted and not r.is_deleted and r.reconciliation_date between '2026-08-01' and '2026-10-14' group by 1),
mon as (select allocated_year y, allocated_month m, sum(amount) amt from capital_expenditure
        where not is_deleted and is_approved and expenditure_type = 'MONTHLY_EXPENSE' and allocated_year = 2026 group by 1, 2)
select to_char(dt, 'YYYY-MM') mwezi, count(*) siku_zenye_reco, round(sum(amt)) reco_jumla, round(avg(amt)) reco_kwa_siku,
       (select round(coalesce(sum(amt), 0)) from mon where m = extract(month from min(dt))) mwezi_rows,
       (select round(coalesce(sum(amt), 0)) from mon where m = 0) mwaka_rows_kwa_mwezi
from dexp group by 1 order by 1;

-- ===== M8. Je, pesa ya mkopo iliingia kwenye mzigo? Manunuzi kwa siku na salio la GL 1200 (Inventory) =====
with pu as (select purchase_date::date dt, sum(total_amount) amt from purchases
            where not is_deleted and status <> 'CANCELLED' and purchase_date::date between '2026-08-01' and '2026-10-14' group by 1)
select case when dt <= '2026-09-25' then '1 01/08-25/09' when dt <= '2026-10-03' then '2 26/09-03/10' else '3 04/10-14/10' end kipindi,
       count(*) siku_zenye_manunuzi, round(sum(amt) / (max(dt) - min(dt) + 1)) manunuzi_kwa_siku_ya_kalenda
from pu group by 1 order by 1;
select d::date tarehe, (select round(sum(l.debit_amount - l.credit_amount)) from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
                        where not j.is_deleted and l.account_code = '1200' and j.entry_date <= d::date) gl_1200_inventory
from unnest(array['2026-08-31', '2026-09-25', '2026-10-03', '2026-10-14']::date[]) d;

-- ===== M9 (19/10, M-2). Mkopo B "ulienda moja kwa moja kwenye mzigo": manunuzi 26/09–05/10 dhidi ya kawaida =====
-- Msingi: (a) wastani wa kalenda 01/08–25/09; (b) kipindi kilekile cha mwezi uliopita 26/08–05/09 (kilele 24–29).
with pu as (select purchase_date::date dt, sum(total_amount) amt, count(*) n from purchases
            where not is_deleted and status <> 'CANCELLED' and purchase_date::date between '2026-08-01' and '2026-10-14' group by 1),
days as (select g::date dt from generate_series('2026-08-01'::date, '2026-10-14', '1 day') g),
d as (select days.dt, coalesce(pu.amt, 0) amt, coalesce(pu.n, 0) n from days left join pu using (dt)),
base as (select avg(amt) filter (where dt between '2026-08-01' and '2026-09-25') a_kawaida,
                avg(amt) filter (where dt between '2026-08-26' and '2026-09-05') a_mwezi_uliopita from d)
select w.kipindi, w.d0, w.d1, (w.d1 - w.d0 + 1) siku, round(sum(d.amt)) manunuzi, sum(d.n) mistari,
       round(sum(d.amt) - (w.d1 - w.d0 + 1) * b.a_kawaida) ziada_dhidi_ya_kawaida,
       round(sum(d.amt) - (w.d1 - w.d0 + 1) * b.a_mwezi_uliopita) ziada_dhidi_ya_mwezi_uliopita
from (values ('B tu', '2026-09-26'::date, '2026-10-03'::date), ('B + siku 2 za A', '2026-09-26', '2026-10-05'),
             ('mwezi uliopita (rejea)', '2026-08-26', '2026-09-05')) w(kipindi, d0, d1)
join d on d.dt between w.d0 and w.d1, base b group by w.kipindi, w.d0, w.d1, b.a_kawaida, b.a_mwezi_uliopita order by w.d0 desc, w.d1;

-- Manunuzi kwa siku 24/09–05/10, na yalipostiwa wapi kwenye GL (Cr ya journal za PURCHASE_*)
with pu as (select purchase_date::date dt, round(sum(total_amount)) manunuzi, count(*) n,
                   count(*) filter (where coalesce(supplier_name, '') = '') bila_msambazaji
            from purchases where not is_deleted and status <> 'CANCELLED'
              and purchase_date::date between '2026-09-24' and '2026-10-05' group by 1),
gl as (select j.entry_date dt, l.account_code, round(sum(l.credit_amount)) cr from journal_entry j
       join journal_entry_line l on l.journal_entry_uid = j.uid
       where not j.is_deleted and j.reference_type like 'PURCHASE%' and l.credit_amount > 0
         and j.entry_date between '2026-09-24' and '2026-10-05' group by 1, 2),
rp as (select r.reconciliation_date dt, round(sum(p.amount)) reco_purchases from reconciliation_purchases p
       join daily_reconciliation r on r.uid = p.reconciliation_uid
       where not coalesce(p.is_deleted, false) and r.reconciliation_date between '2026-09-24' and '2026-10-05' group by 1)
select pu.dt, to_char(pu.dt, 'Dy') siku, pu.manunuzi, pu.n mistari, pu.bila_msambazaji,
       (select string_agg(account_code || '=' || cr, ' ' order by account_code) from gl where gl.dt = pu.dt) gl_cr,
       rp.reco_purchases
from pu left join rp using (dt) order by pu.dt;
