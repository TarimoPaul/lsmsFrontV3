-- 16 (sehemu i, kipengele 2): mapengo kati ya reco na GL.
-- DB: lsms_audit_20261015_0200. Kusoma tu. T0 = 2026-09-30 10:32:19 (GL live). "zote" = historia yote iliyomo kwenye GL (rebuild + live).
SET default_transaction_read_only = on;

-- 2a) Gharama za reco (reconciliation_expenses) dhidi ya journal ya gharama (EXPENSE_DIRECT ya capex iliyounganishwa)
WITH x AS (
  SELECT e.uid, e.amount, e.created_at, r.reconciliation_date d, r.status reco_status,
         c.uid capex_uid, c.status capex_status, coalesce(c.is_deleted,false) capex_deleted, c.amount capex_amount,
         (SELECT sum(j.total_debit) FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry rv WHERE rv.reversed_entry_uid = j.uid)) je_amount
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid
  LEFT JOIN capital_expenditure c ON c.uid = e.capital_expenditure_uid
  WHERE NOT e.is_deleted AND NOT r.is_deleted),
k AS (
  SELECT x.*, CASE
      WHEN capex_uid IS NULL THEN '1 hakuna capex'
      WHEN capex_deleted THEN '2 capex imefutwa'
      WHEN je_amount IS NULL AND capex_status <> 'APPROVED' THEN '3 capex ' || capex_status || ' (haijaidhinishwa)'
      WHEN je_amount IS NULL THEN '4 capex APPROVED bila journal'
      WHEN je_amount <> amount THEN '5 journal kiasi tofauti'
      ELSE '0 sawa' END hali
  FROM x)
SELECT hali, reco_status, count(*) idadi, round(sum(amount)) reco_tzs, round(sum(coalesce(je_amount,0))) gl_tzs,
       count(*) FILTER (WHERE created_at >= '2026-09-30 10:32:19') baada_ya_t0, round(sum(amount) FILTER (WHERE created_at >= '2026-09-30 10:32:19')) baada_ya_t0_tzs
FROM k GROUP BY ROLLUP ((hali, reco_status)) ORDER BY hali NULLS LAST, reco_status;
-- 2a kwa mwezi: zisizo na journal (hali <> sawa)
WITH x AS (
  SELECT e.amount, r.reconciliation_date d, c.uid capex_uid,
         (SELECT sum(j.total_debit) FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal
            AND NOT EXISTS (SELECT 1 FROM journal_entry rv WHERE rv.reversed_entry_uid = j.uid)) je_amount, coalesce(c.is_deleted,false) cdel
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid
  LEFT JOIN capital_expenditure c ON c.uid = e.capital_expenditure_uid
  WHERE NOT e.is_deleted AND NOT r.is_deleted)
SELECT date_trunc('month', d)::date mwezi, count(*) reco_expenses, round(sum(amount)) reco_tzs,
       count(*) FILTER (WHERE je_amount IS NULL OR cdel) bila_journal, round(sum(amount) FILTER (WHERE je_amount IS NULL OR cdel)) bila_journal_tzs,
       round(sum(amount - je_amount) FILTER (WHERE je_amount IS NOT NULL AND NOT cdel AND je_amount <> amount)) tofauti_ya_kiasi
FROM x GROUP BY 1 ORDER BY 1;

-- 2b) Gharama zinazohesabiwa mara mbili kwenye GL: gharama ya reco (capex yake ya RECONCILIATION) NA capex nyingine ya DIRECT
--     yenye tarehe na kiasi kilekile, zote zikiwa na journal hai. Kulinganisha kwa tarehe+kiasi ni (likely), si uthibitisho.
WITH re AS (
  SELECT e.uid, e.amount, r.reconciliation_date d, lower(e.description) descr, e.capital_expenditure_uid cu
  FROM reconciliation_expenses e JOIN daily_reconciliation r ON r.uid = e.reconciliation_uid WHERE NOT e.is_deleted AND NOT r.is_deleted),
dc AS (
  SELECT c.uid, c.amount, c.transaction_date::date d, lower(c.description) descr, c.expenditure_type, c.reference_number
  FROM capital_expenditure c
  WHERE NOT coalesce(c.is_deleted,false) AND coalesce(c.source,'') <> 'RECONCILIATION' AND c.status = 'APPROVED'
    AND c.expenditure_type IN ('DAILY_EXPENSE','MONTHLY_EXPENSE')
    AND EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal))
SELECT re.d, re.amount, re.descr reco_maelezo, dc.reference_number, dc.expenditure_type, dc.descr capex_maelezo,
       (SELECT count(*) FROM journal_entry j WHERE j.reference_uid = re.cu AND NOT j.is_deleted AND NOT j.is_reversal) reco_ina_journal
FROM re JOIN dc ON dc.d = re.d AND dc.amount = re.amount ORDER BY 1;
-- capex DIRECT za kila siku za GHARAMA (OPERATIONAL_CAPITAL; si PRODUCT/INVENTORY_CAPITAL ambazo ni mirror za purchases):
-- ziko GL kama EXPENSE_DIRECT, lakini Daily P&L haizisomi (P&L inasoma reconciliation_expenses tu kwa gharama za kila siku)
SELECT date_trunc('month', c.transaction_date)::date mwezi, c.capital_type, count(*), round(sum(c.amount)) tzs,
       count(*) FILTER (WHERE EXISTS (SELECT 1 FROM journal_entry j WHERE j.reference_uid = c.uid AND NOT j.is_deleted AND NOT j.is_reversal)) zina_journal,
       count(*) FILTER (WHERE c.created_at >= '2026-09-30 10:32:19') baada_ya_t0
FROM capital_expenditure c
WHERE NOT coalesce(c.is_deleted,false) AND c.expenditure_type = 'DAILY_EXPENSE' AND coalesce(c.source,'') <> 'RECONCILIATION'
  AND c.status = 'APPROVED' AND c.capital_type NOT IN ('PRODUCT_CAPITAL','INVENTORY_CAPITAL')
GROUP BY ROLLUP ((1, 2)) ORDER BY 1 NULLS LAST;

-- 2c) Reco purchases dhidi ya purchases (purchase_uid ni tupu kwa zote): kwa mwezi.
--     "inalingana_moja" = kuna purchase RECEIVED ya tarehe ileile yenye total_amount = kiasi cha reco (likely).
WITH rp AS (
  SELECT p.amount, r.reconciliation_date d, p.purchase_uid
  FROM reconciliation_purchases p JOIN daily_reconciliation r ON r.uid = p.reconciliation_uid WHERE NOT p.is_deleted AND NOT r.is_deleted),
pu AS (
  SELECT purchase_date::date d, total_amount, supplier_uid FROM purchases WHERE NOT coalesce(is_deleted,false) AND status = 'RECEIVED'),
a AS (
  SELECT date_trunc('month', rp.d)::date mwezi, count(*) reco_purch, round(sum(rp.amount)) reco_tzs,
         count(*) FILTER (WHERE rp.purchase_uid IS NOT NULL) zina_purchase_uid,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM pu WHERE pu.d = rp.d AND pu.total_amount = rp.amount)) inalingana_moja,
         round(sum(rp.amount) FILTER (WHERE NOT EXISTS (SELECT 1 FROM pu WHERE pu.d = rp.d AND pu.total_amount = rp.amount))) haipatikani_tzs,
         round(sum(rp.amount) FILTER (WHERE NOT EXISTS (SELECT 1 FROM pu WHERE pu.d = rp.d))) siku_bila_purchase_yoyote_tzs
  FROM rp GROUP BY 1),
b AS (
  SELECT date_trunc('month', d)::date mwezi, round(sum(total_amount)) purchases_tzs,
         round(sum(total_amount) FILTER (WHERE supplier_uid IS NULL OR supplier_uid = '')) bila_supplier_tzs
  FROM pu GROUP BY 1)
SELECT a.*, b.purchases_tzs, b.bila_supplier_tzs FROM a LEFT JOIN b USING (mwezi) ORDER BY 1;
-- 2c (siku): jumla ya reco purchases ya siku dhidi ya purchases RECEIVED za siku hiyo.
-- "ziada ya reco" = reco > purchases zote za siku: sehemu hiyo HAIWEZI kuwa ndani ya purchase yoyote ya siku hiyo,
-- kwa hiyo pesa ilitoka droo bila purchase kwenye mfumo (Cash 1000 ya GL iko juu kwa kiasi hicho) (likely: purchase inaweza kuwa ya tarehe nyingine).
WITH rp AS (SELECT r.reconciliation_date d, sum(p.amount) reco FROM reconciliation_purchases p JOIN daily_reconciliation r ON r.uid = p.reconciliation_uid
            WHERE NOT p.is_deleted AND NOT r.is_deleted GROUP BY 1),
pu AS (SELECT purchase_date::date d, sum(total_amount) pur, count(*) n FROM purchases WHERE NOT coalesce(is_deleted,false) AND status = 'RECEIVED' GROUP BY 1)
SELECT date_trunc('month', rp.d)::date mwezi, count(*) siku, round(sum(rp.reco)) reco_tzs,
       count(*) FILTER (WHERE rp.reco <= coalesce(pu.pur,0)) siku_reco_ndani_ya_purchases,
       round(sum(greatest(rp.reco - coalesce(pu.pur,0), 0))) ziada_ya_reco_juu_ya_purchases_tzs
FROM rp LEFT JOIN pu USING (d) GROUP BY ROLLUP (1) ORDER BY 1 NULLS LAST;
