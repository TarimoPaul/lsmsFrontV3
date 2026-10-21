-- 03: Chart of accounts kamili. Read-only.
SET default_transaction_read_only = on;
SELECT account_code, account_name, account_name_sw, account_type, account_category, normal_balance, is_active, is_system
FROM gl_account ORDER BY account_code;
