# Deploy ya Angular V3 — https://elikom.co.tz/v3/

V3 inakaa **pembeni** ya Flutter: Flutter inabaki `/`, backend `/api`, V3 ni `/v3/`.
Script ya V3 haigusi container ya Flutter, backend wala postgres.

| Kitu | Thamani |
|---|---|
| Image | `chiefmaster/lsms-frontend-v3:<toleo>` (kamwe `:latest`) |
| Toleo (PC) | `.frontend-v3-version` — linaandikwa na ku-commit **baada tu** ya deploy kufaulu |
| Toleo (server) | mstari `FRONTEND_V3_VERSION=` ndani ya `~/lsms-deployment/.env` |
| Toleo lililopita | `~/lsms-deployment/.frontend-v3.prev` |
| Service | `frontend-v3` (ndani ya `docker-compose.override.yml`, 128MB) |
| Build output | `dist/lsmsFrontV3/browser` → `/usr/share/nginx/html/v3/` ndani ya image |

## Jinsi ya kudeploy

Mahitaji kwenye PC: Docker Desktop imewashwa, `docker login -u chiefmaster` (token ya PUSH),
`ssh contabo` inafanya kazi, na mabadiliko yote yame-commit.

```powershell
.\deploy\deploy-v3.ps1                # patch: 3.0.0 -> 3.0.1
.\deploy\deploy-v3.ps1 -Bump minor    # 3.0.4 -> 3.1.0   (au -Bump major)
.\deploy\deploy-v3.ps1 -Bump none     # toleo lililo kwenye faili, bila kuongeza (deploy ya KWANZA)
```

Chaguo nyingine: `-SkipPreflight` (hakuna utegemezi wa backend). Hakuna njia ya kujenga kutoka
working tree chafu: faili lolote lililobadilishwa au jipya (isipokuwa `analysis/`) linakataliwa.

Kinachotokea:

1. **PC:** ukaguzi (git safi, Docker, SSH) → `docker build` → `nginx -t` ndani ya image → `docker push`.
   Hatua yoyote ikishindwa, script inasimama na **server haijaguswa**.
2. **Server:** `docker pull` (toleo la zamani bado linaendesha) → badilisha `FRONTEND_V3_VERSION`
   → `docker compose up -d --no-deps frontend-v3`.
3. **Health check** kupitia nginx kuu (`Host: elikom.co.tz`, `http://localhost`):
   `/v3/` = 200 na ina `<base href="/v3/">`; `main-*.js` = 200 na ni JavaScript;
   `/v3/version.json` ina toleo jipya; deep link `/v3/sales` inarudisha app; `/` ni 200 au 302 kwenda `/v3/`; Flutter inathibitishwa
   kwa `/index.html` = 200 (na si app ya V3).
   Kila badiliko la `.env`: nakala kwanza (`.env.bak.v3.<muda>`, 5 za mwisho zinabaki), mstari wa
   `FRONTEND_V3_VERSION=` pekee unabadilishwa, kisha `docker compose config --quiet`; ikishindwa,
   nakala inarudishwa yenyewe na deploy inasimama.
4. Ikifaulu: `DEPLOY_OK <toleo>`, kisha `.frontend-v3-version` inaandikwa na ku-commit.
   Server inabaki na images mbili tu za V3 (mpya + iliyopita).

Backend hutangulia frontend: kama toleo la V3 linahitaji endpoint mpya, deploy backend kwanza.

## Rollback

**Ya moja kwa moja:** health check ikishindwa, script inarudisha toleo lililokuwa linaendesha,
inalikagua tena, na inatoka na kosa (`[FAILED]`). `.frontend-v3-version` haibadiliki.
Image ya zamani haifutwi kabla mpya haijathibitishwa, kwa hiyo rollback ni ya sekunde.

**Kwa mkono** (toleo jipya limepita health check lakini lina tatizo la matumizi):

```bash
ssh contabo
cd ~/lsms-deployment
cat .frontend-v3.prev                                   # toleo lililopita, mfano 3.0.4
sed -i 's/^FRONTEND_V3_VERSION=.*/FRONTEND_V3_VERSION=3.0.4/' .env
docker compose up -d --no-deps frontend-v3
curl -s -H "Host: elikom.co.tz" http://localhost/v3/version.json   # thibitisha toleo
```

Hii inabadilisha mstari mmoja tu wa `.env`; Flutter na backend haziguswi.
Deploy inayofuata itaendelea kutoka namba iliyo kwenye `.frontend-v3-version`.

**Kuzima V3 kabisa** (Flutter inaendelea kama kawaida):

```bash
cd ~/lsms-deployment
docker compose stop frontend-v3          # /v3/ itarudisha 502; / na /api hazibadiliki
```

Kurudisha config ya kabla ya V3: nakala ziko `default.conf.bak.<muda>` na
`docker-compose.override.yml.bak.<muda>`. Baada ya kurudisha `default.conf`:
`docker compose exec nginx nginx -t` kisha `docker compose exec nginx nginx -s reload`.

## Mpangilio wa server (ulifanyika mara moja)

- `docker-compose.override.yml`: service `frontend-v3` (image kwa `${FRONTEND_V3_VERSION}`).
- `.env`: mstari `FRONTEND_V3_VERSION=<toleo>`. Uko kwenye `.env` (si faili tofauti) kwa sababu
  compose inasoma `.env` kwa **kila** amri; kwa `--env-file` ya ziada, `docker compose up -d`
  ya kawaida na scripts za Flutter/backend zingeona variable tupu na kushindwa
  (`invalid reference format`).
- `default.conf`: `upstream frontend_v3` (kwa `resolve`), `location = /v3` na
  `location ^~ /v3/` juu ya regex locations. `^~` ni lazima — bila hiyo `.js/.css/.png`
  za V3 zingepelekwa kwa Flutter.

## Mambo ya kukumbuka

- V3 inaita API kwa njia ya relative (`/api/...`, `apiBaseUrl: ''`) — same-origin, hakuna CORS.
- Njia za assets ndani ya app lazima ziwe **relative** (`icons/x.png`, si `/icons/x.png`);
  njia inayoanza na `/` inaenda kwa Flutter.
- Build ya local kwa majaribio: `cmd /c "npm run build -- --configuration production --base-href /v3/"`
  (PowerShell inameza `--` ya npm; tumia `npm run build`, si `npx ng build`, ili `version.json` iandikwe).
- `ng build` (Angular 21.2.24 + esbuild 0.28.1) **haitoki yenyewe** baada ya kumaliza — bundle
  inaandikwa, kisha mchakato unabaki hai. Kwenye PC bonyeza Ctrl+C baada ya
  "Application bundle generation complete"; ndani ya Docker `deploy/ng-exit.cjs` inalishughulikia.
- Cache: `index.html` na `version.json` = no-cache; faili zenye hash (`main-*.js`, `chunk-*.js`,
  `styles-*.css`, `media/*`) = mwaka 1, immutable.
