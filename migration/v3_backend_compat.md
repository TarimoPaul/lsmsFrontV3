# Ulinganifu wa Angular V3 na backend ya prod (2.2.58) — 2026-10-02

> Read-only. Hakuna kilichodeploy, hakuna code ya backend iliyobadilishwa.
> Lebo: **[Certain]** = nimesoma code/jar yenyewe · **(Likely)** = inatokana na code, haijajaribiwa kwenye prod leo.

## Mambo 3 muhimu zaidi

1. **Endpoints 231 kati ya 237 ziko OK.** Tofauti zote (1 MISSING, 5 CHANGED) ziko sehemu tatu tu:
   arifa (notifications), profile ya mtumiaji, na ripoti ya madeni yaliyofutwa. Mauzo, POS, manunuzi,
   stoo, reconciliation, GL, mtaji, wateja, wasambazaji, watumiaji na ripoti — hakuna tofauti. [Certain]
2. **Kasoro inayoonekana zaidi ukideploy V3 juu ya 2.2.58: mabango ya "amelipa deni" yatakuwa ya uongo.**
   2.2.58 inapuuza vichujio `types` na `unreadOnly`, kwa hiyo V3 itaonyesha arifa 50 za mwisho za aina
   ZOTE (hata zilizosomwa) kama mabango ya madeni, kwa kila mtumiaji, kila anapoingia. (C1) [Certain kwa code]
3. **Marekebisho yote yapo tayari kwenye source ya backend (commit `7b126db`), lakini hayajajengwa wala
   kudeploy.** Build inayofuata ya `deploy.ps1` itakuwa **2.2.59** (ina migration mpya `V123`).
   Pendekezo: deploy backend 2.2.59 kwanza, ndipo watumiaji waelekezwe V3. Kujaribu V3 juu ya 2.2.58
   ni salama kwa data (angalia sehemu 4), ila kasoro za sehemu 3 zitaonekana.

---

## 1. Toleo la prod ni lipi hasa

| | |
|---|---|
| Image ya prod (Contabo) | `chiefmaster/my-lsms-backend:2.2.58`, ID `sha256:1e06c4eb…6836`, imejengwa 2026-09-30 15:44:22 EAT [Certain] |
| Image ya local (PC) | ID ileile `sha256:1e06c4eb…6836` → jar niliyochambua ndiyo inayoendesha prod [Certain] |
| Git tag | **Hakuna tag** kwenye repo ya backend. `.backend-version` inaandikwa baada ya push, kwa hiyo commit iliyojengwa inaonyesha `2.2.57` [Certain] |
| Commit ya 2.2.58 | **`10c3bc0`** (2026-09-30 15:43:30 EAT — sekunde 52 kabla ya build) [Certain — angalia uthibitisho] |
| HEAD ya sasa | `7b126db` (2026-10-02 20:58) — commit 1 mbele ya prod; **haijajengwa** (hakuna image ya 2.2.59) [Certain] |

Uthibitisho kwamba jar = `10c3bc0`: (a) jar ina request mappings **599** za method, sawa kabisa na source ya
`10c3bc0` (HEAD ina 600); (b) jar ina badiliko la mwisho la `10c3bc0` (`SafeBoxController.branchOrActive`);
(c) jar **haina** chochote cha `7b126db`: hakuna `UserProfileImage`, hakuna `V123` (migration ya mwisho ni
`V122`), `DebtAdjustmentRepository` bado ni `@Query` ya zamani, hakuna `/unread-counts`.

Pendekezo dogo: baada ya kila deploy ya backend, `git tag backend-v<toleo>` — leo toleo la prod
linapatikana kwa kulinganisha saa tu.

## 2. Njia iliyotumika (na mipaka yake)

- **Backend:** `app.jar` ilitolewa kwenye image ya 2.2.58; controllers zote 38 zilisomwa kwa `javap -v`
  (annotations za `@RequestMapping/@GetMapping/…` na `@RequestParam`) → mappings **600** (method + path).
  Hii ni jar halisi ya prod, si source ya branch.
- **V3:** kila mwito wa `ApiService`/`HttpClient` ndani ya `src/` (bila `*.spec.ts`) ulitolewa kwa script:
  sehemu 242 za mwito → endpoints **237** tofauti (method + path). Hakuna mwito wa API uliobaki bila
  kutambuliwa (zilizobaki ni `ApiService` yenyewe na maoni/comments).
- **Ulinganisho:** method + path (vigezo vya path vinalingana na sehemu yoyote), kisha query params ambazo V3
  inatuma dhidi ya `@RequestParam` za 2.2.58.
- **Mipaka:** script hailinganishi fields za body/response moja moja. Hili linafungwa hivi: V3 ilijengwa na
  kujaribiwa dhidi ya backend ya local, ambayo source yake leo ni `7b126db`. Tofauti **nzima** kati ya
  `7b126db` na prod (`10c3bc0`) ni faili 5 za Java + `V123` — nimezisoma zote; hakuna DTO iliyobadilika.
  Kwa hiyo kila tofauti ya tabia kati ya "backend V3 iliyojaribiwa nayo" na "backend ya prod" imeorodheshwa
  kwenye sehemu 3. Sikuita endpoints za prod zenye login (hakuna jaribio la moja kwa moja kwenye prod).

## 3. Tofauti — 1 MISSING, 5 CHANGED

Zote zinarekebishwa na commit `7b126db` → toleo linalofuata **2.2.59** (bado halijajengwa).

| # | Endpoint | Hali kwenye 2.2.58 | Nini kinavunjika kwenye V3 |
|---|---|---|---|
| **M1** | `GET /api/v1/notifications/unread-counts` | **Haipo** (404). Imeongezwa na `7b126db`. [Certain] | Namba za arifa zisizosomwa kwenye tabs za inbox (Madeni / Manunuzi / Mauzo / Bei) zinabaki 0. Kitufe "Soma zote" kinazimwa kwenye tabs hizo (kinafanya kazi kwenye "Zote" tu). Namba kuu ya kengele inaendelea kufanya kazi (`/unread-count` ipo). Ombi lililoshindwa hutokea mara moja kila idadi inapobadilika, si kila sekunde 10. |
| **C1** | `GET /api/v1/notifications?types=&unreadOnly=` | Njia ipo lakini inasoma `page` na `size` tu; `types` na `unreadOnly` **zinapuuzwa**. [Certain] | (a) **Mabango ya madeni**: V3 inaomba "DEBT + zisizosomwa", inapata arifa 50 za mwisho za aina zote, na haichuji upande wake → mabango ya uongo kwa kila mtumiaji (3 yanaonekana + "+N zaidi") hadi ayafunge. (b) Tabs za inbox zote zinaonyesha orodha ileile. (c) "Zisizosomwa tu" haifanyi kitu. |
| **C2** | `PATCH /api/v1/notifications/mark-all-read?types=` | Njia ipo; `types` inapuuzwa → inasoma **zote**. [Certain] | Kwa vitendo haifikiwi vibaya: kwa sababu ya M1 kitufe kimezimwa kwenye tabs za aina; kwenye "Zote" V3 haitumi `types`, na tabia ni sahihi. Hatari ni ndogo. |
| **C3** | `GET /api/debt-adjustments/report` | Njia ipo lakini query ya JPQL `(:param IS NULL OR …)` inashindwa kwenye Postgres → **500** kila mwito. (Likely — ilionekana kwenye prod 09-30; code ya jar haijabadilika.) | Wateja → "Yaliyofutwa bila malipo": panel inaonyesha kosa "Imeshindikana kupakia madeni yaliyofutwa". Tab ya Flutter ya "Waived" imevunjika vilevile leo. Hakuna kingine kinachoathirika. |
| **C4** | `GET /api/user/profile` | Njia ipo lakini inatumia `findByEmail` kisha inasoma `roles` (lazy) → `LazyInitializationException` → **500**. (Likely) | Akaunti → maelezo ya profile: fomu ya jina/simu/jinsia haipakii (kosa). Kuhifadhi (`PUT /api/user/profile`) kunafanya kazi. Flutter ina tatizo hilohilo leo. |
| **C5** | `POST /api/user/profile-image` (+ `GET /api/user/profile-image/{filename}`) | Zinafanya kazi, lakini picha inahifadhiwa kwenye **disk ya container** (`/uploads/profiles`), si DB. [Certain] | Kupakia picha kunafanya kazi, lakini picha inapotea backend inapodeploy tena (avatar inarudi kwenye herufi za jina — V3 inashughulikia 404). 2.2.59 inahamishia DB (`V123`). |

**Kinachohitajika kwenye 2.2.59 (tayari kiko `7b126db`):** `NotificationController/Service/Repository`
(`types`, `unreadOnly`, `/unread-counts`, `mark-all-read?types`), `DebtAdjustmentRepository` (Specification),
`UserController` (`findByEmailWithRoles`, picha kwenye DB), `UserProfileImage` + `V123__User_Profile_Images.sql`.
Mabadiliko yote ni ya kuongeza (additive): Flutter haiathiriki — na C3/C4 zinarekebisha Flutter pia.

**Njia mbadala bila backend (haijafanyika — inahitaji ruhusa yako):** V3 ichuje mabango upande wake
(`!isRead` + aina za DEBT) ndani ya `notification-center.service.ts`. Hiyo inaondoa kasoro ya C1(a) hata juu
ya 2.2.58 na ni kinga nzuri hata baada ya 2.2.59. M1, C1(b,c), C3, C4, C5 zinabaki hadi backend ideploy.

## 4. Je, ni salama kujaribu V3 juu ya 2.2.58?

- **Data ya biashara: ndiyo.** Endpoints zote za kuandika (mauzo, malipo, manunuzi, stoo, recon, GL, mtaji,
  matumizi, watumiaji, roles) ziko OK na ni zilezile V3 ilizojaribiwa nazo. [Certain]
- **Uandishi pekee wenye tabia tofauti** ni C2 (alama za "imesomwa" za arifa) na C5 (picha ya profile) —
  hakuna kati ya hizo inayogusa fedha wala stoo.
- **Kinachoonekana vibaya:** mabango ya uongo (C1a), inbox isiyochuja (C1b/c), namba za tabs 0 (M1),
  panel ya madeni yaliyofutwa (C3), fomu ya profile (C4).
- Flutter haiathiriki kwa namna yoyote na V3 kuwepo `/v3/`.

## 5. Orodha kamili — endpoints 237 (OK 231 · MISSING 1 · CHANGED 5)

`{}` = kigezo cha path (uid, tarehe…). "Handler" ni `Controller.method` ndani ya jar ya 2.2.58.

### `auth` — 5 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/auth/login` | OK | `AuthController.login` | `core/auth/auth.service.ts:101` |
| POST | `/api/auth/logout` | OK | `AuthController.logout` | `core/auth/auth.service.ts:215` |
| GET | `/api/auth/me` | OK | `AuthController.getCurrentUser` | `core/auth/auth.service.ts:241` |
| POST | `/api/auth/refresh` | OK | `AuthController.refreshToken` | `core/auth/auth.service.ts:281` |
| POST | `/api/auth/select-branch` | OK | `AuthController.selectBranch` | `core/auth/auth.service.ts:124` |

### `branches` — 6 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/branches` | OK | `BranchController.getAllBranches` | `features/branches/branches.service.ts:20` |
| POST | `/api/v1/branches` | OK | `BranchController.createBranch` | `features/branches/branches.service.ts:25` |
| DELETE | `/api/v1/branches/{}` | OK | `BranchController.deleteBranch` | `features/branches/branches.service.ts:37` |
| PUT | `/api/v1/branches/{}` | OK | `BranchController.updateBranch` | `features/branches/branches.service.ts:31` |
| POST | `/api/v1/branches/{}/reactivate` | OK | `BranchController.reactivateBranch` | `features/branches/branches.service.ts:47` |
| POST | `/api/v1/branches/{}/suspend` | OK | `BranchController.suspendBranch` | `features/branches/branches.service.ts:42` |

### `business` — 3 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/business/configuration` | OK | `BusinessConfigurationController.getConfiguration` | `features/business-settings/business-settings.service.ts:72` |
| PUT | `/api/v1/business/configuration` | OK | `BusinessConfigurationController.updateConfiguration` | `features/business-settings/business-settings.service.ts:105` |
| POST | `/api/v1/business/initial-setup` | OK | `BusinessConfigurationController.saveInitialSetup` | `features/business-settings/business-settings.service.ts:106` |

### `business-settings` — 3 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/business-settings/main` | OK | `BusinessSettingsController.getMainSettings` | `features/business-settings/business-settings.service.ts:65` |
| PUT | `/api/v1/business-settings/main` | OK | `BusinessSettingsController.updateMainSettings` | `features/business-settings/business-settings.service.ts:81` |
| GET | `/api/v1/business-settings/resolved` | OK | `BusinessSettingsController.getResolvedSettings` | `core/data/business.service.ts:29` |

### `capital-expenditure` — 9 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/capital-expenditure` | OK | `CapitalExpenditureController.getAllCapitalExpenditures` | `features/capital/capital.service.ts:52` |
| POST | `/api/v1/capital-expenditure` | OK | `CapitalExpenditureController.createCapitalExpenditure` | `features/capital/capital.service.ts:83` |
| PATCH | `/api/v1/capital-expenditure/{}/approve` | OK | `CapitalExpenditureController.approveCapitalExpenditure` | `features/capital/capital.service.ts:89` |
| PATCH | `/api/v1/capital-expenditure/{}/dispose` | OK | `CapitalExpenditureController.disposeAsset` | `features/capital/capital.service.ts:102` |
| PATCH | `/api/v1/capital-expenditure/{}/status` | OK | `CapitalExpenditureController.updateStatus` | `features/capital/capital.service.ts:96` |
| PATCH | `/api/v1/capital-expenditure/assets/update-all-depreciation` | OK | `CapitalExpenditureController.updateAllAssetDepreciation` | `features/capital/capital.service.ts:108` |
| GET | `/api/v1/capital-expenditure/recurring-monthly` | OK | `CapitalExpenditureController.getRecurringMonthlyBudgets` | `features/capital/capital.service.ts:143` |
| PATCH | `/api/v1/capital-expenditure/recurring-monthly/{}/amount` | OK | `CapitalExpenditureController.updateRecurringMonthlyAmount` | `features/capital/capital.service.ts:155` |
| PATCH | `/api/v1/capital-expenditure/recurring-monthly/{}/stop` | OK | `CapitalExpenditureController.stopRecurringMonthlyBudget` | `features/capital/capital.service.ts:148` |

### `capital-monitoring` — 5 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/capital-monitoring/injections` | OK | `CapitalMonitoringController.getCapitalInjectionHistory` | `features/capital/capital.service.ts:58` |
| POST | `/api/v1/capital-monitoring/injections` | OK | `CapitalMonitoringController.recordCapitalInjection` | `features/capital/capital.service.ts:123` |
| GET | `/api/v1/capital-monitoring/loans` | OK | `CapitalMonitoringController.getAllLoans` | `features/capital/capital.service.ts:64` |
| POST | `/api/v1/capital-monitoring/loans/{}/reclassify` | OK | `CapitalMonitoringController.reclassifyLoan` | `features/capital/capital.service.ts:135` |
| POST | `/api/v1/capital-monitoring/loans/{}/repay` | OK | `CapitalMonitoringController.repayLoan` | `features/capital/capital.service.ts:129` |

### `categories` — 4 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/categories` | OK | `CategoryController.getAllCategories` | `core/api/api.service.ts:21`, `features/categories/categories.service.ts:23` |
| POST | `/api/v1/categories` | OK | `CategoryController.createCategory` | `features/categories/categories.service.ts:28` |
| DELETE | `/api/v1/categories/{}` | OK | `CategoryController.deleteCategory` | `features/categories/categories.service.ts:44` |
| PUT | `/api/v1/categories/{}` | OK | `CategoryController.updateCategory` | `features/categories/categories.service.ts:36` |

### `counting` — 12 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/counting/sessions` | OK | `CountingController.listSessions` | `features/counting/counting.service.ts:75` |
| POST | `/api/v1/counting/sessions` | OK | `CountingController.startSession` | `features/counting/counting.service.ts:60` |
| GET | `/api/v1/counting/sessions/{}` | OK | `CountingController.getSession` | `features/counting/counting.service.ts:70` |
| POST | `/api/v1/counting/sessions/{}/approve` | OK | `CountingController.approveSession` | `features/counting/counting.service.ts:121` |
| POST | `/api/v1/counting/sessions/{}/complete` | OK | `CountingController.completeSession` | `features/counting/counting.service.ts:92` |
| POST | `/api/v1/counting/sessions/{}/complete-recount` | OK | `CountingController.completeRecount` | `features/counting/counting.service.ts:109` |
| POST | `/api/v1/counting/sessions/{}/force-close` | OK | `CountingController.forceClose` | `features/counting/counting.service.ts:125` |
| PUT | `/api/v1/counting/sessions/{}/lines` | OK | `CountingController.submitLine` | `features/counting/counting.service.ts:81` |
| PUT | `/api/v1/counting/sessions/{}/lines/{}/explanation` | OK | `CountingController.submitLineExplanation` | `features/counting/counting.service.ts:87` |
| PUT | `/api/v1/counting/sessions/{}/lines/{}/recount` | OK | `CountingController.submitRecount` | `features/counting/counting.service.ts:104` |
| POST | `/api/v1/counting/sessions/{}/recount-list` | OK | `CountingController.recountList` | `features/counting/counting.service.ts:97` |
| GET | `/api/v1/counting/sessions/active` | OK | `CountingController.getActiveSession` | `features/counting/counting.service.ts:65` |

### `customers` — 13 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/customers` | OK | `CustomerController.getAllCustomers` | `features/customers/customers.service.ts:45` |
| POST | `/api/v1/customers` | OK | `CustomerController.createCustomer` | `features/customers/customers.service.ts:77` |
| DELETE | `/api/v1/customers/{}` | OK | `CustomerController.deleteCustomer` | `features/customers/customers.service.ts:95` |
| PUT | `/api/v1/customers/{}` | OK | `CustomerController.updateCustomer` | `features/customers/customers.service.ts:86` |
| GET | `/api/v1/customers/{}/audit-log` | OK | `CustomerController.getCustomerAuditLog` | `features/customers/customers.service.ts:170` |
| GET | `/api/v1/customers/{}/purchase-history` | OK | `CustomerController.getCustomerPurchaseHistory` | `features/customers/customers.service.ts:156` |
| GET | `/api/v1/customers/{}/sales-analytics` | OK | `CustomerController.getCustomerSalesAnalytics` | `features/customers/customers.service.ts:138` |
| GET | `/api/v1/customers/{}/statement` | OK | `CustomerController.getCustomerArStatement` | `features/customers/customers.service.ts:107` |
| GET | `/api/v1/customers/debt-payments` | OK | `CustomerController.getDebtPayments` | `features/customers/customers.service.ts:181` |
| GET | `/api/v1/customers/debt-payments/summary` | OK | `CustomerController.getDebtPaymentsSummary` | `features/customers/customers.service.ts:213` |
| POST | `/api/v1/customers/merge` | OK | `CustomerController.mergeCustomers` | `features/customers/customers.service.ts:101` |
| GET | `/api/v1/customers/unpaid/paged` | OK | `CustomerController.getUnpaidCustomersPaged` | `features/customers/customers.service.ts:58` |
| GET | `/api/v1/customers/unpaid/total` | OK | `CustomerController.getUnpaidTotal` | `features/dashboard/dashboard-kpi.service.ts:87` |

### `debt-adjustments` — 8 endpoints, 1 si OK

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/debt-adjustments` | OK | `DebtAdjustmentController.create` | `features/sales/debt.service.ts:127` |
| POST | `/api/debt-adjustments/{}/approve` | OK | `DebtAdjustmentController.approve` | `features/sales/debt.service.ts:131` |
| POST | `/api/debt-adjustments/{}/cancel` | OK | `DebtAdjustmentController.cancel` | `features/sales/debt.service.ts:139` |
| POST | `/api/debt-adjustments/{}/reject` | OK | `DebtAdjustmentController.reject` | `features/sales/debt.service.ts:135` |
| GET | `/api/debt-adjustments/customer/{}` | OK | `DebtAdjustmentController.byCustomer` | `features/sales/debt.service.ts:158` |
| GET | `/api/debt-adjustments/pending` | OK | `DebtAdjustmentController.pending` | `features/dashboard/dashboard-alerts.service.ts:114`, `features/sales/debt.service.ts:143` |
| GET | `/api/debt-adjustments/report` | **CHANGED** (C3) | `DebtAdjustmentController.report` | `features/sales/debt.service.ts:154` |
| GET | `/api/debt-adjustments/sale/{}` | OK | `DebtAdjustmentController.bySale` | `features/sales/debt.service.ts:147` |

### `gl` — 13 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/gl/accounts` | OK | `GLController.getAccounts` | `features/general-ledger/gl.service.ts:35` |
| GET | `/api/v1/gl/balance-sheet` | OK | `GLController.getBalanceSheet` | `features/general-ledger/gl.service.ts:60` |
| GET | `/api/v1/gl/control-checks` | OK | `GLController.getControlChecks` | `features/general-ledger/gl.service.ts:52` |
| GET | `/api/v1/gl/financial-position` | OK | `GLController.getFinancialPosition` | `features/general-ledger/gl.service.ts:48` |
| GET | `/api/v1/gl/income-statement` | OK | `GLController.getIncomeStatement` | `features/general-ledger/gl.service.ts:64` |
| GET | `/api/v1/gl/journal-entries` | OK | `GLController.getJournalEntries` | `features/general-ledger/gl.service.ts:72` |
| POST | `/api/v1/gl/journal-entries/manual` | OK | `GLController.manualJournal` | `features/general-ledger/gl.service.ts:78` |
| GET | `/api/v1/gl/ledger/{}` | OK | `GLController.getAccountLedger` | `features/general-ledger/gl.service.ts:68` |
| GET | `/api/v1/gl/status` | OK | `GLController.getStatus` | `features/general-ledger/gl.service.ts:44` |
| POST | `/api/v1/gl/transfers` | OK | `GLController.transfer` | `features/general-ledger/gl.service.ts:84` |
| GET | `/api/v1/gl/trial-balance` | OK | `GLController.getTrialBalance` | `features/general-ledger/gl.service.ts:56` |
| POST | `/api/v1/gl/true-up` | OK | `GLController.trueUp` | `features/general-ledger/gl.service.ts:90` |
| POST | `/api/v1/gl/true-up/cash` | OK | `GLController.trueUpCash` | `features/general-ledger/gl.service.ts:96` |

### `invoices` — 2 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/invoices` | OK | `InvoiceController.getAllInvoices` | `features/purchases/purchases.service.ts:144` |
| POST | `/api/v1/invoices` | OK | `InvoiceController.saveInvoice` | `features/purchases/purchases.service.ts:171` |

### `items-measure` — 4 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/items-measure` | OK | `ItemsMeasureController.getAllItemsMeasures` | `features/items-measure/measures.service.ts:28` |
| POST | `/api/v1/items-measure` | OK | `ItemsMeasureController.addItemsMeasure` | `features/items-measure/measures.service.ts:33` |
| DELETE | `/api/v1/items-measure/{}` | OK | `ItemsMeasureController.deleteItemsMeasure` | `features/items-measure/measures.service.ts:49` |
| PUT | `/api/v1/items-measure/{}` | OK | `ItemsMeasureController.updateItemsMeasure` | `features/items-measure/measures.service.ts:41` |

### `liabilities` — 7 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/liabilities` | OK | `LiabilityController.listLiabilities` | `features/counting/counting.service.ts:147` |
| PUT | `/api/liabilities/{}/deduction-plan` | OK | `LiabilityController.setDeductionPlan` | `features/counting/counting.service.ts:189` |
| POST | `/api/liabilities/{}/payments` | OK | `LiabilityController.recordPayment` | `features/counting/counting.service.ts:170` |
| POST | `/api/liabilities/{}/void-surplus` | OK | `LiabilityController.voidSurplusCharge` | `features/counting/counting.service.ts:175` |
| POST | `/api/liabilities/items/{}/acknowledge` | OK | `LiabilityController.acknowledgeItem` | `features/counting/counting.service.ts:152` |
| POST | `/api/liabilities/items/{}/dispute` | OK | `LiabilityController.disputeItem` | `features/counting/counting.service.ts:157` |
| GET | `/api/liabilities/my` | OK | `LiabilityController.getMyLiabilities` | `features/counting/counting.service.ts:142`, `features/dashboard/dashboard-alerts.service.ts:90` |

### `notifications` — 5 endpoints, 3 si OK

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/notifications` | **CHANGED** (C1) | `NotificationController.getNotifications` | `core/notifications/notification-center.service.ts:95` |
| PATCH | `/api/v1/notifications/{}/read` | OK | `NotificationController.markAsRead` | `core/notifications/notification-center.service.ts:103` |
| PATCH | `/api/v1/notifications/mark-all-read` | **CHANGED** (C2) | `NotificationController.markAllAsRead` | `core/notifications/notification-center.service.ts:110` |
| GET | `/api/v1/notifications/unread-count` | OK | `NotificationController.getUnreadCount` | `core/notifications/notification-center.service.ts:67` |
| GET | `/api/v1/notifications/unread-counts` | **MISSING** (M1) | — | `core/notifications/notification-center.service.ts:78` |

### `payments` — 1 endpoint

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/payments/available-payment-methods` | OK | `PaymentController.getAvailablePaymentMethods` | `features/sales/sales.service.ts:26` |

### `products` — 4 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/products` | OK | `ProductController.getAllProducts` | `features/products/products.service.ts:25` |
| POST | `/api/v1/products` | OK | `ProductController.createProduct` | `features/products/products.service.ts:30` |
| DELETE | `/api/v1/products/{}` | OK | `ProductController.deleteProduct` | `features/products/products.service.ts:47` |
| PUT | `/api/v1/products/{}` | OK | `ProductController.updateProduct` | `features/products/products.service.ts:38` |

### `public` — 4 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/public/password/forgot-password` | OK | `PasswordResetController.forgotPassword` | `core/auth/auth.service.ts:177` |
| POST | `/api/public/password/reset-password` | OK | `PasswordResetController.resetPassword` | `core/auth/auth.service.ts:201` |
| GET | `/api/public/password/validate-token` | OK | `PasswordResetController.validateToken` | `core/auth/auth.service.ts:187` |
| POST | `/api/public/register` | OK | `UserController.register` | `core/auth/auth.service.ts:158` |

### `purchases` — 16 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/purchases` | OK | `PurchaseController.getAllPurchases` | `features/purchases/purchases.service.ts:48` |
| POST | `/api/v1/purchases` | OK | `PurchaseController.createPurchase` | `features/purchases/purchases.service.ts:112` |
| DELETE | `/api/v1/purchases/{}` | OK | `PurchaseController.deletePurchase` | `features/purchases/purchases.service.ts:181` |
| GET | `/api/v1/purchases/{}` | OK | `PurchaseController.getPurchase` | `features/purchases/purchases.service.ts:68` |
| PUT | `/api/v1/purchases/{}` | OK | `PurchaseController.updatePurchase` | `features/purchases/purchases.service.ts:176` |
| POST | `/api/v1/purchases/{}/approve` | OK | `PurchaseController.approvePurchase` | `features/purchases/purchases.service.ts:185` |
| POST | `/api/v1/purchases/{}/cancel` | OK | `PurchaseController.cancelPurchase` | `features/purchases/purchases.service.ts:215` |
| POST | `/api/v1/purchases/{}/receive` | OK | `PurchaseController.receivePurchase` | `features/purchases/purchases.service.ts:189` |
| POST | `/api/v1/purchases/bulk/{}` | OK (approve / receive / cancel — zote tatu zipo) | `PurchaseController.bulkApprovePurchases` | `features/purchases/purchases.service.ts:200` |
| GET | `/api/v1/purchases/date-range` | OK | `PurchaseController.getPurchasesByDateRange` | `features/purchases/purchases.service.ts:53` |
| GET | `/api/v1/purchases/product/{}` | OK | `PurchaseController.getPurchasesByProduct` | `features/purchases/purchases.service.ts:63` |
| GET | `/api/v1/purchases/product/{}/eligibility` | OK | `PurchaseController.checkPurchaseEligibility` | `features/purchases/purchases.service.ts:73` |
| POST | `/api/v1/purchases/repurchase/bulk` | OK | `PurchaseController.bulkRepurchase` | `features/purchases/purchases.service.ts:133` |
| GET | `/api/v1/purchases/repurchase/products` | OK | `PurchaseController.getRepurchasableProducts` | `features/purchases/purchases.service.ts:42` |
| GET | `/api/v1/purchases/repurchase/template/{}` | OK | `PurchaseController.getRepurchaseTemplate` | `features/purchases/purchases.service.ts:83` |
| GET | `/api/v1/purchases/status/{}` | OK | `PurchaseController.getPurchasesByStatus` | `features/purchases/purchases.service.ts:58` |

### `reconciliation` — 33 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/v1/reconciliation` | OK | `ReconciliationController.createOrUpdate` | `features/reconciliation/reconciliation.service.ts:69` |
| GET | `/api/v1/reconciliation/{}` | OK | `ReconciliationController.getByUid` | `features/reconciliation/reconciliation.service.ts:59` |
| POST | `/api/v1/reconciliation/{}/approve` | OK | `ReconciliationController.approve` | `features/reconciliation/reconciliation.service.ts:174` |
| GET | `/api/v1/reconciliation/{}/audit-log` | OK | `ReconciliationController.getAuditLog` | `features/reconciliation/reconciliation.service.ts:152` |
| POST | `/api/v1/reconciliation/{}/cash-entry` | OK | `ReconciliationController.addCashEntry` | `features/reconciliation/reconciliation.service.ts:83` |
| DELETE | `/api/v1/reconciliation/{}/cash-entry/{}` | OK | `ReconciliationController.removeCashEntry` | `features/reconciliation/reconciliation.service.ts:86` |
| POST | `/api/v1/reconciliation/{}/expense` | OK | `ReconciliationController.addExpense` | `features/reconciliation/reconciliation.service.ts:95` |
| DELETE | `/api/v1/reconciliation/{}/expense/{}` | OK | `ReconciliationController.removeExpense` | `features/reconciliation/reconciliation.service.ts:98` |
| POST | `/api/v1/reconciliation/{}/mobile-entry` | OK | `ReconciliationController.addMobileEntry` | `features/reconciliation/reconciliation.service.ts:89` |
| DELETE | `/api/v1/reconciliation/{}/mobile-entry/{}` | OK | `ReconciliationController.removeMobileEntry` | `features/reconciliation/reconciliation.service.ts:92` |
| POST | `/api/v1/reconciliation/{}/purchase` | OK | `ReconciliationController.addPurchase` | `features/reconciliation/reconciliation.service.ts:123` |
| DELETE | `/api/v1/reconciliation/{}/purchase/{}` | OK | `ReconciliationController.removePurchase` | `features/reconciliation/reconciliation.service.ts:126` |
| POST | `/api/v1/reconciliation/{}/refresh` | OK | `ReconciliationController.refresh` | `features/reconciliation/reconciliation.service.ts:64` |
| POST | `/api/v1/reconciliation/{}/reopen` | OK | `ReconciliationController.reopen` | `features/reconciliation/reconciliation.service.ts:177` |
| POST | `/api/v1/reconciliation/{}/retail-debt` | OK | `ReconciliationController.addRetailDebt` | `features/reconciliation/reconciliation.service.ts:110` |
| POST | `/api/v1/reconciliation/{}/review` | OK | `ReconciliationController.review` | `features/reconciliation/reconciliation.service.ts:171` |
| GET | `/api/v1/reconciliation/{}/snapshot` | OK | `ReconciliationController.getSnapshot` | `features/reconciliation/reconciliation.service.ts:148` |
| POST | `/api/v1/reconciliation/{}/submit` | OK | `ReconciliationController.submit` | `features/reconciliation/reconciliation.service.ts:165` |
| POST | `/api/v1/reconciliation/{}/unsubmit` | OK | `ReconciliationController.unsubmit` | `features/reconciliation/reconciliation.service.ts:168` |
| PUT | `/api/v1/reconciliation/{}/variance-explanation` | OK | `ReconciliationController.updateVarianceExplanation` | `features/reconciliation/reconciliation.service.ts:183` |
| POST | `/api/v1/reconciliation/{}/verify-item` | OK | `ReconciliationController.verifyItem` | `features/reconciliation/reconciliation.service.ts:180` |
| GET | `/api/v1/reconciliation/auto-summary/{}` | OK | `ReconciliationController.getAutoSummary` | `features/reconciliation/reconciliation.service.ts:43` |
| GET | `/api/v1/reconciliation/debt-collections` | OK | `ReconciliationController.getDebtCollectionsHistory` | `features/reconciliation/reconciliation.service.ts:137` |
| GET | `/api/v1/reconciliation/debt-collections/cross-collected` | OK | `ReconciliationController.getCrossCollectedDebts` | `features/reconciliation/reconciliation.service.ts:142` |
| GET | `/api/v1/reconciliation/debts` | OK | `ReconciliationController.getAllDebts` | `features/reconciliation/reconciliation.service.ts:104` |
| DELETE | `/api/v1/reconciliation/manual-debt/{}` | OK | `ReconciliationController.deleteManualDebt` | `features/reconciliation/reconciliation.service.ts:118` |
| PUT | `/api/v1/reconciliation/manual-debt/{}` | OK | `ReconciliationController.updateManualDebt` | `features/reconciliation/reconciliation.service.ts:114` |
| GET | `/api/v1/reconciliation/mine/date/{}` | OK | `ReconciliationController.getMyReconciliationByDate` | `features/reconciliation/reconciliation.service.ts:49` |
| GET | `/api/v1/reconciliation/mine/unclosed` | OK | `ReconciliationController.getMyUnclosedReconciliations` | `features/reconciliation/reconciliation.service.ts:77` |
| GET | `/api/v1/reconciliation/pending-approval` | OK | `ReconciliationController.getPendingApproval` | `features/dashboard/dashboard-alerts.service.ts:101`, `features/reconciliation/reconciliation.service.ts:73` |
| GET | `/api/v1/reconciliation/purchase-link-status` | OK | `ReconciliationController.getPurchaseLinkStatus` | `features/reconciliation/reconciliation.service.ts:131` |
| GET | `/api/v1/reconciliation/team/date/{}` | OK | `ReconciliationController.getTeamReconciliationsByDate` | `features/reconciliation/reconciliation.service.ts:54` |
| GET | `/api/v1/reconciliation/variance-report` | OK | `ReconciliationController.getVarianceReport` | `features/reconciliation/reconciliation.service.ts:156` |

### `reports` — 3 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/reports/ar` | OK | `ReportsController.getAccountsReceivable` | `features/reports/reports.service.ts:50` |
| GET | `/api/reports/ar/summary` | OK | `ReportsController.getArAgingSummary` | `features/reports/reports.service.ts:55` |
| GET | `/api/reports/deleted-debts` | OK | `ReportsController.getDeletedDebts` | `features/reports/reports.service.ts:68` |

### `roles` — 6 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/roles` | OK | `RoleController.getAllRoles` | `features/roles/roles.service.ts:21` |
| POST | `/api/v1/roles` | OK | `RoleController.saveRole` | `features/roles/roles.service.ts:30` |
| DELETE | `/api/v1/roles/{}` | OK | `RoleController.deleteRole` | `features/roles/roles.service.ts:35` |
| GET | `/api/v1/roles/{}` | OK | `RoleController.getRole` | `features/roles/roles.service.ts:26` |
| POST | `/api/v1/roles/{}/permissions` | OK | `RoleController.assignPermissionsToRole` | `features/roles/roles.service.ts:40` |
| GET | `/api/v1/roles/permissions/modules` | OK | `RoleController.getPermissionModules` | `features/roles/roles.service.ts:44` |

### `safe-box` — 12 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| DELETE | `/api/v1/safe-box/{}` | OK | `SafeBoxController.cancelDeposit` | `features/reconciliation/safe-box.service.ts:61` |
| PUT | `/api/v1/safe-box/{}` | OK | `SafeBoxController.editDeposit` | `features/reconciliation/safe-box.service.ts:56` |
| POST | `/api/v1/safe-box/{}/confirm` | OK | `SafeBoxController.confirm` | `features/reconciliation/safe-box.service.ts:72` |
| POST | `/api/v1/safe-box/{}/reject` | OK | `SafeBoxController.reject` | `features/reconciliation/safe-box.service.ts:76` |
| POST | `/api/v1/safe-box/deposit` | OK | `SafeBoxController.submitDeposit` | `features/reconciliation/safe-box.service.ts:52` |
| GET | `/api/v1/safe-box/eligible-recipients` | OK | `SafeBoxController.eligibleRecipients` | `features/reconciliation/safe-box.service.ts:42` |
| GET | `/api/v1/safe-box/entry/{}/history` | OK | `SafeBoxController.entryHistory` | `features/reconciliation/safe-box.service.ts:48` |
| POST | `/api/v1/safe-box/entry/{}/request-deposit` | OK | `SafeBoxController.requestCashierDeposit` | `features/reconciliation/safe-box.service.ts:92` |
| GET | `/api/v1/safe-box/my-pending` | OK | `SafeBoxController.myPending` | `features/reconciliation/safe-box.service.ts:38` |
| GET | `/api/v1/safe-box/outstanding` | OK | `SafeBoxController.outstanding` | `features/reconciliation/safe-box.service.ts:81` |
| GET | `/api/v1/safe-box/pending` | OK | `SafeBoxController.pendingForManager` | `features/reconciliation/safe-box.service.ts:67` |
| GET | `/api/v1/safe-box/unconfirmed/{}` | OK | `SafeBoxController.unconfirmed` | `features/reconciliation/safe-box.service.ts:86` |

### `sales` — 23 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/sales` | OK | `SalesController.getAllSales` | `features/sales/sales.service.ts:41` |
| POST | `/api/v1/sales` | OK | `SalesController.createSale` | `core/api/api.service.ts:22` |
| DELETE | `/api/v1/sales/{}` | OK | `SalesController.deleteSale` | `features/sales/sales.service.ts:176` |
| GET | `/api/v1/sales/{}` | OK | `SalesController.getSale` | `features/sales/sales.service.ts:50` |
| PUT | `/api/v1/sales/{}` | OK | `SalesController.updateSale` | `features/sales/sales.service.ts:162` |
| POST | `/api/v1/sales/{}/payments` | OK | `SalesController.addPayment` | `features/sales/sales.service.ts:72` |
| POST | `/api/v1/sales/{}/restore` | OK | `SalesController.restoreDeletedSale` | `features/sales/sales.service.ts:171` |
| GET | `/api/v1/sales/{}/validate-return` | OK | `SalesController.validateSaleForReturn` | `features/sales/sales.service.ts:126` |
| GET | `/api/v1/sales/analytics/dashboard-summary` | OK | `SalesController.getDashboardSummary` | `features/dashboard/dashboard-kpi.service.ts:105`, `features/sales/sales.service.ts:46` |
| GET | `/api/v1/sales/analytics/missing-days` | OK | `SalesController.getMissingSalesDays` | `features/sales/sales.service.ts:78` |
| GET | `/api/v1/sales/analytics/top-products/quantity` | OK | `SalesController.getTopSellingProductsByQuantity` | `features/counting/counting.service.ts:130` |
| POST | `/api/v1/sales/bulk-delete` | OK | `SalesController.bulkDeleteSales` | `features/sales/sales.service.ts:181` |
| GET | `/api/v1/sales/customer/{}` | OK | `SalesController.getSalesByCustomer` | `features/sales/sales.service.ts:54` |
| GET | `/api/v1/sales/deleted` | OK | `SalesController.getDeletedSales` | `features/sales/sales.service.ts:166` |
| DELETE | `/api/v1/sales/details/{}` | OK | `SalesController.removeSaleDetail` | `features/sales/sales.service.ts:157` |
| PUT | `/api/v1/sales/details/{}` | OK | `SalesController.updateSaleDetail` | `features/sales/sales.service.ts:153` |
| POST | `/api/v1/sales/partial` | OK | `SalesController.createPartialSale` | `features/sales/sales.service.ts:102` |
| POST | `/api/v1/sales/pre-validate` | OK | `SalesController.validateCartItems` | `features/sales/sales.service.ts:87` |
| GET | `/api/v1/sales/returns` | OK | `SalesController.getAllSalesReturns` | `features/sales/sales.service.ts:116` |
| POST | `/api/v1/sales/returns` | OK | `SalesController.createSalesReturn` | `features/sales/sales.service.ts:140` |
| GET | `/api/v1/sales/returns/{}` | OK | `SalesController.getReturnByUid` | `features/sales/sales.service.ts:121` |
| POST | `/api/v1/sales/returns/{}/approve` | OK | `SalesController.approveSalesReturn` | `features/sales/sales.service.ts:144` |
| POST | `/api/v1/sales/returns/{}/reject` | OK | `SalesController.rejectSalesReturn` | `features/sales/sales.service.ts:148` |

### `settings-approvals` — 6 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/v1/settings-approvals` | OK | `SettingsApprovalController.createApprovalRequest` | `features/settings-approvals/settings-approvals.service.ts:99` |
| POST | `/api/v1/settings-approvals/{}/approve` | OK | `SettingsApprovalController.approveChange` | `features/settings-approvals/settings-approvals.service.ts:115` |
| POST | `/api/v1/settings-approvals/{}/cancel` | OK | `SettingsApprovalController.cancelApprovalRequest` | `features/settings-approvals/settings-approvals.service.ts:128` |
| POST | `/api/v1/settings-approvals/{}/reject` | OK | `SettingsApprovalController.rejectChangeByUid` | `features/settings-approvals/settings-approvals.service.ts:123` |
| GET | `/api/v1/settings-approvals/my-history` | OK | `SettingsApprovalController.getMyApprovalHistory` | `features/settings-approvals/settings-approvals.service.ts:93` |
| GET | `/api/v1/settings-approvals/pending` | OK | `SettingsApprovalController.getAllPendingChanges` | `features/settings-approvals/settings-approvals.service.ts:87` |

### `store` — 9 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| POST | `/api/store/adjustment` | OK | `StoreController.createStockAdjustment` | `features/store/store.service.ts:71` |
| GET | `/api/store/analytics/inventory/summary` | OK | `StoreController.getInventoryAnalyticsSummary` | `features/store/store.service.ts:40` |
| POST | `/api/store/damage-movement` | OK | `StoreController.createDamageMovement` | `features/store/store.service.ts:76` |
| GET | `/api/store/display/dashboard/stats` | OK | `StoreController.getComprehensiveDashboardStats` | `features/dashboard/dashboard-kpi.service.ts:94` |
| GET | `/api/store/display/entries/paginated` | OK | `StoreController.getAllStoreEntriesPaginated` | `features/store/store.service.ts:60` |
| GET | `/api/store/display/product/{}/movements` | OK | `StoreController.getProductMovementsForDisplay` | `features/store/store.service.ts:65` |
| GET | `/api/store/display/stock/available` | OK | `StoreController.getAvailableProductsForSale` | `features/sales/sales.service.ts:36` |
| GET | `/api/store/display/stock/summary` | OK | `StoreController.getCurrentStockSummaryForDisplay` | `features/store/store.service.ts:34` |
| POST | `/api/store/return-movement` | OK | `StoreController.createReturnMovement` | `features/store/store.service.ts:81` |

### `supplier-payments` — 3 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/supplier-payments` | OK | `SupplierPaymentController.list` | `features/suppliers/suppliers.service.ts:59` |
| POST | `/api/v1/supplier-payments` | OK | `SupplierPaymentController.record` | `features/suppliers/suppliers.service.ts:76` |
| DELETE | `/api/v1/supplier-payments/{}` | OK | `SupplierPaymentController.delete` | `features/suppliers/suppliers.service.ts:83` |

### `suppliers` — 5 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/v1/suppliers` | OK | `SupplierController.getAll` | `features/suppliers/suppliers.service.ts:32` |
| POST | `/api/v1/suppliers` | OK | `SupplierController.create` | `features/suppliers/suppliers.service.ts:37` |
| DELETE | `/api/v1/suppliers/{}` | OK | `SupplierController.delete` | `features/suppliers/suppliers.service.ts:50` |
| PUT | `/api/v1/suppliers/{}` | OK | `SupplierController.update` | `features/suppliers/suppliers.service.ts:44` |
| GET | `/api/v1/suppliers/{}/statement` | OK | `SupplierController.statement` | `features/suppliers/suppliers.service.ts:55` |

### `user` — 4 endpoints, 2 si OK

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| PUT | `/api/user/change-password` | OK | `UserController.changePassword` | `features/account/security-page.ts:83` |
| GET | `/api/user/profile` | **CHANGED** (C4) | `UserController.getCurrentUserProfile` | `features/account/profile-details.ts:130` |
| PUT | `/api/user/profile` | OK | `UserController.updateUserProfile` | `features/account/profile-details.ts:143` |
| POST | `/api/user/profile-image` | **CHANGED** (C5) | `UserController.uploadProfileImage` | `features/account/profile-details.ts:173` |

### `users` — 9 endpoints

| Method | Path (V3) | Hali | Handler ndani ya 2.2.58 | V3 inaita kutoka |
|---|---|---|---|---|
| GET | `/api/users` | OK | `UserController.getAllUsers` | `features/users/users.service.ts:35` |
| POST | `/api/users` | OK | `UserController.createUser` | `features/users/users.service.ts:59` |
| DELETE | `/api/users/{}` | OK | `UserController.deleteUser` | `features/users/users.service.ts:82` |
| PUT | `/api/users/{}/approve` | OK | `UserController.approveUser` | `features/users/users.service.ts:73` |
| GET | `/api/users/{}/details` | OK | `UserController.getUserDetails` | `features/users/users.service.ts:55` |
| PUT | `/api/users/{}/profile` | OK | `UserController.updateUserProfileByAdmin` | `features/users/users.service.ts:64` |
| PUT | `/api/users/{}/roles` | OK | `UserController.assignRolesToUser` | `features/users/users.service.ts:69` |
| PUT | `/api/users/{}/status` | OK | `UserController.updateUserStatusWithQueryParam` | `features/users/users.service.ts:77` |
| GET | `/api/users/statistics` | OK | `UserController.getUserStatistics` | `features/users/users.service.ts:51` |

---

*Imetengenezwa kwa script (javap ya jar ya 2.2.58 + uchambuzi wa `src/` ya V3 kwenye commit ya sasa);
hukumu za sehemu 3 ni za kusoma code kwa mkono.*
