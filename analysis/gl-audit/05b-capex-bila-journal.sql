-- 05b: capex APPROVED bila journal: ni mirror za purchase (zinapostiwa kupitia purchase) au pengo? Read-only.
SET default_transaction_read_only = on;
-- PRODUCT_CAPITAL: purchase yake ina journal hai?
SELECT c.capital_type,
       count(*) idadi, sum(c.amount) tzs,
       count(*) FILTER (WHERE c.purchase_uid IS NULL) bila_purchase_uid,
       count(*) FILTER (WHERE c.purchase_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.purchase_uid AND NOT j.is_reversal)) purchase_bila_journal,
       sum(c.amount) FILTER (WHERE c.purchase_uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.purchase_uid AND NOT j.is_reversal)) tzs_purchase_bila_journal,
       count(*) FILTER (WHERE p.status <> 'APPROVED') purchase_si_approved
FROM capital_expenditure c LEFT JOIN purchases p ON p.uid=c.purchase_uid
WHERE c.status='APPROVED' AND NOT coalesce(c.is_deleted,false) AND c.capital_type IN ('PRODUCT_CAPITAL','INVENTORY_CAPITAL')
GROUP BY 1;
-- mirror dhidi ya purchase: kiasi kinalingana?
SELECT count(*) FILTER (WHERE abs(c.amount - j.total_debit) >= 1) kiasi_tofauti, sum(c.amount - j.total_debit) FILTER (WHERE abs(c.amount - j.total_debit) >= 1) tofauti_tzs
FROM capital_expenditure c JOIN journal_entry j ON j.reference_uid=c.purchase_uid AND NOT j.is_reversal AND j.reference_type='PURCHASE_INVENTORY'
WHERE c.status='APPROVED' AND NOT coalesce(c.is_deleted,false) AND c.capital_type='PRODUCT_CAPITAL';
-- zisizo PRODUCT_CAPITAL bila journal
SELECT c.reference_number, c.capital_type, c.expenditure_type, c.amount, c.transaction_date, c.approval_date, c.approved_by,
       c.parent_capital_expenditure_uid IS NOT NULL ni_mtoto, c.purchase_uid, left(c.description,60) maelezo,
       (SELECT string_agg(j.reference_type||'@'||j.entry_date||(CASE WHEN j.is_reversal THEN '(rev)' ELSE '' END), ',') FROM journal_entry j WHERE j.reference_uid=c.uid) journals_zote
FROM capital_expenditure c
WHERE c.status='APPROVED' AND NOT coalesce(c.is_deleted,false) AND c.capital_type NOT IN ('PRODUCT_CAPITAL')
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.uid AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
ORDER BY c.transaction_date;
-- OPERATIONAL MONTHLY_EXPENSE zote (mishahara/kodi): tarehe na journal
SELECT c.reference_number, c.amount, c.transaction_date::date, c.allocated_year, c.allocated_month, c.status, left(c.description,40) maelezo,
       (SELECT string_agg(j.reference_type||'@'||j.entry_date||(CASE WHEN j.is_reversal THEN '(rev)' ELSE '' END)||' '||j.created_at::date, ', ') FROM journal_entry j WHERE j.reference_uid=c.uid) journals
FROM capital_expenditure c WHERE c.expenditure_type='MONTHLY_EXPENSE' AND NOT coalesce(c.is_deleted,false)
ORDER BY c.transaction_date;
-- Rejista ya mali (asset_item) dhidi ya capex na GL
SELECT a.name, a.approved_qty, a.unit_value, c.amount capex_amount, c.reference_number,
       (SELECT sum(l.debit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
         WHERE j.reference_uid=c.uid AND NOT j.is_reversal AND l.account_code LIKE '15%') gl_asset
FROM asset_item a LEFT JOIN capital_expenditure c ON c.uid=a.capital_expenditure_uid;
