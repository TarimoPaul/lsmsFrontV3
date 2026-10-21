-- Pesa inayotoka droo kupitia reco, na safe box inakopeleka
select entry_type, coalesce(upper(bank_name),'-') bank, count(*), round(sum(amount)) from reconciliation_cash_entries
where not is_deleted and entry_type in ('BANK_DEPOSIT','SAFE_BOX','PETTY_CASH') group by 1,2 order by 1,4 desc;
select c.entry_type, d.deposit_type, d.status, coalesce(upper(d.bank_name),'-') bank, count(*), round(sum(d.submitted_amount))
from safe_box_deposits d left join reconciliation_cash_entries c on c.uid=d.cash_entry_uid where not d.is_deleted group by 1,2,3,4 order by 1,2,3;
select date_trunc('month',r.reconciliation_date)::date m, count(p.id) reco_purch, count(p.purchase_uid) zimeunganishwa, round(sum(p.amount)) kiasi
from daily_reconciliation r left join reconciliation_purchases p on p.reconciliation_uid=r.uid and not p.is_deleted where not r.is_deleted group by 1 order by 1;
-- Njia za malipo ya POS tangu GL live
select payment_method, count(*), round(sum(amount_paid)) from payments where created_at>='2026-09-30' group by 1;
