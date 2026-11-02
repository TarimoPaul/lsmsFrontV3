-- HATUA 64 (mmiliki 02/11 bu) - KAGUA, KUSOMA TU. Marekebisho ya malipo ya deni ya 15/10.
-- Inaendeshwa ndani ya transaction ya kusoma tu. Kila mstari una lebo J64_...; 64-rekebisha-15-10.mjs inazisoma.
--   J1: 28,500 iliingia 1000 mara mbili - ziada ya reco 10/10 (JE-2026-364983712136802 Dr 1000 / Cr 6700) na malipo ya 15/10
--       (JE-2026-1170142847527163 Dr 1000 / Cr 1120). J1 = Dr 6700 / Cr 1000 28,500 tarehe 15/10.
--   J2 (hiari, "J2 ndiyo"): malipo ya 15/10 ya 15,000 (JE-2026-1170272232836819) na 2,000 (JE-2026-1170382823731062) yalikuwa
--       mauzo yasiyoandikwa (reco 12/10, 13/10), si malipo ya deni. J2 = Dr 1120 / Cr 4000 17,000 tarehe 15/10, NA malipo hayo
--       mawili yanafutwa kwenye daftari la madai (staff_liability_payment), ili 1120 ya GL = daftari.
\pset footer off
\set ON_ERROR_STOP on
SELECT 'J64_TAREHE|' || (now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date;
SELECT 'J64_KIPINDI|' || m || '|' || coalesce((SELECT status FROM gl_period WHERE period_year = 2026 AND period_month = m LIMIT 1), 'OPEN')
  FROM (VALUES (10)) v(m);

-- Journal za chanzo: kila moja na mistari yake, hali (hai/imefutwa) na kama kuna reversal inayoielekea.
SELECT 'J64_CHANZO|' || k.ufunguo || '|' || coalesce(j.entry_number, 'HAIPO') || '|' || coalesce(j.entry_date::text, '-')
       || '|' || coalesce(j.reference_type, '-') || '|' || coalesce(j.is_deleted, false)
       || '|' || (SELECT count(*) FROM journal_entry r WHERE r.reversed_entry_uid = j.uid AND NOT coalesce(r.is_deleted, false))
       || '|' || coalesce((SELECT string_agg(l.account_code || ' ' || l.debit_amount || ' ' || l.credit_amount, ';' ORDER BY l.account_code)
                             FROM journal_entry_line l WHERE l.journal_entry_uid = j.uid), '-')
  FROM (VALUES ('RECO_10_10', 'JE-2026-364983712136802'), ('MALIPO_28500', 'JE-2026-1170142847527163'),
               ('MALIPO_15000', 'JE-2026-1170272232836819'), ('MALIPO_2000', 'JE-2026-1170382823731062')) k(ufunguo, nambari)
  LEFT JOIN journal_entry j ON j.entry_number = k.nambari
 ORDER BY k.ufunguo;

-- Reco ya 10/10 bado ina ziada ileile, na hakuna journal nyingine hai ya DAY_CLOSE_VARIANCE inayoibadilisha (net ya 1000 siku hiyo).
SELECT 'J64_RECO_10_10|' || coalesce(sum(CASE WHEN l.account_code = '1000' THEN l.debit_amount - l.credit_amount ELSE 0 END), 0)
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
 WHERE NOT coalesce(j.is_deleted, false) AND j.reference_type = 'DAY_CLOSE_VARIANCE' AND j.entry_date = DATE '2026-10-10';

-- Malipo mawili ya J2 kwenye daftari la madai (pamoja na deni lake).
SELECT 'J64_MALIPO|' || p.uid || '|' || p.amount || '|' || coalesce(p.is_deleted, false) || '|' || p.liability_uid
       || '|' || l.amount || '|' || l.status
       || '|' || (SELECT coalesce(sum(x.amount), 0) FROM staff_liability_payment x WHERE x.liability_uid = l.uid AND NOT coalesce(x.is_deleted, false))
  FROM staff_liability_payment p JOIN staff_liability l ON l.uid = p.liability_uid
 WHERE p.uid IN ('81e32020-b10f-454c-89cf-1c93c574aff4', 'f6d20485-7263-4d11-b8ba-670cb6cf43ed')
 ORDER BY p.amount DESC;

-- 1120: GL dhidi ya daftari (kama GlReconciliationService.staffOutstanding: WAIVED haihesabiwi, malipo yaliyofutwa hayahesabiwi).
SELECT 'J64_1120|' || (SELECT coalesce(sum(l.debit_amount - l.credit_amount), 0) FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid
                        WHERE NOT coalesce(j.is_deleted, false) AND l.account_code = '1120')
       || '|' || (SELECT coalesce(sum(greatest(s.amount - coalesce((SELECT sum(x.amount) FROM staff_liability_payment x
                                                                      WHERE x.liability_uid = s.uid AND NOT coalesce(x.is_deleted, false)), 0), 0)), 0)
                    FROM staff_liability s WHERE NOT coalesce(s.is_deleted, false) AND s.status <> 'WAIVED');

SELECT 'J64_JOURNAL_IPO|' || k.ufunguo || '|' || count(j.uid) || '|' || coalesce(string_agg(j.entry_number || ' ' || j.entry_date || ' ' || j.total_debit, ', '), '-')
  FROM (VALUES ('J1', 'J1 15/10: 28,500 mara mbili kwenye 1000 (JE-...6802 + JE-...7163)'),
               ('J2', 'J2 15/10: 17,000 ni mauzo, si malipo ya deni (JE-...6819 + JE-...1062)')) k(ufunguo, memo)
  LEFT JOIN journal_entry j ON j.reference_type = 'MANUAL_ADJUSTMENT' AND j.reference_number = k.memo
       AND NOT coalesce(j.is_deleted, false) AND NOT coalesce(j.is_reversal, false)
 GROUP BY k.ufunguo ORDER BY k.ufunguo;
SELECT 'J64_TB|' || coalesce(sum(l.debit_amount - l.credit_amount), 0)
  FROM journal_entry j JOIN journal_entry_line l ON l.journal_entry_uid = j.uid WHERE NOT coalesce(j.is_deleted, false);
SELECT 'J64_KAGUA_IMEKAMILIKA';
