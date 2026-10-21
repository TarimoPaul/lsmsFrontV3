-- 12 (Awamu 1b, kipengele 4): reconciliation_debt_payments zenye amount_paid = 0.
-- DB: lsms_audit_20261015_0200. Kusoma tu.
-- debt_uid -> reconciliation_retail_debts.uid; sale_payment_uid -> payments.uid (malipo halisi ya POS).
SET default_transaction_read_only = on;
SELECT count(*) zote, count(*) FILTER (WHERE amount_paid = 0) sifuri, count(*) FILTER (WHERE amount_paid = 0 AND NOT is_deleted) sifuri_hai,
       count(*) FILTER (WHERE amount_paid < 0) hasi
FROM reconciliation_debt_payments;
-- muhtasari wa safu 0 hai
WITH z AS (
  SELECT dp.*, d.amount deni, d.sale_date deni_date, d.is_paid, s.outstanding_balance sale_out, s.sale_source,
         p.amount_paid pos_amt, p.payment_date pos_date, p.payment_status pos_status,
         (SELECT count(*) FROM reconciliation_debt_payments o WHERE o.debt_uid = dp.debt_uid AND o.amount_paid > 0 AND NOT o.is_deleted) safu_nyingine_zenye_kiasi
  FROM reconciliation_debt_payments dp
  LEFT JOIN reconciliation_retail_debts d ON d.uid = dp.debt_uid
  LEFT JOIN sales s ON s.uid = d.sale_uid
  LEFT JOIN payments p ON p.uid = dp.sale_payment_uid
  WHERE dp.amount_paid = 0 AND NOT dp.is_deleted)
SELECT count(*) safu, count(DISTINCT debt_uid) madeni,
       count(*) FILTER (WHERE sale_payment_uid IS NULL) bila_pos_payment,
       count(*) FILTER (WHERE pos_amt > 0) pos_ina_kiasi, round(sum(pos_amt) FILTER (WHERE pos_amt > 0)) pos_tzs,
       count(*) FILTER (WHERE safu_nyingine_zenye_kiasi > 0) deni_lina_safu_nyingine_yenye_kiasi,
       count(*) FILTER (WHERE safu_nyingine_zenye_kiasi = 0 AND pos_amt > 0) kiasi_kiko_pos_tu,
       round(sum(pos_amt) FILTER (WHERE safu_nyingine_zenye_kiasi = 0 AND pos_amt > 0)) kiasi_kiko_pos_tu_tzs,
       count(*) FILTER (WHERE paid_at::date = deni_date) paid_at_ni_siku_ya_deni,
       count(*) FILTER (WHERE pos_date::date <> paid_at::date) tarehe_tofauti_na_pos,
       count(*) FILTER (WHERE sale_source = 'RECONCILIATION_MANUAL') walk_in,
       min(paid_at)::date kuanzia, max(paid_at)::date hadi
FROM z;
-- kwa mwezi
SELECT date_trunc('month', paid_at)::date mwezi, count(*) FILTER (WHERE amount_paid = 0) sifuri, count(*) FILTER (WHERE amount_paid > 0) zenye_kiasi
FROM reconciliation_debt_payments WHERE NOT is_deleted GROUP BY 1 ORDER BY 1;
-- H-6: sale 150826-0000-3 (14/10 iliripotiwa kama safu moja ya 0.00)
SELECT dp.paid_at, dp.amount_paid, p.amount_paid pos_amt, p.payment_date
FROM reconciliation_debt_payments dp JOIN reconciliation_retail_debts d ON d.uid = dp.debt_uid JOIN sales s ON s.uid = d.sale_uid
LEFT JOIN payments p ON p.uid = dp.sale_payment_uid WHERE s.receipt_number = '150826-0000-3' ORDER BY 1;
-- Safu 0 ambazo malipo ya POS yaliyounganishwa nayo ni 0 pia: ni nini?
SELECT p.payment_status, p.payment_method, p.is_reversal, d.is_paid, s.sale_source, s.payment_status sale_status,
       count(*), round(sum(d.amount)) deni_tzs, round(sum(s.outstanding_balance)) sale_out_sasa
FROM reconciliation_debt_payments dp
JOIN reconciliation_retail_debts d ON d.uid = dp.debt_uid
LEFT JOIN sales s ON s.uid = d.sale_uid
LEFT JOIN payments p ON p.uid = dp.sale_payment_uid
WHERE dp.amount_paid = 0 AND NOT dp.is_deleted AND coalesce(p.amount_paid,0) = 0
GROUP BY 1,2,3,4,5,6 ORDER BY 7 DESC;
-- Safu 0 zenye kiasi upande wa POS: kwa hali ya deni sasa
SELECT d.is_paid, s.sale_source, s.payment_status sale_status, count(*), round(sum(p.amount_paid)) pos_tzs, round(sum(s.outstanding_balance)) sale_out_sasa
FROM reconciliation_debt_payments dp
JOIN reconciliation_retail_debts d ON d.uid = dp.debt_uid
LEFT JOIN sales s ON s.uid = d.sale_uid
JOIN payments p ON p.uid = dp.sale_payment_uid
WHERE dp.amount_paid = 0 AND NOT dp.is_deleted AND p.amount_paid > 0
GROUP BY 1,2,3 ORDER BY 4 DESC;
