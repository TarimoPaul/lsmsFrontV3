# RIPOTI (ch) — 03/11/2026

nimesoma hadi (ch). Herufi tangu ripoti iliyopita (cg): **(ch)** tu.

## 1. C1 = 0 dhidi ya prod (IMEREKEBISHWA)

**Chanzo cha "prod":** jar ya image `chiefmaster/my-lsms-backend:2.3.0`, digest `sha256:8de8a556…fcbbe` — ileile inayoendesha prod
(69, 29/10). Faili zake 2: `application.properties` na `application-pro.properties`. Prod inaendesha `SPRING_PROFILES_ACTIVE=prod`
→ group `pro`, kwa hiyo **pro inafunika base**. Ulinganisho unafanywa kwa thamani zinazotumika (pro juu ya base), kwa kusoma
kama `java.util.Properties`. Zana: `analysis\zana\usanidi-prod-diff.py`. Siri zinaonyeshwa kama hash fupi tu (`<siri h=…>`).

**Kosa la C1 ya (cg), baf4e31:** haikuwa 0. Tofauti 3:
- `git` (kutoka mstari `git spring.jpa.show-sql=false` wa pro) — imeondolewa;
- `git211` — imeondolewa;
- `spring.config.import=optional:file:./application-local.properties` — mpya (chanzo kipya cha config).

**Marekebisho (feature/c1-usanidi cd7a52a → release/2.4.0 = 376a31d):**
- Mistari 2 ya takataka imerudishwa kama ilivyo kwenye jar ya prod (pamoja na maelezo). Kuiondoa → BAADA §6.
- `spring.config.import` imeondolewa. Siri za dev sasa ziko `<repo>\config\application.properties` (gitignored). Hiyo ni
  location ya kawaida ya Spring Boot ambayo jar ya 2.3.0 tayari inaisoma; kwenye prod `/app/config/` haipo (nimeangalia image).
  Kwa hiyo hakuna chanzo kipya cha config.
- `.gitattributes`: `*.properties text eol=lf`. Faili 3 za properties tayari ni LF kwenye index, kwa hiyo hakuna renormalize.

**Diff ya C1 (kabla = base ya jar ya prod + pro ya 0d8463c; baada = 376a31d), thamani zinazotumika:**

| | funguo | zilizobadilika | mpya | zilizoondolewa |
|---|---:|---:|---:|---:|
| C1 peke yake | 98 | **0** | **0** | **0** |

**Diff ya faili kwa faili** (base peke yake, bila pro). Funguo 3 zinatofautiana. Zote 3 zinafunikwa na pro kwenye prod, na thamani za
pro ni sawa kabisa na za jar ya prod, kwa hiyo hazibadilishi kitu prod:

| key | jar ya prod (base) | C1 (base) | inayotumika prod (pro, haijabadilika) |
|---|---|---|---|
| `jwt.secret` | `${JWT_SECRET:<siri h=586e12e1>}` | `${JWT_SECRET}` | `${JWT_SECRET}` |
| `spring.datasource.password` | `${DB_PASSWORD:<siri h=03ac6742>}` | `${DB_PASSWORD}` | `${DB_PASSWORD}` |
| `spring.datasource.url` | `jdbc:postgresql://localhost:5432/lsms_test_reco` | `${DB_URL:jdbc:postgresql://localhost:5432/lsms_test_reco}` | `${DB_URL:jdbc:postgresql://postgres:5432/Lsms}` |

**Upande wa env (.env ya prod):** sikuisoma (ssh ya Contabo si yangu). Haihitajiki kwa diff hii, kwa sababu C1 haiongezi wala haiondoi jina
lolote la env linalosomwa na prod. Majina ni yaleyale ya pro ya 2.3.0: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`,
`JWT_EXPIRATION`, `SERVER_PORT`, `ROOT_PASSWORD`.

**Isipokuwa moja:** `${ROOT_PASSWORD:-}` kwenye compose. Iko kwenye server tu (haiko git), kwa hiyo inaingia kwenye skripti ya
staging/prod ya kifurushi.

**Nje ya C1 (kwa ukamilifu):** kifurushi kizima dhidi ya jar ya prod kina funguo 6 mpya, zote `logging.file.*` /
`logging.logback.rollingpolicy.*` za A1 (logs `/app/logs`, siku 30, 1GB). Hizo zilikubaliwa kwenye A1; si sehemu ya C1.

**Majaribio:**
- `ConfigHygieneTest` 3/0. Sasa inakataa chanzo kipya chochote (`spring.config.import/location/additional-location` = null) na
  `config/application.properties` kwenye classpath.
- Udhibiti: test ileile dhidi ya `application.properties` ya baf4e31 → **FAIL 1** (`expected: null`). Faili mpya → 3/0.
- Suite nzima **568/0/1** (faili 150 mpya za surefire; 5 za zamani za gated checks hazihesabiwi).
- **Hazijarudiwa:** PG gate, image na E2E. Mabadiliko ni maandishi ya properties tu, na thamani zinazotumika ni 98/98 sawa. Zilipita
  kwenye baf4e31 (PG 5/5, E2E 9/9). Lango kamili litarudiwa kwenye build ya kifurushi kabla ya staging.

**Hatua ya release (yako, kabla ya merge kwenye main) — IMEBADILIKA tangu (cg):** worktree `Lsms` ina `src\main\resources\application.properties`
isiyofuatiliwa yenye siri za dev. Hamisha thamani 2 za siri (password ya DB, jwt.secret) kwenda **`Lsms\config\application.properties`**
(siyo `application-local.properties`), futa faili la zamani, kisha merge. Nitaiandaa kama hatua ya faili ukitaka.

## 2. Kuzima outOfOrder → BAADA-YA-BATCH §5

Kipimo ni `flyway_schema_history` ya **dump ya prod 29/10** (`lsms_20261029_1027.dump`; 0200 inatoa yaleyale), siyo nakala mpya.
Zana: `analysis\zana\flyway-historia.py`. Inahesabu checksum kwa njia ya Flyway; 100/101 zinalingana, kwa hiyo hesabu ni sahihi.

| kipimo | thamani |
|---|---|
| safu / zilizoshindwa | 102 / 0 (version ya juu 134; dump ni ya kabla ya 2.3.0) |
| nje ya mpangilio | 5: V038.1–V038.5, 15/06 16:24 (za kihistoria) |
| zilizotumika bila faili kwenye code | 0 |
| chini ya baseline 38 (zinapuuzwa) | 36 (V001–V038) |
| zinazosubiri | V135–V138, zote > 134 |
| **checksum/description zisizolingana** | **1: V039** |

**Jipya — V039:**
- Prod ina V039 = "Create Repurchase Invoices Tables" (24/05, checksum 484951461). Faili hilo baadaye lilipewa namba **V056**
  (checksum ileile; V056 iliendeshwa tena 15/06).
- V039 ya code ni "Add Shrinkage Financial Fields To Store".
- Kwa `validate-on-migrate=true` backend **isingewaka**.
- Safu 2 na index 3 za V039 ya code **zipo** kwenye schema ya prod (dump 29/10), kwa hiyo hakuna DDL inayokosekana.
- Uamuzi wako unahitajika **wakati wa BAADA** (siyo sasa): `flyway repair` au njia nyingine. Hakuna repair bila uamuzi wako.

**Sahihisho la (cg) §4:**
- Namba za (cg) ("rekodi 106, Flyway 138, 5 tu nje ya mpangilio") zilitoka nakala ya Docker-local, siyo dump ya prod.
- (cg) haikukagua checksum, kwa hiyo haikuona V039.
- Hatua ya 2 ya mpango wa (cg) (staging na validate=true) ingeshindwa kwenye V039.

MATAWI.md sasa inaelekeza kwenye BAADA §5.

## 3. Makadirio ya C2 + C4 — yalikuwa kwenye RIPOTI-CG §3 (commit 1773399); hapa tena, yamesasishwa 03/11

- **C2: siku 2.5–3.5.**
  - Code ina mifumo 147 ya `:x IS NULL` kwenye faili 21, na mbinu 163 zinazorudisha `Object[]` (grep pana).
  - Kazi: harness ya beans halisi kwenye PG15 yenye data (siku 1), marekebisho (siku 1–2), PG check kwenye gate (nusu siku).
- **C4: siku 3–4.**
  - feature/sales-returns iko juu ya 2.2.71, na faili 6 zinagongana: SaleService, ReconciliationService, PostingEngine,
    SalesController, SalesDto, SaleServiceDeletionTest.
  - Kazi: kuhamisha (siku 1), namba mpya ya migration, flag OFF (nusu siku), majaribio upya (siku 1.5–2).

| kilichobaki (03/11 → 16/11, siku 13) | siku |
|---|---:|
| C2 | 3 |
| C3 | 1.25 |
| C5/C8 (orodha kwanza) | 2 |
| C4 | 3.5 |
| C6 | 0.5 |
| C7 | 1 |
| C9 | 0.1 |
| skripti ya staging + prod + staging | 2 |
| **jumla** | **≈ 13.4** (bila C4 ≈ 9.9) |

**Pendekezo ni lilelile: C4 itoke kwenye batch.** Ikiwa ndani, kifurushi ni > siku 12 na > siku zilizobaki. Pia ingekuwa
nyuma ya flag OFF, na ina hatari ya migongano kwenye GL na reco.

## 4. Inasubiri uamuzi wako
1. C4 itoke kwenye batch?
2. Kanuni ya pili ya onyo la manunuzi (gharama dhidi ya bei ya kuuza), (cg) §2?
3. Hatua ya faili ya release ya C1 (siri za dev → `config\application.properties`)?
4. (BAADA, si sasa) V039: repair au njia nyingine.

Kinachofuata nikiruhusiwa: **C2** (harness kwanza).

## origin dhidi ya local

| repo | tawi | local | origin | hali |
|---|---|---|---|---|
| Backend | release/2.4.0 | 376a31d | 0d1ee71 | TOFAUTI, FF, commit 14 mpya |
| Backend | main | c98fa07 | c98fa07 | SAWA |
| V3 | release/3.2.0 | 28afa80 | c540ab8 | TOFAUTI, FF, commit 11 mpya |
| V3 | main (kabla ya commit ya ripoti hii) | b4fa152 | 998dad6 | TOFAUTI, FF, commit 18 mpya |

push-yote bado haijafika origin: matawi yote ni FF.
