-- READ-ONLY. After backend 2.2.70: V133 applied (owner_uid + permission SAFEBOX_DEPOSIT_ON_BEHALF).
-- Lines come out as NAME|value|value...
BEGIN TRANSACTION READ ONLY;
SELECT concat_ws('|', 'FLYWAY', version, description, success, installed_on) FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
SELECT concat_ws('|', 'FLYWAY_FAILED_MUST_BE_0', count(*)) FROM flyway_schema_history WHERE success = false;
SELECT concat_ws('|', 'FLYWAY_133_MUST_BE_1', count(*)) FROM flyway_schema_history WHERE version = '133' AND success;
SELECT concat_ws('|', 'OWNER_UID_COL_MUST_BE_1', count(*)) FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'safe_box_deposits' AND column_name = 'owner_uid' AND is_nullable = 'YES';
SELECT concat_ws('|', 'OWNER_UID_NULL_MUST_BE_0', count(*)) FROM safe_box_deposits WHERE owner_uid IS NULL;
SELECT concat_ws('|', 'OWNER_UID_SI_MMILIKI_WA_RECON_MUST_BE_0', count(*))
FROM safe_box_deposits sbd JOIN daily_reconciliation dr ON dr.uid = sbd.source_recon_uid
WHERE sbd.owner_uid IS DISTINCT FROM dr.user_uid;
SELECT concat_ws('|', 'DEPOSITS_ZOTE', count(*), COALESCE(sum(submitted_amount), 0)) FROM safe_box_deposits;
SELECT concat_ws('|', 'KWA_NIABA', status, count(*), sum(submitted_amount))
FROM safe_box_deposits WHERE cashier_uid IS DISTINCT FROM owner_uid GROUP BY status ORDER BY status;
SELECT concat_ws('|', 'RUHUSA_MUST_BE_1', count(*)) FROM permissions WHERE name = 'SAFEBOX_DEPOSIT_ON_BEHALF' AND is_deleted = false;
SELECT concat_ws('|', 'RUHUSA_KWA_ROLE', COALESCE(string_agg(r.name, ', ' ORDER BY r.name), 'HAKUNA_ROLE'))
FROM permissions p
LEFT JOIN role_permissions rp ON rp.permission_uid = p.uid
LEFT JOIN roles r ON r.uid = rp.role_uid
WHERE p.name = 'SAFEBOX_DEPOSIT_ON_BEHALF';
SELECT concat_ws('|', 'SAFE_BOX_DEPOSITS_BY_STATUS', status, count(*), sum(submitted_amount)) FROM safe_box_deposits WHERE is_deleted = false GROUP BY status ORDER BY status;
ROLLBACK;
