# KUPIMA (ep): Gilbeys, Camino na Wine zilinunuliwaje bila mzazi? (kusoma tu, 10/11/2026)

**Chanzo:** `lsms_ep_20261029`. Ni nakala safi ya dump ya prod ya 29/10 (`/tmp/d.dump`, mauzo 2761, Flyway 134), iliyorudishwa leo kwenye lsms-local-postgres-1. Session zote zilikuwa read-only. Data inafika hadi 28/10. **Hakuna kilichorekebishwa.**

**Mahali palipotafutwa:** kila safu ya maandishi ya DB (maelezo, notes, sababu, msambazaji), pamoja na:
- manunuzi;
- reco "manunuzi" na reco "matumizi";
- capital_expenditure;
- mistari ya journal;
- invoice za repurchase;
- mienendo ya store;
- stock_adjustment.

Maneno yaliyotafutwa: gilb, camino, grepa, wine, dumu, kupima, vipimo, kipimo, gin, tequila.

## Jibu fupi
| Kinywaji | Chupa/dumu halisi liliandikwa? | Kilichoandikwa badala yake |
|---|---|---|
| **Gilbeys** | **HAPANA, hakuna mahali popote.** Hakuna bidhaa ya chupa nzima, manunuzi, reco manunuzi, gharama, capex wala journal. | "Manunuzi" ya vipande tu: GILBEYS KUPIMA 22/02, 20 × 1,000 = 20,000. GL ilikuwa Dr 1200 / Cr 1000; sasa imesahihishwa na hatua 83 (sehemu ya 159,000). |
| **Camino** | **HAPANA, hakuna mahali popote.** | CAMINO KUPIMA 22/02, 20 × 1,000 = 20,000 (Babuu). GL kama Gilbeys, nayo imesahihishwa na 83. |
| **Wine** | **NDIYO, kama GREPA WINE (59)**, ambayo ndiyo **dumu la 5L**: invoice zake zinaitwa "GREPA WINE 5LT", na reco inasema "dumu 2" na "lita kumi bei 25000". | Dumu linanunuliwa kwa njia ya kawaida ya manunuzi (Dr 1200 / Cr 1000). Pesa ya droo inaandikwa pia kwenye reco "manunuzi" (bila GL ya pili). Lakini hakuna dumu lililopunguzwa kwenda kupima kwa mkono; tazama §3. |

**⚠️ Kabla Chief hajasajili "Wine dumu 5L" (ep):** GREPA WINE (59) tayari ni dumu la 5L, kwa avg 25,000 na stock 1. Bidhaa mpya ingekuwa nakala ya dumu hilo. Napendekeza:
- 59 iwe mzazi wa WINE ZA KUPIMA;
- jina lake libadilishwe kuwa "GREPA WINE 5L", ili lionyeshe ujazo.

Isipokuwa wine ya kupima ni dumu la aina nyingine. Kwenye (el) niliandika "hayupo" kwa sababu jina la bidhaa halina "5L" wala "dumu"; hilo lilikuwa kosa langu.

## 1. Gilbeys
- Bidhaa ya kupima: GILBEYS KUPIMA (66), stock ya mfumo 9.
- "Manunuzi" ya vipande: 22/02, 20,000. Supplier ni tupu.
- Mauzo: mistari 3 kati ya 31/05 na 18/07, "vipande" 11. Mapato ni 13,000, na gharama iliyoandikwa 11,000 ni ya kubuni.
- Chupa nzima: **haikuandikwa popote.** Hakuna bidhaa ya Gilbeys ya chupa nzima. Bidhaa za GIN zilizopo ni Gordons, Tzee na Tanzanite.

## 2. Camino
- Bidhaa ya kupima: CAMINO KUPIMA (36), stock 0.
- "Manunuzi" ya vipande: 22/02, 20,000 (Babuu).
- Mauzo: mistari 11 kati ya 08/04 na 31/05, vipande 20. Mapato ni 43,000, na gharama ya kubuni ni 20,000.
  - Sale moja ya 2,000 ilifutwa tarehe 24/05.
- Chupa nzima: **haikuandikwa popote.**

**Kwa Gilbeys na Camino, maelezo yanayowezekana** (Chief athibitishe):
- (a) chupa zilikuwepo dukani kabla LSMS haijaanza tarehe 22/02, yaani stock ya ufunguzi isiyosajiliwa;
- (b) zilinunuliwa kwa pesa isiyopita kwenye mfumo.

Reco "manunuzi" ilianza tarehe 24/06 tu, wakati mauzo ya Camino yaliisha 31/05. Hivyo kwa kipindi hicho hakuna daftari la droo la kulinganisha.

## 3. Wine (dumu 5L = GREPA WINE 59)
| Tarehe | Mwendo | Idadi | Kiasi | GL | Reco "manunuzi" (droo) |
|---|---|---|---|---|---|
| 23/03 | Manunuzi (grepa), PAID | +1 | 27,000 | Dr 1200 / Cr 1000 | (reco haikuwepo) |
| 11/04 | Marekebisho ya mkono "IMEREKEBISHWA" | +2 | – | **hakuna GL** | – |
| 07/06 | Marekebisho ya mkono "zimererkbishwa" | +1 | – | **hakuna GL** | – (15/06: 52,000 iliandikwa kisha ikafutwa) |
| 10/07 | Manunuzi, PAID | +2 | 50,000 | Dr 1200 / Cr 1000 | 10/07: 50,000 "lita kumi bei 25000" |
| 17/09 | Manunuzi, PAID | +2 | 50,000 | Dr 1200 / Cr 1000 | 16/09: 50,000 "dumu 2" |
| 26/09 | Hesabu: upungufu (UNRECORDED_DELIVERY) | −1 | 25,000 | Dr 5100 / Cr 1200 | – |
| 02/10 | Manunuzi, **UNPAID** (capex PENDING) | +3 | 75,000 | Dr 1200 / Cr 1000 | 01/10: 75,000 "manunuzi grepa wine" |
| 08/10 | Hesabu: upungufu (COUNTING_ERROR) | −1 | 25,000 | Dr 5100 / Cr 1200 | – |

**Jumla ya mwendo:**
- dumu 8 zimenunuliwa kwa 202,000;
- +3 zimeongezwa kwa mkono bila GL;
- dumu 8 zimeuzwa nzima kwa 30,000–33,000 (23/03 hadi 15/10);
- −2 zimetoka kama upungufu wa hesabu;
- stock ya mfumo ni 1.

**WINE ZA KUPIMA (91):**
- "Manunuzi" ya vipande: 24/03, 50 × 500 = 25,000 (TAKAWEDO). Hatua 83 imesahihisha GL yake.
- +20 kwa mkono tarehe 30/05.
- Mauzo: mistari 31 kati ya 23/03 na 11/10, vipande 70. Mapato ni 120,000, na gharama ya kubuni ni 35,000.

**Maana yake:**
- Kwenye mfumo **hakuna dumu la Grepa lililopelekwa kupima**: kila dumu lililotoka limeandikwa kama mauzo ya dumu zima, au kama upungufu wa hesabu.
- Upungufu 2 wa 26/09 na 08/10, jumla ya **50,000 kwenye 5100**, una uwezekano mkubwa wa kuwa ndio dumu zilizofunguliwa kupima. Wine ya kupima iliuzwa hadi 11/10.
  - Kama ndivyo, gharama ya wine ya kupima iko kwenye **upotevu (5100)**, siyo kwenye gharama ya mauzo yake.
- Kwa kupima ya Machi–Julai (vipimo 66 kati ya 70), hakuna dumu lililopungua. Inawezekana dumu hizo ndizo +3 zilizoongezwa kwa mkono (11/04 na 07/06), ambazo hazina manunuzi wala GL; hili halijathibitishwa.
- **MA-LOT BOX WINE 5LT (102):** box 2 zilinunuliwa 30/03 kwa 70,000 (Dr 1200 / Cr 1000). Hazina mwendo wowote tangu hapo, na stock ya mfumo ni 2. Kama zilitumika kupima, mfumo haujui; Chief athibitishe kama bado zipo.

## 4. Athari kwenye faida (ripoti tu)
| Kinywaji | Mapato ya kupima | Gharama iliyoandikwa (ya kubuni) | Faida iliyoandikwa | Gharama halisi ya chupa/dumu kwenye GL |
|---|---|---|---|---|
| Gilbeys | 13,000 | 11,000 | 2,000 | **0**: chupa haikuandikwa |
| Camino | 43,000 | 20,000 | 23,000 | **0**: chupa haikuandikwa |
| Wine | 120,000 | 35,000 | 85,000 | Dumu zimeandikwa (Grepa), lakini zimeingia kama mauzo ya dumu zima au upotevu (5100, 50,000), siyo kama gharama ya kupima |

- Baada ya hatua 83, gharama ya kubuni ya vipande (Cr 1000 → Cr 3900) haitoki tena kwenye cash. Bado iko kwenye COGS ya vinywaji hivi.
- Gilbeys na Camino hawana gharama halisi kwenye vitabu. Faida yao halisi ni mapato ukitoa gharama ya chupa zilizotumika, ambayo haijulikani.
- Kwa makadirio ya bei ya leo (50ml = 3,000; chupa 750ml ≈ vipimo 15), Camino 43,000 ni takriban chupa 1, na Gilbeys 13,000 ni chini ya chupa 1. Hii ni kadirio tu.
- Wine: faida ya kupima imeonyeshwa juu, na gharama ya dumu zake iko mahali pengine (5100). Faida ya jumla ya biashara haibadiliki; mgawanyo wake kwa kinywaji ndio umepotoka.

## 5. Kwa Chief (maamuzi, hakuna kitakachoandikwa bila agizo)
1. **Wine:** mzazi = GREPA WINE (59), dumu 5L. Usisajili dumu jipya isipokuwa ni aina tofauti. Napendekeza kubadilisha jina kuwa "GREPA WINE 5L".
2. **Gilbeys / Camino:** chupa zilitoka wapi? (a) stock ya kabla ya 22/02, au (b) manunuzi nje ya mfumo. Hili linahitajika kujua tu, si kurekebisha. Kipindi cha Feb–Jul kimefungwa.
3. **MA-LOT BOX WINE (2):** bado zipo dukani?
4. **Grepa +3 za mkono (11/04, 07/06):** hazina GL wala manunuzi; zilitoka wapi?

## Hatua 85 na Wine
85 inamtafuta mzazi wa WINE kwa jina lenye "dumu", kwa hiyo GREPA WINE haitapatikana na WINE itarukwa. Chief akikubali 59 kuwa mzazi, kuna njia mbili, na faili la 85 halibadilishwi mpaka aamue:
- aendeshe 85 na `L85_PARENT_WINE=fd9877ee-e6bd-4cfd-bd9d-20ca46a762ed` (uid ya GREPA WINE kwenye nakala ya 29/10; KAGUA ya 85 itaonyesha jina kabla ya kuandika); au
- niibadilishe SQL ya WINE iwe `product_name ilike '%grepa%'`.

## Nje ya swali (yameandikwa tu, hayaingii batch kwa (ct))
- **Manunuzi ya Grepa 02/10 (75,000):** purchases inasema UNPAID na capex inasema PENDING. Lakini GL ilikuwa tayari Cr 1000, na reco ya 01/10 inaonyesha imelipwa kutoka droo. Hali ya malipo haiendani na GL na reco. Pesa haikuhesabiwa mara mbili, kwa sababu reco "manunuzi" haiandiki GL.
- **stock_adjustment 5dc42c9f (26/09):** ina gl_posted = false, ingawa journal yake JE-2026-12692802521476 ipo. Hii ni bendera iliyochakaa tu; GL ni sahihi.
