#!/usr/bin/env bash
# HATUA 45i (mmiliki 21/10) - .env YA PROD ili boot iache kuiwasha admin@admin.com. Ushahidi wa 45g: ROOT_EMAIL_YA_BACKEND [admin@admin.com].
# Inaendeshwa NYUMA kwenye Contabo (45-bg.sh) na 45i-prod-env-root.cmd. Inachukua nafasi ya 52a (iliyoondolewa).
# Matumizi: bash 45i-prod-env-root.sh badilisha
#           bash 45i-prod-env-root.sh rudisha [.env.bak.45i.<saa>]  (rollback; bila jina = nakala ya 45i ya karibuni zaidi)
# badilisha:
#  a) nakala .env.bak.45i.<saa> (chmod 600; ina JWT_SECRET ya SASA). Nakala za .env zenye JWT_SECRET ya ZAMANI (44, deploy ya 45d)
#     zinafutwa mwishoni (mmiliki: zisiachwe) - majina yanaonyeshwa, thamani hazionyeshwi. Rollback ya 2.2.71 -> 2.2.70
#     (remote-deploy-backend.sh rollback() / DEPLOY_BACKEND.md) haizisomi: inatumia .backend.prev + sed ya BACKEND_VERSION.
#     Kinga: nakala yenye mstari MWINGINE tofauti (si JWT_SECRET/BACKEND_VERSION/ROOT_*) haifutwi.
#  b) ROOT_EMAIL=root@system.com; ROOT_PASSWORD inaondolewa ikiwepo (password ya root iliyopo iko kwenye DB, haitegemei .env).
#     Mistari mingine yote lazima ibaki sawa; diff ya MAJINA ya variables tu + majina ambayo thamani yake imebadilika.
#  c) backend PEKE YAKE inaundwa upya (docker compose up -d --no-deps backend - restart haisomi .env upya), subiri
#     Started LsmsApplication + PUBLIC_API_400.
#  d) (server) ROOT_EMAIL_YA_BACKEND [root@system.com]. (PC baadaye: admin@admin.com INACTIVE + root@system.com inaingia;
#     PC ikishindwa HAKUNA rollback - mmiliki 21/10.)
#  e) ROLLBACK TU ikiwa (c) backend haikuanza au (d-server) ROOT_EMAIL_YA_BACKEND si [root@system.com]: .env ya nakala +
#     backend upya (ROLLBACK_IMEFANYIKA), exit 1. Nakala ina ROOT_EMAIL=admin@admin.com -> boot inaiwasha admin TENA;
#     script inaandika ADMIN_IMEWASHWA_TENA (izime kwenye V3 mara moja).
# Kurudia: .env tayari sahihi na backend inaitumia -> haibadilishi, inathibitisha tu.
set -u -o pipefail
cd ~/lsms-deployment || exit 1
fail() { echo "SIYO: $*"; exit 1; }
benv() { docker compose exec -T backend sh -c 'printf "ROOT_EMAIL_YA_BACKEND [%s]\n" "${ROOT_EMAIL:-HAIJAWEKWA}"; if [ -z "${ROOT_PASSWORD+x}" ]; then echo "ROOT_PASSWORD_YA_BACKEND [HAIPO]"; elif [ -z "$ROOT_PASSWORD" ]; then echo "ROOT_PASSWORD_YA_BACKEND [TUPU]"; else echo "ROOT_PASSWORD_YA_BACKEND [IPO]"; fi' < /dev/null 2>/dev/null; }
h12() { sha256sum | cut -c1-12; }
jwt() { grep '^JWT_SECRET=' "$1" 2>/dev/null | head -n1 | cut -d= -f2- | tr -d '\r\n' | h12; }
unda_upya() {   # backend peke yake; Started + PUBLIC_API_400
  local S; S=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  docker compose up -d --no-deps backend || return 1
  local LG="" i
  for i in $(seq 1 60); do LG=$(docker compose logs --no-color --since "$S" backend 2>&1); grep -q -E 'Started LsmsApplication|APPLICATION FAILED' <<< "$LG" && break; sleep 3; done
  grep -E 'Started LsmsApplication|APPLICATION FAILED' <<< "$LG" | tail -n 2 | sed -E 's/^[^|]*\| //' | cut -c1-200
  grep -E 'DataInitializer.*(ROOT|root\.email)' <<< "$LG" | sed -E 's/^[^|]*\| //' | cut -c1-200
  grep -q 'Started LsmsApplication' <<< "$LG" || return 1
  local C=""
  for i in $(seq 1 20); do C=$(curl -s -o /dev/null -m 10 -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://elikom.co.tz/api/auth/login | tr -dc '0-9'); [ "$C" = 400 ] && break; sleep 3; done
  echo "HTTP_$C"; [ "$C" = 400 ] && echo PUBLIC_API_400
}

case "${1:-}" in
rudisha)
  B="${2:-}"
  # 45-bg.sh inapitisha hoja moja tu ("rudisha"): bila jina, nakala ya 45i ya karibuni zaidi inatumika
  [ -n "$B" ] || B=$(ls -1t .env.bak.45i.* 2>/dev/null | head -n1)
  echo "nakala ya kurudisha: ${B:-HAKUNA}"
  echo "$B" | grep -qxE '\.env\.bak\.45i\.[0-9]{8}_[0-9]{6}' || fail "jina la nakala si sahihi: [$B]"
  [ -f "$B" ] || fail "nakala $B haipo"
  echo "---ROLLBACK-.env-KUTOKA-$B---"
  cat "$B" > .env || fail "kurudisha .env"
  unda_upya | grep -v '^PUBLIC_API_400$' ; R=${PIPESTATUS[0]}
  benv
  [ "$R" = 0 ] || fail "backend haikuwaka baada ya rollback - niambie SASA"
  echo ROLLBACK_IMEFANYIKA
  grep -q '^ROOT_EMAIL=admin@admin.com$' .env && echo "ADMIN_IMEWASHWA_TENA: admin@admin.com IMEWASHWA TENA na boot - izime kwenye V3 mara moja"
  echo ---OK---
  exit 0 ;;
badilisha) ;;
*) fail "tumia: badilisha | rudisha <nakala>" ;;
esac

echo "---KABLA---"
echo "backend: $(docker compose ps backend --format '{{.Image}}' | head -n1)"
NE=$(grep -c '^ROOT_EMAIL=' .env || true); NP=$(grep -c '^ROOT_PASSWORD=' .env || true)
echo ".env: mistari ROOT_EMAIL $NE, ROOT_PASSWORD $NP"
[ "$NE" -le 1 ] && [ "$NP" -le 1 ] || fail "ROOT_EMAIL / ROOT_PASSWORD zina mistari zaidi ya 1"
echo "marejeo ya ROOT_* kwenye compose (majina tu):"; grep -ohE 'ROOT_[A-Z_]+' docker-compose*.yml 2>/dev/null | sort | uniq -c | sed 's/^/  /'
E0=$(benv); echo "$E0"

if [ "$(grep -c '^ROOT_EMAIL=root@system.com$' .env)" = 1 ] && [ "$NP" = 0 ] && grep -qx 'ROOT_EMAIL_YA_BACKEND \[root@system.com\]' <<< "$E0"; then
  echo ".env tayari ni sahihi na backend inaitumia - hakuna kinachobadilishwa (kurudia)"
  B=$(ls -1t .env.bak.45i.* 2>/dev/null | head -n1); [ -n "$B" ] && echo "BACKUP_YA_45I $B"
else
  echo "---a-NAKALA-YA-.env---"
  B=".env.bak.45i.$(date +%Y%m%d_%H%M%S)"
  (umask 077; cp .env "$B") && chmod 600 "$B" || fail "nakala ya .env imeshindwa"
  echo "BACKUP_YA_45I $B"
  echo "nakala: chmod $(stat -c %a "$B"), JWT_SECRET sha256 $(jwt "$B") (sawa na .env ya sasa $(jwt .env))"

  echo "---b-.env-MPYA---"
  TMP=$(mktemp ./.env.45i.XXXXXX) || fail "mktemp"
  awk 'BEGIN { done = 0 }
       /^ROOT_PASSWORD=/ { next }
       /^ROOT_EMAIL=/ { if (!done) print "ROOT_EMAIL=root@system.com"; done = 1; next }
       { print }
       END { if (!done) print "ROOT_EMAIL=root@system.com" }' .env > "$TMP" || { rm -f "$TMP"; fail "awk"; }
  cmp -s <(grep -vE '^ROOT_(EMAIL|PASSWORD)=' .env) <(grep -vE '^ROOT_(EMAIL|PASSWORD)=' "$TMP") || { rm -f "$TMP"; fail "mistari mingine ya .env ingebadilika"; }
  echo "diff ya majina (- kabla, + baada):"
  diff <(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env | sort) <(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$TMP" | sort) | grep -E '^[<>]' | sed 's/^</  -/; s/^>/  +/'
  echo "majina ambayo thamani imebadilika:"
  for k in $(sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' "$TMP" | sort -u); do
    a=$(grep "^$k=" .env | cut -d= -f2- | h12); b=$(grep "^$k=" "$TMP" | cut -d= -f2- | h12)
    grep -q "^$k=" .env && [ "$a" != "$b" ] && echo "  ~$k"
  done
  cat "$TMP" > .env && rm -f "$TMP" || fail "kuandika .env"
  echo ENV_ROOT_EMAIL_IMEWEKWA

  echo "---c-BACKEND-PEKE-YAKE-INAUNDWA-UPYA---"
  if ! unda_upya; then
    echo "---e-ROLLBACK---"; cat "$B" > .env; unda_upya; benv; echo ROLLBACK_IMEFANYIKA; echo "ADMIN_IMEWASHWA_TENA: admin@admin.com IMEWASHWA TENA na boot - izime kwenye V3 mara moja"
    fail "backend haikuwaka kwa .env mpya - .env imerudishwa kutoka $B"
  fi
fi

echo "---d-UTHIBITISHO-WA-SERVER---"
E=$(benv); echo "$E"
if ! grep -qx 'ROOT_EMAIL_YA_BACKEND \[root@system.com\]' <<< "$E"; then
  if [ -n "${B:-}" ] && [ -f "$B" ]; then echo "---e-ROLLBACK---"; cat "$B" > .env; unda_upya; benv; echo ROLLBACK_IMEFANYIKA; echo "ADMIN_IMEWASHWA_TENA: admin@admin.com IMEWASHWA TENA na boot - izime kwenye V3 mara moja"; fi
  fail "backend haitumii ROOT_EMAIL=root@system.com"
fi
echo BACKEND_ROOT_EMAIL_SAWA
[ "$(grep -c '^ROOT_PASSWORD=' .env)" = 0 ] && echo ENV_ROOT_PASSWORD_HAIPO || fail ".env bado ina ROOT_PASSWORD"
grep -qx 'ROOT_PASSWORD_YA_BACKEND \[IPO\]' <<< "$E" && fail "backend bado ina ROOT_PASSWORD yenye thamani"
grep -qx 'ROOT_PASSWORD_YA_BACKEND \[TUPU\]' <<< "$E" && echo "TAHADHARI: compose inapitisha ROOT_PASSWORD TUPU - inatumika tu ikiwa root.email haipo (2.2.71 ingeunda root) - root@system.com ipo"

echo "---a2-NAKALA-ZA-.env-ZENYE-JWT-YA-ZAMANI---"
CUR=$(jwt .env)
for f in .env.bak* .env.*.bak* ; do
  [ -f "$f" ] || continue
  case "$f" in .env.bak.45i.*) continue ;; esac
  J=$(jwt "$f")
  # inafutwa TU ikiwa tofauti na .env ya sasa iko kwenye JWT_SECRET / BACKEND_VERSION / ROOT_* peke yake (rollback ya 2.2.70 haizihitaji:
  # inatumia .backend.prev + sed ya BACKEND_VERSION kwenye .env ya SASA); mstari mwingine wowote tofauti -> inabaki, niambie
  NYINGINE=$(diff <(grep -vE '^(JWT_SECRET|BACKEND_VERSION|ROOT_EMAIL|ROOT_PASSWORD)=' "$f" | sort) <(grep -vE '^(JWT_SECRET|BACKEND_VERSION|ROOT_EMAIL|ROOT_PASSWORD)=' .env | sort) | grep -cE '^[<>]' || true)
  if [ -n "$J" ] && [ "$J" != "$(printf '' | h12)" ] && [ "$J" != "$CUR" ] && [ "$NYINGINE" = 0 ]; then rm -f -- "$f" && echo "  IMEFUTWA $f (JWT_SECRET ya zamani; mistari mingine sawa na .env ya sasa)"
  elif [ "$NYINGINE" != 0 ]; then echo "  imebaki $f (mistari $NYINGINE mingine tofauti na .env ya sasa - haifutwi; niambie)"
  else echo "  imebaki $f (JWT_SECRET ya sasa au haina JWT_SECRET)"; fi
done
echo ---OK---
