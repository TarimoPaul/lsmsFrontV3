-- m7-malipo-wasambazaji.sql — KUSOMA TU. DB: lsms_audit_20261015_0200 (dump ya usiku 15/10 02:00).
-- M-7: malipo 7 ya wasambazaji ya 04/10 (CASH, 6,751,443) ni kufuta madeni yaliyolipwa zamani (mmiliki atathibitisha).
set default_transaction_read_only = on;
set statement_timeout = '120s';

-- ===== S1. Journals 7 za PURCHASE_PAYMENT za 04/10 (na hali yake: hai / imegeuzwa) =====
with j7 as (select j.* from journal_entry j where not j.is_deleted and not j.is_reversal
            and j.reference_type = 'PURCHASE_PAYMENT' and j.entry_date = '2026-10-04')
select j.uid journal_uid, j.entry_number, j.reference_uid supplier_payment_uid, s.name msambazaji, sp.amount,
       sp.payment_method, sp.payment_date::timestamp(0), sp.paid_by_name,
       exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted) imegeuzwa
from j7 j join supplier_payments sp on sp.uid = j.reference_uid left join suppliers s on s.uid = sp.supplier_uid
order by sp.amount desc;

-- ===== S2. Athari kwa salio la 1000 na 2000: kabla na baada ya kuhamisha journals 7 kutoka 04/10 kwenda 30/09 =====
-- "Baada" ni hesabu tu: kwenye 30/09 inaongeza mistari 7 (kana kwamba imepostiwa 30/09); kwenye 31/10 hakuna
-- mabadiliko (reversal ya 04/10 + repost ya 30/09 zote ziko kabla ya 31/10). Data inaishia 14/10.
with moved as (select l.account_code, sum(l.debit_amount - l.credit_amount) dr_cr
               from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
               where not j.is_deleted and not j.is_reversal and j.reference_type = 'PURCHASE_PAYMENT' and j.entry_date = '2026-10-04'
                 and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted)
               group by 1),
bal as (select a.code, d.asof,
               (select coalesce(sum(l.debit_amount - l.credit_amount), 0) from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
                where not j.is_deleted and l.account_code = a.code and j.entry_date <= d.asof) dr_cr
        from (values ('1000'), ('2000')) a(code), (values ('2026-09-30'::date), ('2026-10-03'::date), ('2026-10-31'::date)) d(asof))
select b.code akaunti, b.asof tarehe, round(b.dr_cr, 2) kabla_dr_minus_cr,
       round(b.dr_cr + case when b.asof between '2026-09-30' and '2026-10-03' then coalesce(m.dr_cr, 0) else 0 end, 2) baada_dr_minus_cr,
       round(case when b.asof between '2026-09-30' and '2026-10-03' then coalesce(m.dr_cr, 0) else 0 end, 2) tofauti
from bal b left join moved m on m.account_code = b.code order by 1, 2;

-- ===== S3. Kipindi cha Septemba bado kiko wazi? (hatua lazima iendeshwe KABLA ya kufunga) =====
select coalesce((select status from gl_period where period_year = 2026 and period_month = 9 and branch_uid is null), 'HAKUNA SAFU (= OPEN)') septemba;

-- ===== S4. Supplier payments nyingine za CASH zenye payment_date mbali (> siku 30) na purchase_date =====
-- purchase_date: purchase iliyounganishwa (purchase_uid); isipo, purchase ya MWISHO ya msambazaji huyo kabla ya malipo
-- (kwa jina au supplier_uid). "siku" = payment_date − purchase_date hiyo. Pia: idadi ya malipo ya msambazaji siku hiyo.
with sp as (select sp.*, s.name sname from supplier_payments sp left join suppliers s on s.uid = sp.supplier_uid
            where not coalesce(sp.is_deleted, false) and upper(coalesce(sp.payment_method, 'CASH')) = 'CASH' and sp.amount > 0),
x as (select sp.uid, sp.sname, sp.amount, sp.payment_date, sp.paid_by_name, sp.created_at,
             coalesce((select p.purchase_date from purchases p where p.uid = sp.purchase_uid),
                      (select max(p.purchase_date) from purchases p
                       where not p.is_deleted and p.status <> 'CANCELLED' and p.purchase_date <= sp.payment_date
                         and (lower(p.supplier_name) = lower(sp.sname)))) ref_purchase_date,
             sp.purchase_uid is not null linked
      from sp)
select x.payment_date::date tarehe_ya_malipo, x.created_at::timestamp(0) iliandikwa, x.paid_by_name, x.sname msambazaji,
       x.amount, x.ref_purchase_date::date purchase_ya_rejea, x.linked imeunganishwa,
       (x.payment_date::date - x.ref_purchase_date::date) siku,
       x.payment_date::date = '2026-10-04' ni_ya_04_10
from x where x.ref_purchase_date is null or (x.payment_date::date - x.ref_purchase_date::date) > 30
order by x.amount desc;

-- ===== S5. Muhtasari wa S4 =====
with sp as (select sp.*, s.name sname from supplier_payments sp left join suppliers s on s.uid = sp.supplier_uid
            where not coalesce(sp.is_deleted, false) and upper(coalesce(sp.payment_method, 'CASH')) = 'CASH' and sp.amount > 0),
x as (select sp.amount, sp.payment_date,
             coalesce((select p.purchase_date from purchases p where p.uid = sp.purchase_uid),
                      (select max(p.purchase_date) from purchases p
                       where not p.is_deleted and p.status <> 'CANCELLED' and p.purchase_date <= sp.payment_date
                         and lower(p.supplier_name) = lower(sp.sname))) d
      from sp)
select case when d is null then 'hakuna purchase ya rejea' when payment_date::date - d::date > 30 then '> siku 30'
            else '<= siku 30' end kundi,
       count(*) malipo, round(sum(amount), 2) jumla,
       count(*) filter (where payment_date::date = '2026-10-04') ya_04_10, round(sum(amount) filter (where payment_date::date = '2026-10-04'), 2) jumla_04_10
from x group by 1 order by 1;

-- ===== S6. FIFO: kila malipo ya msambazaji yanalipa madeni yapi (purchases zilizopostiwa Cr 2000), na yana umri gani =====
-- Kipimo bora kuliko S4: deni la zamani zaidi la msambazaji (jina, herufi ndogo) linalipwa kwanza.
-- umri = payment_date − purchase_date ya deni lililolipwa. "zamani" = sehemu ya malipo inayolipa deni lenye umri > siku 30.
with cr as (select lower(trim(p.supplier_name)) sup, j.entry_date d, j.reference_uid uid, sum(l.credit_amount) amt
            from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
            join purchases p on p.uid = j.reference_uid
            where not j.is_deleted and not j.is_reversal and l.account_code = '2000' and l.credit_amount > 0
              and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted)
            group by 1, 2, 3),
crc as (select *, sum(amt) over (partition by sup order by d, uid) - amt c0, sum(amt) over (partition by sup order by d, uid) c1 from cr),
pay as (select lower(trim(s.name)) sup, sp.uid, sp.payment_date::date d, sp.amount amt, upper(coalesce(sp.payment_method, 'CASH')) m,
               sp.paid_by_name, sp.created_at
        from supplier_payments sp left join suppliers s on s.uid = sp.supplier_uid
        where not coalesce(sp.is_deleted, false) and sp.amount > 0),
payc as (select *, sum(amt) over (partition by sup order by d, created_at, uid) - amt p0, sum(amt) over (partition by sup order by d, created_at, uid) p1 from pay),
m as (select pc.uid, pc.sup, pc.d pay_d, pc.amt, pc.m, pc.paid_by_name, c.d cr_d,
             greatest(0, least(pc.p1, c.c1) - greatest(pc.p0, c.c0)) matched
      from payc pc join crc c on c.sup = pc.sup and c.c0 < pc.p1 and c.c1 > pc.p0)
select pay_d tarehe_ya_malipo, sup msambazaji, m njia, paid_by_name, round(amt, 2) malipo,
       min(cr_d) deni_la_zamani_zaidi, max(cr_d) deni_la_karibuni,
       round(sum(matched * (pay_d - cr_d)) / nullif(sum(matched), 0)) umri_wastani_siku,
       round(sum(matched) filter (where pay_d - cr_d > 30), 2) sehemu_ya_deni_zaidi_ya_siku_30
from m group by uid, pay_d, sup, m, paid_by_name, amt
having max(pay_d - cr_d) > 30
order by sehemu_ya_deni_zaidi_ya_siku_30 desc nulls last;

-- ===== S7 (19/10). Madeni yaliyo wazi LEO kwenye 2000, kwa purchase (FIFO kwa msambazaji) =====
-- Madeni = journals hai za purchase zenye Cr 2000; malipo = journals hai zenye Dr 2000 (PURCHASE_PAYMENT na nyingine).
-- Malipo ya msambazaji yanalipa deni lake la zamani zaidi kwanza; kinachobaki ni deni lililo wazi.
with live as (select j.* from journal_entry j where not j.is_deleted and not j.is_reversal
              and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted)),
cr as (select lower(trim(p.supplier_name)) sup, p.uid purchase_uid, p.purchase_date::date d, p.supplier_name, l.credit_amount amt
       from live j join journal_entry_line l on l.journal_entry_uid = j.uid join purchases p on p.uid = j.reference_uid
       where l.account_code = '2000' and l.credit_amount > 0),
dr as (select lower(trim(coalesce(s.name, '?'))) sup, sum(l.debit_amount) amt
       from live j join journal_entry_line l on l.journal_entry_uid = j.uid
       left join supplier_payments sp on sp.uid = j.reference_uid left join suppliers s on s.uid = sp.supplier_uid
       where l.account_code = '2000' and l.debit_amount > 0 group by 1),
crc as (select cr.*, sum(amt) over (partition by sup order by d, purchase_uid) c1 from cr),
open as (select c.*, least(c.amt, greatest(0, c.c1 - coalesce(dr.amt, 0))) wazi
         from crc c left join dr on dr.sup = c.sup)
select o.supplier_name msambazaji, o.d purchase_date, (date '2026-10-14' - o.d) siku_hadi_14_10, round(o.amt, 2) deni_la_purchase,
       round(o.wazi, 2) bado_wazi, p.payment_status sub_ledger_status, round(p.total_amount - coalesce(p.amount_paid, 0), 2) sub_ledger_bado,
       o.purchase_uid
from open o join purchases p on p.uid = o.purchase_uid where o.wazi > 0.005 order by o.d, o.supplier_name;

-- ===== S8. Ukaguzi wa S7: jumla ya madeni wazi = salio la GL 2000? Na wasambazaji waliolipwa zaidi (malipo > madeni) =====
with live as (select j.* from journal_entry j where not j.is_deleted and not j.is_reversal
              and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted)),
cr as (select lower(trim(p.supplier_name)) sup, sum(l.credit_amount) amt from live j join journal_entry_line l on l.journal_entry_uid = j.uid
       join purchases p on p.uid = j.reference_uid where l.account_code = '2000' and l.credit_amount > 0 group by 1),
dr as (select lower(trim(coalesce(s.name, '?'))) sup, sum(l.debit_amount) amt from live j join journal_entry_line l on l.journal_entry_uid = j.uid
       left join supplier_payments sp on sp.uid = j.reference_uid left join suppliers s on s.uid = sp.supplier_uid
       where l.account_code = '2000' and l.debit_amount > 0 group by 1)
select coalesce(cr.sup, dr.sup) msambazaji, round(coalesce(cr.amt, 0), 2) madeni, round(coalesce(dr.amt, 0), 2) malipo,
       round(coalesce(cr.amt, 0) - coalesce(dr.amt, 0), 2) salio,
       (select round(sum(credit_amount - debit_amount), 2) from journal_entry_line l join journal_entry j on j.uid = l.journal_entry_uid
        where not j.is_deleted and l.account_code = '2000') gl_2000_jumla
from cr full join dr on dr.sup = cr.sup order by 4 desc;

-- ===== S9. Sub-ledger: purchases zenye payment_status isiyo PAID (deni kwa mujibu wa jedwali la purchases) =====
select p.supplier_name, p.purchase_date::date, p.payment_status, round(p.total_amount, 2) total, round(coalesce(p.amount_paid, 0), 2) paid,
       round(p.total_amount - coalesce(p.amount_paid, 0), 2) bado, (date '2026-10-14' - p.purchase_date::date) siku
from purchases p where not p.is_deleted and p.status <> 'CANCELLED' and coalesce(p.payment_status, 'UNPAID') <> 'PAID'
  and p.total_amount - coalesce(p.amount_paid, 0) > 0.005
order by p.purchase_date;

-- ===== S10. Kwa nini sub-ledger (S9) ina madeni wakati GL 2000 = 0? Kila purchase isiyo PAID: ilipostiwa wapi kwenye GL =====
with np as (select p.* from purchases p where not p.is_deleted and p.status <> 'CANCELLED'
            and coalesce(p.payment_status, 'UNPAID') <> 'PAID' and p.total_amount - coalesce(p.amount_paid, 0) > 0.005),
g as (select j.reference_uid, sum(l.credit_amount) filter (where l.account_code = '2000') cr2000,
             sum(l.credit_amount) filter (where l.account_code = '1000') cr1000
      from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
      where not j.is_deleted and not j.is_reversal and j.reference_type = 'PURCHASE_INVENTORY'
        and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted) group by 1)
select case when (date '2026-10-14' - np.purchase_date::date) > 30 then '> siku 30' else '<= siku 30' end umri,
       np.payment_status, (np.supplier_uid is null or np.supplier_uid = '') bila_supplier_uid,
       case when g.cr2000 > 0 then 'GL: deni (Cr 2000)' when g.cr1000 > 0 then 'GL: cash (Cr 1000)' else 'GL: hakuna journal' end gl,
       count(*) purchases, round(sum(np.total_amount - coalesce(np.amount_paid, 0)), 2) bado_kwa_sub_ledger
from np left join g on g.reference_uid = np.uid group by 1, 2, 3, 4 order by 1 desc, 2, 3, 4;

-- ===== S11. ORODHA kwa mmiliki: madeni ya sub-ledger yenye umri > siku 30 (kwa msambazaji) =====
with np as (select p.*, lower(trim(p.supplier_name)) sup from purchases p where not p.is_deleted and p.status <> 'CANCELLED'
            and coalesce(p.payment_status, 'UNPAID') <> 'PAID' and p.total_amount - coalesce(p.amount_paid, 0) > 0.005
            and (date '2026-10-14' - p.purchase_date::date) > 30),
g as (select j.reference_uid, sum(l.credit_amount) filter (where l.account_code = '2000') cr2000
      from journal_entry j join journal_entry_line l on l.journal_entry_uid = j.uid
      where not j.is_deleted and not j.is_reversal and j.reference_type = 'PURCHASE_INVENTORY'
        and not exists (select 1 from journal_entry r where r.reversed_entry_uid = j.uid and not r.is_deleted) group by 1)
select np.sup msambazaji, min(np.purchase_date)::date kuanzia, max(np.purchase_date)::date hadi,
       min(date '2026-10-14' - np.purchase_date::date) siku_min, max(date '2026-10-14' - np.purchase_date::date) siku_max,
       count(*) purchases, string_agg(distinct np.payment_status, ',') status,
       round(sum(np.total_amount - coalesce(np.amount_paid, 0)), 2) bado_kwa_sub_ledger,
       round(sum(coalesce(g.cr2000, 0)), 2) iliandikwa_deni_gl
from np left join g on g.reference_uid = np.uid group by 1 order by 8 desc;
