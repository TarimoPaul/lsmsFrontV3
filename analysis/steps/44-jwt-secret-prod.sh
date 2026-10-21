#!/usr/bin/env bash
# HATUA 44 (a0) - inaendeshwa KWENYE CONTABO na 44-jwt-secret-prod.cmd (scp kwenda /tmp, kisha bash).
# Inabadilisha JWT_SECRET ya PROD (~/lsms-deployment/.env) kuwa bytes 64 za nasibu (Base64, kama JwtUtils.init inavyosoma),
# kisha inaunda upya container ya backend ili isome .env mpya. Watumiaji wote wanaingia upya.
# THAMANI HAICHAPISHWI KAMWE: inatengenezwa na kuandikwa ndani ya .env hapa hapa; log inaonyesha urefu na sha256 (herufi 12) tu.
# Ikishindwa baada ya kubadilisha .env: inarudisha .env ya zamani (backup) na kuwasha backend tena.
# Mwisho inachapisha ---OK--- au ---IMESHINDWA---.
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; echo ---IMESHINDWA---; exit 1; }

say() { echo "$@"; }
fail() { say "SIYO: $*"; say ---IMESHINDWA---; exit 1; }
h12() { sha256sum | cut -c1-12; }

say "---SAA-YA-TANZANIA---"
# Dirisha: 00:00-05:59 EAT bila kibali; 06:00-15:14 EAT ikiwa 44.cmd imepitisha ASUBUHI (kibali cha mmiliki, 21/10).
MODE="${1:-USIKU}"
NOW=$(TZ=Africa/Dar_es_Salaam date +%H%M)
say "saa: $(TZ=Africa/Dar_es_Salaam date '+%Y-%m-%d %H:%M') EAT - dirisha $MODE"
if [ "$NOW" -le 0559 ]; then :
elif [ "$MODE" = ASUBUHI ] && [ "$NOW" -ge 0600 ] && [ "$NOW" -le 1514 ]; then say "dirisha la ASUBUHI kwa kibali cha mmiliki"
else
  fail "inaruhusiwa tu 00:00-05:59 EAT, au 06:00-15:14 EAT kwa kibali cha ASUBUHI. Sasa ni $NOW."
fi

say "---PS-KABLA---"
docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' || fail "docker compose ps"

say "---JWT_SECRET-KABLA---"
N=$(grep -c '^JWT_SECRET=' .env || true)
[ "$N" = "1" ] || fail "JWT_SECRET= lazima iwe mstari 1 kwenye .env (ipo $N)"
OLD_H=$(grep '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '\r\n' | h12)
say "JWT_SECRET ya sasa: sha256 $OLD_H (thamani haichapishwi)"
# Je, container ya sasa inatumia thamani hiyo hiyo? (inathibitisha kwamba backend inasoma JWT_SECRET kutoka .env)
CUR_H=$(docker compose exec -T backend sh -c 'printf %s "$JWT_SECRET"' 2>/dev/null | h12)
say "backend inatumia sasa: sha256 $CUR_H"
[ "$OLD_H" = "$CUR_H" ] || fail "backend haitumii JWT_SECRET ya .env (au env ina jina jingine) - simama, kagua docker-compose.yml"

say "---BACKUP-YA-ENV---"
BK=".env.bak-jwt-$(TZ=Africa/Dar_es_Salaam date +%Y%m%d-%H%M%S)"
cp -p .env "$BK" && chmod 600 "$BK" || fail "backup ya .env"
say "backup: $BK (chmod 600)"

say "---THAMANI-MPYA (kwenye server tu)---"
NEW=$(openssl rand -base64 64 | tr -d '\r\n')
[ "${#NEW}" -ge 86 ] || fail "openssl rand haikutoa thamani ndefu (${#NEW})"
printf %s "$NEW" | base64 -d >/dev/null 2>&1 || fail "thamani si Base64 halali"
NEW_H=$(printf %s "$NEW" | h12)
TMP=$(mktemp) && chmod 600 "$TMP"
# Thamani inapita kwenye awk kupitia env, si command line (haionekani kwenye ps wala log).
NEWVAL="$NEW" awk 'BEGIN{v=ENVIRON["NEWVAL"]} /^JWT_SECRET=/{print "JWT_SECRET=" v; next} {print}' .env > "$TMP" || fail "kuandika .env mpya"
unset NEW
[ "$(grep -c '^JWT_SECRET=' "$TMP")" = "1" ] || { rm -f "$TMP"; fail ".env mpya haina JWT_SECRET moja"; }
[ "$(wc -l < "$TMP")" = "$(wc -l < .env)" ] || { rm -f "$TMP"; fail "idadi ya mistari ya .env imebadilika"; }
cat "$TMP" > .env && rm -f "$TMP"   # cat > inahifadhi ruhusa na mmiliki wa .env
say "JWT_SECRET mpya: urefu $(grep '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '\r\n' | wc -c), sha256 $NEW_H"

rollback() {
  say "---ROLLBACK: .env ya zamani inarudishwa---"
  cat "$BK" > .env
  docker compose up -d backend
  say "rollback imefanyika; JWT_SECRET sha256 $(grep '^JWT_SECRET=' .env | cut -d= -f2- | tr -d '\r\n' | h12)"
}

say "---BACKEND-INAUNDWA-UPYA (up -d inasoma .env mpya; restart peke yake haisomi)---"
START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose up -d backend || { rollback; fail "docker compose up -d backend"; }

say "---INASUBIRI-Started LsmsApplication (hadi sek 240)---"
OK=0
for i in $(seq 1 120); do
  if docker compose logs --since "$START" backend 2>&1 | grep -q 'Started LsmsApplication'; then OK=1; break; fi
  if docker compose logs --since "$START" backend 2>&1 | grep -qE 'APPLICATION FAILED|Application run failed'; then break; fi
  sleep 2
done
docker compose logs --since "$START" backend 2>&1 | grep -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed|WeakKeyException|IllegalArgumentException' | tail -5
if [ "$OK" != "1" ]; then rollback; fail "backend haikuwaka kwa JWT_SECRET mpya"; fi

say "---UTHIBITISHO---"
RUN_H=$(docker compose exec -T backend sh -c 'printf %s "$JWT_SECRET"' 2>/dev/null | h12)
say "backend inatumia: sha256 $RUN_H (lazima $NEW_H; si $OLD_H)"
[ "$RUN_H" = "$NEW_H" ] || { rollback; fail "backend haitumii thamani mpya"; }

say "---PS-BAADA---"
docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'
say "backup ya .env ya zamani: $BK (ifute ukishathibitisha (d); ina JWT_SECRET ya zamani)"
say ---OK---
