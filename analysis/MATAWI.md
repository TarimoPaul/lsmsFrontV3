# Matawi ya backend (Lsms) na kanuni za migration (26/10/2026)

| Branch | Maana | Mahali |
|---|---|---|
| `main` | **= prod.** Prod inaendesha 2.2.71. main = `d2298fb` (ssh -n), imepushwa. | `D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms` |
| `hotfix/2.2.72` | **Hotfix**: root boot, hakuna password ya default, kinga ya mwezi uliofungwa, `Assert-ReleaseBranch`. HEAD = `d2298fb`; kazi bado haijacommitiwa. | worktree `...\Lsms\Lsms-hotfix-2272` |
| `feature/sales-returns` | **WIP**: returns + exchange, migration ya muda `V135`. Haijajaribiwa staging, **si ya prod**. Commit `9425223`, haijapushwa. **03/11 (ci): C4 IMETOKA kwenye kifurushi 2.4.0 → BAADA-YA-BATCH §7.** Migration itapata namba baada ya V138 wakati wa merge yake. | backend (branch tu) |
| `feature/sales-returns` (V3) | **WIP**: UI ya returns (faili 12). Commit `e199712`, haijapushwa. **Nje ya 3.2.0 (ci).** | lsmsFrontV3 |
| `feature/mikopo-2.3.0` | Bado haipo. Itaanzishwa baada ya MUUNDO kukubaliwa (`analysis\toleo2\MUUNDO-2.3.0.md`). | |

Toleo 2 = **2.3.0** (mmiliki 26/10).

## Kanuni za build

1. Image ya prod hujengwa kutoka `main` au `hotfix/*` **tu**. `feature/*` huingia `main` kwanza (mmiliki ndiye anayemerge), kisha toleo hujengwa kutoka `main`.
2. Image haibebi faili ya `db/migration` ambayo haipo kwenye `main`.
3. **Hotfix haiongezi migration yoyote.**
4. `deploy/deploy-backend.ps1` inazilinda kanuni 1–3 kupitia `Assert-ReleaseBranch`.
   - Iko kwenye worktree ya hotfix na bado haijacommitiwa. Diff: `analysis\steps\hotfix-2272-build-kinga.diff`.
   - Inakataa kila run isipokuwa `-PreflightOnly` ikiwa:
     - HEAD iko detached, au branch si `main` wala `hotfix/*`;
     - kuna faili ya migration (kwenye HEAD, kwenye working tree, au ndani ya jar kwa `-DeployOnly`) ambayo haipo kwenye `git ls-tree main`.
   - Kesi 11/11 SAWA.
   - Main itapata kinga hii hotfix ikimergiwa.

## Kanuni ya majaribio (mmiliki 31/10 ba)

**"Local" = Docker ya PC inayofanana na prod:**
- image ileile (digest) itakayoenda prod;
- PostgreSQL 15 (si 16/17);
- docker compose yenye mipangilio/env ya prod bila siri;
- dump ya prod ya karibuni, iliyopita restore test.

**Njia ya kila aina ya badiliko:**

| Badiliko | Njia |
|---|---|
| V3 tu, bila mabadiliko ya API | local → prod |
| Backend bila migration, isiyogusa data ya fedha/stock | Docker-local → prod (digest ileile) |
| Migrations, au data ya Capital/Store/GL/stock/sales/payments/reco/counting | Docker-local → Contabo staging → prod |
| Infra (compose, nginx, uid, env, volumes) | Contabo staging → prod |

- Kifurushi chenye migrations + infra (2.4.0 / 3.2.0): Docker-local kwa kila kipengele, kisha staging MOJA (script moja), kisha prod MOJA.
- Majaribio ya SQL ya native yaendeshwe pia kwenye PG15.
- Kifurushi (mmiliki az): hakuna staging/prod mpaka kazi ZOTE zikamilike local. Tarehe ya kufunga ni **16/11/2026**; kisichokamilika na kujaribiwa hadi hapo kinahamia toleo linalofuata. Branches: `release/2.4.0` (backend), `release/3.2.0` (V3).
- **Orodha ya kifurushi (be), imesasishwa 03/11 (ci):** ✔ A1–A6, ✔ B, ✔ C1 → C2 → C3 → C5/C8 (orodha kwanza) → C6 → C7 → C9.
  **(cj) ✔ bei ya kununua/kipande** kwenye orodha ya bidhaa: backend `release/2.4.0` 8d6413f (ProductDto lastPurchaseCost, bila migration), V3 `release/3.2.0` bf38487; e2e `bei_e2e`.
  **C4 (sales returns) IMETOKA** → BAADA-YA-BATCH §7. Hakuna kazi ya C4 kwenye release/2.4.0 wala release/3.2.0.
  **(cn) ✔ C2** imeunganishwa: release/2.4.0 `3ab2b3b` (lango kamili limepita, RIPOTI-CN-03-11).
- **Mpango wa deploy 2.4.0, taarifa kwa watumiaji (co):** prod iko **Contabo, inafanya kazi saa 24**, na schedulers zinaendeshwa usiku.
  Kwa hiyo baada ya C2, notification **"Muhtasari wa Mauzo: <jana>"** (aina `DAILY_SALES_SUMMARY`) **itatumwa kila usiku saa 00:00 EAT**
  (`DailySalesNotificationScheduler`, cron `0 0 0 * * *`). Zamani haikutumwa kamwe, kwa sababu safu ya `Object[]` ilikuwa imefungwa.
  - Ujumbe: "Mauzo ya <tarehe>: Miamala n | Jumla TZS … | Faida TZS …". **Una faida ndani.**
  - Wapokeaji **(cq)**: role ina `SALES_READ` + status **ACTIVE** + **si locked** + si kufutwa. Hakuna tena fallback ya "watumiaji wote":
    asipokuwepo hata mmoja, haitumwi (log WARN).
  - **CHAGUO la Chief (cq), faida:** env `DAILY_SALES_PROFIT_ROLES` (application.properties: `lsms.daily-sales.profit-roles=${DAILY_SALES_PROFIT_ROLES:}`); ili ifike kwenye container, iongezwe pia kwenye `environment:` ya compose ya prod.
    Tupu (default) = wote wanaona faida, kama leo. `CEO,Executive CEO` = wengine (macheda, MANAGER) wanapata mauzo tu:
    ujumbe bila "Faida", na `totalProfit` null, ambayo V3 tayari inaificha. Chief akiamua: mstari kwenye `.env` + compose, kisha restart ya backend; hakuna build.
  - **UAMUZI (cr): prod = `DAILY_SALES_PROFIT_ROLES=CEO,Executive CEO`** — sehemu ya deploy ya 2.4.0, kwenye `.env` ya prod
    NA `environment:` ya compose (`DAILY_SALES_PROFIT_ROLES: ${DAILY_SALES_PROFIT_ROLES}`). Chief anaweza kuongeza `MANAGER` baadaye
    (`CEO,Executive CEO,MANAGER`) kwa restart tu. Majina yamethibitishwa kwenye dump 29/10: role `CEO` na `Executive CEO` zipo hivyo hasa.
    Baada ya deploy, thibitisha: notification ya kwanza ya macheda haina "Faida", ya Jess/Paul inayo.
  - ⚠ **ONYO (cr): env inatumia JINA la role, si uid.** Ukibadilisha jina la role (k.m. "Executive CEO" → "Mkurugenzi"),
    **sasisha `DAILY_SALES_PROFIT_ROLES` siku hiyohiyo**, vinginevyo wenye role hiyo wataacha kuona faida kimya (watapata mauzo tu).
    Herufi kubwa/ndogo na nafasi kando hazijalishi; tahajia nyingine yoyote inajalisha.
  - Orodha kwenye dump ya prod 29/10 (status/locked imesomwa moja kwa moja kwenye faili la dump), wote 3 ni ACTIVE, si locked, na wana pia `PROFIT_REPORT`:

    | Jina | Email | Role |
    |---|---|---|
    | Jess Saimon | jess@elikom.co.tz | Executive CEO |
    | macheda macheda | macheda@gmail.com | MANAGER, SALES |
    | Paul Tarimo | tarimo@gmail.com | CEO |

  - Siku ya deploy, orodha hii **ikaguliwe tena** kwenye nakala ya `lsms_audit_*` ya siku hiyo: mtu yeyote mpya mwenye `SALES_READ`
    ataiona faida. Query iko kwenye RIPOTI-CO-CP-03-11.
- **Skripti ya staging ya kifurushi (ci):** inarudisha staging kutoka **dump ya prod ya karibuni** (siyo nakala safi), kisha inakagua Flyway:
  V135→V138 zinaingia (`success`), hakuna validate error kwenye log ya boot, safu za V039 na V056 kwenye `flyway_schema_history`
  hazibadiliki (version, description, checksum, installed_on kabla = baada). V039 inabaki kama ilivyo (BAADA §5).

**Kiolezo (kimoja kwa kila toleo):** `deploy/local/` ya backend (release/2.4.0 `804e4da`).
```
deploy/local/local.sh build              # jar + image lsms-backend:local-<sha> kutoka worktree hii; inatoa digest
deploy/local/local.sh up <image> [dump]  # PG15 <- dump (restore test: exit 0, Flyway iliyoshindwa 0, TB 0), kisha backend
deploy/local/local.sh token | psql "<sql>" | down
```
- Ports: PG 127.0.0.1:55415, backend 127.0.0.1:18090. Siri ni za kutupwa (`deploy/local/.siri`, gitignored).
- Schedulers zimezimwa kwa default (`APP_SCHEDULERS_ENABLED=true` ili kuziwasha).
- ~~`build` inahitaji `application.properties` ya worktree ya main~~ — C1 (release/2.4.0) imeiweka kwenye git. Siri za dev: `<worktree>\config\application.properties` (gitignored); hatua ya release ya main: `analysis\steps\72-c1-siri-dev.cmd`.
- Jaribio la kwanza (31/10): release/2.4.0 `d0fc776` + dump ya 29/10 10:27 → restore SAWA, Flyway 134 → 137 kwenye PG15, uid 10001 inaandika /app/logs.

**V3 (mmiliki 31/10 bg): hakuna `ng serve`.** V3 inajaribiwa kwa production build:
```
deploy/local/v3-local.sh build   # ng build --configuration production --base-href /v3/ (kama deploy/Dockerfile)
deploy/local/v3-local.sh up      # nginx.conf ya image ya prod + "edge" nginx: /v3 -> V3, /api -> backend ya Docker-local
```
- Kivinjari: http://127.0.0.1:4300/v3/ (backend Docker-local lazima iwe juu). Edge inatuma `Origin: https://elikom.co.tz` kama prod.
- Majaribio ya Playwright yanaendeshwa YOTE upya kwenye build hiyo kabla ya merge kwenye release/3.2.0.

**Lango la staging (mmiliki 01/11 bi): yote matatu lazima yapite kwenye build ya MWISHO kabla ya prod.** Log zake zinaambatishwa kwenye ripoti ya staging.
```
Lsms (release/2.4.0)      deploy/local/pg-checks.sh       # LoanSqlPgCheck + SaleChangePgCheck + PnlBridgePgCheck, PG15 ya kutupwa kwa kila moja -> PG_CHECKS_OK 3/3
Lsms (release/2.4.0)      mvnw test                       # suite nzima, Failures 0, Errors 0
Lsms (release/2.4.0)      deploy/local/c2-check.sh        # (cm) C2QueryPgCheck + C2CorrectnessPgCheck kwenye Docker-local YENYE DATA -> C2_OK 2/2
lsmsFrontV3 (release/3.2.0) deploy/local/e2e/run-all.sh   # Playwright YOTE (b1, b2, ...) kwenye v3-local build -> E2E_OK n/n
```
- (cp) `pg-checks.sh` na `c2-check.sh` zinapakia siri za majaribio zenyewe kutoka `deploy/local/.siri-majaribio` (gitignored; `siri-majaribio.sh init`) na zinakataa bila faili la hash za prod `%USERPROFILE%\.lsms-kinga\prod-siri.sha256` (hatua 73) au siri ikilingana na prod.
  (cq) Faili lina **prefix ya hex 8 tu** ya kila hash (hash nzima haitoki server). Kinga inalinganisha prefix, na inakataa faili lenye hash nzima.
- `pg-checks.sh` inatengeneza container `lsms-pgcheck` (:55439) na kuiondoa mwishoni hata ikishindwa, ili isishike RAM. `all` inaongeza JwtRevocationPgCheck + LoginAuditPgCheck.
- Playwright inaendeshwa dhidi ya Docker-local (image ya digest itakayoenda staging + dump ya karibuni) na build ya V3 itakayoenda staging. Kila kipengele kipya cha V3 kinaongeza `<jina>_e2e.cjs` yake kwenye `deploy/local/e2e/`.
- Lolote likishindwa → hakuna staging wala prod.

## Kanuni ya namba za migration (mmiliki 26/10)

**Toleo linalofika prod kwanza ndilo linalochukua namba inayofuata. Migration ambayo haijafika prod inapewa namba mpya wakati wa merge kwenye main.**

1. **Namba ya kudumu inapatikana tu wakati wa merge kwenye main.**
   - Kwenye `feature/*`, namba ni ya muda.
   - Wakati wa merge, namba inakuwa `max(namba za main) + 1`, ikiongezeka kwa mpangilio kama kuna zaidi ya moja.
   - Branch inayomergiwa baadaye inabadilisha namba zake kabla ya merge. Faili inabadilishwa jina tu; maudhui hayabadiliki.
2. **Kinachofika prod kwanza kinachukua namba inayofuata.** Hakuna "returns kwanza" wala "mikopo kwanza" iliyopangwa mapema. Mfano:
   - Mikopo ikimergiwa main kwanza, inakuwa V135.
   - Returns (V135 ya muda) inakuwa V136 wakati wa merge yake.
3. **Namba ya migration iliyofika prod haibadilishwi kamwe**, wala maudhui yake.
   - Marekebisho yanakwenda kwenye migration mpya.
   - Flyway inahifadhi checksum, na kanuni hii ndiyo itakayoruhusu `validate-on-migrate=true` (tazama mpango hapa chini).
4. **Staging na namba za muda.**
   - DB ya staging iliyoendesha namba ya muda (mfano V135 ya returns) **inarudishwa kutoka dump ya prod ya siku hiyo** kabla ya kujaribu namba mpya.
   - Vinginevyo `flyway_schema_history` ya staging ingekuwa na V135 tofauti na ile ya main.
5. **Ukaguzi wa merge** (mmiliki, kabla ya kumerge):
   - `git ls-tree main -- src/main/resources/db/migration` dhidi ya branch;
   - namba za branch lazima ziwe kubwa kuliko namba kubwa ya main, na zisijirudie;
   - hatua ya build (`Assert-ReleaseBranch`) inakataa chochote ambacho main haina.

## Mpango wa kuzima `out-of-order` (hatua tofauti, HAIJAANZA)

> 03/11 (ch): kazi hii IMEHAMIA BAADA-YA-BATCH §5. Kipimo ni flyway_schema_history ya dump ya prod (29/10), siyo nakala mpya.
> Kizuizi kilichopatikana: V039 ya prod ≠ V039 ya code (tazama §5).

**Hali ya leo:**
- `src/main/resources/application.properties` ni faili **gitignored** linaloingizwa kwenye jar wakati wa build. Mistari 23–29 ina:
  - `out-of-order=true`
  - `validate-on-migrate=false`
  - `ignore-missing-migrations=true`
  - `baseline-version=38`
- Log ya boot ya prod ya 22/10 inathibitisha: "outOfOrder mode is active".
- Kwa hiyo migration yenye namba ndogo kuliko iliyoendeshwa mwisho **ingeendeshwa kimya kimya**.
- Mipangilio ya Flyway ya prod haiko kwenye git, kwa hiyo build mbili zinaweza kutofautiana.

**Hatua (kila moja ni faili lake la `analysis\steps\`, staging kwanza):**

1. **Kusoma tu, prod:**
   - `flyway_schema_history` yote: version, installed_rank, success, checksum, type;
   - migration zipi ziliendeshwa nje ya mpangilio (version < max(version) ya wakati huo);
   - zipi zimeshindwa;
   - BASELINE iko wapi.
2. **Kulinganisha na main (PC):**
   - kila faili `V*__*.sql` ya main ≤ toleo la mwisho la prod lazima iwe kwenye history (`success`), na checksum yake ilingane;
   - checksum inahesabiwa kwa njia ya Flyway, kwenye staging.
   - Faili yoyote ambayo haijaendeshwa ingepuuzwa milele baada ya kuzima out-of-order. Kwa hiyo inapewa namba mpya kwanza (kanuni ya juu).
3. **Mipangilio iingie kwenye git:** Flyway ya prod iwekwe kwenye `application-pro.properties`:
   - `spring.flyway.out-of-order=false`
   - `spring.flyway.validate-on-migrate=true`
   - `spring.flyway.ignore-missing-migrations=false` (au `ignore-migration-patterns=*:missing` ikiwa history ina migration za zamani zisizo na faili)
   - `baseline-version` ileile, 38
   - `application.properties` ya PC isiweke tena mipangilio hiyo.
   - `deploy-backend.ps1` inasoma out-of-order kutoka jar (`OutOfOrder`) na inaonya kuhusu migration zitakazorukwa. Iongezewe kinga: **build inakataa** migration yenye namba ≤ toleo la mwisho la prod ambayo haijaendeshwa.
4. **Staging:**
   - DB ya staging inarudishwa kutoka dump ya prod ya siku hiyo;
   - toleo lenye mipangilio mipya linawashwa na hali-root KABLA/BAADA;
   - lazima liwake bila `FlywayValidateException`;
   - checksum ikitofautiana, mmiliki anaamua kati ya `repair` (kuandika checksum mpya) au kurudisha maudhui ya faili. Hakuna `repair` bila uamuzi wake.
5. **Prod:** kwenye toleo linalofuata, baada ya staging kupita. Rollback = image iliyotangulia; mipangilio ya Flyway haibadilishi DB.

## Vilivyowekwa pembeni

- Nakala ya marekebisho ya upeo wa zamani yaliyorudishwa (DataInitializer, UserRepository, test za uaa) iko `analysis\steps\backup-2026-10-26\`. Upeo mpya uko kwenye hotfix.
- Mistari 3 ya `ssh -n` ya `deploy-backend.ps1` ilikuwa `stash@{0}`. Sasa ni commit `d2298fb` kwenye main, imepushwa (26/10).
