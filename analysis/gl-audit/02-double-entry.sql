-- 02: DOUBLE ENTRY. Read-only.
SET default_transaction_read_only = on;
-- a) journal ambazo lines zake Dr <> Cr, au header <> lines
SELECT j.entry_number, j.reference_type, j.total_debit, j.total_credit, sum(l.debit_amount) dr, sum(l.credit_amount) cr
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
WHERE NOT j.is_deleted
GROUP BY j.uid, j.entry_number, j.reference_type, j.total_debit, j.total_credit
HAVING sum(l.debit_amount) <> sum(l.credit_amount) OR sum(l.debit_amount) <> j.total_debit OR sum(l.credit_amount) <> j.total_credit
LIMIT 50;
-- b) Trial balance jumla
SELECT sum(l.debit_amount) dr, sum(l.credit_amount) cr, sum(l.debit_amount) - sum(l.credit_amount) tofauti
FROM journal_entry_line l JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE NOT j.is_deleted;
-- c) lines zenye 0/0, hasi, akaunti isiyokuwepo/isiyo hai, jina/code lisilolingana
SELECT 'zero' tatizo, count(*) FROM journal_entry_line WHERE debit_amount = 0 AND credit_amount = 0
UNION ALL SELECT 'hasi', count(*) FROM journal_entry_line WHERE debit_amount < 0 OR credit_amount < 0
UNION ALL SELECT 'pande_zote', count(*) FROM journal_entry_line WHERE debit_amount > 0 AND credit_amount > 0
UNION ALL SELECT 'akaunti_haipo', count(*) FROM journal_entry_line l WHERE NOT EXISTS (SELECT 1 FROM gl_account a WHERE a.uid = l.account_uid)
UNION ALL SELECT 'code_hailingani', count(*) FROM journal_entry_line l JOIN gl_account a ON a.uid = l.account_uid WHERE a.account_code <> l.account_code
UNION ALL SELECT 'akaunti_si_hai', count(*) FROM journal_entry_line l JOIN gl_account a ON a.uid = l.account_uid WHERE NOT a.is_active
UNION ALL SELECT 'journal_bila_lines', count(*) FROM journal_entry j WHERE NOT EXISTS (SELECT 1 FROM journal_entry_line l WHERE l.journal_entry_uid = j.uid)
UNION ALL SELECT 'is_balanced_false', count(*) FROM journal_entry WHERE NOT is_balanced
UNION ALL SELECT 'deleted', count(*) FROM journal_entry WHERE is_deleted
UNION ALL SELECT 'reversal_bila_original', count(*) FROM journal_entry r WHERE r.is_reversal AND NOT EXISTS (SELECT 1 FROM journal_entry o WHERE o.uid = r.reversed_entry_uid)
UNION ALL SELECT 'reversed_mara_2', count(*) FROM (SELECT reversed_entry_uid FROM journal_entry WHERE is_reversal AND NOT is_deleted GROUP BY 1 HAVING count(*) > 1) x
UNION ALL SELECT 'entry_date_ya_baadaye(>2026-10-14)', count(*) FROM journal_entry WHERE entry_date > '2026-10-14';
-- d) Trial balance kwa akaunti
SELECT a.account_code, a.account_name, a.account_type, a.normal_balance,
       sum(l.debit_amount) dr, sum(l.credit_amount) cr, sum(l.debit_amount - l.credit_amount) salio_dr
FROM gl_account a LEFT JOIN journal_entry_line l ON l.account_uid = a.uid
GROUP BY 1,2,3,4 HAVING count(l.*) > 0 ORDER BY 1;
