#!/usr/bin/env bash
# HATUA 45k (mmiliki 21/10) - KUSOMA TU: maombi ya kuandika (POST/PUT/PATCH/DELETE kwenye /api) kwenye nginx ya prod ya 21/10
# 06:00-08:30 EAT (kabla ya freeze) - kwa endpoint, User-Agent, IP, saa kwa saa na muda wa kati (sek). Lengo: kutambua maombi
# yanayojiendesha bila mtumiaji (heartbeat, kifaa, refresh) ili 45-maandishi.sh iyaweke kwenye RUHUSA (endpoint mahususi tu).
# Pia: ROOT_EMAIL ya staging (.env + container) - kusoma tu. Hakuna kinachoandikwa; output inapita ficha.awk.
# Matumizi: bash 45k-nginx-kujiendesha.sh <YYYY-MM-DD>
set -u -o pipefail
D="${1:-}"; echo "$D" | grep -qxE '[0-9]{4}-[0-9]{2}-[0-9]{2}' || { echo "SIYO: tarehe si sahihi"; exit 1; }
cd ~/lsms-deployment || exit 1
FROM=$(date -u -d "$D 06:00 +0300" +%Y-%m-%dT%H:%M:%SZ); UNTIL=$(date -u -d "$D 08:30 +0300" +%Y-%m-%dT%H:%M:%SZ)
echo "nginx: $FROM hadi $UNTIL (06:00-08:30 EAT)"
L=$(mktemp) || exit 1; trap 'rm -f "$L"' EXIT
docker compose logs --no-color --since "$FROM" --until "$UNTIL" nginx 2>/dev/null | sed -E 's/^[^|]*\| //' > "$L"
echo "mistari: $(wc -l < "$L")"
eat() { TZ=Africa/Dar_es_Salaam date "$@"; }
awk '
  function ep(t,   d, r) { return t }
  { n = split($0, q, "\""); if (n < 3) next
    split(q[2], rq, " "); m = rq[1]; p = rq[2]; sub(/\?.*/, "", p)
    if (m !~ /^(POST|PUT|PATCH|DELETE)$/ || p !~ /^\/api\//) next
    if (!match($0, /\[[0-9][0-9]\/[A-Za-z]+\/[0-9]+:[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/)) next
    t = substr($0, RSTART + 1, RLENGTH - 1); split(t, tt, ":"); hh = tt[2]; mm = tt[3]; ss = tt[4]
    sec = hh * 3600 + mm * 60 + ss
    ua = (n >= 7 ? q[6] : "-"); gsub(/[0-9]+(\.[0-9]+)+/, "N", ua); ua = substr(ua, 1, 40)
    ip = $1; x = (n >= 3 ? q[n - 1] : ""); if (x ~ /^[0-9a-fA-F.:]+(, *[0-9a-fA-F.:]+)*$/) { sub(/,.*/, "", x); ip = x }
    gsub(/\/[0-9a-fA-F-]{20,}/, "/UID", p); gsub(/\/[0-9]+(\/|$)/, "/N/", p); sub(/\/$/, "", p)
    k = m " " p
    c[k]++; h[k, hh]++; hrs[hh] = 1; u[k] = ua; ips[k, ip] = 1
    if (k in last) { g = sec - last[k]; if (g < 0) g += 86400; gaps[k] = gaps[k] " " g } last[k] = sec
  }
  END {
    for (k in c) {
      ni = 0; for (z in ips) { split(z, zz, SUBSEP); if (zz[1] == k) ni++ }
      s = ""; for (hh in hrs) s = s " " hh "h=" (h[k, hh] + 0)
      ng = split(gaps[k], gg, " "); med = "-"
      if (ng > 0) { for (i = 1; i <= ng; i++) for (j = i + 1; j <= ng; j++) if (gg[j] + 0 < gg[i] + 0) { t = gg[i]; gg[i] = gg[j]; gg[j] = t }; med = gg[int((ng + 1) / 2)] }
      printf "%5d %-58s IP %d, muda wa kati %ss,%s, UA %s\n", c[k], k, ni, med, s, u[k]
    }
  }' "$L" | sort -rn > /tmp/45k-out.txt
# saa za log ni UTC (+0000): 03h=06 EAT, 04h=07 EAT, 05h=08 EAT
echo "--- MAOMBI YA KUANDIKA 06:00-08:30 EAT (kwa endpoint; saa ni UTC: 03h=06, 04h=07, 05h=08 EAT) ---"
cat /tmp/45k-out.txt; [ -s /tmp/45k-out.txt ] || echo "  hakuna"
echo "--- WAGOMBEA WA KUJIENDESHA (>= 6 kwa saa 2.5, kila saa, IP 1-2) ---"
awk '{ k = $2 " " $3; if ($1 >= 6 && $0 !~ /h=0/ && $5 + 0 <= 2) print "  KUJIENDESHA? " $0 }' /tmp/45k-out.txt
rm -f /tmp/45k-out.txt
echo "--- login / refresh (hayahesabiwi tayari) ---"
grep -cE '"POST /api/auth/login' "$L" | sed 's/^/  login: /'; grep -cE '"POST /api/auth/refresh' "$L" | sed 's/^/  refresh: /'
echo "--- STAGING: ROOT_EMAIL (kusoma tu) ---"
echo "  .env ya staging: mistari ROOT_EMAIL $(grep -c '^ROOT_EMAIL=' ~/lsms-staging/.env 2>/dev/null || true), ROOT_PASSWORD $(grep -c '^ROOT_PASSWORD=' ~/lsms-staging/.env 2>/dev/null || true)"
echo "  thamani ya .env ya staging: [$(sed -n 's/^ROOT_EMAIL=//p' ~/lsms-staging/.env 2>/dev/null | head -n1)]"
(cd ~/lsms-staging && docker compose -p lsms-staging exec -T backend sh -c 'echo "  ROOT_EMAIL_YA_BACKEND_YA_STAGING [${ROOT_EMAIL:-HAIJAWEKWA}]"' < /dev/null 2>/dev/null) || echo "  backend ya staging haiendeshi (au haijibu)"
echo ---OK---
