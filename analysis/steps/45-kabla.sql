-- HATUA 45b (STAGING iliyorejeshwa kutoka dump ya prod ya usiku huu, KUSOMA TU): data ya mazoezi na ya prod ya §1.8.
-- Vipande vimenakiliwa bila kubadilishwa kutoka 39-toleo1-kabla.sql (H2SALE, Q9SNAP, AR, GL_1000, makosa, M7J).
-- Uids ni zilezile kwenye prod (staging ni nakala ya dump ya prod ya leo), kwa hiyo hakuna query kwenye DB ya prod.
BEGIN TRANSACTION READ ONLY;
SELECT 'DB|' || current_database() || '|' || now()::timestamp(0);
SELECT 'FLYWAY_YA_MWISHO|' || version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1;
SELECT 'GL_CONFIG|posting_enabled=' || posting_enabled || '|shadow_mode=' || shadow_mode FROM gl_config LIMIT 1;
-- H-2: sales STANDARD tangu GL live (T0 = 2026-09-30 10:32:19) zisizo na journal yoyote hai (pamoja na zilizolipwa baadaye,
-- mf. 121026-2249). Ya mwisho ni deni la sasa; AR ya journal itakuwa deni la siku ya mauzo.
SELECT 'H2SALE|' || s.uid || '|' || s.receipt_number || '|' || s.total_amount || '|' || coalesce(s.outstanding_balance, 0)
FROM sales s
WHERE NOT coalesce(s.is_deleted, false) AND coalesce(s.is_active, true) AND s.sale_source = 'STANDARD'
  AND s.created_at >= '2026-09-30 10:32:19'
  AND coalesce(s.sale_notes, '') !~ '(^|\n)QA-'  -- dokezo la backend liko MBELE (Sales.addNote); NOT LIKE 'QA-%' haikutoa sales za QA
  AND NOT EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = s.uid AND NOT j.is_reversal AND NOT coalesce(j.is_deleted, false))
ORDER BY s.created_at;
-- Q9 (uamuzi wa mmiliki 16/10): K2 za 24/06 na 04/07 kwenye PROD zinakwenda 2900, si 6700. Staging inabaki na 6700;
-- awamu A inaonyesha tofauti kwa dryRun ya pili yenye uids hizi (haiandiki chochote).
SELECT 'Q9SNAP|' || f.uid || '|' || f.snapshot_date || '|' || f.variance_amount || '|' || f.declared_cash
FROM daily_financial_snapshot f
WHERE f.is_current AND f.snapshot_date IN ('2026-06-24', '2026-07-04') AND f.variance_amount < 0 AND f.declared_cash > 0
ORDER BY f.snapshot_date;
-- AR: GL dhidi ya sub-ledger (kabla)
SELECT 'AR_GL|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code IN ('1100', '1110') AND NOT coalesce(j.is_deleted, false);
SELECT 'AR_SUBLEDGER|' || coalesce(sum(outstanding_balance), 0) FROM sales
 WHERE NOT coalesce(is_deleted, false) AND coalesce(is_active, true) AND outstanding_balance > 0;
SELECT 'GL_1000|' || coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry_line l
  JOIN journal_entry j ON j.uid = l.journal_entry_uid WHERE l.account_code = '1000' AND NOT coalesce(j.is_deleted, false);
SELECT 'FAILURES_OPEN|' || count(*) FROM gl_posting_failure WHERE resolved_at IS NULL;
-- M-7 (19/10): journals 7 za PURCHASE_PAYMENT za 04/10 zinazohamishiwa 30/09 kabla ya kufunga Septemba (awamu B)
SELECT 'M7J|' || j.uid || '|' || j.entry_number || '|' || j.total_debit FROM journal_entry j
 WHERE NOT j.is_deleted AND NOT j.is_reversal AND j.reference_type = 'PURCHASE_PAYMENT' AND j.entry_date = '2026-10-04'
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT r.is_deleted) ORDER BY j.uid;
ROLLBACK;
