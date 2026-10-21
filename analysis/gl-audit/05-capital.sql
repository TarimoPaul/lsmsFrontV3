-- 05: CAPITAL. capex APPROVED bila journal, approvedBy, mkopo->mtaji. Read-only.
SET default_transaction_read_only = on;

-- 5.1 capex APPROVED kwa aina, na kama zina journal hai (reference_uid = capex.uid)
WITH c AS (
  SELECT c.*, EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.uid AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid)) has_j
  FROM capital_expenditure c WHERE c.status='APPROVED' AND NOT coalesce(c.is_deleted,false))
SELECT capital_type, coalesce(expenditure_type,'-') expenditure_type, count(*) idadi, sum(amount) tzs,
       count(*) FILTER (WHERE NOT has_j) bila_journal, sum(amount) FILTER (WHERE NOT has_j) tzs_bila_journal,
       count(*) FILTER (WHERE NOT has_j AND transaction_date > '2026-10-14') bila_journal_za_baadaye
FROM c GROUP BY 1,2 ORDER BY tzs_bila_journal DESC NULLS LAST, 1;

-- 5.2 capex APPROVED bila journal, tarehe <= 2026-10-14, sio za mfumo (LIMIT 40)
SELECT c.reference_number, c.capital_type, c.expenditure_type, c.source, c.amount, c.transaction_date::date, c.approval_date,
       c.approved_by, c.is_asset, c.is_from_product_capital, c.purchase_uid IS NOT NULL ina_purchase, left(c.description,50) maelezo
FROM capital_expenditure c
WHERE c.status='APPROVED' AND NOT coalesce(c.is_deleted,false) AND c.transaction_date <= '2026-10-14'
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.uid AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
ORDER BY c.amount DESC LIMIT 40;

-- 5.3 approved_by: ni jina, uid, au email?
SELECT CASE WHEN c.approved_by IS NULL THEN 'NULL'
            WHEN EXISTS (SELECT 1 FROM users u WHERE u.uid = c.approved_by) THEN 'users.uid'
            WHEN c.approved_by ~ '^[0-9a-f-]{36}$' THEN 'uid_isiyo_kwenye_users'
            WHEN c.approved_by LIKE '%@%' THEN 'email'
            ELSE 'jina/maandishi' END aina, count(*), string_agg(DISTINCT left(c.approved_by,40), ' | ') mifano
FROM capital_expenditure c WHERE c.status='APPROVED' GROUP BY 1;
SELECT CASE WHEN posted_by IS NULL THEN 'NULL' WHEN EXISTS (SELECT 1 FROM users u WHERE u.uid=j.posted_by) THEN 'users.uid'
            WHEN posted_by LIKE '%@%' THEN 'email' ELSE 'jina/maandishi' END aina,
       count(*), string_agg(DISTINCT left(posted_by,30), ' | ') mifano
FROM journal_entry j GROUP BY 1;

-- 5.4 capital_injections zote: mikopo, marejesho, mkopo->mtaji
SELECT i.uid, i.injection_type, i.source_type, i.amount, i.principal_amount, i.interest_amount, i.transaction_date, i.created_at,
       i.reclassified_from, i.reclassified_at, left(i.reclassification_reason,40) sababu, i.related_loan_uid, i.payment_method, i.affects_cash
FROM capital_injections i ORDER BY i.transaction_date;
SELECT j.reference_type, j.reference_uid, j.entry_date, j.created_at, j.is_reversal, j.total_debit,
       string_agg(l.account_code||(CASE WHEN l.debit_amount>0 THEN ' Dr ' ELSE ' Cr ' END)||(l.debit_amount+l.credit_amount), '; ') lines
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
WHERE j.reference_type IN ('LOAN_RECEIVED','LOAN_REPAYMENT','LOAN_RECLASSIFICATION','CAPITAL_INJECTION','OWNER_WITHDRAWAL','OPENING_BALANCE','FUNDS_TRANSFER','MANUAL_ADJUSTMENT')
GROUP BY j.uid, 1,2,3,4,5,6 ORDER BY j.entry_date;

-- 5.5 Fixed assets: capex za aina ya mali (is_asset) dhidi ya 1510/1530 na uchakavu
SELECT c.capital_type, c.reference_number, c.amount, c.transaction_date::date, c.asset_life_months, c.monthly_depreciation,
       c.accumulated_depreciation, c.status, left(c.description,40) maelezo,
       (SELECT sum(l.credit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
         WHERE j.reference_uid LIKE c.uid||'-DEP-%' AND l.account_code='1590') gl_dep
FROM capital_expenditure c
WHERE (c.is_asset OR EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=c.uid AND j.reference_type='ASSET_PURCHASE'))
  AND NOT coalesce(c.is_deleted,false)
ORDER BY c.transaction_date;
-- asset_item (rejista ya mali ya Toleo A)
SELECT * FROM asset_item LIMIT 10;
