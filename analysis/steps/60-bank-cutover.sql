-- HATUA 60 (mmiliki 28/10 x, S-A) - TAREHE YA KUKATA D YA BENKI: gl_config.bank_cutover_date = D. IMEANDALIWA TU.
-- Inaendeshwa siku ya kukata pamoja na journal ya ufunguzi. Kuanzia D, malipo ya mkopo ni Cr 102x (M-13); kabla ya D ni Cr 1000.
-- psql -v D=YYYY-MM-DD. Kinga (zote ndani ya transaction moja; kosa lolote = ROLLBACK, hakuna kilichobadilika):
--   * 2.3.0 imewekwa (safu gl_config.bank_cutover_date ipo) na gl_config ni safu moja;
--   * D iliyokwisha wekwa haibadilishwi (D ileile tena = hakuna kinachofanyika, CUTOVER_TAYARI);
--   * D >= tarehe ya malipo ya mkopo ya mwisho yaliyokwisha andikwa (rekodi capital_injections NA journal LOAN_REPAYMENT);
--   * mwezi wa D haujafungwa;
--   * UPDATE inagusa safu 1 tu.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('lsms.d', :'D', true);
SELECT 'KABLA|cutover ' || coalesce((SELECT bank_cutover_date::text FROM gl_config LIMIT 1), 'NULL')
       || '|malipo_rekodi ' || coalesce((SELECT max(transaction_date::date)::text FROM capital_injections WHERE source_type = 'LOAN_REPAYMENT'), '-')
       || '|malipo_journal ' || coalesce((SELECT max(coalesce(event_date, entry_date))::text FROM journal_entry
                                           WHERE reference_type = 'LOAN_REPAYMENT' AND NOT coalesce(is_deleted, false)), '-');
DO $$
DECLARE
  d      date := current_setting('lsms.d')::date;
  cur    date;
  maxrec date;
  maxjr  date;
  n      int;
BEGIN
  IF (SELECT count(*) FROM gl_config) <> 1 THEN
    RAISE EXCEPTION 'SIYO: gl_config ina safu % (lazima 1)', (SELECT count(*) FROM gl_config);
  END IF;
  SELECT bank_cutover_date INTO cur FROM gl_config;
  IF cur IS NOT NULL THEN
    IF cur = d THEN
      RAISE NOTICE 'CUTOVER_TAYARI %', d;
      RETURN;
    END IF;
    RAISE EXCEPTION 'SIYO: bank_cutover_date tayari ni % (si %) - hatua hii haibadilishi D iliyokwisha wekwa', cur, d;
  END IF;
  SELECT max(transaction_date::date) INTO maxrec FROM capital_injections WHERE source_type = 'LOAN_REPAYMENT';
  SELECT max(coalesce(event_date, entry_date)) INTO maxjr FROM journal_entry
   WHERE reference_type = 'LOAN_REPAYMENT' AND NOT coalesce(is_deleted, false);
  IF (maxrec IS NOT NULL AND d < maxrec) OR (maxjr IS NOT NULL AND d < maxjr) THEN
    RAISE EXCEPTION 'SIYO: D % iko kabla ya malipo ya mkopo ya mwisho (rekodi %, journal %)', d, maxrec, maxjr;
  END IF;
  IF EXISTS (SELECT 1 FROM gl_period WHERE branch_uid IS NULL AND period_year = extract(year FROM d)::int
              AND period_month = extract(month FROM d)::int AND status IN ('CLOSED', 'LOCKED')) THEN
    RAISE EXCEPTION 'SIYO: mwezi wa D % umefungwa', d;
  END IF;
  UPDATE gl_config SET bank_cutover_date = d, updated_at = now(), updated_by = 'hatua-60' WHERE bank_cutover_date IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'SIYO: safu % zimebadilika (lazima 1)', n;
  END IF;
END $$;
SELECT 'CUTOVER_SASA ' || coalesce(bank_cutover_date::text, 'NULL') FROM gl_config;
COMMIT;
SELECT 'MWISHO_60';
