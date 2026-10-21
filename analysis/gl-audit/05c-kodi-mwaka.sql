-- 05c: Gharama za "mwaka mzima" (kodi ya frame, TRA): capex zote zinazohusiana na GL. Read-only.
SET default_transaction_read_only = on;
SELECT c.reference_number, c.status, c.amount, c.transaction_date::date, c.allocated_month, c.expenditure_frequency, c.is_recurring,
       c.recurring_active, c.parent_capital_expenditure_uid IS NOT NULL ni_mtoto, c.monthly_allocation_amount, c.is_deleted,
       left(c.description,70) maelezo, left(c.notes,80) notes,
       (SELECT string_agg(j.reference_type||'@'||j.entry_date||' '||j.total_debit, ', ') FROM journal_entry j WHERE j.reference_uid=c.uid) journals
FROM capital_expenditure c
WHERE c.description ILIKE '%kodi%' OR c.description ILIKE '%mwaka%' OR c.description LIKE '2400000%'
   OR c.parent_capital_expenditure_uid IN (SELECT uid FROM capital_expenditure WHERE description ILIKE '%kodi%' OR description LIKE '2400000%')
ORDER BY c.transaction_date;
SELECT status, count(*) FROM purchases GROUP BY 1;
