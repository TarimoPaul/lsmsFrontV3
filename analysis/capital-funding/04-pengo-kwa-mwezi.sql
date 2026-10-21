-- Pengo: pesa iliyotoka droo (benki+safe box+mobile, reco isiyo DRAFT) + mkopo/mtaji − (purchases/supplier payments zilizolipwa kwa 10xx − reco purchases) − (gharama/mali − reco expenses) − kulipa mkopo
with r as (select date_trunc('month',reconciliation_date)::date m, sum(bank_deposits_total) bank, sum(safe_box_total) safe, sum(mobile_money_total) mobile,
             sum(purchases_total) rp, sum(expenses_total) rx, count(distinct reconciliation_date) siku
           from daily_reconciliation where not is_deleted and status<>'DRAFT' and reconciliation_date between '2026-06-01' and '2026-10-13' group by 1),
gl as (select date_trunc('month',e.entry_date)::date m,
   sum(l.credit_amount) filter (where e.reference_type in ('PURCHASE_INVENTORY','PURCHASE_PAYMENT')) purch_paid,
   sum(l.credit_amount) filter (where e.reference_type in ('EXPENSE_DIRECT','EXPENSE_RECURRING','ASSET_PURCHASE')) exp_paid,
   sum(l.credit_amount) filter (where e.reference_type='LOAN_REPAYMENT') loan_rep,
   sum(l.debit_amount) filter (where e.reference_type in ('LOAN_RECEIVED','CAPITAL_INJECTION')) funds_in
   from journal_entry e join journal_entry_line l on l.journal_entry_uid=e.uid
   where not e.is_deleted and l.account_code like '10%' and e.entry_date between '2026-06-01' and '2026-10-13' group by 1)
select m, siku, round(bank) benki, round(safe) safe_box, round(mobile) mobile, round(coalesce(funds_in,0)) mkopo,
  round(bank+safe+mobile+coalesce(funds_in,0)) jumla_nje,
  round(purch_paid-rp) purch_nje, round(coalesce(exp_paid,0)-rx) gharama_mali_nje, round(coalesce(loan_rep,0)) lipa_mkopo,
  round(bank+safe+mobile+coalesce(funds_in,0)-(purch_paid-rp)-(coalesce(exp_paid,0)-rx)-coalesce(loan_rep,0)) pengo
from r join gl using(m) order by 1;
