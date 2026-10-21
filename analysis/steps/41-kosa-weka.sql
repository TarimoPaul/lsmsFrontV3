-- HATUA 41 (STAGING, INAANDIKA SCHEMA KWA MUDA): constraint inayozuia journal ya SALE_CASH tu, ili sale moja ya jaribio
-- ishindwe kupostiwa GL (1.c). NOT VALID = safu zilizopo hazikaguliwi. 41-kosa-ondoa.sql inaiondoa mara baada ya jaribio.
ALTER TABLE journal_entry ADD CONSTRAINT qa_toleo1_zuia_sale_cash CHECK (reference_type <> 'SALE_CASH') NOT VALID;
SELECT 'CONSTRAINT_IMEWEKWA|' || count(*) FROM pg_constraint WHERE conname = 'qa_toleo1_zuia_sale_cash';
