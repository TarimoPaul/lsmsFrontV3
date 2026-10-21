-- HATUA 41 (STAGING): kuondoa constraint ya muda ya 41-kosa-weka.sql. Lazima mwishoni: CONSTRAINT_IMEONDOLEWA|0.
ALTER TABLE journal_entry DROP CONSTRAINT IF EXISTS qa_toleo1_zuia_sale_cash;
SELECT 'CONSTRAINT_IMEONDOLEWA|' || count(*) FROM pg_constraint WHERE conname = 'qa_toleo1_zuia_sale_cash';
