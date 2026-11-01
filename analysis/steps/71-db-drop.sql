-- HATUA 71-db (INAFUTA) - DROP za DB 6 za LSMS kwenye PG ya local (mmiliki 29/10 ao, as.0c). Inaendeshwa na 71-db.cmd
-- BAADA ya 71-db-soma.sql, pg_dump + pg_restore --list za LocalLsms/LsmsAngular/Lsms (D:\LSMS-ARCHIVE\db\), na neno SAFISHA.
-- Hakuna WITH (FORCE): DB yenye muunganisho inakataa, na hatua inasimama.
-- BAKI (hazitajwi hapa): lsms_test_reco (dev), lsms_audit_20261015_0200, lsms_returns_scratch.
\set ON_ERROR_STOP on
DROP DATABASE IF EXISTS lsms_audit;
DROP DATABASE IF EXISTS lsms_audit_1004;
DROP DATABASE IF EXISTS lsms_toleo1_scratch;
DROP DATABASE IF EXISTS "LocalLsms";
DROP DATABASE IF EXISTS "LsmsAngular";
DROP DATABASE IF EXISTS "Lsms";
select 'DROP_ZIMEKAMILIKA ' || (6 - count(*)) || ' kati ya 6'
from pg_database where datname in ('lsms_audit', 'lsms_audit_1004', 'lsms_toleo1_scratch', 'LocalLsms', 'LsmsAngular', 'Lsms');
select 'DB_ZA_KUBAKI_ZILIZOPO ' || count(*) from pg_database
where datname in ('lsms_test_reco', 'lsms_audit_20261015_0200', 'lsms_returns_scratch');
