-- HATUA 58b (mmiliki 28/10 aa) - KUSOMA TU: kwa nini hakuna journal ya SCHEDULER tangu 05/10/2026 00:10?
-- Code (main dd198ea): 00:05 processRecurringExpenses huunda "watoto" APPROVED wa templates za kila siku BILA journal;
-- 00:10 postDueApprovedCapex(45) huipa journal (posted_by SCHEDULER) kila capex APPROVED ya siku 45 zilizopita isiyo na
-- journal hai - watoto hao na miezi iliyoidhinishwa mapema (mishahara/kodi). 01 ya mwezi 02:00 depreciation (SCHEDULER).
-- Kwa hiyo journal ya SCHEDULER inakosekana ikiwa (a) hakuna capex iliyofika tarehe yake bila journal, au (b) kazi haziendeshwi.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'READ_ONLY|' || current_setting('transaction_read_only') || '|' || now();
-- 1) journal ZOTE za SCHEDULER (jumla 23 kwa 58): siku, saa, aina, reference, kiasi.
SELECT 'SJ|' || j.entry_date || '|' || j.posted_at || '|' || coalesce(j.reference_type, '-') || '|' || coalesce(j.reference_uid, '-')
       || '|' || coalesce(j.total_debit, 0)
  FROM journal_entry j WHERE j.posted_by = 'SCHEDULER' AND NOT coalesce(j.is_deleted, false) ORDER BY j.posted_at;
-- 2) templates za kurudia (kila siku) zilizo hai, na mara ya mwisho zilipozalisha mtoto.
SELECT 'TEMPLATE|' || uid || '|' || coalesce(reference_number, '-') || '|' || left(coalesce(description, '-'), 40) || '|' || capital_type
       || '|' || coalesce(expenditure_type, '-') || '|' || coalesce(expenditure_frequency, '-') || '|' || coalesce(status, '-')
       || '|active ' || recurring_active || '|mwisho ' || coalesce(last_recurrence_date::text, '-') || '|end ' || coalesce(recurring_end_date::text, '-')
       || '|deleted ' || is_deleted
  FROM capital_expenditure WHERE is_recurring ORDER BY recurring_active DESC, last_recurrence_date DESC NULLS LAST;
-- 3) watoto waliozalishwa na 00:05 (approved_by SYSTEM_AUTO) kwa siku tangu 01/09, na wangapi wana journal hai.
SELECT 'WATOTO|' || c.transaction_date::date || '|' || count(*) || '|wenye_journal ' || count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false)
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))))
  FROM capital_expenditure c WHERE c.approved_by = 'SYSTEM_AUTO' AND c.transaction_date >= DATE '2026-09-01' AND NOT c.is_deleted
 GROUP BY c.transaction_date::date ORDER BY 1;
-- 4) capex APPROVED za siku 45 zilizopita hadi leo BILA journal hai (hizi ndizo 00:10 ingepaswa kuandika).
SELECT 'BILA_JOURNAL|' || c.uid || '|' || c.transaction_date || '|' || c.capital_type || '|' || coalesce(c.expenditure_type, '-')
       || '|' || c.amount || '|' || coalesce(c.approved_by, '-') || '|' || left(coalesce(c.description, '-'), 40)
  FROM capital_expenditure c
 WHERE c.status = 'APPROVED' AND NOT c.is_deleted AND c.transaction_date >= now() - interval '45 days' AND c.transaction_date < now()
   AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false)
                     AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false)))
 ORDER BY c.transaction_date;
SELECT 'BILA_JOURNAL_IDADI|' || count(*) || '|kwa aina ' || coalesce(string_agg(DISTINCT c.capital_type, ','), '-')
  FROM capital_expenditure c
 WHERE c.status = 'APPROVED' AND NOT c.is_deleted AND c.transaction_date >= now() - interval '45 days' AND c.transaction_date < now()
   AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false)
                     AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false)));
-- 5) miezi iliyoidhinishwa mapema (MONTHLY_EXPENSE ya template) yenye tarehe 01/10 .. 30/11, na journal zake.
SELECT 'MWEZI|' || c.transaction_date::date || '|' || c.capital_type || '|' || c.amount || '|' || coalesce(c.status, '-')
       || '|journal ' || coalesce((SELECT string_agg(j.entry_date || ' ' || coalesce(j.posted_by, '-'), ';') FROM journal_entry j
                                    WHERE j.reference_uid = c.uid AND NOT coalesce(j.is_reversal, false) AND NOT coalesce(j.is_deleted, false)), 'HAKUNA')
  FROM capital_expenditure c
 WHERE c.parent_capital_expenditure_uid IS NOT NULL AND c.expenditure_type = 'MONTHLY_EXPENSE' AND NOT c.is_deleted
   AND c.transaction_date >= DATE '2026-10-01' AND c.transaction_date < DATE '2026-12-01'
 ORDER BY c.transaction_date;
-- 6) depreciation: journal ASSET_DEPRECIATION kwa mwezi na nani aliziandika.
SELECT 'UCHAKAVU|' || to_char(j.entry_date, 'YYYY-MM') || '|' || coalesce(j.posted_by, '-') || '|' || count(*) || '|' || sum(coalesce(j.total_debit, 0))
  FROM journal_entry j WHERE j.reference_type = 'ASSET_DEPRECIATION' AND NOT coalesce(j.is_deleted, false)
 GROUP BY to_char(j.entry_date, 'YYYY-MM'), j.posted_by ORDER BY 1;
-- 7) makosa ya GL yaliyo wazi tangu 05/10 (scheduler ikikataliwa huandika hapa).
SELECT 'KOSA_WAZI|' || f.created_at || '|' || f.source_type || '|' || coalesce(f.posted_by, '-') || '|' || left(coalesce(f.error, '-'), 80)
  FROM gl_posting_failure f WHERE f.resolved_at IS NULL AND f.created_at >= DATE '2026-10-05' ORDER BY f.created_at;
ROLLBACK;
SELECT 'MWISHO_58B';
