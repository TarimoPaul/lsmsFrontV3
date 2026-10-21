-- HATUA 42 (KUSOMA TU): ukaguzi wa ruhusa baada ya mmiliki kuondoa FINANCE_WRITE kwenye "Executive CEO" kupitia Roles UI.
-- HAIENDESHWI KWENYE DB YA PROD (kanuni ya 15/10). Endesha kwenye nakala iliyorejeshwa kutoka dump ya usiku iliyofuata
-- mabadiliko hayo (lsms_audit_YYYYMMDD_0200), au kwenye staging. Andika jina la DB juu ya matokeo.
-- LAZIMA: FW_ROLES = 'CEO' tu; FW_ROLE_COUNT_MUST_BE_1 = 1; FW_USER_GRANTS_MUST_BE_0 = 0.
BEGIN TRANSACTION READ ONLY;
SELECT 'DB|' || current_database() || '|' || now()::timestamp(0);
SELECT 'FW_ROLES|' || coalesce(string_agg(r.name || ' (' || r.status || CASE WHEN r.is_deleted THEN ', deleted' ELSE '' END || ')', ', ' ORDER BY r.name), '(hakuna)')
  FROM role_permissions rp JOIN roles r ON r.uid = rp.role_uid JOIN permissions p ON p.uid = rp.permission_uid
 WHERE p.name = 'FINANCE_WRITE';
SELECT 'FW_ROLE_COUNT_MUST_BE_1|' || count(*)
  FROM role_permissions rp JOIN roles r ON r.uid = rp.role_uid JOIN permissions p ON p.uid = rp.permission_uid
 WHERE p.name = 'FINANCE_WRITE' AND NOT r.is_deleted;
SELECT 'FW_IS_CEO_MUST_BE_1|' || count(*)
  FROM role_permissions rp JOIN roles r ON r.uid = rp.role_uid JOIN permissions p ON p.uid = rp.permission_uid
 WHERE p.name = 'FINANCE_WRITE' AND r.name = 'CEO' AND NOT r.is_deleted;
-- ruhusa ya mtumiaji mmoja mmoja (permission_config) isiwepo kwa FINANCE_WRITE
SELECT 'FW_USER_GRANTS_MUST_BE_0|' || count(*)
  FROM permission_config c JOIN permissions p ON p.uid = c.permission_uid
 WHERE p.name = 'FINANCE_WRITE' AND NOT c.is_deleted AND c.is_active;
-- wanaopata FINANCE_WRITE kupitia role (ROOT wanapita kila ruhusa na wameorodheshwa chini)
SELECT 'FW_USER|' || u.email || '|' || r.name || '|' || u.status
  FROM users u JOIN user_roles ur ON ur.user_uid = u.uid JOIN roles r ON r.uid = ur.role_uid
  JOIN role_permissions rp ON rp.role_uid = r.uid JOIN permissions p ON p.uid = rp.permission_uid
 WHERE p.name = 'FINANCE_WRITE' AND NOT u.is_deleted ORDER BY u.email;
-- ROOT: hali ya akaunti mbili (mmiliki anathibitisha kabla ya hatua za prod za 1.8)
SELECT 'ROOT|' || u.email || '|status=' || u.status || '|active=' || u.is_active || '|locked=' || u.is_locked
       || '|deleted=' || u.is_deleted || '|last_login=' || coalesce(u.last_login_at::text, '-')
  FROM users u WHERE u.is_root ORDER BY u.email;
ROLLBACK;
