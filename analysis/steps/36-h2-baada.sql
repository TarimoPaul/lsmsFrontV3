-- HATUA 36 (STAGING, KUSOMA TU): sales za jaribio na journals zake.
-- sale_notes: backend inaongeza "YYYY-MM-DD HH:MM:SS: SALE COMPLETED ..." na mstari mpya MBELE ya maandishi ya POS (Sales.addNote),
-- kwa hiyo 'QA-H2 ' inatafutwa mwanzoni mwa MSTARI wowote, si mwanzoni mwa safu (LIKE 'QA-H2%' ilitoa sales=0 tarehe 20/10).
BEGIN TRANSACTION READ ONLY;
SELECT 'SALE|' || coalesce(substring(s.sale_notes from '(?:^|\n)(QA-H2 [A-Z])'), '?') || '|' || s.receipt_number || '|jumla=' || s.total_amount
       || '|deni=' || coalesce(s.outstanding_balance, 0) || '|hali=' || coalesce(s.payment_status, '')
       || '|malipo=' || coalesce((SELECT string_agg(p.payment_method || ':' || p.amount_paid, ',') FROM payments p WHERE p.sale_uid = s.uid), '-')
       || '|journals=' || (SELECT count(*) FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_deleted AND NOT j.is_reversal)
       || '|aina=' || coalesce((SELECT string_agg(j.reference_type || ' Dr=' || j.total_debit, ',') FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_deleted), '-')
       || '|AR_mstari=' || coalesce((SELECT sum(l.debit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                    WHERE j.reference_uid = s.uid AND NOT j.is_deleted AND l.account_code IN ('1100','1110'))::text, '0')
FROM sales s WHERE s.sale_notes ~ '(^|\n)QA-H2 ' ORDER BY s.created_at;
SELECT 'MUHTASARI|sales=' || count(*)
       || '|bila_journal=' || count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_deleted AND NOT j.is_reversal))
       || '|zenye_deni=' || count(*) FILTER (WHERE coalesce(s.outstanding_balance, 0) > 0)
       || '|zenye_deni_bila_journal=' || count(*) FILTER (WHERE coalesce(s.outstanding_balance, 0) > 0
              AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_deleted AND NOT j.is_reversal))
FROM sales s WHERE s.sale_notes ~ '(^|\n)QA-H2 ';
ROLLBACK;
