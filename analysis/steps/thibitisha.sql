-- READ-ONLY. What V127 (order) must have left on staging, and what must NOT be there (asset).
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY', version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 4;
SELECT 'FLYWAY_FAILED', count(*) FROM flyway_schema_history WHERE success = false;
SELECT 'ORDER_LINE_NEW_COLUMNS', string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_suggestion_line' AND column_name IN ('source', 'added_at', 'added_by', 'slow_action', 'slow_cover_days', 'slow_value');
SELECT 'ORDER_BUDGET_KNOWN_COLUMN', count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_suggestion' AND column_name = 'budget_known';
SELECT 'ORDER_LINES_BY_SOURCE', source, count(*) FROM order_suggestion_line GROUP BY source ORDER BY source;
SELECT 'ORDERS_BUDGET_KNOWN', budget_known, count(*) FROM order_suggestion GROUP BY budget_known ORDER BY budget_known;
SELECT 'ASSET_TABLES_MUST_BE_0', count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'asset\_%';
SELECT 'ASSET_PERMISSIONS_MUST_BE_0', count(*) FROM permissions WHERE name LIKE 'ASSET\_COUNT%';
SELECT 'STAFF_LIABILITY_FOREIGN_KEYS', count(*) FROM pg_constraint
WHERE contype = 'f' AND conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass);
ROLLBACK;
