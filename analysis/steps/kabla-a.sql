-- READ-ONLY. Staging before Toleo A (backend 2.2.66 = V128 asset register + V129 staff liability asset source).
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY', version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 5;
SELECT 'FLYWAY_FAILED_MUST_BE_0', count(*) FROM flyway_schema_history WHERE success = false;
SELECT 'FLYWAY_ALL', string_agg(version, ' ' ORDER BY installed_rank) FROM flyway_schema_history WHERE version IS NOT NULL;
-- The two checks V129 asks for: every existing row must already satisfy the new "one source" CHECKs.
SELECT 'SL_SESSION_NULL_MUST_BE_0', count(*) FROM staff_liability WHERE session_uid IS NULL;
SELECT 'SLI_STOCK_NULL_MUST_BE_0', count(*) FROM staff_liability_item WHERE product_uid IS NULL OR counting_line_uid IS NULL;
SELECT 'ROWS', 'staff_liability', count(*) FROM staff_liability;
SELECT 'ROWS', 'staff_liability_item', count(*) FROM staff_liability_item;
SELECT 'ROWS', 'staff_liability_payment', count(*) FROM staff_liability_payment;
-- Nothing of Toleo A may be there yet.
SELECT 'ASSET_TABLES_MUST_BE_0', count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'asset\_%';
SELECT 'ASSET_PERMISSIONS_MUST_BE_0', count(*) FROM permissions WHERE name LIKE 'ASSET\_COUNT%';
SELECT 'ASSET_COLUMNS_MUST_BE_0', count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('staff_liability', 'staff_liability_item')
  AND column_name IN ('asset_session_uid', 'asset_item_uid', 'asset_line_uid');
SELECT 'NOT_NULL', table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('staff_liability', 'staff_liability_item')
  AND column_name IN ('session_uid', 'product_uid', 'counting_line_uid') ORDER BY 2, 3;
-- Every constraint on the two tables as it is now (the foreign keys must all still be there after 2.2.66).
SELECT 'CONSTRAINT', conrelid::regclass, contype, conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass) ORDER BY 2, 3, 4;
SELECT 'FOREIGN_KEYS_KABLA', count(*) FROM pg_constraint
WHERE contype = 'f' AND conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass);
ROLLBACK;
