-- 14 (Awamu 1b, kipengele 2): salio la akaunti zote za pesa (10xx) kwenye GL, na mahali reco inaonyesha pesa ilienda.
-- DB: lsms_audit_20261015_0200 (data hadi 14/10 23:58). Kusoma tu.
SET default_transaction_read_only = on;
-- 1) GL: kila akaunti ya pesa ya chart, salio mwisho wa 13/10 na 14/10
SELECT a.account_code, a.account_name_sw,
       coalesce(sum(l.debit_amount - l.credit_amount) FILTER (WHERE j.entry_date <= '2026-10-13'),0) salio_1310,
       coalesce(sum(l.debit_amount - l.credit_amount) FILTER (WHERE j.entry_date <= '2026-10-14'),0) salio_1410
FROM gl_account a
LEFT JOIN journal_entry_line l ON l.account_code = a.account_code
LEFT JOIN journal_entry j ON j.uid = l.journal_entry_uid AND NOT j.is_deleted
WHERE a.account_code LIKE '10%'
GROUP BY 1,2 ORDER BY 1;
-- 2) reco: pesa iliyopelekwa benki moja kwa moja kutoka droo (BANK_DEPOSIT), kwa benki, hadi 14/10
SELECT 'droo->benki' njia, coalesce(upper(c.bank_name),'(bila jina)') benki, count(*), round(sum(c.amount)) tzs, min(r.reconciliation_date), max(r.reconciliation_date)
FROM reconciliation_cash_entries c JOIN daily_reconciliation r ON r.uid = c.reconciliation_uid
WHERE NOT c.is_deleted AND NOT r.is_deleted AND r.status <> 'DRAFT' AND c.entry_type = 'BANK_DEPOSIT' AND r.reconciliation_date <= '2026-10-14'
GROUP BY 1,2
UNION ALL
SELECT 'safe box->benki', coalesce(upper(d.bank_name),'(bila jina)'), count(*), round(sum(d.submitted_amount)), min(d.confirmed_at)::date, max(d.confirmed_at)::date
FROM safe_box_deposits d WHERE NOT d.is_deleted AND d.status = 'CONFIRMED' AND d.deposit_type = 'BANK_DEPOSIT' GROUP BY 1,2
ORDER BY 1, 4 DESC;
-- 3) safe box: kilichoingia (reco SAFE_BOX) - kilichotoka (deposits CONFIRMED) = kinachotarajiwa kuwa ndani ya safe box au kwa aliyekabidhiwa
SELECT (SELECT round(sum(c.amount)) FROM reconciliation_cash_entries c JOIN daily_reconciliation r ON r.uid=c.reconciliation_uid
         WHERE NOT c.is_deleted AND NOT r.is_deleted AND r.status<>'DRAFT' AND c.entry_type='SAFE_BOX') kiliingia_safe_box,
       (SELECT round(sum(submitted_amount)) FROM safe_box_deposits WHERE NOT is_deleted AND status='CONFIRMED' AND deposit_type='BANK_DEPOSIT') kwenda_benki,
       (SELECT round(sum(submitted_amount)) FROM safe_box_deposits WHERE NOT is_deleted AND status='CONFIRMED' AND deposit_type='HAND_OVER') kukabidhiwa,
       (SELECT round(sum(submitted_amount)) FROM safe_box_deposits WHERE NOT is_deleted AND status NOT IN ('CONFIRMED','CANCELLED','REJECTED')) bado_kuthibitishwa;
-- 4) reco: mobile money (mauzo yaliyopokelewa kwa simu), kwa mtandao
SELECT coalesce(upper(m.provider),'(bila jina)') mtandao, count(*), round(sum(m.amount)) tzs
FROM reconciliation_mobile_entries m JOIN daily_reconciliation r ON r.uid = m.reconciliation_uid
WHERE NOT m.is_deleted AND NOT r.is_deleted AND r.status <> 'DRAFT' GROUP BY 1 ORDER BY 3 DESC;
-- 5) droo: pesa iliyotangazwa kwenye reco ya mwisho (CASH_IN_HAND + petty)
SELECT reconciliation_date, user_name, status, cash_on_hand_declared, petty_cash_total
FROM daily_reconciliation WHERE NOT is_deleted ORDER BY reconciliation_date DESC, created_at DESC LIMIT 3;
-- 6) ulinganisho na lsms_audit (14/10): journals zenye entry_date <= 13/10 zilizoundwa BAADA ya dump ya 14/10 (2026-10-14 00:24:29.763626)
SELECT j.entry_date, j.created_at, j.reference_type, j.reference_number, l.account_code, l.debit_amount, l.credit_amount, l.description
FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
WHERE NOT j.is_deleted AND j.entry_date <= '2026-10-13' AND j.created_at > '2026-10-14 00:24:29.763626' AND l.account_code LIKE '10%'
ORDER BY j.created_at;
