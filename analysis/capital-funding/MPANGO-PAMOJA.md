# Mpango wa pamoja: GL sahihi → GL inajua pesa iko wapi → Counting ↔ Reco → Capital

Tarehe: 2026-10-15 (maamuzi ya mmiliki ya jioni yameingizwa, §0). Hali: **mpango tu, hakuna code.** Unachukua nafasi ya `MPANGO.md` (ya asubuhi), ambao sasa ni historia tu.

Data: `lsms_audit_20261015_0200` (RIPOTI.md §h, §i). Code: backend `1fdcdae` (2.2.70), Flyway ya mwisho V133. Kila toleo linapita staging kwanza:
- staging DB inaonyeshwa upya kutoka dump ya usiku ya siku hiyo;
- hatua ni faili `analysis\steps\NN-*.cmd` zinazoendeshwa na mmiliki, kila output ikipita `ficha.awk`;
- image inajengwa kutoka main tu;
- mmiliki ndiye anayesoma diff na kufanya commit/merge.

| Toleo | Backend | V3 | Migration | Lengo |
|---|---|---|---|---|
| 1 | 2.2.71 | 3.1.11 | V134 | Kusimamisha makosa (H-2, H-1, H-5) |
| 2 | 2.2.72 | 3.1.12 | V135 | GL ijue pesa iko wapi |
| 3 | 2.2.73 | 3.1.13 | V136 | Counting ↔ Reco |
| 4 | 2.2.74 | 3.1.14 | V137 | Tarehe ya kukata, Capital, kufunga vipindi |

---

## 0. Maamuzi ya mmiliki (15/10 jioni)

| # | Uamuzi | Unavyotekelezwa kwenye mpango huu |
|---|---|---|
| D1 | Imekubaliwa: ziada ya K2 → **Dr 1000 / Cr 2900**; mechi → **Dr 2900 / Cr 1120**. Ziada isiyolinganishwa → **2900 → 6700 kwenye counting inayofuata au mwisho wa mwezi** | Toleo 3 §3.2: approval ya counting inafunga pool ya dirisha lake (mechi, kisha baki → Dr 2900 / Cr 6700). Kufunga mwezi (§4.3) kunafanya hivyo kwa pool iliyobaki ya mwezi. Hakuna job ya nyuma; ni sehemu ya hatua hizo mbili |
| D2 | Imekubaliwa: kufunga ≤ 30/09 baada ya marekebisho ya Toleo 1 | §1.9 |
| D3 | Imekubaliwa: entry_date ya gharama za reco = reconciliation_date kuanzia Toleo 2; Oktoba irekebishwe, ≤ 30/09 ibaki | §2.2 |
| D4 | Imekubaliwa, pamoja na: purchase yenye chanzo **"Droo" inajitokeza yenyewe kwenye reco, kusoma tu**; hakuna kuingiza mara mbili | §2.3, §2.8: sehemu ya purchases ya reco inakuwa orodha ya kusoma tu ya purchases za Droo za siku hiyo, na kuongeza reco purchase kwa mkono kunaondolewa kuanzia D |
| 2 | **Approval ya reco = approval ya gharama zake, transaction moja.** Hakuna capex PENDING kutoka reco | §2.2: capex ya gharama ya reco inaundwa **wakati wa approval** ya reco, ikiwa APPROVED tayari, na journal yake ndani ya transaction ileile. Ruhusa ya RECON_APPROVE inatosha kwa gharama za reco. Ikishindwa, approval yote inarudishwa nyuma. Capex 3 PENDING za sasa (reco za DRAFT) zinashughulikiwa reco zao zikiidhinishwa |
| 3 | Ndiyo: ziada isizidi pesa iliyohesabiwa | §1.2 (guard) |
| 4 | Journal ya tarehe iliyofungwa → **siku ya kwanza iliyo wazi + `event_date` + alama**. Journal za mkono kwenye kipindi kilichofungwa → **kufungua upya kipindi** (audit) | §1.9 |
| 5 | Control ya mwezi: **mmiliki anaingiza salio la app (statement) kwa kila akaunti**; GL dhidi ya hilo, kizingiti 50,000 | §2.5 |
| 6 | Ruhusa mpya `CAPITAL_DISCREPANCY_RESOLVE`, si jina la role | §2.6: migration inaunda ruhusa tu, bila kuipa role yoyote. Mmiliki anaipa role kupitia Roles UI. ROOT ina zote |
| T1 | **Usisubiri hatua 34**; andaa jaribio la H-2 kwenye staging | §1.1 + `analysis\steps\36-h2-staging.cmd` |

---

**Maamuzi ya mmiliki 19/10 (mikopo), `mkopo-athari.md`:**
- Malipo ya mkopo hayahusiani na reco; CEO analipa kutoka benki na kuyaingiza Capital.
- Riba ni gharama ya siku (riba jumla ÷ siku za mkopo), Dr 6600.
- Deni la msingi si gharama, liko chini ya Net profit, na linaandikwa Dr 2100 / Cr chanzo siku ya malipo.
- Mkopo wa mara moja una "Akiba ya mkopo" (si journal), na mstari wa mwisho ni "Pesa inayobaki baada ya mikopo".
- Daily P&L na GL zinatumia rekodi zilezile.
- Majibu ya 19/10:
  - **M-3** siku 04/10–10/10 ziachwe ilivyo;
  - **M-4** ndiyo, riba inaenda kwenye 2110;
  - **M-5** ada inagawanywa kwa siku pamoja na riba.
  - **M-1** (19/10): A = deni 1,000,000 + riba 158,000; 386,000 × 3 kila mwezi (04/11, 04/12, 04/01/2027); ada 0;
  - **M-2** (19/10): B ulienda moja kwa moja kwenye mzigo; akaunti (CASH 1000) haibadilishwi, Septemba haifunguliwi (`mkopo-athari.md` §7);
  - **M-6** (19/10): akiba ni akaunti halisi **1025 "Akiba ya mikopo"**. "Weka akiba" = FUNDS_TRANSFER Dr 1025 / Cr chanzo; mkopo wa mara moja unalipwa Dr 2100 / Cr 1025; Y = salio la GL 1025; 1025 haihesabiwi kwenye bajeti ya auto-order. Bajeti ≤ 0 haikati oda kimya: fast-movers zilizo hatarini zinaonyeshwa "zingatia hizi kwanza" (§2.10);
  - **M-7** (19/10, imethibitishwa): malipo 7 ya 04/10 (6,751,443.39) yalikuwa kufuta madeni ya Feb–Jul yaliyolipwa benki zamani. **M-7a:** yote 7. **M-8:** njia B (journals 2 za mkono, bila code mpya). **M-9:** `payment_date` inabaki 04/10; maelezo yanasubiri endpoint ya Toleo 2. Kanuni mpya: hakuna rebuild/backfill kwa vipindi vilivyofungwa (§1.9).
- Nyongeza ya 19/10:
  - auto-order inaondoa akiba ya mikopo ya siku kwenye bajeti (§2.10);
  - kuna onyo la mkopo wa mara moja (§2.10);
  - kadi "Mkopo umelipa?" inaonyesha pia stockouts na GM (§4.2).

## TOLEO 1: Kusimamisha makosa (2.2.71, V134)

Hatua 34 haisubiriwi (T1). Jaribio la staging (`36-h2-staging.cmd`) linathibitisha chanzo.

### 1.1 H-2: sales zenye deni

**Chanzo kinachowezekana, kutoka kwenye code** [Certain kwa code; (likely) mpaka hatua 36]:
- Entity ya `Sales` ina `outstandingBalance = BigDecimal.ZERO` kama chaguo-msingi (`Sales.java:69`), na `createSale`/`createPartialSale` haziiweki.
- Salio halisi linaandikwa na `salesRepository.syncPaymentStatusByUid` (`SaleService.java:622, 921`). Hiyo ni UPDATE ya SQL isiyosasisha entity iliyoko kwenye kumbukumbu, kama maelezo ya `SalesRepository.java:1089-1096` yanavyosema.
- `postSale` (async, `:652-662`) inasoma entity hiyo. Inaona deni = 0, kwa hiyo haiweki mstari wa AR, na aina inakuwa SALE_CASH.
- Journal inakosa Dr AR kwa kiasi cha deni, kwa hiyo si balanced. `executePost` (`PostingEngine.java:108-112`) inatupa `IllegalStateException`, na `catch` inaandika log tu.
- Sale ya cash yote inabaki balanced, ndiyo maana inapita (179 kati ya 179).
- Backfill ilisoma sales kutoka DB, ndiyo maana sales za deni za kabla ya T0 zina journal.

**Utabiri wa hatua 36:** sales B/C/D hazina journal, na log inasema `GL post failed for SALE_CASH ref=<uid>`.

Marekebisho:
- `postSale` ipate deni kutoka DB, si entity: `findSyncedArFiguresByUid`, au posting baada ya commit kwa kusoma upya sale (hapa chini).
- `SaleService.java:652-662, 926-935`:
  - posting iende **baada ya commit**, kwenye thread ileile (`TransactionSynchronization.afterCommit`), si `CompletableFuture.runAsync`;
  - isome upya sale kwa `findByUidWithAllRelationships`, ndani ya transaction yake ya kusoma.
- Kosa lolote linaandikwa `gl_posting_failure` (si log tu).
- **Kinga hiyo hiyo** kwa vyanzo vyote vinavyomeza kosa (§i.1): payments, purchases, supplier payments, walk-in reclass, day close, Store adjustments na shrinkage. Kila `catch` inaandika safu ya `gl_posting_failure`.
- Data: sales 3 (101026-2202, 121026-2249, 131026-2227) zinapostiwa kupitia `retry`. Malipo ya 175,000 ya 13/10 yatakuwa sahihi baada ya hapo.

### 1.2 H-1: alama ya variance + guard

Kanuni mpya (`PostingEngine.postDayCloseVariance`):

| Variance (formula ya reco) | Kilichohesabiwa (declared = CASH_IN_HAND + petty) | Posting |
|---|---|---|
| > 0 (upungufu U) | — | Dr 6700 U / Cr 1000 U |
| < 0 (ziada Z), declared > 0 (K2) | D | **Dr 1000 min(Z, D) / Cr 6700 min(Z, D)**. Ziada haiwezi kuzidi pesa iliyohesabiwa |
| < 0, declared = 0 (K1) | 0 | **hakuna posting**. Ni makato yaliyozidi mauzo, si pesa. Snapshot inawekwa alama `variance_kind = OVER_DEDUCTION` |

- Mfano wa guard: 04/07 ziada 542,000, declared 532,000 → inapostiwa 532,000. 10,000 ni makato yaliyozidi (Q9).
- Test zinazofunga kila safu ya jedwali.

**Marekebisho ya data** (kupitia endpoint mpya ya FINANCE_MANAGE, journals 87):

| Kundi | Journals | TZS | Hatua |
|---|---|---|---|
| Upungufu | 65 | 205,850 | reverse → repost kwa kanuni mpya |
| K2 | 8 | 822,400 | reverse → repost (guard: 04/07 = 532,000) |
| K1 | 14 | 197,399.95 | **reverse tu, bila repost** |
| Nakala za H-5 (ndani ya hizo 87) | toleo la zamani | | reverse tu (1.3) |

Athari kwa 1000: kutoka −813,949.95 kwenda takriban +606,550 (likely; namba kamili inatoka kwenye rehearsal ya staging, baada ya kuondoa nakala).
**16/10, imethibitishwa:** namba kamili ni **+620,450**. Makadirio yalihesabu upungufu wote 65 (205,850), pamoja na nakala 7 za H-5 (13,900) kana kwamba zingepostiwa upya. Code inazigeuza tu: 812,400 − 191,950 = 620,450. Hesabu kwa mistari: `21-tofauti-13900.sql/.out`.

### 1.3 H-5: reopen / supersede

- `ReconciliationService.createFinancialSnapshot` (`:3576-3635`), wakati inaweka `is_current = false`: `reverseActiveByReference(<uid ya snapshot ya zamani>)`.
- `reopen` (`:1908`): reverse DAY_CLOSE_VARIANCE ya snapshot ya sasa (pesa ya siku hiyo haijulikani tena mpaka iidhinishwe upya).
- Data: snapshot zilizopitwa zenye journal hai → reverse.

### 1.4 V134 `Gl_Posting_Failure`

- `gl_posting_failure` (uid, reference_type, reference_uid, event_type, error, stack_head, attempts, last_attempt_at, resolved_at, resolved_by_uid, created_at), index (resolved_at IS NULL).
- `daily_financial_snapshot.variance_kind varchar(20) NULL` (SHORTAGE / SURPLUS / OVER_DEDUCTION).

### 1.5 Endpoints

| Method | Path | Ruhusa |
|---|---|---|
| GET | `/api/gl/posting-failures?open=true` | FINANCE_READ |
| POST | `/api/gl/posting-failures/{uid}/retry` | FINANCE_MANAGE |
| POST | `/api/gl/corrections/day-close-variance` {dryRun} | FINANCE_MANAGE; dryRun inarudisha orodha + athari bila kuandika |
| POST | `/api/gl/corrections/repost-sale/{saleUid}` | FINANCE_MANAGE |

### 1.6 UI ya V3

- **GL overview:** kadi nyekundu "Makosa ya GL yasiyotatuliwa (N)", yenye "Jaribu tena".
- **Reco approval:** inaonyesha "Ziada ya kweli: X / Makato yaliyozidi: Y" kwa K1/K2 kabla ya kuidhinisha.

### 1.7 Staging (Toleo 1)

| # | Jaribio | Kupita |
|---|---|---|
| 1.a | V134 | Flyway imefanikiwa, 0 zilizoshindwa |
| 1.b | Sale ya deni mpya (STANDARD, mteja REGULAR), na ya mchanganyiko | SALE_CREDIT / SALE_MIXED ipo; AR ya GL = sub-ledger |
| 1.c | Kulazimisha kosa la GL (akaunti haipo, kwenye staging tu) | `gl_posting_failure` 1; retry → journal |
| 1.d | Reco upungufu 3,000 / ziada K2 28,500 (declared 420,000) / K1 (declared 0, expected −2,000) | Dr 6700/Cr 1000 3,000; Dr 1000/Cr 6700 28,500; K1 hakuna journal |
| 1.e | Guard: ziada 542,000, declared 532,000 | 532,000 tu |
| 1.f | **Reopen** reco iliyoidhinishwa, kisha approve upya | DAY_CLOSE_VARIANCE hai 1 tu; ya zamani imegeuzwa |
| 1.g | Marekebisho: dryRun, kisha halisi kwenye dump ya leo | Idadi = 87 (au zaidi kama reco mpya); 1000 inabadilika kama dryRun; TB inalingana; checks 5 = 0 |
| 1.h | Sales 3 za H-2 | zina journal; AR ya 13/10 = sub-ledger |

### 1.8 Prod

**Sharti la kuanza (mmiliki, 19/10):** hakuna hatua ya prod inayoanza mpaka mmiliki athibitishe mambo matatu:
- hali ya `admin@admin.com`;
- hali ya `root@system.com`;
- FINANCE_WRITE ya Executive CEO.

**Hali (`lsms_audit_20261015_0200`, kusoma tu, 19/10):**
- ROOT wote wawili ni ACTIVE, hawajafungwa, wana `email_verified`, `is_root`, hawana role, na `last_login_at` iko tupu.
- `root@system.com` iliundwa 05/02/2026 06:34.
- `admin@admin.com` iliundwa **25/06/2026 21:40:58**, ikiwa na jina "System Root" kama ya `DataInitializer`. Inawezekana iliundwa na `DataInitializer` wakati `root.email` ilikuwa `admin@admin.com`; code ya leo haiitaji.
- **`admin@admin.com` haijawahi kutumika.**
  - Uid na email yake zilitafutwa kwenye kila safu ya maandishi ya kila jedwali.
  - Zinapatikana tu kwenye `users` (safu yake) na `user_branches` (Main Branch).
  - Hakuna `journal_entry.posted_by`, hakuna `audit_trails`, hakuna idhini za capital/reco/counting, na hakuna mabadiliko ya role/permission.
  - Kila "System Root" yenye uid kando yake ni `root@system.com`: notifications 1,104, print_jobs 15, reconciliation_audit_log 10, reco 1 (reviewed). Marekebisho 37 ya count ya 07/07 nayo yaliidhinishwa na `root@system.com`.
  - Tahadhari: mfumo hauandiki logins. `last_login_at` iko tupu kwa wote, na `audit_trails` ina safu 65 za SYSTEM tu. Kwa hiyo login isiyofuatwa na kitendo chochote haiwezi kuthibitishwa wala kukanushwa.

**ROOT aliye INACTIVE (code ya 2.2.71):**
- **Login inakataliwa.**
  - `UserService.loadUserByUsername` → `validateUserForAuthentication` (`UserService.java:477–481`) inakataa `!user.isActive()` kwa DisabledException.
  - `User.isActive()` (`User.java:235–243`) inahitaji `status == ACTIVE`, `!isLocked` na `!isDeleted`; kwa ROOT haihitaji role.
  - Pia `AuthController.login` inakagua `canLogin()` (`AuthController.java:130–135`; `User.java:261–263`, ambayo ni `isActive() && emailVerified`).
- **JWT ya zamani inakataliwa, lakini si mara moja.**
  - Kila request: `AuthTokenFilter.doFilterInternal` (`AuthTokenFilter.java:99`) → `JwtUtils.validateJwtToken` (`JwtUtils.java:359–395`). Hii inasoma mtumiaji kwa `userService.findByEmail` (`:369`) na kukataa `!user.canLogin()` (`:378`) au ROOT ambaye si `isRoot` tena (`:384–388`).
  - **Lakini** `findByEmail` ina `@Cacheable("users")` (`UserService.java:876`), na cache inaishi dakika 5 (`application.properties:61`, `expireAfterWrite=300s`). `updateUserStatus` (`UserService.java:641–662`) haisafishi cache ya `users` (inasafisha `userPermissions` tu).
  - Kwa hiyo baada ya kubadilisha status, token ya zamani **inaendelea kufanya kazi hadi dakika 5** (si saa 24). Restart inasafisha cache mara moja.
- **Kubadilisha password HAKUBATILISHI token za zamani.** `validateJwtToken` haiangalii password. Token inaishi saa 24 (`jwt.expiration` = 86,400,000 ms, `application-pro.properties:26`), na inabaki halali hata baada ya restart, kwa sababu `JWT_SECRET` haibadiliki. Kubatilisha token zote kunawezekana tu kwa kubadilisha `JWT_SECRET`, na hapo kila mtumiaji anatoka.
- `DataInitializer` inarudisha ACTIVE **kila boot** kwa `root.email` tu (`root@system.com`; `DataInitializer.java:412–416`, na `activate()` pia inafungua lock). Kwa hiyo `admin@admin.com` ikiwekwa INACTIVE inabaki hivyo, lakini `root@system.com` haiwezi kuzimwa kwa kudumu kwa status.

**Mpangilio wa mwisho (mmiliki, 19/10):**

deploy → (a0) JWT_SECRET → (a) ukaguzi wa password ya root (ilibadilishwa 20/10) → (b) FINANCE_WRITE → (b2) ukaguzi wa admin → (c) restart → (d) thibitisha → marekebisho ya §1.8 → M-7 (43) → kufunga Jan–Sep → 42.

**Akaunti ya kila hatua (mmiliki, 20/10):**
- **Marekebisho ya §1.8, M-7 (43) na kufunga Jan–Sep** yanaendeshwa kwa **akaunti ya CEO ya mmiliki**, si `root@system.com`. Kwa hiyo journals na idhini zinaonyesha jina la mmiliki.
  - Kwenye nakala ya 15/10, akaunti zenye FINANCE_WRITE ni mbili tu: `tarimo@gmail.com` (role CEO) na `jess@elikom.co.tz` (Executive CEO, ambayo (b) inaiondolea FINANCE_WRITE). Endpoints za manual journal, retry na close zote zinahitaji FINANCE_WRITE (`GLController.java:136/294/359`).
  - Script **inauliza email** (haidhanii root) na password (haionekani).
  - Inakataa `root@system.com` na `admin@admin.com` kabla ya kutuma chochote.
  - Node inakataa tena ikiwa login inasema `isRoot`, au haina FINANCE_WRITE. Log inaandika `MTUMIAJI <email> | roles | isRoot | FINANCE_WRITE`.
  - Imewekwa kwenye 43, na imejaribiwa kwa API bandia: root, ROOT kwa herufi kubwa, admin, email tupu, isRoot kutoka login, na akaunti bila FINANCE_WRITE zote zinakataliwa; CEO anaendelea.
- **Root** inatumika tu kwa (a) (ukaguzi wa password ya root), (b2) (ukaguzi wa admin) na sehemu za (d) zinazoihusu root.

**Step files za prod (20/10, `analysis\steps`).** Kila hatua inakataa kuanza ikiwa log ya iliyotangulia haiishii `---OK---`. Dirisha ni 02:30–05:59 EAT, na 45a, 45d na 44 zinakagua saa kwenye server.

| # | Hatua | Inaandika | Akaunti |
|---|---|---|---|
| 37v | **Kabla ya usiku:** build ya V3 3.1.11 (`deploy-v3.ps1 -BuildOnly`), lazima BUILD_OK 3.1.11 + digest | Docker Hub | — |
| 38e | **Kabla ya usiku:** V3 ya staging 3.0.1 → 3.1.11 (digest ya 37v), /v3/ 3.1.11, API 400 | staging tu | — |
| 50 | **Kabla ya usiku:** jaribio la rollback: staging (V134) → 2.2.70 → Started? + sale ya cash yenye journal + Flyway haibadiliki → kurudi 2.2.71 | staging tu | root ya staging |
| 45a | Preflight: log ya backup ya leo ina OK + UPLOADED; dump ya leo Contabo = B2 (cmp); Flyway kutoka dump = 133; prod 2.2.70; digest ya 2.2.71 = 38c | hapana | — |
| 45b | Mazoezi 1: staging inarejeshwa kutoka dump ya leo → 2.2.71, V134 → `45-kabla.sql` → `45-mazoezi\data.txt` (uids za H-2, Q9, M-7) | staging tu | — |
| 45c | Mazoezi 2: scripts zilezile za prod kwenye staging (46, 43, 47: kagua + andika) → namba zinazotarajiwa `45-mazoezi\*.json` | staging tu | CEO |
| 45d | Deploy: `deploy-backend.ps1 -DeployOnly 2.2.71` (transcript → log; lazima DEPLOY_OK) | prod | — |
| 45e | Container ina digest ya staging, `.env` 2.2.71, log ya container ina v134 + Started, API ya umma 400 | hapana | — |
| 44 | (a0) JWT_SECRET | prod `.env` | — |
| 45f | (a) ukaguzi: password ya zamani 401 (kwanza), mpya 200 | hapana | root |
| — | (b) mmiliki anaondoa FINANCE_WRITE ya Executive CEO (Roles UI) | prod | mmiliki |
| 45g | (b2) admin INACTIVE → (c) restart → (d) root, admin, Executive CEO hana FW, CEO anayo | restart tu | root |
| 45h | V3 3.1.11 prod (`deploy-v3.ps1 -DeployOnly 3.1.11`), digest = 37v, /v3/version.json = 3.1.11 | prod (frontend-v3) | — |
| 46a | Marekebisho, kagua: dryRun (Q9 → 2900) = mazoezi mstari kwa mstari; H-2 bado hazina journal | hapana | CEO |
| 46b | Kagua tena → "andika" → H-2 repost + marekebisho halisi → dryRun ya pili 0, mizania, TB, checks, salio = mazoezi | prod GL | CEO |
| 43 | M-7: kagua (journals 7, 6,751,443.39, salio za kabla = mazoezi) → "andika" → journals 2, salio za baada = mazoezi | prod GL | CEO |
| 47 | Kufunga Jan–Sep: kagua (OPEN, M-7 ipo, makosa 0, salio za 30/09 = mazoezi) → "andika" → 9/9 CLOSED | prod GL | CEO |
| 49 | Kusimamisha staging (`docker compose -p lsms-staging stop`); prod lazima isibadilike | staging tu | — |
| 48 | Kesho baada ya 02:30: dump ya leo → PC → `lsms_audit_<tarehe>_0200` → 42 (FW = CEO tu, admin INACTIVE) | DB ya PC tu | — |

| 51 | **Dharura tu:** prod 2.2.71 → 2.2.70 (`-DeployOnly 2.2.70`, image tu; DB inabaki na V134); inahitaji 50 OK na "rudi" | prod | — |

- **Rollback (swali la mmiliki 20/10).** 2.2.70 inatarajiwa kuwaka juu ya DB yenye V134: `application.properties:25–27` ina `validate-on-migrate=false`, `ignore-missing-migrations=true` na `out-of-order=true` (Flyway 9.22.3), na safu mpya za V134 zina DEFAULT. Hatua 50 inathibitisha hilo kwa vitendo, na 45a inakataa kuanza bila 50 OK.
  - Deploy ikishindwa yenyewe, script ya deploy inarudisha image 2.2.70 yenyewe.
  - Tatizo likionekana baadaye (45e–47): hatua 51.
  - Restore ya DB kutoka dump ya kabla ya deploy inafanyika tu kwa uamuzi wa mmiliki, kwa amri zinazochapishwa na script ya deploy.
- **Flyway v134 kwenye prod** inasomwa kutoka log ya 45d (`Flyway applied: 134 … [success=true]`), si kutoka log ya backend. Log ya prod iko WARN na haina mistari ya Flyway.
- **ONYO:** kati ya 02:00 na mwisho wa 47 hakuna mtu anayetumia LSMS. 45a inaonyesha maombi ya kuandika yaliyopita nginx tangu 02:00 (taarifa tu), na 46a/46b/43/47 zinasimama zikiona tofauti.
- Namba za prod zikitofautiana na mazoezi kwa senti yoyote, hatua inasimama kabla ya kuandika. Hilo litatokea pia ikiwa kuna mauzo au reco iliyoidhinishwa kati ya 02:00 na hatua hiyo.
- Kinga za ziada ndani ya scripts: 2900 = 742,500; uids 2 za Q9 ni zilezile za uamuzi wa mmiliki; H-2 inajumuisha 101026-2202, 121026-2249 na 131026-2227; M-7 = journals 7 na jumla 6,751,443.39.

Hatua za kufuata:
1. **Deploy 2.2.71** (step file).
2. **(a0) Badilisha `JWT_SECRET` ya prod.** Hatua 44: `analysis\steps\44-jwt-secret-prod.cmd` + `.sh`.
   - **Inaruhusiwa tu 00:00–05:59 EAT**, baada ya duka kufunga. Script inakataa saa nyingine.
   - Thamani mpya ni bytes 64 za nasibu kwa Base64 (`openssl rand -base64 64`), kama `JwtUtils.init` inavyosoma (`JwtUtils.java:38–39`).
   - Inatengenezwa na kuandikwa **kwenye server** tu. Haipiti kwenye PC wala command line. Log ina urefu na sha256 (herufi 12) tu, na kila mstari unapita kwenye `ficha.awk`.
   - Kwanza inathibitisha kwamba backend kweli inasoma `JWT_SECRET` ya `.env`, kwa kulinganisha sha256 ya `.env` na ya container. Kisha:
     - inaweka backup ya `.env` (chmod 600);
     - inabadilisha mstari wa `JWT_SECRET` tu (idadi ya mistari inakaguliwa);
     - inafanya `docker compose up -d backend` (restart peke yake haisomi `.env` mpya);
     - inasubiri "Started LsmsApplication";
     - inathibitisha kwamba container inatumia sha256 mpya.
   - Ikishindwa baada ya kubadilisha, **inarudisha `.env` ya zamani yenyewe** na kuwasha backend.
   - Imejaribiwa kwenye PC kwa docker bandia: kukataa saa 20, mafanikio, rollback, na siri haionekani kwenye output.
   - Matokeo: **token zote zinakufa**, kwa hiyo kila mtumiaji (V3, simu) anaingia upya. Print agent inashindwa hadi takriban dakika 15, kwa sababu haiachi token yake ikipata 401 (`lsms-print-agent BackendClient.java:49–72`), kisha inaingia upya yenyewe.
   - Futa backup ya `.env` (ina siri ya zamani) baada ya (d).
3. **Hatua za mmiliki** (kupitia UI; si SQL, si step file):
   - (a) **Ukaguzi tu (20/10):** mmiliki alibadilisha password ya `root@system.com` ya prod mapema (20/10, kupitia V3: Akaunti → Usalama). Baada ya deploy na (a0), thibitisha:
     - `root@system.com` inaingia kwa password **mpya** (200);
     - password ya zamani (default ya `DataInitializer.java:37`) **inakataliwa** (401).
     - Mpangilio wa jaribio: ya zamani **kwanza**, kisha mpya. `LoginAttemptService` inafunga email baada ya makosa 5 (`MAX_ATTEMPTS = 5`, `AuthController.java:107–110` → 429), na login inayofanikiwa inafuta hesabu. Jaribio moja tu la password ya zamani.
     - Step file ya (a) itauliza password mpya kwa njia isiyoonyesha (PowerShell `Read-Host -AsSecureString`) na kuandika kwenye log status code tu, si password.
   - **Password ya root ya staging:** staging inarejeshwa kutoka dump ya prod, kwa hiyo password yake ni ya prod **wakati wa dump**. Dump ya 20/10 02:00 (hatua 38b) ni kabla ya mabadiliko ya 20/10, kwa hiyo staging ya sasa ina password ya **zamani**. Restore yoyote kutoka dump ya baadaye italeta password **mpya**.
   - (b) Ondoa FINANCE_WRITE kwenye role "Executive CEO" (Jess Saimon) kupitia **Roles UI**.
   - (b2) **Ukaguzi tu:** mmiliki alishaizima `admin@admin.com` kabla ya leo. Ukiwa root, fungua V3 → Users na uthibitishe kwamba `admin@admin.com` ni **INACTIVE**.
     - Kwenye `lsms_audit_20261015_0200` bado ilikuwa ACTIVE, kwa hiyo kuzimwa kulifanyika baada ya 15/10 02:00.
     - Kama bado ni ACTIVE: Users → "Zima" (kitufe kinapatikana, `users-page.ts:171–189`).
   - (c) **Restart backend.** Inasafisha cache ya `users` (dakika 5) na ruhusa (dakika 15), ili (b) na (b2) zifanye kazi mara moja. Kama hakuna kilichobadilika baada ya (a0), restart hii ni ya ziada lakini haina madhara.
   - (d) **Thibitisha:**
     - `root@system.com` inaingia kwa password mpya, na password ya zamani inakataliwa;
     - `admin@admin.com` inakataliwa ("Account cannot login" / 401);
     - token iliyotolewa kabla ya (a0) inakataliwa (401).
4. dryRun.
5. Mmiliki anasoma orodha.
6. Marekebisho halisi.
7. Thibitisha (checks, TB, 1000).
8. **M-7** (hatua 43), kisha 1.9 (kufunga Jan–Sep).
9. **Ukaguzi (kusoma tu):** `analysis\steps\42-finance-write-ukaguzi.sql` kwenye nakala ya dump ya usiku inayofuata hatua 3 (`lsms_audit_YYYYMMDD_0200`), si kwenye DB ya prod.
   - Lazima `FW_ROLES` = CEO tu, `FW_ROLE_COUNT_MUST_BE_1` = 1, na `FW_USER_GRANTS_MUST_BE_0` = 0.
   - Lazima mstari `ROOT|admin@admin.com|status=INACTIVE…` uonekane, ukithibitisha (b2).
   - Kwenye nakala ya 15/10 inatoa 2 (CEO, Executive CEO) na admin ACTIVE, ambayo ndiyo hali ya kabla.

### 1.9 Kufunga ≤ 30/09 (D2)

**Kabla ya kufunga Septemba: hatua M-7** (mmiliki 19/10: M-7 imethibitishwa; yote 7; **njia B, bila code mpya**; maelezo yote yako `m7-malipo-wasambazaji.md`):
- Malipo 7 ya wasambazaji ya 04/10 (6,751,443.39) yalikuwa kufuta madeni ya Feb–Jul yaliyolipwa benki zamani.
- Journals 2 za mkono (`POST /api/v1/gl/journal-entries/manual`, ipo):
  1. tarehe **04/10**: Dr 1000 / Cr 2000 6,751,443.39. Maelezo ya mistari yanataja entry_number 7.
  2. tarehe **30/09**: Dr 2000 / Cr 1000 6,751,443.39, "malipo ya Feb–Jul kutoka benki". Cr ni 1000, kwa sababu benki haikufuatiliwa kabla ya D.
- Journals 7 za asili zinabaki hai. `supplier_payments.payment_date` inabaki 04/10 (M-9).
- Ukaguzi unafanywa kwa tofauti:
  - 30/09: 1000 inapungua 6,751,443.39, na 2000 = 0;
  - leo (na 31/10): 1000 na 2000 hazibadiliki.
  - Kwenye dump ya 15/10 **bila** marekebisho ya 1.8, 1000 ya 30/09 = 22,816,803.99 → **16,065,360.60**. Baada ya marekebisho ya H-1 (1.8), 1000 ya 30/09 tayari imebadilika, kwa hiyo namba kamili ya baada inakuwa (salio baada ya 1.8) − 6,751,443.39.
- Sharti: Septemba lazima iwe OPEN, kwa sababu journal ya mkono kwenye mwezi uliofungwa inakataliwa. Mpangilio: deploy → 1.8 → **M-7** → kufunga.
- Staging: hatua 40 (`39-toleo1-jaribu.mjs` B: M-7-journals, M-7-30/09, M-7-leo) → `40-m7-journals.json`.
- Prod: **hatua 43** (`43-m7-prod.cmd` + `.mjs`), kupitia API tu, bila ssh wala query ya DB. Inakata kipande kilekile cha M-7 kutoka script ya staging, kwa hiyo mantiki ni moja.
  - Kwanza "kagua" (haiandiki), kisha mmiliki anaandika "andika".
  - Inakataa yenyewe ikiwa: journals si 7, jumla si 6,751,443.39, M-7 imeshaandikwa (memo "M-7:"), au Septemba imefungwa.

**Kanuni (19/10): baada ya kufunga kipindi, GL rebuild/backfill haziruhusiwi kwa vipindi vilivyofungwa.**
- **Kinga iko kwenye 2.2.71 (commit `8c83b45`):** `DELETE /api/v1/gl/entries` na `POST /api/v1/gl/backfill` (backfill kamili) zinakataa kabisa ikiwa `gl_period` yoyote ni CLOSED/LOCKED, kwa ujumbe "Kuna vipindi vilivyofungwa; rebuild/clear haviruhusiwi."
  - Backfill ya rekodi moja (repost-sale, retry ya kosa) inaendelea kuruhusiwa, na inaheshimu firstOpenDate.
  - Tests ni `GlRebuildGuardTest`, 4.
- Maelezo ya hali ilivyokuwa kabla ya kinga hii:
- Ukaguzi wa code (2.2.71, `e57e08f`): **haiheshimu kikamilifu.**
  - `GlBackfillService.backfillAll` inapost kupitia `post()` → `executePost`. Kwa tukio la mwezi uliofungwa, **inalihamisha** kwenda siku ya kwanza iliyo wazi (late entry), haikatai.
  - Rekodi zenye journal hai zinarukwa (idempotent), kwa hiyo backfill ya kawaida haina madhara.
  - `DELETE /api/v1/gl/entries` (`clearAllJournals`) inakataa tu GL ikiwa live; haiangalii vipindi.
  - Rebuild (clear + backfill) ikifanyika katika shadow mode ingefuta journals zote, zikiwemo za mkono za M-7, ambazo hazina rekodi ya chanzo. Kisha ingeweka malipo 7 tena 04/10, na kila tukio la vipindi vilivyofungwa lingehamia mwezi ulio wazi.
- Kazi hii ilipangwa Toleo 2 (test 2.ad), lakini mmiliki aliiomba ndani ya 2.2.71 kama kinga ndogo. Imefanyika, na 2.ad inabaki tu kama jaribio la staging la Toleo 2.

Baada ya 1.8: `gl_period` ya Jan–Sep = CLOSED. Kipande hiki cha Toleo 4 kinaletwa hapa, **ndani ya V134**:

**Kanuni ya tarehe iliyofungwa** (uamuzi 4), ndani ya `PostingEngine.executePost`:
- Journal ya kawaida (tukio la mfumo) yenye `entry_date` ndani ya kipindi kilichofungwa **inahamishiwa siku ya kwanza iliyo wazi**:
  - `entry_date` = siku hiyo;
  - `event_date` = tarehe halisi ya tukio;
  - `is_late_entry = true`.
- Ripoti zinaonyesha alama "imechelewa (tukio la 15/09)".
- **Journal za mkono** (`postManual`: true-up, transfer, manual journal) kwenye kipindi kilichofungwa **zinakataliwa**. Ili kuziandika, kipindi lazima kifunguliwe upya (`POST /api/gl/periods/{y}/{m}/reopen` {reason}, FINANCE_MANAGE), na hatua hiyo inaandikwa kwenye `gl_period_audit` (nani, lini, sababu, kufunga tena).
- Reversals: reversal ya journal ya kipindi kilichofungwa inafuata kanuni ileile ya kuhamishwa (event_date = tarehe ya original).

Migration (ndani ya V134):
- `journal_entry.event_date date NULL`, `journal_entry.is_late_entry boolean DEFAULT false`;
- `gl_period` itumike (year, month, status OPEN/CLOSED, closed_by_uid, closed_at, checks_json);
- `gl_period_audit` (uid, year, month, action CLOSE/REOPEN, reason, by_uid, at).

Endpoints: `GET /api/gl/periods`, `POST /api/gl/periods/{y}/{m}/close`, `POST /api/gl/periods/{y}/{m}/reopen` (FINANCE_MANAGE).

V3: ukurasa wa GL una tab ya "Vipindi" (hali, funga/fungua upya kwa sababu), na alama ya "imechelewa" kwenye journals.

Staging:

| # | Jaribio | Kupita |
|---|---|---|
| 1.i | Journal ya tukio (gharama ya 15/09) baada ya kufunga | `entry_date` = 01/10, `event_date` = 15/09, `is_late_entry` = true |
| 1.j | True-up ya 20/09 | inakataliwa; baada ya reopen inapita; audit ina safu 2 (REOPEN, CLOSE) |

---

## TOLEO 2: GL ijue pesa iko wapi (2.2.72, V135)

Kila kitu kinaanza **tarehe ya kukata D** (`gl_config.funding_cutoff_date`). Rekodi za kabla ya D zinabaki CASH → 1000.

### 2.1 Akaunti mpya

| Code | Jina | Aina |
|---|---|---|
| 1040 | Sefu (safe box) | ASSET, CURRENT_ASSET |
| 1045 | Pesa kwa meneja/mmiliki | ASSET, CURRENT_ASSET |
| 2900 | Suspense: pesa isiyo na chanzo / ziada isiyolinganishwa | LIABILITY, CURRENT_LIABILITY |
| 1025 | Akiba ya mikopo (pesa halisi iliyotengwa kulipa mikopo; M-6) | ASSET, CURRENT_ASSET (cash) |
| 1150 | Ada ya mkopo iliyolipwa mapema (M-5) | ASSET, CURRENT_ASSET |
| 2110 | Riba inayodaiwa (M-4) | LIABILITY, CURRENT_LIABILITY |

### 2.2 Movements za reco iliyoidhinishwa

Tukio jipya `RECON_CASH_MOVEMENT`, reference `RECO_MOVE:<reconUid>`, **entry_date = reconciliation_date**. Reopen/supersede → reverse (kanuni ya 1.3).

| Entry ya reco | Dr | Cr |
|---|---|---|
| BANK_DEPOSIT, bank_name NMB / SELCOM / CRDB | 1021 / 1023 / 1020 | 1000 |
| BANK_DEPOSIT bila jina la benki | — | reco **haiidhinishwi** |
| Mobile entry VODACOM / TIGO | 1030 / 1031 | 1000 |
| Mobile entry yenye provider isiyo mtandao ("CASH_IN_HAND", "CHAKULA") | — | reco haiidhinishwi |
| SAFE_BOX | 1040 | 1000 |
| PETTY_CASH | 1010 | 1000 |
| BANK_DEBT / MOBILE_DEBT (Formula 2) | 102x / 103x | 1000 (malipo yalipostiwa 1000 na POS) |
| CASH_IN_HAND, CASH_PREVIOUS, CASH_DEBT | — | — (inabaki 1000) |
| Gharama za reco | 6xxx | 1000 |

**Gharama za reco** (uamuzi 2: approval ya reco = approval ya gharama zake, transaction moja):
- Kuongeza gharama kwenye reco **hakuundi capex tena**.
- Wakati wa `approve()` ya reco, ndani ya transaction ileile, kwa kila gharama: capex DAILY_EXPENSE (source RECONCILIATION) inaundwa tayari APPROVED, na journal EXPENSE_DIRECT yenye **entry_date = reconciliation_date** (D3), kwa kanuni ya "inazuia".
- Kosa lolote la GL linarudisha approval yote nyuma, kwa hiyo hakuna capex PENDING kutoka reco.
- Ruhusa: RECON_APPROVE inatosha kwa gharama za reco. CAPITAL_APPROVE haihitajiki tena kwa hizi.
- Reopen: capex na journal za gharama zinageuzwa (void + reverse), na zinaundwa upya approval inayofuata.
- Za zamani: capex 3 PENDING (reco za DRAFT) zinashughulikiwa reco zao zikiidhinishwa. Gharama za Oktoba zenye tarehe tofauti zinarekebishwa kwa reverse + repost (D3) kabla ya kufunga Oktoba.

**Safe box** (`SafeBoxService`, ikiwa CONFIRMED; ikifutwa baada ya CONFIRMED → reverse):

| Deposit | Dr | Cr |
|---|---|---|
| BANK_DEPOSIT (bank_name) | 102x | 1040 |
| HAND_OVER | 1045 | 1040 |

### 2.3 Chanzo cha malipo (purchase, supplier payment, loan repayment)

| Chaguo | Akaunti (Cr) | Ziada |
|---|---|---|
| Droo | 1000 | Inajitokeza yenyewe kwenye reco ya siku hiyo (ya mtumiaji aliyeiingiza), **kusoma tu**, na inatolewa kwenye Formula 1 kama purchases zilivyokuwa zikitolewa. Hakuna safu ya `reconciliation_purchases` inayoingizwa kwa mkono kuanzia D (D4) |
| Sefu | 1040 | |
| NMB / Selcom / CRDB | 1021 / 1023 / 1020 | |
| M-Pesa / Tigo | 1030 / 1031 | |
| Mkopo wa msambazaji (AP) | 2000 | purchase tu |
| Pesa ya mmiliki | 3000 | `capital_injections` OWNER_EQUITY (`affects_cash = false`, `purchase_uid`) |
| Mkopo | 2100 | `capital_injections` LOAN (mkopeshaji lazima), si kwa loan repayment |
| Mchanganyiko | mistari kadhaa, jumla = kiasi | si kwa loan repayment |

Purchase: Dr 1200 jumla / Cr mistari ya chanzo. Supplier payment: Dr 2000 / Cr chanzo. Loan repayment: Dr 2100 (deni) + Dr 2110 (riba) / Cr chanzo (§2.10).

**Malipo ya mkopo (19/10, mmiliki): hayahusiani na reco.** CEO analipa kutoka benki na kuyaingiza Capital. Kwa hiyo, kwenye malipo ya mkopo:
- chaguo **"Droo" halionekani**;
- malipo hayajitokezi kwenye reco;
- chaguo "Mkopo" na "Mchanganyiko" hayapo.

### 2.4 Chanzo chenye salio pungufu

Baada ya kila posting yenye Cr kwenye akaunti ya pesa A:
1. Salio la A kwenye entry_date < 0?
2. Kama ndiyo: `capital_discrepancy` (PENDING) yenye kiasi = upungufu mpya, unaohusishwa na rekodi hiyo.

Kabla ya kuunda tofauti:
- safe box deposit SUBMITTED kwenda A → HELD siku 2;
- mkopo/mtaji uliosajiliwa → hakuna tofauti.

Scan ya kila siku baada ya approval ya reco inaokota zilizokosekana. Server ya prod iko Contabo na haizimwi usiku, kwa hiyo job ya 00:20 inawezekana; vinginevyo inafanyika wakati wa approval.

Kutatua: ruhusa `CAPITAL_DISCREPANCY_RESOLVE` (uamuzi 6; mmiliki anaipa role anayotaka):

| Jibu | Dr | Cr |
|---|---|---|
| Mkopo | A | 2100 (+ rejista ya mikopo) |
| Pesa ya mmiliki | A | 3000 |
| Ilitoka akaunti B | A | B |
| Mauzo yasiyorekodiwa | A | 2900 |
| Chanzo kilikosewa | rekodi inarekebishwa (reverse + repost) → AUTO_CLEARED | |

### 2.5 Control ya mwezi: salio la app dhidi ya GL (uamuzi 5)

- Mwisho wa kila mwezi (au tarehe yoyote), mwenye ruhusa `CASH_STATEMENT_ENTER` anaingiza **salio la app/statement kwa kila akaunti**: NMB, Selcom, CRDB, M-Pesa, Tigo, pamoja na sefu na droo kama zimehesabiwa. Kila salio lina tarehe na maelezo; kiambatisho ni hiari.
- Control check mpya `SALIO_LA_APP`, kwa kila akaunti: GL ya tarehe hiyo dhidi ya salio lililoingizwa.
  - |tofauti| ≤ 50,000 (`gl_config.statement_tolerance`) → sawa.
  - Zaidi ya kizingiti → onyo, na kitufe "Eleza" kinachounda `capital_discrepancy` (2.4) ya kiasi hicho.
- Hakuna true-up ya automatic. Kurekebisha ni kupitia majibu ya 2.4 (mkopo, mmiliki, transfer, 2900).
- Akaunti isiyo na salio lililoingizwa kwa mwezi huo → check "haijaingizwa" (njano). Kufunga mwezi (§4.3) kunahitaji salio la akaunti zote zenye mwendo.

### 2.6 V135 `Funding_Source_And_Cash_Movements`

Inaongeza:
- 1040, 1045, 2900 (ON CONFLICT DO NOTHING), pia `GlChartInitializer`;
- `gl_config.funding_cutoff_date date`, `gl_config.statement_tolerance numeric DEFAULT 50000`;
- `cash_account_statement` (uid, account_code, as_of_date, balance, note, attachment_ref, entered_by_uid, entered_at), unique (account_code, as_of_date);
- `purchase_funding` (uid, purchase_uid, source, account_code, amount > 0, capital_injection_uid);
- `funding_source` + `funding_account_code` kwenye `supplier_payments` na `capital_injections` (repayment);
- `reconciliation_purchases`: unique (purchase_uid) WHERE NOT NULL;
- `capital_discrepancy` (uid, account_code, discrepancy_date, amount, status PENDING/HELD/RESOLVED/AUTO_CLEARED, source_type, source_uid, resolution, note, resolved_by_uid, resolved_at, journal_entry_uid), unique (source_type, source_uid, account_code);
- permissions `CAPITAL_DISCREPANCY_RESOLVE` na `CASH_STATEMENT_ENTER`: zinaundwa tu, **bila kupewa role yoyote** (uamuzi 6). Mmiliki anazipa role kupitia Roles UI. ROOT ina zote;
- `capital_expenditure`: hakuna safu mpya; capex za reco zinaundwa wakati wa approval (2.2).

### 2.7 Endpoints

| Method | Path | Ruhusa |
|---|---|---|
| GET | `/api/reconciliation/{uid}/gl-preview` | RECON_APPROVE |
| GET | `/api/v1/funding/sources`, `/api/v1/funding/balance?account=&date=` | PURCHASE_READ |
| POST/PUT | purchases, supplier payments, loan repay: `funding[]` | zilizopo |
| GET | `/api/v1/capital/discrepancies?status=` | CAPITAL_READ |
| POST | `/api/v1/capital/discrepancies/{uid}/resolve` | CAPITAL_DISCREPANCY_RESOLVE |

### 2.8 UI ya V3

| Mahali | Mabadiliko |
|---|---|
| Fomu ya purchase, repurchase, malipo ya msambazaji, kulipa mkopo | `funding-source-picker` (component moja): chips, akaunti, mkopeshaji, mistari ya Mchanganyiko yenye "Baki: X". Onyo la salio pungufu: "NMB kwenye vitabu 1,186,000; malipo haya 2,000,000" |
| Reco approval | "Vitabu vitaandika: NMB +x, Sefu +y, M-Pesa +z, Gharama w". Benki/mtandao usio na jina → kizuizi |
| Reco purchases | orodha ya kusoma tu ya purchases za "Droo" za siku hiyo (kiungo cha purchase); kitufe cha "ongeza purchase" kinaondolewa kuanzia D. Purchase ya droo isiyoingizwa inaingizwa kwenye Purchases, si kwenye reco |
| Reco gharama | zinaonyesha "zitaidhinishwa pamoja na reco"; hakuna banner ya capex PENDING tena |
| Safe box | ukithibitisha: "Sefu −x → NMB +x" / "Sefu −x → kwa meneja +x" |
| Capital overview | orodha ya "Pesa isiyo na chanzo" (PENDING), CEO anatatua (bottom sheet kwenye simu) |
| GL overview / Capital | "Salio la app": fomu ya kuingiza salio kwa kila akaunti na tarehe, jedwali la GL dhidi ya app (kijani ≤ 50,000, nyekundu zaidi, njano haijaingizwa), na kitufe "Eleza" kinachounda tofauti |

### 2.9 Staging (Toleo 2)

| # | Jaribio | Kupita |
|---|---|---|
| 2.a | V135 | sawa |
| 2.b | Reco: NMB 500k, Selcom 100k, VODACOM 50k, SAFE_BOX 200k, gharama 10k (iliyoongezwa siku inayofuata) → approve | Journal moja ya movements yenye mistari ya 2.2; gharama entry_date = reconciliation_date |
| 2.c | **Reopen** reco hiyo, badilisha NMB → 450k, approve | movements za zamani zimegeuzwa; mpya ina 450k; variance mara moja |
| 2.d | Reco yenye BANK_DEPOSIT bila jina / mobile "CHAKULA" | approve inakataliwa |
| 2.e | Safe box CONFIRMED BANK_DEPOSIT 150k; HAND_OVER 50k; kisha cancel ya CONFIRMED | Dr 1021/Cr 1040; Dr 1045/Cr 1040; reversal |
| 2.f | Purchase kwa kila chaguo (11) | mistari ya 2.3; rejista za mkopo/mtaji zimesasishwa |
| 2.g | **Purchase kutoka chanzo pungufu:** NMB salio 100k, purchase 300k chanzo NMB | NMB −200k; `capital_discrepancy` PENDING 200,000; deposit SUBMITTED → HELD; resolve "Mkopo" → Dr 1021/Cr 2100, NMB = 0 |
| 2.h | Purchase "Droo" 50k | inaonekana kwenye reco ya siku (kusoma tu) na inatolewa kwenye Formula 1; GL Cr 1000 mara moja tu; kuongeza reco purchase kwa mkono → kumekataliwa |
| 2.i | Rekodi ya kabla ya D | 1000 kama leo |
| 2.j | Salio la app: NMB GL 1,000,000, app 1,030,000; M-Pesa GL 64,000, app 200,000 | NMB sawa (30k ≤ 50k); M-Pesa nyekundu 136,000; "Eleza" → `capital_discrepancy` 136,000 |
| 2.k | Reco yenye gharama 2: approve kwa user mwenye RECON_APPROVE bila CAPITAL_APPROVE | capex 2 APPROVED + journals, entry_date = reconciliation_date, transaction moja; kulazimisha kosa la GL kwenye gharama ya 2 → approval yote imerudishwa nyuma (reco bado REVIEWED, capex 0) |
| 2.l | Reopen ya reco hiyo | capex 2 void + journals zimegeuzwa; approve upya → zinaundwa upya mara moja |
| 2.k | Utendaji | `gl-preview` na scan < 2s kwenye data ya prod |
| 2.m | Mkopo wa mfano (A): 1,000,000 NMB, riba 158,000, MWEZI 386,000 × 3, 04/10/2026–04/01/2027, malipo ya kwanza 04/11 | ratiba 3 (04/11, 04/12, 04/01); riba ya siku 1,717.39 (Σ = 158,000 kamili); kazi ya siku ikiendeshwa mara 2 → journal 1 kwa siku |
| 2.n | Malipo ya kwanza 386,000 kutoka NMB | Dr 2100 333,333.33 + Dr 2110 52,666.67 / Cr 1021; 6600 haiguswi; chaguo "Droo" halipo kwenye fomu; reco ya siku haina mstari wa mkopo |
| 2.o | Daily P&L ya kipindi hicho | "Riba ya mikopo" = Σ 6600 ya GL; "Marejesho ya deni" = Σ Dr 2100; Net profit imepungua kwa riba tu |
| 2.p | Mkopo MARA_MOJA 1,200,000, kurudisha baada ya siku 44 | "Akiba ya mkopo" 27,273 kwa siku; hakuna journal ya akiba; "Pesa inayobaki baada ya mikopo" = Net − marejesho − akiba |
| 2.q | Edit ya mkopo (kiasi 1,186,000 → 1,000,000) | reversal **kwa tarehe ya mkopo**; GL ya NMB ya kila siku tangu tarehe ya mkopo = 1,000,000; riba imeandikwa upya |
| 2.r | Marekebisho ya Mkopo A kwenye staging (dump ya siku hiyo) | `mkopo-athari.md` §3 hatua 4 inapita |
| 2.s | Mkopo wenye ada 30,000 iliyokatwa (pesa iliyopokelewa 970,000, deni 1,000,000) | siku ya kupokea: Dr bank 970,000 + Dr 1150 30,000 / Cr 2100 1,000,000; kila siku 6600 = (R + 30,000) ÷ siku; mwishoni 1150 = 0, 2110 = 0 |
| 2.t | Auto-order siku ya Oktoba yenye A (MWEZI 386,000) na B (MARA_MOJA, siku 40, Y = 0) | `budget_loan_reserve` = 12,452 + 30,000 = 42,452; bajeti = pesa iliyopo − hiyo; Daily P&L "Akiba ya mkopo" = 30,000 ileile |
| 2.u | "Weka akiba" 300,000 kutoka NMB kwa B ikiwa zimebaki siku 40, kisha siku 1 ipite | GL: Dr 1025 / Cr 1021 300,000; Y = salio la 1025 = 300,000; Z = 900,000 ÷ 39 = 23,077; onyo linaonyesha X/Y/Z hizo; auto-order inaondoa 23,077 na haihesabu 1025 |
| 2.v | "Weka akiba" kutoka Droo; kisha kulipa B 1,200,000 ikiwa 1025 = 300,000 | Droo → inakataliwa; malipo: Dr 2100 1,200,000 / Cr 1025 300,000 + Cr chanzo cha pili 900,000; 1025 = 0 |
| 2.w | Bajeti 30,000, akiba ya siku 42,452, fast-movers 3 zenye ≤ siku 2 za stock | oda haikatwi kimya: bango + "Zingatia hizi kwanza" (3, zimepangwa kwa siku za kubaki); mistari ya mfumo "imesimamishwa: bajeti"; "Ongeza hizi" → mistari ya mkono pamoja na onyo |
| 2.x | Mkopo mpya "Moja kwa moja kwenye mzigo" 500,000, umeunganishwa na purchases 2 (300k + 200k) | hakuna Dr 1000 wala benki; purchases: Dr 1200 / Cr 2100 jumla 500,000; jumla isiyolingana → inakataliwa; bila purchases → PENDING_LINK, hakuna journal, onyo kwenye Capital |

### 2.10 Mikopo (19/10, mmiliki): fomu, ratiba, riba ya siku, malipo kutoka Capital

Chanzo: `mkopo-athari.md` (namba kutoka `lsms_audit_20261015_0200`). Rekodi moja ya Capital ndiyo chanzo cha GL **na** cha Daily P&L, ili namba zisitofautiane (funzo la H-3).

**Fomu ya mkopo** (Capital → Mikopo; inaongeza sehemu kwenye rekodi ya LOAN ya `capital_injections`):

| Sehemu | Maelezo |
|---|---|
| Mkopeshaji | lazima |
| Pesa iliyopokelewa | inaingia kwenye akaunti ya kupokelea na 2100 |
| Ada | Inagawanywa kwa siku **pamoja na riba** (M-5). Fomu inauliza ada inalipwa vipi: **imekatwa** kwenye pesa iliyopokelewa, **imelipwa** siku ya kupokea, au iko **pamoja na malipo** |
| Riba jumla | flat; si pesa iliyopokelewa |
| Aina ya malipo | SIKU / WIKI / MWEZI / MARA_MOJA |
| Kiasi cha kila malipo | kwa MARA_MOJA = jumla yote |
| Tarehe ya kuanza / kumaliza | |
| Akaunti ya kupokelea | NMB 1021, Selcom 1023, CRDB 1020, droo 1000, sefu 1040, simu 103x, au **"Moja kwa moja kwenye mzigo/msambazaji"** (M-2) |

**Chaguo "Moja kwa moja kwenye mzigo/msambazaji"** (kuanzia tarehe ya kukata D):
- Mkopo hauandiki pesa yoyote kwenye droo wala benki, kwa sababu pesa haikupita hapo.
- Fomu inaomba purchases (au malipo ya msambazaji) yaliyolipwa na mkopo huo, na jumla yake lazima iwe sawa na pesa iliyopokelewa.
- Purchases hizo zinapata chanzo "Mkopo" kwenye `purchase_funding` (§2.3: Dr 1200 / Cr 2100, `capital_injection_uid` = mkopo huo). Malipo ya msambazaji yanakuwa Dr 2000 / Cr 2100.
- Ikiwa purchases bado hazijaingizwa, mkopo unahifadhiwa PENDING_LINK, na Capital inaonyesha "Mkopo X: 1,200,000 hazijaunganishwa na purchases". Hakuna journal mpaka uunganishwe.
- Mikopo ya kabla ya D (mfano B) inabaki ilivyo: Dr 1000, inayosawazishwa na purchases za Cr 1000 (M-2).

**Ratiba** (`loan_schedule`, inajitengeneza na kujitengeneza upya fomu ikibadilishwa):
- Kila malipo yanagawanywa kwa uwiano wa flat: deni = malipo × P / (P + R + F_m), riba (pamoja na ada) = malipo − deni.
  - F_m ni ada inayolipwa pamoja na malipo; ada iliyokatwa au iliyolipwa mwanzoni haiingii kwenye malipo.
  - Malipo ya mwisho yanachukua senti zilizobaki.
- Mfano wa A (M-1): 386,000 × 3, uwiano 1,000/1,158. Kila malipo ni deni 333,333.33 + riba 52,666.67; malipo ya mwisho (04/01/2027) ni 333,333.34 + 52,666.66. Jumla: deni 1,000,000, riba 158,000.

**Riba ya siku (GL):**
- Gharama ya siku = (R + F) ÷ (tarehe ya kumaliza − tarehe ya kuanza), kwa ada ya aina yoyote (M-5). Mfano wa A (M-1: R = 158,000, F = 0): 158,000 ÷ 92 = 1,717.39 kwa siku (04/10/2026 hadi 04/01/2027); siku ya mwisho inachukua senti zilizobaki.
- Kila siku: **Dr 6600 / Cr 2110 "Riba inayodaiwa"** (akaunti mpya, LIABILITY; M-4 imekubaliwa) kwa riba na ada iliyo pamoja na malipo.
- Ada iliyokatwa au iliyolipwa mwanzoni:
  - siku ya kupokea: Dr akaunti ya kupokelea (pesa halisi) + **Dr 1150 "Ada ya mkopo iliyolipwa mapema"** (akaunti mpya, ASSET) / Cr 2100 (deni lote);
  - au, ikiwa imelipwa tofauti: Dr 1150 / Cr chanzo;
  - kisha kila siku: Dr 6600 / **Cr 1150** kwa sehemu yake. Mwishoni, 1150 = 0.
  - ref `<loanUid>:RIBA:<tarehe>`, idempotent (`hasActivePosting(type, ref)` ya Toleo 1);
  - inaandikwa na kazi ya kila siku, pamoja na catch-up ya siku zilizokosekana;
  - siku iliyo kwenye mwezi uliofungwa inahamia siku ya kwanza iliyo wazi (`event_date`).
- Malipo halisi (siku ya malipo): **Dr 2100 (deni) + Dr 2110 (riba) / Cr chanzo.**
  - 6600 haiguswi tena siku ya malipo; ikiguswa, riba ingehesabiwa mara mbili.
  - Mwishoni mwa mkopo, 2110 = 0, 1150 = 0, na 6600 = R + F.
- Malipo yasiyo kwenye ratiba (mapema, kidogo, au zaidi) yanagawanywa kwa uwiano uleule. Ratiba ya mbele inahesabiwa upya.

**Malipo yanarekodiwa Capital tu:**
- yanaingizwa kupitia `POST /loans/{uid}/repay` yenye `funding_source` (§2.3, bila Droo);
- ruhusa ni CAPITAL_WRITE (ipo).

**Mkopo wa MARA_MOJA (mfano B):**
- Hakuna journal ya akiba, kwa kuwa ni taarifa ya kupanga tu.
- **Akiba iliyopo (Y) ni akaunti halisi 1025 "Akiba ya mikopo"** (M-6):
  - "Weka akiba" (Capital → mkopo huo) ni **FUNDS_TRANSFER Dr 1025 / Cr chanzo**, kupitia `transferFunds` iliyopo, yenye ref ya mkopo.
  - Chanzo kinaweza kuwa NMB, Selcom, CRDB, sefu au simu, lakini **si Droo**. Malipo ya mkopo hayahusiani na reco, kwa hiyo pesa ya droo inafika benki kwanza kupitia reco.
  - Mkopo wa mara moja unalipwa **Dr 2100 / Cr 1025**. Kama 1025 haitoshi, mstari wa pili unatoka kwenye chanzo kingine (Mchanganyiko wa §2.3, bila Droo).
  - "Toa akiba" (kurudisha bila kulipa) ni transfer ya kinyume, na sababu ni lazima.
  - **Y = salio la GL 1025** (kwa mkopo husika: Σ ya transfers zenye ref ya mkopo huo − malipo yaliyotoka 1025). Hakuna rejista ya pembeni, kwa hiyo hakuna namba mbili.
  - 1025 ni pesa halisi: inaingia kwenye mali na "Salio la app" (§2.5), lakini **haihesabiwi kwenye bajeti ya auto-order**.
- Inayohitajika kwa siku: **Z = (deni lililobaki − Y) ÷ siku zilizobaki** hadi tarehe ya kurudisha.
  - Mfano wa B, Y = 0: 15/10 → 1,200,000 ÷ siku 44 = 27,273; 19/10 → ÷ siku 40 = **30,000**. Ingeanzia 26/09, ingekuwa 19,048.
- **Onyo** (Capital, dashboard ya CEO, skrini ya auto-order, na Daily P&L juu ya jedwali):
  > "Mkopo B (Kikundi): zimebaki siku **X**; akiba iliyopo **Y**; inahitajika **Z** kwa siku."
  - Rangi ni njano kawaida, na nyekundu ikiwa Z > wastani wa "Pesa inayobaki baada ya mikopo" ya siku 14 zilizopita, au ikiwa X ≤ 7 na Y < deni lililobaki.
  - Mfano wa leo, 19/10: "zimebaki siku **40**; akiba iliyopo **0**; inahitajika **30,000** kwa siku". Kwa 15/10 (dump): siku 44, 27,273.

**Auto-order (V3 + `OrderSuggestion`): bajeti ya kununua inaondoa akiba ya mikopo ya siku**

```
bajeti = pesa iliyopo (received + collections − expenses − accrual, kama ilivyo)
       − akiba ya mikopo ya siku
```

- Akiba ya mikopo ya siku = Σ ya mikopo hai:

  | Aina | Akiba ya siku |
  |---|---|
  | MARA_MOJA | Z = (deni lililobaki − Y) ÷ siku zilizobaki |
  | MWEZI | malipo ya mwezi ÷ siku za mwezi huo. Mfano wa A: 386,000 ÷ 31 = **12,452** kwa Oktoba na Desemba; ÷ 30 = 12,867 kwa Novemba |
  | WIKI | malipo ÷ 7 |
  | SIKU | malipo ya siku |

- Riba **haiondolewi tena**: iko ndani ya malipo. `accrual` inabaki kwa gharama za mwezi tu, kwa hiyo hakuna kuhesabu mara mbili.
- Akiba inahesabiwa na function moja (`LoanReserveCalculator`), inayotumiwa na auto-order, Daily P&L ("Akiba ya mkopo") na onyo, ili namba moja ionekane kila mahali.
- `order_suggestion.budget_loan_reserve` inahifadhi kiasi cha siku hiyo.
- Skrini ya oda inaonyesha mstari "Akiba ya mikopo −42,452 (A 12,452 + B 30,000)" kati ya "Pesa iliyopo" na "Bajeti" (mfano wa 19/10).
- **Salio la 1025 halihesabiwi kwenye bajeti.** Bajeti inatoka kwenye pesa ya siku (received + collections − expenses − accrual), na 1025 haimo humo. Transfer ya "Weka akiba" haipunguzi bajeti ya siku mara ya pili, kwa sababu akiba ya siku (Z) imeshaondolewa.
- **Bajeti ≤ 0 baada ya akiba: oda haikatwi kimya.**
  - Juu ya skrini kunaonekana bango: "Akiba ya mikopo (42,452) imechukua bajeti yote ya leo".
  - Chini yake, orodha **"Zingatia hizi kwanza"**: fast-movers zilizo hatarini kuisha. Hizi ni bidhaa 20 zinazouzwa zaidi (kanuni ya M5) ambazo stock ya sasa ÷ velocity ni ≤ siku 2, au stock = 0.
  - Orodha imepangwa kwa siku chache zaidi za kubaki kwanza. Kila mstari unaonyesha kiasi kinachopendekezwa, gharama, na gharama ya jumla inayoongezeka.
  - Mistari ya mfumo inaonyeshwa "imesimamishwa: bajeti", si kufutwa.
  - Kitufe "Ongeza hizi" kinaziongeza kama mistari ya mkono, kwa uamuzi wa mtu. Onyo linabaki: "zaidi ya bajeti kwa X; akiba ya mikopo inapungua".
- Mkopo uliolipwa wote au uliohamishiwa mtaji hautoi akiba.

**Daily P&L na Capital** (mpangilio kama Asset: uchakavu ni gharama, ununuzi si gharama):

```
Faida ghafi
− Gharama za siku, za mwezi, uchakavu, upotevu wa mzigo
− Riba ya mikopo                 (riba ya siku; ileile iliyoandikwa 6600)
= Net profit
− Marejesho ya deni              (sehemu ya deni ya malipo halisi ya siku hiyo; Dr 2100)
− Akiba ya mkopo                 (mikopo ya MARA_MOJA tu: Z = (deni lililobaki − Y) ÷ siku zilizobaki; si journal)
= Pesa inayobaki baada ya mikopo
```

- Riba ya siku inahesabiwa na `LoanInterestCalculator`, function moja safi inayotumiwa na kazi ya GL **na** Daily P&L.
- Test inathibitisha: Σ 6600 ya GL kwa kipindi = Σ "Riba ya mikopo" ya Daily P&L, na Σ Dr 2100 ya malipo = Σ "Marejesho ya deni".
- `DailyPnlService` inaendelea kuacha `capital_type = 'LOAN_PAYMENT'` nje ya gharama za mwezi (kama ilivyo sasa). Riba inakuja kutoka kwenye rekodi za mikopo tu, si kutoka capex.
- Siku ya malipo ya mkopo wa awamu, "Marejesho ya deni" ni kubwa siku hiyo moja (mfano wa A: 333,333). Muhtasari wa mwezi unaonyesha jumla bila kuruka huko.

**Marekebisho ya `updateLoan`:**
- edit ya kiasi, tarehe, akaunti au masharti inageuza journal ya kupokea **kwa tarehe ya mkopo**, si leo (`onOriginalDate`, kama H-5). Kwenye A, reversal ya 11/10 ndiyo iliyoonyesha NMB 2,186,000 kati ya 04/10 na 10/10;
- inafuta riba ya siku zilizopita na kuiandika upya kutoka kwa masharti mapya;
- inatengeneza ratiba upya.

**Data iliyopo (hatua za prod za Toleo 2, zinatanguliwa na staging):**
- Mkopo A (`INJ-0c98b69e`): amount 1,186,000 → **1,000,000**, `interestTotal 158000`, `fee 0`, `installment 386000`, MONTHLY, 04/10/2026–04/01/2027, malipo ya kwanza 04/11/2026. NMB −186,000. Hatua bado inasubiri Toleo 2 (reversal kwa tarehe ya mkopo; `mkopo-athari.md` §3).
- Mkopo B: aina MARA_MOJA, riba 0, tarehe ya kurudisha 28/11/2026. Akaunti inabaki CASH 1000 (M-2: ilienda moja kwa moja kwenye mzigo; haiunganishwi na purchases, kwa kuwa ni ya kabla ya D). Maelezo "ulienda moja kwa moja kwenye mzigo" yanaongezwa kwenye rekodi.
- Riba ya siku za nyuma (04/10 hadi deploy) inaandikwa na catch-up.

**V135 (nyongeza):**
- akaunti 2110 "Riba inayodaiwa" (LIABILITY, CURRENT_LIABILITY) na 1150 "Ada ya mkopo iliyolipwa mapema" (ASSET, CURRENT_ASSET);
- `loan_terms.fee_mode` CHECK (DEDUCTED / PAID_UPFRONT / IN_INSTALLMENTS);
- akaunti 1025 "Akiba ya mikopo" (ASSET, CURRENT_ASSET, kundi la cash); "Weka akiba" inatumia FUNDS_TRANSFER iliyopo, yenye `reference_uid` = `<loanUid>:AKIBA:<uid>`. Hakuna jedwali jipya la akiba;
- `order_suggestion.budget_blocked_by_loans boolean`, na `order_suggestion_line.at_risk boolean` (orodha ya "Zingatia hizi kwanza");
- `order_suggestion.budget_loan_reserve numeric(19,2)`;
- `loan_terms` (loan_uid PK → `capital_injections.uid`, lender, received_amount, fee_amount, interest_total, repayment_type CHECK (DAILY/WEEKLY/MONTHLY/ONCE), installment_amount, start_date, end_date CHECK (end_date > start_date), receive_account_code);
- `loan_schedule` (uid, loan_uid, seq, due_date, amount, principal_part, interest_part, paid_amount, status DUE/PAID/PARTIAL);
- `capital_injections.funding_source` + `funding_account_code` (repayment), kama ilivyopangwa §2.6.

**Endpoints:**
- `GET /api/v1/capital-monitoring/loans/{uid}/schedule`;
- `PUT /loans/{uid}` inapokea sehemu za fomu;
- `POST /loans/{uid}/repay` inapokea `funding_source` na inagawanya yenyewe kama principal/interest hazijatumwa;
- `GET /api/reports/daily-pnl` inaongeza `loanInterest`, `loanPrincipalRepaid`, `loanReserve`, `cashAfterLoans` (kwa siku na jumla);
- `POST /loans/{uid}/reserve` {amount, fromAccount, note} → transfer Dr 1025 / Cr fromAccount (CAPITAL_WRITE; fromAccount ≠ 1000); `POST /loans/{uid}/reserve/release` {amount, toAccount, reason}; `GET /loans/{uid}/reserve` → Y kutoka GL 1025;
- `GET /api/v1/capital-monitoring/loans/warnings`: orodha ya maonyo (X, Y, Z, rangi) kwa dashboard na auto-order;
- `OrderSuggestionDto.budgetLoanReserve` na `loanReserveLines[]` (mkopo, aina, kiasi).

### 2.11 Hali ya malipo ya purchase na supplier payment ni lazima (19/10, mmiliki)

**Leo (code ya 2.2.70/2.2.71)** kuna default tatu zilizofichwa (`PostingEngine.postPurchase`, `postSupplierPayment`, V3):
- Purchase yenye supplier na kiasi tupu inakuwa **deni lote** (Cr 2000). Fomu ya V3 inaacha "Umelipa sasa" tupu, na repurchase haina sehemu ya malipo kabisa.
- Purchase bila `supplier_uid` inakuwa **cash yote** (Cr 1000), kimya, hata kama ina jina la msambazaji kama maandishi. Hali yake inabaki `UNPAID` kwa sababu ya default ya safu. Kwenye dump ya 15/10, purchases 166 (19.5M) ziko hivyo (`m7-malipo-wasambazaji.md` §6).
- Supplier payment bila njia inakuwa CASH. Fomu ya V3 inachagua CASH tayari.

**Kuanzia Toleo 2:**

| | Kanuni |
|---|---|
| Sehemu ya malipo | **Lazima**, chaguo 3 vinavyoonekana: **"Imelipwa yote"** (imechaguliwa tayari, inaonekana wazi), **"Sehemu"** (kiasi kinahitajika: > 0 na < jumla), **"Deni"** |
| Chanzo cha malipo | **Lazima** ikiwa si "Deni": chaguo za §2.3 (Droo, Sefu, benki, simu, Pesa ya mmiliki, Mkopo, Mchanganyiko). **Hakuna default** ya chanzo, na lazima mtu achague |
| "Deni" | Linahitaji msambazaji (`supplier_uid`). Deni bila msambazaji linakataliwa, kwa sababu hakuna mtu wa kumdai |
| Purchase bila supplier | Kanuni ileile: hali ya malipo na chanzo ni lazima. "Imelipwa yote" / "Sehemu" zinaruhusiwa, "Deni" halitaruhusiwa. Hakuna tena "cash kimya" |
| Supplier payment | Njia/chanzo ni lazima (§2.3); hakuna default ya CASH |
| GL | Inafuata hali iliyochaguliwa tu: Imelipwa yote → Cr chanzo; Sehemu → Cr chanzo (kiasi) + Cr 2000 (kinachobaki); Deni → Cr 2000. `supplierUid == null` haiamui tena |
| Sub-ledger | `payment_status` (PAID / PARTIAL / UNPAID) na `amount_paid` vinaandikwa kutoka kwenye chaguo, si default ya safu. Supplier payment inaunganishwa na purchases zake kwa FIFO (inasasisha `amount_paid` / `payment_status`), ili sub-ledger na GL zisitofautiane tena (§6 ya m7: purchases 67 zinazoonekana "bado" ingawa GL imezilipa) |

**Backend inakataa API isiyo na hali ya malipo** (400, ujumbe wa lugha mbili):
- `POST/PUT` purchase (moja, bulk, repurchase) bila `paymentStatus` ∈ {PAID, PARTIAL, CREDIT}, au PARTIAL bila `amountPaid` (0 < x < jumla), au PAID/PARTIAL bila `funding[]`, au CREDIT bila `supplierUid`.
- `POST` supplier payment bila `funding_source` / njia.
- Edit ya purchase ya zamani (kabla ya D): hali ya malipo haibadilishwi bila chaguo wazi; edit inayogusa kiasi tu inahifadhi hali ya awali, na haiwi default.
- Rekodi za zamani hazibadilishwi na migration. Safu 166 "UNPAID bila supplier" zinapata hali sahihi kupitia hatua ya marekebisho (dryRun kwanza): ni PAID, kwa sababu GL iliziandika cash.

**V3:**
- `purchase-form-dialog`: chaguo 3 kwa segmented control. "Imelipwa yote" iko tayari, inaonekana wazi, na inaonyesha jumla. "Sehemu" inaleta kiasi kinachohitajika na "Deni kwa msambazaji: X". "Deni" linaficha chanzo na linahitaji msambazaji. Chanzo kinatumia `funding-source-picker` (§2.8) bila default.
- `repurchase-page` / `repurchase-cart`: sehemu ileile kwa kila purchase (au moja kwa wote, ikiwa na "badilisha kwa kila moja"). Swali la sasa "Umelipa kwa taslimu ya siku hiyo?" linakuwa chanzo "Droo", si swali la pembeni.
- `supplier-payment-dialog`: njia/chanzo lazima, hakuna CASH iliyochaguliwa tayari.
- Kitufe cha kuhifadhi kimezimwa mpaka hali na chanzo vichaguliwe, na kinaonyesha sababu.

**M-9 (19/10):** `payment_date` ya supplier payments 7 inabaki 04/10, na zinapaswa kupata maelezo "malipo ya zamani ya Feb–Jul kutoka benki; GL imerekebishwa na M-7". Lakini **leo hakuna njia ya kuyaongeza bila code**: `SupplierPaymentController` ina GET, POST na DELETE tu, na dialog ya V3 inaunda tu. Kwa hiyo hili ni la Toleo 2: endpoint ya maelezo tu, isiyoandika journal (test 2.ae). Hadi hapo, maelezo yako kwenye journals 2 za M-7 na kwenye `m7-malipo-wasambazaji.md`.

**Kusafisha purchases zisizo PAID (19/10, mmiliki):**
- Inafanyika Toleo 2, **baada ya mmiliki kuthibitisha orodha** (`m7-malipo-wasambazaji.md` §6).
- Ni hatua ya data ya mara moja, yenye dryRun kwanza:
  - `payment_status` inakuwa PAID na `amount_paid` = jumla;
  - zile zilizolipwa na supplier payments zilizopo (zenye Cr 2000) zinaunganishwa nazo kwa FIFO (`supplier_payment_allocation`);
  - **hakuna journal mpya**, kwa sababu GL tayari iko sahihi (2000 = 0).
- Mmiliki alitaja safu **233**. Hesabu yangu kwenye dump ya 15/10 ni **236**:
  - 67 za > siku 30;
  - 3 za ≤ siku 30 zenye supplier;
  - 166 za ≤ siku 30 bila `supplier_uid`.

  Tofauti ya 3 ni zile 3 zenye supplier za ≤ siku 30 (136,200). Orodha ya mwisho itatolewa upya kutoka dump ya siku hiyo kabla ya kuthibitishwa.
- Ikiwa deni lolote kwenye orodha bado ni la kweli, linaondolewa kwenye usafishaji na kuandikwa kama deni (journal ya Cr 2000, baada ya uamuzi).

**V135 (nyongeza):** hakuna safu mpya kwa purchases, kwa sababu `payment_status`/`amount_paid` zipo. `purchases.payment_status` inaondolewa DEFAULT 'UNPAID' kwa rekodi mpya (NULL inakataliwa na service, si na migration, ili rekodi za zamani zisiguswe). Kuna pia `supplier_payment_allocation` (uid, supplier_payment_uid, purchase_uid, amount) kwa FIFO.

**Tests:**

| # | Jaribio | Kupita |
|---|---|---|
| 2.y | API: purchase bila `paymentStatus`; PARTIAL bila kiasi; PAID bila chanzo; CREDIT bila supplier; supplier payment bila njia | kila moja: 400 yenye sababu; hakuna purchase wala journal |
| 2.z | Purchase bila supplier, "Imelipwa yote", chanzo NMB | Dr 1200 / Cr 1021; `payment_status` PAID (si UNPAID); "Deni" bila supplier → inakataliwa |
| 2.aa | Purchase yenye supplier, "Sehemu" 30,000 kati ya 100,000, chanzo Droo | Cr 1000 30,000 + Cr 2000 70,000; PARTIAL, amount_paid 30,000 |
| 2.ab | Supplier payment 80,000 kwa msambazaji mwenye madeni 70,000 (05/10) + 50,000 (06/10) | FIFO: 70,000 kwa ya kwanza (PAID) + 10,000 kwa ya pili (PARTIAL); `supplier_payment_allocation` 2 |
| 2.ad | (iko tayari kwenye 2.2.71) Vipindi Jan–Sep CLOSED: `DELETE /gl/entries` (shadow mode) na `POST /gl/backfill` | zote mbili: "Kuna vipindi vilivyofungwa; rebuild/clear haviruhusiwi."; repost-sale ya rekodi moja bado inafanya kazi |
| 2.af | Kusafisha purchases zisizo PAID (baada ya mmiliki kuthibitisha orodha) | dryRun inaonyesha safu na jumla; halisi: `payment_status` = PAID, `amount_paid` = jumla, `supplier_payment_allocation` kwa FIFO kwa zilizolipwa na supplier payments; hakuna journal mpya; GL 2000 haibadiliki |
| 2.ae | Supplier payment: kuongeza maelezo tu (M-9) | `PATCH /api/v1/supplier-payments/{uid}/notes` (au sehemu ya Edit kwenye V3) inabadilisha `notes` tu; hakuna journal; audit |
| 2.ac | V3: fomu ya purchase na repurchase | "Imelipwa yote" iko tayari na inaonekana; kuhifadhi kumezimwa bila chanzo; "Deni" linaficha chanzo; test za component (`purchase-form-dialog.spec`, `repurchase-page.spec`) zinapita |

### 2.12 Password ya root bila default (19/10, mmiliki)

**Leo:** password ya root ina default inayojulikana mahali patatu:
- `application-pro.properties:34`: `root.password=${ROOT_PASSWORD:<default ya herufi 8>}`;
- `application.properties:129`: `${ROOT_PASSWORD:<default ya herufi 9>}`;
- `DataInitializer.java:37`: `@Value("${root.password:Root@123}")`.

Kama `ROOT_PASSWORD` haipo na root haipo, `DataInitializer` inaunda `root@system.com` kwa password hiyo inayojulikana (`:269`).

**Toleo 2:**
- **Defaults zote tatu zinaondolewa.** Properties zinakuwa `root.password=${ROOT_PASSWORD:}` (tupu), na `@Value("${root.password:}")`.
- `DataInitializer.initializeRootUser`:
  - root **ipo**: hakuna kinachohitajika. Password haiguswi (kama leo), hata `ROOT_PASSWORD` ikiwepo;
  - root **haipo** na `ROOT_PASSWORD` iko tupu au ni fupi kuliko herufi 12: **boot inashindwa** kwa `IllegalStateException`, ujumbe "ROOT_PASSWORD haijawekwa (au ni fupi): root haiwezi kuundwa kwa password inayojulikana. Weka ROOT_PASSWORD kwenye .env kisha anzisha upya." Ni kosa la kusimamisha app, si log tu.
  - Leo `run()` inameza makosa yote (`:86–88`). Kosa hili lazima lipite nje ya hapo.
- Hakuna mabadiliko kwa root iliyopo, kwa hiyo prod na staging (root ipo) zinaendelea kuwaka bila `ROOT_PASSWORD`.
- Kwa kuwa hii ni code ya Toleo 2, hatua (a) ya §1.8 (kubadilisha password) ndiyo kinga ya sasa.

**Kubadilisha status kunasafisha cache mara moja (19/10, mmiliki):**
- Leo `updateUserStatus` (`UserService.java:641–662`) inasafisha `userPermissions` tu. Cache ya `users` (ufunguo email, `@Cacheable` `UserService.java:876`, dakika 5) inabaki, kwa hiyo token ya mtumiaji aliyezimwa inaendelea kufanya kazi hadi dakika 5.
- Toleo 2:
  - `updateUserStatus` (zima / fungua / lock / terminate), `deleteUser`, na kubadilisha password vinasafisha `users` kwa email ya mtumiaji huyo, pamoja na `AuthTokenFilter.evictUserAuthoritiesCache(email)` (`AuthTokenFilter.java:59`) (cache ya ruhusa ya dakika 15).
  - Usafishaji ufanyike kupitia `CacheManager` moja kwa moja, si kwa `@CacheEvict` ya method ya ndani, kwa sababu wito wa ndani unapita bila proxy. Mfano ni `evictUserEmailCache` ya `UserService.java:721`, ambayo leo haifanyi kazi kwa sababu hiyo.
- Test **2.ak**: mtumiaji ameingia, kisha anazimwa. Request yake inayofuata inakataliwa (401) **mara moja**, si baada ya dakika 5. Akifunguliwa tena, anaingia mara moja.

**Tests:**

| # | Jaribio | Kupita |
|---|---|---|
| 2.ag | Root haipo, `ROOT_PASSWORD` tupu | boot inashindwa kwa ujumbe ule; hakuna mtumiaji aliyeundwa |
| 2.ah | Root haipo, `ROOT_PASSWORD` ya herufi 16 | root inaundwa, inaingia kwa password hiyo; `Root@123` inakataliwa |
| 2.ai | Root ipo, `ROOT_PASSWORD` haipo | boot sawa; password ya root haibadiliki |
| 2.aj | `grep -rn "Root@123\|ROOT_PASSWORD:" src/main` | hakuna matokeo |
| 2.ak | Mtumiaji anazimwa akiwa ameingia | request inayofuata: 401 mara moja; akifunguliwa: anaingia mara moja; cache ya `users` na ya ruhusa zimesafishwa |

---

## TOLEO 3: Counting ↔ Reco (2.2.73, V136)

### 3.1 Ziada zisizolinganishwa

- Kila reco iliyoidhinishwa yenye ziada ya K2 (si K1, si makato yaliyozidi) inapostiwa **Dr 1000 / Cr 2900** (D1), na inaongezwa kwenye `reco_surplus_pool` (uid, reconciliation_uid, snapshot_uid, cashier_uid, date, amount, remaining, status OPEN/MATCHED/CLOSED).
- Dirisha: kati ya `approved_at` ya counting iliyopita (session ya mwisho iliyoidhinishwa) na ya sasa.

### 3.2 Counting ikimtoza staff

- Kwenye skrini ya approval ya counting: **"Pendekezo la kulinganisha"**, ziada za dirisha (zote, kwa cashier) dhidi ya deni jipya la staff.
- Kiasi kinachopendekezwa = **min(ziada iliyobaki, deni)**. Hakuna kinachofanyika chenyewe.
- Mwenye ruhusa `COUNTING_SURPLUS_MATCH` akikubali, kwa kila mechi M:
  - Journal **Dr 2900 M / Cr 1120 M** (`COUNT_SURPLUS_MATCH`, ref `MATCH:<uid>`, tarehe ya approval ya counting).
  - `reco_surplus_pool.remaining` −M (→ MATCHED ikiwa 0).
  - `staff_liability_payment` aina `SURPLUS_MATCH` M, na sababu kwenye deni: "Imelinganishwa na ziada ya reco 12/10 (15,000)".
  - Staff anaiona kwenye `/my` na anaweza kukubali au kupinga kwa njia zilizopo (`/items/{uid}/acknowledge`, `/dispute`). Ikipingwa: reverse ya mechi + rekodi ya mgogoro.
- **Ziada isiyolinganishwa → 6700 (D1):** inafungwa kwenye mojawapo ya hatua mbili, ipi itakayotangulia. Hakuna job ya nyuma.
  - **Counting inayofuata:** approval ya counting inaonyesha mechi zinazopendekezwa. Baada ya kuamua mechi, ziada zote za dirisha lake zilizobaki zinafungwa: Dr 2900 / Cr 6700 "ziada ya droo isiyolinganishwa", pool → CLOSED. Inaonyeshwa kwenye skrini ya approval kabla ya kuthibitisha.
  - **Mwisho wa mwezi:** kufunga mwezi (§4.3) kunafunga pool iliyobaki ya mwezi huo kwa journal ileile.

### 3.3 V136 `Counting_Reco_Surplus_Match`

- `reco_surplus_pool`, `reco_surplus_match` (uid, pool_uid, liability_item_uid, amount, journal_entry_uid, status ACTIVE/REVERSED, approved_by_uid, created_at);
- aina mpya ya `staff_liability_payment.payment_type` = SURPLUS_MATCH;
- permission `COUNTING_SURPLUS_MATCH`.

Ziada za kabla ya Toleo 3 (zilizopostiwa 6700 na Toleo 1): zinabaki 6700. Hiari: kuziingiza kwenye pool kwa reclass Dr 6700 / Cr 2900, kwa uamuzi wa mmiliki.

### 3.4 Endpoints na UI

| Method | Path | Ruhusa |
|---|---|---|
| GET | `/api/counting/sessions/{uid}/surplus-suggestions` | COUNTING_APPROVE |
| POST | `/api/counting/sessions/{uid}/surplus-matches` {matches[]} | COUNTING_SURPLUS_MATCH |
| POST | `/api/counting/surplus-matches/{uid}/reverse` | COUNTING_SURPLUS_MATCH |
| GET | `/api/reconciliation/surplus-pool?status=OPEN` | FINANCE_READ |
| POST | `/api/reconciliation/surplus-pool/{uid}/close` {to: 6700} | FINANCE_MANAGE |

UI ya V3:
- `features/counting`: kadi ya pendekezo kwenye approval (ziada, deni, kiasi; Kubali/Ruka);
- liability card: sababu ya mechi;
- `features/reconciliation`: tab ya "Ziada zisizolinganishwa".

### 3.5 Staging (Toleo 3)

| # | Jaribio | Kupita |
|---|---|---|
| 3.a | Reco 2 za ziada K2 (15k, 28.5k) + 1 ya K1 kati ya counting mbili | pool ina 43,500; K1 haimo |
| 3.b | Counting inamtoza staff 30,000 | pendekezo 30,000; kukubali → Dr 2900/Cr 1120 30,000; deni 0; pool 13,500 |
| 3.c | Staff anapinga | mechi imegeuzwa; deni 30,000; pool 43,500 |
| 3.d | Mtumiaji asiye na ruhusa | 403 |
| 3.e | Kufunga pool iliyobaki | Dr 2900/Cr 6700 13,500 |

---

## TOLEO 4: Tarehe ya kukata + Capital (2.2.74, V137)

### 4.1 Journal ya ufunguzi (tarehe D)

Mmiliki anajaza jedwali la RIPOTI h.2: droo, sefu, kwa meneja, NMB, Selcom, CRDB, M-Pesa, Tigo.

| Hatua | Dr | Cr |
|---|---|---|
| Pesa iliyo benki/simu/sefu | 102x / 103x / 1040 / 1045 | 1000 (transfers, mtaji haubadiliki) |
| 1000 ya GL > droo halisi (baki) | 3100 (mmiliki alichukua) au 6900, kwa uamuzi | 1000 |
| 1000 ya GL < droo halisi | 1000 | 2900 → tofauti ya 2.4 |

### 4.2 Capital (V3)

- **Kadi "Pesa isiyo na chanzo":** jumla ya PENDING na 2900.
- **Daraja la Mtaji:** `GET /api/gl/equity-bridge?from&to`, query moja ya GL kwa makundi ya akaunti, si calculator mpya. Mwisho wake lazima = `financialPosition.totalEquity`.
- **Mtaji halisi = Mali − Madeni** (hero ya `capital-overview.ts` ipo; inaongezwa Daraja na kadi).
- **Kadi "Mkopo umelipa?"** (kwa kila mkopo, na jumla):

  | Kipimo | Maelezo |
  |---|---|
  | Msingi | Siku 56 kabla ya mkopo wa kwanza ulio hai, pamoja na kipindi kilekile cha mwezi uliopita (24–29 ni kilele) |
  | Faida ghafi ya ziada | (faida ghafi/siku tangu mkopo − msingi) × siku |
  | Riba hadi leo | Σ 6600 ya mkopo huo |
  | Matokeo | **Faida ghafi ya ziada − riba**: kijani > 0, nyekundu < 0, pamoja na maandishi "haithibitishi chanzo" |
  | Stockouts za fast-movers | Kwa siku, kati ya 20, kabla → baada, na **mabadiliko** (kanuni ya `mkopo-athari.sql` M5). Kijani yakipungua, nyekundu yakiongezeka |
  | GM | GM % kabla → baada, na **mabadiliko kwa pointi**. Nyekundu ikishuka zaidi ya 0.3 pt |
  | Mzigo | Mzigo (GL 1200) siku ya mkopo dhidi ya leo |
  | Hukumu ya kadi | Vipimo vitatu vinaonyeshwa pamoja, si faida ghafi peke yake. "Umelipa" ni kijani tu ikiwa faida ghafi ya ziada − riba > 0, **na** stockouts hazijaongezeka, **na** GM haijashuka zaidi ya 0.3 pt; vinginevyo njano, pamoja na sababu |

  Kadi inatumia query ileile ya M5/M6, si calculator mpya. Namba za 14/10:
  - faida ghafi +22,846 kwa siku (au +10,889 dhidi ya kipindi kilekile cha mwezi uliopita);
  - riba 1,717 kwa siku (158,000 ÷ 92);
  - stockouts 3.59 → 4.32 (+0.73, nyekundu);
  - GM 8.94% → 8.26% (−0.68 pt, nyekundu);
  - hukumu: **njano**. Faida inazidi riba, lakini stockouts na GM zimekuwa mbaya zaidi.

### 4.3 Kufunga vipindi

- ≤ 30/09 tayari umefungwa (1.9).
- Oktoba inafungwa baada ya Toleo 2 na 4.1, kwa masharti:
  - hakuna `capital_discrepancy` PENDING ya Oktoba;
  - `gl_posting_failure` wazi = 0;
  - checks = 0;
  - salio la app limeingizwa kwa akaunti zote zenye mwendo (2.5);
  - pool ya ziada ya Oktoba imefungwa (Dr 2900 / Cr 6700, D1);
  - 2900 iliyobaki imeelezwa.
- Kanuni ya tarehe iliyofungwa (kuhamishwa + `event_date` + alama; journal za mkono → kufungua upya) tayari iko tangu V134 (1.9).

V137 `Gl_Period_Close_Rules`: `gl_period.checks_json` inajazwa na masharti hapo juu wakati wa kufunga, na kufunga kunakataliwa sharti likikosekana. Hakuna `late_entry_policy`; kanuni ni moja (uamuzi 4).

### 4.4 Staging (Toleo 4)

| # | Jaribio | Kupita |
|---|---|---|
| 4.a | Journal ya ufunguzi kwa namba za mfano | salio = namba; mtaji haubadiliki kwa transfers |
| 4.b | Daraja la vipindi 3 | mwisho = totalEquity; mwanzo wa Okt = mwisho wa Sep |
| 4.c | Kufunga Oktoba ikiwa na PENDING 1 | inakataliwa, na sababu |
| 4.d | Kufunga Oktoba bila salio la app la M-Pesa | inakataliwa: "salio la app halijaingizwa: 1030" |
| 4.e | Kufunga Oktoba, pool ya ziada ina 13,500 | journal Dr 2900 / Cr 6700 13,500; pool CLOSED |
| 4.f | Kadi "Mkopo umelipa?" kwenye dump ya 15/10 | faida ghafi +22,846 kwa siku, riba 1,717 kwa siku, stockouts 3.59 → 4.32 (+0.73), GM 8.94 → 8.26 (−0.68 pt), hukumu njano; namba = `mkopo-athari.out` M5/M6 |

---

## Yaliyobaki

- **Hatua 36** (`analysis\steps\36-h2-staging.cmd`): inathibitisha chanzo cha H-2 kwenye staging 2.2.70. Bado haijaendeshwa. Code ya Toleo 1 haitegemei utabiri wake: posting inasoma sale kutoka DB baada ya commit, kwa hiyo inarekebisha H-2 kwa chanzo chochote cha "entity ya zamani".
- **Q1–Q12 za RIPOTI** bado zinasubiri. Muhimu kwa Toleo 1: Q1 (K2 za siku 2 kubwa: 04/07 na 24/06) na Q9.

## Hali ya Toleo 1 (16/10)

Code imeandikwa, **haijacommitiwa**. Diffs: `analysis\steps\toleo1-backend.diff`, `toleo1-frontend.diff`.

**Backend 2.2.71 (V134):**
- `gl_posting_failure` + kurekodi kwa kila mwitaji anayemeza kosa;
- `SaleGlPostingService`: posting baada ya commit, kutoka DB;
- kanuni mpya ya variance + guard;
- reopen/supersede zinageuza variance;
- vipindi + `gl_period_audit` + kuhamisha tukio la kuchelewa;
- endpoints za §1.5 chini ya `/api/v1/gl`.

Tofauti na mpango:
- ruhusa ni **FINANCE_WRITE** (FINANCE_MANAGE haipo kwenye mfumo);
- kuna `GET /periods/audit`.

**Maamuzi ya mmiliki 16/10 (kabla ya commit):**
1. **Ruhusa.** Kwenye `lsms_audit_20261015_0200`, FINANCE_WRITE iko kwa CEO (mtumiaji 1) na Executive CEO (mtumiaji 1) tu. MANAGER (watumiaji 4) hana. Hivyo sharti la "ikiwa manager anayo" halikutimia, na GL_PERIOD_MANAGE / GL_FAILURE_RETRY **hazijaongezwa**. ROOT (watumiaji 2) wanapita kila ruhusa.
2. **Q9.** V134 inaunda akaunti **2900 Suspense** (LIABILITY). `POST /corrections/day-close-variance` imepata kigezo `suspenseSnapshotUid` (kinaweza kurudiwa). Ziada ya snapshot hizo inapostiwa Dr 1000 / Cr 2900 badala ya Cr 6700, na 1000 inabaki ileile.
   - Run halisi inakataa uid ambayo si SURPLUS hai.
   - Staging (hatua 40) inabaki na 6700. Hatua 39 inaonyesha tofauti kwa dryRun ya pili (`1.g-Q9`).
   - PROD itapitisha uids `6c9e781d-4e31-4696-9247-9f23c2da4b07` (24/06, 210,500) na `850ff8e2-7393-4af1-b830-48a9a8c06d10` (04/07, 532,000). Jumla kwenye 2900 ni 742,500, na 6700 inapungua kiasi hicho hicho.
   - Tahadhari: reopen ya baadaye ya reco ya siku hizo ingepost upya kwenye 6700.
3. **13,900.** Imethibitishwa, tazama §1.2 na `21-tofauti-13900.out`.

Tests 406/406; baada ya maamuzi ya 16/10: 411, 0 zilizoshindwa (1 skipped, kama awali).

**Uamuzi wangu mmoja wa kukagua:**
- Reversal za marekebisho na za reopen zinaandikwa kwenye **tarehe ya journal ya awali**, si leo. Hii inafanya historia ya kila mwezi isahihike.
- Kipindi kikiwa kimefungwa, reversal inahamia siku ya kwanza iliyo wazi, ikiwa na `event_date`.

**Kosa nililogundua na kurekebisha:** repost ya sale ya zamani lazima itumie hali ya siku ya mauzo.
- 121026-2249 ililipwa 175,000 tarehe 13/10, na malipo hayo yana journal yake.
- Malipo yaliyopostiwa baadaye yanarudishwa kwenye AR, ili pesa isihesabiwe mara mbili.

**V3 3.1.11:**
- kadi "Makosa ya GL yasiyotatuliwa" yenye "Jaribu tena";
- tab "Vipindi" (funga / fungua upya kwa sababu, historia);
- alama "Imechelewa" kwenye journal;
- reco approval inaonyesha "Ziada ya kweli / Makato yaliyozidi".

ngc safi; picha zilipigwa dhidi ya backend ya PC.

**Rehearsal kwenye PC:**
- DB ya muda `lsms_toleo1_scratch`, kutoka dump ya 15/10.
- Backend ya working tree, Flyway imewashwa.
- Matokeo: V134 sawa; awamu A 7/7, B 11/11 (1.i kupitia reopen ya reco ya 30/09), C/D 3/3.

| Kipimo | Kabla | Baada |
|---|---|---|
| Journals 87 za variance | — | zimerekebishwa |
| dryRun ya pili | — | 0 |
| 1000 | −813,949.95 | +620,450.00 (+1,434,399.95) |
| AR ya GL | 1,828,000 | 2,052,000 = sub-ledger |
| TB na mizania | — | zinalingana |

Utabiri kwa SQL: `19-toleo1-dryrun-utabiri.sql/.out`, `20-toleo1-h2-utabiri.sql/.out`.

**Ukaguzi wa diff 19/10 (mmiliki: 7 pointi, kabla ya commit) — umetekelezwa, bado haujacommitiwa:**
1. Idempotency: `postCurrent` na `postFromDb` zinakagua journal hai isiyogeuzwa kwa (reference_type, reference_uid) kwanza → `ALREADY_POSTED`, kosa linatatuliwa. Retry mara mbili → journal 1 (tests).
2. Reco isiyo APPROVED: `postCurrent` → `NOT_APPROVED`; `correct()` haipost POST_MISSING; journal hai ya reco iliyofunguliwa kabla ya Toleo 1 → `NOT_APPROVED / REVERSE_ONLY`. Kwenye 15/10: reco 1 (11/10, +6,000, snapshot e6c52c65…).
3. `daily_financial_snapshot.variance_target` (V134, CHECK '6700'/'2900'): `correct()` halisi inaiweka kwa uids za Q9; approval, retry, correct zinaisoma; re-approval inainakili kwenye toleo jipya.
4. `declaredCash == null` → `NOT_COUNTED` (haipostiwi). Safu ni NOT NULL kwa sasa, hivyo hakuna data inayobadilika.
5. Makosa ya `correct()` → `gl_posting_failure` (DAY_CLOSE_CORRECTION); retry yake haipost, inaelekeza kurudia marekebisho. Hatua 40 inahifadhi JSON kamili (`40-marekebisho-halisi.json`).
6. Hatua mpya 36b (kabla, 2.2.70) na 38d (baada, 2.2.71): `pos-muda.mjs`, 10 cash + 10 deni, ms.
7. `checks_json.controlChecksNote`: "informational; controlChecks ina H-9".
- Pia: snapshot iliyopitwa → `SUPERSEDED` (inatatuliwa) badala ya kosa lisilotatulika milele.
- Tests 425, 0 zilizoshindwa (1 skipped).

**Hatua (mpangilio, imesasishwa 19/10):**
1. **36-1** washa staging (mmiliki aliisimamisha; `up -d --pull never`, lazima 2.2.70 / 133) → **36-0** (kusoma tu, `SELECT 1`) → **36** (staging 2.2.70) → **36b** (muda wa POS kabla);
2. commit main ✔ (backend `91c5f0b`, `e57e08f`, `8c83b45`; V3 `ef4e097`) → push (mmiliki);
3. 37 build 2.2.71;
4. 38a dump ya leo;
5. 38b restore staging;
6. 38c staging 2.2.71, kisha 38d (muda wa POS baada);
7. 39 (awamu A, soma dryRun);
8. 40 (awamu B: marekebisho, reopen, **M-7**, kufunga Jan–Sep);
9. 41 (kosa la GL la kulazimishwa);
10. prod: §1.8 kwa mpangilio wake: deploy → 44 (a0) → (a)–(d) → marekebisho → 43 (M-7) → kufunga Jan–Sep → 42;
11. **Hatua ya mmiliki: simamisha staging tena**, baada ya hatua 41 kupita **na** prod (10) kukamilika, ili kuokoa RAM ya Contabo (prod iko kwenye server ileile).
    - Amri (mmiliki): `cd ~/lsms-staging && docker compose -p lsms-staging stop`.
    - `stop`, si `down`: containers na data ya staging zinabaki, na 36-1 inaweza kuiwasha tena.
    - Kabla na baada, angalia `free -m` na prod `docker compose ps` (prod lazima isibadilike).
