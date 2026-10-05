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
| 4 | Soda: wakala anaitwa; lead time saa chache hadi kesho; hakuna kiwango cha chini | reorder point kwa lead time ya siku 1 (sehemu 5) |
| 5 | KUPIMA → daraja C | A = bidhaa 14, B = soda 2, C = 80 |
| 6 | Daraja A: cover 2, z 0.5 | ndiyo usanidi mkuu |
| 7 | Mzigo saa 7 mchana; mauzo mengi saa 8 mchana hadi 12 jioni. **Imesahihishwa 05/10:** mnaondoka kununua saa 4 asubuhi (10:00), mzigo unafika ~12:00 (saa 6 mchana) | asilimia ya kabla ya saa 7 na ya kabla ya 12:00 zimepimwa kutoka data (sehemu 4); ya 12:00 ndiyo inayotumika sasa |

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

**Toleo la usiku kutoka stock ya mfumo (uamuzi wa mtiririko wa mwisho).** Nimelinganisha pia pendekezo linalotumia stock ya mfumo (ile ambayo hesabu ya asubuhi inalinganishwa nayo) na lile la hesabu halisi:

| Daraja A (siku-bidhaa 756) | Stock ya mfumo dhidi ya hesabu ya asubuhi |
|---|---|
| Kreti zilezile | 730 (97%) |
| Mfumo unapendekeza zaidi / pungufu | 9 / 17 |
| Tofauti ya wastani ya stock | vipande 1.5 kwa bidhaa (kubwa zaidi: CASTLE LITE 6.4) |
| Siku za upungufu kama toleo la usiku lisingesasishwa | 12 (la asubuhi: 11) |

Kwa bia kuu stock ya mfumo sasa iko karibu sana na hesabu, kwa hiyo "toleo la usiku" linaaminika. **Tahadhari moja:** mauzo 100 kati ya 619 (16%) yaliingizwa siku iliyofuata, na mengine hadi saa 5:58 usiku. Saa 00:00 mauzo hayo bado hayamo kwenye stock ya mfumo, kwa hiyo toleo la usiku litaagiza pungufu siku hizo hadi lisasishwe. Kipimo hiki kimetumia stock ya mfumo ya asubuhi (baada ya mauzo hayo kuingizwa), kwa hiyo 97% ni kiwango cha juu.

**Pendekezo la mtiririko (la awali; mtiririko wa mwisho uko sehemu 7.1):**
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

**Kabla ya saa 12:00 (saa 6 mchana), daraja A:**

| Siku | Jtt | Jnn | Jtn | Alh | Ijm | Jms | Jpl | **Zote** |
|---|---|---|---|---|---|---|---|---|
| Vipande vilivyoingizwa kabla ya 12:00 | 37 | 106 | 130 | 166 | 38 | 54 | 107 | **638** |
| Asilimia ya vyenye muda | 1.1% | 3.4% | 4.1% | 4.7% | 0.9% | 1.5% | 2.7% | **2.6%** |

Backtest kwa asilimia hii (A 2 / z 0.5, mfuko 1M): siku za stockout 53, mauzo yaliyopotea 1.08M (bila hiyo: 27 na 1.03M). Hasara ya ziada ni ~5%.

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

## 5. Soda: wakala anaitwa, lead time inabadilika

Umesema wakala huleta mara nyingi ndani ya saa chache, wakati mwingine hadi kesho, na hakuna kiwango cha chini cha oda. Kwa hiyo soda hazifuati ratiba; zinafuata **reorder point**.

### 5.1 Sera tatu zilizolinganishwa
- **(a) Kuita ikiisha:** wakala anapigiwa simu pale rafu inapokuwa tupu.
- **(b) Reorder point kwa lead time ya saa 6:** kila asubuhi, kama stock ≤ mahitaji ya siku 1.25 + akiba, wakala anaitwa.
- **(c) Reorder point kwa lead time ya siku 1:** kila asubuhi, kama stock ≤ mahitaji ya siku 2 + akiba, wakala anaitwa.

```
reorder_point = velocity × factors × (1 + lead_time) + z × σ × √(1 + lead_time)
```
"1 +" ni kwa sababu stock inaangaliwa mara moja kwa siku. Kiasi cha oda = median ya mafungu yaliyonunuliwa nyuma: Pepsi kreti 20 (mafungu 17, kreti 4–30), Coca kreti 15 (mafungu 12, kreti 10–20). Hakuna kiwango cha chini.

Kila sera imejaribiwa kwa lead time halisi ya saa 6 na ya siku 1, kwa sababu hatujui ipi itatokea.

### 5.2 Matokeo (siku 60, Pepsi + Coca)
| Sera | Lead time halisi | Siku za stockout | Mauzo yaliyopotea | Stock ya wastani asubuhi |
|---|---|---|---|---|
| **Halisi (kilichotokea kweli)** | – | **0** | – | **257,292** |
| (a) Kuita ikiisha | saa 6 | 21 | 215,703 | 203,235 |
| (a) Kuita ikiisha | siku 1 | 28 | 798,787 | 214,567 |
| (b) Reorder point ya saa 6, z 0.5 | saa 6 | 4 | 33,098 | 285,492 |
| (b) Reorder point ya saa 6, z 0.5 | siku 1 | 14 | 465,410 | 279,678 |
| (b) Reorder point ya saa 6, z 1 | saa 6 | 3 | 21,614 | 305,576 |
| (b) Reorder point ya saa 6, z 1 | siku 1 | 6 | 195,111 | 318,851 |
| **(c) Reorder point ya siku 1, z 0.5** | saa 6 | **1** | **584** | **319,074** |
| **(c) Reorder point ya siku 1, z 0.5** | siku 1 | **5** | **99,658** | **335,998** |
| (c) Reorder point ya siku 1, z 1 | saa 6 | 1 | 584 | 355,767 |
| (c) Reorder point ya siku 1, z 1 | siku 1 | 3 | 99,658 | 355,864 |

Kwa bidhaa (sera (c), z 0.5): Pepsi stockout 1–2 na stock ya vipande 347–376 (halisi 280); Coca stockout 0–3 na stock 251–254 (halisi 202). Oda ni 10 za Pepsi na 7 za Coca kwa siku 60, karibu sawa na halisi (11 na 8).

### 5.3 Maana yake
- **"Kuita ikiisha" kwa maana halisi ni mbaya:** stockout 21–28 na mauzo ya 0.2–0.8M yanapotea. Lakini data inaonyesha duka halifanyi hivyo kihalisia: kwa hesabu, soda hazijawahi kufungwa na 0 ndani ya siku 60, na stock ya wastani ni siku 3.5–4.3 za mauzo. Yaani mnunuzi tayari anaita mapema.
- **Sera (c) ndiyo salama:** wakala akichelewa hadi kesho, stockout ni 5 badala ya 14 za sera (b). Gharama yake ni stock ya ~320–336k, yaani **~60–80k zaidi ya leo**.
- **Reorder point haipunguzi stock ya soda**; inaifanya kanuni iwe wazi badala ya kutegemea kumbukumbu ya mtu.
- **Tahadhari:** hesabu ya soda hailingani (89% na 169% ya mauzo), kwa hiyo "stockout 0" za halisi zinaweza kuwa si kweli kabisa, na simulation inagawa mauzo ya siku sawasawa kwa saa zote.

**Pendekezo:** soda zitumie sera (c), z 0.5, kama ulivyoelekeza. Kwenye orodha zinaonekana kama mstari wa "Mwite wakala leo: Pepsi kreti 20" pale tu stock inaposhuka chini ya reorder point, na hazihesabiwi kwenye kikomo cha mfuko wa 1M (zinaonyeshwa kando na gharama yake).

### 5.4 Pendekezo (halijajengwa): kitufe "Nimemwita wakala"
- Kwenye mstari wa soda wa orodha: kitufe **"Nimemwita wakala"** kinarekodi bidhaa, muda wa simu, kreti zilizoombwa na aliyepiga.
- Manunuzi ya soda yakipokelewa, mfumo unayaunganisha na simu ya mwisho iliyo wazi na kuhesabu **lead time halisi** = muda wa kupokea − muda wa simu.
- Baada ya simu ~10, `lead_time` ya reorder point inatoka kwenye data (mfano asilimia ya 80 ya lead time zilizopimwa) badala ya siku 1 ya kukisia. Ripoti ndogo: lead time ya wastani, ndefu zaidi, na mara ngapi alifika kesho yake.
- Table mpya: `agent_call_log` (bidhaa, msambazaji, `called_at`, kreti, `purchase_uid`, `received_at`).
- Sharti: muda wa kupokea manunuzi uingizwe wakati mzigo unapofika, si usiku.

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

Mpangilio wa kujenga: **(a) ripoti ya bidhaa zisizotembea → (b) oda ya daraja A → (c) onyo la soda.**

### 7.1 Mtiririko wa mwisho wa oda (kama ulivyoamua)
| # | Tukio | Kinachotokea | Alama kwenye skrini |
|---|---|---|---|
| 1 | Saa 00:00, mauzo ya siku yamefungwa | Oda ya kesho inatengenezwa kimya: stock ya mfumo, bajeti ya makadirio (namba za mfumo za siku hiyo) | "Toleo la usiku" |
| 1b | Sale lenye tarehe ya jana linahifadhiwa (mauzo ya jana yanayoingizwa asubuhi) | Oda inajisasisha kwa stock ya mfumo ya wakati huo. Hakuna toleo la saa maalum | "Imesasishwa saa HH:MM baada ya mauzo ya jana" |
| 2 | Counting ya asubuhi inakamilika | Mistari inahesabiwa upya kwa stock iliyohesabiwa | "Imesasishwa saa HH:MM baada ya counting" |
| 3 | Recon inawasilishwa (hata kabla ya kuidhinishwa) | Bajeti inasasishwa; kilichokatwa kinahesabiwa upya | "Bajeti: recon imewasilishwa" (au "haijaidhinishwa") |
| 4 | Macheda anahariri kiasi (wakati wowote) | Mstari huo unafungwa dhidi ya masasisho ya kiotomatiki. Hesabu mpya ikitofautiana, inaonyeshwa pembeni tu | "mfumo sasa: X" |
| 5 | "Imenunuliwa" | Oda inafungwa; hakuna masasisho zaidi | "Imefungwa saa HH:MM" |
| 6 | Kosa lolote la oda | Halizuii counting, recon wala approvals | Banner "Oda haikusasishwa — Hesabu upya" |
| 7 | Kila hatua | Matoleo manne yanahifadhiwa kimya kwa kila bidhaa: la usiku, la mwisho la mfumo, la Macheda, kilichonunuliwa | hayaonekani; ni kwa ripoti ya baadaye |

Kanuni za utekelezaji zinazotokana na mtiririko huu:
- **Oda moja kwa siku** (`order_date` ya kipekee). Hali: `NIGHT` → `UPDATED` → `PURCHASED`. Hakuna hatua ya "approve"; kuhariri na "Imenunuliwa" ndizo hatua za mmiliki.
- **Masasisho hayazuii chochote.** Yanaendeshwa BAADA ya commit ya counting/recon (`@TransactionalEventListener(AFTER_COMMIT)`, transaction mpya, `try/catch` inayoandika `last_error`). Counting au recon haiwezi kushindwa kwa sababu ya oda.
- **Usawa wa masasisho:** kila sasisho linaandika upya mistari isiyohaririwa tu; mistari iliyohaririwa inasasishwa safu ya `system_packs` pekee. Oda ya `PURCHASED` haiguswi.
- **"Hesabu upya"** ni kitufe kinachoendesha sasisho lilelile kwa mkono; kinafuta `last_error` kikifanikiwa.
- **Bajeti ya makadirio ya usiku** = mauzo ya siku − madeni yaliyoingizwa − gharama zilizoingizwa − gharama za mwezi kwa siku + salio la mfuko (kikomo 1M). Recon ikiwasilishwa, namba zake zinachukua nafasi.
- **Mauzo ya jana yanayoingizwa asubuhi** (16% ya mauzo, yote kati ya 07:37 na 10:31; `v3_late_sales_report.md`): kila sale lenye `sale_date` ya jana linapohifadhiwa, oda ya leo inasasishwa baada ya commit (transaction mpya, `try/catch` → `last_error`), kama masasisho ya counting na recon. Kuhifadhi sale hakuwezi kushindwa kwa sababu ya oda. Mauzo kadhaa yakiingizwa mfululizo, sasisho la mwisho ndilo linalobaki (ni hesabu ileile kutoka stock ya mfumo). Sale la jana likifutwa au kuhaririwa, sasisho lilelile linaendeshwa.
- **Ratiba ya asubuhi (uamuzi wa 05/10):** mnaondoka kununua **10:00**, mzigo unafika **~12:00**. Oda inapaswa kuwa ya mwisho kufikia 10:00. Counting ilikamilika kabla ya 10:00 siku 30 tu kati ya 60 (`v3_count_vs_late_sales_report.md`), kwa hiyo siku nyingine Macheda anaondoka na toleo la stock ya mfumo; skrini ionyeshe wazi chanzo cha stock cha kila mstari.
- **Kanuni ya duka (si code):** mauzo ya jana yaingizwe **KABLA** ya counting ya asubuhi. Snapshot ya stock ya mfumo inachukuliwa counting inapoanza; sale la jana likiingizwa baadaye, mstari unaonyesha upungufu wa uongo, na ukipostiwa stock inakatwa mara mbili. Duka tayari linafanya hivi (siku 35 kati ya 35; ukiukaji mmoja tu tangu Julai). Mpangilio: ingiza mauzo ya jana → counting → oda inajisasisha → ondoka 10:00.
- **"Imenunuliwa"** inarekodi kreti halisi kwa kila mstari (zinaanza na kiasi cha Macheda; anaweza kubadilisha). Haitengenezi rekodi ya manunuzi; prefill ni awamu ijayo.

### 7.2 Data inayohifadhiwa
| Table | Safu muhimu |
|---|---|
| `order_suggestion` | `order_date` (unique), `status`, `night_generated_at`, `count_updated_at`, `budget_updated_at`, `purchased_at`, `budget_amount`, `budget_source` (ESTIMATE / RECON_SUBMITTED / RECON_APPROVED), `pool_carry`, `last_error`, `last_error_at` |
| `order_suggestion_line` | bidhaa, daraja, pakiti, gharama; **`night_packs`**, **`system_packs`**, **`user_packs`** (NULL kama haijahaririwa), **`purchased_packs`**; `edited_at`, `edited_by`; inputs za hesabu ya mwisho (stock, chanzo cha stock, velocity, factors, target, akiba, kilichokatwa, sababu) |
| `product_order_setting` | daraja la kulazimisha, pakiti, cover, lead time |
| `business_settings` (safu mpya) | cover A, z, kikomo cha mfuko, saa ya kazi ya usiku |

Matoleo manne ya kila bidhaa ndiyo msingi wa kupima baadaye: mfumo ulikuwa sahihi kiasi gani, na Macheda hubadilisha nini.

### 7.3 Hatua (a): ripoti ya "Bidhaa zisizotembea"
Inajengwa kwanza kwa sababu haitegemei chochote cha oda na inaonyesha pesa iliyokwama mara moja.

| # | Kazi | Maelezo |
|---|---|---|
| A1 | `GET /api/reports/slow-movers?days=60` | Kwa kila bidhaa ya daraja C au isiyouzwa wala kununuliwa kwa siku 60: stock ya hesabu ya mwisho iliyoidhinishwa, thamani kwa bei ya kununua, tarehe na siku tangu mauzo ya mwisho, mauzo ya siku 30 na 60, siku za stock, hatua inayopendekezwa. Juu: jumla ya pesa iliyokwama |
| A2 | Kanuni ya hatua | mauzo 0 kwa siku 60 → "rudisha / punguza bei; acha kuagiza"; stock ya siku > 120 → "punguza bei; acha kuagiza"; siku 46–120 → "acha kuagiza hadi stock ishuke"; vinginevyo "sawa" |
| A3 | V3 `/reports/slow-movers` | jedwali linalopangwa kwa thamani, kichujio kwa hatua, jumla juu, kupakua CSV |
| A4 | Jaribio | namba zilingane na `v3_order_backtest_out/slow_movers.csv` kwenye dump ileile |

Orodha ya leo (hesabu ya 03/10): bidhaa 71 zenye stock ya **3,513,587**; pesa iliyokwama **2,502,807** kwenye bidhaa 49. Kumi kubwa zaidi kati ya zilizokwama:

| id | Bidhaa | Stock | Thamani | Mauzo ya mwisho | Mauzo siku 30 / 60 | Hatua |
|---|---|---|---|---|---|---|
| 84 | JB RARE | 6 | 189,000 | 06/07 (siku 89) | 0 / 0 | rudisha / punguza bei |
| 57 | GORDONS | 13 | 140,564 | 24/09 | 4 / 7 | acha kuagiza (siku 111 za stock) |
| 78 | SMIRNOFF VODKA | 12 | 112,000 | 04/08 (siku 60) | 0 / 0 | rudisha / punguza bei |
| 42 | BLACK AND WHITE 200ML | 13 | 107,523 | 01/10 | 7 / 15 | acha kuagiza (siku 52) |
| 17 | CAPTAIN MOGRAN 200ML | 26 | 105,083 | 30/09 | 19 / 31 | acha kuagiza (siku 50) |
| 34 | CHROME | 10 | 105,000 | 11/09 | 2 / 2 | punguza bei (siku 300) |
| 108 | SMIRNOFF ORANGE | 25 | 103,125 | haijauzwa tangu Feb | 0 / 0 | rudisha / punguza bei |
| 59 | GREPA WINE | 4 | 100,000 | 30/09 | 1 / 1 | punguza bei (siku 240) |
| 82 | TULLYS | 11 | 91,300 | 30/03 (siku 187) | 0 / 0 | rudisha / punguza bei |
| 106 | OLDEN WINE | 10 | 85,000 | 27/05 (siku 129) | 0 / 0 | rudisha / punguza bei |

Orodha kamili ya bidhaa 71: `v3_order_backtest_out/slow_movers.csv`.

### 7.4 Hatua (b): oda ya daraja A
| # | Kazi | Maelezo |
|---|---|---|
| B1 | Migration | tables za sehemu 7.2 |
| B2 | `OrderSuggestionCalculator` | class safi isiyogusa DB: velocity ya siku 14 yenye stockout zilizorekebishwa, factors, target (cover 2, z 0.5), kuzungusha pakiti, kukata kwa bajeti (velocity kwanza, faida ikivunja sare). Unit tests kwa namba za backtest |
| B3 | `OrderClassifier` | kanuni ya A/B/C ya siku 60; KUPIMA → C; marekebisho ya mmiliki |
| B4 | Kazi ya 00:00 | hatua 1 ya mtiririko. Inaheshimu `app.schedulers.enabled`; kama oda ya siku hiyo ipo tayari, haifanyi kitu |
| B4b | Sasisho baada ya sale la jana | hatua 1b: sale lenye `sale_date` ya jana likihifadhiwa, kuhaririwa au kufutwa; baada ya commit, haizuii. Jaribio: "sale linahifadhiwa hata oda ikishindwa" |
| B5 | Sasisho baada ya counting | hatua 2; baada ya commit, haizuii |
| B6 | Sasisho baada ya recon kuwasilishwa | hatua 3; baada ya commit, haizuii |
| B7 | Kuhariri na kufunga | `PUT /api/order-suggestions/{uid}/lines/{lineUid}` (inaweka `user_packs`), `POST /{uid}/purchased`, `POST /{uid}/recalculate` |
| B8 | Kusoma | `GET /api/order-suggestions/today`, `GET /{uid}`, `GET ?from=&to=` |
| B9 | Notification | "Oda ya leo iko tayari" asubuhi; haitumwi tena kwa kila sasisho |
| B10 | Ruhusa | `ORDER_SUGGESTION_VIEW`, `ORDER_SUGGESTION_EDIT` |
| F1 | Banner ya dashboard | kreti na jumla; alama ya toleo; banner ya kosa yenye "Hesabu upya" |
| F2 | Skrini `/purchases/suggestion` | kadi ya bajeti na chanzo chake; jedwali A (bidhaa, stock na chanzo chake, velocity, factors, target, kreti zinazoweza kuhaririwa, "mfumo sasa: X" kwa mistari iliyohaririwa, gharama, kipaumbele, sababu); kilichokatwa; orodha ya C ya mkono |
| F3 | "Shiriki" na "Imenunuliwa" | maandishi ya orodha kwa WhatsApp / chapisho; kufunga oda kwa kreti halisi |
| F4 | Historia | matoleo manne kwa kila bidhaa, siku kwa siku |

### 7.5 Hatua (c): onyo la soda
| # | Kazi | Maelezo |
|---|---|---|
| C1 | Reorder point ya daraja B | kanuni ya sehemu 5: lead time siku 1, z 0.5; kiasi = median ya mafungu ya nyuma. Inahesabiwa kwenye masasisho yaleyale ya oda |
| C2 | Mstari wa onyo | "Mwite wakala leo: Pepsi kreti 20" pamoja na alama "data si ya kuaminika"; nje ya kikomo cha mfuko, gharama inaonyeshwa kando |
| C3 | (Pendekezo, sehemu 5.4) | kitufe "Nimemwita wakala" na `agent_call_log`; kinasubiri uamuzi wako |

### 7.6 Majaribio na mpangilio
1. Kila hatua (a, b, c) inaisha na jaribio la E2E kwenye staging kabla ya inayofuata.
2. Kwa (b): calculator itoe kreti zilezile za script ya backtest kwa siku 5 za mfano; jaribio la "counting inafanikiwa hata oda ikishindwa"; jaribio la "mstari uliohaririwa haubadiliki".
3. Wewe ndiye unayefanya commit na deploy.

Awamu ijayo (si sasa): prefill ya manunuzi kutoka "Imenunuliwa"; kugawa kwa msambazaji; ripoti ya usahihi wa mfumo kutoka matoleo manne.

### 7.7 Mipangilio ya kuanzia
| Kigezo | Thamani |
|---|---|
| Daraja A | cover 2, z 0.5 |
| Soda | reorder point: lead time siku 1, z 0.5; kiasi = median ya mafungu ya nyuma |
| Factor ya siku ya wiki | ya duka, historia yote |
| Factor ya tarehe | inahesabiwa upya, kilele kinajitafuta, maandalizi siku 3 |
| Mfuko wa bajeti | kikomo 1M |
| Velocity | siku 14, stockout zinarekebishwa |
| Kazi ya usiku | 00:00 |

---

## 8. Hatari zilizobaki
1. **Muda wa mauzo haujulikani kutoka data** (sehemu 4). Namba ya 4.9% ni kiwango cha chini.
2. **Recon haiwasilishwi usiku.** Bila hilo, bajeti ya usiku ni ya makadirio.
3. **Oda kubwa za jumla** bado ndizo chanzo cha stockout kubwa (SAFARI LAGER 25/08, 27/08, 29/09: mara 3–5 ya velocity).
4. **Soda:** lead time ya wakala ni ya kukisia hadi kitufe cha "Nimemwita wakala" kianze kutoa data; hesabu yake hailingani.
5. **Stock ya mwisho halisi** ya dirisha hili haikupimwa, kwa sababu dump ilichukuliwa saa 8 usiku kabla ya hesabu ya 04/10.

---

## 10. Majibu ya 2026-10-05 na hali ya hatua (a)

**Sehemu ya 7 imeidhinishwa.** Majibu ya maswali ya sehemu 9:

| # | Swali | Uamuzi |
|---|---|---|
| 1 | Soda na mfuko wa 1M | Soda **nje** ya kikomo cha 1M; skrini inaonyesha jumla (bia + soda) pamoja na onyo |
| 2 | Kitufe "Nimemwita wakala" | **Awamu ijayo** (si hatua c) |
| 3 | Mauzo yanayoingizwa baada ya 00:00 | ~~Toleo la pili saa 06:00~~ → **oda inajisasisha kila sale lenye tarehe ya jana linapohifadhiwa** (uamuzi wa pili wa 05/10, baada ya `v3_late_sales_report.md` kuonyesha kwamba saa 06:00 hakuna sale lililokwisha ingizwa); counting na recon zinaendelea kusasisha kama ilivyopangwa |
| 4 | Kuanza hatua (a) | Ndiyo |

**Marekebisho ya 05/10 (yameingizwa kwenye 7.1 na 7.4):**
- Hatua 1b ya mtiririko na kazi B4b: sasisho pale sale la jana linapohifadhiwa.
- Ratiba: kuondoka kununua 10:00, mzigo ~12:00 (si saa 7 mchana). Kwa backtest, asilimia ya mauzo kabla ya mzigo ni ile ya kabla ya 12:00: 2.6% ya vipande vya daraja A (kiwango cha chini), yaani stockout 53 na mauzo yaliyopotea 1.08M badala ya 51 na 1.14M za saa 7 mchana (sehemu 4). Uamuzi wa z 0.5 haubadiliki.
- Kanuni ya duka: mauzo ya jana yaingizwe kabla ya counting ya asubuhi (maelezo 7.1; vipimo `v3_count_vs_late_sales_report.md`).

**Hatua (a) imejengwa (haijacommitiwa, haijadeploy):**
- Backend: `GET /api/reports/slow-movers?asOf=` (ruhusa `STOCK_REPORT`, kusoma tu, bila migration). `SlowMoverCalculator` ni class safi; `SlowMoversService` inasoma rows tu. Unit tests 14 (`SlowMoverCalculatorTest`).
- V3: `/reports/slow-movers` (kadi mpya kwenye Ripoti): pesa iliyokwama juu, vigae vya hatua, jedwali linalopangwa, kichujio kwa hatua, CSV na kuchapisha.
- A4 imepita kwenye dump ileile: bidhaa 71, thamani 3,513,587, pesa iliyokwama 2,502,807 kwenye bidhaa 49; kila bidhaa inalingana na `slow_movers.csv` (idadi, thamani, mauzo 30/60, siku tangu mauzo ya mwisho, hatua).
- Tofauti moja na A1 ya mpango: `?days=` haipo (dirisha ni siku 60 daima, kwa sababu safu za 30/60 na kanuni ya daraja zinalitegemea); badala yake kuna `?asOf=` kwa majaribio.
- Bado: staging, kisha idhini yako kabla ya prod.

---

## 11. Hatua (b) imejengwa LOCAL (2026-10-05) — haijacommitiwa, haiko staging

**Backend** (package `com.Lsms.OrderSuggestion`, migration `V125__Order_Suggestion.sql`):

| Mpango | Kilichojengwa |
|---|---|
| B1 | Tables `order_suggestion`, `order_suggestion_line`, `product_order_setting`, na `order_setting` (mipangilio ya formula iko kwenye table yake, si `business_settings`) |
| B2 | `OrderSuggestionCalculator` + `SeasonFactors` (safi, bila DB): velocity ya siku 14 yenye stockout zilizorekebishwa, factors, target (cover 2, z 0.5), kreti, kukata kwa bajeti, mfuko (cap 1M) |
| B3 | `OrderClassifier` (A/B/C/NONE, kanuni ileile ya ripoti ya bidhaa zisizotembea) + marekebisho ya mmiliki kutoka `product_order_setting` (table tu; skrini yake bado) |
| B4 | Kazi ya 00:00 (`OrderSuggestionScheduler`, inaheshimu `app.schedulers.enabled`); haifanyi kitu kama oda ya siku ipo |
| B4b, B5, B6 | `OrderSuggestionTrigger`: sale la tarehe ya jana, counting kukamilika/kuidhinishwa, recon kuwasilishwa/kuidhinishwa. Baada ya commit, thread yake, kosa linaandikwa `last_error` tu |
| B7 | `PUT /api/order-suggestions/{uid}/lines/{lineUid}`, `POST /{uid}/purchased`, `POST /today/recalculate` (si `/{uid}/recalculate`: inafanya kazi hata oda ikiwa haipo) |
| B8 | `GET /today`, `GET /{uid}`, `GET ?from=&to=` (siku 62) |
| B9 | Arifa "Oda ya leo iko tayari" mara moja kwa oda (wenye `ORDER_SUGGESTION_VIEW`; kama hakuna, `PURCHASE_READ`) |
| B10 | `ORDER_SUGGESTION_VIEW`, `ORDER_SUGGESTION_EDIT` (zinaingizwa bila kupewa role yoyote; ROOT anaona zote) |

**V3** (`features/order-suggestion`): F1 banner ya dashboard (kreti, jumla, toleo; kosa + "Hesabu upya"); F2 `/purchases/suggestion` (hali ya mtiririko, kadi ya bajeti na chanzo chake, jedwali la kreti zinazohaririwa na "mfumo sasa: X", kilichokatwa); F3 "Shiriki", "Chapisha", "Imenunuliwa"; F4 "Historia" (matoleo manne kwa kila bidhaa). **Haijajengwa:** orodha ya C ya mkono (F2) na skrini ya `product_order_setting`.

**Majaribio (yote kwenye PC):**
- Unit tests 70 mpya (build nzima 273, hakuna iliyoshindwa). `OrderSuggestionBacktestFixtureTest`: siku 5 halisi (12/08, 22/08, 04/09, 23/09, 03/10) × bidhaa 14: factors, velocity, target na **kreti zilezile za script**; kreti zilezile baada ya kukata bajeti; daraja zilezile kwa bidhaa 119.
- Data halisi kupitia SQL ya moja kwa moja (dump ya 04/10, oda ya 03/10): bidhaa 14 zilezile, kreti zilezile, gharama 1,903,597.84, sawa na script.
- Mtiririko kupitia API halisi 39/39: toleo la usiku; kuhariri; sale la jana → oda inajisasisha (stock 78 → 72); sale la leo halibadilishi; counting → oda inajisasisha kwa stock iliyohesabiwa; "Hesabu upya"; "Imenunuliwa"; oda iliyofungwa haibadiliki; matoleo manne.
- Skrini kwenye browser 33/33 (Kiswahili, Kiingereza, simu).
- `OrderSuggestionTriggerTest`: counting/sale/recon zinafanikiwa hata oda ikishindwa; hakuna kinachoendeshwa kabla ya commit wala baada ya rollback. Njia ya recon imepimwa kwa unit tests tu (si kupitia API).

**Mambo yanayohitaji uamuzi wako:**
1. **Factor ya siku ya wiki.** Sehemu 7.7 inasema "historia yote", lakini namba zilizoidhinishwa (stockout 27) zilitumia wiki 8 za mwisho. Kwa historia yote: stockout 29, mauzo yaliyopotea 1.09M (badala ya 27 na 1.03M). Nimeweka wiki 8 (`order_setting.dow_mode = RECENT`); inabadilishwa kwa mpangilio mmoja.
2. **Mfuko wa siku ya kwanza ni 0.** Oda ya kwanza haina salio la jana, kwa hiyo bajeti inakata sana (mfano wa 03/10: 592,498 kati ya 1,903,598). Chaguo: kuanza na salio la mwanzo (mfano 1M), au kukubali siku ya kwanza.
3. **Nani apewe ruhusa mbili mpya** (Macheda na nani mwingine).
4. **Stock ya toleo la usiku** = stock ya mfumo ya 00:00 ukiondoa mauzo ya siku za nyuma yaliyoingizwa tangu hapo. Bajeti ya makadirio = mauzo ya jana ya rejista − madeni − gharama zilizoingizwa − gharama za mwezi kwa siku + salio la mfuko.

**Kasoro iliyopo nje ya oda (haijarekebishwa):** tangu 03/10 namba za risiti ni `031026-2358` badala ya `RCP-…`. `DailyPnlService.stockValueAt` (ripoti ya faida ya kila siku) inatambua `RCP-…` tu, kwa hiyo mauzo ya tarehe ya nyuma yenye namba mpya hayahamishwi kwenye siku yake katika thamani ya stock. Code ya oda inakubali miundo yote miwili.

---

## 9. Maswali kabla ya kuanza code
1. **Soda na mfuko wa 1M:** napendekeza onyo la soda lisihesabiwe kwenye kikomo (oda yake ni ~190–260k na ingekata bia siku hiyo). Unakubali?
2. **Kitufe "Nimemwita wakala"** (sehemu 5.4): kiingie hatua (c) au awamu ijayo?
3. **Mauzo yanayoingizwa baada ya 00:00:** toleo la usiku litayakosa hadi counting. Inatosha, au kazi ya usiku iendeshwe baadaye (mfano saa 00:30) au irudiwe mauzo ya jana yakiingizwa?
4. **Unaidhinisha sehemu ya 7, nianze na hatua (a)?**
