#!/usr/bin/env bash
# HATUA 59 (mmiliki 26/10 m2) - PROD: backend 2.2.71 -> 2.2.72 (hotfix, HAKUNA migration). INABADILISHA PRODUCTION.
# Inaendeshwa NYUMA kwenye Contabo na 45-bg.sh (59-prod-2272.cmd): bash run.sh <SAA_YA_SERVER_KUANZA ya hatua>.
# Zana ziko ~/lsms-hatua/59-zana/: hali-root.sh, 45-maandishi.sh, remote-deploy-backend.sh (ya main ya backend, bila kubadilishwa).
#   0) kinga (kusoma tu): prod 2.2.71; ROOT_EMAIL ya .env na ya container = root@system.com; hali-root SASA: admin@admin.com HAIPO,
#      is_root_wote 1, users_wote 8, root@system.com ACTIVE; Flyway "102 134"; openCount ya gl_posting_failure
#   1) pull + digest ya 57a (sha256:ad3c...)  2) hali-root KABLA  3) backup ya .env  4) hakuna write ya mtumiaji tangu hatua ianze
#   5) remote-deploy-backend.sh 2.2.72 (dump iliyothibitishwa, BACKEND_VERSION, restart ya backend tu, health, rollback yake)
#   6) baada: container = digest; .env tofauti na backup ni BACKEND_VERSION tu (TOLEO_ENV_2272); boot bila "Creating ROOT user"
#      wala "Activating ROOT user" ya akaunti nyingine; ERROR za boot 0; hali-root BAADA: users 8, is_root 1, root ACTIVE,
#      updated_at ile ile, admin HAIPO; Flyway kabla = baada; openCount haiongezeki
#   7) chochote kikishindwa baada ya restart -> ROLLBACK: BACKEND_VERSION 2.2.71 (.backend.prev) -> restart -> hali-root tena.
# psql zote za hatua hii ni READ ONLY (hali-root, flyway, openCount); kuandika kwenye DB ni kwa backend yenyewe tu.
set -u -o pipefail
K="${1:-}"
Z="$HOME/lsms-hatua/59-zana"
DG=sha256:ad3c59458436a043cf795390d5c334a48984a16ed2e149cc72bd533edb43359a
IMG=chiefmaster/my-lsms-backend
MPYA=2.2.72; ZAMANI=2.2.71
USERS=8; FLY_TARAJIO="102 134"
fail() { echo "SIYO: $*"; exit 1; }
eat() { TZ=Africa/Dar_es_Salaam date "$@"; }
echo "59 prod $ZAMANI -> $MPYA - $(eat '+%F %H:%M:%S') EAT - hatua ilianza $(eat -d "@$K" '+%H:%M:%S' 2>/dev/null) EAT"
echo "$K" | grep -qxE '[0-9]{9,11}' || fail "SAA_YA_SERVER_KUANZA si sahihi [$K]"
cd ~/lsms-deployment || fail "~/lsms-deployment haipo"
for f in hali-root.sh 45-maandishi.sh remote-deploy-backend.sh; do [ -s "$Z/$f" ] || fail "$Z/$f haipo"; echo "zana $f sha256 $(sha256sum "$Z/$f" | cut -c1-12)"; done
DC() { docker compose "$@"; }
RO() { printf '%s\n' "$1" | DC exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }
fly() { RO "select count(*) || ' ' || coalesce((select version from flyway_schema_history where success order by installed_rank desc limit 1), '-') from flyway_schema_history where success;" | tr -d '\r'; }
wazi() { RO "select count(*) from gl_posting_failure where resolved_at is null;" | tr -dc '0-9'; }
tag() { local c; c=$(DC ps -q backend | head -n1); [ -n "$c" ] && docker inspect --format '{{.Config.Image}}' "$c" | sed -n "s|^$IMG:||p"; }
cimg() { local c; c=$(DC ps -q backend | head -n1); [ -n "$c" ] && docker inspect --format '{{.Image}}' "$c"; }
renv() { DC exec -T backend sh -c 'echo "${ROOT_EMAIL:-HAIJAWEKWA}"' < /dev/null | tr -d '\r'; }
ne() { grep -c "^$1=" "$2" 2>/dev/null; }
ve() { sed -n "s/^$1=//p" "$2" | head -n1; }
hr() { printf '%s\n' "$1" | grep "^HALI_ROOT|$2|prod|$3|" | head -n1; }
hs() { printf '%s\n' "$1" | cut -d'|' -f6; }
hu() { printf '%s\n' "$1" | sed -n 's/.*|updated_at \([^|]*\)|.*/\1/p'; }
# hali <output> <lebo>: users 8, is_root 1 (root@system.com tu), root ACTIVE, admin HAIPO -> HALI_<lebo>_SAWA
hali() {
  local H="$1" L="$2" R A
  R=$(hr "$H" "$L" root@system.com); A=$(hr "$H" "$L" admin@admin.com)
  printf '%s\n' "$H" | grep -qx "HALI_ROOT|$L|prod|users_wote $USERS" || { echo "SIYO_HALI $L: users_wote si $USERS"; return 1; }
  printf '%s\n' "$H" | grep -qx "HALI_ROOT|$L|prod|is_root_wote 1 root@system.com" || { echo "SIYO_HALI $L: is_root_wote si 1 (root@system.com)"; return 1; }
  [ "$(hs "$R")" = ACTIVE ] && echo "$R" | grep -q '|is_root true|is_locked false|is_deleted false|' || { echo "SIYO_HALI $L: root@system.com si ACTIVE/root/unlocked"; return 1; }
  [ "$(printf '%s\n' "$A" | cut -d'|' -f5)" = HAIPO ] || { echo "SIYO_HALI $L: admin@admin.com IPO"; return 1; }
  echo "HALI_${L}_SAWA root updated_at $(hu "$R")"
}

echo "---0-KINGA-ZA-PROD (kusoma tu)---"
T0=$(tag); echo "backend inayoendesha: $IMG:$T0"
[ "$T0" = "$ZAMANI" ] || fail "prod haiendeshi $ZAMANI ($T0) - SIMAMA"
echo "PROD_BADO_2271"
echo "mistari ya .env: ROOT_EMAIL $(ne ROOT_EMAIL .env), ROOT_PASSWORD $(ne ROOT_PASSWORD .env), BACKEND_VERSION $(ne BACKEND_VERSION .env)"
[ "$(ne ROOT_EMAIL .env)" = 1 ] && [ "$(ve ROOT_EMAIL .env)" = root@system.com ] || fail "ROOT_EMAIL ya .env si root@system.com"
[ "$(ne BACKEND_VERSION .env)" = 1 ] && [ "$(ve BACKEND_VERSION .env)" = "$ZAMANI" ] || fail "BACKEND_VERSION ya .env si $ZAMANI (mstari 1)"
RE=$(renv); echo "ROOT_EMAIL_YA_BACKEND [$RE]"
[ "$RE" = root@system.com ] || fail "ROOT_EMAIL ya container ya backend si root@system.com"
HS=$(bash "$Z/hali-root.sh" prod SASA) || fail "hali-root SASA imeshindwa"
echo "$HS"
hali "$HS" SASA || fail "hali ya root/users ya prod si ile iliyotarajiwa - SIMAMA"
F1=$(fly) || fail "flyway haisomeki"; echo "flyway kabla: $F1"
[ "$F1" = "$FLY_TARAJIO" ] || fail "flyway si \"$FLY_TARAJIO\" ($F1)"
O1=$(wazi); echo "posting-failures openCount kabla: $O1"
[ -n "$O1" ] || fail "openCount haisomeki"

echo "---1-PULL-NA-DIGEST---"
docker pull -q "$IMG:$MPYA" < /dev/null || fail "pull imeshindwa - hakuna kilichobadilika"
RD=$(docker image inspect "$IMG:$MPYA" --format '{{join .RepoDigests " "}}'); echo "RepoDigests: $RD"
echo "$RD" | tr ' ' '\n' | grep -qx "$IMG@$DG" || fail "digest ya tag $MPYA si $DG - SIMAMA, hakuna kilichobadilika"
DI=$(docker image inspect "$IMG@$DG" --format '{{.Id}}') && [ -n "$DI" ] || fail "image ya digest haipo"
echo "DIGEST_PULL_SAWA"

echo "---2-HALI-ROOT-KABLA---"
HK=$(bash "$Z/hali-root.sh" prod KABLA) || fail "hali-root KABLA imeshindwa"
echo "$HK"
hali "$HK" KABLA || fail "hali ya KABLA si ile iliyotarajiwa"
UK=$(hu "$(hr "$HK" KABLA root@system.com)")
cp -p /tmp/hali-root-prod.kabla "$Z/hali-root-prod.kabla.59" || fail "nakala ya KABLA (kwa rollback) imeshindwa"

echo "---3-BACKUP-YA-ENV---"
B=".env.bak.59-kabla-ya-2272-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$B" || fail "backup ya .env imeshindwa"
echo "backup ya .env: $B"

echo "---4-HAKUNA-WRITE-TANGU-HATUA-IANZE---"
bash "$Z/45-maandishi.sh" "$K" "$K" > "$Z/maandishi.txt" 2>&1; MR=$?
cat "$Z/maandishi.txt"
[ "$MR" = 0 ] && grep -qx MAANDISHI_TANGU_DUMP_HAKUNA "$Z/maandishi.txt" || fail "kuna write ya mtumiaji tangu hatua ianze (au kinga haikusoma log) - hakuna kilichobadilika"
echo "WRITES_TANGU_KUANZA_0"

# ---- ROLLBACK ya hatua hii (baada ya restart) ----
rollback() {
  echo "---7-ROLLBACK-KWENDA-$ZAMANI---"
  local P S2 i LG2 HR
  P=$(cat .backend.prev 2>/dev/null); echo ".backend.prev: [$P]"
  [ "$P" = "$ZAMANI" ] || { echo "ROLLBACK_IMESHINDWA .backend.prev si $ZAMANI - SIMAMA, angalia server SASA"; return 1; }
  if [ "$(tag)" != "$ZAMANI" ]; then
    sed -i "s/^BACKEND_VERSION=.*/BACKEND_VERSION=$ZAMANI/" .env || { echo "ROLLBACK_IMESHINDWA sed ya .env"; return 1; }
    S2=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    DC up -d --no-deps backend < /dev/null || { echo "ROLLBACK_IMESHINDWA up -d"; return 1; }
    for i in $(seq 1 60); do DC logs --no-color --since "$S2" backend 2>&1 | grep -q 'Started LsmsApplication' && break; sleep 3; done
  else
    echo "backend tayari ni $ZAMANI (rollback ya remote-deploy-backend.sh) - hakuna restart nyingine"
  fi
  cmp -s "$B" .env && echo ".env ni sawa kabisa na $B" || echo "ONYO: .env si sawa na $B: $(diff "$B" .env | grep -c '^[<>]') mistari"
  [ "$(tag)" = "$ZAMANI" ] || { echo "ROLLBACK_IMESHINDWA backend si $ZAMANI ($(tag))"; return 1; }
  [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' -H 'Host: elikom.co.tz' -H 'Content-Type: application/json' -X POST -d '{}' http://localhost/api/auth/login)" = 400 ] || echo "ONYO: login ya majaribio si 400 baada ya rollback"
  cp -p "$Z/hali-root-prod.kabla.59" /tmp/hali-root-prod.kabla
  HR=$(bash "$Z/hali-root.sh" prod BAADA); echo "$HR"
  printf '%s\n' "$HR" | grep -qx HALI_ROOT_SAWA && hali "$(printf '%s\n' "$HR" | sed 's/^HALI_ROOT|BAADA|/HALI_ROOT|ROLLBACK|/')" ROLLBACK \
    || { echo "ROLLBACK_IMESHINDWA backend ni $ZAMANI lakini safu ya root/admin/users bado si sawa na KABLA (data, si toleo) - SIMAMA, niambie"; return 1; }
  echo "flyway baada ya rollback: $(fly)"
  echo "ROLLBACK_2271_SAWA"
}
baada_fail() { echo "SIYO: $*"; rollback; echo "---59_IMESHINDWA_BAADA_YA_RESTART---"; exit 1; }

echo "---5-DEPLOY-2.2.72 (remote-deploy-backend.sh: dump, .env, restart, health)---"
S=$(date -u +%Y-%m-%dT%H:%M:%SZ)
bash "$Z/remote-deploy-backend.sh" "$MPYA" 2>&1; DR=$?
echo "[remote-deploy-backend.sh exit $DR]"
if [ "$DR" != 0 ]; then
  echo "SIYO: deploy ya $MPYA imeshindwa (rollback ya script ya deploy iko hapo juu)"
  rollback
  echo "---59_IMESHINDWA_DEPLOY---"; exit 1
fi

echo "---6-UKAGUZI-WA-BAADA---"
[ "$(tag)" = "$MPYA" ] || baada_fail "backend si $MPYA ($(tag))"
CI=$(cimg); echo "container image $CI; digest image $DI"
[ -n "$CI" ] && [ "$CI" = "$DI" ] || baada_fail "container si image ya digest $DG - SIMAMA"
echo "DIGEST_INAYOENDESHA_SAWA"
X=$(diff "$B" .env | grep '^[<>]' | grep -vc '^[<>] BACKEND_VERSION=')
[ "x$X" = x0 ] && [ "$(ne BACKEND_VERSION .env)" = 1 ] && [ "$(ve BACKEND_VERSION .env)" = "$MPYA" ] || baada_fail ".env ina tofauti isiyo ya BACKEND_VERSION=$MPYA"
echo "TOLEO_ENV_2272"
RE2=$(renv); echo "ROOT_EMAIL_YA_BACKEND [$RE2]"; [ "$RE2" = root@system.com ] || baada_fail "ROOT_EMAIL ya container mpya si root@system.com"
LG=$(DC logs --no-color --since "$S" backend 2>&1 | sed -E 's/^[^|]*\| //')
BOOT=$(printf '%s\n' "$LG" | sed '/Started LsmsApplication/q')
printf '%s\n' "$BOOT" | grep -q 'Started LsmsApplication' || baada_fail "log ya boot haina Started LsmsApplication"
printf '%s\n' "$LG" | grep -E 'DataInitializer.*(ROOT|root)|Current version of schema|No migration necessary|Successfully applied|Started LsmsApplication' | cut -c1-260
printf '%s\n' "$BOOT" | grep -q 'Creating ROOT user' && baada_fail "boot imeunda ROOT user"
AO=$(printf '%s\n' "$BOOT" | grep -E 'Activating ROOT user: ' | grep -v 'Activating ROOT user: root@system.com')
[ -z "$AO" ] || baada_fail "boot imewasha akaunti nyingine: $AO"
printf '%s\n' "$BOOT" | grep -q 'Setting isRoot flag' && baada_fail "boot imepandisha akaunti"
echo "BOOT_ROOT_SAWA (hakuna Creating ROOT user wala Activating ROOT user ya akaunti nyingine)"
NE=$(printf '%s\n' "$BOOT" | grep -c ' ERROR ')
echo "ERROR za boot: $NE"; printf '%s\n' "$BOOT" | grep ' ERROR ' | head -n 10 | cut -c1-260
[ "$NE" = 0 ] || baada_fail "ERROR za boot si 0"
echo "ERROR_ZA_BOOT_0"
HB=$(bash "$Z/hali-root.sh" prod BAADA) || baada_fail "hali-root BAADA imeshindwa"
echo "$HB"
printf '%s\n' "$HB" | grep -qx HALI_ROOT_SAWA || baada_fail "hali-root: safu ya root/admin imebadilika"
hali "$HB" BAADA || baada_fail "hali ya BAADA si ile iliyotarajiwa"
UB=$(hu "$(hr "$HB" BAADA root@system.com)")
[ -n "$UK" ] && [ "$UB" = "$UK" ] || baada_fail "updated_at ya root@system.com imebadilika ($UK -> $UB)"
echo "BAADA_ROOT_SAWA updated_at $UB (haijabadilika)"
F2=$(fly); echo "flyway baada: $F2"
[ "$F2" = "$F1" ] || baada_fail "flyway imebadilika ($F1 -> $F2)"
echo "FLYWAY_HAIJABADILIKA"
O2=$(wazi); echo "posting-failures openCount: $O1 -> $O2"
[ -n "$O2" ] && [ "$O2" -le "$O1" ] || baada_fail "openCount imeongezeka ($O1 -> $O2)"
echo "OPENCOUNT_HAIJAONGEZEKA"
rm -f "$Z/hali-root-prod.kabla.59"
echo "DEPLOY_59_OK $MPYA"
echo "---59_SERVER_MWISHO---"
exit 0
