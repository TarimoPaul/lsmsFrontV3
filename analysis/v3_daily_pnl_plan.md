# Mpango: P&L ya kila siku + faida iliyokusanywa + pesa iliyokwama (KABLA ya code)

**Hali:** mpango tu. Hakuna code iliyoandikwa, na hakuna kilichoandikwa kwenye DB yoyote.
**Chanzo cha namba:** `backups/prod_Lsms_20260930_1026_before_gl.dump`. Ilirejeshwa kwenye container ya muda (read-only), na container imeshafutwa.
**Queries:** `analysis/v3_daily_pnl_queries.sql`.

---

## 1. Uthibitisho: madeni ya walk-in (MANUAL_RETAIL) HAYANA bidhaa

### Schema
`reconciliation_retail_debts`:
- `uid`, `reconciliation_uid` → `daily_reconciliation`
- `debtor_name`, `debtor_phone`, `amount`, `sale_date`
- `sale_uid` → `sales`, `reference_type` (`MANUAL_RETAIL` / NULL = POS)
- `is_paid`, `paid_at`, `notes`, `product_notes`, `due_date`
- `is_verified`, `verified_by` …

Malipo yako `reconciliation_debt_payments` (`debt_uid` → deni). Salio la kweli liko kwenye `payments.outstanding_balance`.

Deni la walk-in linapoandikwa (`ReconciliationService.addRetailDebt`):
- Inaundwa sale ya `sale_source = RECONCILIATION_MANUAL`. `total_amount` = deni, na `total_profit` = 0.
- Bidhaa ni **hiari**, na zinahifadhiwa kama `sales_details.adjust_stock = false` bila gharama. Hazipunguzi stock wala kuongeza mauzo.
- Code inaeleza wazi kwamba deni hili ni **uhamisho wa mauzo ambayo tayari yalirekodiwa** (yaliuzwa POS kama cash). Kwa hiyo mauzo yake na COGS yake **tayari yamo** kwenye mauzo ya STANDARD ya siku hiyo. Halikuunganishwa na sale ya POS ya asili, kwa hiyo hatujui ni bidhaa zipi.

### Ukweli kwenye data
| Aina | Madeni (sales) | Yenye bidhaa | Yenye product_notes | Salio linalodaiwa sasa |
|---|---|---|---|---|
| MANUAL_RETAIL | 213 | **0** | **0** | 1,752,500 (92%) |
| POS (credit) | 203 | 203 (yote) | 0 | 153,000 |

**Hitimisho:** kwa walk-in tutatumia **gross margin % ya mwezi husika**, na UI itaonyesha wazi kuwa ni **makadirio**. Kwa POS tutatumia faida halisi ya mistari ya sale husika.

### Mifano 3 (Septemba; majina na simu zimeondolewa)
| Deni | Kiasi | Tarehe | Sale | Mistari ya bidhaa | Imelipwa | Salio | `is_paid` | Sababu (notes) |
|---|---|---|---|---|---|---|---|---|
| 4236c9e9… | 40,000 | 04/09 | RECONCILIATION_MANUAL, profit 0 | 0 | 0 | 40,000 | false | "MKOPO" |
| 39264125… | 4,000 | 04/09 | RECONCILIATION_MANUAL, profit 0 | 0 | 4,000 (16/09) | 0 | **false** | — |
| 9dda3c8b… | 18,000 | 08/09 | RECONCILIATION_MANUAL, profit 0 | 0 | 18,000 (21/09) | 0 | **false** | — |

Mambo mawili ya kuzingatia:
- **`is_paid` haiaminiki.** Madeni yaliyolipwa kikamilifu bado yanasomeka `false`. Kwa hiyo tutatumia `payments.outstanding_balance` tu.

> ⚠️ **Swali kwako (Q1):** sababu zilizoandikwa ni "MKOPO WA BITHAA" (81), "MKOPO" (64, salio 885,500) na "MKOPO WA BIDHAA". Je, "MKOPO" ni **bidhaa zilizochukuliwa kwa mkopo**, au wakati mwingine ni **pesa taslimu iliyokopeshwa kutoka droo**?
> - Kama ni bidhaa: faida iliyomo ≈ GM% × salio. Hii ndiyo dhana ya mpango huu.
> - Kama ni pesa: hakuna faida ndani yake. Ni pesa tu iliyotoka, na makato ya faida yanakuwa 0.
>
> Kwa Septemba tofauti ni 75,815 tu. Kwa muda mrefu, napendekeza fomu ya deni iwe na chaguo **Bidhaa / Pesa taslimu** (kazi ya baadaye, si sehemu ya toleo hili).

---

## 2. Endpoint mpya (backend)

`GET /api/reports/daily-pnl?from=YYYY-MM-DD&to=YYYY-MM-DD`
- **Ruhusa:** `SALES_ANALYTICS`, si `SALES_READ`. `/profit-loss` ya sasa iko chini ya `SALES_READ`, ambayo mhudumu wa kawaida anayo.
- **Branch:** branch iliyo hai kwenye JWT.
- **Kipindi:** si zaidi ya siku 93.
- **Salio:** `asOf` ni wakati wa kuomba, kwa hiyo "bado deni" ni salio la leo.
- Inasoma jedwali za operesheni, **si GL**. Sababu: GL inapost gharama kwa `transaction_date` ya kuingiza, si siku ya recon wala mwezi uliotengewa (angalia 5c).

### Response
```
{ from, to, asOf, grossMarginPct, walkInMarginEstimated: true,
  days: [ { date, revenue, cogs, grossProfit, dailyExpenses, monthlyExpenses, depreciation,
            stockLoss, netProfit, debtIssuedPos, debtIssuedWalkIn, debtCollected, debtAdjusted,
            stillOwed, stillOwedWalkIn, marginInStillOwed, collectedProfit } ],
  totals: { ...jumla ya safu zote..., arOpening, arClosing, arNow,
            debtNetIncrease, operatingCashFlow },
  warnings: [ ... ] }
```

`warnings` inaonyesha:
- recon ambazo bado si APPROVED;
- dalili za kuhesabu mara mbili (Azam, dereva);
- counting ambazo hazijapostiwa.

### Fomula kwa kila namba (siku `d`, mwezi wake `M`)
| Namba | Fomula | Chanzo |
|---|---|---|
| Mauzo | Σ `sales_details.sub_total` | sale STANDARD, haijafutwa, `sale_date = d` |
| COGS | Σ `sales_details.total_cost` | mistari hiyohiyo |
| Faida ghafi | Mauzo − COGS | |
| GM% ya mwezi | Σ faida ghafi(M) ÷ Σ mauzo(M) | kwa siku zilizopita za mwezi M |
| Gharama za kila siku | Σ `reconciliation_expenses.amount` | kwa **tarehe ya recon**. Nakala ya `capital_expenditure` haitumiki. |
| Gharama za mwezi | (Σ MONTHLY_EXPENSE iliyo approved, si template, ya `allocated_month = M`, **+ safu za `allocated_month = 0` kwa kiasi kamili, bila ÷12**) ÷ siku za mwezi M | kanuni ya `findMonthlyAllocation` |
| Uchakavu | Σ [(gharama − salvage) ÷ `asset_life_months`] ÷ siku za mwezi M | kwa mali approved, zisizouzwa, ndani ya umri wake. Kama `monthly_depreciation` ni NULL, ihesabiwe papo hapo. |
| Upotevu wa stock (uliopostiwa) | Σ `stock_adjustment.adjustment_value` siku ya `approved_at`, **bila** zile zilizodaiwa kwa mfanyakazi (1120) + marekebisho ya mkono `ADJ-*` × gharama ya wastani | Ni chini ya ukweli, kwa sababu counting nyingi hazipostiwi. Itaonyeshwa kwenye warnings. |
| **Faida halisi (Net)** | Faida ghafi − kila siku − mwezi − uchakavu + upotevu (upotevu ni hasi) | |
| Madeni mapya | Σ deni kwa `sale_date = d`, likigawanywa POS / walk-in | `reconciliation_retail_debts`, moja kwa kila sale |
| Makusanyo | malipo ya madeni **siku ya d**: POS kwa siku ya recon (`reconciliation_debt_collections`), walk-in kwa `paid_at` (`reconciliation_debt_payments`), salio lililobaki kwa `payments.payment_date` | ledger ileile ya `v3_queries.sql` Q1, iliyohakikiwa |
| Marekebisho | `debt_adjustment` APPROVED siku ya `approved_at` | hayana pesa |
| **Bado deni** (safu ya kila siku) | Σ `payments.outstanding_balance` ya madeni **yaliyotolewa siku d**, kwa salio la leo | |
| Faida iliyomo kwenye bado deni | POS: Σ salio × (faida ÷ mauzo ya mistari ya sale hiyo). Walk-in: salio × GM% ya mwezi M (**makadirio**). | |
| **Faida iliyokusanywa** | Net − Faida iliyomo kwenye bado deni | |
| **Pesa iliyokwama kwa wadeni** | AR yote ya mwisho wa kipindi (`arClosing`), pamoja na sehemu ya madeni ya kipindi hiki (Σ bado deni) | `arClosing` = Σ madeni mapya − makusanyo − marekebisho, hadi `to`. Hii = `/api/reports/ar` = GL 1100. |
| **Operating cash flow** | Net + Uchakavu − (Madeni mapya − Makusanyo) | angalia maelezo hapa chini |

**Kuhusu Operating cash flow:** ulipendekeza "Net − ongezeko la madeni yote". Napendekeza marekebisho mawili madogo:
1. **Marekebisho ya madeni (`debt_adjustment`) yasihesabiwe kama pesa iliyoingia.** Septemba kulikuwa na marekebisho ya 100,000: deni "lilikatwa kwenye mshahara" wa mfanyakazi. AR ilishuka, lakini hakuna pesa iliyoingia droo. Ukitumia ongezeko la AR moja kwa moja, OCF inapanda kwa 100k zisizokuwepo.
2. **Uchakavu urudishwe**, kwa sababu si pesa iliyotoka mwezi huo.

Pia nitaandika wazi kwenye UI kwamba OCF hii **haijumuishi** mabadiliko ya stock wala madeni ya wasambazaji.

---

## 3. Mfano: Septemba 01–29 (siku 29, backup ya 30/09)

### Kadi kuu (zitaonekana sambamba juu ya ukurasa)
| Kadi | Kiasi | Maelezo |
|---|---|---|
| Faida halisi (Net) | **1,170,827** (≈40.4k kwa siku) | |
| **Faida iliyokusanywa** | **1,095,012** (≈37.8k kwa siku) | = 1,170,827 − 75,815. Kati ya hizo, 75,815 ni makadirio ya walk-in. Kama "MKOPO" ni pesa taslimu: 1,170,827. |
| **Pesa iliyokwama kwa wadeni** | **1,902,500** (AR tarehe 29/09) | Kati ya hizo, 861,500 ni madeni ya Septemba ambayo bado hayajalipwa. 92% ni walk-in. |
| Operating cash flow | **873,220** | = 1,170,827 + 72,393 − (1,336,500 − 966,500) |

### Jinsi Net inavyopatikana
| Kipengele | Kiasi |
|---|---|
| Mauzo | 34,893,000 |
| Faida ghafi (GM 8.80%) | 3,070,697 |
| − Gharama za kila siku (recon) | 783,500 |
| − Gharama za mwezi: 768,833 × 29/30 (pango 200k, TRA 20,833, wafanyakazi 2×150k, dereva 150k, router 70k, Azam 28k) | 743,205 |
| − Uchakavu: 74,889 × 29/30 | 72,393 |
| − Upotevu wa stock uliopostiwa: counting −132,772 + `ADJ-*` −168,000 | 300,772 |
| **= Net** | **1,170,827** |

### Madeni ya Septemba
| Kipengele | Kiasi |
|---|---|
| AR tarehe 01/09 (mwanzo) | 1,632,500 |
| + Madeni mapya: POS 101,000, walk-in 1,235,500 | 1,336,500 |
| − Makusanyo | 966,500 |
| − Marekebisho (makato ya mshahara) | 100,000 |
| **= AR tarehe 29/09** | **1,902,500** ✔ (inalingana na salio la `payments`, 1,905,500 tarehe 30/09 asubuhi, baada ya +3k ya siku hiyo) |

### Safu za kila siku (mfano wa siku chache; jedwali kamili ni Q1 kwenye faili la SQL)
| Siku | Mauzo | Faida ghafi | Gharama za siku | Mwezi + uchakavu | Stock | Net | Madeni mapya | Makusanyo | **Bado deni** | Faida iliyokusanywa |
|---|---|---|---|---|---|---|---|---|---|---|
| 04 | 2,046,500 | 122,001 | 19,000 | 28,124 | −1,067 | 73,810 | 44,000 | 0 | 40,000 | 70,290 |
| 11 | 1,661,000 | 206,046 | 22,500 | 28,124 | 0 | 155,422 | 240,000 | 0 | 0 | 155,422 |
| 13 | 961,500 | 74,010 | 66,000 | 28,124 | −198,233 | −218,346 | 85,000 | 280,000 | 85,000 | −225,827 |
| 21 | 1,131,000 | 102,064 | 21,500 | 28,124 | 0 | 52,440 | 100,000 | 56,000 | 100,000 | 43,639 |
| 25 | 1,396,000 | 127,241 | 15,000 | 28,124 | −1,525 | 82,592 | 96,000 | 0 | 96,000 | 74,144 |

Siku ya 13 inaonyesha −218k kwa sababu marekebisho ya mkono (`ADJ-*`, −168k) yalipostiwa siku hiyo. Ndiyo maana UI itaonyesha upotevu wa stock kama safu yake.

---

## 4. UI (Angular)

Ukurasa: **Reports → Faida ya kila siku**, ukiwa na kichujio cha mwezi au kipindi.

**Kadi 4 juu**, za ukubwa sawa:
- Net;
- **Faida iliyokusanywa**;
- **Pesa iliyokwama kwa wadeni**. Kadi hii ni sawa kwa ukubwa na Faida iliyokusanywa, imekaa kando yake, na ina mgawanyo walk-in/POS na "ya kipindi hiki";
- Operating cash flow.

Kadi au safu yoyote yenye makadirio itakuwa na alama ya **"≈ makadirio"** na tooltip: *"Madeni ya walk-in hayana bidhaa; faida yake imekadiriwa kwa GM ya mwezi (8.8%)."*

**Jedwali la kila siku** lina safu hizi: Mauzo · Faida ghafi · Gharama · Upotevu wa stock · Net · Madeni mapya · Makusanyo · **Bado deni** · Faida iliyokusanywa. Pia kuna mstari wa jumla na CSV export.

Umri wa madeni (0–7 / 8–30 / 31–60 / 60+) hautajengwa sasa. Response imeandaliwa kuuongeza baadaye, kwa sababu `sale_date` ya kila deni ipo.

---

## 5. Toleo MOJA la backend (halitadeploiwa; utalijaribu staging)

| # | Badiliko | Maelezo |
|---|---|---|
| a | **V124**: view `v_profit_loss_statement` isigawe tena kwa 12 safu za `allocated_month = 0` | `/api/reports/profit-loss` haisomi view tena tangu 28/09 (inatumia GL), lakini view bado ipo na inaweza kutumiwa na wengine. Ni marekebisho ya SQL tu. |
| b | **Uchakavu**: `monthly_depreciation` ijazwe kila mali inapoundwa au kubadilishwa (njia zote, si `createAsset` peke yake). V124 ijaze zilizo NULL: `(amount − salvage) / life`. | **Kumbuka:** NULL tuliiona kwenye dump ya **kabla** ya GL rebuild. Rebuild ya 30/09 iliita `updateAllAssetDepreciation`, ambayo inajaza thamani hii, kwa hiyo prod huenda tayari iko sawa. Kwenye staging tuthibitishe kwa `select monthly_depreciation from capital_expenditure where is_asset`. Badiliko hili ni kinga isiyo na madhara. |
| c | Endpoint mpya `GET /api/reports/daily-pnl` | Kama ilivyoelezwa kwenye sehemu 2. Ni ya kusoma tu, na haiandiki kitu. |

> ⚠️ **Swali kwako (Q2), hitilafu kubwa zaidi niliyoikuta:** GL inapost gharama za `allocated_month = 0` (pango 200k, TRA 20,833) **mara moja tu, tarehe 01/01**. P&L ya GL (`/profit-loss`, ambayo Angular inaitumia) **haina pango wala TRA kwa Feb–Des**, kwa hiyo inaonyesha faida kubwa kwa ~220,833 kila mwezi. Kurekebisha kunahitaji kupost journals za miezi iliyokosekana kwenye prod.
>
> Je, iingie kwenye toleo hili, au iwe kazi tofauti? Napendekeza **iwe tofauti**, kwa sababu inagusa GL ya prod. Pia nahitaji ujibu: pango la 2.4M lililipwa lote mara moja, au 200k kila mwezi?

**Majaribio kabla ya kukukabidhi:**
- Unit test za fomula: siku za mwezi, safu ya `allocated_month = 0`, mali isiyo na `monthly_depreciation`.
- Kuendesha endpoint kwenye nakala ya backup. Namba za Septemba lazima zilingane na jedwali la sehemu 3.
- E2E ya ukurasa wa Angular.

---

## 6. Ninachohitaji ili nianze
1. **Q1:** "MKOPO" ni bidhaa au pesa taslimu? Mpango unadhani ni bidhaa.
2. **Q2:** pango kwenye GL: kazi tofauti (napendekeza) au ndani ya toleo hili? Na pango linalipwa vipi?
3. Kubali marekebisho mawili ya OCF: marekebisho ya madeni si pesa, na uchakavu urudishwe.
4. Kubali kuingiza **upotevu wa stock uliopostiwa** kwenye Net. Ukikataa, Net ya Septemba inakuwa 1,471,599.
5. Ruhusa ya ukurasa iwe `SALES_ANALYTICS`.

---

## Nyongeza 2026-10-03: maamuzi yako na Septemba upya

**OCF (fomula uliyoamua):** Net + Uchakavu − (Madeni mapya − Makusanyo) − ΔThamani ya stoki. Stoki inathaminiwa kwa bei ya mwisho ya kununua kufikia siku hiyo.

| | Kiasi |
|---|---|
| Faida halisi (Net), upotevu wa stoki ukiwa mstari wake (300,772) | 1,170,827 |
| + Uchakavu | 72,393 |
| − Madeni mapya (1,336,500) + Makusanyo (966,500) | −370,000 |
| − Ongezeko la stoki: 4,573,049 (31/08) → 5,580,852 (29/09) | −1,007,803 |
| **= Operating cash flow** | **−134,584** |
| Mstari wake: marekebisho ya madeni yasiyo ya pesa (makato ya mshahara) | 100,000 |

**Kuhusu stoki ya 29/09:** mauzo 60 pcs (96,500) ya tarehe 29 yalitoka stoki tarehe 30/09. Mfumo unayarudisha kwenye siku ya mauzo yenyewe.

**Kwa nini OCF ni hasi ingawa kuna faida:** stoki iliongezeka kwa ~1.0M ndani ya Septemba (manunuzi 33.1M dhidi ya COGS 31.8M). Pesa ilienda kwenye mzigo dukani. Madeni ya wasambazaji hayamo kwenye fomula hii.

**Faida iliyokusanywa** = 1,095,004 (endpoint inatumia GM ya mwezi mzima hadi sasa: 8.80%).

**MKOPO:** bado nasubiri jibu lako. Kwa sasa madeni yote ya walk-in yanachukuliwa kuwa bidhaa (makadirio). Kama ni pesa ya droo au mkopo wa mfanyakazi, yatatengwa kama "Mikopo ya wafanyakazi/pesa taslimu". Itahitaji sehemu mpya ya Bidhaa/Pesa kwenye fomu ya deni, au kanuni utakayoitoa.

---

## Nyongeza ya pili 2026-10-03: AR imesahihishwa (MKOPO = bidhaa ✔)

**MKOPO = bidhaa**, kwa hiyo makadirio ya faida ya walk-in yanabaki kama yalivyo.

Salio la madeni sasa linatoka `sales.outstanding_balance` (= ripoti ya AR), si `SUM(payments.outstanding_balance)`. Angalia `v3_is_paid_usage.md`. Namba za Septemba 01–29 zilizosahihishwa:

| | Kabla | **Sasa** |
|---|---|---|
| Faida halisi (Net) | 1,170,827 | **1,170,827** (haibadiliki) |
| Makusanyo ya madeni | 966,500 | **1,262,500** |
| Bado deni (madeni ya Septemba) | 861,500 | **620,500** |
| Faida iliyokusanywa | 1,095,004 | **1,116,215** |
| AR 31/08 → 29/09 | 1,632,500 → 1,902,500 | **1,672,000 → 1,646,000** |
| Walk-in, sehemu ya AR | 92% | **88% (1,455,500)** |
| Operating cash flow | −134,584 | **+161,416** |
