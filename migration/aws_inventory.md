# Inventory ya server ya AWS (LSMS prod)

> Toleo 2 — **2026-10-02 13:15–13:30 EAT** (duka liko wazi, ukaguzi mwepesi tu).
> Toleo 1 (12:27) lilisimama kwenye pre-flight; maelezo yake kadhaa yalikuwa
> makisio yaliyokosewa — yamesahihishwa hapa (angalia "Masahihisho").
> Lebo: **[Certain]** = nimeona moja kwa moja · **(Likely)** · **(Guessing)**.
> Vipengele vilivyobaki vimeandikwa **BADO — saa 00:30**, lakini soma kizuizi #1 kwanza.

## Mambo 3 muhimu zaidi

1. **Server INAZIMWA kila usiku 00:00 → 07:00 EAT** (21:00–04:00 UTC), kila siku
   tangu angalau 26 Sep (`last -x`). Reboot ya leo haikuwa crash. [Certain]
   Matokeo:
   - **Ukaguzi wa "saa 00:30" HAUWEZEKANI** — server itakuwa imezimwa. Dirisha
     la usiku ni **baada ya duka kufungwa hadi 23:59 EAT** tu.
   - Cron ya backup (`0 2 * * *` UTC = 05:00 EAT) **haiendeshwi kamwe**; backup
     inafanywa na `@reboot` catch-up saa 07:02 EAT. Inafanya kazi, lakini kwa bahati.
   - Kitu kinachozima/kuwasha (inaelekea AWS EventBridge/Instance Scheduler au
     Lambda) kiko nje ya server — hakionekani kutoka ndani. (Likely)
   - Cutover ya uhamisho lazima iishe kabla ya 00:00 EAT, au ratiba hiyo izimwe kwanza.
2. **HTTPS inatolewa na Cloudflare, si server.** DNS `elikom.co.tz` → nameservers
   za Cloudflare, proxied (`Server: cloudflare`, `CF-RAY …-DAR`). Server ina
   nginx kwenye **port 80 peke yake**, hakuna certbot/letsencrypt. [Certain]
   Kwa hiyo hakuna cert ya kuhamisha, na DNS switch ni kubadili A record ndani ya
   Cloudflare (inachukua sekunde). Cloudflare → AWS inaenda kwa **HTTP isiyosimbwa**
   (SSL mode "Flexible") (Likely).
3. **Backups zipo na ni nzuri — lakini ziko kwenye disk ileile tu.**
   `~/backups/backup_YYYYMMDD_HHMMSS.dump` kila siku (custom format, ~7.5MB,
   size-check ≥500KB, retention siku 30). Ya mwisho: `backup_20261002_040247.dump`
   (07:02 EAT leo). [Certain] Hakuna nakala nje ya server; script ya PC
   (`download-backups.ps1`) inatafuta `*.sql` hivyo **haijapakua chochote tangu Feb**.
   Disk ikifa au instance ikifutwa → backups zote zinapotea pamoja na DB.

---

## Pre-flight na ufuatiliaji wa RAM

| Wakati (EAT) | available | swap used | Kitendo |
|---|---|---|---|
| 13:15 pre-flight | 95MB | 448MB | Endelea (> 80MB) |
| baada ya kundi 1 (os/df/ss/ls) | 104MB | 448MB | |
| baada ya kundi 2 (compose/env/git) | 119MB | 448MB | |
| baada ya kundi 3 (nginx/cron/timers) | 114MB | 448MB | |
| baada ya kundi 4 (backup scripts/log/last) | 118MB | 448MB | |
| baada ya kundi 5 (docker ps/images/volumes) | 160MB | **485MB (+37)** | Karibu na kikomo cha +50 → kundi 1 tu zaidi, la kusoma faili pekee |
| mwisho (kundi 6, scripts) | 159MB | 484MB | **Nimesimama.** |

Hakuna kitu kilichoandikwa, kuanzishwa upya, au kuvutwa (pull).

---

## A. System
| | | |
|---|---|---|
| OS | Ubuntu 24.04.3 LTS, kernel 6.14.0-1018-aws | [Certain] |
| Timezone ya host | `Etc/UTC` (containers zina `TZ=Africa/Dar_es_Salaam` kwa backend tu) | [Certain] |
| Disk `/` | 29G, used 15G (53%), avail 14G | [Certain] |
| RAM / swap | 914MB / 2GB swap (~450–485MB inatumika kila mara) | [Certain] |
| Ports zinazosikiliza (host) | **22** (sshd), **80** (docker-proxy → nginx). DNS 53 kwenye localhost tu. **Hakuna 443, 8084, 5432** | [Certain] |
| Ratiba ya kuwasha/kuzima | boot 04:00 UTC, shutdown 21:00 UTC, kila siku | [Certain] |
| Users wanaoweza ku-login | BADO — saa 00:30 (hakuendeshwa: `getent passwd` haikuwa kwenye orodha ya mchana) | — |
| Security Group ya AWS (port 80 wazi kwa wote, au Cloudflare tu?) | Haionekani kutoka ndani — angalia AWS Console | — |

## B. Mpangilio wa deployment
| | | |
|---|---|---|
| Compose project | `lsms-deployment` → `/home/ubuntu/lsms-deployment/docker-compose.yml` (running 4) | [Certain] |
| Ni git repo? | `.git` ipo, branch `master`, **haina commit yoyote wala remote** — kila kitu ni untracked. Kwa vitendo: SI git repo | [Certain] |
| Faili muhimu | `docker-compose.yml` (Sep 30), `default.conf` (nginx, Jun 27), `.env`, `.env.backend`, `.env.frontend` | [Certain] |
| Faili za zamani/takataka | `docker-compose.yml.bak.20260802_134948`, `nginx.conf`, `nginx.confes`, `init.sql` (tupu), `deploy.sh`, `run.sh`, `lsms-deployer.sh`, `.deploy-version`, `lsms_pre_2.2.35.dump` (4.3MB), faili tupu `Accept:` `GET` `Host:` `User-Agent:` `=` (mabaki ya amri ya curl iliyokosewa) | [Certain] |
| `backend/`, `frontend/` | Nakala za zamani za source (Dec 2025 / Jun 2026) — **hazitumiki** na compose ya sasa (images zinatoka Docker Hub) | (Likely) |
| Home dir | `frontend/` (nakala nyingine ya zamani), `lsms-build-2.2.1/`, `db-snapshots/`, `.m2`, `.pub-cache`, `.dart-tool` (mabaki ya kujenga kwenye server zamani), dumps 5 za Julai (~3.5MB kila moja), `recon_backup_20260617_131930.sql` | [Certain] |
| `~/.git-credentials` (600) | **Ipo** — GitHub credential iliyohifadhiwa kwenye server (haikusomwa) | [Certain] kuwepo |

## C. Docker
| Container | Image | Ports | Hali | Chanzo cha image |
|---|---|---|---|---|
| `lsms-deployment-postgres-1` | `postgres:15` | 5432/tcp (ndani tu) | Up, healthy | Docker Hub rasmi [Certain] |
| `lsms-deployment-backend-1` | `chiefmaster/my-lsms-backend:2.2.58` | 8084/tcp (ndani tu) | Up | Docker Hub — imejengwa PC na `deploy.ps1` [Certain] |
| `lsms-deployment-frontend-1` | `chiefmaster/lsms-frontend:2.2.53` | 80/tcp (ndani tu) | Up | Docker Hub — imejengwa PC na `Deploy frontend.ps1` [Certain] |
| `lsms-deployment-nginx-1` | `nginx:latest` | **0.0.0.0:80→80** (IPv4+IPv6) | Up | Docker Hub rasmi [Certain] |

- Restart policy: `restart: always` kwa zote (kutoka compose). [Certain]
- **Mem limits: hakuna** kwenye compose. [Certain]
- Images: frontend 159MB, postgres:15 633MB, nginx:latest 241MB, eclipse-temurin:21-jre-alpine 286MB (haitumiki — mabaki), backend 157MB (created inaonyesha "56 years ago" = timestamp 1970). [Certain]
- Volumes: **moja tu** — `lsms-deployment_postgres_data`. [Certain] Ukubwa: BADO — saa 00:30.
- Networks: `lsms-deployment_lsms-net` (bridge). [Certain]
- Postgres major version: **15**. Contabo lazima itumie `postgres:15` (au juu zaidi ukifanya upgrade kwa makusudi). [Certain]

## D. Compose (secrets zimefichwa)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ***
      POSTGRES_PASSWORD: ***
    volumes: [postgres_data:/var/lib/postgresql/data]
    networks: [lsms-net]
    healthcheck: pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB} (10s/5s/5)
  backend:
    image: chiefmaster/my-lsms-backend:2.2.58      # ← hubadilishwa kwa sed na deploy.ps1
    restart: always
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_FLYWAY_ENABLED: "true"
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: ***
      SPRING_DATASOURCE_PASSWORD: ***
      DB_USERNAME: ***
      DB_PASSWORD: ***
      DB_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      SERVER_PORT: ${SERVER_PORT}
      JWT_SECRET: ***
      JWT_EXPIRATION: ${JWT_EXPIRATION}
      ADMIN_EMAIL: ${ADMIN_EMAIL}
      ADMIN_PASSWORD: ***
      ROOT_EMAIL: ${ROOT_EMAIL}
      ROOT_PASSWORD: ***
    depends_on: {postgres: {condition: service_healthy}}
    networks: [lsms-net]
  frontend:
    image: chiefmaster/lsms-frontend:2.2.53        # ← hubadilishwa kwa sed na Deploy frontend.ps1
    restart: always
    environment: {BACKEND_URL: /api}
    depends_on: [backend]
    networks: [lsms-net]
  nginx:
    image: nginx:latest
    restart: always
    ports: ["80:80"]
    volumes: [./default.conf:/etc/nginx/conf.d/default.conf:ro]
    depends_on: [frontend, backend]
    networks: [lsms-net]
volumes: {postgres_data: {}}
networks: {lsms-net: {driver: bridge}}
```

**Ports:** port pekee iliyo wazi kwa umma ni **80 (nginx)**. Postgres na backend
**hazijafunguliwa** kwa host. [Certain] *(Toleo 1 lilikisia 8084 iko wazi — si kweli.)*

Bendera:
- `nginx:latest` haijapinwa — `docker compose pull` ya baadaye inaweza kuleta toleo jipya bila kutarajia. [Certain]
- `SPRING_FLYWAY_ENABLED: "true"` kwenye prod (wakati `application.properties` inasema `false`) — Flyway inaendesha migrations backend inapoanza. Muhimu kwa restore: DB iliyorudishwa lazima iwe na `flyway_schema_history` kamili. [Certain]
- Muundo wa `version: '3.8'` umepitwa na wakati (onyo tu). [Certain]

## E. Env / config (majina tu)

| Faili | Ruhusa | Majina |
|---|---|---|
| `.env` | **`-rw-rw-r--` (664)** — kila user wa server anaweza kuisoma | `POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, SERVER_PORT, JWT_SECRET, JWT_EXPIRATION, ADMIN_EMAIL, ADMIN_PASSWORD, DOCKERHUB_USERNAME, DOCKERHUB_PASSWORD, ROOT_EMAIL, ROOT_PASSWORD` |
| `.env.backend` | 664 | `BACKEND_VERSION` (haitumiwi na compose — tag imeandikwa moja kwa moja) |
| `.env.frontend` | 664 | `FRONTEND_VERSION` (vivyo hivyo) |

- `ROOT_PASSWORD` — **jina lipo kwenye `.env` na linapitishwa kwa backend** → default iliyo kwenye code haitumiki prod. [Certain]
- `DOCKERHUB_PASSWORD` iko kwenye `.env` ya server — si lazima kwa runtime (images ni public au pull inafanya kazi bila login?). Isihamie Contabo. [Certain kuwepo]
- Hakuna variable inayohusu AWS (S3, region, IP) kwenye compose/.env. [Certain]
- AWS-specific iliyobaki iko kwenye **code**: CORS `WebConfig.java` → `https://16.171.128.232:8080`, `:8084` (hazina kazi — ports hizo hazijafunguliwa). [Certain]

## F. nginx
- **Ndani ya Docker** (`nginx:latest`), si host (`/etc/nginx` haipo). [Certain]
- Config: `~/lsms-deployment/default.conf` (mounted read-only). [Certain]
  - `upstream frontend { server frontend:80; }`
  - `upstream backend { zone …; server backend:8084 resolve; }` + `resolver 127.0.0.11 valid=10s`
  - `server { listen 80 default_server; server_name _; return 444; }` — inazuia ufikiaji kwa IP moja kwa moja ✔
  - `server { listen 80; server_name elikom.co.tz www.elikom.co.tz; … }`:
    `/index.html`, `/flutter*.js`, `/version.json` → no-cache; picha/fonts/wasm → 7d;
    js/css → 1h; `/` → frontend; **`/api/` → `http://backend/api/`** (read timeout 120s, `X-Forwarded-Proto $scheme`).
- **Hakuna CORS headers** kwenye nginx (CORS inashughulikiwa na Spring). [Certain]
- `X-Forwarded-Proto $scheme` itakuwa `http` (Cloudflare → origin ni HTTP) — kwa sasa haina athari. (Likely)
- `server_tokens`/ rate limiting / `real_ip` za Cloudflare hazijawekwa — logs zinaonyesha IP za Cloudflare, si za wateja. (Likely)

## G. SSL
- Hakuna cert kwenye server; hakuna certbot; hakuna port 443. [Certain]
- TLS inaishia **Cloudflare** (nameservers `elle.ns.cloudflare.com`, `harvey.ns.cloudflare.com`; IP za Cloudflare `104.21.16.71`, `172.67.166.228` + IPv6). [Certain]
- Mode ya SSL ya Cloudflare: inaelekea **Flexible** (origin ina HTTP tu). (Likely) — thibitisha Cloudflare dashboard → SSL/TLS.
- Expiry: inasimamiwa na Cloudflare (Universal SSL inajirenew). (Likely)

## H. Backups & scheduled jobs
| | | |
|---|---|---|
| crontab ya `ubuntu` | `0 2 * * * bash ~/backup-database.sh >> ~/backup-database.log 2>&1` na `@reboot /home/ubuntu/backup-catchup-wrapper.sh` | [Certain] |
| crontab ya root | hakuna; `/etc/cron.d`: `e2scrub_all`, `sysstat` tu | [Certain] |
| systemd timers | za mfumo tu (apt, logrotate, sysstat, fstrim…) — hakuna ya LSMS | [Certain] |
| Cron ya 02:00 UTC | **Haiendeshwi** — server imezimwa 21:00–04:00 UTC | [Certain] |
| Catch-up | Inasubiri 120s baada ya boot; kama backup ya mwisho ≥20h → inaendesha `backup-database.sh`. Log inaonyesha kila siku "latest backup is 23h old, running catch-up backup" | [Certain] |
| `backup-database.sh` | `docker exec lsms-deployment-postgres-1 pg_dump -U postgres -Fc Lsms > ~/backups/backup_<ts>.dump`; kama exit 0 na size ≥ 512000 bytes → ✅, futa `backup_*.dump` za zaidi ya siku 30; vinginevyo futa faili mbaya + exit 1. Haina siri ndani | [Certain] |
| Backup ya mwisho | `backup_20261002_040247.dump`, 7.5MB, 07:02 EAT leo — ✅ | [Certain] |
| Mfululizo | Kila siku 22 Sep → 2 Oct ipo (ukuaji 5.9MB → 7.5MB; kuruka 6.2→7.7MB tarehe 1 Oct = rebuild ya GL) | [Certain] |
| Nje ya server | **Hakuna.** `download-backups.ps1` (PC) inatafuta `backup_*.sql` → hakuna faili inayolingana → inashindwa kimya ("Download failed! EC2 backups NOT deleted") | [Certain] |
| Backups za mkono | `~/backups/` ina dumps 4 za Julai (pre-deploy/pre-repair), `~/` ina dumps 5 za Julai + `.sql` ya recon (Jun), `~/lsms-deployment/lsms_pre_2.2.35.dump` (Aug) — hizi hazifutwi na retention | [Certain] |
| Jaribio la restore | Hakuna ushahidi kwamba backup imewahi kurudishwa na kuhakikiwa | (Likely) |
| Schedulers za app | `app.schedulers.enabled=true`. Kazi zozote za Spring zilizopangwa kati ya 00:00–07:00 EAT **hazitekelezwi kamwe** kwa sababu server imezimwa | [Certain] mpangilio / (Guessing) athari |

## I. Frontend
- Flutter Web iko **ndani ya image** `chiefmaster/lsms-frontend:2.2.53` (nginx:alpine + `build/web`). Inahudumiwa: Cloudflare → nginx (host port 80) → container `frontend:80`. [Certain]
- `~/frontend/` na `~/lsms-deployment/frontend/` ni nakala za zamani za source/build — hazitumiki. (Likely)

## J. Vitu visivyo kwenye git (lazima vihamishwe au viamuliwe)
| Kitu | Hamisha? |
|---|---|
| `docker-compose.yml` | Ndiyo (iliyorekebishwa) [Certain] |
| `default.conf` (nginx) | Ndiyo [Certain] |
| `.env` (siri) | Ndiyo, kwa usalama (600) — bila `DOCKERHUB_*` [Certain] |
| Volume `postgres_data` | Kupitia pg_dump/pg_restore [Certain] |
| `~/backups/*.dump` (siku 30 + za mkono) | Nakili kwenye PC/cloud kama kumbukumbu (si lazima Contabo) |
| Uploads / picha | **Hakuna faili kwenye disk.** Picha za profile zinahifadhiwa kwenye DB (`UserProfileImage.data` = `bytea`); hakuna volume ya uploads; compose/.env haina jina lenye "upload" | [Certain] compose/env + code / (Likely) hakuna njia nyingine |
| Scripts za server (`deploy.sh`, `run.sh`, `lsms-deployer.sh`, `lsms-auto-update.sh`) | **Hapana** — za zamani/hatari, angalia `deploy_scripts_review.md` |
| `~/.git-credentials` | **Hapana** — futa/revoke token ya GitHub baada ya uhamisho |
| Print agent | Inaita `https://elikom.co.tz` (`lsms-print-agent/application.yml`) → haitaathirika na uhamisho [Certain] |

## K. Gharama za AWS
Haipatikani — hakuna AWS CLI/credentials kwenye PC. Angalia Console → Billing → Cost Explorer.
Kumbuka: ratiba ya kuzima usiku inaelekea iliwekwa kupunguza gharama — hiyo hiyo itaonekana kwenye EventBridge/Lambda/Instance Scheduler. (Guessing)

---

## Contabo (read-only)
**BADO.** `ssh contabo` → `Permission denied (publickey)` (toleo 1). Endesha
`! ssh-add ~/.ssh/id_contabo` (au thibitisha `authorized_keys`), kisha niambie.

---

## BADO — saa 00:30 ⚠ (lakini server imezimwa 00:00–07:00 EAT)

Pendekezo: fanya hivi **baada ya duka kufungwa na kabla ya 23:30 EAT**, au usiku
mmoja zima ratiba ya kuzima. Kumbuka: dakika ~2 za kwanza baada ya 07:00
catch-up backup inaendesha `pg_dump` — epuka kipindi hicho.

1. `sudo du -sh /var/lib/docker/volumes/lsms-deployment_postgres_data` — ukubwa wa volume
2. `docker inspect` (bila Env) — mem limits halisi, restart counts, OOMKilled
3. `journalctl -b -1 --no-pager | tail` — jinsi shutdown ya jana ilivyotokea (ACPI/scheduler?)
4. `getent passwd | awk -F: '$7!~/nologin|false/'`; `ls ~/.ssh` (majina tu); `sudo ls /root/.ssh`
5. `docker exec postgres psql -c 'select version()'` + `pg_database_size('Lsms')` + idadi ya rows za majedwali makuu (kwa kulinganisha baada ya restore)
6. pg_dump — **si lazima**: backup ya 07:02 ya kila siku tayari ipo; kwa rehearsal tumia hiyo (ni scp tu, haibebeshi RAM)
7. AWS Console (si server): EventBridge/Instance Scheduler ya kuzima; Security Group ya port 80/22; Elastic IP; Cost Explorer

## Masahihisho ya toleo 1
| Toleo 1 lilisema | Ukweli |
|---|---|
| Server ilireboot "sababu haijulikani" | Ratiba ya kila siku 21:00–04:00 UTC |
| Backup pekee ni ya 2.8KB ya Feb | Backups za kila siku ~7.5MB zipo server, siku 30 |
| Port 8084 inaweza kuwa wazi | Hapana — 22 na 80 tu |
| Proxy ya TLS haijulikani | nginx container (HTTP) + Cloudflare (HTTPS) |
| `root.password` inaweza kutumia default ya code | `ROOT_PASSWORD` imewekwa kwenye `.env` |
| `~/lsms-deployment` si git repo | Ina `.git` tupu (hakuna commit) — kwa vitendo si repo |
