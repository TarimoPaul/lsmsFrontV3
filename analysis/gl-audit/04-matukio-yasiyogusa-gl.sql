-- 04: Matukio yasiyogusa GL: yametokea mara ngapi prod, na TZS ngapi. Read-only.
-- T0 = GL live 2026-09-30 10:32:19 (gl_config.updated_at). Kabla ya T0, rebuild ya 09-30
-- ilisoma hali ya MWISHO ya source docs, kwa hiyo ni matukio ya BAADA ya T0 tu yanayoleta drift.
SET default_transaction_read_only = on;

-- 4.1 SALE EDITS: journal hai ya sale dhidi ya hali ya sasa ya sale (mapato na COGS).
WITH act AS (
  SELECT j.* FROM journal_entry j
  WHERE j.reference_type IN ('SALE_CASH','SALE_CREDIT','SALE_MIXED') AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid)),
gl AS (
  SELECT a.reference_uid sale_uid, a.created_at posted,
         coalesce(sum(l.credit_amount - l.debit_amount) FILTER (WHERE l.account_code IN ('4000','4010')),0) net_rev,
         coalesce(sum(l.debit_amount) FILTER (WHERE l.account_code='5000'),0) cogs
  FROM act a JOIN journal_entry_line l ON l.journal_entry_uid = a.uid GROUP BY 1,2),
src AS (
  SELECT s.uid, s.total_amount, s.is_deleted,
         (SELECT coalesce(sum(CASE WHEN d.total_cost > 0 THEN d.total_cost ELSE d.cost_per_piece*d.piece_quantity END),0)
            FROM sales_details d WHERE d.sale_uid = s.uid AND NOT d.is_deleted) cost
  FROM sales s)
SELECT CASE WHEN g.posted < '2026-09-30 10:32:19' THEN 'backfill' ELSE 'live' END chanzo,
       count(*) journals,
       count(*) FILTER (WHERE abs(g.net_rev - s.total_amount) >= 1) mapato_hayalingani,
       sum(s.total_amount - g.net_rev) FILTER (WHERE abs(g.net_rev - s.total_amount) >= 1) tofauti_mapato_tzs,
       count(*) FILTER (WHERE abs(g.cogs - s.cost) >= 1) cogs_hailingani,
       sum(s.cost - g.cogs) FILTER (WHERE abs(g.cogs - s.cost) >= 1) tofauti_cogs_tzs,
       count(*) FILTER (WHERE s.is_deleted) sale_imefutwa_journal_hai
FROM gl g JOIN src s ON s.uid = g.sale_uid GROUP BY 1;

-- 4.1b mifano (LIMIT 15)
WITH act AS (SELECT j.* FROM journal_entry j WHERE j.reference_type IN ('SALE_CASH','SALE_CREDIT','SALE_MIXED') AND NOT j.is_reversal
    AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid = j.uid))
SELECT s.receipt_number, a.created_at posted, s.updated_at, s.total_amount,
       sum(l.credit_amount - l.debit_amount) FILTER (WHERE l.account_code IN ('4000','4010')) gl_net_rev
FROM act a JOIN journal_entry_line l ON l.journal_entry_uid=a.uid JOIN sales s ON s.uid=a.reference_uid
GROUP BY 1,2,3,4 HAVING abs(coalesce(sum(l.credit_amount - l.debit_amount) FILTER (WHERE l.account_code IN ('4000','4010')),0) - s.total_amount) >= 1
ORDER BY 3 DESC LIMIT 15;

-- 4.1c Mistari ya sale iliyoongezwa baadaye / iliyofutwa (addSaleDetail/removeSaleDetail)
SELECT CASE WHEN d.created_at >= '2026-09-30 10:32:19' THEN 'baada_T0' ELSE 'kabla_T0' END kipindi,
       count(*) FILTER (WHERE d.created_at > s.created_at + interval '2 minutes') mistari_iliongezwa_baadaye,
       sum(d.sub_total) FILTER (WHERE d.created_at > s.created_at + interval '2 minutes') tzs_iliongezwa,
       count(*) FILTER (WHERE d.is_deleted) mistari_iliyofutwa, sum(d.sub_total) FILTER (WHERE d.is_deleted) tzs_iliyofutwa
FROM sales_details d JOIN sales s ON s.uid=d.sale_uid GROUP BY 1;

-- 4.2 PAYMENT EDITS / DELETES (updatePayment / deletePayment)
SELECT 'audit_trails Payments' chanzo, action, count(*) FROM audit_trails WHERE module='Payments' GROUP BY 2
UNION ALL SELECT 'sale_notes', 'Payment updated', count(*) FROM sales WHERE sale_notes LIKE '%Payment updated:%'
UNION ALL SELECT 'sale_notes', 'Payment deactivated', count(*) FROM sales WHERE sale_notes LIKE '%Payment deactivated:%'
UNION ALL SELECT 'payments', 'is_active=false, is_deleted=false', count(*) FROM payments WHERE NOT is_active AND NOT is_deleted
UNION ALL SELECT 'payments', 'is_deleted=true', count(*) FROM payments WHERE is_deleted
UNION ALL SELECT 'payments', 'is_reversal=true', count(*) FROM payments WHERE is_reversal;
SELECT CASE WHEN p.updated_at >= '2026-09-30 10:32:19' THEN 'baada_T0' ELSE 'kabla_T0' END kipindi, s.is_deleted sale_imefutwa,
       count(*) payments_zisizo_hai, sum(p.amount_paid) tzs
FROM payments p JOIN sales s ON s.uid=p.sale_uid WHERE NOT p.is_active AND NOT p.is_deleted GROUP BY 1,2;

-- 4.3 cancelPurchase ya purchase iliyokuwa APPROVED
SELECT CASE WHEN p.cancellation_date >= '2026-09-30 10:32:19' THEN 'baada_T0' ELSE 'kabla_T0' END kipindi,
       count(*) zilizofutwa, count(*) FILTER (WHERE p.approval_date IS NOT NULL) zilikuwa_approved,
       sum(p.total_amount) FILTER (WHERE p.approval_date IS NOT NULL) tzs_approved,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=p.uid AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))) zenye_journal_hai,
       sum(p.total_amount) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=p.uid AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))) tzs_journal_hai
FROM purchases p WHERE p.status='CANCELLED' GROUP BY 1;

-- 4.4 RECON REOPEN
SELECT (SELECT count(*) FROM reconciliation_audit_log WHERE action='REOPENED') reopened_events,
       (SELECT count(*) FROM reconciliation_audit_log WHERE action='REOPENED' AND created_at >= '2026-09-30 10:32:19') reopened_baada_T0,
       (SELECT count(*) FROM reconciliation_audit_log WHERE action='SNAPSHOT_SUPERSEDED') superseded,
       (SELECT count(*) FROM reconciliation_audit_log WHERE action='SNAPSHOT_SUPERSEDED' AND created_at >= '2026-09-30 10:32:19') superseded_baada_T0;
WITH v AS (
  SELECT f.reconciliation_uid, f.uid snap, f.snapshot_version, f.is_current, f.variance_amount
  FROM daily_financial_snapshot f
  JOIN journal_entry j ON j.reference_uid = f.uid AND j.reference_type='DAY_CLOSE_VARIANCE' AND NOT j.is_reversal
   AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))
SELECT count(DISTINCT reconciliation_uid) recon_zenye_variance_hai_zaidi_ya_1,
       count(*) FILTER (WHERE NOT is_current) snapshot_za_zamani_journal_hai,
       sum(variance_amount) FILTER (WHERE NOT is_current) variance_ya_zamani_bado_hai_tzs
FROM v WHERE reconciliation_uid IN (SELECT reconciliation_uid FROM v GROUP BY 1 HAVING count(*) > 1);
SELECT count(*) FILTER (WHERE f.is_current AND f.variance_amount <> 0 AND NOT EXISTS
          (SELECT 1 FROM journal_entry j WHERE j.reference_uid=f.uid AND NOT j.is_reversal)) current_bila_journal,
       sum(f.variance_amount) FILTER (WHERE f.is_current AND f.variance_amount <> 0 AND NOT EXISTS
          (SELECT 1 FROM journal_entry j WHERE j.reference_uid=f.uid AND NOT j.is_reversal)) tzs_current_bila_journal,
       count(*) FILTER (WHERE NOT f.is_current AND EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid=f.uid AND NOT j.is_reversal
          AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid))) zamani_journal_hai
FROM daily_financial_snapshot f;

-- 4.5 restoreDeletedSale
SELECT count(*) FILTER (WHERE sale_notes LIKE '%RESTORED:%') restored_notes,
       count(*) FILTER (WHERE is_active AND is_deleted) active_na_deleted,
       count(*) FILTER (WHERE is_deleted AND NOT is_active) zilizofutwa
FROM sales;

-- 4.6 deleteSale: journal ya :DEBT au ya sale bado hai ilhali sale imefutwa
SELECT 'DEBT' aina, count(*) idadi, sum(s.total_amount) tzs
FROM sales s JOIN journal_entry j ON j.reference_uid = s.uid||':DEBT' AND NOT j.is_reversal
WHERE s.is_deleted AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid)
UNION ALL
SELECT 'SALE', count(*), sum(s.total_amount)
FROM sales s JOIN journal_entry j ON j.reference_uid = s.uid AND NOT j.is_reversal
WHERE s.is_deleted AND NOT EXISTS (SELECT 1 FROM journal_entry r WHERE r.reversed_entry_uid=j.uid);
