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

-- e) (bn) Mikopo yote iliyofungwa au kugeuzwa: ilifungwaje, journal zake, salio la 2100/1150/6600 ya kila mkopo, na riba
--    (LOANINT) yenye tarehe baada ya closed_at (scheduler isiandike kwa mkopo usio ACTIVE).
WITH m AS (SELECT * FROM capital_injections
            WHERE (source_type = 'LOAN' OR reclassified_from = 'LOAN') AND (loan_status <> 'ACTIVE' OR reclassified_from IS NOT NULL)),
     j AS (SELECT m.uid AS loan, je.uid, je.reference_type
             FROM m JOIN journal_entry je ON NOT coalesce(je.is_deleted, false)
              AND (je.reference_uid = m.uid OR je.reference_uid LIKE m.uid || ':%' OR je.reference_uid LIKE 'LOANINT:' || m.uid || ':%'
                   OR (je.reference_type = 'LOAN_REPAYMENT' AND je.reference_number = m.uid)))
SELECT 'MKOPO_ULIOFUNGWA|' || m.uid || '|' || coalesce(m.reason, '-') || '|' || coalesce(m.loan_status, '-') || '|source ' || m.source_type
       || '|closed_at ' || coalesce(m.closed_at::date::text, '-') || '|reclassified_at ' || coalesce(m.reclassified_at::date::text, '-')
       || '|njia ' || CASE WHEN m.reclassified_from IS NOT NULL THEN 'IMEGEUZWA_MTAJI'
                           WHEN EXISTS (SELECT 1 FROM capital_injections r WHERE r.related_loan_uid = m.uid AND r.source_type = 'LOAN_REPAYMENT') THEN 'IMELIPWA'
                           ELSE 'NYINGINE' END
       || '|2100 ' || coalesce((SELECT sum(l.debit_amount - l.credit_amount) FROM j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                 WHERE j.loan = m.uid AND l.account_code = '2100'), 0)
       || '|1150 ' || coalesce((SELECT sum(l.debit_amount - l.credit_amount) FROM j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                 WHERE j.loan = m.uid AND l.account_code = '1150'), 0)
       || '|6600 ' || coalesce((SELECT sum(l.debit_amount - l.credit_amount) FROM j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                                 WHERE j.loan = m.uid AND l.account_code = '6600'), 0)
       || '|journal ' || coalesce((SELECT string_agg(t.reference_type || ' ' || t.n, ', ')
                                     FROM (SELECT reference_type, count(*) n FROM j WHERE j.loan = m.uid GROUP BY 1) t), '-')
  FROM m ORDER BY m.closed_at NULLS LAST;
SELECT 'MKOPO_JOURNAL|' || m.uid || '|' || je.entry_number || '|' || je.reference_type || '|' || je.entry_date || '|' || coalesce(je.reference_uid, '-')
       || '|reversal ' || coalesce(je.is_reversal::text, '-') || '|' || je.total_debit
  FROM capital_injections m JOIN journal_entry je ON NOT coalesce(je.is_deleted, false)
   AND (je.reference_uid = m.uid OR je.reference_uid LIKE m.uid || ':%'
        OR (je.reference_type = 'LOAN_REPAYMENT' AND je.reference_number = m.uid))
 WHERE (m.source_type = 'LOAN' OR m.reclassified_from = 'LOAN') AND (m.loan_status <> 'ACTIVE' OR m.reclassified_from IS NOT NULL)
 ORDER BY m.uid, je.id;
SELECT 'RIBA_BAADA_YA_KUFUNGWA|' || m.uid || '|' || coalesce(m.reason, '-') || '|closed_at ' || m.closed_at::date
       || '|siku ' || count(je.uid) || '|jumla ' || coalesce(sum(je.total_debit), 0)
       || '|ya_kwanza ' || coalesce(min(right(je.reference_uid, 10)), '-') || '|ya_mwisho ' || coalesce(max(right(je.reference_uid, 10)), '-')
  FROM capital_injections m
  LEFT JOIN journal_entry je ON je.reference_uid LIKE 'LOANINT:' || m.uid || ':%' AND NOT coalesce(je.is_deleted, false)
       AND NOT coalesce(je.is_reversal, false) AND right(je.reference_uid, 10) > m.closed_at::date::text
 WHERE (m.source_type = 'LOAN' OR m.reclassified_from = 'LOAN') AND m.closed_at IS NOT NULL
 GROUP BY m.uid, m.reason, m.closed_at ORDER BY 1;
SELECT 'MIKOPO_YOTE|' || coalesce(loan_status, '-') || '|' || count(*)
  FROM capital_injections WHERE source_type = 'LOAN' OR reclassified_from = 'LOAN' GROUP BY loan_status;

-- f) (bn) Jagger Master: bidhaa (chupa ngapi kwa kifurushi, gharama), manunuzi 01/09-13/10 (ya Septemba kulinganisha gharama
--    kwa chupa), mwendo wa stock 01/10-13/10, manunuzi/matumizi ya reco yanayotaja "jag", na mistari ya hesabu.
SELECT 'JAG_BIDHAA|' || p.uid || '|' || p.product_name || '|chupa_kwa_kifurushi ' || coalesce(p.pieces_per_package::text, '-')
       || '|wastani ' || coalesce(p.current_average_cost, 0) || '|gharama_ya_mwisho ' || coalesce(p.last_purchase_cost, 0)
       || '|bei_chupa ' || coalesce(p.piece_sale_price, 0) || '|bei_kifurushi ' || coalesce(p.whole_sale_price, 0)
       || '|stock ' || coalesce(p.current_stock::text, '-') || '|deleted ' || coalesce(p.is_deleted::text, '-')
  FROM products p WHERE p.product_name ILIKE '%jag%' ORDER BY p.product_name, p.id;
SELECT 'JAG_MANUNUZI|' || pr.purchase_date::date || '|' || p.product_name || '|' || left(p.uid, 8) || '|idadi ' || coalesce(pr.quantity::text, '-')
       || '|chupa_kwa_kifurushi ' || coalesce(pr.pieces_per_package_at_purchase::text, '-') || '|njia ' || coalesce(pr.price_input_mode, '-')
       || '|bei ' || coalesce(pr.purchase_price, 0) || '|gharama_kwa_chupa ' || coalesce(pr.cost_per_piece, 0) || '|jumla ' || coalesce(pr.total_amount, 0)
       || '|' || coalesce(pr.status, '-') || '|' || coalesce(pr.supplier_name, '-') || '|received_by ' || coalesce(pr.received_by, '-')
       || '|created ' || pr.created_at::timestamp(0)
  FROM purchases pr JOIN products p ON p.uid = pr.product_uid
 WHERE p.product_name ILIKE '%jag%' AND pr.purchase_date >= DATE '2026-09-01' AND pr.purchase_date < DATE '2026-10-14' AND NOT coalesce(pr.is_deleted, false)
 ORDER BY pr.purchase_date, pr.id;
SELECT 'JAG_MWENDO|' || s.movement_date::timestamp(0) || '|' || p.product_name || '|' || left(p.uid, 8) || '|' || coalesce(s.movement_type, '-')
       || '|' || coalesce(s.quantity::text, '-') || '|' || coalesce(s.stock_before::text, '-') || '->' || coalesce(s.stock_after::text, '-')
       || '|bei ' || coalesce(s.unit_price::text, '-') || '|' || coalesce(s.reference, '-') || '|' || coalesce(s.initiated_by, '-')
  FROM store s JOIN products p ON p.uid = s.products_uid
 WHERE p.product_name ILIKE '%jag%' AND s.movement_date >= DATE '2026-10-01' AND s.movement_date < DATE '2026-10-14' AND NOT coalesce(s.is_deleted, false)
 ORDER BY s.movement_date, s.id;
SELECT 'JAG_RECO|' || d.reconciliation_date || '|' || x.aina || '|' || coalesce(left(x.maelezo, 150), '-') || '|' || coalesce(x.kiasi, 0)
  FROM (SELECT reconciliation_uid, 'manunuzi' aina, coalesce(supplier_name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(notes, '') maelezo, amount kiasi
          FROM reconciliation_purchases WHERE NOT coalesce(is_deleted, false)
        UNION ALL
        SELECT reconciliation_uid, 'matumizi', coalesce(expense_type, '') || ' ' || coalesce(description, '') || ' ' || coalesce(notes, ''), amount
          FROM reconciliation_expenses WHERE NOT coalesce(is_deleted, false)) x
  JOIN daily_reconciliation d ON d.uid = x.reconciliation_uid
 WHERE d.reconciliation_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-13' AND x.maelezo ILIKE '%jag%'
 ORDER BY d.reconciliation_date;
SELECT 'JAG_HESABU|' || s.session_date || '|' || p.product_name || '|' || left(p.uid, 8) || '|mfumo ' || l.system_qty_snapshot || '|kuhesabu ' || l.counted_qty
       || '|gharama_kwa_chupa ' || l.unit_cost_snapshot || '|thamani ' || l.variance_value
  FROM counting_line l JOIN counting_session s ON s.uid = l.session_uid JOIN products p ON p.uid = l.product_uid
 WHERE p.product_name ILIKE '%jag%' AND s.session_date BETWEEN DATE '2026-10-01' AND DATE '2026-10-14' AND l.variance_qty <> 0
 ORDER BY s.session_date;

-- g) (bo) Manunuzi ya 2026 yenye gharama kwa kipande > 3x au < 1/3 ya wastani wa manunuzi MENGINE ya bidhaa hiyo hiyo
--    (mstari wenyewe hauhesabiwi kwenye wastani, ili mmoja usiinue wastani wake). Pamoja na hali ya kipindi cha Oktoba.
SELECT 'KIPINDI_OKTOBA|' || coalesce((SELECT status || '|closed_at ' || coalesce(closed_at::timestamp(0)::text, '-')
                                        FROM gl_period WHERE period_year = 2026 AND period_month = 10 LIMIT 1), 'HAKUNA_SAFU (OPEN)');
WITH pr AS (SELECT pr.id, pr.product_uid, pr.purchase_date::date AS siku, pr.quantity, pr.cost_per_piece, pr.purchase_price,
                   pr.pieces_per_package_at_purchase, pr.price_input_mode, pr.supplier_name
              FROM purchases pr
             WHERE NOT coalesce(pr.is_deleted, false) AND pr.purchase_date >= DATE '2026-01-01'
               AND coalesce(pr.status, '') NOT IN ('CANCELLED', 'REJECTED') AND coalesce(pr.cost_per_piece, 0) > 0),
     w AS (SELECT a.*, (SELECT avg(b.cost_per_piece) FROM pr b WHERE b.product_uid = a.product_uid AND b.id <> a.id) AS wastani,
                  (SELECT count(*) FROM pr b WHERE b.product_uid = a.product_uid AND b.id <> a.id) AS mengine
             FROM pr a)
SELECT 'GHARAMA_ISIYO_KAWAIDA|' || w.siku || '|' || p.product_name || '|' || left(p.uid, 8) || '|qty ' || w.quantity
       || '|gharama_kwa_kipande ' || round(w.cost_per_piece, 2) || '|wastani_wa_mengine ' || round(w.wastani, 2)
       || '|mara ' || round(w.cost_per_piece / w.wastani, 2) || '|manunuzi_mengine ' || w.mengine
       || '|kifurushi ' || coalesce(w.pieces_per_package_at_purchase::text, coalesce(p.pieces_per_package::text, '-'))
       || '|njia ' || coalesce(w.price_input_mode, '-') || '|' || coalesce(w.supplier_name, '-')
  FROM w JOIN products p ON p.uid = w.product_uid
 WHERE w.mengine > 0 AND (w.cost_per_piece > 3 * w.wastani OR w.cost_per_piece < w.wastani / 3)
 ORDER BY w.siku, p.product_name;
SELECT 'GHARAMA_ISIYO_KAWAIDA_IDADI|' || count(*) FROM (
  SELECT 1 FROM purchases a
   WHERE NOT coalesce(a.is_deleted, false) AND a.purchase_date >= DATE '2026-01-01' AND coalesce(a.cost_per_piece, 0) > 0
     AND coalesce(a.status, '') NOT IN ('CANCELLED', 'REJECTED')
     AND EXISTS (SELECT 1 FROM purchases b WHERE b.product_uid = a.product_uid AND b.id <> a.id AND NOT coalesce(b.is_deleted, false)
                   AND b.purchase_date >= DATE '2026-01-01' AND coalesce(b.cost_per_piece, 0) > 0 AND coalesce(b.status, '') NOT IN ('CANCELLED', 'REJECTED'))
     AND (a.cost_per_piece > 3 * (SELECT avg(b.cost_per_piece) FROM purchases b WHERE b.product_uid = a.product_uid AND b.id <> a.id
                                    AND NOT coalesce(b.is_deleted, false) AND b.purchase_date >= DATE '2026-01-01' AND coalesce(b.cost_per_piece, 0) > 0
                                    AND coalesce(b.status, '') NOT IN ('CANCELLED', 'REJECTED'))
          OR a.cost_per_piece < (SELECT avg(b.cost_per_piece) FROM purchases b WHERE b.product_uid = a.product_uid AND b.id <> a.id
                                   AND NOT coalesce(b.is_deleted, false) AND b.purchase_date >= DATE '2026-01-01' AND coalesce(b.cost_per_piece, 0) > 0
                                   AND coalesce(b.status, '') NOT IN ('CANCELLED', 'REJECTED')) / 3)) x;
