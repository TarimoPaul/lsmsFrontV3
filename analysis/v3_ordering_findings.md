# LSMS V3 — Uchambuzi wa data kwa ajili ya "auto-ordering"

**Tarehe ya uchambuzi:** 2026-09-30
**Chanzo cha data:** backup ya prod `prod_Lsms_20260930_1026_before_gl.dump` (imechukuliwa 2026-09-30 saa 10:26). Ilirudishwa kwenye container ya muda ya Postgres 17 kwenye kompyuta hii. **Hakuna query iliyoendeshwa kwenye production.**
**Usalama:** kila session ilianza na `default_transaction_read_only = on` na `statement_timeout = '30s'`. Read-only ilithibitishwa kwa vitendo, kwa sababu hata `CREATE TEMP VIEW` ilikataliwa. Hakuna INSERT, UPDATE, DELETE au DDL iliyofanyika.
**Queries zote:** `analysis/v3_queries.sql` (zinajirudia; badilisha tarehe zilizo juu ya faili).

**Vipindi vilivyotumika:**
- **Siku 90 za mwisho** = 2026-07-02 hadi 2026-09-29. Tarehe 30/09 ni siku isiyokamilika kwenye dump.
- **Historia yote ya mauzo** = 2026-02-01 hadi 2026-09-29.

**Alama za uhakika:**
- **[Uhakika]** = moja kwa moja kutoka kwenye data.
- **(Inawezekana)** = imetokana na data pamoja na dhana nilizozitaja.
- **(Kubahatisha)** = data haipo au haieleweki.

---

## ⭐ Matokeo 3 muhimu zaidi

### 1. Faida ghafi ni ~9.1%, si 6–7%. Lakini faida baada ya gharama na upotevu ni ~4.6%.
- Siku 90: mauzo **99,195,850**, gharama ya bidhaa (COGS) **90,146,504**, faida ghafi **9,049,346**, yaani **9.12%** [Uhakika].
- Kwa siku: mauzo **~1,102,000** na faida ghafi **~100,500** [Uhakika].
- Imani yako ya "~100k faida kwa siku" ni **sahihi**. Lakini inatoka kwenye mauzo ya **~1.1M kwa siku, si 1.5M**. Kwa hiyo asilimia ni ~9%, si 6–7%.
- 6–7% inalingana na faida **baada ya gharama za uendeshaji**:
  - Gharama (chakula, mishahara, umeme, n.k.) ni ~3.0M kwa siku 90, yaani ~33k kwa siku.
  - Hiyo inashusha faida hadi ~6.1% (Inawezekana).
- Ukitoa pia **upotevu wa stock uliothibitishwa kwenye counting** (−1.25M) na marekebisho ya mkono (−0.25M) kwa siku 90, faida halisi ni **~4.6% (~50k kwa siku)** (Inawezekana).
- **Upotevu wa stock ni sawa na ~16% ya faida ghafi yote.**

### 2. Mkopo wa POS SI tatizo tena. Tatizo ni madeni ya "walk-in" (MANUAL_RETAIL), na hakuna udhibiti wowote wa mkopo.
- Madeni yote yaliyobaki 30/09: **~1.90M** (Inawezekana). **1.75M (92%)** kati yake ni madeni ya walk-in.
- Mkopo wa POS umekaribia kuisha:
  - Juni: 14.8M (lakini ulilipwa ndani ya siku 1).
  - Septemba: deni 1 tu la 101k.
  - Mkopo wa POS unarudi kwa wastani wa siku 1 (median).
- Madeni ya walk-in ndiyo yanayokua:
  - Siku 90: yaliyotolewa **4.66M**, yaliyolipwa **3.17M**, ongezeko **+1.38M** (~+15k kwa siku).
  - Ni **64% tu** ya thamani ya madeni ya walk-in iliyowahi kulipwa.
  - **53 kati ya 111** madeni yaliyo wazi yana siku **60+** (666,500).
- Madeni ni sawa na **~34% ya thamani ya stock yote** (5.65M) (Inawezekana).
- **Mkopo wote umetolewa kwa login moja** ("macheda macheda"). Haiwezekani kujua cashier gani alitoa [Uhakika].
- **Hakuna kikomo cha mkopo kinachofanya kazi** [Uhakika]:
  - Customers 26 wana `credit_limit` = 0.00 na wengine ni NULL.
  - Code inatoa onyo tu (haizuii), na onyo hilo linatokea pale tu kikomo kikiwa > 0.

### 3. Kilele cha mwezi SI 20→1. Kilele halisi ni tarehe 24–29, na athari ya siku za wiki ina nguvu zaidi.
- Dirisha la **20→1** lina factor **1.04** tu kwa jumla, na **halijatulia**:
  - Linabadilika kati ya 0.83 na 1.23 kwa mwezi.
  - Liko chini ya 1 katika miezi 4 kati ya 8 [Uhakika].
- Tarehe **24–29**: factor **1.15**, ni juu ya wastani katika miezi 7 kati ya 8.
- Tarehe **30–3** ziko **chini** ya wastani (0.92) [Uhakika].
- Siku za wiki zina athari kubwa na thabiti zaidi [Uhakika]:
  - **Jumamosi 1.24, Jumapili 1.19.**
  - **Jumanne 0.80.**

> Pia muhimu kwa ordering: duka hununua karibu **kila siku**. Mfano: CASTLE LITE ilinunuliwa mara 66 ndani ya siku 90.
> Stock iliyopo inatosha **siku ~5–6 tu** za mauzo.
> Bidhaa kadhaa (maji, soda za take-away) zinakaa **0 siku nyingi**. Zinanunuliwa pale tu zinapoagizwa, kwa hiyo mauzo yaliyorekodiwa **hayaonyeshi mahitaji halisi**.

---

## Hatua 0 — Ramani ya schema na jinsi nilivyoshughulikia kasoro za data

### Ramani (tables halisi)
| Kitu | Table / column |
|---|---|
| Mauzo | `sales` (`sale_date`, `total_amount`, `sale_source` = STANDARD / RECONCILIATION_MANUAL, `is_deleted`, `user_uid`, `customer_id`) |
| Mistari ya mauzo | `sales_details` (`piece_quantity` = vipande, `sub_total`, `cost_per_piece`, `total_cost`, `sale_type`) |
| Bidhaa | `products` (`current_average_cost`, `last_purchase_cost`, `piece_sale_price`, `whole_sale_price` = bei ya kreti, `pieces_per_package` = ukubwa wa kreti, `current_stock`) |
| Malipo | `payments`: kawaida ni **mstari 1 kwa kila sale unaobadilishwa (update)** deni linapolipwa (`amount_paid`, `outstanding_balance`, `payment_date`, `mirror_baseline`) |
| Mkopo / madeni | `reconciliation_retail_debts` (`reference_type` NULL = deni la POS, `MANUAL_RETAIL` = deni la walk-in). `customer_credits` / `credit_payments` **ni tupu** (hazitumiki). |
| Makusanyo ya madeni | `reconciliation_debt_collections` (POS, kwa tarehe ya recon), `reconciliation_debt_payments` (ledger ya madeni), `debt_adjustment` (CORRECTION 4) |
| Gharama za kila siku | `reconciliation_expenses` (zinanakiliwa kwenye `capital_expenditure` kama DAILY_EXPENSE) pamoja na `capital_expenditure` MONTHLY_EXPENSE |
| Reconciliation | `daily_reconciliation` pamoja na tables ndogo `reconciliation_*` |
| Counting | `counting_session`, `counting_line` (`system_qty_snapshot`, `counted_qty`, `recount_qty`, `variance_qty`, `cashier_reason`, `explained_at`) |
| Marekebisho ya stock | `stock_adjustment` (kutoka counting), `store` movement_type=ADJUSTMENT (`COUNT…` na `ADJ-…`) |
| Mwendo wa stock | `store` (SALE, PURCHASE, ADJUSTMENT, SALE_REVERSAL; `stock_after` = salio baada ya kila movement) |
| Manunuzi | `purchases` (`cost_per_piece`, `quantity`, `purchase_type`, `pieces_per_package_at_purchase`, `status`) |

### Historia ya data
- **Mauzo:** 2026-02-01 hadi 2026-09-30, yaani miezi 8 [Uhakika].
  - Siku moja tu haina mauzo: **2026-02-15**.
  - Feb–Mac mauzo yaliingizwa kwa mkupuo (~1 sale kwa siku, jumla ya siku nzima). Tangu Aprili yanaingizwa kwa undani zaidi.
  - Jumla za kila siku zinatumika kwa miezi yote. Kwa idadi ya mauzo (ticket) tumia Aprili kuendelea tu.
- **Mauzo kwa mwezi** (STANDARD, bila yaliyofutwa):

  | Mwezi | Mauzo |
  |---|---|
  | Feb | 21.4M |
  | Mac | 23.2M |
  | Apr | 25.0M |
  | Mei | 32.1M |
  | Jun | 38.3M |
  | Jul | 35.1M |
  | Ago | 30.1M |
  | Sep | 34.9M (siku 29) |

  Kuna mwelekeo wa ukuaji, ndiyo sababu factors za Q3/Q4 zimepimwa ndani ya kila mwezi.
- **Madeni** (reconciliation) yanaanza tu **2026-06-13** (POS) na **2026-06-23** (walk-in) [Uhakika]. **Kabla ya Juni hakuna rekodi ya mkopo**, kwa hiyo madeni ya Okt 2025 hadi Mei 2026 hayajulikani (Kubahatisha).
- **Counting** inaanza **2026-07-05** [Uhakika].
- `sales.due_date` **haijawahi kujazwa** (0 rows), ingawa `default_credit_term_days = 30` [Uhakika].

### Kasoro zinazojulikana: jinsi nilivyozishughulikia
1. **Refund Payment kuhesabiwa kama pesa iliyopokelewa.**
   - Marekebisho ni commit `58b761e` ya backend, **2026-08-10** ("Fix refund rows counted as money received…").
   - Prod ina **refund row 1 tu**: 2026-05-21, 31,000. Tayari ina `is_active=false`.
   - Nimeondoa kila payment yenye `REFUNDED`, `is_active=false` au `total_amount<0`.
   - Return hiyo moja (20 pcs, 31,000) haikupunguza `sales.total_amount`, kwa hiyo nimeitoa kwenye mauzo na vipande.
   - Athari ni ≤31k na iko nje ya dirisha la siku 90 [Uhakika].
2. **MANUAL_RETAIL.**
   - Mauzo yenye `sale_source='RECONCILIATION_MANUAL'` (213 debts, 5.146M) **yameondolewa kwenye mauzo, demand na faida (P&L)**.
   - **Yamejumuishwa kwenye madeni (Q1)**, kwa sababu ni pesa halisi inayodaiwa. Bidhaa zilishatoka kupitia sale ya kawaida ya POS, kisha cash ikahamishiwa kuwa deni (hivyo ndivyo GL inavyoipost) [Uhakika].
3. **Counting zilizo-approved bila `cashier_reason` / `explained_at` ambazo hazikupost `stock_adjustment`.**
   - Nimezipima (tazama Q8): **497 lines**, jumla halisi **+2,946 pcs (~2.72M)** hazikuwahi kupost [Uhakika].
   - Kwa hiyo sikutumia `stock_adjustment` pekee kupima usahihi wa stock. Nilitumia `counting_line` moja kwa moja: hesabu ya mwisho ni recount kama ipo, vinginevyo count ya kwanza.
4. **Mauzo yaliyofutwa, voided au refunded:**
   - Yaliyofutwa ni `is_deleted=true` (siku 90: 58 sales, 5.31M). Yameondolewa.
   - Refund imeshughulikiwa kama ilivyo hapo juu.
   - Hakuna status nyingine ya "cancelled" kwenye `sales`.
5. **Ziada:**
   - `purchases.total_amount` ni NULL au iko chini ya kiasi halisi kwa Feb–Jun kwenye dump hii (tatizo lililojulikana).
   - Manunuzi yote nimeyapima kama `cost_per_piece × vipande`. Kwa Jul–Sep, njia hii inalingana na `total_amount` 100%.
6. **Ziada: madeni kwenye `sales.outstanding_balance` (1.65M) ≠ `payments.outstanding_balance` (1.99M).**
   - Tofauti iko kwenye madeni ya walk-in: header 1.46M dhidi ya payment 1.80M.
   - Nimetumia payment row, ambayo ndiyo inayolingana na AR report na GL (Inawezekana).

### Njia ya "ledger ya madeni" (Q1, Q2)
Payment row inabadilishwa (update) kila deni linapolipwa, kwa hiyo tarehe za malipo hazikai sehemu moja. Nimejenga ledger hivi:
- **Deni limetolewa** = `reconciliation_retail_debts.amount`, tarehe `sale_date`.
- **Salio lililobaki leo** = `payments.outstanding_balance`. Hili ni salio la kweli.
- **Kilicholipwa** = deni − salio − CORRECTION zilizo-approved.
- **Tarehe ya malipo:**
  - POS: siku ya recon ambayo pesa ilitangazwa (`reconciliation_debt_collections`).
  - Walk-in: `reconciliation_debt_payments.paid_at`.
  - Kiasi kinachobaki bila ushahidi wa tarehe: `payments.payment_date`, yaani tarehe ya malipo ya mwisho.
- Kwa hiyo **jumla ni [Uhakika], lakini mgawanyo wa tarehe ni (Inawezekana)**. Kwa deni lililolipwa kwa awamu nyingi bila rekodi, awamu zote zinaangukia tarehe ya mwisho.

---

## Q1. Mkopo na kuvuja kwa mtaji

### 1a. Mkopo uliotolewa dhidi ya uliolipwa kwa siku (siku 90: 02/07 hadi 29/09)
| Kipimo | Uliotolewa (jumla) | wa POS | wa walk-in | Uliolipwa | Mabadiliko halisi |
|---|---|---|---|---|---|
| Wastani kwa siku | 95,822 | 44,056 | 51,767 | 80,878 | **+13,800** |
| Median kwa siku | 45,000 | 0 | 32,000 | 6,000 | +5,750 |
| Jumla kwa siku 90 | 8,624,000 | 3,965,000 | 4,659,000 | 7,279,000 | **+1,242,000** |
| Siku zenye shughuli | 71 | 25 | 69 | 47 | |

Maana yake:
- Madeni yaliongezeka **+1.24M** ndani ya siku 90, kutoka ~660k (01/07) hadi ~1.90M (29/09) (Inawezekana).
- Mgawanyo:
  - **POS:** −141k (inalipwa zaidi ya inavyotolewa, kwa sababu inaisha).
  - **Walk-in:** **+1.38M** (4.66M imetolewa, 3.17M imelipwa, 0.10M imerekebishwa).

### 1b. Jumla kwa wiki (Jumatatu hadi Jumapili)
| Wiki inaanza | Imetolewa | POS | Walk-in | Imelipwa | Marekebisho | Halisi |
|---|---|---|---|---|---|---|
| 29/06 (02–05/07) | 1,991,000 | 1,566,000 | 425,000 | 1,413,500 | 0 | +577,500 |
| 06/07 | 1,503,500 | 368,000 | 1,135,500 | 1,355,000 | 0 | +148,500 |
| 13/07 | 1,521,500 | 1,157,500 | 364,000 | 1,225,500 | 0 | +296,000 |
| 20/07 | 739,500 | 401,500 | 338,000 | 659,000 | 0 | +80,500 |
| 27/07 | 361,500 | 118,500 | 243,000 | 413,000 | 0 | −51,500 |
| 03/08 | 305,000 | 89,500 | 215,500 | 97,000 | 0 | +208,000 |
| 10/08 | 273,500 | 54,000 | 219,500 | 372,500 | 3,000 | −102,000 |
| 17/08 | 251,500 | 109,000 | 142,500 | 243,500 | 0 | +8,000 |
| 24/08 | 340,500 | 0 | 340,500 | 314,500 | 0 | +26,000 |
| 31/08 | 145,000 | 101,000 | 44,000 | 509,500 | 0 | −364,500 |
| 07/09 | 527,000 | 0 | 527,000 | 422,000 | 0 | +105,000 |
| 14/09 | 160,000 | 0 | 160,000 | 188,000 | 100,000 | −128,000 |
| 21/09 | 461,000 | 0 | 461,000 | 66,000 | 0 | **+395,000** |
| 28/09 (28–29) | 43,500 | 0 | 43,500 | 0 | 0 | +43,500 |

- Wiki ya 21/09 ndiyo mbaya zaidi: +395k, karibu yote ni walk-in [Uhakika kwa thamani iliyotolewa; tarehe za malipo (Inawezekana)].
- **Hakuna deni jipya la POS tangu 06/09** [Uhakika].

### 1c. Madeni mwishoni mwa kila mwezi (miezi 12)
| Mwisho wa mwezi | Jumla | POS | Walk-in |
|---|---|---|---|
| 31/10/2025 hadi 31/05/2026 | **hakuna data** | – | – |
| 30/06/2026 | 1,629,500 | 1,203,000 | 426,500 |
| 31/07/2026 | 1,644,500 | 399,000 | 1,245,500 |
| 31/08/2026 | 1,632,500 | 214,000 | 1,418,500 |
| 30/09/2026 | **1,902,500** | 153,000 | 1,749,500 |

- Kabla ya Juni 2026, mfumo haukuwa na rekodi ya mkopo kabisa. Hakuna njia ya kujua madeni ya wakati huo (Kubahatisha).
- Jumla imekaa ~1.63M kwa miezi 3, halafu Septemba imeruka +270k.
- **Muundo umebadilika:** mwezi Juni madeni mengi yalikuwa ya POS. Sasa ni walk-in karibu yote (Inawezekana).

### 1d. Umri wa madeni yaliyo wazi (tarehe 30/09)
| Umri (siku) | Idadi | Kiasi | kati yake POS |
|---|---|---|---|
| 0–7 | 17 | 314,500 | 0 |
| 8–30 | 15 | 547,000 | 0 |
| 31–60 | 26 | 374,500 | 2 (42,500) |
| **60+** | **53** | **666,500** | 4 (110,500) |
| **Jumla** | **111** | **1,902,500** | 6 (153,000) |

- **35% ya kiasi kinachodaiwa kina siku 60+.** Kwa kawaida deni la umri huo haliwezi kukusanywa kwa urahisi (Inawezekana).

### 1e. Wadaiwa 10 wakubwa (customer ID tu, bila majina wala simu)
| # | customer_id | Madeni wazi | Kiasi | Deni kongwe (siku) | Aina |
|---|---|---|---|---|---|
| 1 | a22a5773-88a3-4c2a-a4f0-f2c85bcdbcad | 2 | 120,000 | 35 | walk-in |
| 2 | 3a0c8fea-0af7-40dc-9d31-ef2cdabbf3c6 | 1 | 100,000 | 9 | walk-in |
| 3 | 4389cd82-941c-4d45-b34f-05be4e571d7f | 3 | 98,000 | 5 | walk-in |
| 4 | ee226d4e-4b67-4476-8be8-e11d98b84abc | 1 | 85,000 | 17 | walk-in |
| 5 | 8b0ad5e5-dddb-4ba3-a2f2-a9e92c89187a | 2 | 72,000 | 15 | walk-in |
| 6 | 73c60f46-7b36-430f-88b9-b94a59a3b6c9 | 6 | 63,500 | 66 | walk-in |
| 7 | 81cadd4f-aeec-424d-a619-8cad2013043d | 3 | 63,000 | 83 | walk-in |
| 8 | 842ffac3-fcea-485f-b649-35106db05958 | 3 | 52,500 | 79 | walk-in |
| 9 | 2aa6a53d-7c5f-46b0-81bf-4fa53a543eaa | 2 | 51,500 | 79 | walk-in + POS |
| 10 | 644d36e7-464f-419b-8bc0-4c0acfaac107 | 2 | 51,000 | 76 | walk-in + POS |

- Wadaiwa 10 wakubwa wanadaiwa jumla ya 756,500 (~40% ya madeni yote) [Uhakika].
- Madeni yamesambaa: hakuna mdaiwa mmoja mkubwa sana.

### 1f. Muda kutoka deni hadi kulipwa kikamilifu (madeni yaliyolipwa tu)
| Aina | Idadi | Wastani (siku) | Median | Wastani uliopimwa kwa kiasi | 90% yalilipwa ndani ya |
|---|---|---|---|---|---|
| POS | 197 | 3.4 | **1** | 2.6 | 5 |
| Walk-in | 108 | 17.9 | **6** | 13.9 | 54 |
| Zote | 305 | 8.5 | 1 | 4.3 | 33 |

- Mkopo wa POS kwa kweli ni "lipa kesho": 147 kati ya 214 ya makusanyo yalifanyika siku 1 baada ya mauzo [Uhakika].
- Takwimu za walk-in ni **za chini kuliko ukweli**, kwa sababu 105 kati ya 213 bado hayajalipwa na mengi ni ya zamani (Inawezekana).

---

## Q2. Udhibiti wa mkopo

### 2a. Nani anatoa mkopo (siku 90)
| Mtumiaji | Roles | Madeni ya POS | Walk-in | Jumla | Bado wazi |
|---|---|---|---|---|---|
| macheda macheda | user, SALES, MANAGER | 41 = 3,965,000 | 190 = 4,659,000 | **8,624,000 (100%)** | 1,837,500 |

- **Mauzo yote** ya siku 90 (985 STANDARD + 190 walk-in) yameingizwa kwa login hii moja [Uhakika].
- Reconciliation 90 kati ya 91 pia zimefanywa na login hiyo [Uhakika].
- Maana yake: **haiwezekani kujua cashier gani alitoa mkopo gani**. Login inashirikiwa [Uhakika].

### 2b. Je, kuna kikomo au sheria ya mkopo? **Ndiyo kwenye schema, HAPANA kwa vitendo.**
- `customers.credit_limit` ipo, lakini data haina kikomo chochote kinachofanya kazi [Uhakika]:
  - Customers 148.
  - 26 wana thamani, na **zote ni 0.00**.
  - Wengine ni NULL.
- `business_settings.default_credit_limit` ipo, ni **NULL**, na **haisomwi na code popote** [Uhakika].
- `suppliers.credit_limit` ipo, lakini inahusu wasambazaji, si wateja.
- Code:
  - `SaleService.java:616–637` inatoa **onyo tu (haizuii)** pale mteja anapozidi kikomo, na hilo linatokea pale tu kikomo kikiwa > 0. Kwa data ya sasa **haitokei kamwe** [Uhakika].
  - `Customer.canTakeCredit()` ipo kwenye `Customer.java:79` lakini **haiitwi popote** [Uhakika].
- `default_credit_term_days = 30` hutumika kuweka `due_date`. Lakini `sales.due_date` ni NULL kwa mauzo yote [Uhakika].
- Madeni ya walk-in yana `reconciliation_retail_debts.due_date` yao wenyewe. Haya sikuyachambua zaidi.

---

## Q3. Mwenendo wa tarehe za mwezi (Feb–Sep 2026, miezi 8)

**Njia:**
- Mauzo ya siku = jumla ya `total_amount` ya mauzo ya STANDARD yasiyofutwa, ukiondoa return.
- **f_mwezi** = mauzo ya siku ÷ wastani wa siku wa **mwezi huo**. Hii inaondoa athari ya ukuaji wa biashara.
- Kila tarehe ina siku 7–8 tu za data, kwa hiyo kila seli moja ina kelele (noise) nyingi. CV ya mauzo ya siku ni 0.30–0.51 ndani ya mwezi.

| Tarehe | Wastani wa mauzo | f (jumla) | **f_mwezi** | Feb | Mac | Apr | Mei | Jun | Jul | Ago | Sep |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 911,075 | 0.91 | 0.96 | 1.49 | 1.16 | 1.20 | 1.08 | 0.56 | 0.74 | 0.80 | 0.70 |
| 2 | 1,105,700 | 1.11 | 1.11 | 1.50 | 0.47 | 1.26 | 0.62 | 1.07 | 1.59 | 1.36 | 0.96 |
| 3 | 901,950 | 0.91 | 0.90 | 0.63 | 0.57 | 1.23 | 1.19 | 1.08 | 1.08 | 1.03 | 0.38 |
| 4 | 1,167,325 | 1.17 | 1.20 | 1.77 | 0.55 | 2.48 | 0.64 | 0.90 | 0.98 | 0.56 | 1.70 |
| 5 | 1,111,300 | 1.12 | 1.13 | 0.81 | 0.92 | 2.43 | 0.59 | 1.42 | 1.19 | 0.99 | 0.69 |
| 6 | 1,056,925 | 1.06 | 1.01 | 1.00 | 0.39 | 1.10 | 0.63 | 1.56 | 1.64 | 0.63 | 1.13 |
| 7 | 915,694 | 0.92 | 0.93 | 1.92 | 1.02 | 0.23 | 0.53 | 1.30 | 0.71 | 0.75 | 0.96 |
| 8 | 1,046,825 | 1.05 | 1.07 | 1.39 | 1.19 | 0.89 | 0.51 | 0.99 | 1.45 | 1.23 | 0.87 |
| 9 | 966,575 | 0.97 | 0.99 | 0.74 | 1.55 | 0.93 | 1.02 | 0.78 | 1.14 | 0.96 | 0.80 |
| 10 | 942,100 | 0.95 | 0.89 | 0.88 | 0.12 | 0.61 | 1.26 | 1.47 | 0.94 | 0.97 | 0.89 |
| 11 | 912,600 | 0.92 | 0.91 | 0.82 | 1.10 | 1.12 | 0.98 | 0.96 | 0.73 | 0.20 | 1.38 |
| 12 | 1,072,138 | 1.08 | 1.08 | 1.64 | 0.49 | 1.52 | 0.60 | 1.34 | 1.21 | 0.88 | 0.94 |
| 13 | 997,750 | 1.00 | 1.03 | 1.70 | 1.20 | 0.78 | 0.76 | 1.14 | 0.94 | 0.89 | 0.80 |
| 14 | 1,007,113 | 1.01 | 0.99 | 1.29 | 1.01 | 0.37 | 1.03 | 1.10 | 1.34 | 0.66 | 1.14 |
| 15 | 839,788 | 0.84 | 0.83 | 0.00* | 1.23 | 0.75 | 0.88 | 1.11 | 0.94 | 1.13 | 0.57 |
| 16 | 824,375 | 0.83 | 0.81 | 0.48 | 0.45 | 0.91 | 1.13 | 0.69 | 0.72 | 0.98 | 1.09 |
| 17 | 877,088 | 0.88 | 0.88 | 1.09 | 0.91 | 0.73 | 1.26 | 0.67 | 0.87 | 0.39 | 1.14 |
| 18 | 1,021,763 | 1.03 | 1.00 | 0.59 | 0.77 | 0.92 | 1.12 | 0.76 | 1.81 | 1.01 | 1.01 |
| 19 | 796,725 | 0.80 | 0.81 | 0.68 | 1.13 | 0.85 | 1.09 | 0.49 | 0.96 | 0.35 | 0.93 |
| 20 | 968,988 | 0.97 | 0.94 | 0.75 | 1.09 | 0.37 | 0.81 | 1.24 | 0.79 | 1.05 | 1.43 |
| 21 | 1,019,700 | 1.02 | 1.04 | 0.67 | 2.36 | 0.52 | 0.74 | 1.26 | 0.79 | 1.07 | 0.94 |
| 22 | 930,138 | 0.93 | 0.95 | 1.15 | 1.26 | 0.86 | 1.01 | 0.97 | 0.36 | 0.97 | 1.06 |
| 23 | 945,763 | 0.95 | 0.98 | 0.83 | 0.95 | 1.01 | 1.89 | 0.38 | 0.97 | 1.27 | 0.49 |
| **24** | 1,145,538 | 1.15 | **1.17** | 0.88 | 1.84 | 0.83 | 1.05 | 1.04 | 0.80 | 1.60 | 1.29 |
| **25** | 1,242,813 | 1.25 | **1.23** | 1.09 | 0.79 | 1.34 | 1.51 | 1.35 | 1.21 | 1.40 | 1.16 |
| **26** | 1,279,300 | 1.28 | **1.28** | 0.84 | 1.08 | 1.55 | 1.47 | 0.94 | 1.59 | 1.37 | 1.36 |
| **27** | 1,152,950 | 1.16 | **1.13** | 0.73 | 1.38 | 0.49 | 1.56 | 1.41 | 0.94 | 1.22 | 1.29 |
| 28 | 965,575 | 0.97 | 0.98 | 0.64 | 1.54 | 0.82 | 1.01 | 0.93 | 0.89 | 1.29 | 0.74 |
| 29 | 1,109,286 | 1.11 | 1.11 | – | 0.93 | 1.08 | 1.32 | 0.51 | 0.64 | 2.11 | 1.15 |
| 30 | 751,117 | 0.75 | 0.78 | – | 0.99 | 0.82 | 0.78 | 0.56 | 0.53 | 0.99 | – |
| 31 | 698,125 | 0.70 | 0.72 | – | 0.56 | – | 0.94 | – | 0.48 | 0.88 | – |

\* Tarehe 15/02 hakuna mauzo yaliyorekodiwa. Ni siku pekee iliyokosekana.

### Madirisha kwa kila mwezi (f_mwezi)
| Mwezi | **20→1** | 2→19 | **24–29** | 30→3 | 4–23 | CV ya siku |
|---|---|---|---|---|---|---|
| Feb | 0.91 | 1.05 | 0.84 | 1.21 | 1.01 | 0.45 |
| Mac | 1.22 | 0.84 | 1.26 | 0.75 | 0.99 | 0.46 |
| Apr | 0.91 | 1.06 | 1.02 | 1.13 | 0.97 | 0.51 |
| Mei | 1.17 | 0.88 | 1.32 | 0.92 | 0.92 | 0.33 |
| Jun | 0.93 | 1.05 | 1.03 | 0.82 | 1.03 | 0.32 |
| Jul | 0.83 | 1.13 | 1.01 | 0.89 | 1.03 | 0.35 |
| Ago | 1.23 | 0.83 | 1.50 | 1.01 | 0.85 | 0.38 |
| Sep | 1.06 | 0.97 | 1.17 | 0.68 | 1.00 | 0.30 |
| **Jumla** | **1.04** | 0.98 | **1.15** | **0.92** | 0.97 | 0.42 |

**Hitimisho:**
- **Imani ya "20→1 ni kilele" haithibitishwi** [Uhakika]:
  - Dirisha hilo ni +4% tu kwa wastani.
  - Liko chini ya wastani katika miezi 4 kati ya 8 (Feb, Apr, Jun, Jul).
- Kinachojirudia ni **tarehe 24–27**. Hizi zinaweza kuwa siku za mishahara (Kubahatisha kuhusu sababu).
- Tarehe **30, 31, 1 na 3 ziko chini ya wastani**.
- Kilele cha 24–29 kina nguvu tofauti kila mwezi: 1.01 hadi 1.50, na Feb ni 0.84. Kwa hiyo kilele kipo, lakini ukubwa wake haupo imara (Inawezekana).

---

## Q4. Mwenendo wa siku za wiki (Feb–Sep, ~siku 34–35 kwa kila siku ya wiki)

| Siku | Wastani wa mauzo | **f_mwezi** | Ndani ya 20→1 | Nje ya 20→1 | Jun | Jul | Ago | Sep |
|---|---|---|---|---|---|---|---|---|
| Jumatatu | 918,540 | 0.92 | 0.87 | 0.95 | 0.83 | 1.08 | 0.97 | 0.95 |
| Jumanne | 803,860 | **0.80** | 0.93 | 0.71 | 0.70 | 0.94 | 0.79 | 0.87 |
| Jumatano | 917,097 | 0.92 | 0.93 | 0.92 | 1.07 | 0.83 | 0.90 | 0.84 |
| Alhamisi | 943,212 | 0.95 | 0.99 | 0.92 | 0.99 | 0.99 | 0.95 | 0.92 |
| Ijumaa | 1,002,640 | 0.99 | 1.00 | 0.99 | 1.05 | 0.84 | 0.94 | 1.31 |
| Jumamosi | 1,217,074 | **1.24** | **1.31** | 1.18 | 1.34 | 1.18 | 1.25 | 0.98 |
| Jumapili | 1,173,257 | **1.19** | 1.22 | 1.17 | 1.15 | 1.24 | 1.11 | 1.16 |

**Hitimisho:**
- Siku za wiki zina **mwenendo imara zaidi** kuliko tarehe za mwezi [Uhakika]:
  - Wikendi (Jumamosi na Jumapili) ni ~1.2 karibu kila mwezi.
  - Jumanne ndiyo siku ya chini zaidi.
- Ndani ya dirisha la 20→1, athari ya Jumamosi inaongezeka kidogo (1.31 dhidi ya 1.18) na Jumanne inapanda (0.93 dhidi ya 0.71).
  - Tofauti hizi zinatokana na siku ~15 tu kwa kila kundi, kwa hiyo si imara (Inawezekana).
  - Kwa ujumla, athari ya siku ya wiki **ni ileile** ndani na nje ya dirisha.

---

## Q5. Mahitaji ya bidhaa: Top 20 kwa vipande vilivyouzwa (siku 90)

**Njia:**
- Vipande = `sales_details.piece_quantity` ya mauzo ya STANDARD yasiyofutwa, ukiondoa return. Kreti = vipande ÷ `pieces_per_package`.
- Wastani na SD vimepimwa kwa **siku zote 90**, zikiwemo siku zenye 0.
- f_Jumatatu…f_Jumapili = wastani wa siku hiyo ÷ wastani wa jumla.
- f_20→1 = wastani wa siku za tarehe 20 hadi 1 ÷ wastani wa jumla.

**Stockout (mbinu):**
- `store.stock_after` ni salio linaloandikwa na backend kwa kila movement. Backend inazuia stock kwenda chini ya 0.
- Siku inahesabiwa **stockout** kama:
  - movement yoyote ya siku hiyo iliacha stock = 0, **au**
  - salio la mwisho wa siku (lililobebwa kutoka siku za nyuma) ni 0, **au**
  - counting ilihesabu 0.
- **EOD-0** ni kipimo kigumu zaidi: siku iliyoisha ikiwa na 0 kabisa.
- Hili ni (Inawezekana), kwa sababu mbili:
  - (a) Mauzo na manunuzi yanaingizwa kwa mkupuo, hasa usiku. Kwa hiyo mpangilio wa movements ndani ya siku unaweza kuonyesha 0 kwa muda tu.
  - (b) Counting zisizopostiwa (Q8) zinamaanisha salio la mfumo linaweza kutofautiana na la kweli.

| # | Bidhaa | pcs/kreti | Vipande | Kreti | Wastani/siku (pcs) | Kreti/siku | SD | **CV** | Siku zenye mauzo | Jtt | Jnn | Jtn | Alh | Ijm | Jms | Jpl | f 20→1 | f 2→19 | **Stockout** | **EOD-0** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CASTLE LITE | 20 | 8,216 | 410.8 | 91.3 | 4.56 | 50.9 | 0.56 | 90 | 1.12 | 0.78 | 0.88 | 0.80 | 1.01 | 1.25 | 1.15 | 0.99 | 1.01 | 6 | 3 |
| 2 | PEPSI && MIRINDA | 24 | 6,897 | 287.4 | 76.6 | 3.19 | 53.6 | 0.70 | 87 | 0.89 | 0.76 | 1.10 | 1.25 | 0.93 | 1.03 | 1.03 | 0.84 | 1.10 | 1 | 0 |
| 3 | SAFARI LAGER | 20 | 6,607 | 330.4 | 73.4 | 3.67 | 49.6 | 0.68 | 89 | 0.74 | 1.11 | 1.04 | 0.90 | 1.04 | 1.05 | 1.13 | 1.08 | 0.95 | 9 | 3 |
| 4 | SAFARI LAGER 500ML | 20 | 5,630 | 281.5 | 62.6 | 3.13 | 42.6 | 0.68 | 84 | 1.11 | 0.97 | 0.80 | 0.98 | 0.79 | 0.77 | 1.55 | 1.12 | 0.92 | **10** | 5 |
| 5 | SERENGETI LITE | 25 | 5,321 | 212.8 | 59.1 | 2.36 | 38.5 | 0.65 | 82 | 0.96 | 0.71 | 0.77 | 1.02 | 1.18 | 1.33 | 1.00 | 0.97 | 1.02 | 2 | 0 |
| 6 | SERENGETI LAGER | 20 | 4,756 | 237.8 | 52.8 | 2.64 | 36.0 | 0.68 | 85 | 0.89 | 1.07 | 0.69 | 0.85 | 1.22 | 1.16 | 1.10 | 1.10 | 0.94 | 0 | 0 |
| 7 | COCA && FANTA | 24 | 4,339 | 180.8 | 48.2 | 2.01 | 40.7 | 0.84 | 85 | 1.13 | 1.52 | 0.77 | 1.00 | 0.58 | 0.97 | 1.01 | 1.06 | 0.96 | 0 | 0 |
| 8 | KILIMANJARO | 20 | 3,817 | 190.9 | 42.4 | 2.12 | 32.6 | 0.77 | 76 | 1.05 | 0.77 | 0.81 | 1.05 | 0.71 | 0.89 | 1.69 | 1.05 | 0.97 | 2 | 1 |
| 9 | SERENGETI LEMON | 20 | 2,426 | 121.3 | 27.0 | 1.35 | 24.8 | 0.92 | 74 | 1.23 | 0.80 | 0.83 | 0.92 | 1.08 | 1.41 | 0.70 | 0.93 | 1.04 | 5 | 2 |
| 10 | SERENGETI LAGER kb | 20 | 1,445 | 72.3 | 16.1 | 0.80 | 21.3 | 1.33 | 58 | 1.06 | 0.74 | 1.11 | 1.58 | 0.58 | 0.70 | 1.23 | 0.78 | 1.15 | **18** | **13** |
| 11 | Castle Lite Can 330ML | 24 | 1,023 | 42.6 | 11.4 | 0.47 | 11.9 | 1.05 | 71 | 1.27 | 0.41 | 0.67 | 0.74 | 1.34 | 1.20 | 1.34 | 1.08 | 0.95 | **13** | 7 |
| 12 | KILIMANJARO LAGER | 20 | 880 | 44.0 | 9.8 | 0.49 | 14.8 | 1.51 | 31 | 1.10 | 0.63 | 1.02 | 1.42 | 1.10 | 0.31 | 1.42 | 0.97 | 1.02 | **20** | **17** |
| 13 | AFYA MAJI 600ML | 12 | 817 | 68.1 | 9.1 | 0.76 | 25.1 | 2.77 | 38 | 0.28 | 0.13 | 0.76 | 1.58 | 1.63 | 1.62 | 0.99 | 1.09 | 0.94 | **33** | **32** |
| 14 | FLY FISH LEMON 330ML | 20 | 737 | 36.9 | 8.2 | 0.41 | 13.7 | 1.67 | 43 | 0.82 | 0.92 | 1.12 | 0.85 | 1.24 | 0.75 | 1.32 | 1.08 | 0.95 | **15** | **15** |
| 15 | KONYAGI | 24 | 720 | 30.0 | 8.0 | 0.33 | 7.3 | 0.92 | 78 | 1.24 | 0.78 | 0.66 | 0.88 | 1.38 | 0.88 | 1.15 | 1.21 | 0.86 | **15** | 9 |
| 16 | SINGSUNG MAJI | 12 | 659 | 54.9 | 7.3 | 0.61 | 31.8 | 4.34 | 10 | 0.01 | 0.02 | 1.37 | 0.33 | 0.11 | 5.12 | 0.08 | 1.17 | 0.89 | **81** | **79** |
| 17 | AFYA | 6 | 542 | 90.3 | 6.0 | 1.00 | 13.4 | 2.22 | 45 | 0.64 | 0.23 | 0.14 | 0.36 | 1.65 | 2.53 | 1.39 | 0.90 | 1.07 | **46** | **40** |
| 18 | GRAND MALTA | 24 | 374 | 15.6 | 4.2 | 0.17 | 5.3 | 1.27 | 55 | 0.81 | 1.15 | 0.76 | 0.61 | 0.72 | 1.65 | 1.28 | 1.23 | 0.85 | 6 | 3 |
| 19 | HEINEKEN | 24 | 303 | 12.6 | 3.4 | 0.14 | 5.5 | 1.63 | 36 | 0.57 | 1.53 | 1.44 | 1.30 | 0.55 | 1.23 | 0.41 | 0.99 | 1.01 | 1 | 0 |
| 20 | COCA & FANTA AWAY | 12 | 290 | 24.2 | 3.2 | 0.27 | 14.1 | 4.36 | 20 | 0.50 | 0.07 | 0.08 | 1.19 | 0.64 | 4.32 | 0.12 | 1.00 | 1.00 | **38** | **36** |

**Maana yake:**
- **Bidhaa 9 za juu** (CASTLE LITE hadi SERENGETI LEMON) zinauzwa karibu kila siku, na CV yake ni 0.56–0.92. Hizi **zinafaa kwa utabiri wa kawaida** [Uhakika kwa takwimu; ufaafu (Inawezekana)].
- Factors za siku za wiki kwa bidhaa moja moja zinatofautiana sana na hazilingani na mwenendo wa duka zima. Mfano: SAFARI 500ML Jumapili 1.55 lakini Jumamosi 0.77. Kwa siku ~13 kwa kila siku ya wiki, hizi ni kelele zaidi kuliko ishara. **Factor ya duka zima ndiyo ya kuaminika zaidi** (Inawezekana).
- Factor ya 20→1 kwa bidhaa ni 0.78 hadi 1.23, na **hakuna mwelekeo thabiti** [Uhakika].
- **Bidhaa zinazoisha mara kwa mara.** Mauzo yake yaliyorekodiwa ni **chini ya mahitaji halisi** (Inawezekana):
  - SINGSUNG MAJI (79 EOD-0 kati ya 90).
  - AFYA (40).
  - COCA & FANTA AWAY (36).
  - AFYA MAJI 600ML (32).
  - KILIMANJARO LAGER (17).
  - FLY FISH LEMON (15).
  - SERENGETI LAGER kb (13).
  - Castle Lite Can, KONYAGI na SAFARI LAGER 500ML ziko katikati (5–9).
- **Tahadhari:** bidhaa hizi (hasa maji na take-away) **zinanunuliwa tu zinapohitajika**:
  - SINGSUNG MAJI: manunuzi 5 ya pcs 660, na zimeuzwa 659.
  - AFYA MAJI: pcs 828 zimenunuliwa, 817 zimeuzwa.
  - Kwa hiyo "stockout" kwao inaweza kuwa **sera ya kununua kwa oda**, si kukosa mzigo kwa bahati mbaya (Kubahatisha).
- **Mfumo wa ununuzi:** hata bidhaa kubwa zinanunuliwa karibu kila siku [Uhakika]:
  - CASTLE LITE: manunuzi 66 ndani ya siku 90.
  - SAFARI LAGER: 65.
  - SAFARI 500ML: 52.
  - Hii inamaanisha **stock ni nyembamba sana**, na siku 1–2 za kuchelewa kununua zinaweza kuleta stockout.

---

## Q6. Faida (margins)

### 6a. Kwa bidhaa (Top 20 kwa vipande, siku 90)
**Maelezo ya safu:**
- **gharama/pc** = gharama iliyorekodiwa wakati wa kuuza (`sales_details.total_cost`).
- **bei/pc halisi** = mapato ÷ vipande.
- **bei orodha** = `products.piece_sale_price` / `whole_sale_price`.

| # | Bidhaa | Gharama/pc | Bei/pc halisi | Bei orodha pc / kreti | **GM %** | Faida/pc | **Faida/kreti** | Faida ghafi siku 90 | **% ya faida yote** | Nafasi kwa faida |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | CASTLE LITE | 1,630 | 1,760 | 2,000 / 35,000 | 7.4 | 130 | 2,599 | 1,067,800 | **11.8** | 1 |
| 2 | PEPSI && MIRINDA | 532 | 581 | 1,000 / 13,500 | 8.4 | 49 | 1,175 | 337,528 | 3.7 | 9 |
| 3 | SAFARI LAGER | 1,643 | 1,753 | 2,000 / 35,000 | 6.3 | 110 | 2,195 | 725,201 | 8.0 | 4 |
| 4 | SAFARI LAGER 500ML | 1,734 | 1,891 | 2,500 / 40,000 | 8.3 | 157 | 3,130 | 881,233 | **9.7** | 2 |
| 5 | SERENGETI LITE | 1,579 | 1,722 | 2,500 / 41,000 | 8.3 | 144 | 3,591 | 764,210 | 8.4 | 3 |
| 6 | SERENGETI LAGER | 1,501 | 1,638 | 2,000 / 32,500 | 8.4 | 137 | 2,736 | 650,696 | 7.2 | 5 |
| 7 | COCA && FANTA | 533 | 596 | 1,000 / 13,500 | 10.5 | 62 | 1,498 | 270,781 | 3.0 | 11 |
| 8 | KILIMANJARO | 1,641 | 1,738 | 2,000 / 34,500 | **5.6** | 97 | 1,940 | 370,250 | 4.1 | 7 |
| 9 | SERENGETI LEMON | 1,526 | 1,669 | 2,000 / 33,000 | 8.6 | 143 | 2,865 | 347,550 | 3.8 | 8 |
| 10 | SERENGETI LAGER kb | 1,733 | 1,928 | 2,500 / 37,000 | 10.1 | 195 | 3,905 | 282,151 | 3.1 | 10 |
| 11 | Castle Lite Can 330ML | 2,129 | 2,326 | 2,500 / 56,000 | 8.5 | 197 | 4,728 | 201,545 | 2.2 | 13 |
| 12 | KILIMANJARO LAGER | 1,747 | 1,857 | 2,500 / 37,000 | **5.9** | 110 | 2,191 | 96,395 | 1.1 | 20 |
| 13 | AFYA MAJI 600ML | 317 | 353 | 500 / 4,000 | 10.3 | 36 | 437 | 29,781 | 0.3 | 37 |
| 14 | FLY FISH LEMON 330ML | 1,600 | 1,805 | 2,500 / 34,000 | 11.4 | 205 | 4,106 | 151,300 | 1.7 | 16 |
| 15 | KONYAGI | 3,833 | 4,371 | 5,000 / 98,000 | 12.3 | 538 | 12,901 | 387,018 | 4.3 | 6 |
| 16 | SINGSUNG MAJI | 367 | 457 | 1,200 / 4,500 | **19.7** | 90 | 1,081 | 59,364 | 0.7 | 25 |
| 17 | AFYA | 717 | 792 | 1,000 / 4,500 | 9.6 | 76 | 455 | 41,065 | 0.5 | 32 |
| 18 | GRAND MALTA | 2,186 | 2,476 | 3,000 / 56,000 | 11.7 | 290 | 6,956 | 108,397 | 1.2 | 19 |
| 19 | HEINEKEN | 3,109 | 3,487 | 4,000 / 82,000 | 10.8 | 378 | 9,066 | 114,463 | 1.3 | 18 |
| 20 | COCA & FANTA AWAY | 817 | 898 | 1,000 / 10,500 | 9.1 | 81 | 976 | 23,576 | 0.3 | 43 |

**Uhakiki wa gharama:**
- Gharama iliyorekodiwa wakati wa kuuza inalingana na wastani wa bei ya manunuzi ya siku 90 kwa ±1% kwa bidhaa zote za juu. Mfano: CASTLE LITE 1,630 dhidi ya 1,631.
- Faida iliyopimwa kwa bei ya manunuzi ni **8.96%** dhidi ya 9.12% iliyorekodiwa [Uhakika].
- **COGS ya siku 90 ni ya kuaminika.**

**Maana yake:**
- Bei halisi ya kuuza iko karibu na **bei ya kreti**, si bei ya kipande. Mfano: CASTLE LITE 1,760/pc ≈ 35,000/20 = 1,750. Kwa hiyo mauzo mengi ni ya jumla (kreti), na faida ni ndogo kwa kila kreti: 2,000 hadi 3,600 kwa bia kuu [Uhakika].
- Bidhaa 6 za bia (CASTLE LITE, SAFARI 500ML, SERENGETI LITE, SAFARI, SERENGETI LAGER, KILIMANJARO) zinaleta **~49% ya faida ghafi yote** [Uhakika].
- KONYAGI inaleta 4.3% ya faida kwa vipande 720 tu. Ina faida kubwa kwa kila kreti.

### 6b. Faida ya jumla (siku 90)
| Kipimo | Thamani | Uhakika |
|---|---|---|
| Mauzo (STANDARD, bila yaliyofutwa) | 99,195,850 | [Uhakika] |
| COGS iliyorekodiwa | 90,146,504 | [Uhakika] |
| **Faida ghafi** | **9,049,346 = 9.12%** | [Uhakika] |
| Faida ghafi kwa siku | ~100,500 | [Uhakika] |
| Mauzo kwa siku | ~1,102,000 | [Uhakika] |
| Gharama za uendeshaji (DAILY 1,953,800 approved + 172,000 pending + MONTHLY 878,000) | ~3,003,800 (~33k kwa siku) | (Inawezekana) |
| Faida baada ya gharama | ~6.05M = **~6.1%** | (Inawezekana) |
| Upotevu wa counting uliopostiwa (net) + marekebisho ya mkono ADJ (net) | −1.25M + −0.245M | (Inawezekana) |
| **Faida baada ya gharama na upotevu** | ~4.56M = **~4.6%** (~50k kwa siku) | (Inawezekana) |

**Mwenendo wa faida ghafi kwa mwezi** [Uhakika]:

| Mwezi | GM % |
|---|---|
| Feb | 8.70 |
| Mac | 8.76 |
| Apr | 8.82 |
| Mei | 9.85 |
| Jun | 9.52 |
| Jul | 9.56 |
| Ago | 8.95 |
| Sep | 8.80 |

Faida imetulia kati ya 8.7% na 9.9%.

**Jibu kwa imani yako ("~6–7%, ≈100k kwa 1.5M"):**
- **Faida ghafi ni ~9%, si 6–7%.**
- **100k kwa siku ni sahihi, lakini mauzo ni ~1.1M kwa siku, si 1.5M.**
- 6–7% inalingana na faida **baada ya gharama za uendeshaji**.
- Ukitoa pia upotevu wa stock, faida iko **~4.6%**.

---

## Q7. Mwenendo wa stock na mtaji (siku 90)

### 7a. Manunuzi dhidi ya COGS kwa wiki
| Wiki inaanza | Manunuzi | COGS | Tofauti (kwenda stock) |
|---|---|---|---|
| 29/06 (02–05/07) | 4,082,000 | 5,045,049 | −963,049 |
| 06/07 | 8,103,468 | 8,030,434 | +73,035 |
| 13/07 | 7,879,100 | 7,640,517 | +238,583 |
| 20/07 | 4,859,700 | 6,653,699 | −1,793,999 |
| 27/07 | 6,302,900 | 5,485,116 | +817,784 |
| 03/08 | 6,178,300 | 5,425,825 | +752,475 |
| 10/08 | 4,961,300 | 5,045,283 | −83,983 |
| 17/08 | 4,753,500 | 5,367,428 | −613,928 |
| 24/08 | 9,416,000 | 8,839,900 | +576,101 |
| 31/08 | 6,576,300 | 6,890,935 | −314,635 |
| 07/09 | 9,133,150 | 7,207,868 | +1,925,281 |
| 14/09 | 7,485,400 | 8,028,509 | −543,109 |
| 21/09 | 8,539,900 | 8,382,869 | +157,031 |
| 28/09 (28–29) | 2,752,100 | 2,103,072 | +649,028 |
| **Jumla** | **91,023,119** | **90,146,504** | **+876,614** |
| Wastani kwa siku | 1,011,368 | 1,001,628 | +9,740 |

- Manunuzi na COGS **zinalingana karibu kabisa** [Uhakika]. Duka linanunua kiasi kilekile linachouza, na hivi ndivyo mfumo wa "kununua kila siku" unavyoonekana.

### 7b. Thamani ya stock kwa nyakati tofauti
Imepimwa kama salio la `store.stock_after` × `current_average_cost`:

| Mwisho wa siku | Vipande | Thamani |
|---|---|---|
| 01/06 | 2,434 | 5,802,184 |
| **01/07 (mwanzo)** | 3,029 | **6,893,785** |
| 01/08 | 1,836 | 4,853,919 |
| 01/09 | 1,638 | 4,699,936 |
| **29/09 (mwisho)** | 2,130 | **5,654,141** |
| `products.current_stock` leo | 1,972 | 5,335,206 |

**Maana yake:**
- Thamani ya stock **imeshuka** kutoka ~6.89M hadi ~5.65M, yaani **−1.24M (−18%)** ndani ya kipindi (Inawezekana).
- Imeshuka ingawa manunuzi yalizidi COGS kwa +0.88M. Maelezo:

  | Kipengele | Kiasi | Uhakika |
  |---|---|---|
  | Manunuzi − COGS | +0.88M | [Uhakika] |
  | Counting adjustments zilizopostiwa (net −896 pcs) | −1.25M | [Uhakika] |
  | Marekebisho ya mkono `ADJ-*` (net) | −0.245M | [Uhakika] |
  | **Salio lisilo na maelezo** | **~−0.62M** | (Inawezekana) |

- Salio lisilo na maelezo linaweza kutokana na:
  - Stock ya 01/07 kupimwa kwa gharama ya leo.
  - Tofauti ndogo kati ya movements za SALE za `store` na `sales_details` (~300 pcs).
  - Mauzo yaliyofutwa (reversal 3,355 pcs).
- **Stock inatosha kwa siku ~5.6 tu** (5.65M ÷ ~1.0M COGS kwa siku) (Inawezekana).
- Madeni yanayodaiwa (1.90M) ni sawa na ~⅓ ya thamani ya stock hiyo.

---

## Q8. Ubora wa data kwa ajili ya ordering

### 8a. Vikao vya counting
- Counting inafanyika **kila siku, kwa bidhaa zote** (~132 kati ya 138), kwa njia ya BLIND, asubuhi kati ya saa 8 na 13 [Uhakika].
- Siku 87 (05/07 hadi 29/09) [Uhakika]:
  - **72** zina session iliyo-approved.
  - **13** zina session iliyofungwa kwa nguvu (FORCE_CLOSED) tu.
  - **1** haina session kabisa: **22/07**.
  - 30/09 bado iko PENDING_APPROVAL.
- **Siku zisizo na counting iliyo-approved** [Uhakika]:

  | Tarehe | Hali |
  |---|---|
  | 05/07 | FORCE_CLOSED × 3 (SIGHTED) |
  | 06/07 | FORCE_CLOSED |
  | 13/07 | FORCE_CLOSED |
  | **22/07** | **hakuna session** |
  | 28/07 | FORCE_CLOSED |
  | 29/07 | FORCE_CLOSED |
  | 02/08 | FORCE_CLOSED |
  | 03/08 | FORCE_CLOSED |
  | 16/08 | FORCE_CLOSED |
  | 28/08 | FORCE_CLOSED |
  | 03/09 | FORCE_CLOSED |
  | 05/09 | FORCE_CLOSED |
  | 25/09 | FORCE_CLOSED |
  | 27/09 | FORCE_CLOSED |

- Session za FORCE_CLOSED za Agosti zilikuwa na tofauti za +1.78M. Hizi hazikuwahi kupostiwa [Uhakika].

### 8b. Tofauti zilizo-approved: zilizopostiwa dhidi ya zisizopostiwa
| Hali | Lines | Vipande net | Thamani |
|---|---|---|---|
| Zilizopostiwa kwenda `stock_adjustment` | 266 | −896 | −1,231,867 |
| **Hazikupostiwa** (hakuna `cashier_reason` wala `explained_at`) | **497** | **+2,946** | **+2.72M** |
| Hazikupostiwa, lakini zina sababu | 11 | −97 | −124,634 |
| Kati ya zisizopostiwa: pungufu | 367 | −4,403 | |
| Kati ya zisizopostiwa: ziada | 141 | +7,252 | |

- Tarehe za tofauti zisizopostiwa: 2026-07-07 hadi 2026-09-29 [Uhakika].
- Tofauti zisizopostiwa hazirekebishwi kwenye mfumo. Kwa hiyo **salio la mfumo linabaki na kosa lilelile**, na tofauti hiyohiyo **inajirudia kila siku**. Mfano: GILBEYS KUPIMA ilionekana na upungufu siku 67 kati ya 73 (Inawezekana).

### 8c. Kwa bidhaa: kiasi na ukubwa wa tofauti (counts 73 zilizo-approved kwa kila bidhaa)
**Maelezo ya safu:**
- **Kupotea % ya mauzo** = vipande vilivyopungua ÷ vipande vilivyouzwa ndani ya siku 90.
- **Wastani |tofauti|** = ukubwa wa wastani wa tofauti (bila kujali + au −), kwa vipande.

| Bidhaa | % ya counts zenye tofauti | Pungufu / ziada (idadi) | Wastani \|tofauti\| (pcs) | Pungufu pcs | Ziada pcs | Hazikupostiwa (lines / net pcs) | Zilizouzwa siku 90 | Kupotea % ya mauzo | **Uaminifu** |
|---|---|---|---|---|---|---|---|---|---|
| GILBEYS KUPIMA | **92%** | 67 / 0 | 9.0 | −603 | 0 | 67 / −603 | 1 | – | ❌ |
| GOLDEN KING KUPIMA | **89%** | 65 / 0 | 8.8 | −573 | 0 | 65 / −573 | 0 | – | ❌ |
| WINE ZA KUPIMA | **88%** | 60 / 4 | 1.4 | −74 | 15 | 64 / −59 | 3 | – | ❌ |
| KONYAGI YA KUPIMA | 55% | 38 / 2 | 4.3 | −168 | 5 | 40 / −163 | 30 | 560% | ❌ |
| Moon Light Kupima | 49% | 31 / 5 | 7.7 | −272 | 5 | 36 / −267 | 1 | – | ❌ |
| COCA && FANTA | 45% | 25 / 8 | **113.8** | −1,916 | 1,841 | 14 / +248 | 4,339 | 44% | ❌ |
| PEPSI && MIRINDA | 42% | 22 / 9 | **119.5** | −409 | 3,294 | 12 / +2,725 | 6,897 | 6% | ⚠️ |
| SERENGETI LITE | 41% | 16 / 14 | 6.4 | −43 | 148 | 12 / +136 | 5,321 | 0.8% | ✅ |
| SAFARI LAGER | 40% | 20 / 9 | 11.2 | −252 | 73 | 10 / −142 | 6,607 | 3.8% | ✅ |
| TZEE lemon && Ginger 200 | 32% | 17 / 6 | 8.8 | −53 | 150 | 21 / +98 | 141 | 38% | ❌ |
| CASTLE LITE | 30% | 18 / 4 | 17.5 | −218 | 168 | 6 / +145 | 8,216 | 2.7% | ✅ |
| SERENGETI LAGER | 30% | 21 / 1 | 10.6 | −155 | 78 | 7 / −9 | 4,756 | 3.3% | ✅ |
| SAFARI LAGER 500ML | 27% | 8 / 12 | 11.0 | −72 | 147 | 10 / +103 | 5,630 | 1.3% | ✅ |
| KILIMANJARO | 21% | 7 / 8 | 9.0 | −66 | 69 | 4 / +11 | 3,817 | 1.7% | ✅ |
| AFYA | 19% | 10 / 4 | 2.9 | −26 | 15 | 4 / +5 | 542 | 4.8% | ⚠️ |
| FLY FISH LEMON 330ML | 18% | 5 / 8 | 5.8 | −64 | 11 | 7 / −56 | 737 | 8.7% | ⚠️ |
| SERENGETI LEMON | 16% | 8 / 4 | 3.0 | −32 | 4 | 5 / −2 | 2,426 | 1.3% | ✅ |
| AFYA MAJI 600ML | 16% | 11 / 1 | 4.5 | −47 | 7 | 2 / −5 | 817 | 5.8% | ⚠️ |
| SERENGETI LAGER kb | 15% | 7 / 4 | 6.7 | −69 | 5 | 5 / −35 | 1,445 | 4.8% | ⚠️ |
| KILIMANJARO LAGER | 14% | 5 / 5 | 11.7 | −60 | 57 | 6 / +14 | 880 | 6.8% | ⚠️ |
| KILIMANJARO LIGHT 330ML | 14% | 3 / 7 | 64.5 | −6 | 639 | 6 / +638 | 110 | 5.5% | ❌ |
| REDS CAN 330ML | 12% | 6 / 3 | 6.1 | −47 | 8 | 4 / −23 | 148 | **32%** | ❌ |
| SAVANA 330ML | 12% | 6 / 3 | 4.4 | −32 | 8 | 4 / −23 | 112 | **29%** | ❌ |
| Castle Lite Can 330ML | 11% | 5 / 3 | 5.1 | −13 | 28 | 2 / +26 | 1,023 | 1.3% | ✅ |
| MO ENERGY | 11% | 7 / 1 | 5.1 | −29 | 12 | 2 / −9 | 150 | 19% | ❌ |
| COCA & FANTA AWAY | 10% | 6 / 1 | 33.9 | −37 | 200 | 1 / +200 | 290 | 13% | ⚠️ |
| KONYAGI | 7% | 4 / 1 | 1.2 | −4 | 2 | 1 / +2 | 720 | 0.6% | ✅ |
| PEPSI TAKE AWAY | 5% | 2 / 2 | 35.3 | −139 | 2 | 2 / +2 | 252 | **55%** | ❌ |
| CASTLE LAGER | 5% | 3 / 1 | 24.3 | −95 | 2 | 4 / −93 | 78 | **122%** | ❌ |
| Safari Lager Can | 5% | 2 / 2 | 139.3 | −3 | 554 | 1 / +552 | 25 | – | ❌ |

(Orodha kamili ya bidhaa 40 iko kwenye Q8.1 ndani ya `v3_queries.sql`.)

### 8d. Tathmini yangu: je, salio la stock linaweza kuendesha ordering ya moja kwa moja?

**Kwa bidhaa kuu za bia: NDIYO, kwa tahadhari** (Inawezekana).
- Bidhaa: CASTLE LITE, SAFARI LAGER, SAFARI 500ML, SERENGETI LITE, SERENGETI LAGER, KILIMANJARO, SERENGETI LEMON, Castle Lite Can, KONYAGI.
- Upotevu ni 0.6–3.8% ya mauzo.
- Tofauti za kila siku ni ndogo ukilinganisha na mauzo ya siku (≈ nusu kreti).
- Counting ya kila siku inarekebisha salio haraka. Hizi ni ~60% ya faida ghafi.

**SIYO ya kuaminika** (Inawezekana):
1. **Bidhaa zote za "KUPIMA"** (GILBEYS, GOLDEN KING, WINE, KONYAGI YA KUPIMA, Moon Light):
   - Zina upungufu karibu kila count, na **hakuna mauzo yanayorekodiwa kwa vipande**.
   - Stock ya mfumo haina maana kwa bidhaa zinazouzwa kwa kipimo.
2. **Soda za kreti** (COCA && FANTA, PEPSI && MIRINDA):
   - Tofauti ni ±114–120 pcs (~5 kreti) kwa count.
   - Kuna ziada kubwa zisizopostiwa (PEPSI +2,725). Hii inaelekea kuwa ni kosa la kuhesabu kreti au muda wa kuingiza manunuzi (Kubahatisha).
   - Salio lao linaweza kuwa na kosa la kreti kadhaa.
3. **Bidhaa ndogo zenye upotevu mkubwa:** REDS CAN, SAVANA, MO ENERGY, TZEE lemon&Ginger, PEPSI TAKE AWAY, CASTLE LAGER, KILIMANJARO LIGHT 330ML, Safari Lager Can.
   - Upotevu ni 19% hadi >100% ya mauzo, au kuna ziada kubwa zisizoelezwa.
4. **Bidhaa za "kununua kwa oda":** SINGSUNG MAJI, AFYA, AFYA MAJI, COCA & FANTA AWAY.
   - Salio mara nyingi ni 0 kwa makusudi.
   - **Mauzo hayaonyeshi mahitaji halisi**, kwa hiyo utabiri wa mahitaji hauwezekani kwa data iliyopo.
5. **Kwa bidhaa zote:**
   - Tofauti 497 zisizopostiwa (+2.72M) zinamaanisha salio la mfumo linaweza kuwa **chini** ya stock halisi kwa soda, na **juu** kwa bidhaa za KUPIMA (Inawezekana).
   - Pia siku 14 ndani ya siku 87 hazina counting iliyo-approved [Uhakika].

---

## Dhana zote nilizotumia (kwa ufupi)
1. Tarehe ya mauzo = `sales.sale_date::date`. Mauzo mengi yanaingizwa usiku (saa 20–23) au saa 00:00 kwa mkupuo. Nimechukulia kuwa tarehe hiyo ndiyo siku halisi ya biashara.
2. Tarehe ya makusanyo ya deni la POS = tarehe ya reconciliation iliyotangaza pesa hiyo. Kwa walk-in = `paid_at` ya ledger, au `payment_date` ya mwisho kama hakuna rekodi nyingine.
3. Salio la deni la kweli = `payments.outstanding_balance`, likiwa na kikomo cha thamani ya deni. `sales.outstanding_balance` si sahihi kwa walk-in.
4. Madeni ya walk-in ni **madeni halisi**, lakini **si mauzo mapya**.
5. Gharama za uendeshaji = `capital_expenditure` isiyo ya manunuzi ya bidhaa (DAILY + MONTHLY, approved + pending). Recon expenses zimehesabiwa mara moja tu, kupitia nakala zake.
6. Thamani ya stock = vipande × `products.current_average_cost` ya leo. Kwa tarehe za zamani, hii ni makadirio.
7. Stockout = salio la `store.stock_after` kufikia 0 au count ya 0. Mpangilio wa movements ndani ya siku unaweza kuongeza siku chache za "0 ya muda".
8. Factors za tarehe na siku ya wiki zimepimwa ndani ya kila mwezi (f_mwezi). Hii inaondoa ukuaji wa mauzo kutoka 21M (Feb) hadi 35–38M (Jun–Sep).
9. Data ya madeni kabla ya 13/06/2026 **haipo**. Maswali ya "miezi 12" yanajibiwa kwa miezi 4 tu.
