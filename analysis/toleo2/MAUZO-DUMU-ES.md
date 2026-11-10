# (es): mauzo 8 ya dumu zima la GREPA WINE (59), kwa alama ya Chief

**Chanzo:** `lsms_es_20261029`. Ni nakala safi ya dump ya prod ya 29/10, iliyorudishwa leo. Session zilikuwa za kusoma tu. **Hakuna kilichoandikwa.**

**Prod ya leo (84, 10/11):** GREPA WINE ina stock 1, na manunuzi yake ya mwisho ni 02/10. Mauzo yake ya mwisho yaliyoandikwa ni 15/10, kwa hiyo hakuna mauzo mapya baada ya 29/10.

| # | Tarehe | Risiti | Mteja | Cash/mkopo | Bei ya dumu | Jumla ya sale (mistari) | Mtumiaji | Deni la sale leo | Reco ya siku (tofauti) | ALAMA (Chief) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 21/03 | RCP-20260323-2044-106 | Walk-in | CASH, PAID | 32,000 | 1,363,000 (16) | System Root | 0 | (reco haikuwepo) | kupima / halisi |
| 2 | 23/04 | RCP-20260423-1928-647 | Walk-in | CASH, PAID | 30,000 | 30,000 (1) | macheda | 0 | (reco haikuwepo) | |
| 3 | 04/06 | RCP-20260604-456000-FB83 | dada msalato | CASH, PAID | 33,000 | 168,500 (5) | macheda | 0 | (reco haikuwepo) | |
| 4 | 19/06 | RCP-20260619-102000-40FD | Walk-in | CASH, PAID | 32,000 | 134,500 (13) | macheda | 0 | APPROVED, +500 | |
| 5 | 30/07 | RCP-20260730-863000-CEA5 | Walk-in | CASH, PAID | 30,000 | 87,200 (9) | macheda | 0 | APPROVED, 0 | |
| 6 | 30/09 | RCP-20260930-854000-6461 | alex | CASH, PAID | 30,000 | 150,500 (4) | macheda | 0 | APPROVED, +500 | |
| 7 | 13/10 | 131026-2223 | ANITA | CASH, PAID | 30,000 | 53,500 (3) | macheda | 0 | APPROVED, −2,000 ("bidhaa zimeuzwa lakini hazikuandikwa") | |
| 8 | 15/10 | 151026-2236 | alhponce | CASH, PAID | 30,000 | 235,000 (9) | macheda | 0 | APPROVED, +500 | |

## Kilichopatikana (ni muhimu kabla ya hatua 86)
- **Hakuna deni la mteja hata moja kwa mauzo haya 8.** Yote ni CASH na PAID, na GL ni SALE_CASH (Dr 1000 / Cr 4000).
  - Nimetafuta kwa njia tatu: kwa sale_uid, kwa risiti kwenye maelezo ya madeni ya reco, na kwa jina la mteja ± siku 1 au kiasi kilekile. Zote zilileta 0.
  - customer_credits: 0.
- Reco za siku hizo hazina upungufu wa ~30,000. Kwa hiyo pesa ya dumu ilifika droo.
  - Kama dumu lilienda kupima, basi pesa ya vipimo vyake iliandikwa kama "sale ya dumu zima" ya 30,000. Vinginevyo droo ingepungua.

**Kwa hiyo marekebisho ya (es), "Dr 4000 / Cr deni la mteja", hayana deni la kupunguza.** Kabla ya kuandika hatua 86, Chief aamue kwa kila alama "kupima":
- (a) **Hakuna journal.** Pesa iliingia kweli, na gharama ya dumu (25,000–27,000) tayari iko kwenye COGS. Ni jina la bidhaa tu lililokosewa: mapato ya vipimo yalionekana kama mauzo ya dumu. Hili ni pendekezo langu.
- (b) **Kuhamisha mapato** kutoka "GREPA WINE" kwenda "WINE ZA KUPIMA" kwa ripoti ya faida kwa kinywaji. Hili halibadilishi GL (4000 → 4000). Linahitaji kubadilisha mstari wa sale au kuweka kiashiria cha ripoti.
- (c) Ikiwa Chief anajua kwamba sale fulani ilikuwa ya mkopo kweli lakini iliandikwa cash, aseme ni ipi. Hiyo ni hali tofauti: droo ilipata pesa kutoka wapi?

Mstari wa 1 (21/03, System Root, mistari 16, 1.36M) unaonekana kuwa uingizaji wa jumla wa siku za mwanzo, si sale moja ya kawaida.
