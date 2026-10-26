# Toleo 2.3.x — LOGIN AUDIT (muundo tu, 26/10/2026)

Muundo tu. Hakuna code. Kazi inaanza **baada ya 2.3.0 (mikopo)** kufika prod. Agizo la mmiliki ni 26/10 (h) B.

## 0. Hali ya sasa (imethibitishwa kwenye code ya hotfix/2.2.72, 26/10)

| # | Ukweli | Mahali |
|---|---|---|
| H1 | Login iliyofanikiwa haiandiki chochote: hakuna safu, `last_login_at` na log | `AuthController.java:101-190`, `User.java:319` (D1) |
| H2 | `login()` ni `@Transactional(readOnly = true)`. Hata `updateLastLogin()` ikiitwa ndani yake, haitahifadhiwa | `AuthController.java:102` |
| H3 | IP inayoandikwa ni `request.getRemoteAddr()`. Hiyo ni IP ya nginx/docker (172.18.x), si ya mtumiaji. Hakuna `server.forward-headers-strategy` | `AuthController.java:109,197` |
| H4 | Njia 4 za matokeo: 429 (imezuiwa, `LoginAttemptService` ya Caffeine, majaribio 5), 401 (password/email), 403 (`canLogin()` = false: INACTIVE/LOCKED), 200 | `AuthController.java:107-135,194` |
| H5 | Backend haina `logging.file.*`, kwa hiyo log ziko kwenye stdout ya container tu. Ndiyo maana log za 21/10 15:13 → 22/10 19:07 zilipotea container ilipotengenezwa upya | `application*.properties` |
| H6 | Zana za 56/56b zilipata IP halisi kutoka XFF ya nginx. 51.158.200/202.x ni Jess (Opera VPN, mtandao wa Scaleway AS12876). Hiyo ndiyo aina ya alama mfumo unapaswa kuonyesha wenyewe | log ya 56b, 26/10 (h) |

## 1. Jedwali `login_audit` (migration: namba ya muda, baada ya ya mikopo; MATAWI.md)

| Safu | Aina | Maelezo |
|---|---|---|
| id | bigserial PK | |
| at | timestamptz NOT NULL default now() | |
| event | varchar(20) | `LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGOUT` / `PASSWORD_CHANGE` (S-3; `SELECT_BRANCH` HAPANA) |
| email_attempted | varchar(255) | Kama ilivyoandikwa, trim + lowercase. Inaandikwa hata kama user hayupo |
| user_uid | varchar(64) NULL | Inajazwa user akipatikana, hata login ikishindwa |
| is_root | boolean | Thamani ya `users.is_root` wakati huo |
| result | varchar(20) | `SUCCESS` / `FAILED` / `BLOCKED` / `DENIED` / `ERROR` |
| failure_reason | varchar(40) NULL | `BAD_PASSWORD`, `NO_SUCH_USER`, `RATE_LIMITED`, `STATUS_INACTIVE`, `STATUS_LOCKED`, `STATUS_<X>`, `EXCEPTION` |
| ip | inet | IP halisi (§2) |
| ip_chain | varchar(500) | XFF yote + remote_addr, kwa ushahidi |
| user_agent | text | Kamili, hadi herufi 1000 |
| browser, browser_version, os, device_type | varchar | Zinatolewa kwenye UA kwa regex yetu ya ndani (S-4); UA kamili inabaki kwenye `user_agent` |
| country | varchar(64) NULL | GeoIP ya ndani (§3); hakuna `city` (S-2) |
| asn | integer NULL, asn_org varchar(200) | |
| network_flag | varchar(20) | `NORMAL` / `DATACENTER` / `VPN` / `PRIVATE` / `UNKNOWN` |
| device_id_hash | char(64) NULL | sha256 ya device id ya V3 (§4) |
| new_device | boolean | Kifaa hiki hakijawahi kuonekana kwa user huyu (SUCCESS tu) |
| alert | varchar(100) NULL | Mf. `ROOT_LOGIN,NEW_DEVICE,VPN` |

- Indexes: `(at)`, `(user_uid, at)`, `(email_attempted, at)`, `(network_flag, at)` WHERE network_flag <> 'NORMAL'.
- **Password haiandikwi popote**: si kwenye jedwali, si kwenye log. Jaribio linathibitisha hilo (§8 j).
- Geo/ASN zinahifadhiwa wakati wa kuandika safu, si kusomwa baadaye. Hivyo historia haibadiliki faili la GeoIP likisasishwa.

## 2. IP halisi

- Ombi linapita Cloudflare → nginx (frontend-v3) → backend. Kanuni: amini header **tu** kama `remote_addr` ni proxy inayojulikana (mtandao wa docker wa compose, mf. 172.18.0.0/16, ndani ya config `audit.trusted-proxies`).
- Mpangilio wa kusoma: `CF-Connecting-IP`, kisha hop ya kwanza ya `X-Forwarded-For`, kisha `remote_addr`.
- Ombi lisilotoka kwa proxy inayoaminika linaandikwa na `remote_addr` yake na `network_flag = PRIVATE/UNKNOWN`. Hivyo IP haiwezi kughushiwa kwa header.
- **Lazima kabla ya code:** hatua ya read-only inayosoma config ya nginx ya prod (headers zinazopitishwa) na kuthibitisha kuwa `CF-Connecting-IP`/XFF zinafika backend (S-1).
- Kazi hiyo hiyo inarekebisha log za usalama za sasa (H3) ziandike IP halisi.

## 3. GeoIP ya ndani (hakuna API ya nje)

- Faili za `.mmdb` za **country + ASN tu** (S-2) zinasomwa kwa maktaba ya `com.maxmind.geoip2`. Chanzo ni **DB-IP Lite** (CC BY 4.0, haihitaji key). Leseni inataka chanzo kitajwe: ukurasa wa `/security/logins` unaonyesha "IP geolocation by DB-IP (https://db-ip.com)".
- Faili linakaa kwenye volume `./geoip`, nje ya image. Linasasishwa kila mwezi kwa hatua ya server (si ndani ya backend: backend haiendi mtandaoni).
- Ukubwa: country+ASN ≈ 10–15 MB. Faili linasomwa kwa memory-map.
- Faili likikosekana: login inaendelea, `country/asn = NULL` na `network_flag = UNKNOWN`, pamoja na WARN moja kwa siku. Audit haizuii login kamwe.
- **DATACENTER/VPN:** orodha ya ASN za hosting ndani ya config `audit.hosting-asns`. Mwanzo wake: Scaleway 12876, OVH 16276, Hetzner 24940, Contabo 51167, AWS 16509/14618, Google Cloud 396982, Microsoft 8075, DigitalOcean 14061, Linode/Akamai 63949, M247 9009, Datacamp 60068. Cloudflare WARP (13335) → `VPN`.
  - Orodha si kamilifu. Alama ni "angalia", si uamuzi.

## 4. Kifaa kipya

- V3 inatengeneza `deviceId` (UUID) mara moja na kuuweka kwenye localStorage (`lsms.device`). Unatumwa kwenye body ya login. Backend inahifadhi sha256 yake tu.
- `new_device = true` pale ambapo hakuna safu ya SUCCESS ya user huyo yenye `device_id_hash` hiyo ndani ya siku 180.
- Kama hakuna deviceId (Flutter ya zamani, curl): alama mbadala ni (browser, os, device_type) mpya + nchi mpya.
- Login ya kwanza kabisa ya user haipigiwi tahadhari, ila inaonyeshwa.

## 5. Kuandika (backend)

- `LoginAuditService.record(...)` ni `@Async` + `REQUIRES_NEW`, na haitupi exception kamwe. Kosa likitokea, linaandikwa kama WARN na login inaendelea.
  - Inaitwa kwenye njia zote 4 za H4 na kwenye `catch` ya jumla.
  - Kwa sababu ya H2, haiandiki ndani ya transaction ya `login()`.
- **D1:** baada ya `canLogin()`, `UPDATE users SET last_login_at = now() WHERE uid = ?` (`@Modifying`, REQUIRES_NEW). **Haigusi `updated_at`**: hali-root inalinganisha `updated_at` (ORODHA-D D1).
- Mstari mmoja wa INFO kwa kila login: `LOGIN result email ip flag`. Bila password.
- Msimbo wa jibu kwa mteja haubadiliki. `NO_SUCH_USER` na `BAD_PASSWORD` zote zinabaki 401 "Invalid email or password", ili kusiwe na user enumeration.

## 6. Ripoti na tahadhari (V3)

- Ukurasa **Usalama → Login** (`/security/logins`) unaonekana kwa **CEO na root tu**, kupitia ruhusa mpya `LOGIN_AUDIT_VIEW` (inapewa role ya CEO tu, root inaipata kwa is_root).
  - Backend inakagua ruhusa; kuficha kwenye menu peke yake hakutoshi.
- Vichujio: user/email, tarehe (kutoka–hadi), matokeo, `network_flag` (VPN/DATACENTER), kifaa kipya, root tu.
- Jedwali linaonyesha saa (EAT), user, matokeo/sababu, IP, nchi, ASN, alama, kifaa (browser/OS).
- Ukurasa unasoma tu; hakuna kufuta wala kuhariri.
- **Export CSV (S-5):** kwa CEO na root tu (ruhusa mpya `LOGIN_AUDIT_EXPORT`, si `LOGIN_AUDIT_VIEW`). Kila export inaandikwa kwenye audit: nani, saa, vichujio, idadi ya safu. Mahali pa kuandika (`AuditTrail` iliyopo au jedwali dogo) panaamuliwa wakati wa code, na jaribio linathibitisha kuwa export bila safu ya audit haiwezekani.
- **Tahadhari** zinawashwa na: login yoyote ya **root**, kifaa kipya, au VPN/DATACENTER. Pia FAILED ≥ 5 kwa email moja ndani ya dakika 15.
  - Zinaonekana kama kadi kwenye dashboard ya CEO/root ("Login 3 zinahitaji kuangaliwa"), pamoja na alama ya "nimeona" (§6.1).
  - **S-6:** dashboard kwa tahadhari zote. Email kwa `ROOT_LOGIN` tu, **ikiwa mfumo una SMTP**. Imethibitishwa 26/10 kwenye hotfix/2.2.72: backend haina SMTP (hakuna `spring.mail`, `JavaMailSender` wala starter ya mail). Kwa hiyo email **haijengwi**; SMTP mpya haijengwi.

### 6.1 "Nimeona" na "VPN inayojulikana" (S-7, UAMUZI wa mmiliki 26/10 (i))

- `login_audit_ack` ina: id, login_audit_id, kind (`SEEN` / `KNOWN_NETWORK`), by_uid, at, note (lazima kwa KNOWN_NETWORK, herufi ≥ 10).
  - Kwa KNOWN_NETWORK pia: user_uid na asn (na prefix ya IP kwa hiari, mf. 51.158.200.0/24).
- **SEEN** inazima tahadhari ya safu hiyo moja tu.
- **KNOWN_NETWORK** ("VPN inayojulikana kwa user huyu"): CEO/root wanaibonyeza kwenye safu yenye alama VPN/DATACENTER, mf. Jess kwenye AS12876.
  - Kuanzia hapo, login ya **user huyo** kutoka **ASN hiyo** bado inaandikwa na `network_flag = VPN/DATACENTER`. Alama inabaki kwenye rekodi.
  - Safu inapata `alert` yenye `KNOWN_VPN`, ambayo **haiwashi tahadhari**. Haitajirudia kila siku.
  - Inahusu user huyo tu. User mwingine kutoka ASN hiyo hiyo bado anapigiwa tahadhari.
- Tahadhari nyingine haziathiriwi: ROOT_LOGIN na NEW_DEVICE zinapigwa hata kutoka mtandao unaojulikana.
- Kuondoa: ack mpya `kind = KNOWN_NETWORK_REVOKED`. Hakuna kufuta wala kuhariri ack, ili historia ya nani aliruhusu nini ibaki.
- Ukurasa wa audit unaonyesha orodha ya "mitandao inayojulikana" (user, ASN/org, nani, lini, sababu).
- Retention: ack ya KNOWN_NETWORK iliyo hai **haifutwi**, hata safu yake ya login_audit ikipita siku 180. Inasimama yenyewe kwa sababu ina user_uid/asn zake. Ack za SEEN zinafuta pamoja na safu zao.

## 7. Muda wa kuhifadhi (UAMUZI wa mmiliki 26/10)

| Data | Muda | Njia |
|---|---|---|
| `login_audit` (+ ack za SEEN) | siku 180 | Kazi ya kufuta ndani ya backend |
| ack za KNOWN_NETWORK zilizo hai | hadi zinapoondolewa | — |
| Log za nginx na backend | siku 30 server + siku 90 B2 (gzip) | logrotate/logback + rclone (§7.2) |
| GL, `gl_period_audit`, `reconciliation_audit_log`, `audit_trails`, mabadiliko ya roles/users | **HAZIFUTWI** | — |

### 7.1 Kazi ya kufuta (`AuditRetentionJob`)

- Inaendeshwa kila siku saa 03:30 EAT. Inafuta `login_audit` yenye `at < now() - 180 days` kwa vipande vya 5,000.
- Jina la jedwali limeandikwa ndani ya code (allowlist ya `login_audit` na `login_audit_ack` tu). Hakuna jina la jedwali linalotoka kwenye config au ombi.
- Ina log yake, jedwali `retention_run_log` (id, at, table_name, cutoff, rows_deleted, duration_ms, ok, error), pamoja na mstari wa INFO.
- Jaribio linathibitisha kuwa haiwezi kugusa jedwali la fedha: allowlist ni `Set.of(...)` ya kudumu, na jaribio linajaribu kuipa jina jingine na kuona inakataa.

### 7.2 Log nje ya container

- Backend: `logging.file.name=/app/logs/lsms-backend.log` + logback `SizeAndTimeBasedRollingPolicy`. Faili moja kwa siku, `.gz`, `maxHistory=30`, `totalSizeCap=1GB`.
  - Volume ya compose `./logs/backend:/app/logs`. Restart, recreate au deploy havifuti tena log (H5).
- docker `logging: json-file, max-size 20m, max-file 3`, ili stdout isijaze disk.
- nginx: `access_log` + `error_log` kwenye `./logs/nginx`, logrotate ya kila siku, `rotate 30`, `compress`. Format ya log iwe na `$http_cf_connecting_ip` na `$http_x_forwarded_for`.
- B2: hatua ya kila usiku (cron ya server, si backend) inapakia `.gz` za jana kwenye `b2:lsms-logs/<host>/<yyyy>/<mm>/` kwa rclone. Lifecycle rule ya bucket inafuta baada ya siku 90.
  - Kupakia kukishindwa, faili linabaki server, na kesho inajaribu tena.
- **Hatua za server (prod/staging) ni step files tofauti** zinazoendeshwa na mmiliki (`analysis\steps\NN-*.cmd`). Kwanza staging, kisha prod. hali-root inazunguka kila restart.

## 8. Majaribio (yataandikwa na code)

a. Njia zote 4 za H4 + exception → safu 1 kila moja, `result/failure_reason` sahihi.
b. 200 → `last_login_at` imewekwa, `updated_at` haijabadilika; 401 → `users` haibadiliki.
c. IP: XFF/CF kutoka proxy inayoaminika inatumika; header kutoka IP isiyoaminika inapuuzwa.
d. 51.158.200.x → ASN 12876 → `DATACENTER` (au `VPN`); 41.59.106.20 → `NORMAL`. Hutumia faili la majaribio la `.mmdb`.
e. Faili la GeoIP likikosekana → login 200, flag `UNKNOWN`.
f. Kifaa kipya: deviceId mpya → `new_device` + alama; deviceId ileile mara ya pili → hapana.
g. Root login → alama `ROOT_LOGIN` hata ikiwa kifaa ni kilekile.
h. `LOGIN_AUDIT_VIEW`: CEO 200, mtumiaji mwingine 403, root 200.
i. Retention: safu ya siku 181 inafutwa, ya siku 179 inabaki; `retention_run_log` ina safu; jina lisilo kwenye allowlist linakataliwa; GL/`audit_trails` hazibadiliki.
j. Hakuna password: tafuta password ya majaribio kwenye safu zote za `login_audit` na kwenye log iliyokamatwa → haipo.
k. Kosa la audit (DB ya audit ikishindwa) halizuii login.
l. Staging: restart → log ya backend ya kabla ya restart bado ipo kwenye `./logs/backend`.
m. KNOWN_NETWORK: login ya Jess kutoka AS12876 → `network_flag = DATACENTER/VPN`, alert `KNOWN_VPN`, hakuna tahadhari. User mwingine kutoka AS12876 → tahadhari. Root kutoka mtandao unaojulikana → bado ROOT_LOGIN. Baada ya REVOKED → tahadhari inarudi. Retention haifuti ack hai.

## 9. Maamuzi ya mmiliki (S) — yote yamejibiwa 26/10 (j)

- **S-1:** Ndiyo. Hatua ya read-only ya `CF-Connecting-IP`/XFF (nginx ya prod → backend) inaendeshwa **kabla ya code** (§2).
- **S-2:** Country + ASN tu, DB-IP Lite; chanzo kinatajwa kama leseni inavyotaka (§3).
- **S-3:** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGE`. Si `SELECT_BRANCH` (§1).
- **S-4:** Regex yetu ya ndani; UA kamili inahifadhiwa (§1).
- **S-5:** Export CSV kwa CEO/root tu; kila export inaandikwa kwenye audit (§6).
- **S-6:** Dashboard kwa zote; email kwa `ROOT_LOGIN` tu ikiwa kuna SMTP. Hakuna SMTP (imethibitishwa) → hakuna email; SMTP mpya haijengwi (§6).
- **S-7:** "VPN inayojulikana" kwa kila user kupitia `login_audit_ack` (§6.1), 26/10 (i).

**Muundo umekamilika. Code baada ya 2.3.0.**
