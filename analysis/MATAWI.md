# Matawi ya backend (Lsms) na kanuni za migration (26/10/2026)

| Branch | Maana | Mahali |
|---|---|---|
| `main` | **= prod.** Prod inaendesha 2.2.71. main = `d2298fb` (ssh -n), imepushwa. | `D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms` |
| `hotfix/2.2.72` | **Hotfix**: root boot, hakuna password ya default, kinga ya mwezi uliofungwa, `Assert-ReleaseBranch`. HEAD = `d2298fb`; kazi bado haijacommitiwa. | worktree `...\Lsms\Lsms-hotfix-2272` |
| `feature/sales-returns` | **WIP**: returns + exchange, migration ya muda `V135`. Haijajaribiwa staging, **si ya prod**. Commit `9425223`, haijapushwa. | backend (branch tu) |
| `feature/sales-returns` (V3) | **WIP**: UI ya returns (faili 12). Commit `e199712`, haijapushwa. | lsmsFrontV3 |
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
