# Uhakiki wa faida halisi (net profit) — siku 90, 02/07/2026 hadi 29/09/2026

**Chanzo:** backup ya prod iliyo karibuni zaidi, `backups/prod_Lsms_20260930_1026_before_gl.dump`. Ilirejeshwa kwenye container ya muda (postgres:17), si production.

**Usalama:** kila session ilianza na `default_transaction_read_only = on` na `statement_timeout = '30s'`. Hakuna INSERT, UPDATE, DELETE au DDL iliyofanyika, na code haijabadilishwa.

**Queries:** zote ziko `analysis/v3_net_profit_queries.sql` (N1 hadi N5).

**Uhakika:** [Uhakika] = imepimwa moja kwa moja · (Inawezekana) = makisio yenye ushahidi mzuri · (Kubahatisha) = dhana inayohitaji uthibitisho wa mmiliki.

---

## Muhtasari (jibu fupi)

| | Kwa siku | Siku 90 |
|---|---|---|
| Faida ghafi | 100,548 | 9,049,346 |
| Gharama **zilizorekodiwa LSMS** (kila siku + za mwezi, bila kurudia) | 38,945 | 3,505,077 |
| Uchakavu wa mali (haujarekodiwa) | 2,462 | 221,589 |
| Upotevu **halisi** wa stock | 10,308 | 927,738 |
| **Faida halisi (net)** | **≈ 48,800** | **≈ 4.39M (4.4% ya mauzo)** |

Mambo makuu manne:

1. **LSMS haina gharama za ~91k kwa siku.** Gharama zote zilizorekodiwa ni **~39k kwa siku**: kila siku ~22k, na za mwezi ~17k.
   - Gharama za mwezi kwa siku ni: Julai 8.0k, Agosti 17.8k, Septemba 25.6k.
   - Hakuna mwezi wowote unaofikia 63k kwa siku.
   - Kama kweli unalipa ~91k kwa siku, basi **~52k kwa siku (~4.7M kwa siku 90) hazipo kwenye LSMS**.
2. Uchambuzi uliopita (3.0M) ulikosa **kodi ya pango** (200k kwa mwezi) na kodi ya TRA. Sababu ni kwamba zimehifadhiwa kama "za mwaka mzima" zenye tarehe 01/01/2026. Kwa usahihi gharama ni 3.51M, si 3.0M.
3. **Upotevu halisi wa stock ni ~0.87M kwa siku 84** (~0.93M kwa siku 90). Si 1.5M, na si "ziada ya +2.6M".
   - Mistari ya counting ambayo haikupostiwa haiwezi kujumlishwa. Ni tofauti ileile inayoonekana kila siku, au ni manunuzi yaliyoingizwa baada ya counting.
4. Kama gharama zako za kweli ni 91k kwa siku, duka liko **karibu na kutopata faida**: 100.5k − 91k − 10.3k ≈ **−0.8k kwa siku**.

---

## 1. Gharama zinahifadhiwa wapi

| Aina | Jedwali / column | Maelezo |
|---|---|---|
| Gharama za kila siku (chakula, umeme, dereva, n.k.) | `reconciliation_expenses` (`expense_type`, `amount`, `reconciliation_uid`), na jumla yake kwenye `daily_reconciliation.expenses_total` | Hiki ndicho chanzo cha kweli. Kinatumia **tarehe ya recon**, yaani siku pesa ilipotumika. |
| Nakala ya gharama za kila siku | `capital_expenditure`, `expenditure_type='DAILY_EXPENSE'`, `source='RECONCILIATION'`. Kiungo ni `reconciliation_expenses.capital_expenditure_uid` | Ni nakala moja kwa kila mstari. `transaction_date` ni **siku ilipoingizwa**, si siku ya recon. **Usijumlishe zote mbili.** |
| Gharama za mwezi (mishahara, router, Azam) | `capital_expenditure`, `expenditure_type='MONTHLY_EXPENSE'`, pamoja na `allocated_year` na `allocated_month` (1–12) | Zinahesabiwa kwa mwezi wa `allocated_month`, si kwa `transaction_date`. |
| Gharama za mwaka mzima (pango, TRA) | Jedwali hilohilo, lakini `allocated_month = 0` | Kiasi kilichohifadhiwa (`amount`) ni **cha mwezi mmoja**, mfano pango ni 200,000 = 2.4M ÷ 12. Kinatumika **kila mwezi** wa mwaka huo. `transaction_date` ni 01/01/2026. |
| Bajeti za kila mwezi (recurring) | `is_recurring=true`, `recurring_type='MONTHLY_BUDGET'` ni template yenye kiasi 0. Kisha kuna mstari mmoja kwa kila mwezi (`parent_capital_expenditure_uid`) | Template yenyewe si gharama. Sasa kuna Dereva 150k kwa Sept, Okt, Nov na Des. |
| Mali (uchakavu) | `capital_expenditure`, `expenditure_type='INVESTMENT'`, `is_asset`, `asset_life_months`, `monthly_depreciation` | `monthly_depreciation` ni **NULL**. Kwa hiyo uchakavu hauingii kwenye faida yoyote ya LSMS. |
| Upungufu wa pesa kwenye recon | `daily_reconciliation.variance_amount` | Ni upotevu wa pesa, si gharama. Angalia 2e. |
| Upungufu wa stock unaodaiwa kwa wafanyakazi | `staff_liability`, `staff_liability_payment` | Inapunguza upotevu kama pesa itakusanywa. Angalia 3d. |
| GL | `journal_entry_line`, akaunti 6xxx | Dump hii ni ya **kabla** ya GL rebuild, kwa hiyo haiaminiki kwa kipindi hiki. Haikutumika. |

**Hakuna** "accrual ya kila siku" iliyohifadhiwa kwenye database. Flutter (`daily_profit_service.dart`) inaigawa kwa wakati huo: kiasi cha mwezi ÷ idadi ya siku za mwezi. Mistari inayohusika kwa mwezi inachaguliwa na `findMonthlyAllocation`.

### Kwa nini uchambuzi uliopita ulipata ~3.0M tu [Uhakika]
| Kipengele | Uliopita | Sahihi | Sababu |
|---|---|---|---|
| Gharama za kila siku | 2,125,800 | 1,997,300 | Ulitumia `transaction_date` ya nakala. Mistari 15 (128,500) ni ya recon za Juni na 01/07 zilizoingizwa baadaye, mfano 06/09. |
| Gharama za mwezi | 878,000 | 1,534,844 | Ulichukua mistari yenye `transaction_date` ndani ya kipindi tu, yaani Ago 330k na Sep 548k. **Ulikosa pango (200k kwa mwezi) na TRA (20,833 kwa mwezi)**, kwa sababu tarehe yao ni 01/01/2026. Pia ulikosa Azam ya Julai (tarehe 01/07). |
| Kurudiwa (Azam Sept) | — | −27,067 | Angalia 2c. |
| **Jumla** | **3,003,800** | **3,505,077** | |

**Hitilafu nyingine ndani ya LSMS** [Uhakika]: view `v_profit_loss_statement` (V048) **inagawa tena kwa 12** mistari yenye `allocated_month=0`.
- Kwa hiyo P&L ya LSMS inaonyesha pango + TRA kama 18,403 kwa mwezi, badala ya 220,833.
- P&L ya LSMS inapunguza gharama kwa ~202k kila mwezi.

### "63k kwa siku" inatoka wapi? (Kubahatisha)
Jumla ya **mistari yote ya mwezi ya mwaka 2026** ni 1,926,833. 1,926,833 ÷ ~30.5 ≈ **63k**. Jumla hiyo inajumuisha:
- Jan: pango 200k + TRA 20,833 + mstari wa zamani "2400000" wa 200k, unaohusu Januari tu;
- Jul 28k, Ago 330k, Sep 548k;
- template ya dereva (150k kwenye `monthly_allocation_amount`);
- Okt hadi Des: 450k.

Hiyo ni gharama ya **mwaka mzima ikigawanywa kwa mwezi mmoja**, si gharama ya mwezi. Kama una namba ya 63k kutoka skrini fulani, tafadhali niambie ni ipi ili niithibitishe.

---

## 2. Gharama za 02/07 hadi 29/09

### 2a. Gharama za kila siku (kwa tarehe ya recon) [Uhakika]
| Aina | Jul | Ago | Sep | Jumla |
|---|---|---|---|---|
| CHAKULA | 221,000 | 263,000 | 289,000 | 773,000 |
| NYINGINE | 107,500 | 153,500 | 212,500 | 473,500 |
| MISHAHARA (zaidi ni dereva 4–5k kwa siku) | 134,800 | 111,500 | 134,000 | 380,300 |
| UMEME | 62,000 | 40,000 | 125,000 | 227,000 |
| USAFIRI | 28,000 | 32,000 | 23,000 | 83,000 |
| UKARABATI | 7,000 | 53,500 | — | 60,500 |
| **Jumla** | **560,300** | **653,500** | **783,500** | **1,997,300** (22,192 kwa siku) |

Jumla hii inajumuisha recon ambazo bado ziko draft, submitted au reviewed (~164k). Gharama hizo zilitumika kweli.

### 2b. Gharama za mwezi (kanuni ya LSMS, na kugawanywa kwa siku za kipindi) [Uhakika]
| Kipengele | Jul (30/31) | Ago | Sep (29/30) | Jumla |
|---|---|---|---|---|
| Pango la frame (2.4M ÷ 12) | 193,548 | 200,000 | 193,333 | 586,882 |
| TRA (250k ÷ 12) | 20,161 | 20,833 | 20,139 | 61,134 |
| Azam (kingamuzi) | 27,097 | — | 27,067 | 54,164 |
| Mfanyakazi / wafanyakazi | — | 150,000 | 290,000 (2 × 150k) | 440,000 |
| Manager | — | 180,000 | — | 180,000 |
| Dereva (bajeti ya mwezi) | — | — | 145,000 | 145,000 |
| Router | — | — | 67,667 | 67,667 |
| **Jumla** | **240,806** | **550,833** | **743,205** | **1,534,844** (17,054 kwa siku) |

### 2c. Kuzuia kuhesabu mara mbili
| Kipengele | Kiasi | Uamuzi | Uhakika |
|---|---|---|---|
| Azam 28k imeandikwa **kila mwezi kwenye recon** (01/07, 08/08, 05/09) **na pia** kama gharama ya mwezi (Jul, Sep). Ndani ya kipindi, Sept imehesabiwa mara mbili. | −27,067 | Imetolewa | (Inawezekana) |
| Dereva: recon inaonyesha malipo ya 4–5k karibu kila siku (Jul 65k, Ago 68k, **Sep 86k**). Kuanzia Sept kuna pia bajeti ya mwezi ya 150k. 5k × 30 = 150k, kwa hiyo huenda ni mshahara uleule unaolipwa kidogo kidogo. | hadi −86,000 | **Haijatolewa**, ila inaonyeshwa kama tofauti | (Kubahatisha) |
| Sept kuna mistari miwili ya "Malipo Ya Wafanyakazi" 150k, iliyoingizwa 08/09 saa 08:49 na 09:11. Agosti ilikuwa Mfanyakazi 150k + Manager 180k, kwa hiyo huenda mmoja wao ni Manager. | hadi −145,000 | Haijatolewa | (Kubahatisha) |
| Pango na TRA hazijaandikwa kwenye recon wala kama malipo ya jumla. Zinahesabiwa mara moja tu. | — | Sawa | [Uhakika] |

### 2d. Jumla ya gharama
| | Siku 90 | Kwa siku |
|---|---|---|
| Kila siku (2a) | 1,997,300 | 22,192 |
| Mwezi (2b) − Azam iliyorudiwa | 1,507,777 | 16,753 |
| **Gharama zilizorekodiwa LSMS** | **3,505,077** | **38,945** |
| Uchakavu wa mali (haujarekodiwa): Guta 3.7M/72 mwezi, Shelves 1.2M/60, Glass 42k/12, jumla 74,889 kwa mwezi | 221,589 | 2,462 |
| **Jumla pamoja na uchakavu** | **3,726,666** | **41,407** |

**Kilichokosekana dhahiri** (kwa kuangalia rekodi zenyewe):
- Julai haina mshahara wowote wa mwezi, isipokuwa dereva wa kila siku.
- Agosti haina dereva wa mwezi.
- Septemba haina Manager.

Kama kuna malipo ya mwezi (mishahara, pango la nyumba au ghala, maji, ulinzi, leseni) ambayo **hayapo kwenye orodha ya 2b**, basi hayapo LSMS.

### 2e. Upungufu wa pesa kwenye recon (si gharama)
Jumla ni −529,850 (upungufu −685,700, ziada +155,850). Lakini −542,000 ya 04/07 imeelezwa kama **"imekosewa"** (kosa la kuingiza data). Bila hiyo, jumla ni **+12,150**, kwa hiyo pesa iko sawa. Haijaingizwa kwenye faida. (Inawezekana)

---

## 3. Upotevu halisi wa stock

### 3a. Kwa nini 1.5M na "+2.6M ya ziada" zote si sahihi
Ndani ya kipindi (counting zilizo-approved 07/07 hadi 29/09) [Uhakika]:

| | Mistari | Vipande | Thamani |
|---|---|---|---|
| Zilizopostiwa, upungufu | 213 | −1,439 | −1,814,746 |
| Zilizopostiwa, ziada | 53 | +543 | +582,879 |
| **Zilizopostiwa, jumla** | 266 | **−896** | **−1,231,867** (−1.25M kwa gharama ya leo) |
| Hazikupostiwa, upungufu | 367 | −4,403 | −5,522,133 |
| Hazikupostiwa, ziada | 141 | +7,252 | +8,115,362 |
| **Hazikupostiwa, jumla** | **508** | **+2,849** | **+2,593,229** |

Ripoti iliyopita ilisema mistari 497 na ~2.72M. Tofauti ndogo inatokana na kichujio cha tarehe. Hitimisho halibadiliki.

**Mistari ambayo haikupostiwa HAIWEZI kujumlishwa.** Counting inafanyika **kila siku kwa bidhaa zote**. Kwa hiyo tofauti ambayo haikupostiwa inaonekana tena kesho na keshokutwa [Uhakika]:

| Aina ya mstari usiopostiwa | Mistari | Vipande | Thamani |
|---|---|---|---|
| Upungufu ule**ule** unajirudia siku inayofuata | 214 | −1,311 | −1,590,396 |
| Ziada = manunuzi **yaliyoingizwa baadaye siku hiyohiyo** | 31 | +3,764 | +2,939,307 |
| Ziada nyingine | 110 | +3,488 | +5,176,055 |
| Upungufu mwingine | 153 | −3,092 | −3,931,738 |

Mifano:
- **GILBEYS KUPIMA** ni −9 kila siku kwa siku 67. Huo ni upungufu **mmoja** wa vipande 9, si 603.
- **PEPSI && MIRINDA** inaonyesha +240, +480, +720 na +288. Mfano wa 29/09: counting ya saa 11:04 ilikuta 344 dhidi ya 56 kwenye mfumo. Kisha manunuzi ya **288** yaliingizwa saa 15:28. Mzigo ulifika kabla haujaingizwa kwenye mfumo.

### 3b. Njia sahihi: tofauti ya mwanzo dhidi ya mwisho, kwa kila bidhaa (N3.4)
Kwa kila bidhaa:

**upotevu = (hesabu − mfumo) ya counting ya mwisho − (hesabu − mfumo) ya counting ya kwanza + marekebisho yote yaliyopostiwa katikati**

Hii ni sawa na mabadiliko ya stock halisi, ukitoa manunuzi na kuongeza mauzo yaliyorekodiwa. Inafanya kazi bila kujali kama mistari ilipostiwa au la, kwa sababu marudio yanajifuta yenyewe.

| Hatua | Vipande | Thamani | Uhakika |
|---|---|---|---|
| Counting zilizopostiwa ndani ya kipindi | −896 | −1,250,427 | [Uhakika] |
| Toa za 07/07, ambazo ni upotevu wa **kabla** ya counting ya kwanza (zote zilipostiwa 07/07 saa 10:25) | +274 | +373,900 | [Uhakika] |
| Ongeza tofauti zisizopostiwa za counting ya mwisho (29/09) | +280 | +155,966 | [Uhakika] |
| …lakini PEPSI +288 ni manunuzi yaliyoingizwa baadaye siku hiyo | −288 | −153,600 | [Uhakika] |
| Marekebisho ya mkono `ADJ-*` (10). Mengi yameandikwa "imerekebishwa" tu, mfano CUCA −90, GOLDEN KING −96, COCA +120 | −95 | −244,658 | (Inawezekana) |
| **Hitilafu ya mfumo:** sale RCP-20260807-270000-DCCB (CASTLE LITE) ilitoa vipande 8 tu kwenye stock, lakini ilipofutwa ikarudisha **160**. Hiyo ni stock hewa ya +152, na counting ya 08/08 ikaipostia kama "upotevu" wa −151. PEPSI ilikuwa na +4 kwa njia hiyohiyo. | +156 | +252,933 | [Uhakika] |
| **Upotevu halisi, 07/07 hadi 29/09 (siku 84)** | **−569** | **−865,887** | (Inawezekana) |
| Kwa siku | | **−10,308** | |
| Ikipanuliwa kwa siku 90 | | **−927,738** | (Inawezekana) |

Bidhaa zenye upotevu mkubwa zaidi:

| Bidhaa | Upotevu |
|---|---|
| CASTLE LITE (baada ya kutoa stock hewa) | −35 pcs, ≈ −58k |
| CUCA (ADJ) | −168k |
| GOLDEN KING (ADJ) | −167k |
| COCA && FANTA | −122k |
| SERENGETI LAGER | −68k |
| SAFARI LAGER | −54k |

Bidhaa za KUPIMA zina upungufu wa kudumu wa 8–9 kwa kila moja, yaani chupa iliyo wazi.

### 3c. Jibu kwa swali
- Kama counting zote zilizo-approved zingepostiwa sawasawa, upotevu halisi ungekuwa **~−0.87M kwa siku 84 (~−0.93M kwa siku 90, ~10k kwa siku)**.
- Si −1.5M, kwa sababu:
  - −0.37M ilikuwa upotevu wa kabla ya kipindi;
  - −0.25M ilikuwa stock hewa ya hitilafu ya kufuta sale.
- Si +2.6M, kwa sababu hiyo ni tofauti zilezile zilizohesabiwa mara nyingi, pamoja na manunuzi yaliyochelewa kuingizwa.

### 3d. Madeni ya wafanyakazi (yanapunguza upotevu kama yatakusanywa)
- `staff_liability`: 651,404 zimedaiwa kwa wafanyakazi (14/07 hadi 26/09). Kati ya hizo, **156,369 zimelipwa**. [Uhakika]
- Hazijatolewa kwenye upotevu hapo juu.
- Kama zote zitakusanywa, upotevu kwa biashara unashuka hadi ~−0.28M.

---

## 4. Thamani ya stock kwa gharama

**Njia:**
- Salio la mfumo (`store.stock_after` ya mwisho kwa kila bidhaa), likizidishwa na **bei ya mwisho ya kununua hadi siku hiyo** (`purchases.cost_per_piece`).
- Kwa kulinganisha, pia limezidishwa na `current_average_cost` ya leo.
- Kisha nimerekebisha kwa matukio yanayojulikana.

| | Vipande | Bei ya kununua ya wakati huo | Bei ya wastani ya leo |
|---|---|---|---|
| Mfumo, mwisho wa 01/07 | 3,029 | 6,803,098 | 6,893,785 |
| − mauzo **ya tarehe 01/07** ambayo stock yake ilitoka 02/07 | −511 | −778,983 | −816,180 |
| **Mwanzo halisi wa 02/07** | **2,518** | **6,024,115** | 6,077,605 |
| Counting ya kwanza (07/07) ilikuta upungufu wa −274 pcs. Huenda sehemu yake ni ya kabla ya 02/07. | | (−373,900) | |
| Mfumo, mwisho wa 29/09 | 2,130 | 5,677,352 | 5,654,141 |
| + tofauti zisizopostiwa za 29/09 (bila PEPSI) | −8 | +2,366 | |
| **Mwisho halisi wa 29/09** | **~2,122** | **~5,679,700** | |
| Kwa kulinganisha: counting ya 29/09 asubuhi, kabla ya manunuzi ya siku hiyo | 2,043 | 5,595,736 | |

**Matokeo:**
- Stock imeshuka kwa **~0.35M**, kutoka 6.02M hadi 5.68M (Inawezekana).
- Kama upungufu wa 07/07 ulikuwepo tayari tarehe 02/07, stock ilibaki karibu sawa (+0.03M).
- Ripoti iliyopita ilisema −1.24M. Ilikuwa juu kwa sababu ya mauzo 511 ya 01/07 yaliyoingizwa 02/07 (~0.78M).

Uhakiki: manunuzi 91.02M − COGS 90.15M − upotevu 0.87M (− 0 hadi 0.37M ya kabla) ≈ **−0.0 hadi −0.37M**. Hii inalingana na mabadiliko ya stock hapo juu.

---

## 5. Jedwali la mwisho: faida halisi

| Kipengele | Siku 90 | Kwa siku | Uhakika |
|---|---|---|---|
| Mauzo (STANDARD, bila yaliyofutwa) | 99,195,850 | 1,102,176 | [Uhakika] |
| COGS | 90,146,504 | 1,001,628 | [Uhakika] |
| **Faida ghafi** | **9,049,346** (9.12%) | **100,548** | [Uhakika] |
| − Gharama za kila siku (recon) | 1,997,300 | 22,192 | [Uhakika] |
| − Gharama za mwezi (pango, TRA, mishahara, Azam, router), bila kurudia | 1,507,777 | 16,753 | [Uhakika] / (Inawezekana) kwa Azam |
| **= Faida baada ya gharama zilizorekodiwa** | **5,544,269** (5.6%) | **61,603** | (Inawezekana) |
| − Uchakavu wa mali (haujarekodiwa) | 221,589 | 2,462 | (Inawezekana) |
| − Upotevu halisi wa stock | 927,738 | 10,308 | (Inawezekana) |
| **= Faida halisi (net)** | **≈ 4,394,942 (4.4%)** | **≈ 48,833** | (Inawezekana) |

**Tofauti zinazowezekana** (kwa siku):

| Hali | Mabadiliko | Faida kwa siku |
|---|---|---|
| Dereva Sept amehesabiwa mara mbili (Kubahatisha) | +956 | ~49.8k |
| Wafanyakazi Sept 150k ni mstari uliorudiwa (Kubahatisha) | +1,611 | ~50.4k |
| Madeni ya wafanyakazi yote yakikusanywa (651k) | +7,238 | ~56k |
| Bila uchakavu (kama LSMS inavyohesabu sasa) | +2,462 | ~51.3k |
| **Kama gharama za kweli ni 91k kwa siku** (dai lako) | −52,055 | **≈ −0.8k (hakuna faida)** |

**Hitimisho:**
- Kwa data iliyo LSMS, faida halisi ni **~49k kwa siku (~4.4% ya mauzo)**.
- Ili dai la 91k kwa siku liwe kweli, **~4.7M za gharama kwa siku 90 lazima ziwe nje ya LSMS**.
- Namba zote za mwezi zilizo LSMS zimeorodheshwa kwenye 2b. Tafadhali linganisha na malipo yako halisi ya kila mwezi.

---

## Mambo ya kurekebisha kwenye mfumo (hayajafanyika; ni uchambuzi tu)
1. `v_profit_loss_statement` inagawa tena kwa 12 mistari ya `allocated_month=0`. Kwa hiyo P&L inapunguza pango na TRA kwa ~202k kila mwezi.
2. `monthly_depreciation` ni NULL kwa mali zote 3, kwa hiyo uchakavu hauhesabiwi popote.
3. Kufuta sale kunaweza kurudisha stock zaidi ya iliyotolewa (CASTLE LITE: imetoka 8, imerudi 160).
4. Counting inapostiwa kwa sehemu tu. Mistari 508 haikupostiwa, na ziada nyingi zinatokana na manunuzi kuingizwa baada ya counting. Inahitajika kanuni ya "manunuzi yaliyopokelewa kabla ya counting".
5. Gharama za Azam na dereva zinaandikwa sehemu mbili: recon na pia gharama ya mwezi.
6. Nakala ya gharama za recon kwenye `capital_expenditure` inatumia tarehe ya kuingiza, si tarehe ya recon.
