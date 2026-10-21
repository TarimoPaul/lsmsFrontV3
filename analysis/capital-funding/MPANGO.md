# Mpango: Chanzo cha malipo, Pesa iliyokabidhiwa (1040), Kigunduzi cha pesa isiyo na chanzo, Daraja la Mtaji

> **15/10 jioni: mpango huu umepitwa na `MPANGO-PAMOJA.md`.** Unabaki kama historia; vipimo vyake ni vya `lsms_audit` (14/10).

Tarehe: 2026-10-15. Hali: **mpango tu, hakuna code iliyoandikwa.** Lengo: Angular V3 + backend (Flutter imestaafu; rekodi za zamani zisizo na chanzo zinabaki CASH).

Data yote imepimwa kwenye `lsms_audit` (dump ya prod 14/10, Flyway 131), kila session `default_transaction_read_only = on`. Queries: `analysis/capital-funding/NN-*.sql`, matokeo `NN-*.out`.

---

## 0. Mambo matatu ambayo mpango huu unatofautiana na maelekezo (yanahitaji uamuzi)

| # | Maelekezo | Data inaonyesha | Pendekezo |
|---|---|---|---|
| T1 | BANK_DEPOSIT → 1020 | Pesa ya benki karibu yote inaenda **NMB**: reco BANK_DEPOSIT NMB 68,309,000 (119), SELCOM 2,035,000 (4), CRDB 482,000 (2); safe box → NMB 12,082,700, SELCOM 720,000 (`03`) | BANK_DEPOSIT → akaunti ya benki kwa `bank_name` (NMB→1021, CRDB→1020, SELCOM→1023, NBC→1022, PCB→1024). Bila jina la benki: reco inakataa kuidhinishwa. Kuandika yote 1020 kungefanya CRDB iwe +80M na NMB hasi. |
| T2 | Hakuna kitu kuhusu mobile | POS inaandika karibu malipo yote kama CASH (tangu 30/09: CASH 21,180,500 / VODACOM 64,000), lakini reco inaona mobile 2–4.4M kwa mwezi (`04`). Yote yanakaa 1000 kwenye GL | Reco ikiidhinishwa, mobile entries zihamishwe 1000 → 103x kwa `provider`. Bila hili, (b) ya 1030 haina maana na 1000 itakuwa juu kila siku. |
| T3 | HAND_OVER → 1040 | HAND_OVER zote 6 (360,000) zinatoka kwenye reco `SAFE_BOX`; safe box yenyewe ilipokea 13,037,700 | Reco `SAFE_BOX` → 1040 (pesa imetoka droo). Safe box HAND_OVER = pesa inabaki 1040 (mlinzi anabadilika tu, hakuna journal). Safe box BANK_DEPOSIT → 1040 kwenda benki. |

Pia **"Awamu 1b"** haijaandikwa popote. Nimeichukulia kumaanisha **kumaliza ukaguzi**: majibu ya Q1–Q8 ya `RIPOTI.md` §g, na log ya hatua 34 (exception ya `postSale`). Nisahihishe kama ni kitu kingine.

---

## 1. Vipimo vipya (lsms_audit, 14/10)

### 1.1 Salio la akaunti za pesa tarehe 13/10 (`01`)

| Akaunti | Salio GL | Maelezo |
|---|---|---|
| 1000 Pesa Mkononi | **10,184,308.52** | 30/09 ilikuwa 22,816,803.99. Oktoba: mali 5,473,000, malipo ya wasambazaji 6,751,443, purchases 17,479,552 dhidi ya mauzo 19,112,000 (`02`) |
| 1020 CRDB | 0.00 | |
| 1021 NMB | 1,186,000.00 | Mkopo wa NMB tu. Amana 80M+ za NMB hazijawahi kutoka 1000 kwenye GL |
| 1030 Vodacom | 64,000.00 | |
| Nyingine 10xx | 0 | |

Baada ya H-1, H-2 na H-5, 1000 itakuwa takriban **11.96M** (10,184,308.52 + 1,593,899.90 + 191,500 − 11,300) (likely). Namba kamili itatoka kwenye journals za marekebisho.

**Maana:** GL 1000 leo ni "pesa yote ya biashara popote ilipo" (droo + safe box + NMB + simu). Haiwezi kulinganishwa na droo wala benki mpaka hatua ya 3 na 4.

### 1.2 Pengo la kila mwezi (`04`), likisahihisha makadirio ya 09-29

Pengo = (benki + safe box + mobile kutoka reco) + mkopo/mtaji − (purchases na supplier payments zilizolipwa kwa 10xx − reco purchases) − (gharama/mali − reco expenses) − kulipa mkopo.

| Mwezi | Siku za reco | Pesa iliyotoka droo + mkopo | Purchases nje ya droo | Gharama/mali nje ya droo | Lipa mkopo | **Pengo** |
|---|---|---|---|---|---|---|
| Jun | 18 | 5,816,000 | 34,204,200 | −111,500 | 244,985 | haipimiki (reco ilianza 13/06; mauzo 17.2M hayana reco, `05`) |
| Jul | 31 | 26,476,200 | 31,527,002 | 64,000 | 0 | **−5,114,802** |
| Ago | 31 | 27,195,500 | 25,671,364 | 343,000 | 0 | **+1,181,136** |
| Sep | 30 | 39,427,500 (pamoja na mkopo 1.2M) | 32,412,450 | 592,500 | 0 | **+6,422,550** |
| Okt 1–13 | 12 | 16,184,000 (pamoja na mkopo 2.19M) | 22,818,495 | 5,941,000 | 0 | **−12,575,495** |

- Hasi = purchases au gharama zililipwa kwa pesa ambayo vitabu havikuona ikitoka droo. Chanya = pesa ilibaki benki au kwa mmiliki.
- Jumla Jul → 13/10 = **−10,086,611**. Mtaji wa mmiliki wa 19/05 ni 10,598,755. Inawezekana pesa hiyo ndiyo iliyofidia (Guessing). Journal ya ufunguzi (hatua 4) itaamua kwa taarifa za benki halisi.
- Makadirio ya awali (Ago −1.7M, Sep ≈ 0) yalikuwa kwenye nakala ya 29/09 bila mobile. **Hayatumiki tena.**
- Reco purchases ni 0.4–1.95M kwa mwezi, na **0** zimeunganishwa na purchase (`purchase_uid` tupu, `03`).

---

## 2. Mpangilio wa kazi

| Hatua | Kazi | Toleo | Kizuizi (gate) |
|---|---|---|---|
| 1 | **Awamu 1b:** majibu ya Q1–Q8 + log ya hatua 34 | — | Bila exception ya `postSale`, H-2 ni kubahatisha |
| 2 | Code ya **H-2 → H-1 → H-5** + journals za marekebisho | 2.2.71 | Staging kijani; checks 5 = 0; TB inalingana |
| 3 | Chanzo cha malipo + 1040 + reco/safe box kuandika GL, **kuanzia tarehe ya kukata D** | 2.2.72 | Staging kijani |
| 4 | Journal ya ufunguzi ya pesa tarehe D (kutoka taarifa za benki/simu, hesabu ya safe box, droo) | data, si code | Mmiliki ametoa namba |
| 5 | Kigunduzi (b) + onyo (a) + kutatua (CEO) + uthibitisho wa wiki wa 1040 + Daraja la Mtaji | 2.2.73 | Hatua 4 imefanyika (vinginevyo (b) inaona salio la uongo) |
| 6 | Kufunga vipindi (`gl_period`) | 2.2.74 | Suspense 2900 = 0 na hakuna tofauti OPEN kwa kipindi |

**Tarehe ya kukata D:** siku ya kwanza baada ya deploy ya 2.2.72. Inahifadhiwa `gl_config.funding_cutoff_date`. Kabla ya D: hakuna kinachobadilika (CASH → 1000). Kuanzia D: chanzo ni lazima.

---

## 3. Hatua 2: H-2, H-1, H-5 (kwa ufupi; maelezo kamili yako RIPOTI.md)

| Kosa | Code | Marekebisho ya data |
|---|---|---|
| H-2 sale yenye deni haipostiwi | Post baada ya commit kwa kusoma upya sale (`findByUidWithAllRelationships`); kosa liandikwe `gl_posting_failure`, si log tu | Repost sales 3 (101026-2202, 121026-2249, 131026-2227) |
| H-1 alama ya variance | `postDayCloseVariance`: variance > 0 (upungufu) → Dr 6700 / Cr 1000; < 0 (ziada) → Dr 1000 / Cr 6700. Test inayofunga alama | Kwa jibu la Q1: reverse + repost (85) au journal moja ya 1,593,899.90 Dr 1000 / Cr 6700 |
| H-5 reopen inapost mara mbili | supersede/reopen ya snapshot → `reverseActiveByReference` ya snapshot ya zamani | Reverse nakala 9 |

**Migration V134** `Gl_Posting_Failure`: jedwali `gl_posting_failure` (uid, reference_type, reference_uid, error, stack_head, attempts, resolved_at, created_at), index (resolved_at null). Endpoint `GET /api/gl/posting-failures`, `POST /api/gl/posting-failures/{uid}/retry` (FINANCE_MANAGE). V3: kadi nyekundu kwenye GL overview ikiwa kuna kushindwa.

---

## 4. Hatua 3: Chanzo cha malipo + 1040

### 4.1 Akaunti mpya

| Code | Jina | Aina | Matumizi |
|---|---|---|---|
| 1040 | Pesa iliyokabidhiwa (Safe box / Mmiliki) | ASSET, CURRENT_ASSET, DEBIT | Pesa ya biashara iliyotoka droo lakini haiko benki |
| 2900 | Suspense: pesa isiyo na chanzo | LIABILITY, CURRENT_LIABILITY, CREDIT | "Mauzo yasiyorekodiwa" na ziada isiyoelezwa. Lazima iwe 0 kabla ya kufunga kipindi |

Zinaongezwa `GlChartInitializer` **na** kwenye migration (ili prod iwe nazo hata bila restart ya initializer).

### 4.2 Vyanzo (`FundingSource`, enum moja kwa purchase, supplier payment, gharama, mali, kulipa mkopo)

| Chanzo | Akaunti ya Cr | Rekodi ya ziada | Kwenye purchase | Supplier payment | Gharama/mali | Lipa mkopo |
|---|---|---|---|---|---|---|
| `DRAWER` Droo | 1000 | `reconciliation_purchases` (au `_expenses`) ya siku hiyo inaundwa yenyewe, `purchase_uid` imejazwa | ✔ | ✔ | ✔ | ✔ |
| `SAFE_BOX` Pesa iliyokabidhiwa | 1040 | — | ✔ | ✔ | ✔ | ✔ |
| `BANK` + benki | 1020–1024 | — | ✔ | ✔ | ✔ | ✔ |
| `MOBILE` + mtandao | 1030–1033 | — | ✔ | ✔ | ✔ | ✔ |
| `OWNER_PERSONAL` Pesa yangu | 3000 | `capital_injections` OWNER_EQUITY, `affects_cash=false`, `purchase_uid` | ✔ | ✔ | ✔ | — |
| `NEW_LOAN` Mkopo mpya | 2100 | `capital_injections` LOAN (mkopeshaji lazima), `affects_cash=false` | ✔ | ✔ | ✔ | — |
| `SUPPLIER_CREDIT` Mkopo kwa msambazaji | 2000 | — | ✔ | — | — | — |
| `MIXED` Mchanganyiko | mistari mingi | kila mstari kama ilivyo hapo juu | ✔ | ✔ | ✔ | — |

Rekodi za zamani (`funding_mode` NULL) = CASH → 1000 kama leo (#8).

### 4.3 Posting rules (Dr/Cr)

**Purchase iliyoidhinishwa** (`postPurchase`, mahali palepale, `PurchaseService:198`). Jumla T = Σ mistari ya `purchase_funding` + AP:

| Mstari | Dr | Cr |
|---|---|---|
| Bidhaa | 1200 T | |
| DRAWER a | | 1000 a |
| SAFE_BOX b | | 1040 b |
| BANK NMB c | | 1021 c |
| MOBILE Vodacom d | | 1030 d |
| OWNER_PERSONAL e | | 3000 e |
| NEW_LOAN f | | 2100 f |
| SUPPLIER_CREDIT (baki) g | | 2000 g |

- Journal moja, `PURCHASE_INVENTORY`.
- Kanuni: a+b+c+d+e+f+g = T. Inakaguliwa backend; ikitofautiana, inakataliwa (si kuzungushwa).
- `amount_paid` = a+b+c+d+e+f (inaendelea kutumika na hali ya UNPAID/PARTIAL/PAID).
- Mfano: purchase 900,000 = SAFE_BOX 120,000 + NEW_LOAN 500,000 + OWNER_PERSONAL 280,000 → Dr 1200 900,000 / Cr 1040 120,000, Cr 2100 500,000, Cr 3000 280,000. Mkopo na mtaji vinaonekana kwenye rejista zake papo hapo.

**Supplier payment** (`postSupplierPayment`): Dr 2000 / Cr akaunti ya chanzo (OWNER_PERSONAL → Cr 3000; NEW_LOAN → Cr 2100).
- `BANK_TRANSFER` bila jina la benki (leo → 1020) **inakataliwa** kuanzia D. Hiyo ndiyo iliyosababisha CRDB −264k.

**Gharama/mali** (`postExpense`, `postAssetPurchase`): Dr 6xxx/15xx / Cr akaunti ya chanzo. Leo 217 kati ya 223 za tangu 30/09 hazina `payment_method` → 1000. Kuanzia D ni lazima.

**Kulipa mkopo** (`postLoanRepayment`): Dr 2100 (+6600 riba) / Cr akaunti ya chanzo.

**Reco ikiidhinishwa** (tukio jipya `RECON_CASH_MOVEMENT`, reference `RECO_MOVE:<recoUid>`, idempotent; reopen/supersede → reverse, kwa kufuata funzo la H-5). Kila mstari wa `reconciliation_cash_entries` / `_mobile_entries` wa reco hiyo:

| Entry | Dr | Cr |
|---|---|---|
| BANK_DEPOSIT (bank_name) | 102x | 1000 |
| SAFE_BOX | 1040 | 1000 |
| PETTY_CASH | 1010 | 1000 |
| Mobile entry (provider) | 103x | 1000 |
| CASH_IN_HAND, CASH_PREVIOUS | — | — (inabaki 1000) |
| CASH_DEBT / BANK_DEBT / MOBILE_DEBT | — | Hazipostiwi mpaka staging ithibitishe kwamba PAYMENT_RECEIVED haijazihesabu tayari (hatari ya kuhesabu mara mbili) |

**Safe box** (`SafeBoxService`, wakati wa CONFIRMED):

| Deposit | Dr | Cr |
|---|---|---|
| BANK_DEPOSIT (bank_name) | 102x | 1040 |
| HAND_OVER | — | — (pesa inabaki 1040; rekodi ya mlinzi tu) |
| CONFIRMED kisha CANCELLED | reverse | |

### 4.4 Migration V135 `Funding_Source`

- `INSERT gl_account` 1040, 2900 (`ON CONFLICT DO NOTHING`).
- `gl_config.funding_cutoff_date date NULL`.
- `purchases.funding_mode varchar(20) NULL` (`SINGLE`/`MIXED`; NULL = rekodi ya zamani).
- `purchase_funding` (id, uid, purchase_uid FK, source varchar(30), account_code varchar(10), amount numeric(19,2) > 0, capital_injection_uid NULL, created_at, created_by_uid), index (purchase_uid).
- `supplier_payments.funding_source`, `capital_expenditure.funding_source`, `capital_injections.funding_source` (kwa malipo ya mkopo): varchar(30) NULL.
- `capital_injections.purchase_uid varchar(255) NULL`, `supplier_payment_uid NULL`.
- `reconciliation_purchases`, `reconciliation_expenses`: unique (purchase_uid) / (capital_expenditure_uid) WHERE NOT NULL, ili zisiundwe mara mbili.
- CHECK `chk_funding_source` kwa thamani 8 za enum.

### 4.5 Endpoints (hatua 3)

| Method | Path | Ruhusa | Maelezo |
|---|---|---|---|
| GET | `/api/v1/funding/sources` | PURCHASE_READ | Orodha ya vyanzo na akaunti zake (benki/mitandao iliyowashwa) |
| POST/PUT | `/api/purchases` (body mpya `funding: [{source, accountCode?, amount, lenderName?}]`) | PURCHASE_CREATE/UPDATE | Inahifadhiwa mpaka kuidhinishwa; baada ya kuidhinishwa inafungwa |
| POST | `/api/suppliers/payments` (`fundingSource`, `accountCode`) | SUPPLIER_PAYMENT | |
| POST | capex / loan repay (`fundingSource`, `accountCode`) | zilizopo | |
| GET | `/api/reconciliation/{uid}/gl-preview` | RECON_APPROVE | Mihamala itakayoandikwa kabla ya kuidhinisha |

---

## 5. Hatua 4: Journal ya ufunguzi ya pesa (tarehe D)

Mmiliki anatoa namba za tarehe D (mwisho wa siku): droo (reco `CASH_IN_HAND` ya D), safe box/1040 iliyohesabiwa, taarifa ya NMB, CRDB, Selcom, M-Pesa.

1. **Transfers ndani ya pesa** (`POST /api/gl/transfers`, ipo): 1000 → 1021 (NMB halisi − 1,186,000), 1000 → 1023, 1000 → 1030 … 1000 → 1040 (safe box halisi). Hizi hazibadilishi mtaji.
2. **Baki ya 1000** dhidi ya droo halisi:
   - GL juu ya ukweli → CEO anachagua **Dr 3100 Drawings** (mmiliki alichukua) au **Dr 6900** (upotevu) / Cr 1000.
   - GL chini ya ukweli → Dr 1000 / Cr 2900 Suspense, kisha inatatuliwa kama tofauti ya kawaida (§6.3).
3. Script ya hatua (`analysis/steps/NN-capital-opening.cmd`) inayoendeshwa na mmiliki. Inatumia `/gl/transfers` na `/gl/manual-journal`, na inaandika log ya salio kabla na baada.

---

## 6. Hatua 5: Kigunduzi, uthibitisho wa 1040, Daraja la Mtaji

### 6.1 (b) Kigunduzi cha kila siku, kwa kila akaunti ya pesa

**Kinaendeshwa:**
- reco ikiidhinishwa (kwa siku hiyo na tawi hilo);
- na scheduler ya 07:30 EAT ya kuokota siku zilizokosa. Server ya prod imezimwa 00:00–07:00, kwa hiyo hakuna job ya usiku wa manane.

**Kwa kila akaunti A ∈ {1000, 1010, 1020–1024, 1030–1033, 1040} na siku S:**
1. Salio la GL la A mwisho wa S.
2. Ikiwa < 0: upungufu U = −salio − (tofauti OPEN zilizopo za A).
3. **Ukaguzi kabla ya kuunda tofauti** (hakuna swali kama mojawapo linaeleza):
   - safe box deposit SUBMITTED (bado haijathibitishwa) kwenda A → hali `HELD` kwa siku 2;
   - mkopo/mtaji uliosajiliwa wenye `affects_cash` lakini tarehe ya baadaye → hakuna tofauti;
   - transfer ya kutoka A siku hiyo ambayo upande wa pili haujathibitishwa → `HELD`.
4. Ikibaki U > 0: unda `capital_discrepancy` (kind `NEGATIVE_BALANCE`). Inaambatana na **matumizi ya A siku S** (#3): purchases, supplier payments, loan repayments, gharama/mali zilizo Cr A, kila moja na kiasi na kiungo chake.
5. Idempotent kwa (A, S, kind). Kesho ikiwa salio limerudi ≥ 0 kwa sababu ya rekodi iliyoongezwa (transfer, mkopo), tofauti inakuwa `AUTO_CLEARED`, na inaonyesha nini kilichoiondoa.

**Kwa 1000 pekee** (taarifa, si swali): salio la GL mwisho wa S dhidi ya `CASH_IN_HAND` ya reco ya S. Tofauti ≠ 0 baada ya H-1 = kuna tukio la droo lisilopostiwa (`DRAWER_MISMATCH`, kwa ajili ya FINANCE).

### 6.2 (a) Onyo wakati wa kuchagua chanzo (si rekodi)

`GET /api/v1/funding/balance?account=1021&date=` → salio la GL leo. V3 inaonyesha chini ya chaguo la chanzo:

> "NMB kwenye vitabu: 1,186,000. Purchase hii: 2,000,000. Vitabu vitaonyesha NMB −814,000. Kama pesa ilitoka mahali pengine, chagua chanzo sahihi au Mchanganyiko."

Haizuii kuhifadhi, na hakuna kinachohifadhiwa.

### 6.3 Kutatua tofauti (CEO peke yake)

Ruhusa mpya `CAPITAL_DISCREPANCY_RESOLVE`, inapewa role ya CEO tu kupitia migration. Tofauti U kwenye akaunti A:

| Jibu | Dr | Cr | Rekodi ya ziada |
|---|---|---|---|
| Mkopo (mkopeshaji, masharti) | A U | 2100 U | `capital_injections` LOAN |
| Pesa yangu | A U | 3000 U | `capital_injections` OWNER_EQUITY |
| Mshirika | A U | 3000 U | `capital_injections` PARTNER_CONTRIBUTION |
| Ilitoka akaunti B | A U | B U | FUNDS_TRANSFER (B ikiwa hasi, tofauti mpya ya B) |
| Mauzo yasiyorekodiwa | A U | **2900 U** | Suspense (#4). Inatolewa baadaye: sales zikipostiwa, au CEO akihamisha 2900 → 4900 kwa sababu iliyoandikwa |
| Chanzo kilikosewa kwenye rekodi | — | — | Rekodi (purchase/payment) inarekebishwa chanzo → reverse + repost → tofauti `AUTO_CLEARED` |

Tofauti haiwezi kutatuliwa kwa kiasi tofauti na U. Kugawanya ni sawa: mfano 500k mkopo + 280k pesa yangu, kila sehemu journal yake, jumla = U.

### 6.4 Uthibitisho wa wiki wa 1040

`POST /api/v1/capital/custody-confirmations` {asOfDate, countedAmount, note}. Ruhusa mpya `CASH_CUSTODY_CONFIRM` (CEO).

| Matokeo | Dr | Cr |
|---|---|---|
| Iliyohesabiwa < GL 1040 (pungufu P) | 3100 Drawings P | 1040 P (#5) |
| Iliyohesabiwa > GL 1040 (ziada Z) | 1040 Z | 2900 Z, kisha tofauti `CUSTODY_OVER` ya kutatuliwa (§6.3) |
| Sawa | — | — (rekodi ya uthibitisho tu) |

Ukumbusho kwenye V3 ikiwa siku > 7 tangu uthibitisho wa mwisho.

### 6.5 Daraja la Mtaji (#6: query ya GL, hakuna calculator mpya)

`GET /api/gl/equity-bridge?from=&to=` (FINANCE_READ au CAPITAL_READ). SQL moja juu ya `journal_entry_line` + `gl_account`, ikipangwa kwa makundi:

| Kundi | Akaunti |
|---|---|
| Mtaji mwanzo | Equity yote + P&L yote **kabla ya** `from` |
| Mauzo halisi | 4000, 4010, 4020 |
| Gharama ya bidhaa | 5000 |
| Upotevu / kuvunjika | 5100 |
| Madeni yaliyofutwa / punguzo | 6110, 6120 |
| Uchakavu | 6500 |
| Tofauti za droo | 6700 |
| Gharama nyingine | 6xxx nyingine |
| Mapato mengine | 4900 |
| Mtaji ulioingia | 3000, 3900 |
| Mmiliki alichukua | 3100 |
| **Mtaji mwisho** | jumla, na lazima = `financialPosition(to).totalEquity` (inakaguliwa kwenye test) |
| Onyo | 2900 Suspense ≠ 0 (pesa isiyo na chanzo, haijaingia kwenye mtaji) |

---

## 7. Migrations (kwa muhtasari)

| Toleo | Migration | Maudhui |
|---|---|---|
| 2.2.71 | V134 `Gl_Posting_Failure` | jedwali la makosa ya posting (§3) |
| 2.2.72 | V135 `Funding_Source` | 1040, 2900, `funding_cutoff_date`, `purchase_funding`, safu za `funding_source`, unique za reco (§4.4) |
| 2.2.73 | V136 `Capital_Discrepancy` | `capital_discrepancy` (uid, branch_uid, account_code, discrepancy_date, kind, amount, status OPEN/HELD/RESOLVED/AUTO_CLEARED, resolution, note, resolved_by_uid (users.uid, funzo la H-11), resolved_at, related jsonb, created_at), unique (account_code, discrepancy_date, kind) WHERE status IN (OPEN, HELD); `capital_discrepancy_resolution_line` (discrepancy_uid, resolution, amount, journal_entry_uid, capital_injection_uid); `cash_custody_confirmation` (uid, account_code, as_of_date, gl_balance, counted_amount, difference, journal_entry_uid, confirmed_by_uid, note); permissions `CAPITAL_DISCREPANCY_RESOLVE`, `CASH_CUSTODY_CONFIRM` → CEO |
| 2.2.74 | V137 `Gl_Period_Close` | mpango wake utaandikwa kando |

Kila migration inapita staging kwanza, na historia ya Flyway ya prod inalinganishwa na source kabla ya release.

## 8. Endpoints za hatua 5

| Method | Path | Ruhusa |
|---|---|---|
| GET | `/api/v1/capital/discrepancies?status=&account=&from=&to=` | CAPITAL_READ (kusoma) |
| GET | `/api/v1/capital/discrepancies/{uid}` (pamoja na matumizi ya siku) | CAPITAL_READ |
| POST | `/api/v1/capital/discrepancies/{uid}/resolve` {lines:[{resolution, amount, fromAccount?, lenderName?, note}]} | CAPITAL_DISCREPANCY_RESOLVE |
| POST | `/api/v1/capital/discrepancies/scan?date=` (kuendesha upya kwa mkono) | FINANCE_MANAGE |
| GET | `/api/v1/capital/discrepancies/summary` (idadi, jumla, kwa badge) | CAPITAL_READ |
| GET / POST | `/api/v1/capital/custody-confirmations` | CAPITAL_READ / CASH_CUSTODY_CONFIRM |
| GET | `/api/v1/funding/balance?account=&date=` | PURCHASE_READ |
| GET | `/api/gl/equity-bridge?from=&to=` | FINANCE_READ / CAPITAL_READ |

`GET /capital-monitoring/status` (iliyokufa) inaondolewa kwenye V3. Endpoint inabaki mpaka hatua 6, kisha inafutwa.

---

## 9. UI ya V3

| Mahali | Faili (zilizopo) | Mabadiliko |
|---|---|---|
| Fomu ya purchase | `features/purchases/purchase-form-dialog.*` | Sehemu "Chanzo cha malipo": chips 8. Benki/simu → dropdown ya akaunti; Mkopo → jina la mkopeshaji; Mchanganyiko → mistari + "Baki: X" live, Hifadhi imezimwa mpaka baki = 0. Onyo (a) chini ya chanzo. Ni lazima kuanzia D |
| Repurchase | `features/purchases/repurchase/` | Picker ileile (component moja ya shared `funding-source-picker`) |
| Maelezo ya purchase | `purchase-details-dialog.ts` | Mistari ya chanzo + kiungo cha journal + mkopo/mtaji ulioundwa |
| Malipo ya msambazaji | `features/suppliers/…` | Picker bila AP/Mchanganyiko |
| Gharama / mali / lipa mkopo | `features/capital/expenses-tab.ts`, `assets-tab.ts`, `loans-tab.ts`, `capital-dialogs.ts` | Picker |
| Reco: kuidhinisha | `features/reconciliation/recon-approval-tab.ts` | "Vitabu vitaandika": NMB +x, Safe box +y, Vodacom +z (kutoka `gl-preview`); benki isiyo na jina inazuia |
| Safe box | `recon-safebox-tab.ts`, `safe-box-deposit-dialog.ts` | Ukithibitisha: "Safe box −x → NMB +x" |
| Capital overview | `features/capital/capital-overview.ts` | (1) Kadi "Pesa isiyo na chanzo": jumla, idadi, kila tofauti (akaunti, tarehe, kiasi, matumizi ya siku). CEO ana "Eleza chanzo", wengine wanasoma tu. (2) Daraja la Mtaji, kipindi chaguo-msingi ni mwezi huu, mwisho unalingana na hero ya equity, onyo la 2900 |
| Dialog ya kutatua | mpya `features/capital/discrepancy-dialog.ts` | Bottom sheet kwenye simu; mistari ya majibu inayojumlika = U; preview ya Dr/Cr kabla ya kuthibitisha |
| Uthibitisho wa 1040 | mpya kwenye `owner-tab.ts` | Salio la GL, kiasi kilichohesabiwa, preview (pungufu → Drawings) |
| Shell | sidebar / bottom nav | Badge ya CEO yenye idadi ya tofauti OPEN; ukumbusho wa 1040 (> siku 7), kwa mtindo wa `safe-box-reminder.service.ts` |

Mfumo wa `/capital-monitoring/status` hautumiki kwenye V3, na hakuna popup ya kila dakika 15. Tofauti zinasubiri kwenye orodha mpaka CEO azitatue.

---

## 10. Majaribio ya staging

Kanuni:
- staging DB inaonyeshwa upya kutoka dump ya siku hiyo kabla ya majaribio;
- migrations kwanza staging;
- amri za Contabo ni `analysis/steps/NN-*.cmd` zinazoendeshwa na mmiliki;
- matokeo yanarudi kama `.log`.

| # | Jaribio | Kipimo cha kupita |
|---|---|---|
| S1 | Migrations V134–V136 | `FLYWAY_FAILED_MUST_BE_0 = 0`; historia = source |
| S2 | H-2 | Sale ya deni mpya ina SALE_CREDIT/SALE_MIXED; sales 3 zimerepostiwa; AR ya GL = sub-ledger; `gl_posting_failure` tupu |
| S3 | H-1 | Recon ya upungufu 3,000 → Dr 6700 / Cr 1000; ya ziada → kinyume; marekebisho ya 1,593,899.90 yamefanyika kwa jibu la Q1 |
| S4 | H-5 | Reopen + approve → DAY_CLOSE_VARIANCE hai 1 tu kwa kila siku; nakala 9 zimegeuzwa |
| S5 | Kila chanzo cha purchase (8) | Journal ina mistari ya §4.3 hasa; mkopo → rejista ya mikopo = 2100; pesa yangu → 3000 + injection; AP → 2000 = sub-ledger; Mchanganyiko usiojumlika unakataliwa; rekodi ya kabla ya D → 1000 |
| S6 | DRAWER | `reconciliation_purchases` moja yenye `purchase_uid`; kuidhinisha mara mbili hakuundi ya pili |
| S7 | Reco GL | Kuidhinisha → transfers za §4.3; reopen → reversals; kuidhinisha tena → mara moja tu; benki bila jina → kukataliwa |
| S8 | Safe box | CONFIRMED BANK_DEPOSIT → Dr 1021 / Cr 1040; HAND_OVER → hakuna journal; CONFIRMED→CANCELLED → reversal |
| S9 | Journal ya ufunguzi | Salio la 1000/1021/1023/1030/1040 = namba za mmiliki; mtaji haubadiliki kwa transfers |
| S10 | (b) | Purchase NMB 2M juu ya salio → tofauti 1 ya kiasi kamili, ikiwa na matumizi ya siku; scan mara mbili → bado 1; deposit SUBMITTED → HELD; transfer ikiongezwa → AUTO_CLEARED |
| S11 | Kutatua | Kila jibu la §6.3 → Dr/Cr sahihi; mgawanyo 500k + 280k; mtumiaji asiye CEO → 403 |
| S12 | 1040 wiki | Pungufu → 3100; ziada → 2900 + CUSTODY_OVER |
| S13 | Daraja | Mtaji mwisho = `totalEquity` kwa vipindi 3; mwanzo wa Oktoba = mwisho wa Septemba |
| S14 | Checks za GL | Checks 5 = 0 na TB inalingana baada ya kila jaribio |
| S15 | Utendaji | `EXPLAIN` ya scan na bridge kwenye data ya prod; hakuna query > 2s (RAM ndogo ya server) |
| S16 | V3 | `ng build` inapita; tests za picker (jumla, baki, lazima baada ya D); jaribio la mkono kupitia tunnel 127.0.0.1:8081 kwenye simu na desktop |

---

## 11. Maswali kwa mmiliki (yanayohitaji jibu kabla ya hatua husika)

1. **T1:** BANK_DEPOSIT iende benki kwa jina lake (NMB → 1021…) badala ya 1020 yote? (hatua 3)
2. **T2:** Mobile entries za reco zihamishwe 1000 → 103x? (hatua 3)
3. **T3:** Reco `SAFE_BOX` → 1040, HAND_OVER ibaki ndani ya 1040? (hatua 3)
4. **Awamu 1b** ni kumaliza Q1–Q8 + hatua 34, kama nilivyodhani? (hatua 1)
5. **CEO:** kuna role mbili, "CEO" na "Executive CEO". Ruhusa mpya ziende kwa ipi, au zote mbili? (hatua 5)
6. **Tarehe ya kukata D:** siku baada ya deploy ya 2.2.72, au tarehe ya mwanzo wa mwezi unaofuata (rahisi kwa Daraja la Mtaji)? (hatua 3)
7. **Hatua 4:** utaweza kupata taarifa za NMB, Selcom na M-Pesa za tarehe D, na kuhesabu safe box siku hiyo? (hatua 4)
