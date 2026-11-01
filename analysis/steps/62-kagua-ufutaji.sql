-- HATUA 62 (mmiliki 01/11 bk) - KUSOMA TU, PROD. Inaendeshwa ndani ya transaction ya kusoma tu (default_transaction_read_only).
-- Kila mstari unaanza na lebo yake (SALE|, JOURNAL|, ...) ili log isomeke kwa grep.
\pset footer off
\set ON_ERROR_STOP on
SELECT 'FLYWAY|' || max(version::int) || '|' || count(*) FILTER (WHERE NOT success) || ' zilizoshindwa'
  FROM flyway_schema_history WHERE version ~ '^[0-9]+$';
SELECT 'SAA_YA_DB|' || now()::timestamp(0) || '|' || current_setting('TimeZone');

-- a) Sale 311026-2139 (146,500): ilifutwa lini, na nani, kwa sababu gani.
SELECT 'SALE|' || s.receipt_number || '|sale_date ' || s.sale_date::timestamp(0) || '|created ' || s.created_at::timestamp(0)
       || '|jumla ' || s.total_amount || '|' || coalesce(s.payment_status, '-')
       || '|deleted ' || coalesce(s.is_deleted::text, '-') || '|deleted_at ' || coalesce(s.deleted_at::timestamp(0)::text, '-')
       || '|deleted_date ' || coalesce(s.deleted_date::timestamp(0)::text, '-')
       || '|deleted_by ' || coalesce(s.deleted_by, '-') || ' = ' || coalesce((SELECT u.first_name || ' ' || coalesce(u.last_name, '') FROM users u
                                                                              WHERE u.uid = s.deleted_by OR u.email = s.deleted_by LIMIT 1), 'HAIJULIKANI')
       || '|muuzaji ' || coalesce((SELECT u.first_name FROM users u WHERE u.uid = s.user_uid), '-')
       || '|sababu ' || coalesce(left(replace(s.deletion_reason, E'\n', ' '), 200), '-')
       || '|maelezo ' || coalesce(left(replace(s.sale_notes, E'\n', ' '), 200), '-')
  FROM sales s WHERE s.receipt_number = '311026-2139';
SELECT 'SALE_IDADI|' || count(*) FROM sales WHERE receipt_number = '311026-2139';
-- Malipo ya sale hiyo (na reversal zake).
SELECT 'MALIPO|' || p.payment_date::timestamp(0) || '|' || coalesce(p.payment_method, '-') || '|' || p.amount_paid || '|' || coalesce(p.payment_status, '-')
       || '|reversal ' || coalesce(p.is_reversal::text, '-') || '|reversed_date ' || coalesce(p.reversed_date::timestamp(0)::text, '-')
       || '|deleted ' || coalesce(p.is_deleted::text, '-')
  FROM payments p JOIN sales s ON s.uid = p.sale_uid WHERE s.receipt_number = '311026-2139' ORDER BY p.id;
-- Journal zote za sale hiyo (sale yenyewe, malipo yake) na reversal zake: tarehe ya kitabu (entry_date) dhidi ya tukio (event_date).
WITH s AS (SELECT uid, receipt_number FROM sales WHERE receipt_number = '311026-2139'),
     refs AS (SELECT uid AS r FROM s UNION SELECT p.uid FROM payments p JOIN s ON s.uid = p.sale_uid)
SELECT 'JOURNAL|' || j.entry_number || '|' || j.reference_type || '|entry_date ' || j.entry_date || '|event_date ' || coalesce(j.event_date::text, '-')
       || '|late ' || coalesce(j.is_late_entry::text, '-') || '|reversal ' || coalesce(j.is_reversal::text, '-')
       || '|ya ' || coalesce((SELECT o.entry_number FROM journal_entry o WHERE o.uid = j.reversed_entry_uid), '-')
       || '|' || j.total_debit || '|posted_by ' || coalesce(j.posted_by, '-') || '|posted_at ' || coalesce(j.posted_at::timestamp(0)::text, '-')
       || '|deleted ' || coalesce(j.is_deleted::text, '-')
  FROM journal_entry j
 WHERE j.reference_uid IN (SELECT r FROM refs) OR j.reference_uid LIKE ANY (SELECT r || ':%' FROM refs)
    OR j.reference_number IN (SELECT receipt_number FROM s)
 ORDER BY j.id;
SELECT 'JOURNAL_MISTARI|' || j.entry_number || '|' || l.account_code || '|Dr ' || l.debit_amount || '|Cr ' || l.credit_amount
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE j.reference_uid = (SELECT uid FROM sales WHERE receipt_number = '311026-2139')
 ORDER BY j.id, l.line_order;
-- Kipindi cha Oktoba na Novemba.
SELECT 'KIPINDI|' || period_year || '-' || lpad(period_month::text, 2, '0') || '|' || coalesce(status, '-')
       || '|closed_at ' || coalesce(closed_at::timestamp(0)::text, '-') || '|closed_by ' || coalesce(closed_by, '-')
  FROM gl_period WHERE (period_year, period_month) IN ((2026, 9), (2026, 10), (2026, 11)) ORDER BY period_year, period_month;
-- Reco ya siku ya sale na ya 31/10 (hali, nani, kufunguliwa upya).
SELECT 'RECO_SIKU|' || d.reconciliation_date || '|' || coalesce(d.user_name, '-') || '|' || coalesce(d.status, '-')
       || '|submitted ' || coalesce(d.submitted_at::timestamp(0)::text, '-') || '|approved ' || coalesce(d.approved_at::timestamp(0)::text, '-')
       || ' na ' || coalesce(d.approved_by_name, '-') || '|closed ' || coalesce(d.closed_at::timestamp(0)::text, '-')
       || '|reopen ' || coalesce(d.reopen_count, 0) || ' ' || coalesce(d.reopened_at::timestamp(0)::text, '-')
       || '|mauzo ' || coalesce(d.auto_total_sales, 0) || '|variance ' || coalesce(d.variance_amount, 0)
  FROM daily_reconciliation d
 WHERE NOT coalesce(d.is_deleted, false)
   AND (d.reconciliation_date = DATE '2026-10-31'
        OR d.reconciliation_date = (SELECT s.sale_date::date FROM sales s WHERE s.receipt_number = '311026-2139' LIMIT 1))
 ORDER BY d.reconciliation_date, d.user_name;
-- Kumbukumbu za reco tangu 31/10 (mf. "sale imefutwa baada ya kuidhinishwa").
SELECT 'RECO_LOG|' || a.created_at::timestamp(0) || '|' || d.reconciliation_date || '|' || coalesce(a.action, '-') || '|' || coalesce(a.actor_name, '-')
       || '|' || coalesce(left(a.details::text, 250), '-')
  FROM reconciliation_audit_log a JOIN daily_reconciliation d ON d.uid = a.reconciliation_uid
 WHERE a.created_at >= TIMESTAMP '2026-10-31 00:00' ORDER BY a.created_at;
-- Sale mpya mahali pake: iliyotengenezwa baada ya kufutwa (hadi siku 2), yenye kiasi kilekile, mteja yuleyule, au maelezo yanayotaja 2139.
WITH s AS (SELECT * FROM sales WHERE receipt_number = '311026-2139' LIMIT 1)
SELECT 'SALE_MPYA|' || n.receipt_number || '|sale_date ' || n.sale_date::timestamp(0) || '|created ' || n.created_at::timestamp(0)
       || '|jumla ' || n.total_amount || '|deleted ' || coalesce(n.is_deleted::text, '-')
       || '|mteja_yuleyule ' || (n.customer_id IS NOT DISTINCT FROM s.customer_id)::text
       || '|kiasi_kilekile ' || (n.total_amount = s.total_amount)::text
       || '|muuzaji ' || coalesce((SELECT u.first_name FROM users u WHERE u.uid = n.user_uid), '-')
       || '|maelezo ' || coalesce(left(replace(n.sale_notes, E'\n', ' '), 150), '-')
  FROM sales n, s
 WHERE n.uid <> s.uid
   AND n.created_at >= coalesce(s.deleted_at, s.deleted_date, s.created_at) - interval '1 hour'
   AND n.created_at < coalesce(s.deleted_at, s.deleted_date, s.created_at) + interval '2 days'
   AND (n.total_amount = s.total_amount OR (n.customer_id = s.customer_id AND s.customer_id IS NOT NULL) OR n.sale_notes ILIKE '%2139%')
 ORDER BY n.created_at;
-- Sales nyingine zilizofutwa tangu 31/10 (muktadha).
SELECT 'IMEFUTWA_TANGU_3110|' || s.receipt_number || '|sale_date ' || s.sale_date::date || '|jumla ' || s.total_amount
       || '|deleted_at ' || coalesce(s.deleted_at::timestamp(0)::text, s.deleted_date::timestamp(0)::text, '-')
  FROM sales s WHERE s.is_deleted AND coalesce(s.deleted_at, s.deleted_date) >= TIMESTAMP '2026-10-31 00:00' ORDER BY 1;

-- b) Reco za Oktoba: variance kwa siku (kila reco), kisha kiasi kinachojirudia.
SELECT 'RECO_OKT|' || d.reconciliation_date || '|' || coalesce(d.user_name, '-') || '|' || coalesce(d.status, '-')
       || '|expected ' || coalesce(d.expected_cash, 0) || '|accounted ' || coalesce(d.accounted_cash, 0)
       || '|variance ' || coalesce(d.variance_amount, 0) || '|reopen ' || coalesce(d.reopen_count, 0)
       || '|' || coalesce(d.shortage_reason, '-') || '|' || coalesce(left(replace(d.variance_explanation, E'\n', ' '), 120), '-')
  FROM daily_reconciliation d
 WHERE NOT coalesce(d.is_deleted, false) AND d.reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31'
 ORDER BY d.reconciliation_date, d.user_name;
SELECT 'RECO_OKT_JUMLA|siku ' || count(DISTINCT reconciliation_date) || '|reco ' || count(*)
       -- variance_amount = expected - accounted: > 0 = pesa haikuonekana (upungufu), < 0 = ziada.
       || '|upungufu ' || count(*) FILTER (WHERE variance_amount > 0) || ' = ' || coalesce(sum(variance_amount) FILTER (WHERE variance_amount > 0), 0)
       || '|ziada ' || count(*) FILTER (WHERE variance_amount < 0) || ' = ' || coalesce(sum(variance_amount) FILTER (WHERE variance_amount < 0), 0)
  FROM daily_reconciliation WHERE NOT coalesce(is_deleted, false) AND reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31';
-- Variance zinazojirudia (kiasi kilekile, kwa shilingi 100) mara 2+ ndani ya Oktoba.
SELECT 'RECO_INAJIRUDIA|' || round(variance_amount, -2) || '|mara ' || count(*) || '|siku ' || string_agg(to_char(reconciliation_date, 'DD'), ',' ORDER BY reconciliation_date)
  FROM daily_reconciliation
 WHERE NOT coalesce(is_deleted, false) AND reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-31' AND variance_amount <> 0
 GROUP BY round(variance_amount, -2) HAVING count(*) >= 2 ORDER BY count(*) DESC, 1;
-- ~12,587 (riba 1,717.39 + akiba 10,869.57 ya A) na ~31,634 (+ akiba 19,047.62 ya B): kila safu ya namba ya reco na
-- mistari ya reco ya Oktoba-Novemba yenye kiasi hicho (+/-50), na mistari ya journal ya kipindi hicho.
WITH t(lebo, kiasi) AS (VALUES ('12587', 12586.96), ('31634', 31634.58)),
     d AS (SELECT d.reconciliation_date AS siku, 'daily_reconciliation.' || e.key AS safu, e.value AS v
             FROM daily_reconciliation d, jsonb_each_text(to_jsonb(d)) e
            WHERE NOT coalesce(d.is_deleted, false) AND d.reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-11-01'
              AND e.value ~ '^-?[0-9]+(\.[0-9]+)?$'),
     c AS (SELECT r.reconciliation_date AS siku, x.tbl || '.' || e.key AS safu, e.value AS v
             FROM (SELECT 'reconciliation_expenses' tbl, to_jsonb(z) j, z.reconciliation_uid ru FROM reconciliation_expenses z
                   UNION ALL SELECT 'reconciliation_cash_entries', to_jsonb(z), z.reconciliation_uid FROM reconciliation_cash_entries z
                   UNION ALL SELECT 'reconciliation_mobile_entries', to_jsonb(z), z.reconciliation_uid FROM reconciliation_mobile_entries z
                   UNION ALL SELECT 'reconciliation_retail_debts', to_jsonb(z), z.reconciliation_uid FROM reconciliation_retail_debts z
                   UNION ALL SELECT 'reconciliation_purchases', to_jsonb(z), z.reconciliation_uid FROM reconciliation_purchases z
                   UNION ALL SELECT 'reconciliation_debt_collections', to_jsonb(z), z.reconciliation_uid FROM reconciliation_debt_collections z) x
             JOIN daily_reconciliation r ON r.uid = x.ru, jsonb_each_text(x.j) e
            WHERE r.reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-11-01' AND e.value ~ '^-?[0-9]+(\.[0-9]+)?$'
              AND e.key NOT IN ('id'))
SELECT 'KIASI_' || t.lebo || '|' || u.siku || '|' || u.safu || '|' || u.v
  FROM (SELECT * FROM d UNION ALL SELECT * FROM c) u JOIN t ON abs(abs(u.v::numeric) - t.kiasi) <= 50
 WHERE u.safu NOT LIKE '%.version' ORDER BY t.lebo, u.siku;
SELECT 'KIASI_JOURNAL|' || j.entry_date || '|' || j.reference_type || '|' || l.account_code || '|Dr ' || l.debit_amount || '|Cr ' || l.credit_amount
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE NOT coalesce(j.is_deleted, false) AND j.entry_date BETWEEN DATE '2026-10-01' AND DATE '2026-11-01'
   AND (abs(l.debit_amount + l.credit_amount - 12586.96) <= 50 OR abs(l.debit_amount + l.credit_amount - 31634.58) <= 50)
 ORDER BY j.entry_date, j.id;

-- c) gl_posting_failure tangu 31/10 18:00 (created_at ni saa ya DB - tazama SAA_YA_DB juu).
SELECT 'GL_FAILURE|' || f.created_at::timestamp(0) || '|' || coalesce(f.source_type, '-') || '|' || coalesce(f.source_number, '-')
       || '|' || coalesce(f.event_type, '-') || '|entry_date ' || coalesce(f.entry_date::text, '-') || '|majaribio ' || coalesce(f.attempts, 0)
       || '|resolved ' || coalesce(f.resolved_at::timestamp(0)::text, 'HAPANA') || ' ' || coalesce(f.resolution, '')
       || '|' || coalesce(left(replace(f.error, E'\n', ' '), 220), '-')
  FROM gl_posting_failure f WHERE f.created_at >= TIMESTAMP '2026-10-31 18:00' ORDER BY f.created_at;
SELECT 'GL_FAILURE_IDADI|tangu_3110_1800 ' || count(*) FILTER (WHERE created_at >= TIMESTAMP '2026-10-31 18:00')
       || '|wazi_zote ' || count(*) FILTER (WHERE resolved_at IS NULL) FROM gl_posting_failure;

-- d) Depreciation ya 31/10: journal ASSET_DEPRECIATION zenye entry_date 31/10, na zote zilizoandikwa tangu 30/10.
SELECT 'UCHAKAVU_3110|journal ' || count(*) || '|jumla ' || coalesce(sum(j.total_debit), 0)
       || '|posted_by ' || coalesce(string_agg(DISTINCT j.posted_by, ','), '-')
       || '|posted_at ' || coalesce(min(j.posted_at)::timestamp(0)::text, '-') || ' .. ' || coalesce(max(j.posted_at)::timestamp(0)::text, '-')
  FROM journal_entry j
 WHERE j.reference_type = 'ASSET_DEPRECIATION' AND NOT coalesce(j.is_deleted, false) AND NOT coalesce(j.is_reversal, false)
   AND j.entry_date = DATE '2026-10-31';
SELECT 'UCHAKAVU_MISTARI_3110|' || l.account_code || '|Dr ' || sum(l.debit_amount) || '|Cr ' || sum(l.credit_amount)
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE j.reference_type = 'ASSET_DEPRECIATION' AND NOT coalesce(j.is_deleted, false) AND j.entry_date = DATE '2026-10-31'
 GROUP BY l.account_code ORDER BY 1;
SELECT 'UCHAKAVU_KARIBUNI|' || j.entry_date || '|' || j.entry_number || '|' || j.total_debit || '|reversal ' || coalesce(j.is_reversal::text, '-')
       || '|posted_by ' || coalesce(j.posted_by, '-') || '|posted_at ' || coalesce(j.posted_at::timestamp(0)::text, '-')
  FROM journal_entry j
 WHERE j.reference_type = 'ASSET_DEPRECIATION' AND NOT coalesce(j.is_deleted, false)
   AND (j.entry_date >= DATE '2026-10-01' OR j.posted_at >= TIMESTAMP '2026-10-30 00:00')
 ORDER BY j.entry_date, j.id;
SELECT 'UCHAKAVU_KWA_MWEZI|' || to_char(j.entry_date, 'YYYY-MM') || '|' || count(*) || '|' || sum(j.total_debit)
  FROM journal_entry j WHERE j.reference_type = 'ASSET_DEPRECIATION' AND NOT coalesce(j.is_deleted, false) AND NOT coalesce(j.is_reversal, false)
 GROUP BY to_char(j.entry_date, 'YYYY-MM') ORDER BY 1;
