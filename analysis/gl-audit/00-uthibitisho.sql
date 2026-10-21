-- 00: Uthibitisho wa nakala (lsms_audit = prod dump 2026-10-14 02:00). Read-only.
SET default_transaction_read_only = on;
SELECT current_database() db, now() run_at;
SELECT count(*) sales_zote, count(*) FILTER (WHERE is_deleted) zilizofutwa, max(created_at) max_created_at FROM sales;
SELECT max(version::numeric) flyway_juu, count(*) migrations FROM flyway_schema_history WHERE success AND version IS NOT NULL;
SELECT version, description, installed_on FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 3;
