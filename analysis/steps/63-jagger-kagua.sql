-- HATUA 63 v3 (mmiliki 02/11 bw) - KAGUA, KUSOMA TU. Jagger Master 886dc1ed.
-- Chief amethibitisha: CHUPA moja = 53,000 (TAKAWEDO), bei ya kuuza 60,000, dukani ipo 1. Kosa ni hesabu ya 13/10
-- (6 badala ya 1), si gharama. Njia ya "carton" ya v1/v2 imefutwa: gharama inabaki 53,000.
-- Inaendeshwa ndani ya transaction ya kusoma tu. Kila mstari una lebo J63_...; 63-rekebisha-jagger.mjs inazisoma.
\pset footer off
\set ON_ERROR_STOP on
\set P '886dc1ed-2793-453c-bc9f-2c1e251ec5de'
\set LINE 'ba9c1a62-8d71-49e5-b345-9cb44144da2c'
SELECT 'J63_TAREHE|' || (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
SELECT 'J63_KIPINDI|' || m || '|' || coalesce((SELECT status FROM gl_period WHERE period_year = 2026 AND period_month = m LIMIT 1), 'OPEN')
  FROM (VALUES (10)) v(m);
SELECT 'J63_BIDHAA|' || uid || '|' || product_name || '|' || coalesce(current_stock, 0) || '|' || coalesce(current_average_cost, 0)
       || '|' || coalesce(last_purchase_cost, 0) || '|' || coalesce(is_deleted, false)
  FROM products WHERE uid = :'P';
-- (bx) Kifurushi cha bidhaa: kabla 6 / 6 / 336,000; baada 1 / 1 / 0.
SELECT 'J63_KIFURUSHI|' || coalesce(pieces_per_package::text, 'null') || '|' || coalesce(whole_package_quantity::text, 'null')
       || '|' || coalesce(whole_sale_price::text, 'null')
  FROM products WHERE uid = :'P';
SELECT 'J63_AUDIT_KIFURUSHI_IPO|' || count(*) FROM audit_trails WHERE action = 'PRODUCT_PACKAGE_CORRECTION' AND additional_data LIKE '%' || :'P' || '%';
-- Hesabu ya 13/10 (nanga): marekebisho yake na mwendo wake wa stock.
SELECT 'J63_NANGA|' || a.uid || '|' || a.adjustment_qty || '|' || a.adjustment_value || '|' || coalesce(a.gl_reference_uid, '-')
       || '|' || coalesce(s.uid, '-') || '|' || coalesce(s.stock_before, -1) || '->' || coalesce(s.stock_after, -1)
       || '|' || coalesce(s.unit_price::text, '-') || '|' || coalesce(s.movement_date::text, '-')
  FROM stock_adjustment a LEFT JOIN store s ON s.uid = a.store_movement_uid
 WHERE a.counting_line_uid = :'LINE' AND a.product_uid = :'P' AND NOT coalesce(a.is_deleted, false);
-- Akaunti iliyopewa CREDIT na journal ya 13/10 (isiyo 1200): journal ya marekebisho inaipa DEBIT akaunti hiyohiyo.
SELECT 'J63_HESABU_CR|' || l.account_code || '|' || sum(l.credit_amount - l.debit_amount) || '|' || string_agg(DISTINCT j.entry_number || ' ' || j.entry_date, ', ')
  FROM stock_adjustment a JOIN journal_entry j ON j.reference_uid = a.gl_reference_uid AND NOT coalesce(j.is_deleted, false)
  JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE a.counting_line_uid = :'LINE' AND a.product_uid = :'P' AND l.account_code <> '1200'
 GROUP BY l.account_code ORDER BY 1;
SELECT 'J63_NANGA_1200|' || coalesce(sum(l.debit_amount - l.credit_amount), 0)
  FROM stock_adjustment a JOIN journal_entry j ON j.reference_uid = a.gl_reference_uid AND NOT coalesce(j.is_deleted, false)
  JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE a.counting_line_uid = :'LINE' AND a.product_uid = :'P' AND l.account_code = '1200';
-- Mwendo wa stock wa Jagger BAADA ya 13/10 (bila marekebisho ya hatua hii) - lazima 0. Mauzo tangu 13/10 - lazima 0.
SELECT 'J63_MWENDO_BAADA|' || count(*) || '|' || coalesce(string_agg(s.movement_type || ' ' || s.quantity || ' ' || s.movement_date::timestamp(0), ', '), '-')
  FROM store s
 WHERE s.products_uid = :'P' AND NOT coalesce(s.is_deleted, false) AND coalesce(s.reference, '') <> 'MAREKEBISHO-COUNT-ADJ-' || :'LINE'
   AND s.movement_date > (SELECT s2.movement_date FROM store s2 WHERE s2.reference = 'COUNT-ADJ-' || :'LINE' AND s2.products_uid = :'P' LIMIT 1);
SELECT 'J63_MAUZO_TANGU|' || count(*) || '|' || coalesce(string_agg(sa.receipt_number || ' ' || d.piece_quantity, ', '), '-')
  FROM sales_details d JOIN sales sa ON sa.uid = d.sale_uid
 WHERE d.product_uid = :'P' AND NOT coalesce(d.is_deleted, false) AND NOT coalesce(sa.is_deleted, false)
   AND sa.created_at >= TIMESTAMP '2026-10-13 09:48';
-- Marekebisho ya hatua hii yaliyokwisha andikwa (kinga ya kurudia na kuendelea).
SELECT 'J63_MWENDO_IPO|' || count(*) || '|' || coalesce(string_agg(s.quantity || ' ' || s.stock_before || '->' || s.stock_after, ', '), '-')
  FROM store s WHERE s.products_uid = :'P' AND s.reference = 'MAREKEBISHO-COUNT-ADJ-' || :'LINE' AND NOT coalesce(s.is_deleted, false);
SELECT 'J63_JOURNAL_IPO|' || count(j.uid) || '|' || coalesce(string_agg(j.entry_number || ' ' || j.entry_date || ' ' || j.total_debit, ', '), '-')
  FROM journal_entry j
 WHERE j.reference_type = 'MANUAL_ADJUSTMENT' AND j.reference_number = 'Hesabu ya 13/10 ilikosewa: 6 badala ya 1 (Chief, 02/11)'
   AND NOT coalesce(j.is_deleted, false) AND NOT coalesce(j.is_reversal, false);
SELECT 'J63_AUDIT_IPO|' || count(*) FROM audit_trails WHERE action = 'STOCK_COUNT_CORRECTION' AND additional_data LIKE '%' || :'LINE' || '%';
SELECT 'J63_TB|' || coalesce(sum(l.debit_amount - l.credit_amount), 0)
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid WHERE NOT coalesce(j.is_deleted, false);
SELECT 'J63_KAGUA_IMEKAMILIKA';
