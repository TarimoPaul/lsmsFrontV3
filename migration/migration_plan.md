# Mpango wa kuhama AWS → Contabo (LSMS) — rasimu 2026-10-02

> **⚠ MASAHIHISHO (13:30 EAT, baada ya ukaguzi wa mchana — `aws_inventory.md` toleo 2):**
> - **Server ya AWS inazimwa 00:00–07:00 EAT kila siku.** Cutover lazima iishe kabla ya
>   00:00 EAT, au ratiba ya kuzima (AWS Console) izimwe siku hiyo.
> - **SSL = Cloudflare.** Hakuna cert ya kutoa wala kunakili; sehemu 1.5 na hatua 10 za
>   cutover zinabadilika kuwa: badilisha A record ndani ya Cloudflare (proxied) → mara moja,
>   hakuna haja ya kupunguza TTL. Pendekezo: Cloudflare **Origin Certificate** kwenye nginx ya
>   Contabo + SSL mode **Full (strict)**, na ufw/nginx ikubali 80/443 kutoka IP za Cloudflare tu.
> - **Backups za kila siku zipo** (`~/backups/backup_*.dump`, siku 30). Kizuizi #2 hapa chini
>   kinabaki kwa sehemu tu: hakuna nakala nje ya server. Rehearsal itumie `backup_<jana>.dump`
>   kwa `scp` — hakuna pg_dump mpya inayohitajika.
> - Postgres = **15** → Contabo `postgres:15`. Uploads = ndani ya DB (bytea) → volume pekee ni postgres.
> - Ports za AWS: 22 + 80 tu (8084/5432 hazijafunguliwa).
> - Scripts za deploy: angalia `deploy_scripts_review.md`.

> Mpango huu umejengwa juu ya `aws_inventory.md`, ambayo bado ni **nusu**
> (ukaguzi wa server ulisimama kwa sababu ya RAM). Kila sehemu yenye ⚠ inategemea
> ukaguzi uliobaki. **Hakuna hatua ya uhamisho iliyotekelezwa.**

## Mambo 3 muhimu zaidi / vizuizi

1. **Maliza inventory kwanza (duka likiwa limefungwa)** — hasa compose file,
   proxy ya TLS, volumes/uploads na cron ya backup. Bila hizo, orodha ya
   "kinachohamia" haijakamilika. Pia **rekebisha SSH ya Contabo** (key
   ilikataliwa).
2. **Backup iliyothibitishwa ndiyo sharti la kwanza.** Hakuna backup ya nje ya
   server; backup ya AWS iliyoko PC (Feb 2026) ina 2.8KB. Kabla ya chochote:
   pg_dump moja kamili, irudishwe (restore) kwenye Contabo, na ihesabiwe
   (row counts). Hii pia ndiyo rehearsal.
3. **Revoke Docker Hub token iliyovuja** kwenye `lsmsBackend/.github/workflows/docker-build-push.yml`,
   na tengeneza siri MPYA kwa Contabo (`DB_PASSWORD`, `JWT_SECRET`,
   `root.password`) badala ya kunakili za zamani pale inapowezekana. (Kubadili
   `JWT_SECRET` kutawatoa watumiaji wote — fanya wakati wa cutover tu, ni sawa.)

---

## 1. Kinachohamia

### 1.1 Code (kupitia registry/git)
| Kitu | Njia | |
|---|---|---|
| Backend | `docker pull chiefmaster/my-lsms-backend:<toleo la sasa la prod>` kwenye Contabo | (Likely) |
| Frontend Flutter | `docker pull chiefmaster/lsms-frontend:<toleo la sasa>` | (Likely) |
| Postgres | Image ileile **na major version ileile** kama AWS ⚠ (pg_restore kwenda version ndogo zaidi hushindwa) | ⚠ |
| Proxy ya TLS | Kama ni container → image ileile; kama ni nginx ya host → sakinisha nginx + certbot kwenye host ya Contabo | ⚠ |
| Angular v3 (baadaye) | Image mpya `chiefmaster/lsms-frontend-v3` — haijawahi kutengenezwa; si sehemu ya cutover hii | [Certain] |

Rekebisha scripts `deploy.ps1` na `Deploy frontend.ps1`: badilisha `$AwsHost/$AwsUser/$PemPath`
kuwa `contabo`, na `$ComposeDir`. Pendekezo: weka `docker-compose.yml` + nginx config
kwenye **repo mpya ya git ya `lsms-deployment`** (bila `.env`), ili deploys ziache kuhariri
compose kwa `sed` server.

### 1.2 Config
- `docker-compose.yml` (nakili toka AWS, iliyosafishwa — angalia sehemu 2).
- Config ya nginx/proxy (TLS + `/api` → backend).
- `nginx.conf` ya Flutter iko ndani ya image — haihitaji kunakiliwa.

### 1.3 Siri (.env)
- Nakili kwa `scp` PC → Contabo **moja kwa moja** (si kupitia chat, email, git).
- Kwenye Contabo: `chmod 600 ~/lsms-deployment/.env*`, mmiliki `chief`.
- Hakikisha `ROOT_PASSWORD`/env ya `root.password` imewekwa (prod ina default iliyo kwenye code — angalia inventory E).

### 1.4 Data
- **Postgres:** `pg_dump -Fc` wakati wa cutover → `pg_restore` Contabo. DB ~6MB (dump ya custom) — uhamisho ni wa sekunde.
- **Volumes/files nyingine** ⚠: uploads (kama zipo kwenye disk), chochote kilicho kwenye volumes zisizo za Postgres.
- Usinakili volume ya Postgres kama faili (raw) — tumia pg_dump/pg_restore tu.

### 1.5 SSL
**Pendekezo: toa cert mpya Contabo baada ya kubadili DNS** (Let's Encrypt, HTTP-01 kwenye port 80, ufw tayari inaruhusu 80/443).
Kwa dakika chache za kwanza baada ya DNS switch HTTPS itakataa hadi cert itoke — kwa hiyo:
- Punguza TTL ya DNS iwe 300s **siku 1–2 kabla** ya cutover.
- Au tumia DNS-01 challenge kutoa cert Contabo *kabla* ya switch (kama DNS provider ana API).
Kunakili cert za zamani inawezekana lakini inahusisha private key — sipendekezi.

---

## 2. Mabadiliko yanayohitajika kwa Contabo

| # | Badiliko | Kwa nini |
|---|---|---|
| 1 | **Postgres bila `ports:`** (au `127.0.0.1:5432:5432` tu kama unahitaji tunnel ya DBeaver) | Docker inaandika iptables yake na **inapita ufw** — `ports: "5432:5432"` ingefungua DB kwa dunia nzima |
| 2 | **Backend bila port ya umma** — `127.0.0.1:8084:8084` au bila `ports:` kabisa (proxy inaongea nayo kwa network ya compose) | Sababu ileile; leo CORS inaonyesha 8084 inaweza kuwa wazi |
| 3 | `JAVA_OPTS=-Xms256m -Xmx1024m` (kupitia `environment:` ya compose, si kubadili Dockerfile) | 12GB inaruhusu; 512MB ya sasa ilikuwa juu ya uwezo wa AWS tu |
| 4 | Mem limits: backend `mem_limit: 1536m`, postgres `1g`, frontend/proxy `128m` | Container moja isiweze kumaliza RAM ya server |
| 5 | `restart: unless-stopped` kwa services zote | Zirudi zenyewe baada ya reboot |
| 6 | Postgres tuning ndogo: `shared_buffers=512MB`, `effective_cache_size=2GB` | Sasa kuna RAM |
| 7 | **CORS kwa v3** — CORS imeandikwa ndani ya `WebConfig.java`. Ongeza origin ya subdomain ya v3 (mfano `https://v3.elikom.co.tz`) na **ondoa** `https://16.171.128.232:*`. Hii ni **deploy ya backend** (code change) — pendekezo: soma origins kutoka env var `CORS_ALLOWED_ORIGINS` | Haiwezi kufanywa kwa config peke yake leo. *(Sikubadilisha code — kazi hii ni ya baadaye kwa ruhusa yako.)* Kama v3 itakaa chini ya domain ileile `/` na `/api` ileile (same-origin), CORS haihitajiki kabisa |
| 8 | **Backup ya usiku nje ya server**: cron 02:00 EAT → `docker exec postgres pg_dump -Fc` → `~/backups/lsms_YYYYMMDD.dump` → upload kwa `rclone` kwenda cloud (Backblaze B2 / Google Drive / S3) → retention: siku 14 local, siku 30 kila siku + miezi 12 ya kila mwezi kwenye cloud → ujumbe/alert ikishindwa | Leo hakuna backup ya kuaminika |
| 9 | Jaribio la restore la kila mwezi (restore kwenye DB ya muda, hesabu rows) | Backup isiyojaribiwa si backup |
| 10 | Log rotation ya Docker (`logging: max-size: 10m, max-file: 3`) | Disk isijae |
| 11 | Timezone: `TZ=Africa/Dar_es_Salaam` (Dockerfile tayari) — weka pia kwenye host na container ya postgres | Tarehe za "leo" zisiteleze |

---

## 3. Rehearsal (mazoezi) — bila kugusa prod

Hakuna kati ya hizi inayoathiri duka. Fanya siku yoyote kabla ya cutover.

1. **Fix SSH ya Contabo**; thibitisha `docker`, `docker compose`, `ufw status`, disk, RAM.
2. Sakinisha Docker (kama haipo) — kwa ruhusa yako.
3. Tengeneza `~/lsms-deployment` kwenye Contabo: compose iliyorekebishwa (sehemu 2), `.env` mpya (chmod 600).
4. **Pata backup:** tumia dump ya karibuni iliyo PC (`backups/prod_Lsms_20260930_1026_before_gl.dump`) — au dump mpya ya jana ⚠ (pg_dump kwenye AWS iko chini ya sheria ya "no pg_dump" hadi utoe ruhusa; ifanye duka likiwa limefungwa na RAM > 400MB).
5. `scp` dump → Contabo; `docker compose up -d postgres`; `pg_restore --no-owner -d Lsms`.
6. Hesabu rows za majedwali makuu (sales, sale_items, purchases, customers, products, stock, reconciliations, gl_journal…) na linganisha na hesabu za DB chanzo.
7. `docker compose up -d` (backend + frontend + proxy). Fikia kwa **SSH tunnel** au kwa IP + `/etc/hosts` ya PC yako — **usibadilishe DNS**.
8. Jaribu: **login**, **sale** (mauzo moja ya majaribio), **stock counting**, **reconciliation**, ripoti ya siku, print receipt.
   ⚠ `app.schedulers.enabled=true` — schedulers za Contabo zitaendesha kazi zake kwenye DB ya majaribio; ni sawa, lakini **zisitume SMS/notification kwa wateja halisi**. Thibitisha kama schedulers zina side-effects za nje ⚠.
9. Andika muda kila hatua ilichukua → ndiyo makadirio ya downtime ya cutover.
10. Futa DB ya majaribio (au iache) kabla ya cutover.

---

## 4. Cutover — usiku baada ya duka kufungwa

Siku 1–2 kabla: punguza TTL ya DNS (`elikom.co.tz`, `www`) hadi 300s. Waambie wafanyakazi muda wa downtime.

| Hatua | Amri / kitendo | Uthibitisho |
|---|---|---|
| 1 | Hakikisha recon za leo zimefungwa/submitted; hakuna mtu ana-login | Uliza mwenye duka |
| 2 | AWS: `docker compose stop backend` (frontend inaweza kubaki — itaonyesha kosa la mtandao) | Hakuna writes mpya |
| 3 | AWS: `pg_dump -Fc` kamili → `scp` kwenda PC **na** Contabo | Faili 2 zenye checksum (`sha256sum`) moja |
| 4 | AWS: hesabu rows (query ileile ya rehearsal) → hifadhi | |
| 5 | Contabo: DB tupu mpya → `pg_restore` | Hakuna errors |
| 6 | Contabo: hesabu rows → **linganisha na hatua 4 — lazima zilingane 100%** | Zikitofautiana: STOP → rollback |
| 7 | Contabo: `docker compose up -d` (wote) | `docker ps`, logs bila ERROR |
| 8 | Test kupitia `/etc/hosts` kabla ya DNS: login + kusoma mauzo ya leo | |
| 9 | Badilisha DNS A records → `194.163.174.34` | `dig elikom.co.tz` |
| 10 | Toa cert: certbot (HTTP-01) → reload proxy | `https://elikom.co.tz` inafunguka |
| 11 | Smoke test ya mwisho (login/sale/count/recon) | |
| 12 | AWS: `docker compose stop` (yote). **Usifute** instance. Ondoa scheduler/cron za AWS zisiandike chochote | |

## 5. Rollback

Kama kosa lolote kabla ya hatua 9 (DNS): Contabo `docker compose down`; AWS `docker compose start backend` → duka linaendelea kama zamani, hakuna data iliyopotea (AWS haikupokea writes tangu hatua 2).

Kama tatizo baada ya DNS na **mauzo mapya yameshaingia Contabo**:
1. Simamisha backend ya Contabo.
2. `pg_dump` ya Contabo → restore kwenye AWS (data mpya isipotee), au kubali kurudi bila data hiyo — **uamuzi wako**.
3. Rudisha DNS A records kwenda IP ya AWS; anzisha AWS.
Kwa sababu TTL ni 300s, kurudi kunachukua ~5–10 dakika.

**AWS: stopped-not-deleted kwa siku 7.** Pia piga **EBS snapshot** ya disk ya AWS baada ya hatua 12 (kwa ruhusa yako). Baada ya siku 7 bila tatizo: terminate instance, futa Elastic IP (inatozwa ikiwa haijaunganishwa), futa snapshot baada ya siku 30.

---

## 6. Hatari

| Hatari | Kupunguza |
|---|---|
| AWS ina-crash kabla ya migration (RAM 127MB leo) — data tangu dump ya 09-30 ingepotea | Pata pg_dump mpya HARAKA (usiku wa leo, kwa ruhusa) na fanya migration ndani ya siku chache |
| Postgres major version tofauti | Tumia version ileile ya AWS ⚠ |
| Uploads/picha ziko kwenye disk/volume, zisahaulike | Thibitisha kwenye ukaguzi uliobaki |
| HTTPS haifanyi kazi dakika za kwanza baada ya DNS | TTL 300s; au DNS-01 kabla |
| `JWT_SECRET` mpya inawatoa watumiaji | Ni sawa wakati wa cutover — waambie wa-login upya |
| Schedulers mbili (AWS + Contabo) zikiendesha kwa wakati mmoja | Simamisha backend ya AWS kabla ya kuwasha Contabo |
| Print agent / app za simu zimeandikwa IP ya AWS moja kwa moja | ⚠ thibitisha zinatumia domain si IP |
| Docker Hub token iliyovuja — mtu anaweza kupush image mbaya `:current` | Revoke sasa; pin tag ya version (si `:current`/`:latest`) kwenye compose |

## 7. Maswali kwako

1. Saa ngapi duka linafungwa? Nirudie ukaguzi wa AWS wakati huo (na ruhusa ya amri za sehemu "Ukaguzi uliobaki")?
2. SSH ya Contabo: key ina passphrase? Unaweza kuendesha `ssh-add ~/.ssh/id_contabo` au `! ssh contabo …` mwenyewe?
3. Unaruhusu **pg_dump moja** kwenye AWS usiku wa leo (duka limefungwa, RAM > 400MB) ili tuwe na backup ya sasa?
4. DNS ya `elikom.co.tz` inasimamiwa wapi (registrar / Cloudflare)? Ina API (kwa DNS-01)?
5. Subdomain ya v3 itakuwa ipi? Au v3 itachukua nafasi ya Flutter kwenye domain ileile (same-origin → hakuna CORS)?
6. Cloud storage ipi kwa backups (Backblaze B2 ni rahisi/bei nafuu; Google Drive ipo tayari)?
7. Server ilireboot saa ~07:00 leo — uliireboot wewe, au ilikuwa crash?
8. Kuna mfumo mwingine wowote (SMS gateway, print agent, app ya simu) unaoita backend kwa IP ya AWS?
