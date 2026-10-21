-- HATUA 36-0 (STAGING, KUSOMA TU): postgres ya staging inajibu? DB, user, toleo, SELECT 1, orodha ya DB.
BEGIN TRANSACTION READ ONLY;
SELECT 'DB|' || current_database() || '|user=' || current_user || '|postgres ' || split_part(version(), ' ', 2);
SELECT 'SELECT1|' || 1;
SELECT 'DBS|' || string_agg(datname, ',' ORDER BY datname) FROM pg_database WHERE NOT datistemplate;
SELECT 'FLYWAY_YA_MWISHO|' || version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1;
ROLLBACK;
