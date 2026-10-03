# Madeni ya wateja: namba zimesahihishwa (kabla / sasa)

**Tarehe:** 2026-10-03.

**Chanzo:** backup ileile ya ripoti ya kwanza, `backups/prod_Lsms_20260930_1026_before_gl.dump`.
- Ilirejeshwa kwenye container ya muda, na ilisomwa tu (read-only).
- Queries: `analysis/v3_debt_recount_queries.sql` (R1–R5).

**Kinachosahihishwa:** sehemu ya Q1 (madeni) ya `v3_ordering_findings.md`.

## Kwa nini namba zimebadilika

Ripoti ya kwanza ilipima "kinachodaiwa sasa" kwa `SUM(payments.outstanding_balance)`. **Hiyo si salio.**
- Mteja akilipa deni baadaye, mfumo unaongeza safu **mpya** ya payment (PAID, salio 0).
- Safu ya awali ya UNPAID (salio kamili) inabaki kama ilivyokuwa.
- Kwa hiyo madeni yaliyolipwa yalihesabiwa kama bado yanadaiwa. Sales 11 ziliathirika, kwa jumla ya **+345,500**.

Kipimo sahihi ni **`sales.outstanding_balance`**:
- Kwa sales zote 416 zenye deni, ni sawa kabisa na `jumla − malipo yote (amount_paid) − marekebisho yaliyoidhinishwa`.
- Ndicho `/api/reports/ar` (`v_accounts_receivable`) na GL zinatumia.
- Jumla hapa = ripoti ya AR = **1,646,000** ✔.

Ripoti ya kwanza ilionyesha tofauti hii yenyewe (kasoro 6: "1.65M ≠ 1.99M"), lakini ikachagua upande usio sahihi.

Mabadiliko mengine madogo:
- Sales 2 za mkopo za Mei 2026 (**36,000**) zimeongezwa. Zilikuwa hazionekani kwa sababu zilitangulia rekodi za madeni kwenye recon, lakini ripoti ya AR inazihesabu. Zote ziko kundi la 60+.
- Ledger ya tarehe (lini deni lilitolewa, lini lililipwa) haijabadilika: ni ileile ya Q1, na sasa ndiyo inayotumika kwenye `DailyPnlCalculator` ya backend.

## Jedwali kuu: kabla / sasa

| Kipimo | Kabla (ripoti ya 30/09) | **Sasa** | Tofauti |
|---|---|---|---|
| Madeni yote yaliyo wazi (30/09) | 1,902,500 | **1,646,000** | −256,500 |
| …ya walk-in | 1,749,500 | **1,455,500** | −294,000 |
| …ya POS | 153,000 | **190,500** | +37,500 ¹ |
| **Sehemu ya walk-in** | 92% | **88.4%** | |
| Idadi ya madeni yaliyo wazi | 111 | **107** | −4 |
| **Ongezeko la madeni ya walk-in, siku 90** (02/07–29/09) | +1,380,000 (~15.3k kwa siku) | **+1,089,500 (~12.1k kwa siku)** | −290,500 |
| …walk-in yaliyotolewa | 4,659,000 | **4,659,000** | 0 |
| …walk-in yaliyolipwa | 3,170,000 | **3,466,500** | +296,500 |
| …walk-in yaliyorekebishwa (bila pesa) | 100,000 | **103,000** | +3,000 ² |
| Mabadiliko ya POS, siku 90 | −141,000 | **−140,000** | |
| Ongezeko la madeni yote, siku 90 | +1,242,000 | **+949,500** | −292,500 |
| Thamani ya walk-in iliyokwisha kumalizwa (kulipwa au kurekebishwa) | 64% | **71.7%** | |
| Madeni ni sawa na % ya stock (5.65M) | ~34% | **~29%** | |

¹ Inajumuisha sales 2 za Mei (36,000) na POS moja ambayo payment row ilionyesha imelipwa, lakini sale bado inadaiwa 1,500.
² Deni la 3,000 lililofutwa kwa CORRECTION (Agosti) sasa linaonekana kama marekebisho.

### Madeni mwishoni mwa mwezi (1c)
| Tarehe | Jumla: kabla | **Jumla: sasa** | POS: sasa | Walk-in: sasa |
|---|---|---|---|---|
| 30/06/2026 | 1,629,500 | **1,665,500** | 1,239,000 | 426,500 |
| 01/07/2026 (mwanzo wa siku 90) | ~660,000 | **696,500** | 330,500 | 366,000 |
| 31/07/2026 | 1,644,500 | **1,684,000** | 436,500 | 1,247,500 |
| 31/08/2026 | 1,632,500 | **1,672,000** | 251,500 | 1,420,500 |
| 30/09/2026 | 1,902,500 | **1,646,000** | 190,500 | 1,455,500 |

**Hitimisho limebadilika.** Ripoti ya kwanza ilisema madeni yalikaa ~1.63M kwa miezi 3, kisha Septemba yakaruka +270k.

Kwa kipimo sahihi, **madeni yote yamekaa ~1.65–1.68M tangu Julai, na Septemba yalishuka kidogo (−26k).** Ndani yake muundo umebadilika:
- POS imeshuka kutoka 437k hadi 191k.
- Walk-in imepanda kutoka 1.25M hadi 1.46M.

Kwa maneno mengine, walk-in bado inakua, ila kwa ~+70k kwa mwezi, si +330k.

### Umri wa madeni yaliyo wazi, tarehe 30/09 (1d)
Umri = siku kutoka tarehe deni lilipotolewa hadi 30/09.

| Umri (siku) | Idadi: kabla | Kiasi: kabla | **Idadi: sasa** | **Kiasi: sasa** | **% ya jumla** | kati yake POS |
|---|---|---|---|---|---|---|
| 0–7 | 17 | 314,500 | **15** | **255,500** | 15.5% | 0 |
| 8–30 | 15 | 547,000 | **12** | **365,000** | 22.2% | 0 |
| 31–60 | 26 | 374,500 | **26** | **374,500** | 22.8% | 2 (42,500) |
| **60+** | 53 | 666,500 | **54** | **651,000** | **39.6%** | 7 (148,000) ³ |
| **Jumla** | 111 | 1,902,500 | **107** | **1,646,000** | 100% | 9 (190,500) |

³ Kati ya hizo, 36,000 ni zile sales 2 za Mei.

- Madeni yaliyolipwa ambayo yalihesabiwa vibaya yalikuwa mengi ya hivi karibuni (yalilipwa 24–29/09). Kwa hiyo kundi la 0–30 limeshuka sana (−241,000).
- **Sehemu ya madeni ya siku 60+ sasa ni 39.6% (ilikuwa 35%).** Tatizo la madeni ya zamani ni kubwa kuliko ilivyoonekana.

### Wadaiwa 10 wakubwa sasa (1e, customer ID tu)
| # | customer_id | Madeni wazi | Kiasi | Deni kongwe (siku) | Aina |
|---|---|---|---|---|---|
| 1 | ee226d4e-4b67-4476-8be8-e11d98b84abc | 1 | 85,000 | 17 | walk-in |
| 2 | 73c60f46-7b36-430f-88b9-b94a59a3b6c9 | 6 | 63,500 | 66 | walk-in |
| 3 | 81cadd4f-aeec-424d-a619-8cad2013043d | 3 | 63,000 | 83 | walk-in |
| 4 | 4389cd82-941c-4d45-b34f-05be4e571d7f | 2 | 63,000 | 5 | walk-in |
| 5 | 842ffac3-fcea-485f-b649-35106db05958 | 3 | 52,500 | 79 | walk-in |
| 6 | 2aa6a53d-7c5f-46b0-81bf-4fa53a543eaa | 2 | 51,500 | 79 | POS + walk-in |
| 7 | 644d36e7-464f-419b-8bc0-4c0acfaac107 | 2 | 51,000 | 76 | POS + walk-in |
| 8 | 3a0c8fea-0af7-40dc-9d31-ef2cdabbf3c6 | 1 | 50,000 | 9 | walk-in |
| 9 | ddd7d7d8-38e2-4a0e-a9c8-320f65d30fde | 3 | 44,000 | 21 | walk-in |
| 10 | 8b0ad5e5-dddb-4ba3-a2f2-a9e92c89187a | 1 | 41,000 | 6 | walk-in |

- Wa kwanza wa ripoti ya awali (a22a5773…, 120,000) **hayumo tena**: madeni yake yalikuwa yamelipwa.
- Wadaiwa 10 wakubwa sasa wanadaiwa **564,500 (~34%)**, si 756,500 (~40%).

## Kwa credit limit (msingi wa kujenga)
- **Kiasi kilicho hatarini ni 1.65M, na 88% yake ni walk-in.**
- **40% ya kiasi hicho (651k) ni madeni ya siku 60+.** Kikomo kinapaswa kuangalia **umri** wa deni la zamani zaidi la mteja, si kiasi tu.
- Deni kubwa la mteja mmoja ni 85,000. Wadaiwa 10 wakubwa wako kati ya 41k na 85k.
- Walk-in inaongezeka kwa ~12k kwa siku kwa wastani wa siku 90. Kwa Agosti hadi Septemba ni ~70k kwa mwezi.

## Kisichobadilika kwenye ripoti ya kwanza
- Q1f (muda hadi kulipwa) na Q2 (nani anatoa mkopo) hazikutegemea salio, kwa hiyo hazibadiliki kwa kiasi kikubwa. Isipokuwa: madeni 7 ya walk-in yaliyolipwa 24–29/09 sasa yanahesabika kama "yamelipwa".
- Q3 hadi Q5 (mwenendo wa tarehe, siku za wiki, bidhaa) havihusiani na madeni.
