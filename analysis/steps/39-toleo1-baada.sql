-- HATUA 39/40 (STAGING, KUSOMA TU): hali baada ya jaribio la Toleo 1.
BEGIN TRANSACTION READ ONLY;
-- sales za jaribio na za H-2: journal hai, aina, mstari wa AR
-- sale_notes: backend inaongeza dokezo MBELE (Sales.addNote) -> 'QA-T1 ' inatafutwa mwanzoni mwa mstari wowote.
SELECT 'SALE|' || coalesce(substring(s.sale_notes from '(?:^|\n)(QA-T1 [A-Z])'), 'H-2') || '|' || s.receipt_number || '|jumla=' || s.total_amount
       || '|deni=' || coalesce(s.outstanding_balance, 0)
       || '|aina=' || coalesce((SELECT string_agg(j.reference_type || ' ' || j.entry_date || CASE WHEN j.is_late_entry THEN ' (tukio ' || j.event_date || ')' ELSE '' END, ',')
                               FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)), 'HAKUNA')
       || '|AR=' || coalesce((SELECT sum(l.debit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                               WHERE j.reference_uid = s.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false) AND l.account_code IN ('1100','1110'))::text, '0')
FROM sales s
WHERE s.sale_notes ~ '(^|\n)QA-T1 '
   OR s.receipt_number IN ('101026-2202', '121026-2249', '131026-2227')
ORDER BY s.created_at;
-- variance: journals hai, variance_kind, reversal za reopen
SELECT 'DAY_CLOSE_LIVE|' || count(*) FROM journal_entry j
 WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false));
SELECT 'DAY_CLOSE_LIVE_ON_SUPERSEDED_MUST_BE_0|' || count(*) FROM journal_entry j JOIN daily_financial_snapshot f ON f.uid = j.reference_uid
 WHERE j.reference_type = 'DAY_CLOSE_VARIANCE' AND NOT j.is_reversal AND NOT f.is_current AND NOT coalesce(j.is_deleted, false)
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false));
SELECT 'VARIANCE_KIND|' || coalesce(variance_kind, 'NULL') || '|' || count(*) FROM daily_financial_snapshot WHERE is_current AND variance_amount <> 0 GROUP BY variance_kind ORDER BY 1;
SELECT 'REOPENED_RECON|' || r.reconciliation_date || '|' || r.status || '|journal_hai_MUST_BE_0='
       || (SELECT count(*) FROM journal_entry j WHERE j.reference_uid = f.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false)
             AND NOT EXISTS (SELECT 1 FROM journal_entry x WHERE x.reversed_entry_uid = j.uid AND NOT coalesce(x.is_deleted, false)))
FROM daily_reconciliation r JOIN daily_financial_snapshot f ON f.reconciliation_uid = r.uid AND f.is_current
WHERE r.reopen_reason LIKE 'QA Toleo 1%';
-- vipindi na journals za kuchelewa
SELECT 'PERIOD|' || period_year || '-' || lpad(period_month::text, 2, '0') || '|' || status FROM gl_period WHERE branch_uid IS NULL ORDER BY 1;
SELECT 'PERIOD_AUDIT|' || period_year || '-' || lpad(period_month::text, 2, '0') || '|' || action || '|' || coalesce(reason, '') FROM gl_period_audit ORDER BY at;
SELECT 'LATE_ENTRY|' || reference_type || '|' || entry_date || '|tukio=' || event_date || '|' || coalesce(reference_number, '') FROM journal_entry WHERE is_late_entry ORDER BY id;
-- jumla
SELECT 'GL_1000|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code = '1000' AND NOT coalesce(j.is_deleted, false);
SELECT 'GL_6700|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code = '6700' AND NOT coalesce(j.is_deleted, false);
SELECT 'AR_GL|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code IN ('1100', '1110') AND NOT coalesce(j.is_deleted, false);
SELECT 'AR_SUBLEDGER|' || coalesce(sum(outstanding_balance), 0) FROM sales
 WHERE NOT coalesce(is_deleted, false) AND coalesce(is_active, true) AND outstanding_balance > 0;
SELECT 'UNBALANCED_MUST_BE_0|' || count(*) FROM journal_entry WHERE NOT coalesce(is_deleted, false) AND abs(total_debit - total_credit) >= 0.01;
SELECT 'FAILURES|' || coalesce(resolution, 'WAZI') || '|' || source_type || '|' || count(*) FROM gl_posting_failure GROUP BY coalesce(resolution, 'WAZI'), source_type ORDER BY 1;
ROLLBACK;
