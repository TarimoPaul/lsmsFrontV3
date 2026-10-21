-- 06: Chanzo cha AR ya 01/09 kubadilika 1,672,000 -> 1,693,000. Read-only.
SET default_transaction_read_only = on;
-- 6.1 GL AR (1100+1110) hadi tarehe 2026-09-01 (entry_date <= 09-01), kwa mujibu wa created_at
SELECT CASE WHEN j.created_at < '2026-09-30 10:32:19' THEN 'a) rebuild 09-30'
            WHEN j.created_at < '2026-10-07' THEN 'b) live 09-30..10-06'
            ELSE 'c) live >= 10-07' END kundi,
       count(DISTINCT j.uid) journals, sum(l.debit_amount - l.credit_amount) ar_net
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
WHERE l.account_code IN ('1100','1110') AND j.entry_date <= '2026-09-01'
GROUP BY ROLLUP(1) ORDER BY 1;
-- 6.2 entries zenye entry_date <= 09-01 lakini zimeundwa baada ya rebuild (zinabadilisha historia)
SELECT j.entry_number, j.reference_type, j.reference_number, j.entry_date, j.created_at, j.is_reversal, j.posted_by,
       sum(l.debit_amount - l.credit_amount) FILTER (WHERE l.account_code IN ('1100','1110')) ar_athari
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
WHERE j.entry_date <= '2026-09-01' AND j.created_at >= '2026-09-30 10:32:19'
GROUP BY j.uid, 1,2,3,4,5,6,7 ORDER BY j.created_at;
-- 6.3 kila tarehe ya created_at: AR ya 01/09 ingeonekana kiasi gani siku hiyo (AR as-of 09-01 inavyoonekana kwa wakati)
SELECT d::date siku_ya_kuangalia,
       (SELECT sum(l.debit_amount - l.credit_amount) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid=j.uid
         WHERE l.account_code IN ('1100','1110') AND j.entry_date <= '2026-09-01' AND j.created_at < d + interval '1 day') ar_0109
FROM generate_series('2026-09-30'::date, '2026-10-14'::date, interval '1 day') d;
-- 6.4 Rebuild ilitumia hali ya sasa ya source docs: madeni ya sales za <= 09-01 yaliyobadilika baada ya 09-30
SELECT s.receipt_number, s.sale_source, s.sale_date::date, s.total_amount, s.outstanding_balance, s.updated_at, s.is_deleted
FROM sales s WHERE s.sale_date < '2026-09-02' AND s.updated_at >= '2026-09-30 10:32:19'
ORDER BY s.updated_at LIMIT 30;
-- 6.5 debt_adjustment (posting kwa LocalDate.now(), si tarehe ya tukio)
SELECT d.uid, d.type, d.status, d.amount, d.created_at, d.approved_at, s.receipt_number, s.sale_date::date,
       (SELECT string_agg(j.entry_date::text||' '||j.reference_type, ',') FROM journal_entry j WHERE j.reference_uid=d.uid) journal
FROM debt_adjustment d JOIN sales s ON s.uid=d.sale_uid ORDER BY d.created_at;
