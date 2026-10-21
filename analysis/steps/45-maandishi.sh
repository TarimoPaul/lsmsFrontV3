#!/usr/bin/env bash
# KINGA YA §1.8 (mmiliki 21/10): HAKUNA ombi la kuandika kwenye API ya prod tangu DUMP MPYA ya 45a.
# Matumizi (kwenye Contabo): bash 45-maandishi.sh <epoch ya kuanza kwa dump mpya> <epoch ya freeze ya mmiliki>
# Inaendeshwa na 45a (ndani ya 45a-prod-preflight.sh - nakala ileile), 45d, 46a, 46b, 43 na 47. KUSOMA TU: log za nginx +
# maombi ya majaribio POST /api/auth/login?lsms18probe=<tok> (body {} -> 400; hayaandiki chochote).
#  1) Ombi la majaribio kwa njia 3 (public https://elikom.co.tz, na nginx ya origin moja kwa moja http/https 127.0.0.1),
#     kisha linatafutwa (kwa alama yake) kwenye log za stdout za KILA service ya ~/lsms-deployment na faili za
#     /var/log/nginx/*.log za kila container yenye nginx. Majaribio 3 (sek 3, 6, 10 za flush). Lisipoonekana = SIMAMA.
#  2) Chanzo kilichoonyesha alama ndicho kinasomwa. Mstari wa majaribio lazima usomeke kwa muundo wa log
#     (IP [saa] "METHOD njia ...") - vinginevyo SIMAMA (muundo usiojulikana = hesabu isiyoaminika).
#  3) POST/PUT/PATCH/DELETE kwenye /api tangu dump, bila /api/auth/login, /api/auth/refresh, majaribio, na maombi ya
#     hatua za §1.8 zenyewe (User-Agent lsms-18/<script>; ikiwa log haina User-Agent: njia za GL za 46/43/47 tu).
#     > 0 = SIMAMA na kuorodhesha (saa, IP, njia).
#  4) TAARIFA TU: maombi yote tangu freeze kwa METHOD, njia na IP (kifaa kipi bado kiko kwenye LSMS).
# Ishara: NGINX_LOG_INAFANYA_KAZI, MAANDISHI_TANGU_DUMP_HAKUNA (na MAANDISHI_TANGU_FREEZE_HAKUNA - jina la zamani la 45a).
set -u -o pipefail
DE="${1:-}"; FZ="${2:-}"
echo "$DE" | grep -qxE '[0-9]{9,11}' && echo "$FZ" | grep -qxE '[0-9]{9,11}' || { echo "SIYO: epoch ya dump / freeze si sahihi: [$DE] [$FZ]"; exit 1; }
[ "$FZ" -le "$DE" ] || { echo "SIYO: freeze ni baada ya dump"; exit 1; }
cd ~/lsms-deployment || exit 1
eat() { TZ=Africa/Dar_es_Salaam date "$@"; }
W=$(mktemp -d /tmp/45-maandishi.XXXXXX) || exit 1
trap 'rm -rf "$W"' EXIT
echo "dump mpya ilianza: $(eat -d "@$DE" '+%F %H:%M:%S') EAT; freeze: $(eat -d "@$FZ" '+%F %H:%M:%S') EAT; sasa: $(eat '+%H:%M:%S') EAT"

SVCS=$(docker compose ps --services --status running 2>/dev/null)
[ -n "$SVCS" ] || { echo "SIYO: docker compose ps haikuonyesha service zinazoendesha"; exit 1; }
NGX=""
for s in $SVCS; do docker compose exec -T "$s" sh -c 'command -v nginx' < /dev/null > /dev/null 2>&1 && NGX="$NGX $s"; done
echo "service zinazoendesha: $(echo $SVCS) | zenye nginx:${NGX:- HAKUNA}"

# chanzo: stdout:<service> au file:<service>:<njia>
soma() {   # soma <chanzo> <iso ya tangu> -> mistari (bila kiambishi cha compose)
  case "$1" in
    stdout:*) docker compose logs --no-color --since "$2" "${1#stdout:}" 2>/dev/null | sed -E 's/^[^|]*\| //' ;;
    file:*) local r="${1#file:}"; docker compose exec -T "${r%%:*}" sh -c "tail -n 200000 '${r#*:}'" < /dev/null 2>/dev/null ;;
  esac
}
vyanzo() {
  for s in $SVCS; do echo "stdout:$s"; done
  for s in $NGX; do
    docker compose exec -T "$s" sh -c 'for f in /var/log/nginx/*.log $(nginx -T 2>/dev/null | sed -nE "s/^[[:space:]]*access_log[[:space:]]+([^ ;]+).*/\1/p"); do [ -f "$f" ] && [ ! -L "$f" ] && echo "$f"; done' < /dev/null 2>/dev/null \
      | awk '!s[$0]++' | sed "s|^|file:$s:|"
  done
}

section_probe() {
  TOK="$(date +%s)$RANDOM"
  PSINCE=$(date -u -d "-20 sec" +%Y-%m-%dT%H:%M:%SZ)
  for k in public origin80 origin443; do
    case $k in
      public) U="https://elikom.co.tz"; X="" ;;
      origin80) U="http://127.0.0.1"; X="-H Host:elikom.co.tz" ;;
      origin443) U="https://127.0.0.1"; X="-k -H Host:elikom.co.tz" ;;
    esac
    C=$(curl -s -o /dev/null -m 15 -w '%{http_code}' $X -A "lsms-18-probe-$k" -X POST -H 'Content-Type: application/json' -d '{}' "$U/api/auth/login?lsms18probe=$TOK$k" 2>/dev/null | tr -dc '0-9')
    echo "  majaribio $k: HTTP_${C:-000}"
  done
}

SRC=""; PLINE=""; PK=""
for jaribio in 1 2 3; do
  echo "ombi la majaribio - jaribio $jaribio ya 3"
  section_probe
  case $jaribio in 1) sleep 3 ;; 2) sleep 6 ;; 3) sleep 10 ;; esac
  for v in $(vyanzo); do
    soma "$v" "$PSINCE" > "$W/v.txt"
    for k in public origin80 origin443; do
      L=$(grep -F "lsms18probe=$TOK$k" "$W/v.txt" | tail -n 1)
      [ -n "$L" ] || continue
      echo "  alama ya $k IMEONEKANA kwenye $v"
      if [ -z "$SRC" ] || { [ "$k" = public ] && [ "$PK" != public ]; }; then SRC="$v"; PLINE="$L"; PK="$k"; fi
    done
  done
  [ -n "$SRC" ] && break
done
if [ -z "$SRC" ]; then
  echo "SIYO: ombi la majaribio halikuonekana kwenye chanzo chochote baada ya majaribio 3 - freeze haiwezi kuthibitishwa"
  for v in $(vyanzo); do echo "  $v: mistari tangu freeze $(soma "$v" "$(date -u -d "@$FZ" +%Y-%m-%dT%H:%M:%SZ)" | grep -c .); 2 ya mwisho:"; soma "$v" "$PSINCE" | tail -n 2 | cut -c1-220 | sed 's/^/    /'; done
  for s in $NGX; do echo "  access_log za $s:"; docker compose exec -T "$s" sh -c 'nginx -T 2>/dev/null | grep -E "^[[:space:]]*(access_log|log_format)"' < /dev/null 2>/dev/null | cut -c1-200 | sed 's/^/    /'; done
  exit 1
fi
echo "chanzo cha log: $SRC (ombi la $PK)"
echo "mstari wa majaribio: $(echo "$PLINE" | cut -c1-260)"
[ "$PK" = public ] || echo "TAHADHARI: ombi la public (https://elikom.co.tz) halikuonekana; la origin ($PK) limeonekana - angalia muhtasari wa IP hapa chini kuona kama vifaa vinapita nginx hii"

# muundo: <ip> ... [<saa>] "<METHOD> <njia> HTTP/x" <status> ...
PARSE='^([^ ]+) [^[]*\[([^]]+)\] "([A-Z]+) ([^ "]+)[^"]*" ([0-9]{3})'
echo "$PLINE" | grep -qE "$PARSE" || { echo "SIYO: muundo wa log haujulikani (mstari wa majaribio hausomeki) - hesabu haiaminiki"; exit 1; }
UA_IPO=0; echo "$PLINE" | grep -qF "lsms-18-probe-" && UA_IPO=1
echo "User-Agent kwenye log: $([ $UA_IPO = 1 ] && echo NDIYO || echo HAPANA)"

if [ "${SRC%%:*}" = stdout ]; then
  ST=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q "${SRC#stdout:}" | head -n1)" 2>/dev/null)
  echo "container ya $SRC ilianza: $ST"
  [ -n "$ST" ] && [ "$(date -d "$ST" +%s)" -lt "$DE" ] || { echo "SIYO: container ya log ilianza baada ya dump - log ya tangu dump haijakamilika"; exit 1; }
fi

SINCE_FZ=$(date -u -d "@$FZ" +%Y-%m-%dT%H:%M:%SZ)
soma "$SRC" "$SINCE_FZ" | grep -E "$PARSE" | grep -v 'lsms18probe=' > "$W/raw.txt"
# epoch kwa kila mstari (mara moja kwa sekunde ileile - cache)
awk '{ if (match($0, /\[[^]]+\]/)) print substr($0, RSTART + 1, RLENGTH - 2) }' "$W/raw.txt" | sort -u > "$W/saa.txt"
: > "$W/map.txt"
while read -r t; do d="${t%%:*}"; r="${t#*:}"; e=$(date -d "$(echo "$d" | tr '/' ' ') ${r% *} ${r#* }" +%s 2>/dev/null) && printf '%s\t%s\n' "$t" "$e" >> "$W/map.txt"; done < "$W/saa.txt"
awk -F'\t' 'NR == FNR { m[$1] = $2; next } { if (match($0, /\[[^]]+\]/)) { t = substr($0, RSTART + 1, RLENGTH - 2); print (t in m ? m[t] : "-") "\t" $0 } }' "$W/map.txt" "$W/raw.txt" > "$W/e.txt"
BAD=$(awk -F'\t' '$1 == "-"' "$W/e.txt" | wc -l)
[ "$BAD" = 0 ] || { echo "SIYO: mistari $BAD ina saa isiyosomeka"; awk -F'\t' '$1 == "-" {print $2}' "$W/e.txt" | head -3 | cut -c1-200; exit 1; }

# IP halisi: sehemu ya mwisho yenye "..." ikiwa ni IP (X-Forwarded-For), vinginevyo $remote_addr
FMT='{ l = $0; sub(/^[^\t]*\t/, "", l); n = split(l, q, "\""); ip = l; sub(/ .*/, "", ip);
       x = (n >= 3 ? q[n - 1] : ""); if (x ~ /^[0-9a-fA-F.:]+(, *[0-9a-fA-F.:]+)*$/) { sub(/,.*/, "", x); ip = x }
       split(q[2], rq, " "); meth = rq[1]; p = rq[2]; sub(/\?.*/, "", p); st = q[3]; sub(/^ /, "", st); sub(/ .*/, "", st);
       ua = (n >= 7 ? q[6] : "") }'

echo "--- MAOMBI-YA-KUANDIKA-TANGU-DUMP ($(eat -d "@$DE" '+%H:%M:%S') EAT) ---"
awk -F'\t' -v de="$DE" -v uaipo="$UA_IPO" "$FMT"'
  $1 + 0 >= de + 0 && meth ~ /^(POST|PUT|PATCH|DELETE)$/ && p ~ /^\/api\// && p !~ /^\/api\/auth\/(login|refresh)$/ {
    if (uaipo == 1 && ua ~ /^lsms-18\//) { print "HATUA18\t" $1 "\t" ip "\t" meth " " p "\t" st; next }
    if (uaipo == 0 && p ~ /^\/api\/v1\/gl\/(corrections\/|journal-entries\/manual$|periods\/2026\/[0-9]+\/close$)/) { print "HATUA18?\t" $1 "\t" ip "\t" meth " " p "\t" st; next }
    print "KUANDIKA\t" $1 "\t" ip "\t" meth " " p "\t" st }' "$W/e.txt" > "$W/w.txt"
N=$(grep -c '^KUANDIKA' "$W/w.txt" || true)
H=$(grep -c '^HATUA18' "$W/w.txt" || true)
echo "maombi ya kuandika tangu dump: $N (ya hatua za 1.8 zenyewe, hayahesabiwi: $H)"
while IFS=$'\t' read -r k e ip mp st; do echo "  $k $(eat -d "@$e" '+%H:%M:%S') $ip $mp HTTP_$st"; done < <(head -n 40 "$W/w.txt")
[ "$(wc -l < "$W/w.txt")" -le 40 ] || echo "  ... (orodha imekatwa kwenye 40)"

echo "--- TAARIFA: MAOMBI YOTE TANGU FREEZE ($(eat -d "@$FZ" '+%H:%M') EAT) - si kinga ---"
echo "kwa METHOD:"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { print meth }' "$W/e.txt" | sort | uniq -c | sort -rn | sed 's/^/  /'
echo "kwa IP (maombi, ya mwisho EAT, METHOD):"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { c[ip]++; if ($1 > last[ip]) last[ip] = $1; m[ip, meth]++; ms[meth] = 1 }
  END { for (i in c) { s = ""; for (k in ms) if ((i, k) in m) s = s " " k "=" m[i, k]; print c[i] "\t" i "\t" last[i] "\t" s } }' "$W/e.txt" | sort -rn | head -n 15 \
  | while IFS=$'\t' read -r c ip e s; do echo "  $c $ip mwisho $(eat -d "@$e" '+%H:%M:%S')$s"; done
echo "kwa njia (METHOD njia, 15 za juu):"
awk -F'\t' -v fz="$FZ" "$FMT"'$1 + 0 >= fz + 0 { gsub(/\/[0-9a-fA-F-]{20,}/, "/UID", p); gsub(/\/[0-9]+(\/|$)/, "/N/", p); print meth " " p }' "$W/e.txt" | sort | uniq -c | sort -rn | head -n 15 | sed 's/^/  /'

echo NGINX_LOG_INAFANYA_KAZI
if [ "$N" = 0 ]; then echo MAANDISHI_TANGU_DUMP_HAKUNA; echo MAANDISHI_TANGU_FREEZE_HAKUNA; exit 0; fi
echo "SIYO: maombi $N ya kuandika baada ya dump mpya - dump haiwakilishi prod. SIMAMA: hakikisha hakuna kifaa kinachotumia LSMS (IP hapo juu), kisha anza 45a upya"
exit 1
