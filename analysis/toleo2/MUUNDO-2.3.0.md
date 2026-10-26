# MUUNDO wa 2.3.0: moduli ya mikopo (muundo tu, hakuna code)

26/10/2026. **Hali (26/10 d): umekamilika kwa maamuzi ya mmiliki** (M-10 … M-18 yamejibiwa, §9). Kipaumbele ni cha **baada ya** A (56), B (55) na C (staging 2.2.72). **Code haianzi mpaka 2.2.72 iwe imepita staging.**

**Vyanzo vya ukweli:**
- Code: backend main `d2298fb`.
- Namba za mikopo zinatoka `lsms_audit_20261015_0200` (mkopo-athari.md, 19/10) na log za prod za 22/10 (46b: `check LOANS: GL 2,386,000`).
- Hatua **58** (KUSOMA TU, imeandaliwa, haijaendeshwa) itathibitisha journal halisi za leo kabla ya marekebisho yoyote (§0.4).

---

## 0. Hatua 0: mikopo ilivyosajiliwa (majibu)

### 0.1 Code (file:line, backend `d2298fb`)

| Kazi | Mahali | Inachofanya leo |
|---|---|---|
| Kusajili mkopo | `CapitalMonitoringService.java:158` → `PostingEngine.java:750` `postCapitalInjection` | Dr `payingAccount(payment_method)` / Cr **2100**, kiasi kizima, tarehe ya mkopo. **Hakuna riba**, hakuna 1150. |
| Kurekebisha mkopo | `CapitalMonitoringService.java:491` `updateLoan`, reversal `:552` | `reverseActiveByReference(uid)` **bila tarehe**, kwa hiyo reversal inaandikwa **tarehe ya leo**. Kisha journal mpya inaandikwa kwa tarehe ya mkopo. Ndiyo sababu ya reversal ya 11/10 (aina ya H-5). |
| Kulipa | `CapitalMonitoringService.java:419` `recordLoanRepayment` → `PostingEngine.java:985` `postLoanRepayment` | Dr 2100 (principal) + **Dr 6600 (riba siku ya malipo)** / Cr chanzo. Hii inapingana na kanuni mpya: riba inapaswa kugawanywa kila siku. |
| Kubadili mkopo kuwa mtaji | `CapitalMonitoringService.java:606` → `PostingEngine.java:1000` | Dr 2100 / Cr 3000, tarehe ya leo. |
| Endpoints | `CapitalMonitoringController.java:157–240` | GET `/loans`, GET `/loans/{uid}` (CAPITAL_READ); PUT `/loans/{uid}`, POST `/loans/{uid}/repay` na `/reclassify` (CAPITAL_WRITE). |
| Backfill | `GlBackfillService.java:239, 273, 277` | Inarudia `postLoanPayment` / `postLoanRepayment` / `postCapitalInjection`. |
| Salio la mikopo | `GlReconciliationService.java:227` `loansOutstanding()` | Ndiyo chanzo cha "check LOANS" ya 46b. |
| Daily P&L | `Reports/Service/DailyPnlService.java:69` | Inasoma **majedwali ya biashara**: `sales_details`, `reconciliation_expenses`, `capital_expenditure`, `stock_adjustment`, `store`. **Haisomi GL**, kwa hiyo riba (6600) haionekani kabisa. |

### 0.2 Journal za mikopo

Hali ya 15/10. Hatua 58 itathibitisha hali ya leo.

**Mkopo A**: `capital_injections` id 5, `INJ-0c98b69e-67de-4e66-98c3-8bf6ace52637`, NMB, `amount` = 1,186,000.

| # | entry_date | Ilipostiwa | Dr | Cr | Kiasi | Hali |
|---|---|---|---|---|---|---|
| J1 | 04/10 | 04/10 15:21 (Paul) | 1021 NMB | 2100 | 1,000,000 | imereversiwa na J2 |
| J2 | **11/10** | 11/10 14:59 | 2100 | 1021 NMB | 1,000,000 | reversal ya J1 (tarehe ya leo, `updateLoan`) |
| J3 | 04/10 | 11/10 14:59 | 1021 NMB | 2100 | **1,186,000** | hai |

**Mkopo B**: id 6, 1,200,000, CASH. Ulisajiliwa 13/10 21:46 na Jess, kwa tarehe 26/09.

| # | entry_date | Dr | Cr | Kiasi | Hali |
|---|---|---|---|---|---|
| J4 | 26/09 (Septemba, **IMEFUNGWA** tangu 22/10) | 1000 | 2100 | 1,200,000 | hai. Inasawazishwa na manunuzi ya Cr 1000 ya siku hizo (M-2, mmiliki 19/10). |

**Malipo:** hakuna hata moja hadi 14/10 (`LOAN_REPAYMENT` 0, Dr 2100 0, 6600 = 0).

**Salio:**
- 2100 = 1,186,000 + 1,200,000 = **2,386,000**. Inalingana na `check LOANS` ya 46b (22/10): GL 2,386,000 = kumbukumbu 2,386,000.
- 1021 NMB = 1,186,000 (salio la mkopo A peke yake, kwa tarehe 15/10).
- 6600 = 0.

### 0.3 Tofauti ya 28,000, na kinachopaswa kujua kabla ya kurekebisha

**Lengo kwa kanuni ya §2:** Mkopo A = **Dr 1021 1,000,000 + Dr 1150 158,000 / Cr 2100 1,158,000** (04/10).

**Kilichoandikwa (J3):** Dr 1021 **1,186,000** / Cr 2100 **1,186,000**.

| Akaunti | Sasa | Lengo | Tofauti |
|---|---|---|---|
| 2100 Mikopo | 1,186,000 Cr | 1,158,000 Cr | **−28,000** (2,386,000 → **2,358,000**) |
| 1021 NMB | 1,186,000 Dr | 1,000,000 Dr | **−186,000** |
| 1150 Riba iliyolipwa mapema | haipo | 158,000 Dr (kabla ya kugawanywa) | **+158,000** |

**Muhimu:** tofauti si 28,000 kwenye 2100 peke yake.
- NMB ya GL imezidi **186,000**: benki ilipokea 1,000,000, si 1,186,000.
- Marekebisho yanapunguza 1021 kwa 186,000.
- Benki haifuatiliwi kwenye GL kabla ya tarehe ya kukata D (uamuzi wa 19/10). Hata hivyo, NMB ya GL inakuwa sahihi zaidi, si chini.

### 0.4 Marekebisho ya A: UAMUZI WA MMILIKI (26/10 c)

**Kilichoamuliwa:**
1. Journal ndani ya Oktoba: **Dr 2100 28,000 + Dr 1150 158,000 / Cr 1021 186,000**.
2. Kisha riba ya kufidia kuanzia 04/10 hadi siku ya kuwasha 2.3.0, kila siku kwa tarehe yake.
3. 2100 inabaki = **jumla ya mkataba** (1,158,000 kwa A).

**Utekelezaji unaopendekezwa:**
- **Tarehe ya journal:** 04/10, yaani tarehe ya mkopo. Hivyo vitabu vya kila siku ya Oktoba tangu mkopo vinakuwa sahihi. Tarehe nyingine ya Oktoba inawezekana (swali M-18, §9).
- **Inahitaji 2.3.0 kwanza:** akaunti 1150 inaundwa na migration ya 2.3.0.
- **Endpoint maalum ya 2.3.0:** `POST /loans/{uid}/corrections` (FINANCE_WRITE, kuna `dryRun`).
  - Inaandika journal hiyo kwa `reference_uid` = `<loanUid>:MAREKEBISHO-<n>`. Kadi na ripoti zinasoma GL ya mkopo kwa **prefix ya uid ya mkopo**, kwa hiyo bado ni chanzo kimoja (funzo la H-3).
  - Inasasisha rekodi id 5: `amount` 1,158,000, `principal_amount` 1,000,000, `interest_total` 158,000, ratiba ya awamu 3, `start_date` 04/10, `end_date` 04/01/2027. **Hakuna journal nyingine.**
  - Inakataa kama kipindi cha tarehe ya journal kimefungwa (kanuni ya 2.2.72), au kama marekebisho yenye uid hiyo tayari yapo (idempotent).
- **Riba ya kufidia:** inaandikwa na kazi ya riba (§2.3), `LOANINT:<uid>:<siku>` kwa kila siku kuanzia 04/10 hadi siku ya kuwasha. Hadi 26/10 ni 23 × 1,717.39 = 39,499.97.
- **Matokeo:** 2100 = **2,358,000**; 1021 −186,000; 1150 = 158,000 − riba iliyogawanywa; 6600 = riba hiyo.
- **Staging kwanza** (kanuni ya migration-via-staging), kisha prod kwa hatua za mmiliki.

<details><summary>Njia zilizopendekezwa awali (kwa kumbukumbu tu)</summary>

Akaunti 1150 haipo leo, kwa hiyo marekebisho yoyote yanahitaji migration ya 2.3.0 kwanza. Njia mbili zilipendekezwa awali:

**N1: `updateLoan` mpya ya 2.3.0 (inayopendekezwa).** Hatua za staging, kisha prod, kupitia API:

1. Tumia `PUT /loans/INJ-0c98b69e…`. Sehemu mpya:
   - principal 1,000,000; riba 158,000;
   - tarehe ya kuanza 04/10; tarehe ya kuisha 04/01/2027;
   - malipo MONTHLY 386,000 × 3 (04/11, 04/12, 04/01);
   - akaunti ya kupokelea 1021.
2. Backend inafanya yafuatayo, ndani ya transaction moja na yote kwa tarehe ya mkopo (Oktoba iko wazi):
   - reversal ya J3 **tarehe 04/10**, si ya leo;
   - journal mpya ya usajili: Dr 1021 1,000,000 + Dr 1150 158,000 / Cr 2100 1,158,000;
   - riba ya kufidia kutoka 04/10 hadi leo (§2.3), kila siku kwa tarehe yake. Hadi 26/10 ni siku 23 × 1,717.39 = **39,499.97**.
3. Rekodi `capital_injections` id 5 inakuwa `amount` 1,158,000 (jumla) = `principal_amount` 1,000,000 + `interest_total` 158,000. Rekodi na GL zinabaki moja kwa moja: kadi, ripoti na GL zinasoma rekodi ileile.
4. J1/J2 (siku 04/10–10/10 zenye NMB +1,000,000) **zinaachwa**, kwa uamuzi wa M-3 wa 19/10.

**N2: journal moja ya mkono (njia ya maelezo ya mmiliki).**
- Tarehe 04/10: **Dr 2100 28,000 + Dr 1150 158,000 / Cr 1021 186,000**, memo "M-1: mkopo A 1,186,000 → 1,158,000; riba iende 1150".
- Kisha rekodi id 5 inarekebishwa bila journal mpya (sehemu mpya za V136 zinajazwa kwa script ya hatua).
- **Hasara:** GL ya mkopo A inakuwa na journal mbili zenye reference tofauti. Kadi na ripoti zitalazimika kuzijumlisha, kinyume na funzo la H-3 ("rekodi moja ndiyo chanzo").

Njia zote mbili zinatoa matokeo yaleyale: **2100 = 2,358,000**, 1021 −186,000, 1150 = 158,000 − riba iliyogawanywa.

</details>

**Mkopo B:** hauguswi. Hauna riba, kwa hiyo hauna 1150 wala 6600, na J4 iko Septemba (IMEFUNGWA). Rekodi yake inapata tu sehemu mpya (tarehe ya kuisha 28/11, ONCE, riba 0, hakuna journal). Hiyo inafanyika kupitia sehemu ya "notes/terms only" ya `updateLoan`, ambayo haiandiki journal.

---

## 1. Ukweli wa mikopo (mmiliki 26/10)

| | Mkopo A | Mkopo B |
|---|---|---|
| Tarehe | 04/10/2026 | 26/09/2026 |
| Principal | 1,000,000 | 1,200,000 |
| Riba | 158,000 | 0 |
| Jumla inayodaiwa | 1,158,000 | 1,200,000 |
| Malipo | 386,000 × 3: 04/11/2026, 04/12/2026, 04/01/2027 | 1,200,000 mara moja, 28/11/2026 |
| Pesa ilienda | benki (NMB 1021) | moja kwa moja kwenye mzigo (imesajiliwa Dr 1000, M-2) |
| Siku za mkopo | 92 (04/10 → 04/01) | 63 (26/09 → 28/11) |

- Malipo yanafanywa na CEO kutoka benki kupitia Capital, si reco.
- Kukusanya pesa ya kulipa ni nje ya mfumo (haijengwi).

## 2. Kanuni ya uhasibu (UAMUZI wa mmiliki, haubadilishwi)

### 2.1 Usajili

**Dr akaunti ya kupokelea** (1021/1000 benki au droo, au **1200** kwa mkopo unaoenda moja kwa moja kwenye mzigo) principal **+ Dr 1150** riba / **Cr 2100** jumla.

- Mkopo usio na riba hauna mstari wa 1150.
- Journal moja kwa kila mkopo, `reference_uid` = uid ya mkopo, tarehe = tarehe ya mkopo.
- Ikiwa tarehe iko kwenye kipindi kilichofungwa, kanuni ya §1.9 inatumika: inaandikwa siku ya kwanza iliyo wazi, ikiwa na `event_date` halisi. Mkopo B hauandikwi upya.

### 2.2 Akaunti mpya (migration)

| Akaunti | Jina | Aina |
|---|---|---|
| **1150** | Riba ya mkopo iliyolipwa mapema / Riba ya mkopo isiyogawanywa | ASSET, CURRENT_ASSET (prepaid). Salio = riba ambayo bado haijawa gharama. |

**Uamuzi wa mmiliki (26/10 c):**
- 1150 inatumika; 2100 = jumla ya mkataba; 1150 → 6600 kila siku.
- **2110 haitumiki** (inachukua nafasi ya M-4).
- **1025 haimo kwenye 2.3.0**, kwa sababu akiba ni memo (§2.5). Inachukua nafasi ya M-6.

### 2.3 Riba ya kila siku (mstari ulionyooka)

**M-12 (mmiliki, 26/10 d):** siku ya kuanza inahesabiwa, ya mwisho haihesabiwi.
- Kipindi ni **[tarehe ya kuanza, tarehe ya kuisha)**. Mkopo A ni 04/10/2026 … 04/01/2027: siku 04/10 hadi **03/01/2027** zinahesabiwa, yaani N = **92**. 04/01 (siku ya kuisha / malipo ya mwisho) haina riba.
- Kila siku `d` ya kipindi hicho inaandikwa **Dr 6600 / Cr 1150** kwa `round(riba / N, 2)`.
- **Siku ya mwisho ya riba** (kuisha − 1, kwa A ni 03/01/2027) inabeba salio la kujumlisha: `riba − (N − 1) × kila_siku`. Kwa hiyo Σ = riba **sawasawa**.
- Mkopo A: 158,000 / 92 = **1,717.39** × 91 = 156,282.49; 03/01/2027 = **1,717.51**; jumla = **158,000.00**.
- `reference_uid` = `LOANINT:<loanUid>:<yyyy-mm-dd>`. Ni idempotent: `PostingEngine` inaruka reference iliyokwisha kupostiwa, kwa hiyo kurudia hakuandiki mara mbili.
- **M-18 (mmiliki):** riba ya kufidia inaandikwa kila siku kuanzia 04/10 hadi siku ya kuwasha 2.3.0, kila journal ikiwa na `event_date` yake halisi.
  - Siku iliyo kwenye kipindi kilicho wazi: `entry_date` = `event_date` = siku hiyo.
  - Siku iliyo kwenye kipindi kilichofungwa (mfano: 2.3.0 ikiwashwa baada ya Oktoba kufungwa): kanuni ya 2.2.72. Scheduler inaandika `gl_posting_failure`; retry inaiandika kama late entry siku ya kwanza iliyo wazi (`entry_date`), ikiwa na `event_date` halisi.
  - Hakuna journal ndani ya kipindi kilichofungwa.
- **Ratiba ya riba haibadiliki** kwa malipo ya mapema wala ya zaidi (M-15, §2.4): riba ni ya mkataba.
- **Mkopo B** una riba 0: hakuna journal ya riba, na Septemba haiguswi. Riba ya A inaanza 04/10, ndani ya Oktoba iliyo wazi.

### 2.4 Malipo

- **Dr 2100 / Cr akaunti ya chanzo**, kiasi kizima cha malipo. 6600 **haiguswi**, kwa sababu riba imeshagawanywa kupitia 1150.
- Malipo yanagawanywa kwa awamu kwa FIFO (awamu ya zamani zaidi kwanza).
- **M-15 (mmiliki):** malipo ya mapema au ya zaidi ya awamu yanapunguza **2100 tu**.
  - Ratiba ya riba (1150 → 6600) **haibadiliki**, kwa sababu riba ni ya mkataba.
  - Malipo hayawezi kuzidi salio la 2100 la mkopo huo, kwa sababu 2100 haiwezi kwenda chini ya sifuri.
  - Punguzo la mkopeshaji linaingizwa kwa marekebisho ya mkono kupitia `POST /loans/{uid}/corrections` (§6).

**Akaunti ya Cr (M-13, mmiliki 26/10 d):**
- **Kabla ya tarehe ya kukata D: Cr 1000**, sawa na uamuzi wa M-7 (19/10) wa malipo ya wasambazaji kutoka benki. **Usitumie 1021 kabla ya D.**
  - Fomu bado inaandika njia halisi ya malipo (mfano NMB) kwenye rekodi (`payment_method`), kwa taarifa.
  - Journal inapata Cr 1000 kwa sababu benki haifuatiliwi kwenye GL kabla ya D.
- **Baada ya D: Cr akaunti halisi ya benki (102x)** iliyochaguliwa wakati wa kulipa. Fomu inaruhusu akaunti za benki 102x tu (si Droo, si 1000).
- **Tarehe ya D** ni mpangilio mmoja wa mfumo: `gl.bank_cutover_date`, ambao bado haujawekwa.
  - Haujawekwa, au tarehe ya malipo < D → Cr 1000.
  - Tarehe ya malipo ≥ D → Cr 102x iliyochaguliwa.
  - Hakuna chaguo la mkono kwenye fomu linalokwepa kanuni hii.
- Kanuni ya 19/10 inabaki: malipo ya mkopo hayahusiani na reco ya siku. Cr 1000 hapa ni akaunti ya GL tu kabla ya D, si droo ya reco.

### 2.5 "Akiba ya mkopo" ni MEMO tu

- **Akiba ya siku** = principal ÷ siku za mkopo:
  - A: 1,000,000 / 92 = **10,869.57**; siku ya mwisho **10,869.13**. Σ = 1,000,000.00.
  - B: 1,200,000 / 63 = **19,047.62**; siku ya mwisho **19,047.56**. Σ = 1,200,000.00.
- Inahesabiwa kutoka ratiba ya mkopo (rekodi moja: `LoanScheduleCalculator`). **Haiandikwi kwenye GL.**
- Inatumika kwenye ripoti ya siku (§3), kadi (§4) na bajeti ya auto-order (§2.10 ya MPANGO: akiba ya siku inapunguzwa kwenye bajeti).

## 3. Ripoti ya faida ya siku na ya mwezi (kutoka GL)

```
  Mauzo (net)                        Σ Cr−Dr 4000, 4010, 4020          (GL)
− Gharama ya bidhaa (COGS)           Σ Dr−Cr 5000, 5100                 (GL)
= FAIDA GHAFI
− Matumizi                           Σ Dr−Cr 6000–6999 isipokuwa 6600  (GL)   [mstari kwa kila akaunti ukibofya]
− Riba ya mikopo                     Σ Dr−Cr 6600                       (GL)
+ Mapato mengine                     Σ Cr−Dr 4900                       (GL)
= FAIDA HALISI
− Akiba ya mkopo: Mkopo A            10,869.57                          (MEMO, ratiba)
− Akiba ya mkopo: Mkopo B            19,047.62                          (MEMO, ratiba)
= INAYOBAKI BAADA YA MKOPO           nyekundu ikiwa < 0
```

- **Endpoint mpya:** `GET /api/v1/reports/gl-pnl?from&to&group=day|month` (PROFIT_REPORT). Inasoma `journal_entry_line` + `journal_entry` (bila `is_deleted`) kwa akaunti hizo, kwa siku.
  - Reversal zinahesabiwa pale zilipo, kwa hiyo GL na ripoti zinalingana kila siku.
- **Siku ya mstari (M-14, mmiliki): `entry_date`** (tarehe ya journal). Kwa hiyo jumla ya ripoti = TB ya kipindi hicho sawasawa.
  - Late entries (`event_date` ≠ `entry_date`) zinaonyeshwa na alama ya `event_date` yao: "imechelewa (tarehe halisi X)". Hazihamishwi.
  - **Miezi iliyofungwa haibadiliki kwenye ripoti**: hakuna journal mpya inayoweza kuwa na `entry_date` ndani yake (kanuni ya 2.2.72), kwa hiyo namba zake ni zilezile kila mara.
- `/reports/daily-pnl` ya sasa (`DailyPnlService.java:69`, majedwali ya biashara) **inabaki** kwa mtiririko wa pesa, madeni na stock. Ripoti mpya ya faida ndiyo "faida ya siku" rasmi.
- Kipimo cha ulinganifu (§6, 23.k) kinalinganisha FAIDA GHAFI ya GL na ya biashara, ili tofauti ya H-6 ionekane badala ya kufichwa.
- Mwezi: `group=month` inajumlisha siku zilezile. Akiba ya mwezi = Σ akiba ya siku za mkopo zilizo ndani ya mwezi huo.

## 4. Kadi ya mkopo kwenye Capital (kama kadi ya assets)

Kwa kila mkopo:

| Sehemu | Chanzo |
|---|---|
| Mkopeshaji, maelezo | rekodi |
| Kiasi (principal), riba, jumla | rekodi |
| Tarehe ya kuanza / kuisha; siku zilizobaki | rekodi + leo |
| Makato ya siku: riba (1,717.39) + akiba (10,869.57) = 12,586.96, **yakionyeshwa kando** | ratiba |
| Riba iliyogawanywa hadi leo / iliyobaki (= salio la 1150 la mkopo huu) | GL (`LOANINT:<uid>:*`) |
| Imelipwa | GL: Σ Dr 2100 ya malipo ya mkopo huu |
| Salio | GL: Cr 2100 ya usajili − Σ Dr 2100 ya malipo |
| Ratiba: awamu, tarehe, kiasi, imelipwa, hali | `loan_installment` (FIFO ya malipo) |

**Hali ya kila awamu:** IMELIPWA, INAKUJA (tarehe > leo), LEO, au **IMECHELEWA** (tarehe < leo na haijalipwa yote). Siku za kuchelewa zinaonyeshwa.

**Hali ya mkopo (M-15):** ACTIVE, kisha **CLOSED** wakati **2100 ya mkopo = 0 NA 1150 ya mkopo = 0**, zote kutoka GL. `closed_at` = siku ya journal iliyokamilisha sharti la pili.
- Mkopo uliolipwa mapema (2100 = 0, lakini riba bado inagawanywa) unaonyeshwa **"IMELIPWA — riba ya mkataba inaendelea hadi <siku ya mwisho ya riba>"**.
- Unafungwa siku ya mwisho ya riba, scheduler ikiandika mstari wa mwisho.
- Mkopo uliofungwa unaonyeshwa kwenye historia.

**Hali ya riba:** ratiba haibadiliki kwa malipo (M-15). **Hakuna** mstari wa "FUNGA" unaoharakisha riba. Punguzo la mkopeshaji = `POST /loans/{uid}/corrections` (mfano: Dr 2100 / Cr 1150 kwa kiasi cha punguzo). Baada ya hapo, ratiba ya siku zilizobaki inagawanya salio jipya la 1150 kwa siku zilizobaki, na siku ya mwisho inabeba salio la kujumlisha.

## 5. Data: zilizopo dhidi ya mpya, migration na namba

**Zilizopo:**
- `capital_injections`: LOAN / LOAN_REPAYMENT; `principal_amount` / `interest_amount` (malipo); `related_loan_uid`; `reclassified_*`.
- `journal_entry`(+line) na `gl_posting_failure` (V134).

**Mpya (migration MOJA):**

| Kitu | Maelezo |
|---|---|
| `capital_injections` + safu | `interest_total NUMERIC(19,2) DEFAULT 0`, `start_date DATE`, `end_date DATE`, `repayment_type VARCHAR(10)` (MONTHLY / ONCE), `receive_account VARCHAR(20)`, `loan_status VARCHAR(10)` (ACTIVE / CLOSED), `closed_at TIMESTAMP`. Kwa mkopo, `amount` = **jumla** (principal + riba) = Cr 2100. `principal_amount` inatumika kwa principal ya mkopo pia. Mikopo ya zamani inajazwa: start = `transaction_date`, interest 0, principal = amount, ACTIVE. |
| `loan_installment` (jedwali jipya) | `id, uid, loan_uid, seq, due_date, amount, paid_amount, status, created_at`; UNIQUE(`loan_uid`, `seq`). |
| `gl_account` 1150 | INSERT ... ON CONFLICT DO NOTHING. |
| `JournalEventType` | `LOAN_INTEREST_ACCRUAL` (code, si migration). |

**Namba ya migration.** Kanuni ya mmiliki ya 26/10 c imeandikwa kwenye `analysis\MATAWI.md`: toleo linalofika prod kwanza linachukua namba inayofuata; migration ambayo haijafika prod inapewa namba mpya wakati wa merge.
- main iko V134. Returns ina **V135 ya muda** kwenye `feature/sales-returns`.
- Mikopo inaandikwa kwenye `feature/mikopo-2.3.0` na faili **`V9xx__Loans_Interest_Schedule.sql`**, yaani namba ya muda.
- Wakati wa merge kwenye main, inapewa `max(main) + 1`: **V135** ikiwa mikopo inafika prod kabla ya returns, au **V136** ikiwa returns imetangulia. Branch nyingine inabadilisha namba yake wakati wa merge yake.
- Majaribio na hatua za staging zinarejelea migration kwa **jina** (`*__Loans_Interest_Schedule.sql`), si kwa namba. Kwa hiyo hazibadiliki namba ikibadilika.
- Prod ina `spring.flyway.out-of-order` = **true** (iko kwenye `application.properties` iliyo gitignored). Namba isiyo na mpangilio ingeendeshwa kimya kimya. Mpango wa kuizima ni hatua tofauti, na uko MATAWI.md.
- `Assert-ReleaseBranch` (2.2.72) inakataa build yenye migration ambayo main haina. Hotfix haiongezi migration.

## 6. Endpoints na ruhusa

| Endpoint | Ruhusa | Kazi |
|---|---|---|
| `POST /api/v1/capital-monitoring/loans` | **FINANCE_WRITE** | Kusajili mkopo kamili (principal, riba, tarehe, ratiba MONTHLY/ONCE, akaunti ya kupokelea au 1200 kwa mzigo). Inaandika usajili + ratiba + riba ya kufidia hadi leo. |
| `PUT /loans/{uid}` | **FINANCE_WRITE** | **Maelezo tu, bila journal:** mkopeshaji, notes, tarehe za awamu zisizobadilisha jumla. Mabadiliko ya kiasi, riba au tarehe ya mkopo **yanakataliwa** hapa na kuelekezwa `/corrections`, kwa sababu ratiba ya riba ni ya mkataba (M-15). |
| `POST /loans/{uid}/corrections` | **FINANCE_WRITE** | Marekebisho ya usajili kwa journal moja yenye mistari iliyotolewa (mfano wa A: Dr 2100 28,000 + Dr 1150 158,000 / Cr 1021 186,000, 04/10), `reference_uid` `<loanUid>:MAREKEBISHO-<n>`, pamoja na masharti mapya ya rekodi (§0.4). `dryRun`; journal lazima isawazike; kipindi kilichofungwa kinakataa; marekebisho yaleyale hayarudiwi. |
| `POST /loans/{uid}/repay` | **FINANCE_WRITE** | Malipo: kiasi, tarehe, njia. Dr 2100 / **Cr 1000 kabla ya D, Cr 102x iliyochaguliwa baada ya D** (M-13); FIFO ya awamu; yanapunguza 2100 tu (M-15); hayazidi salio la 2100; CLOSED wakati 2100 = 0 **na** 1150 = 0. |
| `GET /loans`, `GET /loans/{uid}` | FINANCE_READ au CAPITAL_READ | Kadi (§4). **Executive CEO: kusoma tu** (FINANCE_READ, bila FINANCE_WRITE). |
| `GET /loans/{uid}/schedule` | sawa na juu | Ratiba ya riba ya siku na akiba (kwa ukaguzi). |
| `GET /api/v1/reports/gl-pnl` | PROFIT_REPORT | Ripoti ya §3. |
| Scheduler `LoanInterestScheduler` 00:05 | system | Riba ya leo + siku yoyote iliyokosekana (idempotent), ndani ya `strictClosedPeriods("scheduler: loan interest", true)`. |

Ruhusa za sasa ni CAPITAL_WRITE/READ (`CapitalMonitoringController.java:157–240`). Mmiliki ameagiza **FINANCE_WRITE** kwa kusajili na kulipa. Pendekezo: endpoints za kuandika zinahitaji FINANCE_WRITE (na CAPITAL_WRITE ikibaki, iwe zote mbili).

`/reclassify` inabaki CAPITAL_WRITE + FINANCE_WRITE, na inaandika kwa tarehe ya leo kama ilivyo. Riba ya 1150 inaendelea kwa ratiba yake (M-15): haihamishwi kuwa mtaji, wala haiharakishwi.

## 7. Majaribio

**Unit (yanaongezwa kwenye suite ya 467):**

| # | Jaribio | Matarajio |
|---|---|---|
| 23.a | Ratiba ya riba ya A | Siku 92; 91 × 1,717.39 + 1,717.51 = **158,000.00 sawasawa**; mstari wa mwisho ni 03/01/2027 (M-12). |
| 23.b | Akiba ya siku × siku | A: 91 × 10,869.57 + 10,869.13 = **1,000,000.00**; B: 62 × 19,047.62 + 19,047.56 = **1,200,000.00**. |
| 23.c | Usajili wa A | Dr 1021 1,000,000 + Dr 1150 158,000 / Cr 2100 1,158,000; usawa; ratiba ya awamu 3 × 386,000. |
| 23.d | Mkopo bila riba (B) | Hakuna mstari wa 1150; hakuna journal ya riba. |
| 23.e | Malipo ya kwanza 386,000 (kabla ya D) | Dr 2100 / **Cr 1000**; rekodi ina `payment_method` NMB; 6600 haiguswi; awamu 1 IMELIPWA; 2100 ya mkopo = 772,000. |
| 23.e2 | Malipo baada ya D (`gl.bank_cutover_date` imewekwa, malipo ≥ D) | Cr 102x iliyochaguliwa; kuchagua 1000 au akaunti isiyo 102x kunakataliwa; malipo ya tarehe < D bado ni Cr 1000. |
| 23.f | Malipo matatu | 2100 ya mkopo = 0; malipo ya 4 yanakataliwa. Mkopo unakuwa CLOSED tu baada ya 1150 = 0 (03/01/2027 kwa A); `closed_at` = siku hiyo. |
| 23.g | Malipo yanayozidi salio | Yanakataliwa. |
| 23.h | Kipindi kilichofungwa | Riba ya siku ya mwezi uliofungwa: scheduler inaandika `gl_posting_failure`, si journal; retry inaandika late entry siku ya kwanza iliyo wazi, `event_date` halisi. `/corrections` yenye tarehe ya mwezi uliofungwa inakataliwa. **Hakuna journal ndani ya kipindi kilichofungwa**, na ripoti ya mwezi huo haibadiliki (M-14). |
| 23.i | Idempotency | Scheduler mara mbili kwa siku ileile: journal 1 tu (`LOANINT:<uid>:<siku>`). Kufidia siku 23 mara mbili: 23 tu. |
| 23.j | `PUT` | Maelezo yanabadilika bila journal; kubadilisha kiasi/riba/tarehe kunakataliwa na kuelekezwa `/corrections`. |
| 23.k | Ripoti ya siku = GL | Kwa kila siku: Mauzo, COGS, Matumizi, Riba = Σ ya GL ya akaunti hizo (TB ya siku). FAIDA HALISI = −Σ(4xxx..6xxx). Akiba = memo ya ratiba. |
| 23.l | Inayobaki < 0 | Imewekwa alama nyekundu (`negative = true`). |
| 23.m | Kulipa mapema (2100 = 0 kabla ya kuisha) | Ratiba ya riba **haibadiliki**: scheduler inaendelea 1,717.39 kwa siku hadi 03/01; hali "IMELIPWA — riba inaendelea"; CLOSED siku 1150 = 0. Hakuna `:FUNGA`. |
| 23.m2 | Punguzo la mkopeshaji kupitia `/corrections` (Dr 2100 X / Cr 1150 X) | 2100 na 1150 zinapungua X; riba ya siku zilizobaki = salio jipya la 1150 ÷ siku zilizobaki; siku ya mwisho inabeba salio; Σ riba = 158,000 − X sawasawa. |
| 23.n | Ruhusa | Executive CEO: GET 200, POST/PUT 403; FINANCE_WRITE: POST 200. |
| 23.o | Marekebisho ya A (`/corrections`) | Journal 04/10: Dr 2100 28,000 + Dr 1150 158,000 / Cr 1021 186,000; 2100 ya mkopo = 1,158,000; rekodi principal 1,000,000 / riba 158,000; mara ya pili inakataliwa; dryRun haiandiki. |
| 23.p | Riba ya kufidia baada ya marekebisho (M-18) | Siku 04/10 … siku ya kuwasha, kila journal na `event_date` yake halisi (`entry_date` = siku hiyo ikiwa kipindi kiko wazi); Σ = siku × 1,717.39; 1150 = 158,000 − Σ. |
| 23.q | Ripoti kwa `entry_date` (M-14) | Late entry inaonekana siku ya `entry_date` ikiwa na alama ya `event_date`; jumla ya ripoti ya kipindi = TB. |

**Staging (kama 57d):**
- marekebisho ya A kwa `/corrections` kwenye nakala ya prod: 2100 = 2,358,000; 1021 −186,000; 1150 = 158,000 − riba hadi siku hiyo; 6600 = riba hiyo; TB 0; mizania inalingana;
- ripoti ya siku za 04/10 hadi leo inalingana na GL.

## 8. Mpangilio wa kazi (baada ya kukubaliwa)

**Hali (26/10 d):** MUUNDO umekamilika kwa maamuzi ya mmiliki; M-10 … M-18 yamejibiwa. **CODE HAIANZI mpaka 2.2.72 iwe imepita staging** (57a–d zote `---OK---`).

1. 56 → 55 → 57a–d (A, B, C za asubuhi).
2. Hatua **58** (kusoma tu prod): journal halisi za A/B leo + D2. Namba za §0.2 zinathibitishwa kabla ya code.
3. Maswali yote yamejibiwa (`analysis\toleo2\MAAGIZO-MASWALI.md`).
4. Code kwenye `feature/mikopo-2.3.0` (migration ya namba ya muda, §5), unit 23.a–q, kisha diff kwa mmiliki.
5. Merge: namba ya kudumu ni `max(main) + 1` wakati huo (MATAWI.md).
6. Staging: migration, marekebisho ya A (`/corrections`), majaribio. Kisha prod kwa hatua za mmiliki.

## 9. Maswali kwa mmiliki

**Yote yamejibiwa** (M-10, M-11, M-16, M-17 tarehe 26/10 c; M-12 … M-15 na M-18 tarehe 26/10 d). Orodha na majibu yako kwenye **`analysis/toleo2/MAAGIZO-MASWALI.md`**.
