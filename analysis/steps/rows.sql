-- READ-ONLY. Exact row count of every table in schema public, then a few dated facts.
-- Run on staging and on prod by 03b-hesabu-rows.cmd; nothing is written.
BEGIN TRANSACTION READ ONLY;
SELECT 'TABLES', count(*) FROM pg_tables WHERE schemaname = 'public';
SELECT 'ROWS_TOTAL', sum((xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || quote_ident(tablename), false, true, '')))[1]::text::bigint)
FROM pg_tables WHERE schemaname = 'public';
SELECT 'T', tablename, (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.' || quote_ident(tablename), false, true, '')))[1]::text::bigint
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
SELECT 'FLYWAY', count(*), max(installed_rank), (SELECT version FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 1) FROM flyway_schema_history;
SELECT 'SALES_LAST', max(sale_date), count(*) FROM sales WHERE is_deleted = false;
SELECT 'SALES_2026_10_06', count(*), coalesce(sum(total_amount), 0) FROM sales WHERE is_deleted = false AND sale_date >= DATE '2026-10-06' AND sale_date < DATE '2026-10-07';
SELECT 'RECON_LAST', max(reconciliation_date), count(*) FROM daily_reconciliation WHERE is_deleted = false;
SELECT 'COUNT_LAST', max(session_date), count(*) FROM counting_session WHERE is_deleted = false;
SELECT 'ORDER_LAST', max(order_date), count(*) FROM order_suggestion WHERE is_deleted = false;
SELECT 'PRODUCTS_ACTIVE', count(*) FROM products WHERE is_deleted = false AND is_active = true;
ROLLBACK;
