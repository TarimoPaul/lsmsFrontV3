# Ripoti (bu) — 02/11/2026

nimesoma hadi (bu). Herufi tangu ripoti iliyopita: (bu), pamoja na ujumbe wa kupima (bila kichwa, umejibiwa na kuhifadhiwa).

Kusoma tu, nakala ya Docker-local (dump lsms_20261029_1027), isipokuwa sehemu ya 4 ambayo ni log zako za prod.

## 1. Tozo ya mfanyakazi inapunguza stock ya mfumo? **NDIYO, INAPUNGUZA.**

**Code** (CountingApprovalService, approve):
- Mstari wenye uamuzi ADJUST **au** CHARGE_TO_CASHIER unaingia `toAdjust`.
- Kwa kila mstari wa `toAdjust`, kabla ya GL, inaandika `Store` movement ADJUSTMENT yenye `quantity = variance`, yaani hasi kwa upungufu.
  Movement hiyo ndiyo "the ONLY stock effect", na `stock_after = stock_before + variance`.
- Kisha tozo inaandika GL Dr 1120 badala ya Dr 5100. Tofauti kati ya ADJUST na CHARGE_TO_CASHIER ni GL tu; stock inapungua kwa zote mbili.

**Data:**
- Tozo 245 kati ya 245 zina movement `COUNT-ADJ-<line>`.
- Movement zote 245 ni hasi.
- Kwa zote 245, `stock_after = stock_before + qty`, na qty = idadi ya tozo.
- Mfano: KONYAGI 11/10, tozo −1 (3,833.33). Movement ADJUSTMENT −1, stock **5 → 4**.

Kwa hiyo hakuna chupa ileile inayotozwa mara mbili kupitia stock. Baada ya tozo, mfumo unaanza kutoka hesabu iliyohesabiwa.

**Zile 5 za Oktoba (16,000):**
- Kila moja ni upungufu MPYA wa kipande 1.
- Mfumo ulikuwa umeshapunguzwa jana yake, lakini mwendo ulioandikwa kati ya hesabu mbili haulingani na kilichohesabiwa kwa kipande 1.

| Bidhaa | Siku 1: hesabu = stock baada ya tozo | Siku 2: mfumo / hesabu | Mwendo ulioandikwa kati | Mabadiliko halisi | Kipya |
|---|---:|---|---:|---:|---:|
| GRAND MALTA 09→10/10 | 5 | 17 / 16 | +12 | +11 | −1 |
| K VANT 10→11/10 | 16 | 16 / 15 | 0 | −1 | −1 (hakuna mauzo yaliyoandikwa) |
| KONYAGI 11→12/10 | 4 | 16 / 15 | +12 | +11 | −1 |
| AFYA MAJI 12→13/10 | 41 | 38 / 37 | −3 | −4 | −1 |
| KONYAGI 27→28/10 | 26 | 7 / 6 | −19 | −20 | −1 |

Hazirudii chupa ileile. Zinaweza kuwa makosa ya kuhesabu au mauzo yasiyoandikwa, lakini si tozo mbili za chupa moja.

## 2. PEPSI && MIRINDA na CASTLE LITE

**Units:**
- Manunuzi ni kwa **kreti**: PEPSI 24 kwa kreti (12,800, yaani 533.33 kwa chupa); CASTLE LITE 20 kwa kreti (33,000, yaani 1,650 kwa chupa).
- `quantity` ya manunuzi = kreti, na stock = kreti × 24 / × 20 (mfano PEPSI 13/10: 20 → 480). Ni sahihi.
  Lebo "PER_PIECE" ya manunuzi hayo inapotosha, lakini hesabu ni sahihi.
- Mauzo ni kreti NA chupa (Julai–29/10):

| Bidhaa | Kreti (WHOLE_PACKAGE) | Chupa (PIECES) |
|---|---|---|
| PEPSI | 13,500, kreti 391 = chupa 9,384 | 1,000, chupa 404 |
| CASTLE LITE | 33,500–35,000, chupa 20 kila kreti | 2,000 au 2,500, chupa 1,296 |

- Hesabu ni kwa chupa. **Mfumo hauna "empties" kabisa:** hakuna sehemu ya chupa/kreti tupu kwenye hesabu, mauzo wala manunuzi (code: hakuna kitu chochote cha empties/returnable isipokuwa sales returns).

**Kreti zilizoandikwa kama chupa? HAPANA:**
- Hakuna mstari wa PIECES wenye bei ya kreti.
- Kila mstari wa WHOLE_PACKAGE una vipande = kreti × 24 / × 20 hasa (PEPSI 9,384 = 391 × 24; CASTLE 4,520 = 226 × 20, n.k.).

**Lakini PEPSI inaonyesha tatizo kubwa la hesabu:** tozo mbili kubwa zilifuatwa na ZIADA kubwa zaidi siku chache baadaye. Ziada hizo ziliachwa NO_ACTION, kwa hiyo hazijawahi kurekebisha stock wala deni.

| Tozo kwa macheda | Hesabu zilizofuata |
|---|---|
| 14/07: −106 (131 → 25), **56,532.98** | 15/07 +240 (25 → 265), 18/07 +238 — NO_ACTION |
| 10/10: −147 (493 → 346), **78,399.51** | 12/10 **+502** (94 → 596), 13/10 +452, 17/10 +432 — NO_ACTION |

- Pia 07/10 ilikuwa +288 (NO_ACTION) siku 3 kabla ya tozo ya −147.
- Stock ya PEPSI kwenye mfumo inashuka/kupanda kwa mamia ndani ya siku 2. Hii ni dalili ya:
  - kreti zinazoingia kabla ya manunuzi kuandikwa (manunuzi ya 13/10 = chupa 480), au
  - kreti zisizohesabiwa siku moja na kuhesabiwa nyingine (stoo / empties).
  Si upotevu halisi wa chupa 147.
- **Tozo hizo mbili (134,932.49 kwenye 1120) zina mashaka makubwa.** Uamuzi ni wako; sijabadilisha kitu.

**Kila tozo** (manunuzi = kreti, mauzo = kreti + chupa, hesabu = chupa, hakuna empties, kwa zote 38):

| Bidhaa | Siku | Idadi | Mfumo → hesabu | Tozo (1120) | Gharama |
|---|---|---:|---|---:|---:|
| CASTLE LITE | 14/07 | -3 | 99 → 96 | 4,800.00 | 4,800.00 |
| CASTLE LITE | 15/07 | -3 | 9 → 6 | 4,800.00 | 4,800.00 |
| CASTLE LITE | 25/07 | -2 | 103 → 101 | 3,200.00 | 3,200.00 |
| CASTLE LITE | 26/07 | -1 | 39 → 38 | 1,600.00 | 1,600.00 |
| CASTLE LITE | 27/07 | -2 | 11 → 9 | 3,200.00 | 3,200.00 |
| CASTLE LITE | 01/08 | -10 | 227 → 217 | 16,000.00 | 16,000.00 |
| CASTLE LITE | 01/08 | -1 | 172 → 171 | 1,600.00 | 1,600.00 |
| CASTLE LITE | 04/08 | -3 | 6 → 3 | 4,800.00 | 4,800.00 |
| CASTLE LITE | 10/08 | -1 | 74 → 73 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 21/08 | -1 | 52 → 51 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 25/08 | -5 | 29 → 24 | 8,250.00 | 8,250.00 |
| CASTLE LITE | 30/08 | -1 | 36 → 35 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 31/08 | -2 | 155 → 153 | 3,300.00 | 3,300.00 |
| CASTLE LITE | 01/09 | -1 | 233 → 232 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 07/10 | -1 | 97 → 96 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 10/10 | -11 | 77 → 66 | 18,150.00 | 18,150.00 |
| CASTLE LITE | 11/10 | -1 | 15 → 14 | 1,650.00 | 1,650.00 |
| CASTLE LITE | 12/10 | -6 | 127 → 121 | 15,000.00 | 9,900.00 |
| CASTLE LITE | 28/10 | -4 | 24 → 20 | 10,000.00 | 6,600.00 |
| PEPSI && MIRINDA | 14/07 | -106 | 131 → 25 | 56,532.98 | 56,532.98 |
| PEPSI && MIRINDA | 31/07 | -3 | 468 → 465 | 1,599.99 | 1,599.99 |
| PEPSI && MIRINDA | 05/08 | -1 | 190 → 189 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 06/08 | -1 | 163 → 162 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 07/08 | -1 | 66 → 65 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 19/08 | -2 | 284 → 282 | 1,066.66 | 1,066.66 |
| PEPSI && MIRINDA | 23/08 | -2 | 123 → 121 | 1,066.66 | 1,066.66 |
| PEPSI && MIRINDA | 30/08 | -3 | 22 → 19 | 1,504.32 | 1,504.32 |
| PEPSI && MIRINDA | 31/08 | -1 | 16 → 15 | 501.44 | 501.44 |
| PEPSI && MIRINDA | 06/09 | -1 | 323 → 322 | 532.61 | 532.61 |
| PEPSI && MIRINDA | 09/09 | -1 | 718 → 717 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 12/09 | -1 | 332 → 331 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 16/09 | -1 | 274 → 273 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 18/09 | -2 | 297 → 295 | 1,066.66 | 1,066.66 |
| PEPSI && MIRINDA | 20/09 | -1 | 217 → 216 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 05/10 | -3 | 260 → 257 | 1,599.99 | 1,599.99 |
| PEPSI && MIRINDA | 06/10 | -1 | 446 → 445 | 533.33 | 533.33 |
| PEPSI && MIRINDA | 10/10 | -147 | 493 → 346 | 78,399.51 | 78,399.51 |
| PEPSI && MIRINDA | 19/10 | -1 | 168 → 167 | 1,000.00 | 533.33 |

## 3. Hatua 64-rekebisha-15-10.cmd — IMEANDALIWA (haijaendeshwa)

Faili:
- analysis/steps/64-rekebisha-15-10.cmd
- analysis/steps/64-rekebisha-15-10.mjs
- analysis/steps/64-kagua.sql

**Mpangilio:**
1. Inakataa mpaka log ya 63 iishe kwa ---OK--- (63 ANDIKA).
2. **KAGUA** (bila password): journal 4 za chanzo lazima ziwe kama kwenye nakala.
   - JE-...6802 reco 10/10 Dr 1000 / Cr 6700 28,500
   - JE-...7163 28,500
   - JE-...6819 15,000
   - JE-...1062 2,000
   - Pia: zote ziwe hai na bila reversal, net ya 1000 ya reco 10/10 = +28,500, Oktoba OPEN, 1120 ya GL = daftari, TB 0.
   - Kisha 🛑 SIMAMA-PREVIEW.
3. **ANDIKA**, kisha swali la J2, kisha email/password ya CEO (si root):
   - **J1** 15/10 Dr 6700 / Cr 1000 28,500. Maelezo yanataja JE-2026-364983712136802 na JE-2026-1170142847527163.
   - **J2** 15/10 Dr 1120 / Cr 4000 17,000. Inaandikwa **tu** ukiandika `J2 ndiyo` (herufi kama zilivyo); jibu jingine lolote = J2 inarukwa.
4. **Nyongeza muhimu kwa J2:** hakuna API ya kufuta malipo ya deni. Journal peke yake ingefanya 1120 ya GL kuzidi daftari la madai kwa 17,000, na control check ya STAFF_RECEIVABLES ingeshindwa.
   - Kwa hiyo J2 pia, kwa SQL ndani ya transaction moja yenye ulinzi wa kiasi, inafuta malipo 81e32020 (15,000) na f6d20485 (2,000) kwenye `staff_liability_payment`.
   - Inahesabu upya hali ya madeni yake mawili (yanarudi OPEN) na inaandika `audit_trails` 2.
   - Journal za malipo za asili zinabaki; J2 inazifidia. Backfill inaruka malipo yaliyofutwa, kwa hiyo hayataandikwa upya.
   - Baada ya J2, deni la macheda = 1,017,301.88.
5. Ukaguzi baada:
   - delta ya TB = 6700 +28,500 / 1000 −28,500 (na 1120 +17,000 / 4000 −17,000);
   - kila journal ipo mara moja;
   - 1120 = daftari;
   - TB 0.
   Ikirudiwa baada ya kukatika, inaendelea pale ilipofika (journal au SQL).

**Majaribio (Docker-local, nakala ya 29/10):**
- mjs:
  - kagua 12/0;
  - andika bila J2 19/0/1skip;
  - kurudia (J1 inarukwa);
  - andika na J2 21/0;
  - kurudia 21/0;
  - resume (journal ya J2 ipo, daftari bado) 21/0.
- Controls 3/3 zimekamatwa, na hakuna kilichoandikwa:
  - chanzo kimebadilika → FAIL;
  - Oktoba CLOSED → FAIL;
  - daftari limebadilika baada ya preview → SIMAMA.
- Njia ya server (bash, ~/lsms-deployment bandia + ficha.awk): kagua 12/0.
- cmd fakes 10/10:
  - bila log ya 63 → IMEKATALIWA;
  - KAGUA ya kwanza → SIMAMA-PREVIEW;
  - simama;
  - root → kukataliwa;
  - ANDIKA bila J2 → J1 tu;
  - "j2 ndiyo" (herufi ndogo) → J2 inarukwa;
  - "J2 ndiyo" → J2;
  - kurudia;
  - password tupu → kukataliwa;
  - KAGUA upya.
- Kumbuka jaribio: password inasomwa na Read-Host ya console, haiwezi kuletwa kutoka faili. Kwenye nakala ya jaribio tu, mstari huo ulibadilishwa kuwa `set /p`; faili halisi halikubadilishwa.
- Nakala ya local imerudishwa kama ilivyokuwa (1120 = 1,000,301.88).

**Hitilafu yangu, imerekebishwa:** majaribio yangu ya local yaliacha `64-kagua-prod.json` kwenye folda halisi ya steps. Lingefanya 64 iruke KAGUA ya prod. Nimelifuta. Hakuna faili jingine la `*-kagua-prod.json` lililopo.

## 4. Log zako (zimefika wakati wa kazi hii)

- **61 KAGUA (02/11 11:14), 7/0, PREVIEW_TAYARI:**
  - Mkopo A ni ACTIVE, deni 1,158,000.
  - Hakuna malipo yaliyokwisha andikwa.
  - Awamu 3 UNPAID (04/11, 04/12, 04/01).
  - Novemba OPEN, TB 0.
  - **Preview ni sahihi: endesha 61 ANDIKA tarehe 04/11 baada ya kupokea 386,000 CASH.**
- **62 ---OK---:**
  - (a) 311026-2139:
    - Total ya sale ni **75,000**. Ile 146,500 ilikuwa jumla ya Dr ya journal (75,000 mauzo + 71,500 COGS).
    - Ilifutwa 01/11 08:22 na "System" (bug ambayo A6 inarekebisha), bila sababu.
    - Reversal ina tarehe 01/11 kwa sababu 2.3.0 inaweka tarehe ya siku ya kufuta.
    - Sale 6 zimefutwa tangu 30/10. Zinajumuisha 3 za 30/10 (68,000; 83,500; 135,500) zilizofutwa 31/10 asubuhi, kabla reco ya 30/10 haijaidhinishwa (01/11 15:18). Reco ya 31/10 bado ni SUBMITTED.
  - (b) Reco za Oktoba:
    - Upungufu siku 23 = 112,110; ziada siku 7 = −51,000.
    - Hakuna ~12,587 wala ~31,634. Zinazojirudia ni ndogo tu: 3,000 ×3, ±1,500, −2,000.
  - (c) gl_posting_failure: 0.
  - (d) Uchakavu 31/10:
    - Journal 9, jumla 146,012.42 (Dr 6500 / Cr 1590), scheduler 01/11 02:00.
    - Septemba ilikuwa 74,888.89 kwa mali 3; mali 6 mpya zimeanza Oktoba.
  - (e) Mkopo uliofungwa ni mmoja tu: MKOPO WA BANK (umelipwa 11/06). Hakuna riba baada ya kufungwa. Mikopo 2 ni ACTIVE.
  - (f) Jagger: imethibitishwa (11/10 PER_PIECE 53,000; 13/10 +5 × 53,000).
    - Pia kuna bidhaa 4 za Jagger (JAGER/JAGGER MASTER zenye gharama 42,000 / 29,000 / 20,000 / 53,000). Zinahitaji usafi wa majina baadaye.
  - (g) Gharama isiyo ya kawaida: Jagger tu (6.12×). Oktoba OPEN.
  - **63 sasa inaweza kuendeshwa (KAGUA kwanza).** 64 itafuata baada ya 63 ANDIKA.
- **push-yote ---OK---:** ilisema hakuna cha kupush kwa sababu matawi yote yalikuwa sawa wakati huo.

**Inayofuata:** onyo la manunuzi, kisha B5.
