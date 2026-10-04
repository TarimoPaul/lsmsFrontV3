# LSMS V3 — Pendekezo la oda (auto-order): mpango na backtest (Awamu ya 1)

> **2026-10-04 (baadaye):** majibu ya mmiliki, backtest ya dump ya 04/10 na mpango wa Awamu 2 viko kwenye **`v3_order_phase2_plan.md`**. Namba za hapa chini ni za dump ya 30/09, na KUPIMA sasa ziko daraja C.

**Tarehe:** 2026-10-04
**Chanzo cha data:** backup ya prod `prod_Lsms_20260930_1026_before_gl.dump` (ndiyo ya karibuni iliyopo kwenye kompyuta hii). Ilirudishwa kwenye container ya muda ya Postgres 17, na container imefutwa baada ya kazi. **Hakuna query iliyoendeshwa kwenye production wala staging. Hakuna code ya production, deploy wala commit.**
**Dirisha la backtest:** 2026-08-01 hadi 2026-09-29 (siku 60). Historia ya mauzo: 2026-02-01 hadi 2026-09-29.
**Faili:** `analysis/v3_order_backtest.sql` (queries za kutoa data), `analysis/v3_order_backtest.py` (simulation ya siku kwa siku), `analysis/v3_order_backtest_out/*.csv` (matokeo kamili).

Kila kitu kimehesabiwa kwa `product_id` / `uid`, si kwa jina. Majina 10 yanajirudia (mfano ABSOLUTE VODKA id 54 na 55, zenye pakiti 24 na 12).

---

## 1. Matokeo muhimu (soma hapa kwanza)

1. **Formula inafanya kazi kwa bia kuu, lakini haitoi pesa nyingi.** Kwa stock ileile mnayoshika leo (~1.4M kwa daraja A), formula ingeishiwa siku 26 dhidi ya 33 za kweli. Hiyo ni nafuu ndogo, si mapinduzi. Mnunuzi wa sasa tayari ananunua kwa ukaribu mkubwa (stock ya siku 1.0–1.5 kwa bia kuu).
2. **Bajeti ya "siku moja tu" inaharibu kila kitu.** Kama oda ya leo inaruhusiwa kutumia pesa ya recon ya jana pekee, oda inakatwa siku 34 kati ya 60 na stockout zinaongezeka mara 2.7 (131 dhidi ya 48). Pesa iliyobaki jana lazima iweze kutumika leo. Hili linahitaji uamuzi wako (swali la 3).
3. **Mtiririko wa "count approved → recon approved → pendekezo" hauwezekani kwa tabia ya sasa ya approvals.** Recon ya jana ilikuwa imeidhinishwa kufikia saa 9 alasiri (muda wa kawaida wa kununua) siku 5 tu kati ya 60. Approvals zote mbili zilikuwa tayari kufikia saa 9 siku 4 tu.
4. **Mtaji mkubwa haupo kwenye bia.** Wastani wa stock: daraja A 1.42M, B 0.26M, **C 2.16M, na bidhaa 42 ambazo hazikuuzwa wala kununuliwa kwa siku 60 zina 0.82M.** Formula haigusi hizo 3.0M (64% ya stock).
5. **Stockout nyingi za simulation zinatokana na oda kubwa za jumla**, yaani siku ambayo bidhaa moja inauzwa mara 2.5–10 ya kawaida yake. Hakuna formula ya wastani inayoweza kutabiri hizo; mmiliki lazima aweze kuongeza kwa mkono.
6. **Factors za siku zinasaidia kidogo sana kwa bidhaa moja moja.** Kosa la utabiri wa siku moja ni ~45–50% ya mauzo ya wastani, ikiwa na factor au bila. Akiba ya usalama (safety stock) ina athari kubwa kuliko factors.

**Pendekezo langu:** daraja A `cover_days = 2` na safety stock `z = 0.5`; soda `cover_days = 3` na onyo; KUPIMA zihamie daraja C; bajeti iwe "mfuko" unaobeba salio (kikomo 1M). Maelezo yako sehemu ya 7.

---

## 2. Inputs: nilivyozipima

### 2.1 Stock iliyopo = hesabu ya leo iliyoidhinishwa
- `counting_line`: `coalesce(recount_qty, counted_qty)` ya session ya siku hiyo yenye status `APPROVED`. Stock ya mfumo (`products.current_stock`) haitumiki kabisa.
- Counting inafanyika asubuhi (median saa 3:40), kwa hiyo hesabu ya siku D ni stock kabla ya mauzo ya D.
- Siku 52 kati ya 60 zina hesabu iliyoidhinishwa. Siku 8 zilizobaki ni FORCE_CLOSED; siku hizo pendekezo lisingetoka.

### 2.2 Mahitaji (velocity)
- Vipande kwa siku kutoka siku 14 zilizopita: mauzo `STANDARD`, bila yaliyofutwa (`is_deleted`), bila `RECONCILIATION_MANUAL`, returns zilizoidhinishwa zimetolewa.
- **Siku za stockout: nimezirekebisha, sikuzifuta.**
  - Siku inahesabiwa stockout kama hesabu ya kesho yake asubuhi ni 0. Kama kesho yake haina hesabu, natumia salio la mfumo la mwisho wa siku ≤ 0.
  - Mauzo ya siku ya stockout yanapandishwa hadi angalau wastani wa siku safi. Siku iliyoisha mzigo haiwezi kuwa na mahitaji chini ya kawaida.
  - Sikuzifuta kwa sababu siku za stockout mara nyingi ndizo siku zenye mauzo makubwa; kuzifuta kungeshusha velocity.
  - Kama siku safi ni chini ya 5 ndani ya siku 14, dirisha linarudi nyuma hadi siku 28.
- Velocity inaondolewa athari ya siku (inagawanywa kwa factor ya kila siku) ili factor isihesabiwe mara mbili inapozidishwa tena.

### 2.3 Factor ya siku ya wiki (imehesabiwa upya)
| Chanzo | Jtt | Jnn | Jtn | Alh | Ijm | Jms | Jpl |
|---|---|---|---|---|---|---|---|
| Wiki 8 za mwisho (hadi 29/09) | 0.95 | 0.88 | 0.86 | 0.93 | 1.14 | 1.14 | 1.10 |
| Historia yote (Feb–Sep, ndani ya mwezi) | 0.91 | 0.79 | 0.92 | 0.94 | 0.99 | 1.23 | 1.22 |
| Ulivyojua | | 0.80 | | | | 1.24 | 1.19 |

- Historia yote inathibitisha namba zako (Jms 1.23, Jpl 1.22, Jnn 0.79).
- Dirisha la wiki 8 **halijatulia**: Ijumaa ilikuwa 0.86 tarehe 01/08 na 1.14 tarehe 29/09; Jumamosi ilishuka kutoka 1.27 hadi 1.11. Kila siku ya wiki ina siku 8 tu za data.
- **Kwa bidhaa (top 20): factor ya bidhaa yenyewe haijatulia, kwa hiyo haitumiki.** Kosa la utabiri wa siku moja (vipande kwa siku):

| Bidhaa (id) | Mauzo/siku | Bila factor | Duka, wiki 8 | Duka, historia yote | Ya bidhaa, wiki 8 |
|---|---|---|---|---|---|
| CASTLE LITE (60) | 85.0 | 40.9 | 41.2 | **39.5** | 42.5 |
| SAFARI LAGER (72) | 75.2 | **33.8** | 34.5 | 34.3 | 36.1 |
| SAFARI LAGER 500ML (50) | 62.5 | 36.5 | 35.5 | 35.7 | **35.2** |
| SERENGETI LITE (69) | 58.0 | 30.7 | 30.0 | **28.8** | 29.8 |
| SERENGETI LAGER (68) | 51.4 | **27.8** | 29.1 | 28.7 | 29.7 |
| KILIMANJARO (70) | 41.1 | 27.7 | 27.3 | **26.3** | 28.1 |
| SERENGETI LEMON (46) | 29.2 | 19.8 | 19.7 | 19.7 | 22.2 |

  Factor ya bidhaa ilishinda kwa bidhaa 2 tu, kwa chini ya 1%. Pendekezo: tumia factor ya duka kutoka **historia yote**, si wiki 8.

### 2.4 Factor ya tarehe ya mwezi (imehesabiwa upya, hakuna 20→1)
Imepimwa ndani ya kila mwezi, athari ya siku ya wiki imeondolewa, na imelainishwa kwa siku 3:

| Tarehe | 1–5 | 6–14 | 15–20 | 21–22 | 23 | **24** | **25** | **26** | **27** | 28 | 29 | 30–31 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Factor | 0.98–1.08 | 0.95–1.01 | 0.89–0.91 | 0.95 | 1.05 | **1.16** | **1.25** | **1.20** | **1.11** | 1.06 | 0.96 | 0.85–0.89 |

- Kilele halisi ni **tarehe 24–27** (wastani 1.18), si 24–29. Tarehe 29 tayari iko chini ya wastani.
- Kilele kilipimwa 1.14 kwa data ya hadi 01/08 na 1.20 kwa data ya hadi 21/09, kwa hiyo kipo lakini ukubwa wake unabadilika.
- Mfumo unatafuta kilele wenyewe (mfululizo wa tarehe zenye factor ≥ 1.08); hakuna tarehe iliyoandikwa kwenye code.

### 2.5 Pakiti na gharama
- Pakiti: `products.pieces_per_package`. Oda inazungushwa JUU hadi pakiti kamili.
- Bidhaa 27 hazina ukubwa wa pakiti (NULL au 1). Hakuna hata moja iliyo daraja A wala soda; ni KUPIMA, daraja C, au hazitembei.
- Gharama kwa bajeti: `current_average_cost` (kama haipo, `last_purchase_cost`). Faida kwa kipande: mapato − gharama iliyorekodiwa, ya siku 60.

---

## 3. Madaraja

### 3.1 Kanuni kamili (inahesabiwa kwa siku 60 zilizopita)
Bidhaa inaingia **C** kama mojawapo ni kweli:
- hesabu ilikuwa 0 kwenye **≥ 30%** ya siku za counting (inanunuliwa kwa oda), au
- iliuzwa kwenye **chini ya 50%** ya siku (mahitaji ya vipindi), au
- inauza **chini ya pakiti 1 kwa siku 14** (kuzungusha pakiti kunazidi utabiri).

Isiyo C inaingia **B** kama:
- jina lina `KUPIMA`, au
- **hesabu hailingani**: Σ|hesabu ya kesho − (hesabu ya leo + manunuzi − mauzo)| ni **> 30%** ya vipande vilivyouzwa.

Zilizobaki ni **A**.

Kipimo cha "hesabu hailingani" kinalinganisha hesabu mbili halisi za siku zinazofuatana, kwa hiyo hakiathiriwi na kosa la stock ya mfumo. Bia kuu zina 1–21%; soda zina 89% na 169%. Nilianza na kikomo cha 15% lakini kiliweka SAFARI LAGER, SERENGETI LITE na SERENGETI LAGER kwenye B, kwa hiyo nimekiweka 30%.

### 3.2 Daraja A — bidhaa 14, 69.5% ya faida ghafi
| id | Bidhaa | Pakiti | Mauzo/siku | Hesabu hailingani |
|---|---|---|---|---|
| 60 | CASTLE LITE | 20 | 85.0 | 12% |
| 72 | SAFARI LAGER | 20 | 75.2 | 18% |
| 50 | SAFARI LAGER 500ML | 20 | 62.5 | 12% |
| 69 | SERENGETI LITE | 25 | 58.0 | 16% |
| 68 | SERENGETI LAGER | 20 | 51.4 | 21% |
| 70 | KILIMANJARO | 20 | 41.1 | 14% |
| 46 | SERENGETI LEMON | 20 | 29.2 | 12% |
| 12 | SERENGETI LAGER kb | 20 | 14.0 | 6% |
| 9 | Castle Lite Can 330ML | 24 | 9.7 | 11% |
| 27 | FLY FISH LEMON 330ML | 20 | 8.8 | 2% |
| 13 | KONYAGI | 24 | 8.3 | 1% |
| 47 | GRAND MALTA | 24 | 4.3 | 0% |
| 32 | KONYAGI kt | 16 | 2.3 | 11% |
| 33 | KONYAGI 750ML | 12 | 1.6 | 3% |

### 3.3 Daraja B — bidhaa 8, 7.7% ya faida ghafi
| id | Bidhaa | Sababu |
|---|---|---|
| 3 | PEPSI && MIRINDA | hesabu hailingani 89% ya mauzo (ziada ya vipande 675 isiyoelezwa) |
| 25 | COCA && FANTA | hesabu hailingani 169% ya mauzo |
| 52 | KONYAGI YA KUPIMA | KUPIMA; hesabu 0 siku 75% |
| 79, 36, 65, 66, 91 | Moon Light Kupima, CAMINO KUPIMA, GOLDEN KING KUPIMA, GILBEYS KUPIMA, WINE ZA KUPIMA | KUPIMA; mauzo ya vipande 0–1 kwa siku 60 |

### 3.4 Daraja C — bidhaa 74, 22.7% ya faida ghafi (hakuna utabiri)
Zenye mauzo makubwa zaidi:

| id | Bidhaa | Mauzo siku 60 | Sababu |
|---|---|---|---|
| 40 | SINGSUNG MAJI | 659 | stock 0 siku 81%; inauzwa siku 10 |
| 5 | KILIMANJARO LAGER | 560 | inauzwa siku 20 kati ya 60 |
| 11 | AFYA MAJI 600ML | 453 | stock 0 siku 33% |
| 49 | AFYA | 284 | stock 0 siku 52% |
| 97 | CUCA | 210 | stock 0 siku 75% |
| 10 | HANSON CHOICE 200ML | 209 | stock 0 siku 38% |
| 98 | COCA & FANTA AWAY | 204 | stock 0 siku 44% |
| 6 | BRUTA FRUIT 330ML | 166 | stock 0 siku 31% |
| 38 | HEINEKEN | 149 | inauzwa siku 23 kati ya 60 |
| 8 | REDS CAN 330ML | 111 | inauzwa siku 15 kati ya 60 |

Zilizobaki 64 ni maji, take-away, juisi, na pombe kali/mvinyo za polepole (chini ya pakiti 1 kwa siku 14). Orodha kamili na sababu ya kila moja: `v3_order_backtest_out/classes.csv`.

Bidhaa 42 nyingine hazikuuzwa wala kununuliwa ndani ya siku 60 na hazimo kwenye orodha yoyote.

---

## 4. Formula

```
velocity      = wastani wa vipande/siku, siku 14, stockout zimerekebishwa, athari ya siku imeondolewa
target_units  = velocity × dow_factor(kesho) × dom_factor(kesho) × cover_days + safety_stock
safety_stock  = z × σ × √cover_days          (σ = mtawanyiko wa mauzo ya siku wa bidhaa hiyo, siku 14)
order_units   = max(0, target_units − hesabu_ya_leo), ikizungushwa JUU hadi pakiti kamili
```

- **Kwa nini safety stock hii:** inajipima kwa kila bidhaa. Bidhaa yenye mauzo yanayoruka sana (SERENGETI LAGER kb, FLY FISH) inapata akiba kubwa zaidi kuliko bidhaa tulivu, bila kuongeza stock ya bidhaa zote. Backtest inaonyesha `cover 2 + z 0.5` inakaribia matokeo ya `cover 3 + z 0` (stockout 20 dhidi ya 15) kwa stock ndogo kwa 0.40M (1.59M dhidi ya 1.99M).
- **Maandalizi ya kilele:** siku 3 kabla ya kilele kuanza (kwa data ya sasa tarehe 21–23), factor ya tarehe inapandishwa hatua kwa hatua (⅓, ⅔, kamili) kuelekea kiwango cha kilele. Athari yake kwenye backtest ni ndogo: stockout 48 badala ya 52, kwa stock ya ziada ya ~17k. Naipendekeza kwa sababu ni nafuu, lakini usitarajie tofauti kubwa.
- **Nilijaribu pia** kujumlisha siku moja moja (leo + kesho, kila moja na factor yake) badala ya `factor ya kesho × cover_days`. Matokeo ni yaleyale (stockout 23 dhidi ya 23), kwa hiyo nimebaki na formula yako kwa sababu ni rahisi kueleza.

---

## 5. Bajeti

### 5.1 Formula kutoka kwenye fields za recon zilizopo
```
pesa_iliyoingia = auto_total_sales − retail_debts_total − auto_return_deductions
makusanyo       = cash_debt_total + bank_debt_total + mobile_debt_total
bajeti          = pesa_iliyoingia + makusanyo − expenses_total − gharama_za_mwezi_kwa_siku
```
- `gharama_za_mwezi_kwa_siku` = (`MONTHLY_EXPENSE` za mwezi uliopita + mistari ya mwaka mzima yenye `allocated_month = 0`) ÷ siku za mwezi huo. Agosti: 8,027; Septemba: 17,769; Oktoba: 25,628 kwa siku.
- Nimetumia `auto_total_sales − retail_debts_total` badala ya `auto_cash_sales`, kwa sababu `auto_cash_sales` inazidi mauzo yote siku kadhaa (mfano 18/09: 1,745,500 dhidi ya mauzo 1,213,500). Hilo linahitaji kuchunguzwa kabla ya kuitumia.
- Pesa ya simu imehesabiwa kama pesa inayoweza kununua.

### 5.2 Mfano: oda ya 25/09 inatumia recon ya 24/09 (APPROVED)
| Kipengele | Kiasi |
|---|---|
| Mauzo yote | 1,551,000 |
| − Madeni yasiyolipwa | −84,000 |
| = Pesa iliyoingia | 1,467,000 |
| + Makusanyo ya madeni (benki 30,000 + simu 31,000) | +61,000 |
| − Gharama za siku | −28,000 |
| − Gharama za mwezi kwa siku | −17,769 |
| **= Bajeti** | **1,482,231** |

Kwa siku 60: bajeti ya wastani 1,021,789, median 996,731, ndogo kabisa 170,473 (12/08), kubwa kabisa 1,965,731. Siku 8 zina bajeti chini ya 600,000. Manunuzi halisi ya wastani ni 996,599 kwa siku, kwa hiyo bajeti inalingana na uhalisia.

### 5.3 Bajeti ikizidiwa
Velocity kubwa kwanza, faida kwa kipande ikivunja sare; kinachokatwa kinaonyeshwa kwa pakiti na thamani. Manunuzi ya daraja C (ya mkono) yanatoka kwenye bajeti hiyohiyo kwanza. Bajeti ikiwa kubwa kuliko oda, hakuna kinachoongezwa.

### 5.4 Tatizo: bajeti ya siku moja dhidi ya mfuko
| Kanuni ya bajeti (A2/B3, z = 0) | Siku za stockout (A) | Siku zilizokatwa | Jumla iliyokatwa |
|---|---|---|---|
| Bila bajeti | 42 | 0 | 0 |
| **Siku moja tu** (salio halitumiki kesho) | **122** | **34 / 60** | **15.1M** |
| Mfuko, salio linabebwa hadi 0.5M | 69 | – | 6.0M |
| Mfuko, salio linabebwa hadi 1M | 49 | 6 | 2.4M |
| Mfuko, salio linabebwa hadi 2M au bila kikomo | 42 | 1 | 0.4M |

Bajeti ya wastani inatosha, lakini siku moja moja hailingani na mahitaji: siku ya mauzo hafifu inatoa bajeti ndogo kwa siku inayofuata ambayo ni ya kawaida. "Salio linabaki cash" linapaswa kumaanisha halijazwi stock ya ziada, si kwamba haliwezi kutumika kesho.

### 5.5 Tatizo: recon haiidhinishwi kwa wakati
| Kipimo (siku 60) | Idadi |
|---|---|
| Recon ya jana imeidhinishwa kufikia saa 9 alasiri ya leo | 5 |
| Recon ya jana imewasilishwa (SUBMITTED) kufikia saa 9 alasiri | 18 |
| Hesabu ya leo imeidhinishwa kufikia saa 6 mchana / saa 9 alasiri | 12 / 25 (kati ya 52) |
| Zote mbili tayari kufikia saa 9 alasiri | 4 |
| Zote mbili tayari siku hiyohiyo | 12 |
| Hazikuwahi kuwa tayari (hakuna approval) | 13 |

Median ya kuidhinisha recon mwezi Septemba ni saa 63 baada ya siku ya recon; manunuzi yanafanyika karibu saa 9 alasiri. Kwenye backtest nimetumia namba za recon ya jana kana kwamba ilikuwa imeidhinishwa.

---

## 6. Backtest

### 6.1 Njia
- Kwa kila siku D ya siku 60, pendekezo linahesabiwa kwa data ya kabla ya D tu (mauzo hadi D−1, factors kutoka historia ya kabla ya D, recon ya D−1).
- **Simulation inayoendelea:** stock inaanza na hesabu halisi ya 01/08, kisha inafuata oda zilizopendekezwa. Mahitaji ya siku = vipande vilivyouzwa kweli. Stockout = siku ambayo mauzo halisi yanazidi stock + oda ya siku hiyo.
- **Siku moja moja:** kila siku yenye hesabu iliyoidhinishwa, pendekezo kutoka hesabu halisi linalinganishwa na kilichonunuliwa kweli.
- Stockout halisi = siku iliyofungwa na 0 (hesabu ya kesho yake asubuhi = 0).
- **Dhana kuu:** mzigo unaochukuliwa siku D unafika kabla ya mauzo mengi ya siku D.

### 6.2 Daraja A: stockout dhidi ya stock (bila kikomo cha bajeti, siku-bidhaa 840)
| cover_days / z | Siku za stockout | Stock ya wastani asubuhi | Mauzo yaliyopotea (siku 60) |
|---|---|---|---|
| **Halisi (mnunuzi wa sasa)** | **33** | **1,416,005** | haijulikani |
| 1 / 0 | 197 | 576,547 | 10.10M |
| 1.5 / 0 | 105 | 862,076 | 4.13M |
| 2 / 0 (chaguo lako) | 42 | 1,238,232 | 1.59M |
| 2 / 0.25 | 26 | 1,405,346 | 1.08M |
| **2 / 0.5 (pendekezo)** | **20** | **1,589,765** | **0.84M** |
| 2 / 0.75 | 16 | 1,782,461 | 0.63M |
| 2 / 1 | 10 | 1,991,618 | 0.40M |
| 1.5 / 1 | 22 | 1,492,166 | 0.90M |
| 3 / 0 | 15 | 1,991,038 | 0.57M |
| 3 / 0.5 | 4 | 2,461,179 | 0.17M |

- `2 / 0` inashika stock pungufu kwa 178k lakini inaishiwa mara nyingi zaidi (42 dhidi ya 33).
- `2 / 0.25` inashika stock sawa na ya leo na inaishiwa siku 26 dhidi ya 33.
- `2 / 0.5` inaongeza stock kwa 174k (+12%) na inapunguza stockout hadi 20. Mauzo yanayookolewa ukilinganisha na `2 / 0` ni ~0.75M kwa siku 60, yaani ~67k ya faida ghafi (kwa 9%).

### 6.3 Kwa daraja (bajeti ya mfuko, salio hadi 1M)
| | A: chaguo lako (2, z 0) | A: pendekezo (2, z 0.5) | A: halisi | B: (3, z 0) | B: (3, z 0.5) | B: halisi |
|---|---|---|---|---|---|---|
| Siku za stockout | 49 | 23 | 33 | 6 | 3 | 299* |
| Stock ya wastani asubuhi | 1,211,322 | 1,560,046 | 1,416,005 | 159,071 | 199,203 | 258,180 |
| Stock baada ya kununua | 1,948,762 | 2,303,133 | 2,178,157 | 227,215 | 268,370 | 330,692 |
| Manunuzi siku 60 | 45.49M | 46.44M | 48.20M | 3.83M | 3.89M | 3.96M |
| Mauzo yaliyopotea | 1.78M | 0.95M | – | 37k | 25k | – |
| Siku ambazo mauzo yalizidi stock ya asubuhi | 214 | 136 | 137 | 28 | 15 | 15 |

\* 299 za B ni bidhaa za KUPIMA zinazohesabiwa 0 karibu kila siku; soda mbili zina 0.

Mstari wa mwisho unaonyesha utegemezi wa mzigo wa siku hiyohiyo: hata leo, siku-bidhaa 137 ziliuza zaidi ya kilichokuwepo asubuhi.

### 6.4 Top 20 (zenye utabiri)
"Chaguo" = cover 2/3, z 0. "Pendekezo" = cover 2/3, z 0.5. Zote kwa bajeti ya mfuko hadi 1M.

| id | Bidhaa | Daraja | Mauzo/siku | Stockout: halisi / chaguo / pendekezo | Stock (siku za mauzo): halisi / chaguo / pendekezo | Kreti zilizonunuliwa: halisi / chaguo / pendekezo |
|---|---|---|---|---|---|---|
| 60 | CASTLE LITE | A | 85.0 | 0 / 4 / 1 | 1.3 / 1.0 / 1.4 | 250 / 247 / 249 |
| 3 | PEPSI && MIRINDA | B | 78.1 | 0 / 2 / 0 | 3.3 / 2.1 / 2.6 | 177 / 181 / 184 |
| 72 | SAFARI LAGER | A | 75.2 | 3 / 5 / 4 | 1.2 / 1.1 / 1.4 | 226 / 211 / 215 |
| 50 | SAFARI LAGER 500ML | A | 62.5 | 3 / 4 / 2 | 1.2 / 1.4 / 1.8 | 186 / 175 / 180 |
| 69 | SERENGETI LITE | A | 58.0 | 1 / 0 / 0 | 1.5 / 1.3 / 1.7 | 144 / 140 / 141 |
| 68 | SERENGETI LAGER | A | 51.4 | 0 / 6 / 1 | 1.4 / 1.1 / 1.6 | 155 / 147 / 150 |
| 25 | COCA && FANTA | B | 48.9 | 0 / 1 / 0 | 4.3 / 2.5 / 3.1 | 130 / 116 / 118 |
| 70 | KILIMANJARO | A | 41.1 | 0 / 7 / 1 | 2.0 / 1.1 / 1.6 | 126 / 118 / 122 |
| 46 | SERENGETI LEMON | A | 29.2 | 1 / 4 / 3 | 1.7 / 1.3 / 1.8 | 85 / 76 / 79 |
| 12 | SERENGETI LAGER kb | A | 14.0 | 10 / 8 / 5 | 2.3 / 2.4 / 3.3 | 38 / 35 / 38 |
| 9 | Castle Lite Can 330ML | A | 9.7 | 4 / 2 / 2 | 3.5 / 2.4 / 3.0 | 26 / 23 / 23 |
| 27 | FLY FISH LEMON 330ML | A | 8.8 | 0 / 6 / 2 | 3.0 / 2.7 / 3.6 | 23 / 17 / 20 |
| 13 | KONYAGI | A | 8.3 | 7 / 0 / 0 | 1.6 / 2.3 / 2.6 | 21 / 21 / 21 |
| 47 | GRAND MALTA | A | 4.3 | 2 / 1 / 1 | 5.9 / 4.1 / 4.4 | 11 / 10 / 10 |
| 32 | KONYAGI kt | A | 2.3 | 2 / 1 / 0 | 4.6 / 4.6 / 5.6 | 10 / 9 / 9 |
| 33 | KONYAGI 750ML | A | 1.6 | 0 / 1 / 1 | 7.0 / 5.4 / 5.5 | 8 / 7 / 7 |
| 52 | KONYAGI YA KUPIMA | B | 0.5 | 46 / 2 / 2 | formula si sahihi (6.6) | 13 / 20 / 22 vipande |
| 79, 36, 65 | Moon Light, CAMINO, GOLDEN KING KUPIMA | B | 0.0 | 45–57 / 0–1 / 0–1 | hakuna mauzo ya vipande | pendekezo ni 0 kila siku |

### 6.5 Siku moja moja, kwa hesabu halisi (daraja A, siku-bidhaa 728)
| | Chaguo (2, z 0) | Pendekezo (2, z 0.5) |
|---|---|---|
| Siku ambazo hesabu + pendekezo < mauzo ya siku hiyo | 29 (4.0%) | 11 (1.5%) |
| Pendekezo = kilichonunuliwa kweli | 381 (52%) | – |
| Pendekezo kubwa kuliko kilichonunuliwa | 155 (21%) | – |
| Pendekezo dogo kuliko kilichonunuliwa | 192 (26%) | – |

Mnunuzi wa sasa hununua mara chache kwa mafungu makubwa (CASTLE LITE siku 40 kati ya 60); formula inaagiza karibu kila siku kwa mafungu madogo (siku 57). Jumla ya kreti kwenye jedwali hili haifai kulinganishwa, kwa sababu pendekezo lisilofuatwa linajirudia kesho yake.

### 6.6 Bidhaa ambazo formula si sahihi, na kwa nini
1. **KUPIMA zote (52, 79, 36, 65, 66, 91).** Mauzo ya vipande hayarekodiwi (0–1 kwa siku 60) na hesabu ni 0 siku 73–94%. Velocity ni ~0, kwa hiyo pendekezo ni 0 au halina maana: kwa KONYAGI YA KUPIMA formula ilipendekeza vipande 104 kwa siku 52 dhidi ya 13 vilivyonunuliwa. Hazifai kuwa B; ziende C.
2. **PEPSI && MIRINDA (3) na COCA && FANTA (25).** Zinanunuliwa mara 10 na 9 tu kwa siku 60, mafungu ya kreti 10–30 (inaonekana zinaletwa na wakala kwa ratiba). Formula inaagiza siku 41 kati ya 60. Pia hesabu yake haiaminiki, kwa hiyo pendekezo la siku halisi lingeruka sana. Zinahitaji `cover_days` inayolingana na mzunguko wa wakala (swali la 4).
3. **SERENGETI LAGER kb (12).** Inauzwa siku 36 kati ya 60 kwa mafungu (hadi 62–67 kwa siku dhidi ya velocity 11–23). Inaishiwa hata kwa z 0.5 (5), ingawa ni bora kuliko halisi (10).
4. **FLY FISH LEMON (27) na Castle Lite Can (9).** Siku moja inauza mara 5–10 ya velocity (mfano Castle Lite Can 14/09: 60 dhidi ya 6.9). Ni oda za jumla.
5. **SAFARI LAGER (72).** Vipande 208–288 vilivyopotea vinatoka siku 3: 25/08 (184 dhidi ya velocity 39), 27/08 (160 dhidi ya 50), 29/09 (245 dhidi ya 85).
6. **KILIMANJARO (70) na SERENGETI LAGER (68) kwa z 0.** Mnunuzi anashika siku 2.0 na 1.4; formula inashika 1.1 na inaishiwa siku 7 na 6. Kwa z 0.5 zinashuka hadi 1 na 1.

Stockout 25 kubwa zaidi za simulation zote zina mauzo ya siku hiyo mara 2.4–10 ya velocity.

### 6.7 Pesa inayoachiliwa
| | Chaguo (2/3, z 0) | Pendekezo (2/3, z 0.5) |
|---|---|---|
| Manunuzi ya simulation dhidi ya halisi (A+B, siku 60) | 49.31M dhidi ya 52.16M (−2.85M) | 50.33M dhidi ya 52.16M (−1.84M) |
| kati yake: mauzo yaliyopotea (hayakununuliwa kwa sababu hayakuuzwa) | ~1.65M | ~0.89M |
| kati yake: stock ya mwisho kuwa ndogo kuliko halisi (30/09 stock halisi ilikuwa juu, 1.91M) | 0.98M | 0.74M |
| **Stock ya wastani: simulation dhidi ya halisi** | **1.37M dhidi ya 1.67M (−0.30M)** | **1.76M dhidi ya 1.67M (+0.09M)** |

Tofauti ya manunuzi si akiba ya kweli: sehemu kubwa ni mauzo yaliyopotea na stock ya mwisho. Pesa halisi inayoachiliwa ni ya mara moja tu, sawa na kupungua kwa stock ya wastani: ~0.30M kwa chaguo lako (kwa gharama ya stockout zaidi), na hakuna kwa pendekezo (linaongeza ~0.09M). Simulation pia haina upotevu wa stock, ambao manunuzi halisi yanaufidia.

---

## 7. Mapendekezo

| Kigezo | Pendekezo | Sababu |
|---|---|---|
| `cover_days` A | **2** | 1.5 inaishiwa mara 2.5 zaidi; 3 inafunga ~0.75M zaidi |
| `safety z` A | **0.5** (kinaweza kubadilishwa) | stockout 20 dhidi ya 33 za sasa kwa stock +12%; 0.25 ukitaka stock ileile ya leo |
| `cover_days` B (soda) | **3** kama zinachukuliwa kila siku; vinginevyo siku za mzunguko wa wakala | sehemu 6.6 #2 |
| KUPIMA | hamisha kwenda **C** | hakuna data ya mauzo ya vipande |
| Factor ya siku ya wiki | ya duka, historia yote | wiki 8 hazijatulia; ya bidhaa haijatulia |
| Factor ya tarehe | inahesabiwa upya kila siku, kilele kinajitafuta | kilele ni 24–27 |
| Maandalizi ya kilele | washa (siku 3 kabla) | nafuu, athari ndogo |
| Bajeti | mfuko wenye salio hadi 1M, na mmiliki anaweza kuandika kiasi halisi | sehemu 5.4 |

---

## 8. Hatari

1. **Muda wa mzigo kufika.** Kama mzigo wa siku D unafika baada ya mauzo ya siku D, stockout zinapanda kutoka 48 hadi 201 (z 0) na kutoka 23 hadi 125 (z 0.5). Mauzo yanaingizwa kwa mkupuo usiku, kwa hiyo data haiwezi kuonyesha mauzo yanafanyika saa ngapi.
2. **Approvals zinachelewa** (5.5). Bila kubadilisha tabia, pendekezo litatoka baada ya muda wa kununua.
3. **Oda za jumla zisizotabirika** ndizo chanzo kikuu cha stockout zilizobaki. Zinahitaji mmiliki kuongeza kwa mkono.
4. **Stockout halisi hazijulikani kikamilifu.** Mahitaji kwenye simulation ni mauzo yaliyorekodiwa; siku ambazo duka liliishiwa kweli, mahitaji halisi yalikuwa makubwa zaidi.
5. **Siku 8 kati ya 60 hazina hesabu iliyoidhinishwa**; siku hizo hakuna pendekezo.
6. **Madaraja yamepangwa kwa data ya dirisha lote la siku 60**, si ya kila siku pekee. Athari ni ndogo lakini ipo.
7. **Daraja C ni 23% ya faida ghafi** na halina utabiri; pia ndilo lenye stock kubwa (2.16M + 0.82M isiyotembea).
8. **Bajeti inategemea namba za recon.** `auto_cash_sales` ina kasoro (5.1); gharama za mwezi zinategemea mistari ya `MONTHLY_EXPENSE` kuwa kamili.
9. **Gharama ya bidhaa** ni `current_average_cost`; bei ikipanda ghafla, jumla ya oda itakuwa chini ya halisi.

---

## 9. API na skrini ya V3 (pendekezo tu; haijajengwa)

### 9.1 API
| Endpoint | Kazi |
|---|---|
| `GET /api/order-suggestions/preview?date=` | Inahesabu pendekezo la siku hiyo bila kuhifadhi. Inarudisha hali ya hesabu na recon, bajeti na mchanganuo wake, mistari ya A/B, orodha ya C, na kilichokatwa. |
| `POST /api/order-suggestions` | Inahifadhi pendekezo pamoja na marekebisho ya mmiliki (status `DRAFT`). |
| `POST /api/order-suggestions/{uid}/approve` | Mmiliki anaidhinisha. Kinachofuata kinategemea swali la 2. |
| `GET /api/order-suggestions?from=&to=` | Historia: kilichopendekezwa, kilichoidhinishwa, kilichonunuliwa kweli. |
| `GET/PUT /api/order-settings` | `cover_days` kwa daraja, `z`, kikomo cha mfuko, na marekebisho kwa bidhaa (daraja la kulazimisha, pakiti, cover). |

- Mstari mmoja: `productUid`, `productId`, `productName`, `orderClass`, `countedStock`, `velocity`, `stockoutDaysInWindow`, `dowFactor`, `domFactor`, `coverDays`, `safetyStock`, `targetUnits`, `piecesPerPackage`, `suggestedPacks`, `approvedPacks`, `unitCost`, `lineCost`, `marginPerPiece`, `priority`, `reason`, `warning`, `cutPacks`.
- Tables mpya: `order_suggestion`, `order_suggestion_line`, `product_order_setting`. Hesabu iwe kwenye class safi isiyogusa DB (kama `DailyPnlCalculator`) ili ipimwe kwa unit tests.
- Ruhusa: mpya `ORDER_SUGGESTION_VIEW` / `ORDER_SUGGESTION_APPROVE`. Mfumo hauagizi wenyewe kamwe.

### 9.2 Skrini `/purchases/suggestion`
- **Juu:** tarehe; hali ya hesabu ya leo; hali ya recon ya jana; kadi ya bajeti (pesa iliyoingia + makusanyo − gharama − gharama za mwezi + salio lililobebwa); jumla ya oda; salio linalobaki cash.
- **Jedwali A na B:** bidhaa, stock iliyohesabiwa, velocity, factors (siku ya wiki × tarehe), target, kreti zilizopendekezwa (zinaweza kubadilishwa), gharama, kipaumbele, sababu.
  - Sababu ni sentensi fupi, mfano "Mauzo 85/siku × 1.23 (Jumamosi) × siku 2 + akiba 22 = 231; zipo 88; kreti 8".
  - Mistari ya B ina alama **"data si ya kuaminika"**.
  - Bidhaa iliyoisha ndani ya siku 14 inaonyesha idadi ya siku hizo.
- **Kilichokatwa na bajeti:** orodha tofauti, na kitufe cha kurudisha.
- **Daraja C:** orodha tofauti ya kujaza kwa mkono, ikionyesha stock iliyohesabiwa, mauzo ya siku 14 na manunuzi ya mwisho.
- **Chini:** Idhinisha; chapisha / tuma WhatsApp.

---

## 10. Maswali unayohitaji kujibu

1. **Wasambazaji ni wangapi?** Data inaonyesha mmoja mkuu: TAKAWEDO (44.6M kati ya ~59.8M kwa siku 60, ameandikwa kwa herufi 3 tofauti), kisha "vyote ni vya bwana" 6.4M, bila jina 4.9M, Pepsi 2.3M, Serengeti 0.8M, COCAAGENT 0.3M. Manunuzi 8 tu yameunganishwa na rekodi ya msambazaji; mengine ni maandishi huru. Je, orodha igawanywe kwa msambazaji?
2. **Ukiidhinisha, itengeneze rasimu ya manunuzi (draft purchase) au orodha ya kuchapisha / WhatsApp tu?** Napendekeza orodha kwanza: bei na kiasi halisi hujulikana baada ya kununua, na rasimu isiyorekebishwa ingeharibu stock na gharama. Rasimu inaweza kuongezwa baadaye.
3. **Bajeti:** ya siku moja tu, au mfuko unaobeba salio (napendekeza, hadi 1M)? Na pendekezo lisubiri recon iidhinishwe, au litumie recon iliyowasilishwa (SUBMITTED) na kuonyesha onyo?
4. **Soda (Pepsi, Coca):** zinachukuliwa kila siku kama bia, au zinaletwa na wakala kwa ratiba? Kama ni ratiba, ni kila siku ngapi?
5. **KUPIMA:** unakubali ziende daraja C hadi mauzo ya kipimo yarekodiwe?
6. **Akiba ya usalama:** `z = 0.5` (stockout chache, stock +12%) au `z = 0.25` (stock ileile ya leo)?
7. **Mzigo unafika dukani saa ngapi**, na mauzo mengi yanaanza saa ngapi? Hili ndilo dhana kubwa zaidi ya backtest.

Sitaandika code yoyote ya production hadi ujibu na uidhinishe.

---

## 11. Jinsi ya kurudia
```
docker run -d --name lsms_order_bt -e POSTGRES_PASSWORD=bt -e POSTGRES_DB=lsms postgres:17
docker cp <dump> lsms_order_bt:/tmp/prod.dump
docker exec lsms_order_bt pg_restore -U postgres -d lsms --no-owner --no-privileges /tmp/prod.dump
python analysis/v3_order_backtest.py            # ripoti kamili + CSV
python analysis/v3_order_backtest.py --profile  # madaraja tu
docker rm -f lsms_order_bt
```
Tarehe za dirisha ziko juu ya faili zote mbili. Queries zote ni `SELECT` kwenye session ya read-only.
