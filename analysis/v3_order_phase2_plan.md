# LSMS V3 — Pendekezo la oda: backtest ya dump ya leo na mpango wa Awamu 2

**Tarehe:** 2026-10-04
**Dump:** `lsms_20261004_0200.dump` kutoka B2 (`b2:elikom-lsms-backups/daily/`), imepakuliwa kupitia Contabo kwa `rclone cat`. SHA-256 ya PC na ya `~/backups/daily/` kwenye Contabo **zinalingana**: `e2f9a706675b734aa01fa812ab983cdfccd3f6eb0c00c17cef6ceaa1f5c0f97c`.
**Dirisha:** 2026-08-05 hadi 2026-10-03 (siku 60; siku 54 zina hesabu iliyoidhinishwa).
**Hali:** hakuna code ya production, deploy wala commit. Staging na prod hazikuguswa; backtest imeendeshwa kwenye container ya local.
**Faili:** `v3_order_backtest.sql`, `v3_order_backtest.py` (`LSMS_BT_END=2026-10-03`), matokeo kamili `v3_order_backtest_out/*.csv`. Ripoti ya Awamu 1 (`v3_order_plan.md`) inabaki kama ilivyo, kwa dump ya 30/09.

---

## 1. Maamuzi yako yaliyoingizwa

| # | Uamuzi | Ulivyowekwa kwenye backtest |
|---|---|---|
| 1 | Takawedo ndiye msambazaji mkuu | orodha moja; soda zinatengwa (wakala) |
| 2 | Orodha (banner + notification + "Shiriki"); prefill ya manunuzi ni awamu ijayo | hakuna rekodi ya manunuzi inayotengenezwa |
| 3 | Mfuko unaobeba salio, kikomo 1M; recon iliyowasilishwa yenye alama "haijaidhinishwa"; hesabu usiku | `budget=pool`, `pool_cap=1M`; jaribio la usiku (sehemu 3) |
| 4 | Soda zinaletwa na wakala kwa ratiba | daraja B linaagizwa kwa mzunguko (sehemu 5) |
| 5 | KUPIMA → daraja C | A = bidhaa 14, B = soda 2, C = 80 |
| 6 | Daraja A: cover 2, z 0.5 | ndiyo usanidi mkuu |
| 7 | Mzigo saa 7 mchana; mauzo mengi saa 8 mchana hadi 12 jioni | asilimia ya kabla ya saa 7 imepimwa kutoka data (sehemu 4) |

---

## 2. Backtest kwenye dump ya leo

### 2.1 Daraja A: stockout dhidi ya stock (bila kikomo cha bajeti, siku-bidhaa 840)
| cover_days / z | Siku za stockout | Stock ya wastani asubuhi | Mauzo yaliyopotea |
|---|---|---|---|
| **Halisi (mnunuzi wa sasa)** | **32** | **1,409,454** | haijulikani |
| 1.5 / 0.5 | 47 | 1,193,479 | 1.79M |
| 2 / 0 | 46 | 1,232,793 | 1.67M |
| 2 / 0.25 | 28 | 1,406,365 | 1.15M |
| **2 / 0.5 (uamuzi wako)** | **22** | **1,608,597** | **0.87M** |
| 2 / 0.75 | 15 | 1,829,889 | 0.59M |
| 2 / 1 | 8 | 2,029,944 | 0.37M |
| 3 / 0 | 15 | 2,022,967 | 0.57M |

Picha ni ileile ya 30/09: kwa stock ileile ya leo formula inaishiwa siku 28 dhidi ya 32; uamuzi wako (2 / 0.5) unashusha hadi 22 kwa stock +14%.

### 2.2 Bajeti (cover 2, z 0.5)
| Kanuni | Stockout A | Jumla iliyokatwa |
|---|---|---|
| Bila bajeti | 22 | 0 |
| Siku moja tu | 103 | – |
| Mfuko hadi 0.5M | 53 | – |
| **Mfuko hadi 1M (uamuzi wako)** | **27** | **3.5M** |
| Mfuko bila kikomo | 24 | – |

Bajeti ya wastani ni 1,046,396 kwa siku; manunuzi halisi ya wastani 1,033,972.

### 2.3 Usanidi ulioamuliwa: A 2 / z 0.5, mfuko 1M, soda kila siku cover 3
| | A simulation | A halisi | B simulation | B halisi |
|---|---|---|---|---|
| Siku za stockout | 27 | 32 | 0 | 0 |
| Stock ya wastani asubuhi | 1,547,655 | 1,409,454 | 198,498 | 257,292 |
| Stock baada ya kununua | 2,331,733 | 2,211,569 | 267,712 | 331,247 |
| Manunuzi siku 60 | 48.81M | 49.99M | 3.98M | 3.99M |
| Mauzo yaliyopotea | 1.03M | – | 0 | – |

Maandalizi ya kilele: stockout 27 ukiwasha, 29 ukizima.

### 2.4 Factors (hadi 03/10)
- Siku ya wiki, historia yote: Jtt 0.91, Jnn 0.79, Jtn 0.92, Alh 0.94, Ijm 0.99, Jms 1.23, Jpl 1.22. Wiki 8: 0.92, 0.86, 0.86, 0.96, 1.18, 1.16, 1.07 (bado hazijatulia).
- Tarehe: kilele 24–27 (1.16, 1.25, 1.20, 1.11), wastani 1.18. Tarehe 15–20 ni ~0.90; 30–31 ni 0.85–0.90.

---

## 3. Kuhesabu usiku baada ya kufunga

Pendekezo la usiku linatumia `hesabu ya asubuhi ya jana + manunuzi ya jana − mauzo ya jana` kama stock, badala ya kusubiri hesabu ya asubuhi ya leo. Nimelinganisha mapendekezo mawili kwa kila siku yenye hesabu halisi:

| Daraja A (siku-bidhaa 756) | Matokeo |
|---|---|
| Kreti zilezile | 696 (92%) |
| Usiku linapendekeza zaidi / pungufu | 25 / 35 |
| Tofauti ya wastani | kreti 0.13 kwa mstari |
| Siku za upungufu (stock halisi + pendekezo < mauzo) | usiku 12, asubuhi 11 |
| Jumla ya gharama ya mapendekezo | 57.92M usiku, 57.86M asubuhi |

**Hitimisho:** kwa bia, kuhesabu usiku hakubadilishi matokeo. Kwa soda stock ya usiku inatofautiana na hesabu ya asubuhi kwa wastani wa vipande ~80, kwa hiyo soda zisubiri hesabu.

**Pendekezo la mtiririko:**
1. Usiku baada ya kufunga: mfumo unahesabu pendekezo (stock iliyokadiriwa + recon ya leo).
2. Asubuhi: hesabu ikiidhinishwa, mistari ambayo hesabu inatofautiana na makadirio inahesabiwa upya na kuwekewa alama "imebadilika baada ya hesabu".
3. Mmiliki anarekebisha na kuidhinisha orodha kabla ya kwenda kununua.

**Tahadhari ya recon:** recon ya jana ilikuwa imewasilishwa kufikia saa 9 alasiri siku 21 tu kati ya 60 (imeidhinishwa siku 6). Kwa hiyo hata "recon iliyowasilishwa" haitoshi siku nyingi. Kama recon haijawasilishwa usiku, bajeti itumie namba za mfumo (mauzo − madeni yaliyoingizwa − gharama zilizoingizwa) na alama **"recon haijawasilishwa"**.

---

## 4. Asilimia ya mauzo kabla ya saa 7 mchana (imepimwa, si kubahatisha)

`mv_hourly_sales_summary` ipo, lakini inajengwa kutoka saa ya `sales.sale_date`, haina bidhaa, na mauzo yaliyoingizwa siku nyingine yanaangukia saa 00:00. Kwa hiyo nimetumia `sales.created_at` moja kwa moja kwa vipande vya daraja A.

| Siku | Vipande vilivyoingizwa kabla ya 13:00 | Vipande vyenye muda | Asilimia | Bila muda (viliingizwa siku nyingine) |
|---|---|---|---|---|
| Jumatatu | 37 | 3,302 | 1.1% | 5.5% |
| Jumanne | 286 | 3,096 | 9.2% | 6.0% |
| Jumatano | 195 | 3,191 | 6.1% | 12.2% |
| Alhamisi | 206 | 3,517 | 5.9% | 4.8% |
| Ijumaa | 294 | 4,058 | 7.2% | 12.4% |
| Jumamosi | 94 | 3,533 | 2.7% | 26.3% |
| Jumapili | 107 | 3,979 | 2.7% | 5.1% |
| **Zote** | **1,219** | **24,676** | **4.9%** | **11.0%** |

**Tahadhari muhimu: hii ni kiwango cha chini, si asilimia halisi.** Duka linaingiza mauzo ~10 kwa siku kwa mkupuo (wastani 108,000 kwa "sale", mistari 4.3). 63% ya thamani inaingizwa kati ya saa 2 na saa 5 usiku, wakati wewe unasema mauzo mengi ni saa 8 mchana hadi 12 jioni. Kwa hiyo `created_at` ni muda wa kuingiza, si muda wa kuuza. Kilichoingizwa kabla ya saa 7 kiliuzwa kabla ya saa 7 kwa hakika; kilichoingizwa baadaye kinaweza kuwa na mauzo ya asubuhi ndani yake. Data haiwezi kutoa namba bora zaidi hadi mauzo yaingizwe wakati yanapofanyika.

**Athari kwenye backtest (A 2 / z 0.5, mfuko 1M):**
| Dhana | Siku za stockout (A) | Mauzo yaliyopotea |
|---|---|---|
| Mzigo upo kabla ya mauzo yote | 27 | 1.03M |
| **Asilimia iliyopimwa, kwa siku ya wiki** | **51** | **1.14M** |
| Mara mbili ya iliyopimwa | 52 | 1.24M |
| Iliyopimwa, z 0.75 | 45 | 0.91M |
| Iliyopimwa, mfuko 1.5M | 45 | 0.97M |
| Mzigo unafika baada ya mauzo yote | 136 | 6.28M |

Siku za stockout zinakaribia mara mbili, lakini mauzo yaliyopotea yanaongezeka kwa ~10% tu. Sababu: siku nyingi za ziada ni bidhaa iliyoamka na 0 na kukosa vipande vichache vya asubuhi kabla mzigo haujafika. Hasara halisi ni ndogo; uamuzi wa z 0.5 unabaki sahihi.

---

## 5. Soda (wakala kwa ratiba)

Data ya siku 60: Pepsi ilinunuliwa mara 11 (nafasi ya siku 1–9, mara nyingi Jumanne), Coca mara 8 (nafasi ya siku 3–9). Ratiba halisi haionekani wazi kwenye data.

| Usanidi wa soda | Stockout soda | Stock ya soda | Stockout A |
|---|---|---|---|
| Halisi | 0 | 257,292 | 32 |
| Kila siku, cover 3 (haiwezekani kwa wakala) | 0 | 198,498 | 27 |
| Kila siku 6, cover 7, mfuko 1M | 6 | 261,756 | **37** |
| Kila siku 6, cover 7, mfuko 1.5M | 6 | 261,756 | 24 |
| Kila siku 6, cover 8, mfuko 1.5M | 3 | 320,897 | 25 |
| Kila siku 6, cover 9, mfuko 1.5M | 2 | 378,753 | 25 |

- Soda zikiagizwa kwa mafungu, siku ya wakala oda ni kubwa (250–450k) na inakula mfuko wa 1M; bia zinakatwa na stockout za A zinapanda kutoka 27 hadi 37.
- Mfuko wa 1.5M unaondoa tatizo hilo.
- Kwa soda, `cover_days` = siku za mzunguko wa wakala + 2.

---

## 6. Bidhaa zisizotembea (kwa hesabu ya 03/10)

Stock ya wastani kwa daraja: A 1.41M, B 0.26M, C 2.21M, zisizouzwa wala kununuliwa siku 60: 0.82M.

| Kundi | Bidhaa zenye stock | Thamani kwa bei ya kununua |
|---|---|---|
| Hazikuuzwa wala kununuliwa siku 60 | 21 | 818,632 |
| Daraja C | 50 | 2,694,955 |
| **Jumla** | **71** | **3,513,587** |

| Hatua inayopendekezwa | Kanuni | Bidhaa | Thamani |
|---|---|---|---|
| Rudisha / punguza bei; acha kuagiza | mauzo 0 kwa siku 60 | 26 | 1,193,132 |
| Punguza bei; acha kuagiza | stock inatosha siku > 120 | 8 | 494,151 |
| Acha kuagiza hadi stock ishuke | stock inatosha siku 46–120 | 15 | 815,524 |
| Sawa | stock inatosha siku ≤ 45 | 22 | 1,010,780 |
| **Pesa iliyokwama (hatua tatu za juu)** | | **49** | **2,502,807** |

Kubwa zaidi: JB RARE id 84 (189,000; mauzo ya mwisho 06/07), GORDONS id 57 (140,564; siku 111 za stock), SMIRNOFF VODKA id 78 (112,000), CHROME id 34 (105,000; siku 300), SMIRNOFF ORANGE id 108 (103,125; haijawahi kuuzwa tangu Feb), GREPA WINE id 59 (100,000), TULLYS id 82 (91,300; mauzo ya mwisho 30/03), OLDEN WINE id 106 (85,000). Orodha kamili: `v3_order_backtest_out/slow_movers.csv`.

---

## 7. Mpango wa Awamu 2 (hakuna code hadi uidhinishe)

### 7.1 Backend
| # | Kazi | Maelezo |
|---|---|---|
| B1 | Migration | `order_suggestion` (tarehe, status, bajeti na mchanganuo wake, salio la mfuko, alama za hesabu/recon), `order_suggestion_line` (inputs zote zimehifadhiwa), `product_order_setting` (daraja la kulazimisha, pakiti, cover, mzunguko wa wakala), safu za mipangilio kwenye `business_settings` |
| B2 | `OrderSuggestionCalculator` | class safi isiyogusa DB: velocity, kurekebisha stockout, factors, target, kuzungusha pakiti, kukata kwa bajeti. Unit tests zinatumia namba za backtest hii |
| B3 | `OrderClassifier` | kanuni ya A/B/C ya siku 60; KUPIMA → C; marekebisho ya mmiliki kwa bidhaa |
| B4 | `OrderSuggestionService` | inapakia data, inaita calculator, inahifadhi. Njia mbili: usiku (stock iliyokadiriwa) na asubuhi (hesabu iliyoidhinishwa) |
| B5 | Scheduler | usiku baada ya kufunga; saa inawekwa kwenye mipangilio. Inaheshimu `app.schedulers.enabled` |
| B6 | Hook ya hesabu | hesabu ikiidhinishwa, mistari yenye tofauti inahesabiwa upya |
| B7 | Bajeti | mfuko wenye kikomo; recon SUBMITTED au APPROVED; kama hakuna, namba za mfumo na alama |
| B8 | Endpoints | `GET /api/order-suggestions/today`, `GET /{uid}`, `PUT /{uid}/lines`, `POST /{uid}/approve`, `GET ?from=&to=`, `GET/PUT /api/order-settings` |
| B9 | Notification | "Pendekezo la oda la leo liko tayari" kwa mmiliki |
| B10 | Ripoti ya bidhaa zisizotembea | `GET /api/reports/slow-movers?days=60`: stock ya hesabu ya mwisho, thamani kwa bei ya kununua, siku tangu mauzo ya mwisho, mauzo ya siku 30/60, siku za stock, hatua, jumla ya pesa iliyokwama |
| B11 | Ruhusa | `ORDER_SUGGESTION_VIEW`, `ORDER_SUGGESTION_APPROVE`; ripoti inatumia ruhusa ya ripoti za stock |

### 7.2 V3 (Angular)
| # | Kazi | Maelezo |
|---|---|---|
| F1 | Banner kwenye dashboard | "Pendekezo la oda: kreti N, TZS X" + alama za "recon haijaidhinishwa" / "hesabu bado" |
| F2 | Skrini `/purchases/suggestion` | kadi ya bajeti; jedwali A na B (bidhaa, stock, velocity, factors, target, kreti zinazoweza kubadilishwa, gharama, kipaumbele, sababu); kilichokatwa; orodha ya C ya mkono |
| F3 | Idhinisha + "Shiriki" | maandishi ya orodha kwa WhatsApp (Web Share / nakili) na chapisho; soda kwenye orodha tofauti ya wakala |
| F4 | Historia | kilichopendekezwa, kilichoidhinishwa, kilichonunuliwa kweli |
| F5 | Mipangilio | cover kwa daraja, z, kikomo cha mfuko, mzunguko wa wakala, marekebisho kwa bidhaa |
| F6 | Ripoti `/reports/slow-movers` | jedwali la sehemu 6 na jumla ya pesa iliyokwama |

### 7.3 Mpangilio wa kazi na majaribio
1. B1–B3 pamoja na unit tests. Calculator lazima itoe kreti zilezile za script ya backtest kwa siku 5 za mfano.
2. B4, B7, B8, kisha F2 na F3 (mtiririko wa asubuhi kwanza).
3. B5, B6, B9, F1 (mtiririko wa usiku).
4. B10 na F6 (ripoti).
5. Jaribio kwenye staging kwa E2E kabla ya deploy yoyote; wewe ndiye unayefanya commit na deploy.

Awamu ijayo (si sasa): prefill ya manunuzi kutoka orodha iliyoidhinishwa; kugawa kwa msambazaji.

### 7.4 Mipangilio ya kuanzia
| Kigezo | Thamani |
|---|---|
| Daraja A | cover 2, z 0.5 |
| Soda | cover = mzunguko wa wakala + 2 |
| Factor ya siku ya wiki | ya duka, historia yote |
| Factor ya tarehe | inahesabiwa upya, kilele kinajitafuta, maandalizi siku 3 |
| Mfuko wa bajeti | kikomo 1M (tazama swali la 1) |
| Velocity | siku 14, stockout zinarekebishwa |

---

## 8. Hatari zilizobaki
1. **Muda wa mauzo haujulikani kutoka data** (sehemu 4). Namba ya 4.9% ni kiwango cha chini.
2. **Recon haiwasilishwi usiku.** Bila hilo, bajeti ya usiku ni ya makadirio.
3. **Oda kubwa za jumla** bado ndizo chanzo cha stockout kubwa (SAFARI LAGER 25/08, 27/08, 29/09: mara 3–5 ya velocity).
4. **Soda:** ratiba ya wakala haijulikani, na hesabu yake hailingani.
5. **Stock ya mwisho halisi** ya dirisha hili haikupimwa, kwa sababu dump ilichukuliwa saa 8 usiku kabla ya hesabu ya 04/10.

---

## 9. Maswali kabla ya kuanza code
1. **Kikomo cha mfuko siku ya wakala wa soda:** 1M inakata bia siku hizo (stockout 37 badala ya 27). Nipandishe hadi 1.5M, au oda ya soda isihesabiwe kwenye kikomo?
2. **Wakala wa soda analeta kila siku ngapi, na siku gani?** (Pepsi na Coca tofauti kama zinatofautiana.)
3. **Recon:** utaiwasilisha usiku baada ya kufunga? Kama sivyo, nitumie namba za mfumo zenye alama.
4. **Scheduler ya usiku iendeshwe saa ngapi?** (Duka linafunga saa ngapi, na mauzo ya mwisho yanaingizwa saa ngapi; siku hizi yanaingizwa hadi saa 5:58 usiku.)
5. **Unaidhinisha mpango huu wa Awamu 2?**
