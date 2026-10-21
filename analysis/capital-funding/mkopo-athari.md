# Mikopo: hali ya sasa, marekebisho, na athari kwenye biashara

**Chanzo cha namba zote:** `lsms_audit_20261015_0200` (dump ya usiku 15/10 02:00, Flyway 133), kusoma tu.
Query: `mkopo-athari.sql`, matokeo: `mkopo-athari.out`. Hakuna kilichobadilishwa popote.

Muundo wa Toleo 2 na 4 umeingizwa kwenye `MPANGO-PAMOJA.md` §2.10 na §4.2. Marekebisho ya mmiliki ya 19/10 yamefuatwa:
- malipo ya mkopo hayahusiani na reco;
- riba inagawanywa kwa siku;
- deni la msingi liko chini ya Net profit;
- mkopo wa mara moja una mstari wa "Akiba ya mkopo".

**Sasisho 19/10 (majibu ya M-1 na M-2):**
- **Mkopo A** = deni 1,000,000 + riba **158,000** = 1,158,000; malipo 386,000 × 3, kila mwezi; ada 0. Malipo ni 04/11/2026, 04/12/2026 na 04/01/2027.
- **Mkopo B** ulienda moja kwa moja kununua mzigo. Akaunti yake (CASH 1000) **hairekebishwi**, na Septemba haifunguliwi (§7).

---

## 1. Rekodi zilizopo

| # | Mkopo | Tarehe ya mkopo | Iliingizwa | Na | Kiasi kwenye LSMS | Njia | GL |
|---|---|---|---|---|---|---|---|
| A | "kwa miezi 3 kila mwezi ni 386000" | 04/10 | 04/10 15:21 | Paul Tarimo | **1,186,000** (sahihi: 1,000,000 + riba 158,000) | NMB | Dr 1021 / Cr 2100 1,186,000 |
| B | "Kikundi, bila riba, inarudishwa 28/11/26". **Ulienda moja kwa moja kwenye mzigo** (mmiliki, 19/10) | 26/09 | **13/10 21:46** (siku 17 baadaye) | Jess Saimon | 1,200,000 | **CASH** | Dr **1000** / Cr 2100 1,200,000; unasawazishwa na purchases za Cr 1000 (§7) |
| (zamani) | "MKOPO WA BANK" | 21/05 | | | 244,985 | | ulilipwa wote 11/06, riba 0 |

Salio la GL leo:

| Akaunti | Salio |
|---|---|
| 1021 NMB | 1,186,000 |
| 2100 Mikopo | 2,386,000 |
| 6600 Riba | **0** (riba haijawahi kuandikwa) |

### Mambo matatu yanayotofautiana na maelezo ya mmiliki

1. **Edit ya Mkopo A ilifanyika 11/10 saa 14:59, si 06/10.**
   - GL ina reversal ya 1,000,000 ya tarehe 11/10, na journal mpya ya 1,186,000 iliyowekwa tarehe 04/10.
   - Hakuna audit trail ya edit hiyo; ushahidi pekee ni GL.
   - Matokeo yake: kati ya 04/10 na 10/10, GL ilionyesha NMB **2,186,000**.
   - Sababu: `updateLoan` inaandika reversal kwa tarehe ya leo, si ya mkopo. Hili ni kosa la aina ya H-5, na linarekebishwa Toleo 2 (§2.10).
2. **386,000 × 3 = 1,158,000, si 1,186,000.** **M-1, imejibiwa:**
   - riba ni **158,000**, malipo ni 386,000 × 3, ada 0;
   - rekodi ya 1,186,000 ilikuwa na 28,000 zaidi ya deni lote halisi (1,158,000);
   - hata hivyo, marekebisho ni yaleyale: kiasi kinakuwa 1,000,000 (§3).
3. **Mkopo B umeandikwa CASH (droo, 1000), wenye tarehe 26/09, lakini uliingizwa 13/10.** **M-2, imejibiwa:** ulienda moja kwa moja kununua mzigo.
   - Purchases za siku hizo zilipostiwa Cr 1000. Kwa hiyo Dr 1000 ya mkopo na Cr 1000 ya purchases zinasawazishana, na akaunti haibadilishwi.
   - Uthibitisho uko §7.

## 2. Malipo ya Mkopo A tangu 04/10

**Hakuna malipo yoyote hadi 14/10.** Nimetafuta kila mahali ambapo malipo yangeweza kuandikwa:

| Mahali | Kilichopatikana |
|---|---|
| `capital_injections` LOAN_REPAYMENT | 0 |
| `capital_expenditure` (maneno mkopo/riba/loan, au loan_principal/interest > 0) | 0 |
| Gharama za reco | 0 |
| Cash entries za reco | 0 (NMB deposits zote ni "cash ya mauzo") |
| GL: Dr 2100 au Dr 6600 baada ya 04/10 | 0 |

Kwa hiyo hakuna cha kugawanya deni/riba "kwa nyuma". Malipo ya kwanza yataingizwa na fomu mpya (Toleo 2), ikigawanywa moja kwa moja.

## 3. Hatua ya marekebisho ya Mkopo A (IMEANDALIWA, HAIJATEKELEZWA)

**Lengo:** rekodi `INJ-0c98b69e` iwe **1,000,000** (kutoka 1,186,000) kwenye NMB na 2100. Riba ya **158,000** inakuwa gharama ya siku kwa siku, si pesa iliyopokelewa.

**Wakati:** hatua bado **inasubiri Toleo 2**. Hapo `updateLoan` inaandika reversal kwa tarehe ya mkopo, na fomu ina sehemu ya riba. Ikiendeshwa leo kwa endpoint ya sasa, reversal ingeingia tarehe ya leo, na siku za 04/10 hadi leo zingebaki na NMB +186,000.

**Hatua (staging kwanza, kisha prod; zitaandikwa kama faili za `analysis\steps\` za Toleo 2):**

1. Kusoma tu: hali ya kabla.
   - `capital_injections` id 5;
   - GL 1021, 2100, 6600;
   - journals zenye `reference_uid = 'INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637'`.
2. `PUT /api/v1/capital-monitoring/loans/INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637`, pamoja na sehemu mpya za Toleo 2:
   - `amount 1000000`, `interestTotal 158000`, `fee 0`;
   - `repaymentType MONTHLY`, `installment 386000`;
   - `startDate 2026-10-04`, `endDate 2027-01-04`, `firstPaymentDate 2026-11-04`, `receiveAccount 1021`.

   Ratiba inayotarajiwa (uwiano 1,000/1,158; malipo ya mwisho yanachukua senti):

   | # | Tarehe | Malipo | Deni (Dr 2100) | Riba (Dr 2110) |
   |---|---|---|---|---|
   | 1 | 04/11/2026 | 386,000 | 333,333.33 | 52,666.67 |
   | 2 | 04/12/2026 | 386,000 | 333,333.33 | 52,666.67 |
   | 3 | 04/01/2027 | 386,000 | 333,333.34 | 52,666.66 |
   | | **Jumla** | **1,158,000** | **1,000,000.00** | **158,000.00** |
3. GL inayotarajiwa (zote zikiwa na tarehe 04/10):
   - reversal ya 1,186,000: Dr 2100 / Cr 1021;
   - journal mpya: Dr 1021 / Cr 2100 1,000,000;
   - riba ya siku kuanzia 04/10 hadi siku ya deploy: Dr 6600 / Cr 2110, **1,717.39** × siku (158,000 ÷ 92; §2.10).
4. Kusoma tu: hali ya baada. Inapita ikiwa:
   - NMB inapungua kwa 186,000;
   - 2100 inapungua kwa 186,000;
   - 6600 = 2110 = jumla ya riba ya siku hizo;
   - TB na mizania vinalingana.

**Historia ya 04/10 hadi 10/10:** reversal ya 11/10 (ya 1,000,000 ya kwanza) itabaki tarehe 11/10. Kwa hiyo hata baada ya marekebisho, siku hizo 7 zinaonyesha NMB +1,000,000. **M-3: zinaachwa ilivyo** (uamuzi wa mmiliki 19/10).

**Malipo ya nyuma:** hakuna (§2). Malipo yatakayofanyika kabla ya Toleo 2 yaingizwe kwa `POST /loans/{uid}/repay` yenye `principal_amount` na `interest_amount` kwa uwiano wa §2.10. Hapo GL ya sasa itaandika Dr 2100 + Dr 6600 / Cr chanzo, na Toleo 2 itaigeuza 6600 hiyo kuwa Dr 2110 ili riba isihesabiwe mara mbili.

## 4. Msingi wa kipimo: 01/08 hadi 14/10

Mauzo ni ya STANDARD (bila walk-in debts). Faida ghafi = mauzo − gharama ya bidhaa. Jedwali la kila siku liko kwenye `mkopo-athari.out` (M5).

Stockouts zinahesabiwa hivi:
- **Fast-movers** = bidhaa 20 zilizouzwa vipande vingi zaidi kati ya 01/08 na 25/09, yaani kabla ya mikopo.
- **Stockout** ya siku = salio la mwisho wa siku ni ≤ 0, au count ya siku hiyo ilikuta 0.

| Kipindi | Siku | Mauzo/siku | Faida ghafi/siku | GM | Stockouts/siku (kati ya 20) |
|---|---|---|---|---|---|
| Ago–Sep (01/08–25/09), kabla ya mikopo | 56 | 1,061,999 | 94,902 | 8.94% | 3.59 |
| Wakati huo wa mwezi uliopita (26/08–14/09) | 20 | 1,184,235 | 106,859 | | 4.05 |
| B tu (26/09–03/10) | 8 | 1,366,313 | 113,907 | 8.34% | 4.62 |
| A + B (04/10–14/10) | 11 | 1,467,864 | 120,542 | 8.21% | 4.09 |
| **Baada ya mikopo (26/09–14/10)** | 19 | **1,425,105** | **117,748** | 8.26% | **4.32** |

Kuthibitisha kama pesa ya mikopo iliingia kwenye mzigo:

| | 01/08–25/09 | 26/09–03/10 | 04/10–14/10 |
|---|---|---|---|
| Manunuzi kwa siku | 1,005,651 | 1,231,619 | 1,379,118 |

| Tarehe | 31/08 | 25/09 | 03/10 | 14/10 |
|---|---|---|---|---|
| GL 1200 Mzigo | 3,260,222 | 4,014,440 | 4,830,501 | **5,384,334** |

### Inamaanisha nini

- **Mzigo umeongezeka 1.37M tangu 25/09**, na manunuzi yamepanda kwa 23–37%. Pesa ya mikopo inaonekana iliingia kwenye mzigo.
- **Mauzo yamepanda.** Faida ghafi imeongezeka kwa +22,846 kwa siku ukilinganisha na Ago–Sep, au +10,889 kwa siku ukilinganisha na wakati huo wa mwezi uliopita. Kipindi cha 24–29 ni kilele cha kila mwezi (factor 1.15), kwa hiyo +10.9k ndiyo kipimo cha haki zaidi.
- **Stockouts hazijapungua** (3.59 → 4.32 kwa siku). Mzigo wa ziada haujaenda kwenye fast-movers zinazoisha. Hili ni swali la jinsi ya kununua (auto-order), si la mkopo wenyewe.
- **GM imeshuka** (8.94% → 8.26%). Mauzo ya ziada yamekuja kwa margin ndogo. Mfano: 10/10 mauzo yalikuwa 2.71M kwa GM 9.0%, lakini 06–07/10 GM ilikuwa 5.8–6.5%.
- **Siwezi kuthibitisha kwamba mkopo ndio uliosababisha ongezeko.** Ni siku 19 tu, na kipindi kinajumuisha mwisho wa mwezi. Kadi ya Toleo 4 itaendelea kupima kadiri siku zinavyoongezeka.

## 5. Margin halisi na kulipa riba ya 158,000 ndani ya siku 90

Gharama za uendeshaji kwa siku = gharama za reco + (gharama za mwezi + gharama za mwaka kwa mwezi) ÷ siku za mwezi:

| | Ago | Sep | Okt (1–13) |
|---|---|---|---|
| Gharama/siku | 38,850 | 53,245 | 46,178 |

| | Ago–Sep | 26/09–14/10 |
|---|---|---|
| Faida ghafi/siku | 94,902 | 117,748 |
| Gharama/siku | ≈ 45,280 | ≈ 48,000 |
| **Net/siku** (bila upotevu wa mzigo) | **≈ 49,600 (4.7%)** | **≈ 69,700 (4.9%)** |
| Net/siku baada ya upotevu wa mzigo (≈10k/siku, ripoti ya 01/10) | ≈ 39,600 (3.7%) | ≈ 59,700 (4.2%) |

**Riba ya A** (imehesabiwa upya 19/10 kwa riba ya 158,000):
- 158,000 ÷ siku 92 (04/10/2026 hadi 04/01/2027) = **1,717 kwa siku** (1,717.39). Ni karibu 2.5–4.3% ya net ya siku.
- Ili riba ijilipe ndani ya siku 90, faida ghafi ya ziada inahitajika kuwa 1,756 kwa siku. Kwa GM ya 8.94%, hiyo ni **mauzo ya ziada ya ≈ 19,600 kwa siku** (+1.85% ya mauzo ya Ago–Sep).
- Ongezeko lililoonekana (+10.9k hadi +22.8k ya faida ghafi kwa siku) ni mara 6–13 ya hitaji hilo. Kwa hiyo **ikiwa** ongezeko linatokana na mkopo, riba inajilipa.

**Pesa ya kulipa, ambalo ndilo jambo zito zaidi:**

| Hitaji | Kuanzia 15/10 (dump) | Kuanzia 19/10 (leo) |
|---|---|---|
| Mkopo B: 1,200,000 hadi 28/11, akiba haijaanza (Y = 0) | siku 44: **27,273** | siku 40: **30,000** |
| Mkopo A: 386,000 kwa mwezi ÷ siku za mwezi | Okt: 12,452 (Nov: 12,867) | Okt: 12,452 |
| **Jumla kwa siku** | **39,725** | **42,452** |

Ukilinganisha na net ya ≈ 40k–70k kwa siku, **"Pesa inayobaki baada ya mikopo" itakuwa kati ya ≈ 0 na 30k kwa siku hadi 28/11.**

Mfano wa onyo kwa leo, 19/10: "Mkopo B (Kikundi): zimebaki siku **40**; akiba iliyopo **0**; inahitajika **30,000** kwa siku." (MPANGO §2.10)
- Kama mauzo yatarudi kwenye wastani wa Ago–Sep, hakuna nafasi yoyote. Mkopo B ungehitaji karibu net yote ya siku.
- Kama akiba ya B ingeanzia 26/09, ingekuwa 19,048 kwa siku. Kila siku isiyoweka akiba inapandisha kiasi kinachohitajika kwa siku zinazobaki.

## 6. Maswali kwa mmiliki

Majibu ya 19/10:
- **M-1:** riba 158,000; malipo 386,000 × 3 (04/11, 04/12, 04/01/2027); ada 0.
- **M-2:** B ulienda moja kwa moja kwenye mzigo; akaunti haibadilishwi (§7).
- **M-3:** acha ilivyo.
- **M-4:** ndiyo (2110).
- **M-5:** ada inagawanywa kwa siku pamoja na riba.
- **M-6:** akiba ni akaunti halisi 1025 "Akiba ya mikopo"; Y = salio la GL 1025 (MPANGO §2.10).
- **M-7:** malipo 7 ya 04/10 ni kufuta madeni yaliyolipwa zamani (mmiliki atathibitisha). Hatua imeandaliwa: `m7-malipo-wasambazaji.md`.

| # | Swali | Inabadilisha |
|---|---|---|
| M-1 | Mkopo A: malipo ni 386,000 × 3 (= 1,158,000) au 395,333 × 3 (= 1,186,000)? Kuna ada? Malipo ya kwanza ni lini (04/11?), na ya mwisho? | Ratiba, riba ya siku, uwiano deni/riba |
| M-2 | Mkopo B (1,200,000, 26/09, CASH): pesa iliingia droo siku hiyo, au ilienda moja kwa moja kwenye mzigo, au ilibaki kwa mmiliki/benki? Kwa nini iliingizwa 13/10? | Kama si droo: kurekebisha akaunti ya kupokelea (Septemba itakuwa imefungwa, hivyo itahitaji kufunguliwa upya) |
| M-3 | Siku 04/10–10/10 (NMB +1,000,000 kwenye GL): ziachwe ilivyo, au zirekebishwe kwa journal 2? | Historia ya siku 7 tu |
| M-4 | Riba ya siku inaandikwa Dr 6600 / **Cr 2110 "Riba inayodaiwa"** (akaunti mpya ya deni), na malipo yanagawanywa Dr 2100 (deni) + Dr **2110** (riba) / Cr chanzo. Je, unakubali? Kama malipo yangeandika Dr 6600 tena, riba ingehesabiwa mara mbili. | §2.10 |
| M-5 | Ada ya mkopo (kama ipo): igawanywe kwa siku kama riba (6600), au iwe gharama siku ya kupokea? | §2.10 |
| M-7 | Tarehe 04/10 saa 15:14–15:16, Paul Tarimo aliandika malipo 7 ya wasambazaji kwa CASH jumla ya **6,751,443**, mengi kwa takawedo (6,258,126, ambayo purchases zake ni za 05/02–07/07). GL: Dr 2000 / **Cr 1000**. Je, pesa hiyo ilitoka droo siku hiyo, au ni kufuta madeni ya zamani ambayo yalikwisha kulipwa zamani? | Ikiwa yalikwisha kulipwa: 1000 ilipunguzwa 6.75M tarehe 04/10 kwa makosa (si suala la mkopo; nimeliona wakati wa ukaguzi wa §7) |
| M-6 | Akiba ya mkopo wa mara moja: CEO airekodi ("Weka akiba": kiasi na akaunti ilipo, bila journal) ili onyo lionyeshe "akiba iliyopo Y"? Au isiandikwe kabisa, yaani Y = 0 daima na Z = deni lililobaki ÷ siku zilizobaki? | Onyo, auto-order, Daily P&L |

## 7. M-2: je, Mkopo B uliingia kwenye mzigo? (kusoma tu, 19/10)

Query ni M9 kwenye `mkopo-athari.sql`, na matokeo yako mwishoni mwa `mkopo-athari.out`. DB ni `lsms_audit_20261015_0200`.

Purchases za kila siku (zisizofutwa, zisizo CANCELLED) zimelinganishwa na misingi miwili: wastani wa kalenda wa 01/08–25/09, na kipindi kilekile cha mwezi uliopita, 26/08–05/09 (24–29 ni kilele cha kila mwezi).

| Kipindi | Siku | Purchases | Ziada dhidi ya wastani wa kawaida (1,005,651/siku) | Ziada dhidi ya mwezi uliopita |
|---|---|---|---|---|
| **B tu: 26/09–03/10** | 8 | 9,852,952 | **+2,095,073** | **+913,897** |
| B + siku 2 za A: 26/09–05/10 | 10 | 13,342,552 | +3,645,204 | +2,168,734 |

**Hitimisho:**
- **Inakubaliana na maelezo ya mmiliki.** Kati ya 26/09 na 03/10 (kabla ya Mkopo A), purchases zilizidi kawaida kwa 0.91M hadi 2.10M, kutegemea msingi uliotumika. 1.2M iko katikati ya namba hizo mbili.
- Siwezi kuthibitisha kiasi halisi cha 1.2M kutoka data. Purchases hazina kiungo chochote na mkopo, kwa hiyo ziada inaonyesha tu kwamba pesa ya ziada iliingia kwenye mzigo, si kiasi chake kamili.
- Kuanzia 04/10, ziada inachanganyika na Mkopo A (NMB 1,000,000), kwa hiyo 26/09–05/10 si kipimo cha B peke yake.
- **GL:** purchases za 26/09–03/10 zote zilipostiwa Cr 1000, isipokuwa 85,200 kwenye AP 2000. Kwa hiyo Dr 1000 ya 1,200,000 (mkopo, tarehe 26/09) inasawazishwa na Cr 1000 ya purchases hizo, na droo ya GL haijazidi kwa sababu ya B.
- Purchases za reco za siku hizo ni ndogo (0 hadi 275,000 kwa siku). Kwa hiyo pesa ya mkopo haikupitia droo ya reco, jambo linalokubaliana na "moja kwa moja kwenye mzigo".
- **Akaunti haibadilishwi, na Septemba haifunguliwi.**

**Maelezo kwenye rekodi:**
- Nimeyaweka kwenye ripoti hii (§1).
- Ili yaonekane pia kwenye rekodi `INJ-4e3c01c3-122e-4e92-bdf0-a09c5d532f79`, CEO anaweza kuongeza kupitia Capital → Mikopo → Rekebisha, kubadilisha **Maelezo tu**: "ulienda moja kwa moja kwenye mzigo".
- Kubadilisha maelezo peke yake hakuandiki journal, kwa sababu `updateLoan` inapost upya tu kiasi, tarehe au njia vikibadilika.
- Sijaandika chochote kwenye DB.

**Jambo nililoliona njiani (M-7):** tarehe 04/10, GL ina `PURCHASE_PAYMENT` 7 zenye Cr 1000 jumla ya **6,751,443**:
- ni malipo ya wasambazaji ya CASH yaliyoandikwa na Paul Tarimo saa 15:14–15:16;
- dakika chache baadaye, saa 15:21, Mkopo A uliingizwa;
- takawedo peke yake ni 6,258,126, kwa purchases za 05/02–07/07.

Hili si la mkopo, lakini linapunguza droo ya GL kwa 6.75M siku moja. Swali liko §6.
