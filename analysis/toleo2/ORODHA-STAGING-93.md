# Orodha ya staging — hatua 93 (backend 2.5.0 + V3 3.3.0)

(mmiliki 13/11 gs 4) Chief anaendesha kila amri mwenyewe. Kila amri inaandika `analysis\steps\93-<lengo>-<kitendo>.log`.
Kila hatua inaisha kwa `---93_OK---`; ukiona `---93_IMESHINDWA---` **simama** na unitumie log hiyo.
Mtandao ukikatika: kazi inaendelea kwenye server; endesha amri ileile tena au `93-deploy-250.cmd staging fuata`.

Commit za build: backend `a86fbcf`, V3 `a1caafc` (lango LANGO_OK 13/11 kwenye dump ya prod ya 12/11).

## 0. Build + push + login (PC, mara moja)

| # | Amri | Log | Cha kusoma |
|---|---|---|---|
| 0a | `93-deploy-250.cmd build a86fbcf a1caafc` | `93-pc-build.log` | Mistari 2 ya `imetajwa … = <sha> | HEAD … | tawi main | … = 2.5.0 / 3.3.0 | mabadiliko 0`; `COMMIT ZA BUILD: backend 2.5.0 <sha kamili ya a86fbcf> | v3 3.3.0 <sha kamili ya a1caafc>`; `Docker Hub SAWA` x2; `---93_BUILD_OK---`. Push ya backend ni ~MB 88 (layer ya jar mara moja), V3 ~MB 3; push ikikatika inajaribiwa mara 3. |
| 0b | `push-yote` (main zote mbili) | `push-yote.log` | main ya backend = `a86fbcf`, main ya V3 = HEAD ya sasa (analysis juu ya `a1caafc`). |
| 0c | `93-deploy-250.cmd login` | `93-pc-login.log` | `---76L_OK---` (token ya server ni READ-ONLY). |

## 0d. ARIFA — staging haitumi nje (gt), KUSOMA TU, kabla ya hatua 1

Amri: `93-deploy-250.cmd staging hali`  → `93-staging-hali.log`

- `ARIFA 1/3: APP_SCHEDULERS_ENABLED =false kwenye backend (profile …)`
- `ARIFA 2/3: hakuna funguo za kutuma nje (.env + environment ya backend)`
- `ARIFA 3/3: jar ya 2.4.0 - maktaba 97, hakuna ya mail/SMS/push/HTTP client` (2.5.0 ikishavutwa: `jar ya 2.5.0`)
- **`ARIFA_ZIMEZIMWA: …`** — ukiona `ARIFA … SIYO` au `ARIFA HAZIJAZIMWA` **simama**, nitumie log.
- `cron za mtumiaji zinazotaja lsms-staging: <n> (taarifa)`
- Kusoma tu: container ya muda ya image (`--network none`) inasoma orodha ya maktaba ya jar; staging haiguswi.

## 1. refresh-db — staging inapata DB ya prod ya leo

Amri: `93-deploy-250.cmd staging refresh-db`  → `93-staging-refresh-db.log`

- Sharti: staging iko kwenye 2.4.0. Ikisema `staging lazima iwe 2.4.0 kabla ya refresh` → endesha `staging rollback` kwanza.
- `=== REFRESH-DB staging <- lsms_<LEO>_0200.dump` — tarehe ya dump lazima iwe ya **leo**.
- `restore SAWA: Flyway 138, sales <n>, users <n>` — **Flyway 138** (hali ya prod kabla ya 2.5.0).
- `HEALTH SAWA: backend 2.4.0, frontend-v3 3.2.0`
- `REFRESH-DB SAWA (...s); hali ya 93 ya staging imefutwa (deploy itaanza K1)`

## 2. deploy (ya kwanza) — K1 hadi K6

Amri: `93-deploy-250.cmd staging deploy`  → `93-staging-deploy.log`

| Hatua | Cha kusoma kwenye log |
|---|---|
| **K1 kagua** | `inaendesha: backend 2.4.0, frontend-v3 3.2.0, Flyway 138`; (gy) `payment_method dhidi ya V151: HAIKUBALIKI 0 (payments n, credit_payments n)`; `image za rollback zipo: 2.4.0 + 3.2.0`; `diski wazi <n>G` (≥ 5). |
| **K2 backup** | `DUMP <jina> bytes <n> sha256 …` (> MB 5); kwa staging: `B2: staging - dump inabaki kwenye server tu`. |
| **K3 pull** | `digest: sha256:… / sha256:…` — linganisha mwanzo wa digest na ile ya `93-pc-build.log` (image ileile iliyojengwa). |
| **K4 env/compose** | (gy, script ya sasa) `marejesho APP_FEATURES_SALES_RETURNS_ENABLED =HAIJAWEKWA (default ya jar: false)` (baada ya sehemu 6: `=true`); `onyo la manunuzi LSMS_PURCHASE_CHECK_FROM =HAIJAWEKWA (default ya jar: 2026-12-02)`; **`ARIFA 1/3`, `2/3`, `3/3: jar ya 2.5.0 …` na `ARIFA_ZIMEZIMWA`** — bila hiyo K4 inasimama (`ARIFA HAZIJAZIMWA`) KABLA ya kubadili chochote. |
| **K5 badili** | `backend: 'Started LsmsApplication' baada ya ~<n>s`; `http SAWA: POST /api/auth/login {}=400, /v3/=200, /api/v1/sales (bila tokeni) 401/403`; `HEALTH SAWA: backend 2.5.0, frontend-v3 3.3.0`; **`Flyway: 139:true 140:true … 151:true (max 151)`** — zote 13 ziwe `true`. |
| **K6 smoke (server)** | `jedwali 7 mapya + akaunti 1160/2310/2910/6130 + check ya V151 SAWA`; **`D: HAIJAWEKWA (inawekwa na hatua 60 tarehe 07/12)`** — ukiona `ONYO: D IMEWEKWA tayari` simama; `ERROR baada ya kuanza (maombi ya moja kwa moja): 0`; **`ARIFA_ZIMEZIMWA (container inayoendesha: APP_SCHEDULERS_ENABLED =false)`**. |

Mwisho: `---93_OK---`. Ikishindwa ndani ya K5, script inafanya ROLLBACK yenyewe na kusema hivyo.

Kwa macho (dakika 2): fungua staging `/v3/` → footer ya login inaonyesha **3.3.0**; `/v3/version.json` = `"version": "3.3.0"`.

## 3. kazi — kuandika kwa kweli kwenye staging (2.5.0)

Amri: `93-deploy-250.cmd staging kazi` (inauliza email + password ya CEO)  → `93-staging-kazi.log`

Mistari ya `PASS` inayotarajiwa (hakuna `FAIL` hata moja):
- `login (2.5.0)`
- `sale cash imeandikwa`, `stock n -> n-1`, `GL journal ya sale ipo, inagusa 1000`
- `sale imefutwa (API)`, `sales.is_active=false`, `stock imerudi`, `GL reversal ya sale ipo`, `sale_change_audit DELETE/ALLOWED`
- `ununuzi umeandikwa`, `ununuzi APPROVED`, `GL ya ununuzi (…1200:100…)`
- `malipo ya msambazaji yameandikwa`, `GL ya malipo (…2000:100…)`, `malipo yamefutwa (reversal)`
- `sale-B ya reco imeandikwa`, `reco ya leo ipo`, `reco expense imeongezwa`, `reco expense imefutwa`, `sale-B imefutwa baada ya reco`
- Mwisho: `KAZI_MATOKEO (2.5.0) PASS n FAIL 0`, `KAZI_OK n/n`, `---93_OK--- kazi`

## 4. rollback — 2.4.0 juu ya schema 151

Amri: `93-deploy-250.cmd staging rollback`  → `93-staging-rollback.log`

- `=== ROLLBACK kwenda 2.4.0 + 3.2.0`; `.env + compose zimerudishwa kutoka <backup>`
- `HEALTH SAWA: backend 2.4.0, frontend-v3 3.2.0`
- **`Flyway ya mwisho: 151 (DB HAIJARUDISHWA …)`** — schema inabaki 151, 2.4.0 inawaka juu yake.
- Kisha uthibitisho wa kuandika kwenye 2.4.0: `93-deploy-250.cmd staging kazi` → `login (2.4.0)`, `KAZI_OK n/n`.
  (Lango la PC lilithibitisha hili: rollback kwa kuandika 5/0.)

## 5. deploy (ya pili) — kurudi 2.5.0

Amri: `93-deploy-250.cmd staging deploy`  → `93-staging-deploy.log` (inaongezwa chini)

- K1: `inaendesha: backend 2.4.0, frontend-v3 3.2.0, Flyway 151` — sasa **151** inakubaliwa (baada ya rollback).
- `K2-BACKUP ilishakamilika - inarukwa` (backup ya awali ndiyo ya "kabla"); K3 pull tena.
- K5: `HEALTH SAWA: backend 2.5.0, frontend-v3 3.3.0`; `Flyway: 139:true … 151:true (max 151)` — hakuna migration mpya inayoendeshwa.
- K6: mistari ileile ya hatua 2, pamoja na `D: HAIJAWEKWA`.
- Kisha: `93-deploy-250.cmd staging smoke` → `SMOKE_OK n/n` (GET 6 + `sales/changes/pending` + `login_audit`), `---93_OK--- smoke`.
- Mwisho: `93-deploy-250.cmd staging hali` → `backend 2.5.0 | frontend-v3 3.3.0`, `Flyway ya mwisho: 151`.

## 6. Marejesho ON + onyo la manunuzi kuanzia leo, kwenye staging (gy 1, hc 1)

1. `93-deploy-250.cmd staging marejesho [YYYY-MM-DD]` (bila hoja = leo; hd: leo hadi leo+2) → `93-staging-marejesho.log`
   - KAGUA (kusoma tu), mstari kwa kila swichi: `KAGUA: APP_FEATURES_SALES_RETURNS_ENABLED | .env =HAIPO | compose (backend) =HAIJAWEKWA | … | lengo =true`
     na `KAGUA: LSMS_PURCHASE_CHECK_FROM | … | lengo =<tarehe ya leo>`; `MAREJESHO_KAGUA_OK: ANDIKA itaweka … =true … =<leo>`
   - **STOP:** andika `ANDIKA` (herufi kubwa) kuendelea; kingine chochote = hakuna kinachoandikwa.
   - ANDIKA: `backup: …/marejesho-<saa>`, `ANDIKA SAWA: compose (backend) APP_FEATURES_SALES_RETURNS_ENABLED =true, LSMS_PURCHASE_CHECK_FROM =<leo>; mistari … (funguo hizi tu)`,
     `MAREJESHO_IMEANDIKWA`, `---93_OK--- marejesho`. Ikishindwa: `.env + compose zimerudishwa`.
2. `93-deploy-250.cmd staging deploy` → K4 **`marejesho APP_FEATURES_SALES_RETURNS_ENABLED =true`** na
   **`onyo la manunuzi LSMS_PURCHASE_CHECK_FROM =<leo>`**; K5
   `K5-BADILI ilishakamilika - .env/compose zimebadilika: backend imeundwa upya` + `HEALTH SAWA`; K6
   **`marejesho kwenye container inayoendesha: APP_FEATURES_SALES_RETURNS_ENABLED =true`**,
   **`onyo la manunuzi kwenye container inayoendesha: LSMS_PURCHASE_CHECK_FROM =<leo>`**, `ARIFA_ZIMEZIMWA`.
   Onyo la 6e: ukurasa wa Manunuzi / reco unaanza kulinganisha reco za kuanzia leo tu.
3. Jaribio la API (he): `93-deploy-250.cmd staging marejesho-jaribio` (email + password ya CEO) → `93-staging-marejesho-jaribio.log`:
   `MAREJESHO_OK 20/20`, `---93_OK--- marejesho-jaribio`. Sale za jaribio zenye marejesho HAZIFUTWI (kasoro ya he) - `BAKI: …`.
   Linaweza kurudiwa (linatumia tena siku X yake).
4. Jaribio la UI (C4) kwa macho — staging kwenye browser: `analysis\steps\tunnel.cmd` (ssh -L, dirisha libaki wazi), kisha
   **http://localhost:8081/v3/** (au port ya `LSMS_TUNNEL_PORT`). V3 inaita API kwa njia ya ndani (apiBaseUrl tupu), kwa hiyo
   kila kitu kinakwenda staging, si prod. Mfano wa MWONGOZO-MACHEDA sehemu 1b:
   - sale ya Taslimu ya siku iliyopita (reco yake IMEIDHINISHWA) → Rudisha bidhaa → kipande 1 → Omba kurudisha → PENDING;
   - CEO → Marejesho — idhinisha / kataa → Idhinisha, Taslimu;
   - angalia: stock +1; reco ya **leo** ina marejesho = bei ya kipande; reco ya **siku ya mauzo** haijabadilika (jumla ileile);
     GL ya marejesho: Dr 4020 / Cr 1000 na Dr 1200 / Cr 5000; mtumiaji asiye na ruhusa ya marejesho haoni vitufe.

## 7. Prod (14 au 15/11) — mpangilio

1. `93-deploy-250.cmd prod marejesho [YYYY-MM-DD]` (KAGUA → STOP `ANDIKA` → ANDIKA) — 2.4.0 inaendelea, haiguswi.
   Tarehe ni siku ya kwanza ya onyo la manunuzi (hd):
   - **deploy usiku → tarehe ya kesho** (mf. `93-deploy-250.cmd prod marejesho 2026-11-15`): reco ya leo ni ya 2.4.0, bila "Droo";
   - **deploy alfajiri → leo** (bila hoja, au tarehe ya leo).
   - Tarehe ya nyuma (< leo) au zaidi ya siku 2 mbele inakataliwa kabla ya kugusa chochote (`SIYO: tarehe … ni ya nyuma`).
   - KAGUA inaonyesha `KAGUA: LSMS_PURCHASE_CHECK_FROM | … | lengo =<tarehe>` — hakikisha ni tarehe uliyokusudia kabla ya `ANDIKA`.
   - Ukiiendesha tena, **toa tarehe ileile**: bila hoja lengo ni leo na ANDIKA ingeisogeza.
2. `93-deploy-250.cmd prod deploy`:
   - K1 **`payment_method dhidi ya V151: HAIKUBALIKI 0 (payments n, credit_payments n)`** — vinginevyo inasimama kabla ya kubadili;
   - K4 **`marejesho … =true`** na **`onyo la manunuzi … =<tarehe ya deploy>`** (prod bila hizo inasimama: "endesha kwanza 93 prod marejesho");
   - K5 Flyway 139–151 true; K6 marejesho `=true` na onyo la manunuzi `=<tarehe>` kwenye container, `D: HAIJAWEKWA`.
3. `93-deploy-250.cmd prod smoke` → `SMOKE_OK`.

## Staging imepita =

1. refresh-db: Flyway 138, dump ya leo.
2. deploy 1: K1–K6 zote, Flyway 139–151 `true`, D HAIJAWEKWA, ERROR 0.
3. kazi kwenye 2.5.0: `KAZI_OK`, FAIL 0.
4. rollback: HEALTH 2.4.0/3.2.0, Flyway 151; kazi kwenye 2.4.0 `KAZI_OK`.
5. deploy 2: K1–K6, smoke `SMOKE_OK`, hali 2.5.0 / 3.3.0 / 151.

Baada ya hapo: **main IMEFUNGWA hadi prod (14 au 15/11)** (code ya app). Badiliko lolote = lango + staging upya. Hotfix = `hotfix/*` kutoka
tag `v2.4.0` / `v3.2.0`. Prod: sehemu 7 (`prod marejesho` → `prod deploy` → `prod smoke`); kisha tag `v2.5.0` / `v3.3.0` kwenye SHA za
`93-build-commits.txt`.
