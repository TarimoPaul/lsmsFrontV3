-- READ-ONLY. What 2.2.66 (V128 + V129) must have left on staging.
BEGIN TRANSACTION READ ONLY;
SELECT 'FLYWAY', version, description, success, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 4;
SELECT 'FLYWAY_FAILED_MUST_BE_0', count(*) FROM flyway_schema_history WHERE success = false;
SELECT 'FLYWAY_128_129_MUST_BE_2', count(*) FROM flyway_schema_history WHERE version IN ('128', '129') AND success;
-- V128
SELECT 'ASSET_TABLES_MUST_BE_4', count(*) FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('asset_item', 'asset_count_session', 'asset_count_line', 'asset_count_schedule');
SELECT 'ASSET_PERMISSIONS_MUST_BE_2', count(*) FROM permissions WHERE name IN ('ASSET_COUNT_MANAGE', 'ASSET_COUNT_APPROVE');
SELECT 'ASSET_PERMISSION_ROLE_GRANTS_MUST_BE_0', count(*) FROM role_permissions rp
  JOIN permissions p ON p.uid = rp.permission_uid WHERE p.name LIKE 'ASSET\_COUNT%';
-- V129: new columns, relaxed NOT NULLs, new constraints.
SELECT 'ASSET_COLUMNS_MUST_BE_3', count(*) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('staff_liability', 'staff_liability_item')
  AND column_name IN ('asset_session_uid', 'asset_item_uid', 'asset_line_uid');
SELECT 'NULLABLE_MUST_BE_YES', table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('staff_liability', 'staff_liability_item')
  AND column_name IN ('session_uid', 'product_uid', 'counting_line_uid') ORDER BY 2, 3;
SELECT 'NEW_CONSTRAINTS_MUST_BE_6', count(*) FROM pg_constraint
WHERE conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass)
  AND conname IN ('fk_sl_asset_session', 'chk_sl_one_source', 'fk_sli_asset_item', 'fk_sli_asset_line', 'chk_sli_one_source', 'uq_sli_asset_line');
SELECT 'UQ_SLI_COUNTING_LINE_MUST_BE_1', count(*) FROM pg_constraint
WHERE conrelid = 'staff_liability_item'::regclass AND conname = 'uq_sli_counting_line';
SELECT 'CONSTRAINT', conrelid::regclass, contype, conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass) ORDER BY 2, 3, 4;
-- Must be FOREIGN_KEYS_KABLA (06-kabla-a.log) + 3: nothing dropped, three added.
SELECT 'FOREIGN_KEYS_BAADA', count(*) FROM pg_constraint
WHERE contype = 'f' AND conrelid IN ('staff_liability'::regclass, 'staff_liability_item'::regclass);
-- Existing rows are all stock rows: one source each, no asset column set.
SELECT 'SL_ASSET_SET_MUST_BE_0', count(*) FROM staff_liability WHERE asset_session_uid IS NOT NULL OR session_uid IS NULL;
SELECT 'SLI_ASSET_SET_MUST_BE_0', count(*) FROM staff_liability_item
WHERE asset_item_uid IS NOT NULL OR asset_line_uid IS NOT NULL OR product_uid IS NULL OR counting_line_uid IS NULL;
SELECT 'ASSET_ROWS_MUST_BE_0', (SELECT count(*) FROM asset_item) + (SELECT count(*) FROM asset_count_session) + (SELECT count(*) FROM asset_count_line);
ROLLBACK;
