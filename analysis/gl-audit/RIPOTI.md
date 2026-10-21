# Ukaguzi wa GL na Capital — LSMS (Elikom)

Tarehe ya ukaguzi: 2026-10-15. Mkaguzi: Claude (code + SQL, kusoma tu). Hakuna code iliyobadilishwa, hakuna commit, hakuna deploy.

## 0. Juu kabisa

**Nakala iliyokaguliwa ni Flyway toleo 131, si 133.** Mmiliki amelikubali hili (15/10). V132 na V133 zinahusu safe box tu na hazigusi jedwali lolote la GL.

| Kipimo | Matokeo | Query |
|---|---|---|
| Chanzo | `lsms_20261014_0200.dump` (prod, 14/10/2026 02:00). sha256 `fb09666d…b04d0f`: Contabo = B2 = PC | `steps/33-gl-audit-pakua-dump.log` |
| Database | `lsms_audit` kwenye Postgres 17 ya PC (`pg_restore -j 1`). Si dev wala staging | — |
| sales | 2,524 (233 zimefutwa); `max(created_at)` = 2026-10-14 00:24:29.717 | `00-uthibitisho.sql` |
| Flyway | 131 (`Store Loss Columns That V039 Never Added`, 2026-10-11 14:54:54) | `00-uthibitisho.sql` |

**V132/V133 zilipita staging kabla ya prod? NDIYO.** [Certain]

| Migration | Staging | Prod |
|---|---|---|
| V132 | 2026-10-13 13:10:22 | 2026-10-14 14:43:32 |
| V133 | 2026-10-14 13:04:50 | 2026-10-14 14:43:33 |

Ushahidi: `steps/29-safebox-staging-2270.log` mistari 30–34 (staging, `FLYWAY_FAILED_MUST_BE_0 = 0`), `steps/23-safebox-prod-preflight.log` (prod ilikuwa inasubiri V132 na V133 tu), na `steps/25-safebox-prod-thibitisha.log` mistari 16–37 (prod).

**gl_config ya prod** [Certain] (`01-gl-config-vipindi.sql`): `posting_enabled = true`, `shadow_mode = false`, iliwekwa 2026-09-30 10:32:19 na tarimo@gmail.com. Kwa hiyo GL **iko live**. `gl.posting.enabled=false` ya `application-pro.properties:49` ni mbegu tu; jedwali ndilo linalotawala.
- `gl_config` ina safu moja na haina historia, kwa hiyo vipindi vimesomwa kutoka kwenye journals:
  - **kabla ya 2026-06-22:** hakuna journal yoyote (GL haikuwepo);
  - **2026-06-22 21:23 → 2026-09-30 09:37:** injini ya zamani, journals 3,790 (`backup_20260930_journal_entry`, ya kwanza na root@system.com). Zote zilifutwa na kujengwa upya;
  - **2026-09-30 10:26:39 → 10:32:19:** rebuild (backfill) ya journals 4,587;
  - **tangu 2026-09-30 10:32:19:** live. **Hakuna siku hata moja bila journal** (01/10–13/10, wala 22/06–29/09). Hakuna ushahidi kwamba GL iliwahi kuzimwa baada ya kwenda live.
- **Tahadhari:** kila kitu kilichotokea kabla ya 30/09 kimo kwenye GL kama ilivyokuwa **hali ya mwisho ya source docs tarehe 30/09**, si kama matukio yalivyotokea siku kwa siku. Angalia H-4.

## a) Muhtasari

Mizania ya GL ni sahihi kimahesabu (TB 791,952,398.47 pande zote mbili, hakuna journal isiyo balanced, hakuna orphan) na madeni ya wasambazaji, mikopo, wafanyakazi na COGS ya sales zilizopostiwa yanalingana na sub-ledger hadi shilingi. **Hata hivyo ripoti za fedha za LSMS bado hazitegemewi kwa Cash na faida:** kosa la alama (sign) kwenye variance ya kufunga siku limepunguza Cash na kuongeza gharama kwa **TZS 1,593,899.90**. Pia **kila sale yenye deni tangu GL iende live (3 kati ya 3) haijapostiwa**: mapato 412,500, AR −221,000, Inventory +401,499.66. Kodi ya mwaka inapostiwa mara moja tu (gharama pungufu ≈ TZS 1.79M), na salio za kabla ya 30/09 (AR/Cash) si za kihistoria.

## b) Dhana za Awamu 0: zimethibitishwa au zimekanushwa

Kila dai la Awamu 0 limegeuzwa kuwa dhana yenye query inayoweza kulikanusha. T0 = GL live (2026-09-30 10:32:19). Matukio ya kabla ya T0 yamo kwenye rebuild kwa hali yake ya mwisho, kwa hiyo hayaleti drift; ni ya baada ya T0 tu yanayoleta.

| # | Dai la Awamu 0 | Query (inayoweza kulikanusha) | Matokeo | Mara (yote / baada ya T0) | TZS | Ukali |
|---|---|---|---|---|---|---|
| D1 | Kuhariri sale (`updateSale`, `updateSaleDetail`, `removeSaleDetail`) hakugusi GL | `04` §4.1: journal hai ya kila sale dhidi ya `total_amount` na gharama ya mistari yake; §4.1c: mistari iliyoongezwa au kufutwa baadaye | Code: **imethibitishwa** [Certain] `SaleService.java:1838-1925`, hakuna `postingEngine`. Data: **halijatokea**. Journals 2,045 (1,866 backfill + 179 live): mapato yasiyolingana 0, COGS isiyolingana 0, mistari iliyoongezwa baadaye 0, iliyofutwa 0 | 0 / 0 | 0 | LOW |
| D2 | Kuhariri/kufuta malipo (`PaymentService.updatePayment:215`, `deletePayment:291`) hakugusi GL na ndicho chanzo cha AR 1,672,000→1,693,000 | `04` §4.2: `audit_trails` module Payments, `sale_notes` "Payment updated/deactivated", `payments.is_active=false` | Code: imethibitishwa [Certain]. Data: audit 0, notes 0, payment 1 tu isiyo hai (31,000, 21/05, kabla ya T0, imo kwenye rebuild). **Sehemu ya chanzo cha AR imekanushwa:** chanzo halisi ni H-6 | 1 / 0 | 0 drift | LOW |
| D3 | `cancelPurchase` ya purchase iliyoidhinishwa inarudisha stock lakini haigeuzi journal | `04` §4.3: purchases `CANCELLED` zenye `approval_date` au journal hai | Code: imethibitishwa [Certain] `PurchaseService.java:1190-1230`. Data: cancelled 3, zote zilikuwa PENDING, journal hai 0. Purchases zilizopostiwa zote ni `RECEIVED` (2,055), na `cancelPurchase` inakataa `RECEIVED` (`:1199`) | 0 / 0 | 0 | LOW |
| D4 | `restoreDeletedSale` ina `(List<SalesDetails>) detail`, kwa hiyo inashindwa kila mara | `04` §4.5: `sale_notes LIKE '%RESTORED:%'`, `is_active AND is_deleted` | Code: cast iko `SaleService.java:4558`, itatupa ClassCastException ikiwa sale ina mstari ≥1 (likely). Data: 0 restore | 0 / 0 | 0 | LOW |
| D5 | `deleteSale` ya deni la walk-in inageuza `<uid>` tu, si `<uid>:DEBT` | `04` §4.6: sale zilizofutwa zenye journal ya `:DEBT` au ya sale bado hai | **Imekanushwa** [Certain]. 0 kati ya 233. `deleteSale` → `removeDebtsForDeletedSale` (`ReconciliationService.java:4231`) inageuza `:DEBT` (`:1137`) | 0 | 0 | — |
| D6 | Recon ikifunguliwa upya na kuidhinishwa tena, variance inapostiwa upya bila kugeuza ile ya zamani | `04` §4.4, `04b` | **Imethibitishwa** [Certain]. Siku 9 zina DAY_CLOSE_VARIANCE hai mara 2 (zote zilifunguliwa upya 07/10 15:18–15:38) | REOPENED 15 / 13 baada ya T0; nakala 9 | ±16,500 (net 11,300) | MEDIUM → H-5 |
| D7 | Debt adjustment na mkopo→mtaji zinapostiwa `LocalDate.now()` | Code `PostingEngine.java:777, :827`; data `06` §6.5, `05` §5.4 | Code: imethibitishwa [Certain]. Data: debt adjustment 4 zina journal; 2 kati yake (230,500 na 60,000) zilipostiwa na rebuild tarehe 30/09 ingawa ziliidhinishwa 12/08 na 22/09; 2 za baada ya T0 ziliidhinishwa na kupostiwa siku ileile. Mkopo→mtaji: **0** (`reclassified_from` zote NULL) | 4 / 2 | 290,500 zimehamishwa tarehe | LOW |
| D8 | `gl_period` haitumiki | `09` §9.3 | **Imethibitishwa** [Certain]. Safu 0; journals 41 za Septemba ziliingizwa Oktoba (H-7) | — | 1,499,488.89 | MEDIUM |
| D9 | Njia ya gharama si moja | `09` §9.4 | Code: sale mpya `getCostPerPieceStrict` (`SaleService.java:995`). Data: COGS ya GL = gharama ya mistari ya sales zilizopostiwa **hadi shilingi** (235,790,808.19 = 235,790,808.19). Tofauti iko kwenye thamani ya stock (H-8) | — | 0 kwenye COGS | LOW |
| D10 | Makosa ya GL yanamezwa (catch bila rethrow) | `02a`, `04` | **Imethibitishwa na ina athari** [Certain]. Sales 3 zenye deni hazina journal; `SaleService.java:652-662` (async + catch inayoandika log tu) | 3 / 3 | 412,500 | CRITICAL → H-2 |
| D11 | capex APPROVED bila journal | `05`, `05b` | **Imekanushwa** [Certain]. 1,874 bila journal ni mirror za purchase (kila purchase ina PURCHASE_INVENTORY ya kiasi kilekile, tofauti 0); 2 ni template za 0.00; 2 ni mishahara ya Nov/Des ya baadaye (by design) | 0 pengo | 0 | — |

## c) Matokeo (yamepangwa kwa ukali)

### H-1 · CRITICAL · Variance ya kufunga siku inapostiwa kwa alama iliyogeuzwa · TZS 1,593,899.90 · mara 85

- **Ushahidi** [Certain] (`08-day-close-sign.sql`):
  - `DailyReconciliation.java:492-503`: `variance = mauzo − makato − pesa iliyotangazwa`, kwa hiyo **chanya = upungufu**.
  - `PostingEngine.java:781-797`: variance > 0 inapostiwa "Cash over" (Dr 1000 / Cr 6700).
- Mifano:

  | Tarehe | Expected | Declared | Variance | Ukweli | GL ilipostiwa |
  |---|---|---|---|---|---|
  | 10/10 | 391,500 | 420,000 | −28,500 | ziada | Dr 6700 / Cr 1000 "Cash short" |
  | 05/10 | 663,000 | 660,000 | +3,000 | upungufu | Dr 1000 / Cr 6700 "Cash over" |

- Journals hai 85: siku 65 za upungufu (205,850) zimepostiwa kama faida, na siku 20 za ziada (1,002,799.95) zimepostiwa kama hasara.
  - GL 1000 kutoka DAY_CLOSE = **−796,949.95**. Ingepaswa kuwa **+796,949.95**.
  - Kosa = **1,593,899.90**: Cash 1000 iko pungufu, na 6700 "Cash Over Short" iko juu kwa kiasi hicho. Faida halisi kwenye GL imepungua kwa kiasi hicho.
- **Tahadhari:** ziada za siku 20 (1.0M) zenyewe zinaweza kuwa matokeo ya recon (mfano pesa ya madeni kuingia CASH_IN_HAND) (Guessing). Ziangaliwe kabla ya kurekebisha. Kosa la alama lenyewe ni [Certain].
- **Pendekezo (usitekeleze):** geuza masharti ya `postDayCloseVariance` (variance > 0 → Dr 6700 / Cr 1000). Kisha kwa kila DAY_CLOSE_VARIANCE hai: reverse na repost kupitia `reverse()`, au post journal moja ya marekebisho ya 1,593,899.90 (Dr 1000 / Cr 6700) yenye maelezo. Ongeza test inayofunga alama.

### H-2 · CRITICAL · Sales zenye deni hazipostiwi tangu GL live · mara 3 kati ya 3 · mapato 412,500

- **Ushahidi** [Certain] (`02a-sales-bila-journal.sql`, `09` §9.1):

  | Sale | Tarehe | Jumla | Deni |
  |---|---|---|---|
  | 101026-2202 | 10/10 | 54,500 | 41,000 |
  | 121026-2249 | 12/10 | 275,000 | 175,000 (lililipwa 13/10) |
  | 131026-2227 | 13/10 | 83,000 | 5,000 |

  - Zote STANDARD, mteja REGULAR, **hakuna journal kabisa**.
  - Sales 179 za cash za kipindi hicho zimepostiwa zote.
  - Hakuna SALE_CREDIT wala SALE_MIXED hata moja iliyoundwa baada ya T0.
- **Athari:**

  | Kitu | Kiasi |
  |---|---|
  | Mapato 4000 pungufu | 412,500 (+ discount 4010 13,500) |
  | Cash 1000 pungufu (sehemu iliyolipwa) | 191,500 |
  | Inventory 1200 juu (COGS 5000 pungufu) | 401,499.66 |
  | AR 1100 | −221,000 |

  AR −221,000 = 46,000 (deni la sasa la sales hizi) + 175,000. Malipo ya 175,000 ya 121026-2249 (13/10) yalipostiwa Cr AR (`JE-2026-1029440139787630`) bila Dr AR ya awali. Hii inaeleza **tofauti yote ya AR ya 13/10** (GL 1,786,000 dhidi ya sub-ledger 2,007,000).
- **Chanzo:** `SaleService.java:652-662` (na `:926-935`). Posting inafanyika async kwenye `capexExecutor`; `catch (Exception)` inaandika log tu. Mstari wa AR pekee ndio unaogusa `sale.getCustomer().getCustomerType()` (`PostingEngine.java:321-326`), ndiyo maana sales za cash zinapita. Exception kamili haijulikani: log za 10–13/10 hazipo tena kwa sababu container ilibadilishwa 14/10 14:43 (Guessing: LazyInitialization au hali ya entity nje ya session).
  - **Hatua 34** (`steps/34-gl-audit-postsale-log.cmd`, kusoma tu) itakamata kosa lijalo.
- **Pendekezo:**
  - posta sale baada ya commit kwa kusoma upya sale ndani ya transaction yake (`findByUidWithAllRelationships`);
  - kosa la GL liandikwe kwenye jedwali/alert, si log tu;
  - repost sales hizi 3 kwa `/gl` backfill ya sale moja moja; malipo ya 175,000 yatabaki sahihi baada ya sale kupostiwa.

### H-3 · HIGH · Gharama za "mwaka mzima" (kodi ya frame, TRA) zimepostiwa mara moja tu · ≈ TZS 1,787,500

- **Ushahidi** [Certain] kwa rekodi (`05c-kodi-mwaka.sql`). Zote mbili zina `allocated_month = 0`, `MONTHLY`, journal moja tu tarehe 01/01:

  | Rekodi | Jumla ya mwaka | Kwenye GL |
  |---|---|---|
  | `OPE-MON-20260101-…-F7C9E331` "KODI YA FRAME" | 2,400,000 | 200,000 |
  | `…-4B42C8F1` "Kodi TRA" | 250,000 | 20,833.33 |

  - Daily P&L (`DailyPnlCalculator`, kanuni ya 03/10) inazitumia **kila mwezi**; GL inazipost mara moja (`PostingEngine.postExpense:531`).
  - Hadi 13/10 (miezi 10): kodi ya frame inatarajiwa 2,000,000, GL 200,000 (au 400,000 kama `…-2939F6DE` "2400000" ni kodi hiyohiyo). TRA inatarajiwa 208,333, GL 20,833.
  - **Pungufu ≈ 1,800,000 + 187,500** (likely). Inategemea jibu la Q3.
- **Pendekezo:** kwa rekodi za `allocated_month = 0`, GL ipost kila mwezi (kama P&L), au rekodi ya malipo ya mwaka iende Prepaid na ipunguzwe kila mwezi. Amua kwanza (Q3).

### H-4 · HIGH (historia) · Salio za GL za kabla ya 30/09 si za kihistoria kwa AR/Cash

- **Ushahidi** [Certain]:
  - `GlBackfillService.java:140-155`: deni la walk-in limepostiwa kwa **salio lake la 30/09** tu, kwa tarehe ya sale.
  - Madeni yaliyolipwa kabla ya 30/09 hayana entry yoyote, kwa hiyo pesa yake inaonekana kwenye Cash tangu siku ya sale.
- AR ya GL dhidi ya AR ya Daily P&L (nakala ya `DailyPnlCalculator`, `07b-pnl-ar-kwa-tarehe.out`):

  | Tarehe | GL AR | P&L AR | Tofauti |
  |---|---|---|---|
  | 31/07 | 941,500 | 1,684,000 | −742,500 |
  | 31/08 | 1,316,000 | 1,693,000 | −377,000 |
  | 01/09 | 1,316,000 | 1,693,000 | −377,000 |
  | 30/09 | 1,754,000 | 1,775,000 | −21,000 (sale 150826-0000-3, H-6) |
  | 13/10 | 1,786,000 | 2,007,000 | −221,000 (H-2) |

- **Athari:** salio la sasa haliathiriki. Balance sheet ya tarehe za nyuma (Julai/Agosti) inaonyesha AR pungufu na Cash zaidi kwa kiasi hicho (likely kwa kila deni; jumla ni [Certain]).
- **Pendekezo:** ama tangaza 30/09 kuwa "opening date" ya GL (ripoti za GL kabla ya hapo zisitumike), ama rebuild walk-in kwa matukio halisi (reclass kwa kiasi kamili + PAYMENT_RECEIVED kwa kila malipo). Uamuzi ni Q4.

### H-5 · MEDIUM · Recon iliyofunguliwa upya inapostiwa variance mara mbili · mara 9 · net TZS 11,300

- **Ushahidi** [Certain] (`04b-recon-reopen-variance.sql`):
  - recon 9 (13/09, 16/09, 17/09, 18/09, 22/09, 24/09, 29/09, 30/09, 04/10), zote za macheda, zilifunguliwa na kuidhinishwa tena 07/10 15:18–15:38;
  - snapshot v1 na v2 zina journal hai kila moja, kwa variance ileile;
  - ziada mara mbili 13,900, upungufu mara mbili 2,600: **net 11,300** juu ya Cash (pamoja na H-1, alama pia imegeuzwa).
- **Chanzo:**
  - `ReconciliationService.java:1848-1850` inapost snapshot `is_current` mpya (uid mpya);
  - `createFinancialSnapshot` (`:3576-3635`) inaunda toleo jipya bila `reverseActiveByReference` ya toleo la zamani;
  - `reopen` (`:1908`) haigusi GL.
- **Pendekezo:** wakati wa supersede au reopen, reverse DAY_CLOSE_VARIANCE ya snapshot ya zamani. Rekebisha hizi 9 kwa reversal.

### H-6 · MEDIUM · Chanzo cha AR ya 01/09 kubadilika 1,672,000 → 1,693,000 (Daily P&L, si GL)

- **Ushahidi** [Certain] (`06b`, `06c-pnl-ar-opening-0109.sql`):
  - kanuni ya P&L imeigwa kwa SQL na kuendeshwa kwenye dump ya 04/10 (`lsms_audit_1004`) na ya 14/10. Matokeo ni **1,672,000.00** na **1,693,000.00**;
  - tofauti ni 21,000, na **yote** inatoka kwenye sale moja: **150826-0000-3** (walk-in, MABUGA, 32,500, 15/08).
- **Mtiririko:**
  - 17/08: alilipa 21,000 (payment row 1: PARTIAL, outstanding 11,500). Lakini row ya `reconciliation_debt_payments` ina **amount_paid 0.00**, kwa hiyo P&L haina "evidence" ya tarehe.
  - 05/10: alilipa 11,500 kwa row mpya ya `payments` (status PAID, `outstanding_balance` 21,000, si sahihi). `sales.outstanding_balance` ikawa 0.
  - `DailyPnlCalculator.java:304-306`: kiasi kisicho na evidence kinapewa tarehe ya **payment row ya mwisho**. Kwa hiyo 32,500 yote ilihamia 05/10, na AR ya 01/09 ikaongezeka 21,000.
- **Ukweli:** tarehe 01/09 mteja alidaiwa 11,500. **1,672,000 ilikuwa sahihi; 1,693,000 si sahihi.** GL ina 11,500 (sahihi) kwa sale hii.
  - D2 (payment edits) **si** chanzo. Hakuna journal yenye `entry_date ≤ 01/09` iliyoundwa baada ya rebuild inayogusa AR (`06` §6.2–6.3: GL AR ya 01/09 = 1,316,000 kila siku 30/09–14/10).
- **Pendekezo:**
  - `reconciliation_debt_payments.amount_paid` iandikwe kiasi halisi;
  - P&L igawanye kiasi kisicho na evidence kwa tarehe na kiasi cha kila payment row (si row ya mwisho);
  - rekebisha row ya 0.00 ya sale hii.

### H-7 · MEDIUM · Hakuna kufunga kipindi; journals zinaingia miezi iliyopita · 41 za Septemba ziliingizwa Oktoba

- **Ushahidi** [Certain] (`09` §9.3):

  | Aina | Idadi | Kiasi |
  |---|---|---|
  | LOAN_RECEIVED | 1 | 1,200,000 (tukio 26/09, liliingizwa 13/10, siku 17) |
  | EXPENSE_DIRECT | 23 | 139,000 |
  | ASSET_DEPRECIATION | 3 | 74,888.89 |
  | DEBT_RECLASSIFICATION | 4 | 69,000 |
  | DAY_CLOSE_VARIANCE | 10 | 16,600 |

  - Journals live: EXPENSE_DIRECT 74 kati ya 80 zimerudishwa nyuma (hadi siku 64), DAY_CLOSE_VARIANCE 23/23 (hadi siku 24).
  - `gl_period` ina safu 0 na hakuna code inayoisoma.
  - Sales: 1,034 ziliingizwa siku 1+ baada ya `sale_date` (815 STANDARD, 219 walk-in; hadi siku 36). Zinaangukia `sale_date` (`PostingEngine.java:358`).
- **Athari:** ripoti ya Septemba iliyotolewa 01/10 si sawa na ya leo.
- **Pendekezo:** Awamu ya kufunga kipindi (iko kwenye orodha ya kazi zijazo). Entry ya tarehe ya kipindi kilichofungwa ipostiwe siku ya kwanza ya kipindi kilicho wazi, au ikataliwe.

### H-8 · MEDIUM · Inventory: GL dhidi ya stock × gharama · TZS 391,317.50 (net)

- **Ushahidi** (`07-control-vs-subledger.sql`): GL 1200 tarehe 13/10 = 6,266,589.20; `current_stock × current_average_cost` = 5,875,271.70.
  - **401,499.66** [Certain] = COGS ya sales 3 za H-2 ambayo haikupostiwa.
  - **−10,182.16** baki (stock juu ya GL) (likely). Ni drift ya WAC tangu true-up ya 30/09 15:34: stock iliyopo inathaminiwa upya kwa wastani mpya baada ya kila purchase, wakati GL haithamini upya. Pia valuation yangu haina fallback ya miezi 6 ya `StoreService.batchLoadValuationCost`.
  - Kwa hiyo "INVENTORY −0.42" ya zamani haiwezi kuthibitishwa hapa (Guessing: rounding ya `total_cost` kwa mstari).
- **Mstari 1 wa sale bila gharama:** RCP-20260714-125000-B045, SERENGETI LAGER ×60, 96,000, `cost_per_piece` 0. COGS pungufu ≈ 92,400 (kwa WAC ya leo) (likely).
- **Pendekezo:** baada ya H-2, true-up ndogo ya inventory yenye maelezo; posting ya "revaluation" WAC ikibadilika (au ukubali drift ndogo kila mwezi).

### H-9 · MEDIUM · Control checks za GL zinalinganisha GL ya tarehe X na sub-ledger ya LEO

- **Ushahidi** [Certain]: `GlReconciliationService.controlChecks:169-182`. `glService.balancesAsOf(asOf)` inalinganishwa na `sumUnpaidOutstanding`, `inventoryAtCost()` n.k., ambazo ni hali ya sasa.
- **Athari:** check ya tarehe yoyote ya nyuma (na true-up ya tarehe ya nyuma, `trueUp:233`) inaonyesha tofauti zisizo za kweli. True-up ikifanywa kwa tarehe ya nyuma, itaharibu salio.
- **Pendekezo:** zuia `asOf` ≠ leo, au jenga sub-ledger za as-of.

### H-10 · LOW · Rejista ya mali (asset_item) dhidi ya GL: Fridge · TZS 200,000

- [Certain] (`05b`): `asset_item` Fridge `unit_value` = 1,000,000; capex `OFF-INV-20261008-…AB0CCAB1` na GL 1510 = 1,200,000. Kreti (3) zinalingana.
- **Pendekezo:** mmiliki athibitishe bei sahihi (Q6).

### H-11 · LOW · `approvedBy` na `posted_by` si kitambulisho cha mtumiaji

- [Certain] (`05` §5.3):
  - capex `approved_by`: maandishi tu (2,381) kama "Current User", "System%20Auto-Approval" (URL-encoded), "Paul Tarimo", "Jess Saimon", "SYSTEM_AUTO", na 11 NULL. Hakuna hata moja iliyo `users.uid`;
  - `journal_entry.posted_by` imechanganyika: email 4,725, majina 201, `users.uid` 268.
- **Athari:** haiwezekani kuthibitisha nani aliidhinisha kwa uhakika.
- **Pendekezo:** hifadhi `users.uid` (na jina kando kwa kuonyesha).

### H-12 · INFO · Hakuna kosa kwenye haya (kipimo kilipita) [Certain]

- **Double entry** (`02`): TB Dr = Cr = 791,952,398.47. Hakuna:
  - journal isiyo balanced,
  - line 0/0, hasi au yenye pande mbili,
  - akaunti isiyokuwepo,
  - reversal mara mbili,
  - entry ya tarehe ya baadaye.
- **Ufuatiliaji** (`09` §9.2): journals 0 zisizo na source; kila `reference_uid` inaelekeza kwenye rekodi iliyopo. Journals za manual ni 3 tu, zote zina `TRUEUP:` au `TRF:` na `posted_by` (2 true-up za inventory 30/09 na tarimo@gmail.com; transfer 1000→1020 264,664).
- **Ukamilifu** (`09` §9.1): purchases 2,055, supplier payments 12, staff payments 5, count adjustments 339, return 1, capital injections 5, malipo ya madeni 14 baada ya T0 (510,500): **zote zina journal**.
  - Debt adjustments 2 (CORRECTION 3,000 na 100,000) hazina journal kwa usahihi: sale zao za walk-in zilikuwa na salio 0 wakati wa rebuild, kwa hiyo hakuna AR ya kurekebisha.
- **Sales zilizofutwa (stock hewa):** 233 zimefutwa; **0** zina journal hai (`04` §4.6), kwa hiyo reversals zipo.

## d) Capital

| Kipimo | Matokeo |
|---|---|
| capex APPROVED bila journal | 0 pengo halisi (D11). OPERATIONAL monthly: zote ≤ 13/10 zina journal; Nov/Des (300k ×2) zinasubiri scheduler (sahihi) |
| approvedBy | jina/maandishi, si ID (H-11) |
| Mkopo → mtaji | **0 matukio** (`reclassified_from` / `reclassified_at` NULL kwa zote; hakuna LOAN_RECLASSIFICATION). Code ingepost `LocalDate.now()` (`PostingEngine.java:827`), si tarehe ya tukio |
| Mikopo (2100) | GL 2,386,000 = sub-ledger 2,386,000. Mkopo `INJ-4e3c01c3` 1,200,000 CASH: `transaction_date` 26/09, `created_at` 13/10, journal `entry_date` 26/09 (imerudishwa nyuma siku 17, H-7). Mkopo `INJ-0c98b69e` NMB: 1,000,000 → reversal (tarehe 11/10) → 1,186,000 (tarehe 04/10) |
| Equity | 3000 = 10,598,755 (mchango wa 19/05, mmoja tu); 3900 = 1,055,841.53 (true-up 2 za inventory 30/09); 3100 (drawings) haina kitu; FAIDA_BIASHARA 1,056,640 ni VOID na haina journal (sahihi) |
| Fixed assets | Gross 10,415,000 = GL 1510 + 1530 (9,065,000 + 1,350,000). Uchakavu: 588,611.12 = GL 1590 hadi Septemba. Mali 6 za Oktoba (Fridge, Kreti ×3, TV, Camera) hazijaanza (sahihi; Oktoba itapostiwa mwisho wa mwezi) |
| Kreti (Toleo B) | "Kreti za bia" 2,323,000 + soda 300,000 ×2 tayari ziko 1510 (OFFICE) kupitia ASSET_PURCHASE. Kreti ya Pepsi ina maisha ya miezi **240** (miaka 20), wakati nyingine zina 60 (Q5). Toleo B likipost **Dr 1500 / Cr 3000**: 1500 "Fixed Assets" ipo na ni ASSET/FIXED_ASSET; 3000 "Owner Capital" ipo na ni EQUITY. Ni sahihi **kama** kreti ni mchango mpya wa mmiliki (mali iliyoletwa bila pesa ya duka). **Si** sahihi kwa kreti zilizonunuliwa kwa pesa ya duka: hizo tayari ziko 1510, na Dr 1500 / Cr 3000 ingehesabu mali mara mbili na kuongeza mtaji usiokuwepo (Q5) |
| IAS 16 | Vitu vidogo kama "glass za pombe kali" 42,000 (miezi 12) vimewekwa kama mali. Inakubalika kama sera, lakini hakuna kiwango cha chini (capitalisation threshold) kwenye code (Guessing) |

## e) Ukali kwa idadi ya matukio na TZS

| Tukio lisilogusa GL | Mara (zote) | Mara baada ya T0 | TZS (drift) | Ukali |
|---|---|---|---|---|
| Sale edits | 0 | 0 | 0 | LOW |
| Payment edits/deletes | 1 (21/05) | 0 | 0 | LOW |
| cancelPurchase (approved) | 0 | 0 | 0 | LOW |
| Recon reopen (variance mara mbili) | 15 reopen / 14 supersede | 13 / 12 → nakala hai 9 | 11,300 net (16,500 abs) | MEDIUM |
| restoreDeletedSale | 0 | 0 | 0 | LOW |
| Sale yenye deni bila journal | 3 | 3 (100%) | 412,500 mapato | CRITICAL |
| Variance ya alama iliyogeuzwa | 85 | 23 | 1,593,899.90 | CRITICAL |

## f) Materiality: tofauti chini ya TZS 1,000 (kwa pamoja)

- "INVENTORY −0.42" (kipimo cha zamani cha mfumo): haikuweza kuthibitishwa kwenye dump. Inawezekana ni rounding ya `total_cost` kwa mstari (Guessing).
- Mistari 5 ya sale yenye `cost_source = UNKNOWN` (24/06–07/08): gharama ipo (si 0), athari haijapimwa (Guessing: ndogo).
- Debt adjustments 2 bila journal (H-12): 0 drift.

Tofauti zote za TZS 1,000 na zaidi zimeelezwa moja moja hapo juu.

## g) Maswali yanayohitaji uamuzi wa mmiliki

1. **H-1:** Rekebisha alama ya variance kwa reverse + repost (inabadilisha historia ya kila siku), au kwa journal moja ya 1,593,899.90 tarehe ya leo? Na je, ziada za siku 20 (1.0M) ni pesa halisi?
2. **H-2:** Ruhusu kurekebisha posting ya sale yenye deni, na kurepost sales 3 (101026-2202, 121026-2249, 131026-2227)? Endesha `steps/34-gl-audit-postsale-log.cmd` ili tupate exception halisi.
3. **H-3:** Kodi ya frame ni 2,400,000 kwa mwaka (200,000 kwa mwezi)? Ililipwa yote mwanzoni (Prepaid) au kila mwezi? `OPE-MON-…-2939F6DE` ("2400000", 200,000) ni kodi hiyohiyo au kitu kingine? TRA 250,000 vivyo hivyo.
4. **H-4:** Tutangaze 30/09 kuwa tarehe ya kuanza GL, au tujenge upya historia ya madeni ya walk-in?
5. **Kreti (Toleo B):** Kreti ni mchango wa mmiliki (Dr 1500 / Cr 3000) au zilinunuliwa na duka (tayari ziko 1510)? Maisha ya kreti ya Pepsi ni miezi 240 au 60?
6. **H-10:** Bei ya Fridge ni 1,000,000 au 1,200,000?
7. **H-6:** Turekebishe row ya `reconciliation_debt_payments` ya 0.00 (sale 150826-0000-3) na kanuni ya kutoa tarehe ya P&L?
8. **H-7:** Tuanze kufunga kipindi (gl_period) kabla ya kurekebisha mengine, ili marekebisho yasibadilishe Septemba tena?

## h) Awamu 1b: vipimo vya ziada (dump ya 15/10)

**Database: `lsms_audit_20261015_0200`.** Imerejeshwa kutoka `lsms_20261015_0200.dump` (sha256 `52e34fe4c52f1597b9fcb49452a9786f0dae4dc17f6cf83322b4a37d14cbd6d2`: Contabo = B2 = PC, `steps/35-pakua-dump-20261015.log`) kwa `pg_restore -j 1`, kusoma tu.

| Uthibitisho | lsms_audit (14/10) | lsms_audit_20261015_0200 |
|---|---|---|
| Flyway | 131 | **133** (0 zilizoshindwa) |
| sales (zilizofutwa) | 2,524 (233) | 2,545 (233) |
| max(sales.created_at) | 2026-10-14 00:24:29 | 2026-10-14 23:58:49 |
| journal_entry | 5,194 | 5,230 |
| max(entry_date) | 2026-10-14 | 2026-10-14 |

Sehemu a–g zinabaki kwenye 14/10. Hapa chini, namba za 14/10 zimewekwa kando ya za 15/10 **tu** pale namba mpya inapopingana na dai la ripoti.

### h.0 Mahali namba mpya zinapopingana na ripoti

| Dai | 14/10 | 15/10 | Tofauti | Sababu |
|---|---|---|---|---|
| H-1 journals hai za DAY_CLOSE_VARIANCE | 85 | 87 | +2 | Reco za 12/10 (15,000) na 13/10 (2,000) ziliidhinishwa 14/10 20:33–20:34 [Certain] |
| H-1 siku za ziada / TZS | 20 / 1,002,799.95 | 22 / 1,019,799.95 | +2 / +17,000 | hizohizo |
| H-1 kosa kwenye Cash 1000 | 1,593,899.90 | **1,627,899.90** | +34,000 | 2 × 17,000. Kosa linaendelea kukua kila reco ya ziada inapoidhinishwa (`08-day-close-sign-20261015.out`) |
| GL 1000 tarehe 13/10 | 10,184,308.52 | 10,157,308.52 | −27,000 | Journals 3 zilizoundwa 14/10 zenye tarehe 12–13/10: variance 2,000 + 15,000, gharama 10,000 (`14` §6). Ni tabia ya H-7, si kosa jipya |
| H-6 safu za `reconciliation_debt_payments` za 0.00 | 1 (sale 150826-0000-3) | **199 hai** | — | H-6 ilitaja mfano mmoja; ni utaratibu wa mfumo tangu Julai (h.4) |
| H-2 sales za deni bila journal | 3 kati ya 3 | hakuna sale mpya ya deni tangu 2.2.70 (14/10 14:43); cash 18 kati ya 18 zina journal | — | Haiwezi kuthibitishwa wala kukanushwa kwa data hii. Log ya hatua 34 bado inahitajika |
| H-7 sales zilizochelewa siku ≥ 1 | 1,034 (815 / 219, hadi siku 36) | 1,034 (815 / 219, siku 36) | 0 | hakuna mgongano |

### h.1 Siku 22 za ziada: kwa nini pesa ilionekana "imezidi"? (`10`, `10b`, `10c`, `10d`)

Formula 1 (`DailyReconciliation.java:483-491`):

`variance = mauzo − mobile − madeni ya leo − gharama − purchases − marudio − CASH_IN_HAND − benki/safe box − petty`

Variance < 0 = ziada. Journals 22 = siku halisi 20 (nakala 2 za H-5: 17/09, 04/10), jumla **1,017,199.95** kwa siku halisi.

| Dhana | Kipimo | Inaeleza | Hali |
|---|---|---|---|
| Sales zilizoingizwa baada ya reco | sales za siku hiyo, mtumiaji huyo, `created_at` > snapshot | **0** | Imekanushwa [Certain] |
| Madeni ya siku nyingine kwenye orodha ya madeni ya leo | `reconciliation_retail_debts` za reco, sale_date ≠ siku | **0** | Imekanushwa [Certain] |
| Makusanyo ya madeni yamechanganywa na pesa ya mauzo | makusanyo − kilichotangazwa Formula 2 | **0** (yote yalitangazwa F2) | Imekanushwa [Certain] |
| Malipo ya madeni ya POS (payments) yasiyo kwenye reco | malipo ya sales za nyuma siku hiyo − makusanyo ya reco | 3,600 | ndogo [Certain] |
| **Pesa ya jana** iliwekwa benki leo bila kuandikwa `CASH_PREVIOUS` | CASH_IN_HAND + petty ya reco iliyopita − `cash_previous_total` | **136,699.95** (siku 6) | likely. Mfano: 04/07 droo 532,000 → 05/07 −700; 24/07 droo 540,000 → 25/07 −65,999.95; 04/08 336,000 → 05/08 −33,000 |
| **Kinachobaki** | | **880,500** | haijaelezwa |

Aina mbili za siku:
- **K1 (siku 12, 194,799.95): `declared = 0` na expected hasi.** Hakuna pesa ya ziada iliyohesabiwa. Makato (benki, madeni, gharama) yalizidi mauzo ya siku.
  - Kwa siku hizi, kugeuza tu alama ya H-1 kungepost "Cash over" (Dr 1000) kwa **pesa ambayo haikuwahi kuhesabiwa**. Marekebisho ya H-1 lazima yatenganishe K1 na K2 [Certain kwa data; uamuzi ni wa mmiliki].
- **K2 (siku 8, 822,400): pesa iliyohesabiwa > expected.** Siku mbili zinabeba 752,500:
  - 04/07: 542,000. Expected −10,000, declared 532,000, maelezo "imekosewa".
  - 24/06: 210,500. Maelezo "imewekwa bank".
  
- **Maelezo ya cashier** "bidhaa ziliuzwa lakini hazikuandikwa" yapo kwenye siku 6:
  - K2: 01/08 (6,500) na 04/08 (16,500). Hapa ni pesa halisi isiyo na mauzo, na kwenye mpango wa capital ingeenda 2900 Suspense.
  - K1: 05/08, 04/10, 12/10, 13/10. Hapa maelezo **hayalingani na data**: declared ni 0, kwa hiyo hakuna pesa ya ziada iliyohesabiwa.

**Swali kwa mmiliki (Q9):** 542,000 ya 04/07 na 210,500 ya 24/06 zilikuwa pesa halisi? Kama si halisi, ni kosa la kuandika upande gani?

### h.2 Salio la akaunti za pesa (`14`)

GL kwenye 15/10, mwisho wa 14/10. Safu mbili za mwisho ni za mmiliki kujaza.

| Akaunti | GL 13/10 | GL 14/10 | Pesa halisi tarehe ____ | Chanzo (statement / kuhesabu) |
|---|---|---|---|---|
| 1000 Pesa Mkononi | 10,157,308.52 | 11,173,908.52 | droo: ______  safe box: ______  kwa mmiliki: ______ | |
| 1010 Pesa Ndogo | 0 | 0 | | |
| 1020 Benki CRDB | 0.00 | 0.00 | | |
| 1021 Benki NMB | 1,186,000.00 | 1,186,000.00 | | |
| 1022 Benki NBC | 0 | 0 | | |
| 1023 Selcom | 0 | 0 | | |
| 1024 Benki PCB | 0 | 0 | | |
| 1030 Vodacom (M-Pesa) | 64,000.00 | 64,000.00 | | |
| 1031 Tigo Pesa | 0 | 0 | | |
| 1032 Halopesa | 0 | 0 | | |
| 1033 Airtel Money | 0 | 0 | | |
| **Jumla** | 11,407,308.52 | 12,423,908.52 | | |

Kumbuka H-1: Cash 1000 iko pungufu kwa 1,627,899.90 kwa sababu ya alama, lakini sehemu ya K1 (h.1) si pesa halisi.

Kwenye GL, kila kitu kiko 1000. Reco inaonyesha pesa ilienda wapi (hadi 14/10, reco zisizo DRAFT) [Certain]:

| Njia | Benki / mtandao | Idadi | TZS |
|---|---|---|---|
| droo → benki | NMB | 118 | 67,849,000 |
| droo → benki | SELCOM | 4 | 2,035,000 |
| droo → benki | CRDB | 2 | 482,000 |
| safe box → benki | NMB | 75 | 12,428,200 |
| safe box → benki | SELCOM | 3 | 720,000 |
| mauzo kwa simu | VODACOM | 161 | 12,027,500 |
| mauzo kwa simu | TIGO | 60 | 3,349,300 |
| mauzo kwa simu | "CASH_IN_HAND", "CHAKULA" (si mtandao) | 2 | 46,000 |

- Safe box: kiliingia 13,357,700, kilitoka 13,148,200 (benki) + 360,000 (kukabidhiwa) = 13,508,200. Kwa hiyo **safe box imetoa 150,500 zaidi ya ilichopokea** [Certain]. Inawezekana kuna pesa iliyoingia safe box bila reco, au reco zilizobaki DRAFT (Guessing).
- Mobile entries 2 zina `provider` ambayo si mtandao: kosa la kuingiza data.

### h.3 Sales zilizochelewa kwa makundi (`11`)

Kuchelewa = `created_at − sale_date`. Sales 1,054 kati ya 2,312 zina `sale_date` bila saa (00:00:00); kwa hizo, kuchelewa kunapimwa kuanzia **mwisho** wa siku ya sale.

| Kundi | Idadi | TZS | STANDARD | Walk-in | Mwezi uliopita* | Tangu GL live |
|---|---|---|---|---|---|---|
| "kabla ya sale_date" | 242 | 29,750,000 | 242 | 0 | 0 | 0 |
| siku ileile (tarehe tu) | 35 | 1,837,300 | 8 | 27 | 0 | 4 |
| < 6h | 1,136 | 124,738,950 | 1,133 | 3 | 0 | 193 |
| 6–24h | 733 | 61,517,700 | 561 | 172 | 29 | 26 |
| siku 1–3 | 97 | 18,767,901 | 69 | 28 | 10 | 10 |
| > siku 3 | 69 | 30,814,400 | 53 | 16 | 21 | 0 |
| **Jumla** | 2,312 | 267,426,251 | 2,066 | 246 | 60 | 233 |

\* "Mwezi uliopita" = iliingizwa mwezi mmoja au zaidi baada ya mwezi wa sale. Hizi ndizo zinazobadilisha ripoti ya mwezi uliokwisha (H-7).

- **Sales 242 za "kabla ya sale_date"** ni za 20/02–14/06 tu. Zote zina `sale_date − created_at` ya saa 2:24–3:00, na hakuna hata moja baada ya katikati ya Juni. Kipindi hicho `created_at` iliandikwa kwa UTC na `sale_date` kwa EAT (likely). Kwa kweli ziliingizwa ndani ya dakika 0–36, kwa hiyo ni za kundi "< 6h". Hakuna athari kwa GL, kwa sababu GL inatumia `sale_date`.
- Ulinganisho na H-7 (siku za kalenda) unalingana: 1,034.

### h.4 `reconciliation_debt_payments` zenye `amount_paid = 0` (`12`)

202 kati ya 451 (199 hai). Kila safu ni deni tofauti, na **kila moja imeunganishwa na malipo ya POS** (`sale_payment_uid`) [Certain]. Kwa mwezi:

| Mwezi | Jun | Jul | Ago | Sep | Okt |
|---|---|---|---|---|---|
| 0.00 / zenye kiasi | 5 / 180 | 75 / 45 | 59 / 8 | 28 / 7 | 32 / 7 |

| Kundi | Safu | Maana |
|---|---|---|
| Malipo ya POS yaliyounganishwa ni UNPAID 0, deni bado halijalipwa | 93 (deni 1,364,500: walk-in 92, STANDARD 1) | safu ya "kufungua deni"; haina madhara yenyewe |
| Malipo ya POS UNPAID 0, lakini sale sasa ni PAID/PARTIAL (imelipwa kupitia row nyingine) | 16 (deni 622,000) | reco haikurekodi kiasi wala tarehe |
| **Malipo ya POS yana kiasi, safu ya reco ni 0.00** | **90 (TZS 3,793,500)** | pesa ilipokelewa, lakini reco ina 0; 89 kati yake bado ni `is_paid = false` kwenye orodha ya madeni ya reco |
| Safu ya H-6 (150826-0000-3) | 1 | 0.00 dhidi ya POS 21,000, kama ilivyoripotiwa |

- **Athari** [Certain kwa kanuni ya `DailyPnlCalculator.java:304-306`]: kwa safu hizi, Daily P&L haina "evidence" ya tarehe. Kiasi chake kinapewa tarehe ya payment row ya mwisho, kwa hiyo AR ya kila tarehe ya nyuma inaweza kubadilika baadaye (H-6 kwa ukubwa wa 3.79M, si 21,000).
- GL haiathiriki: GL inatumia `payments`.

### h.5 Kodi ya frame 2.4M na TRA 250k: zililipwa kwa pesa ya duka? (`13`)

**Hakuna ushahidi kwamba zililipwa kwa pesa ya duka** [Certain kwa data; nani alilipa ni swali kwa mmiliki]:

1. Rekodi 3 zote zina tarehe 2026-01-01 na `payment_method` tupu, kwa hiyo GL iliweka CASH 1000 kwa default (`PostingEngine.postExpense` → `payingAccount(null)`):
   - `…-F7C9E331` 200,000
   - `…-2939F6DE` "2400000" 200,000
   - `…-4B42C8F1` 20,833.33
2. Siku hiyo, journals hizi 3 ndizo pekee kwenye GL. **Salio la 1000 tarehe 01/01 = −420,833.33.** Mauzo ya kwanza ni 01/02, na mtaji wa kwanza (10,598,755) ni 19/05. Duka halikuwa na pesa kwenye vitabu.
3. Hakuna `reconciliation_expenses` ya kodi, TRA wala frame kwa kipindi chote. Hazikutoka droo.
4. Hakuna mtaji wala mkopo karibu na 01/01.

Kwa hiyo, uwezekano ni:
- (a) mmiliki alilipa kwa pesa yake: Cr 3000, si 1000;
- (b) haikulipwa bado: deni;
- (c) ililipwa benki nje ya mfumo.

Inaungana na Q3: jibu lake linaamua Prepaid/kila mwezi na akaunti ya Cr.

### h.6 Pengo la Julai/Agosti: pesa iliyotoka droo dhidi ya purchases nje ya droo (`15`, `15b`)

Query ileile (`capital-funding/04`) kwenye nakala zote mbili: **Julai −5,114,802, Agosti +1,181,136 kwenye 14/10 na 15/10 (sawa)**. Oktoba inatofautiana tu kwa siku moja zaidi ya reco: −12,575,495 → −11,289,495.

Pengo la jumla tangu reco ya kwanza (13/06), kwa ufafanuzi uleule (`15b`) [Certain]:

| Mwisho wa | Pengo la mwezi | Jumla tangu 13/06 |
|---|---|---|
| Juni (13–30) | −12,536,900 | −12,536,900 |
| Julai | −5,114,802 | −17,651,702 |
| Agosti | +1,181,136 | −16,470,566 |
| **Chini kabisa** | | **−20,169,802 (17/08)** |

- Maana: tangu 13/06 hadi 17/08, purchases na gharama zilizolipwa nje ya droo zilizidi pesa iliyotoka droo kwa hadi **20.2M**.
- Pesa iliyokuwa nje ya droo tarehe 13/06 haijulikani, kwa sababu hakuna reco kabla ya hapo. Mtaji wa 19/05 ni 10,598,755. Hata kama wote ungekuwa bado mkononi, **angalau ≈ 9.6M** zilitoka mahali ambapo vitabu havioni (likely).
- Purchases 592 kati ya 619 zilizopokelewa 13/06–31/08 **hazina supplier**, kwa hiyo GL inazihesabu kama zimelipwa cash yote, 74,299,502 (`PostingEngine.postPurchase`: "no supplier → paid on the spot") [Certain].

Kwa hiyo pengo linaweza kuwa (Guessing; kipimo cha kutofautisha hakipo kwenye data):
1. pesa ya mmiliki au mkopo usiorekodiwa;
2. purchases zisizo na supplier ambazo kwa kweli zilikopwa (AP iko pungufu);
3. pesa iliyokuwa benki au kwa mmiliki kabla ya 13/06.

Journal ya ufunguzi ya pesa (mpango wa capital, hatua 4) na majibu ya Q10 ndiyo yatakayoamua.

### h.7 Maswali mapya kwa mmiliki

9. **h.1:** Ziada ya 04/07 (542,000, "imekosewa") na 24/06 (210,500, "imewekwa bank") zilikuwa pesa halisi? Na kwa siku za K1 (declared 0), unakubali zisipostiwe kama "Cash over" kwenye marekebisho ya H-1?
10. **h.6:** Kati ya 13/06 na 17/08, purchases nje ya droo zilizidi pesa iliyotoka droo kwa 20.2M. Kulikuwa na pesa yako binafsi au mkopo, au purchases zisizo na supplier zilikopwa?
11. **h.2:** Jaza safu ya "pesa halisi" (droo, safe box, kwa mmiliki, NMB, Selcom, CRDB, M-Pesa, Tigo) kwa tarehe moja.
12. **h.5:** Kodi ya 01/01 ililipwa na nani, na kwa pesa gani?

## i) Ramani ya Pesa: kila chanzo → GL

**Database: `lsms_audit_20261015_0200`** (data hadi 14/10 23:58), pamoja na code ya backend 2.2.70 (`D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms`, commit `1fdcdae`). Kusoma tu. T0 = 2026-09-30 10:32:19 (GL live).

**Kanuni ya jumla ya kushindwa** [Certain]:
- `PostingEngine.post` (`PostingEngine.java:60-77`) inaandika journal kwenye transaction yake (`REQUIRES_NEW`). Kwa kuwa `shadow_mode = false`, kosa lolote linatupwa kama `RuntimeException`.
- Kinachotokea baada ya hapo kinategemea anayeita:
  - **"inameza"** = anakamata kosa na kuandika log tu. Tukio linahifadhiwa **bila journal**, na hakuna rekodi ya kosa (H-2).
  - **"inazuia"** = kosa linarudisha operesheni yote nyuma. Tukio halihifadhiwi bila journal.

### i.1 Jedwali: chanzo → GL

| # | Chanzo (jedwali / tukio) | GL? | Event type | Dr / Cr | Lini | Tarehe ya entry | Ikishindwa | Ushahidi |
|---|---|---|---|---|---|---|---|---|
| 1 | `sales` STANDARD, imelipwa yote | Ndiyo | SALE_CASH | Dr 10xx kwa njia ya malipo (POS inaandika karibu yote CASH → 1000); Dr 5000 / Cr 1200 (gharama); Cr 4000 (jumla kabla ya discount); Dr 4010 (discount) | Sale ikiundwa, **async** baada ya kuhifadhi | `sale_date` | inameza (async, log tu) | `SaleService.java:652-662, 926-935`; `PostingEngine.java:294-367` |
| 2 | `sales` STANDARD, deni au mchanganyiko | Ndiyo | SALE_CREDIT / SALE_MIXED | kama 1, pamoja na Dr 1100/1110 (AR) kwa deni | kama 1 | `sale_date` | inameza: **3 kati ya 3 tangu T0 hazina journal** (H-2) | kama 1; `18` |
| 3 | `payments`: malipo ya deni (POS) | Ndiyo | PAYMENT_RECEIVED | Dr 10xx (njia) / Cr AR | Malipo yakiingizwa | `payment_date` | inameza | `PaymentService.java:91-101`, `SaleService.java:2311-2320` |
| 4 | Deni la walk-in (reco → sale `RECONCILIATION_MANUAL`) | Ndiyo (reclass tu) | DEBT_RECLASSIFICATION, ref `<saleUid>:DEBT` | Dr AR / Cr 1000. Sale ya walk-in yenyewe **haipostiwi** | Deni likiongezwa kwenye reco (si approval); likihaririwa: reverse + repost; likifutwa: reverse | `sale_date` | inameza | `ReconciliationService.java:953-962, 1060-1068, 1137` |
| 5 | Marejesho ya mauzo | Ndiyo | SALE_RETURN_CASH / _CREDIT | kinyume cha 1/2 | Approval | tarehe ya return | inazuia | `SaleService.java:5150-5156` |
| 6 | `debt_adjustment` (write-off, waiver, correction) | Ndiyo | DEBT_WRITE_OFF / DEBT_WAIVER / DEBT_CORRECTION | Dr 6110 au 6120 au (1000 / 4000) / Cr AR | Approval | **`LocalDate.now()`** (D7) | inazuia | `DebtAdjustmentService.java:358-367`, `PostingEngine.java:737-779` |
| 7 | `reconciliation_expenses` | Ndiyo, kupitia capex | EXPENSE_DIRECT (ya capex DAILY_EXPENSE, source RECONCILIATION) | Dr 6xxx / Cr 1000 (`payment_method` tupu → 1000) | Capex PENDING ikiundwa wakati gharama inaongezwa; journal **capex ikiidhinishwa**: yenyewe wakati wa approval ya reco **kama tu** mwidhinishaji ana CAPITAL_APPROVE, vinginevyo inabaki PENDING | **`capex.transaction_date` = siku gharama ilipoingizwa**, si `reconciliation_date` | inazuia approval ya capex; approval ya reco inaendelea na kuorodhesha zilizoshindwa | `ReconciliationService.java:1180-1185, 1858-1878`; `CapitalExpenditureService.java:3496-3515` |
| 8 | `reconciliation_purchases` | **Hapana** | — | — (inatolewa kwenye Formula 1 tu) | — | — | — | hakuna call; `purchase_uid` tupu kwa 53 kati ya 53 |
| 9 | `reconciliation_cash_entries` BANK_DEPOSIT, SAFE_BOX, PETTY_CASH, CASH_IN_HAND, CASH_PREVIOUS; `reconciliation_mobile_entries` | **Hapana** | — | — (pesa yote inabaki 1000) | — | — | — | hakuna call kwenye `ReconciliationService` |
| 10 | `reconciliation_debt_collections` (Formula 2: CASH/BANK/MOBILE_DEBT) | **Hapana** (pesa inapostiwa kupitia 3) | — | — | — | — | — | — |
| 11 | `daily_financial_snapshot` (variance ya kufunga siku) | Ndiyo | DAY_CLOSE_VARIANCE | variance > 0 (upungufu) → **Dr 1000 / Cr 6700** (alama imegeuzwa, H-1); < 0 → Dr 6700 / Cr 1000 | Approval ya reco; kila reopen + approve inapost tena (H-5) | `snapshot_date` | inameza | `ReconciliationService.java:1846-1853`, `PostingEngine.java:781-797` |
| 12 | `safe_box_deposits` (BANK_DEPOSIT, HAND_OVER) | **Hapana** | — | — | — | — | — | hakuna `PostingEngine` kwenye `SafeBoxService` |
| 13 | `purchases` | Ndiyo | PURCHASE_INVENTORY | Dr 1200 / Cr **1000** (kilicholipwa; bila supplier = yote) / Cr 2000 (baki). Njia ya malipo haitumiki | Approval (`approvePurchase`, mahali pa WAVG) | `purchase_date` | inameza | `PurchaseService.java:195-204`, `PostingEngine.java:488-509` |
| 14 | `supplier_payments` | Ndiyo | PURCHASE_PAYMENT | Dr 2000 / Cr 10xx (njia; BANK_TRANSFER → 1020) | Ikiingizwa; ikifutwa: reverse | `payment_date` | inameza | `SupplierPaymentService.java:69-78, 104` |
| 15 | `capital_expenditure` OPERATIONAL (DAILY_EXPENSE ya DIRECT, MONTHLY_EXPENSE) | Ndiyo | EXPENSE_DIRECT | Dr 6xxx / Cr 10xx (`payment_method`; tupu → 1000) | Approval. Za tarehe ya baadaye zinasubiri job ya 00:10 | `transaction_date`. Mstari wa mwaka mzima (`allocated_month = 0`) unapostiwa **mara moja** (H-3) | inazuia | `CapitalExpenditureService.java:3496-3515` |
| 16 | `capital_expenditure` mali (`is_asset`) | Ndiyo | ASSET_PURCHASE; ASSET_DEPRECIATION; ASSET_DISPOSAL_* | Dr 15xx / Cr 10xx; uchakavu Dr 6500 / Cr 1590 | Approval; uchakavu kila mwisho wa mwezi (job) | `transaction_date`; uchakavu = siku ya mwisho ya mwezi | approval: inazuia. Job ya uchakavu: inameza kwa kila mali (log warn), lakini posting ni idempotent, kwa hiyo inajaribu tena mwezi uliokosekana run inayofuata | `CapitalExpenditureService.java:696-711, 723-760, 784, 3505` |
| 17 | `capital_expenditure` LOAN_PAYMENT | Ndiyo | LOAN_REPAYMENT | Dr 2100 (+ 6600) / Cr 10xx | Approval | `transaction_date` | inazuia | `PostingEngine.java:606-627` |
| 18 | Uharibifu / shrinkage (Store) | Ndiyo | SHRINKAGE_LOSS | Dr 5100 / Cr 1200 | Ikirekodiwa | `transaction_date` | inameza | `StoreService.java:1223-1232, 1508-1517` |
| 19 | Marekebisho ya stock: Store (ADJ-*) na counting | Ndiyo | STOCK_ADJUSTMENT; au STAFF_LIABILITY_CHARGE (Dr 1120 / Cr 1200 + Cr 4900 faida) | Hasara Dr 5100 / Cr 1200; ziada kinyume | Approval ya counting / adjustment | siku ya approval | Store: inameza; counting: inameza lakini inaweka `gl_posted = false` | `StoreService.java:1097-1106`, `CountingApprovalService.java:276-293` |
| 20 | `staff_liability_payment` | Ndiyo | STAFF_LIABILITY_PAYMENT / _WAIVER | Dr 10xx / Cr 1120; waiver Dr 5100 (+ 4900) / Cr 1120 | Ikiingizwa | tarehe ya malipo | inazuia | `LiabilityService.java:286-297` |
| 21 | `capital_injections`: mtaji, mkopo, kutoa, kulipa mkopo, mkopo → mtaji | Ndiyo | CAPITAL_INJECTION / LOAN_RECEIVED / OWNER_WITHDRAWAL / LOAN_REPAYMENT / LOAN_RECLASSIFICATION | Dr 10xx / Cr 3000 au 2100; Dr 3100 / Cr 10xx; Dr 2100 (+6600) / Cr 10xx; Dr 2100 / Cr 3000 | Ikiingizwa | `transaction_date`; reclass = **`LocalDate.now()`** | inazuia | `CapitalMonitoringService.java:154-160, 210-216, 463, 554-606` |
| 22 | GL ya mkono: true-up, transfer, manual journal | Ndiyo | OPENING_BALANCE / FUNDS_TRANSFER / MANUAL_ADJUSTMENT | kama ilivyoingizwa | Ikiingizwa | tarehe iliyochaguliwa | inazuia | `GlReconciliationService.java:272-364` |

**Ukamilifu kwa data** (`18`) [Certain]:

| Chanzo | Zote | Bila journal | Baada ya T0 | Baada ya T0 bila journal |
|---|---|---|---|---|
| sales STANDARD | 2,066 | 3 | 200 | **3** (H-2) |
| walk-in yenye deni (`:DEBT`) | 120 | 0 | 27 | 0 |
| purchases RECEIVED | 2,064 | 0 | 167 | 0 |
| supplier_payments | 12 | 0 | 7 | 0 |
| capex APPROVED (gharama/mali, hadi 14/10) | 453 | 2 (template za 0.00) | 89 | 1 (template ya 0.00) |
| capital_injections | 5 | 0 | 2 | 0 |
| variance za reco (snapshot ya sasa, ≠ 0) | 78 | 0 | 22 | 0 |
| malipo ya madeni baada ya T0 | — | — | 14 (510,500) | 0 |
| stock_adjustment `gl_posted = false` | 266 | 0: zote 266 **zina journal**; flag haikusasishwa na backfill (za 07/07–26/09) | 0 | 0 |

### i.2 Mapengo kwa TZS

**a) Gharama za reco dhidi ya journal ya gharama** (`16` §2a) [Certain]:

| Hali | Idadi | Reco TZS | GL TZS | Baada ya T0 |
|---|---|---|---|---|
| journal ipo, kiasi sawa | 357 | 2,531,800 | 2,531,800 | 52 (342,000) |
| capex PENDING (reco ya DRAFT) | 3 | 22,000 | 0 | 3 (22,000) |
| hakuna capex / capex imefutwa / APPROVED bila journal / kiasi tofauti | 0 | 0 | 0 | 0 |
| **Jumla** | 360 | 2,553,800 | 2,531,800 | 55 (364,000) |

- Kwa mwezi, zisizo na journal: Juni–Sep 0; **Okt 3 (22,000)**.
- Daily P&L inazihesabu, GL haizihesabu mpaka reco iidhinishwe.
- **Tarehe:** journal ya gharama ya reco inapata tarehe ya capex, yaani siku gharama ilipoingizwa, si `reconciliation_date`. Kesi 246 kati ya 357 zina tarehe tofauti (1,622,300); **25 zinahamia mwezi mwingine (150,500)**, hadi siku 85. Mfano: gharama za reco ya 13/06 zilipostiwa 06/09 (`17` §mwisho).

**b) Gharama zinazohesabiwa mara mbili** (`16` §2b):
- **Jozi 1 (likely):** reco ya 01/07 "manunuzi kingamuzi" 28,000 na capex MONTHLY `OPE-MON-20260701-…-AABDC814` "malipo ya kingamuzi azam" 28,000, tarehe na kiasi kilekile, zote zikiwa na journal. Iko mara mbili kwenye GL **na** kwenye Daily P&L (gharama ya kila siku + ya kila mwezi).
- Hakuna nyingine kwa kulinganisha tarehe na kiasi.
- **Kinyume chake (si mara mbili, ni kukosekana)** [Certain]: capex DAILY_EXPENSE za DIRECT (si za reco) 71, jumla **870,500** (Feb 412,000, Apr 403,500, Mei 55,000), na shrinkage 1 (31,500, Okt). Zote ziko GL, lakini **Daily P&L haizisomi**, kwa sababu inasoma gharama za kila siku kutoka `reconciliation_expenses` tu.

**c) Reco purchases dhidi ya purchases** (`16` §2c) [Certain kwa idadi, likely kwa tafsiri]:

| Mwezi | Reco purchases | TZS | `purchase_uid` | Zinalingana moja kwa moja (tarehe + kiasi) | Siku ambazo reco ≤ purchases za siku hiyo | **Reco juu ya purchases zote za siku** | Purchases za mwezi | Bila supplier |
|---|---|---|---|---|---|---|---|---|
| Jun | 6 | 419,000 | 0 | 0 | 3 kati ya 4 | **308,000** | 34,734,200 | 18,186,600 |
| Jul | 12 | 962,000 | 0 | 3 | 11 kati ya 11 | 0 | 32,615,666 | 32,394,002 |
| Ago | 13 | 1,054,000 | 0 | 0 | 10 kati ya 12 | **109,000** | 26,669,300 | 26,460,700 |
| Sep | 13 | 1,950,000 | 0 | 0 | 12 kati ya 13 | **50,000** | 34,376,650 | 34,240,450 |
| Okt (1–14) | 9 | 1,412,500 | 0 | 2 | 7 kati ya 7 | 0 | 18,282,452 | 18,282,452 |
| **Jumla** | 53 | 5,797,500 | **0** | 5 | 43 kati ya 47 | **467,000** | | |

- Siku 43 kati ya 47, reco purchases zinatoshea ndani ya purchases za siku hiyo. Kwa hiyo huenda ni purchases zilezile, zikiwa GL mara moja tu (likely).
- Siku 4, reco ilionyesha pesa ya purchases **zaidi ya purchases zote** zilizoingizwa siku hiyo: **467,000**. Hapo pesa ilitoka droo bila purchase kwenye mfumo, kwa hiyo GL 1000 iko juu na stock haikuingia (likely; inawezekana purchase iliingizwa tarehe nyingine).

**d) Pesa ambayo GL haioni ikihama** (`14`, i.1 #8–#12) [Certain]: droo → benki 70,366,000 (NMB 67,849,000), safe box → benki 13,148,200, mauzo kwa simu 15,422,800 (reco). Zote zinabaki 1000 kwenye GL. Ndiyo sababu NMB = 1,186,000 tu.

### i.3 Gharama: Daily P&L dhidi ya GL kwa mwezi (`17`)

Daily P&L imeigwa kwa SQL kwa kanuni za `DailyPnlService.java:130-166` na `DailyPnlCalculator.java:193-245`. Okt imehesabiwa kwa mwezi mzima; Daily P&L halisi ya 1–14/10 inagawa gharama za kila mwezi kwa siku 14/31.

| Mwezi | P&L kila siku (reco) | P&L kila mwezi | **P&L uendeshaji** | **GL uendeshaji** (6xxx bila 6500/6700/6110/6120/6600) | GL − P&L | P&L uchakavu | GL 6500 | GL 6700 (haipo P&L) |
|---|---|---|---|---|---|---|---|---|
| Jan | 0 | 420,833 | 420,833 | 420,833 | 0 | 0 | 0 | 0 |
| Feb | 0 | 220,833 | 220,833 | 412,000 | +191,167 | 71,389 | 71,389 | 0 |
| Mac | 0 | 220,833 | 220,833 | 0 | −220,833 | 71,389 | 71,389 | 0 |
| Apr | 0 | 220,833 | 220,833 | 403,500 | +182,667 | 71,389 | 71,389 | 0 |
| Mei | 0 | 220,833 | 220,833 | 55,000 | −165,833 | 74,889 | 74,889 | 0 |
| Jun | 144,500 | 220,833 | 365,333 | 33,000 | −332,333 | 74,889 | 74,889 | 280,000 |
| Jul | 608,300 | 248,833 | 857,133 | 672,300 | −184,833 | 74,889 | 74,889 | 578,800 |
| Ago | 653,500 | 550,833 | 1,204,333 | 996,500 | −207,833 | 74,889 | 74,889 | −6,950 |
| Sep | 828,500 | 768,833 | 1,597,333 | 1,421,000 | −176,333 | 74,889 | 74,889 | −57,900 |
| Okt | 319,000 | 670,833 | 989,833 | 765,000 | −224,833 | 146,012 | 0 | 20,000 |
| **Jumla** | 2,553,800 | 3,764,330 | **6,318,130** | **5,179,133** | **−1,138,997** | | | |

**Tofauti yote inaelezwa na vyanzo vitatu**, shilingi kwa shilingi kwa kila mwezi [Certain]:

| Chanzo | Athari kwa GL − P&L | Jumla Jan–Okt |
|---|---|---|
| Mistari ya mwaka mzima (kodi ya frame 200,000 + TRA 20,833.33): P&L kila mwezi, GL mara moja (Jan) (H-3) | −220,833 kila mwezi Feb–Okt | −1,987,497 |
| Capex DAILY za DIRECT: GL ndiyo, P&L hapana (i.2 b) | Feb +412,000, Apr +403,500, Mei +55,000 | +870,500 |
| Gharama za reco: tarehe ya GL (capex) dhidi ya tarehe ya reco, pamoja na DRAFT 22,000 | Jun −111,500, Jul +36,000, Ago +13,000, Sep +44,500, Okt −4,000 | −22,000 |
| **Jumla** | | **−1,138,997** |

Mfano wa Julai: −220,833 + (644,300 − 608,300) = −184,833.

Mengine yasiyo ya uendeshaji:
- **6700** (tofauti za droo) iko GL tu, na alama yake imegeuzwa (H-1).
- **Uchakavu** unalingana Feb–Sep. Oktoba P&L ina 146,012 na GL 0, kwa sababu GL inapost mwisho wa mwezi (muda tu).
- Mstari wa `…-2939F6DE` ("2400000", `allocated_month = 1`) unaingia Januari kwenye P&L **na** GL. Kama ni kodi ileile ya frame, Januari ina kodi mara mbili (Q3).

### i.4 Muhtasari wa mapengo

| Pengo | Zote | Baada ya T0 | Uhakika |
|---|---|---|---|
| Sales za deni bila journal (H-2) | 3 / mapato 412,500 | 3 / 412,500 | [Certain] |
| Gharama za reco bila journal (reco DRAFT) | 3 / 22,000 | 3 / 22,000 | [Certain] |
| Gharama za reco zilizopostiwa mwezi mwingine | 25 / 150,500 | — | [Certain] |
| Gharama ya reco + capex ya mwezi (mara mbili) | 1 / 28,000 | 0 | (likely) |
| Capex DAILY za DIRECT zisizo kwenye Daily P&L | 71 / 870,500 | 0 | [Certain] |
| Mistari ya mwaka mzima: P&L dhidi ya GL (Feb–Okt) | −1,987,497 | Okt | [Certain] |
| Reco purchases juu ya purchases za siku | 4 siku / 467,000 | 0 | (likely) |
| Reco purchases bila `purchase_uid` | 53 / 5,797,500 | Okt (kwa tarehe ya reco): 9 / 1,412,500 | [Certain] |
| Pesa ya benki, safe box na simu isiyohamishwa kwenye GL | ≈ 98.9M | — | [Certain] |
| Variance ya droo kwa alama iliyogeuzwa (H-1) | 1,627,899.90 | — | [Certain] |

## Faili

Queries zote ziko `analysis/gl-audit/NN-*.sql`, matokeo `NN-*.out`:

| Faili | Maudhui |
|---|---|
| `00` | uthibitisho |
| `01` | gl_config/vipindi |
| `02` | double entry |
| `03` | chart of accounts |
| `02a` | sales bila journal |
| `04`, `04b` | matukio yasiyogusa GL |
| `05`, `05b`, `05c` | capital |
| `06`, `06b`, `06c` | AR ya 01/09 |
| `07`, `07b` | control vs sub-ledger |
| `08` | alama ya variance |
| `09` | ukamilifu/ufuatiliaji/vipindi/COGS |
| `08-day-close-sign-20261015.out` | (h.0) H-1 kwenye 15/10 |
| `10`, `10b`, `10c`, `10d` | (h.1) siku za ziada: sales zilizochelewa, madeni, makusanyo, pesa ya jana |
| `11` | (h.3) sales zilizochelewa kwa makundi |
| `12` | (h.4) debt payments za 0.00 |
| `13` | (h.5) chanzo cha kodi ya mwaka |
| `14` | (h.2) salio la pesa na mtiririko wa reco |
| `15`, `15b` | (h.6) pengo la Julai/Agosti, kwenye 14/10 na 15/10 |
| `16` | (i.2) gharama za reco dhidi ya GL, gharama mara mbili, reco purchases dhidi ya purchases |
| `17` | (i.3) gharama za Daily P&L dhidi ya GL kwa mwezi; tarehe ya gharama za reco |
| `18` | (i.1) ukamilifu wa journal kwa kila chanzo |

Sehemu (h) na (i) ziliendeshwa kwenye `lsms_audit_20261015_0200` (`15` pia kwenye `lsms_audit`), kila session ikiwa `default_transaction_read_only = on`.

Session zote ziliendeshwa na `default_transaction_read_only = on`. **Nyongeza kwa kanuni ya 1:** ili kueleza AR ya 01/09, dump ya prod ya 04/10 (`backups/lsms_20261004_0200.dump`, ilikuwa tayari kwenye PC) ilirejeshwa kwenye database ya pili `lsms_audit_1004` (kusoma tu). Si dev wala staging.
