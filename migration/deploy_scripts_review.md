# Mapitio ya scripts za deploy na backup — 2026-10-02

> Read-only. Hakuna script iliyobadilishwa. Mapendekezo ya Contabo (sehemu 6) ni
> **rasimu tu** — hayajatumika.
> Lebo: **[Certain]** = nimesoma script yenyewe · **(Likely)** · **(Guessing)**.

## Mambo 3 muhimu zaidi

1. **Deploy ya backend inazima duka KABLA ya kuvuta image mpya, na inafuta image
   ya zamani.** `deploy.ps1` (remote): `docker stop backend` → `docker rmi` ya
   **images zote** za backend → `pull`. Docker Hub ikichelewa/ikishindwa (script
   yenyewe inakiri "Docker Hub … occasionally times out"), backend inabaki
   imezimwa, image ya zamani imeshafutwa (hakuna rollback ya haraka), na
   `docker-compose.yml` tayari imeandikwa toleo jipya. Kisha inachapisha
   `===DEPLOY_OK===` **bila health check yoyote**. [Certain]
2. **Hakuna backup inayotoka nje ya server.** `download-backups.ps1` inatafuta
   `~/backups/backup_*.sql`, lakini server sasa inaandika `backup_*.dump` — kwa
   hiyo haijapakua chochote tangu Feb 2026 (inashindwa na kusema "NOT deleted").
   Hata ingefanya kazi, ingefuta nakala za server mara tu `scp` ikirudisha exit 0,
   bila kuthibitisha ukubwa/checksum — ikiacha nakala moja tu (PC). [Certain]
3. **Scripts za zamani hatari bado ziko kwenye server.** `~/lsms-deployment/deploy.sh`
   inasimamisha na kufuta **container ya postgres** kisha `compose pull` (ingeleta
   `nginx:latest` mpya); `~/lsms-deployment/lsms-deployer.sh` inaendesha containers
   kwa `docker run -p …` **nje ya compose** (ingevunja mtandao wa `lsms-net`).
   `~/lsms-deployer.sh` / `~/lsms-auto-update.sh` zinajenga kwenye server kwa
   `git reset --hard` na `~/.git-credentials`. Mtu akiziendesha kwa makosa →
   duka linazima. **Zisihamie Contabo**; ziondolewe AWS baada ya uhamisho. [Certain]

---

## Orodha ya scripts

| Script | Mahali | Inatumika? |
|---|---|---|
| `deploy.ps1` | PC `Lsms/Lsms/` (backend repo, tracked) | **Ndiyo** — deploy ya backend [Certain] |
| `Deploy frontend.ps1` | PC `lsms_frontend/` (tracked) | **Ndiyo** — deploy ya Flutter [Certain] |
| `download-backups.ps1` | PC `DUKA PROJECT/` (si git) | Inaendeshwa lakini **haipakui chochote** [Certain] |
| `backup-database.sh` | server `~/` | **Ndiyo** (kupitia catch-up) [Certain] |
| `backup-catchup-wrapper.sh` | server `~/` (`@reboot`) | **Ndiyo** — ndiyo inayofanya backup kila siku [Certain] |
| `deploy.sh`, `run.sh`, `lsms-deployer.sh` | server `~/lsms-deployment/` | Hapana — za zamani (Dec 2025/Apr 2026) (Likely) |
| `lsms-deployer.sh`, `lsms-auto-update.sh` | server `~/` | Hapana — log ya mwisho Jan 6 2026: "Full deployment failed" (Likely) |
| `.github/workflows/docker-build-push.yml` | backend repo | Inakufa (context `./backend`, `./frontend` hazipo) — na **ina Docker Hub token kwenye jina la secret** (Likely) |
| `test-login.ps1` | backend repo | Jaribio la local tu (localhost:8086) — lina password ya user wa majaribio iliyoandikwa ndani [Certain] |
| `run-agent.bat` | `lsms-print-agent/` | Print agent kwenye PC ya duka — si deploy [Certain] |

---

## 1. `deploy.ps1` (backend)

### Thamani zilizoandikwa ndani (hardcoded) [Certain]
| | |
|---|---|
| Image | `chiefmaster/my-lsms-backend` (tags `<version>` na `current`) |
| Version file | `.backend-version` (sasa `2.2.58`; default `1.1.81` kama haipo) — **ignored na git** |
| Key | `$env:USERPROFILE\.ssh\lsms-server-key.pem` |
| User / host | `ubuntu` @ `ec2-16-171-128-232.eu-north-1.compute.amazonaws.com` |
| Compose dir | `~/lsms-deployment` |
| Container | `lsms-deployment-backend-1` |
| Faili za muda | `/tmp/deploy-backend.sh` (server), `%TEMP%\*.tmp.sh` (PC) |
| SSH | `-o StrictHostKeyChecking=no` kwa scp/ssh zote |

### Hatua kwa mpangilio
**PC:**
1. Soma `.backend-version` → ongeza patch (patch > 99 → minor++; minor > 99 → major++).
2. `mvn clean package -DskipTests` — **tests haziendeshwi**. Inasimama ikishindwa.
3. `docker build -t chiefmaster/my-lsms-backend:<new> .` — inasimama ikishindwa. (Inajenga kutoka **working tree** ya sasa — mabadiliko yasiyo-commit yanaenda prod; hakuna git tag ya toleo.)
4. `docker tag … :current`.
5. `docker push :<new>` kisha `:current` — kila moja hadi mara 4 (subiri 5/10/15s).
6. Futa images za local zisizo `<new>`/`current`.
7. **Andika `.backend-version = <new>`** (kabla ya deploy kufanikiwa).
8. Andika `.env.backend` = `BACKEND_VERSION=<new>` → `scp` kwenda `~/lsms-deployment/.env.backend` (exit code **haiangaliwi**).
9. Tengeneza script ya bash (LF), `scp` → `/tmp/deploy-backend.sh`, `ssh "bash /tmp/deploy-backend.sh"`.

**Server (`set -e`):**
1. `cd ~/lsms-deployment`
2. `sed -i 's/\r$//' .env .env.backend` (ondoa CR za Windows)
3. `export BACKEND_VERSION=<new>` (haina kazi — compose haitumii variable hii)
4. **`sed -i "s|chiefmaster/my-lsms-backend:.*|chiefmaster/my-lsms-backend:<new>|g" docker-compose.yml`**
   → inabadilisha mstari `image: chiefmaster/my-lsms-backend:2.2.58` (kila mstari wenye
   string hiyo, hadi mwisho wa mstari — comment yoyote kwenye mstari huo ingefutwa).
5. **`docker stop lsms-deployment-backend-1`** ← duka linaanza kukosa backend hapa
6. **`docker images chiefmaster/my-lsms-backend -q | xargs -r docker rmi -f`** ← image ya sasa inafutwa
7. `docker image prune -f`
8. `docker pull chiefmaster/my-lsms-backend:<new>` ← inahitaji mtandao; ikishindwa, `set -e` inasimamisha → backend **imezimwa**
9. `docker compose up -d --no-deps --force-recreate backend`
10. `echo ===DEPLOY_OK===` ← kabla ya kuthibitisha chochote
11. `docker ps … | grep backend|postgres`; `sleep 10`; `docker logs --tail 20`

**PC:** kama ssh exit ≠ 0 → `Write-Error`, exit 1 (faili ya muda haifutwi). Vinginevyo futa temp, "[OK] … live!".

### Ikishindwa
| Inashindwa wapi | Hali inayobaki |
|---|---|
| mvn / docker build | Hakuna kilichobadilika ✔ |
| push (baada ya majaribio 4) | Hakuna kilichobadilika server; image ya local ipo ✔ |
| scp `.env.backend` | Haiangaliwi; inaendelea |
| Remote hatua 4–7 | compose tayari ina toleo jipya; backend **imesimama**; image ya zamani **imefutwa** |
| Remote pull (hatua 8) | **Duka bila backend** hadi mtu aingilie. Rollback inahitaji kuvuta image ya zamani kutoka Docker Hub (polepole) na kurudisha sed kwa mkono |
| Spring inaanguka baada ya kuanza (migration ya Flyway, config) | Script bado inasema "Deploy complete"; `restart: always` → crash loop. `.backend-version` tayari imeongezwa |

### Hatari
- Downtime isiyo ya lazima: stop + rmi + pull = dakika kadhaa kwenye mtandao wa polepole; pull ingeweza kufanyika **kabla** ya stop.
- Hakuna rollback, hakuna health check, hakuna rekodi ya toleo lililopita.
- `-DskipTests` + kujenga kutoka working tree isiyo-commit.
- `StrictHostKeyChecking=no` → hatari ya MITM (host key haikaguliwi).
- Tag `:current` inasukumwa lakini **haitumiki** popote prod — ni mlango wa kuchanganyikiwa.
- Hakuna siri ndani ya script yenyewe ✔.

---

## 2. `Deploy frontend.ps1` (Flutter)

### Thamani zilizoandikwa ndani [Certain]
| | |
|---|---|
| Image | `chiefmaster/lsms-frontend` (`<version>`, `current`) |
| Version file | `.frontend-version` (sasa `2.2.53`; default `1.1.22`) — ignored na git |
| Key / user / host / compose dir | sawa na backend |
| Container | `lsms-deployment-frontend-1` |
| Faili | `web/version.json` (inaandikwa upya kila deploy), `.env.frontend`, `/tmp/deploy-frontend.sh` |
| SSH | `StrictHostKeyChecking=no` |

### Hatua kwa mpangilio
**PC:**
1. **Preflight**: isipokuwa `-SkipPreflight`, inauliza na kusubiri `ndio` (backend kwanza). ✔ nzuri
2. Soma `.frontend-version` → patch+1 (`>= 99` → rollover; tofauti kidogo na backend).
3. Andika `web/version.json` (version, buildTime UTC, releaseNotes sw/en) — inaendesha banner ya "update".
4. `flutter build web --release` — inasimama ikishindwa.
5. `docker build`, `docker tag :current`, `docker push :<new>`, `docker push :current` — **`$LASTEXITCODE` inaangaliwa mara MOJA tu, baada ya push ya mwisho.** `docker build` ikishindwa na `:current` ya zamani ipo local → push ya `:current` (ya zamani) inafanikiwa → script inaendelea kudeploy tag ambayo **haipo** Docker Hub.
6. Futa images za local za zamani.
7. **Andika `.frontend-version`**, `.env.frontend` → `scp` (exit haiangaliwi).
8. Script ya bash → `scp` → `ssh bash /tmp/deploy-frontend.sh`.

**Server (`set -e`):**
1. `cd ~/lsms-deployment`; `sed -i 's/\r$//' .env .env.frontend`
2. **`sed -i "s|chiefmaster/lsms-frontend:.*|chiefmaster/lsms-frontend:<new>|g" docker-compose.yml`** → mstari `image:` wa frontend.
3. **`docker container prune -f`** ← inafuta **kila container iliyosimama** kwenye server, si ya frontend tu (kama postgres au backend imesimama kwa sababu yoyote wakati huo, inafutwa; data iko kwenye volume, lakini ni hatari isiyo ya lazima).
4. `docker image prune -f`
5. `docker pull chiefmaster/lsms-frontend:<new>` — ikishindwa, inasimama; frontend ya zamani **bado inaendesha** ✔, lakini compose tayari inaelekeza tag mpya.
6. `docker compose up -d --no-deps --force-recreate frontend`
7. Futa images za frontend zisizo `current`/`<new>` kwenye server.
8. `echo '===DEPLOY_OK====='`; `docker ps`; `sleep 3`; logs tail 15.

**PC:** ssh exit ≠ 0 → "[FAILED]" exit 1; vinginevyo "[OK]". Temp inafutwa kila mara ✔.

### Hatari
- Ukaguzi wa exit code wenye pengo (hatua 5).
- `docker container prune -f` ni pana mno.
- Hakuna health check (hata `curl -I` ya `/version.json`).
- Version bump inahifadhiwa hata deploy ikishindwa.
- Faili ya `web/version.json` inabadilishwa kwenye source tree kila deploy.
- Upande wa nginx ya server, js/css zina `expires 1h` ilhali nginx ya container inasema `main.dart.js` no-cache → headers mbili za `Cache-Control`; inaweza kuchelewesha update kwa hadi saa 1 kwa baadhi ya browsers. (Likely)

---

## 3. `download-backups.ps1` (PC)

### Thamani [Certain]
`$EC2_HOST` (AWS host), `$EC2_USER = ubuntu`, `$KEY_PATH` (pem), `$LOCAL_DIR = D:\MY PROJECT\DUKA PROJECT\BACKUPS AWS`.

### Hatua
1. Tengeneza `$LOCAL_DIR` kama haipo; `cd` humo.
2. `scp -i $KEY_PATH ubuntu@host:~/backups/backup_*.sql .`
3. Kama exit 0 → **`ssh … "rm ~/backups/backup_*.sql"`** (futa ZOTE server) → onyesha orodha ya local.
4. Vinginevyo → "Download failed! EC2 backups NOT deleted."

### Hali ya sasa
- Server inaandika `backup_*.dump` → glob `*.sql` haipati kitu → scp inashindwa → hatua 4. **Haijapakua tangu `backup_20260205_053622.sql` (2.8KB).** [Certain]
- Kwa bahati, kosa hili ndilo linalozuia `rm` — script ikirekebishwa kwa `.dump` bila mabadiliko mengine, ingeanza kufuta backups za server.

### Hatari
- `rm` bila kuthibitisha (ukubwa, checksum, `pg_restore --list`, idadi ya faili).
- Inaacha nakala **moja** tu (PC moja, disk moja).
- Hakuna ratiba — inategemea mtu kukumbuka kuiendesha.

---

## 4. Backup scripts za server

### `backup-database.sh` [Certain]
`docker exec lsms-deployment-postgres-1 pg_dump -U postgres -Fc Lsms > ~/backups/backup_<ts>.dump` → kama exit 0: kagua ≥ 512000 bytes (ndogo → futa + exit 1) → futa `backup_*.dump` za > siku 30 → `ls | tail -5`.
- ✔ Custom format, size check, retention.
- ✘ Nakala iko kwenye disk ileile ya DB.
- ✘ `$?` inaangalia exit ya redirect/pipe — `pg_dump` ndani ya `docker exec` ikishindwa katikati inaweza kurudisha 0 na faili lisilo kamili lakini > 500KB. Haijaribiwi kwa `pg_restore --list`.
- ✘ Haina alert inaposhindwa (inaandika log tu).
- ✘ Jina la container limeandikwa ndani (`lsms-deployment-postgres-1`).

### `backup-catchup-wrapper.sh` [Certain]
`@reboot` → `sleep 120` → kama hakuna backup au ya mwisho ≥ 20h → endesha `backup-database.sh`. Kwa sababu server inazimwa 21:00–04:00 UTC, **hii ndiyo backup halisi ya kila siku** (07:02 EAT). Inafanya kazi vizuri.

---

## 5. Scripts za zamani kwenye server (usizihamishe)

| Script | Inafanya nini | Kwa nini ni hatari |
|---|---|---|
| `~/lsms-deployment/deploy.sh` | `compose pull` → stop+rm backend, frontend, **postgres** → `compose rm -f` → `up -d` → prune | Inazima DB; `pull` ingeleta `nginx:latest` mpya bila kutarajia |
| `~/lsms-deployment/run.sh` | `source .env*` → `docker-compose up -d` (v1) | `docker-compose` v1 huenda haipo; isiyo na madhara lakini ya kupotosha |
| `~/lsms-deployment/lsms-deployer.sh` | `docker login` (password kutoka env) → `flutter build` **kwenye server** → `docker run -d --name … -p …` | Inaunda containers nje ya compose/mtandao → nginx haitaziona; ingepakia RAM ya 914MB kwa flutter build |
| `~/lsms-deployer.sh`, `~/lsms-auto-update.sh` | `git clone/reset --hard` ya repo za GitHub (kwa `~/.git-credentials`) → `docker build` kwenye server → push → `compose stop/up` au `down/up` | Kujenga kwenye server ya 914MB; `compose down` ya mfumo mzima; inategemea GitHub token iliyohifadhiwa |

---

## 6. Mapendekezo kwa Contabo (RASIMU — haijatumika)

### 6.1 Kanuni za jumla
- SSH: tumia alias `contabo` (`ssh contabo`, `scp … contabo:`) — hakuna `.pem` path, **ondoa `StrictHostKeyChecking=no`** (host key iko kwenye `known_hosts`).
- Compose dir: `~/lsms` (au `/opt/lsms`) — **git repo mpya `lsms-deployment`** yenye `docker-compose.yml`, `nginx/default.conf`, `scripts/` (bila `.env`).
- Server haijengi chochote — inavuta images tu.
- Script isimame kwenye kosa la **kila** amri ya native (PowerShell: kagua `$LASTEXITCODE` baada ya kila moja, au function `Invoke-Checked`).
- Hifadhi `.backend-version`/`.frontend-version` **baada tu ya** health check kufaulu; `git tag backend-v<ver>` kwenye commit iliyojengwa (na kataa kujenga kama working tree ina mabadiliko yasiyo-commit, isipokuwa `-AllowDirty`).

### 6.2 Tags zilizopinwa badala ya `sed`
Compose (Contabo):
```yaml
services:
  backend:
    image: chiefmaster/my-lsms-backend:${BACKEND_VERSION:?BACKEND_VERSION haijawekwa}
    env_file: [.env]
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:8084/api/public/health || exit 1"]   # endpoint ya kuongeza — tazama 6.4
      interval: 10s
      timeout: 5s
      retries: 30
      start_period: 60s
  frontend:
    image: chiefmaster/lsms-frontend:${FRONTEND_VERSION:?FRONTEND_VERSION haijawekwa}
  nginx:
    image: nginx:1.27-alpine        # pin, si latest
```
`docker compose --env-file .env --env-file .versions up -d` — faili `~/lsms/.versions` lina mistari miwili `BACKEND_VERSION=…` na `FRONTEND_VERSION=…`. Deploy inabadilisha **faili hilo tu** (si compose), na inaweka nakala `.versions.prev` kwa rollback.

### 6.3 Mtiririko mpya wa deploy (backend; frontend ni sawa)
```
PC:     git diff --quiet || stop          # working tree safi
        mvn clean package  (tests ON, au -SkipTests kwa makusudi)
        docker build / push :<new>        # kila hatua ikaguliwe
Server: cd ~/lsms
        docker pull chiefmaster/my-lsms-backend:<new>      # backend YA ZAMANI bado inaendesha
        cp .versions .versions.prev
        sed -i "s/^BACKEND_VERSION=.*/BACKEND_VERSION=<new>/" .versions   # faili letu dogo, si compose
        docker compose up -d --no-deps --wait --wait-timeout 180 backend
        └─ ikishindwa → cp .versions.prev .versions
                        docker compose up -d --no-deps --wait backend   # rollback, image ya zamani bado ipo
                        exit 1
        curl -fsS https://elikom.co.tz/api/public/health   # kupitia Cloudflare+nginx
        weka images 3 za mwisho tu (si rmi zote)
PC:     andika .backend-version, git tag, "[OK]"
```
Downtime inakuwa sekunde za kuanza kwa Spring tu (si pull), na kuna rollback ya moja kwa moja.

### 6.4 Health check
Backend **haina** actuator wala endpoint ya health (hakuna `spring-boot-starter-actuator` kwenye `pom.xml`; public paths ni `/api/auth/**`, `/api/public/**`). Chaguo:
- (a) ongeza `spring-boot-starter-actuator` na expose `health` tu (code change — kwa ruhusa yako), au
- (b) tumia endpoint ya public iliyopo inayogusa DB kwa wepesi (kuamua baada ya kusoma `/api/public/**`).
Mpaka hapo, health check ya muda: `curl -s -o /dev/null -w '%{http_code}' -X POST /api/auth/login` ≠ 000/502/503.

### 6.5 Frontend
- Kagua exit code baada ya `docker build`, kila `push`.
- Ondoa `docker container prune -f`.
- Health check: `curl -fsS https://elikom.co.tz/version.json | grep "<new>"`.
- Kwa v3 (Angular): image tofauti `chiefmaster/lsms-frontend-v3`, service tofauti kwenye compose, `server_name` tofauti kwenye nginx — script ya deploy yenye muundo uleule.

### 6.6 Backup (Contabo) — haifuti nakala pekee
Server (cron ya `chief`, host TZ = Africa/Dar_es_Salaam, Contabo haizimwi usiku):
```
30 2 * * *  ~/lsms/scripts/backup.sh
backup.sh:
  set -euo pipefail
  docker compose exec -T postgres pg_dump -U <user> -Fc Lsms > backups/tmp.dump
  pg_restore --list backups/tmp.dump > /dev/null          # thibitisha dump inasomeka
  [ size >= 1MB ] || fail
  mv tmp.dump backup_<ts>.dump; sha256sum > backup_<ts>.dump.sha256
  rclone copy backup_<ts>.dump* remote:lsms-backups/daily/     # cloud (B2 / GDrive)
  rclone check ... || fail                                     # thibitisha imefika
  siku ya 1 ya mwezi → pia remote:lsms-backups/monthly/
  local: futa > siku 14;  cloud: daily > siku 30, monthly > miezi 12 (rclone delete --min-age)
  fail → ujumbe (email/Telegram/healthchecks.io ping)
```
PC (`download-backups.ps1` mpya, si lazima kama cloud ipo):
- vuta `backup_*.dump` + `.sha256` mpya tu (zisizokuwepo local), kwa `scp contabo:…`
- thibitisha `sha256` na `pg_restore --list` local
- **usifute kamwe kwenye server** — retention ya server ndiyo inashughulikia.

Kila mwezi: restore ya majaribio ya backup ya cloud kwenye DB ya muda + hesabu rows.

### 6.7 Za kuondoa baada ya uhamisho (AWS)
`deploy.sh`, `run.sh`, `lsms-deployer.sh` (zote mbili), `lsms-auto-update.sh`, `~/.git-credentials` (na revoke token yake GitHub), `DOCKERHUB_*` kwenye `.env`, GitHub workflow iliyokufa (na revoke Docker Hub token iliyovuja).
