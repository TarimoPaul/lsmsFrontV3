#!/usr/bin/env bash
# HATUA 56b (mmiliki 26/10 e) - KUSOMA TU: ufafanuzi wa ALAMA za 56 (HITIMISHO ORODHA) kabla ya uamuzi wa 55.
# Inaendeshwa kwenye Contabo na 56b-prod-admin-tukio-ufafanuzi.cmd (scp -> /tmp; output -> ficha.awk). Hakuna restart, hakuna
# kuandika; psql iko ndani ya READ ONLY; dump ya 45a inasomwa kwa pg_restore -f - (haigusi DB yoyote).
#  1) majina: role 72a69af7..., permission c4cd5cc6... (imeondolewa) na 5503a8cd... / aab047bd... (zimeongezwa) - kutoka prod NA
#     dump ya 21/10 11:53 (je, permissions hizo zilikuwepo kabla?); watumiaji wenye role hiyo.
#  2) nginx 21/10 11:53:14 -> 15:13:12 EAT: kila ombi la kuandika kwenye maeneo ya usimamizi (users, roles, permissions,
#     permission-config, business-settings, settings-approvals, gl periods/corrections, capital) - saa, IP, njia, HTTP, UA.
#  3) IP 51.158.200.198, 51.158.202.198, 41.59.11.110: KILA ombi lao kwenye log yote ya nginx (saa, method, njia, HTTP, UA kamili,
#     referer).
#  (26/10 e) Sehemu 4-6 zinaanzia 21/10 11:53:14 (dump), si 15:13: log ya 45g (45g-prod-b2-c-d.log:34-38) inaonyesha admin
#     ilikuwa ACTIVE tayari saa 12:57:05 na iliwashwa tena 13:57:12 na 15:13:12.
#  4) IP zote zisizo za mmiliki wala server/probe (41.59.106.20, 194.163.174.34, 172.18.0.x, 2a02:c207:*): ombi LOLOTE (hata GET)
#     kwenye maeneo ya usimamizi, 21/10 15:13:12 -> 26/10 09:20:46 - idadi kwa IP na mfano.
#  5) kila login (HTTP 200) ya 154.74.x, 41.59.11.110 (na 51.158.x) ndani ya kipindi hicho: maombi 12 ya kwanza ya IP hiyo ndani ya dak 20
#     baada ya login (njia + referer) na aina: MFANYAKAZI (hakuna eneo la usimamizi) au USIMAMIZI.
#  6) HITIMISHO: kila ALAMA ya 56 = INAELEWEKA <sababu> au HAIELEWEKI, kwa kanuni zilizoandikwa hapa chini (si kwa kukisia).
set -u -o pipefail
cd ~/lsms-deployment || exit 1
OWNER_IP=41.59.106.20
ROLE=72a69af7-1377-4f01-a52d-cbce3c06b029
P_OUT=c4cd5cc6-312d-4a4b-9aea-cc1aeb0c9d76
P_IN1=5503a8cd-2739-44a1-9c8f-6943a260bd0d
P_IN2=aab047bd-d829-4e7f-aed8-cc3b192b1a79
DUMP="$HOME/backups/daily/lsms_20261021_1153.dump"
DUMP_SHA=86371c35d8a224d94f9e57130ed5798c38ee8c4d6a19ecd7504de50e75baf5a5
D0=$(date -d '2026-10-21 11:53:14 +0300' +%s); A0=$(date -d '2026-10-21 15:13:12 +0300' +%s); A1=$(date -d '2026-10-26 09:20:46 +0300' +%s)
FOLLOW='51.158.200.198 51.158.202.198 41.59.11.110'
ALAMA_IPS='194.163.174.34 172.18.0.1 154.74.175.10 154.74.176.19 154.74.176.28 2a02:c207:2362:5284::1 154.74.176.5 154.74.176.18 51.158.202.198 51.158.200.198 41.59.11.110 154.74.176.21 154.74.176.11 154.74.175.25'
ADMIN_RE='^/api/(v1/)?(users|roles|permissions|permission-config|business-settings|settings-approvals|settings)(/|$)|^/api/v1/gl/(periods|corrections)(/|$)|^/api/(v1/)?capital'
W=$(mktemp -d /tmp/56b.XXXXXX) || exit 1
trap 'rm -rf "$W"' EXIT
: > "$W/hitimisho.txt"
hk() { echo "$*" | tee -a "$W/hitimisho.txt" > /dev/null; }
PSQL() { docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }
eat() { TZ=EAT-3 date "$@"; }
echo "SAA_56B $(eat '+%F %T') EAT"
echo "TAREHE_YA_56B $(eat +%Y%m%d)"

echo "---1-MAJINA-YA-ROLE-NA-RUHUSA---"
PSQL > "$W/s1.txt" 2>&1 <<SQL
SELECT 'READ_ONLY|' || current_setting('transaction_read_only');
SELECT 'ROLE|' || uid || '|' || name || '|' || coalesce(description, '-') || '|status ' || coalesce(status, '-') || '|updated_at ' || coalesce(updated_at::text, '-') FROM roles WHERE uid = '$ROLE';
SELECT 'RUHUSA|' || CASE uid WHEN '$P_OUT' THEN 'IMEONDOLEWA' ELSE 'IMEONGEZWA' END || '|' || uid || '|' || name || '|module ' || coalesce(module, '-')
       || '|kundi ' || coalesce(group_name, '-') || '|' || coalesce(description, '-') || '|created_at ' || created_at || '|updated_at ' || coalesce(updated_at::text, '-')
  FROM permissions WHERE uid IN ('$P_OUT', '$P_IN1', '$P_IN2') ORDER BY 1;
SELECT 'RUHUSA_INAYO_SASA|' || p.name FROM role_permissions rp JOIN permissions p ON p.uid = rp.permission_uid
 WHERE rp.role_uid = '$ROLE' AND p.uid IN ('$P_OUT', '$P_IN1', '$P_IN2') ORDER BY 1;
SELECT 'WATUMIAJI_WA_ROLE|' || u.email || '|' || u.status || '|is_root ' || u.is_root FROM user_roles ur JOIN users u ON u.uid = ur.user_uid WHERE ur.role_uid = '$ROLE' ORDER BY 1;
SQL
RC1=$?
sed 's/^/  /' "$W/s1.txt"
[ "$RC1" = 0 ] || { echo "SIYO: psql ya sehemu 1 imeshindwa (exit $RC1) - hakuna hitimisho"; exit 1; }
if [ -s "$DUMP" ] && [ "$(sha256sum "$DUMP" | cut -d' ' -f1)" = "$DUMP_SHA" ]; then
  echo "  dump ya 21/10 11:53 (sha256 sawa na 45a): permissions hizo zilikuwepo kabla?"
  docker compose exec -T postgres pg_restore --data-only -n public -t permissions -f - < "$DUMP" 2> /dev/null | tr -d '\r' > "$W/perm.sql"
  for u in "$P_OUT" "$P_IN1" "$P_IN2"; do
    L=$(grep -F "$u" "$W/perm.sql" | head -n1 | tr '\t' '|' | cut -c1-200)
    echo "  DUMP_PERMISSION|$u|${L:-HAIKUWEPO_KWENYE_DUMP}"
  done
else
  echo "  SIYO: dump ya 45a haipo au sha256 haifanani - sehemu hii ya dump haikufanyika"
fi

echo "---NGINX-YOTE-(tangu container ilipoanza)---"
NS=$(docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q nginx | head -n1)" 2>/dev/null)
echo "container ya nginx ilianza: $NS (UTC)"
docker compose logs --no-color nginx 2>/dev/null | sed -E 's/^[^|]*\| //' > "$W/n.txt"
echo "mistari: $(wc -l < "$W/n.txt")"
# TSV: epoch, saa EAT, ip, method, njia (bila ?), HTTP, referer, UA, njia kamili - saa inahesabiwa ndani ya awk (bila mktime)
awk -v re="$ADMIN_RE" '
  function dfc(y, m, d,   era, yoe, doy, doe) { y -= (m <= 2); era = int((y >= 0 ? y : y - 399) / 400); yoe = y - era * 400
    doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1; doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy; return era * 146097 + doe - 719468 }
  function civ(z,   era, doe, yoe, y, doy, mp, d, m) { z += 719468; era = int((z >= 0 ? z : z - 146096) / 146097); doe = z - era * 146097
    yoe = int((doe - int(doe / 1460) + int(doe / 36524) - int(doe / 146096)) / 365); y = yoe + era * 400; doy = doe - (365 * yoe + int(yoe / 4) - int(yoe / 100))
    mp = int((5 * doy + 2) / 153); d = doy - int((153 * mp + 2) / 5) + 1; m = mp + (mp < 10 ? 3 : -9); y += (m <= 2); return sprintf("%04d-%02d-%02d", y, m, d) }
  BEGIN { split("Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec", mn, " "); for (i = 1; i <= 12; i++) MON[mn[i]] = i }
  { n = split($0, q, "\""); if (n < 3) next
    if (!match($0, /\[[0-9][0-9]\/[A-Za-z]+\/[0-9]+:[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/)) next
    t = substr($0, RSTART + 1, RLENGTH - 1); split(t, a, "[/:]")
    e = dfc(a[3] + 0, MON[a[2]], a[1] + 0) * 86400 + a[4] * 3600 + a[5] * 60 + a[6]
    x = e + 10800; dd = int(x / 86400); s = x - dd * 86400
    when = civ(dd) " " sprintf("%02d:%02d:%02d", int(s / 3600), int((s % 3600) / 60), s % 60)
    split(q[2], rq, " "); m = rq[1]; full = rq[2]; p = full; sub(/\?.*/, "", p)
    st = q[3]; sub(/^ /, "", st); sub(/ .*/, "", st)
    ref = (n >= 5 ? q[4] : "-"); ua = (n >= 7 ? q[6] : "-")
    ip = $1; xf = q[n - 1]; if (xf ~ /^[0-9a-fA-F.:]+(, *[0-9a-fA-F.:]+)*$/) { sub(/,.*/, "", xf); ip = xf }
    gsub(/\t/, " ", ref); gsub(/\t/, " ", ua)
    # ADM (safu 10): eneo la usimamizi. Mmiliki 26/10 g: GET /api/v1/business-settings/resolved (ukurasa wa sales) na
    # GET /api/users (counting) ni za kurasa za kawaida za mfanyakazi - si usimamizi.
    adm = (p ~ re && !(m == "GET" && (p == "/api/v1/business-settings/resolved" || p == "/api/users" || p == "/api/users/"))) ? 1 : 0
    print e "\t" when "\t" ip "\t" m "\t" p "\t" st "\t" ref "\t" ua "\t" full "\t" adm }' "$W/n.txt" > "$W/t.tsv"
echo "maombi yaliyosomeka: $(wc -l < "$W/t.tsv"); ya kwanza: $(head -n1 "$W/t.tsv" | cut -f2); ya mwisho: $(tail -n1 "$W/t.tsv" | cut -f2)"
[ "$(head -n1 "$W/t.tsv" | cut -f1)" -le "$D0" ] 2> /dev/null || echo "  ONYO: log ya nginx haianzii kabla ya 21/10 11:53 - sehemu 2 haijakamilika"

echo "---2-NGINX-21/10-11:53-HADI-15:13-KUANDIKA-KWENYE-USIMAMIZI---"
awk -F'\t' -v a="$D0" -v b="$A0" -v re="$ADMIN_RE" '$1 >= a && $1 < b && $4 ~ /^(POST|PUT|PATCH|DELETE)$/ && $10 == 1 { print "  " $2 " | " $3 " | " $4 " " $9 " | HTTP_" $6 " | UA " substr($8, 1, 120) }' "$W/t.tsv" | tee "$W/s2.txt"
echo "  jumla: $(grep -c . "$W/s2.txt" || true)"

echo "---3-KILA-OMBI-LA-IP-ZA-KUFUATILIA---"
for ip in $FOLLOW; do
  awk -F'\t' -v ip="$ip" '$3 == ip' "$W/t.tsv" > "$W/ip.tsv"
  N=$(grep -c . "$W/ip.tsv" || true)
  echo "== IP $ip: maombi $N; ya kwanza $(head -n1 "$W/ip.tsv" | cut -f2); ya mwisho $(tail -n1 "$W/ip.tsv" | cut -f2)"
  echo "   User-Agent zake (idadi):"; cut -f8 "$W/ip.tsv" | sort | uniq -c | sort -rn | head -n 10 | sed 's/^/     /'
  echo "   maeneo ya usimamizi (yoyote, hata GET): $(awk -F'\t' -v re="$ADMIN_RE" '$10 == 1' "$W/ip.tsv" | grep -c . || true)"
  echo "   kila ombi (saa | method njia | HTTP | referer | UA), 600 ya kwanza:"
  head -n 600 "$W/ip.tsv" | awk -F'\t' '{ print "     " $2 " | " $4 " " substr($9, 1, 160) " | HTTP_" $6 " | ref " substr($7, 1, 120) " | UA " $8 }'
  if [ "$N" -gt 600 ]; then
    echo "     ... ($((N - 600)) zaidi hazikuchapishwa; muhtasari wa maombi YOTE kwa njia:)"
    awk -F'\t' 'BEGIN { h = "[0-9a-f]"; h4 = h h h h; UIDRE = h4 h4 "-" h4 "-" h4 "-" h4 "-" h4 h4 h4 } { p = $5; gsub(UIDRE, "UID", p); c[$4 " " p]++ } END { for (k in c) print c[k] "\t" k }' "$W/ip.tsv" | sort -rn | head -n 60 | sed 's/^/       /'
  fi
done

echo "---4-IP-NYINGINE-KWENYE-MAENEO-YA-USIMAMIZI (11:53 21/10 -> 09:20 26/10, hata GET; admin ilikuwa ACTIVE tayari 12:57:05 - 45g log:34-38)---"
awk -F'\t' -v a="$D0" -v b="$A1" -v re="$ADMIN_RE" -v o="$OWNER_IP" '$1 >= a && $1 <= b + 59 && $10 == 1 && $3 != o && $3 != "194.163.174.34" && $3 !~ /^172\.18\.0\./ && $3 !~ /^2a02:c207:/' "$W/t.tsv" > "$W/s4.tsv"
echo "  jumla ya maombi: $(grep -c . "$W/s4.tsv" || true)"
cut -f3 "$W/s4.tsv" | sort | uniq -c | sort -rn | while read -r c ip; do
  echo "  IP $ip: $c; mfano:"; awk -F'\t' -v ip="$ip" '$3 == ip' "$W/s4.tsv" | head -n 5 | awk -F'\t' '{ print "     " $2 " | " $4 " " substr($9, 1, 140) " | HTTP_" $6 " | ref " substr($7, 1, 100) }'
done

echo "---5-LOGIN-ZA-154.74.x-41.59.11.110-NA-51.158.x-NA-KURASA-ZA-KWANZA (dak 20 baada ya login)---"
awk -F'\t' -v a="$D0" -v b="$A1" '$1 >= a && $1 <= b + 59 && $4 == "POST" && $5 ~ /^\/api\/auth\/login\/?$/ && $6 == "200" && ($3 ~ /^154\.74\./ || $3 == "41.59.11.110" || $3 == "51.158.200.198" || $3 == "51.158.202.198")' "$W/t.tsv" > "$W/logins.tsv"
echo "  login: $(grep -c . "$W/logins.tsv" || true)"
: > "$W/aina.txt"
while IFS=$'\t' read -r e when ip m p st ref ua full adm; do
  awk -F'\t' -v ip="$ip" -v e="$e" '$3 == ip && $1 > e && $1 <= e + 1200 && $5 !~ /^\/api\/auth\/login/' "$W/t.tsv" > "$W/after.tsv"
  NA=$(awk -F'\t' -v re="$ADMIN_RE" '$10 == 1' "$W/after.tsv" | grep -c . || true)
  AINA=MFANYAKAZI; [ "${NA:-0}" = 0 ] || AINA=USIMAMIZI
  echo "$ip $AINA" >> "$W/aina.txt"
  echo "  == $when $ip login HTTP_$st | UA ${ua:0:110} | maombi dak 20: $(grep -c . "$W/after.tsv" || true) | usimamizi $NA | AINA $AINA"
  head -n 12 "$W/after.tsv" | awk -F'\t' 'BEGIN { h = "[0-9a-f]"; h4 = h h h h; UIDRE = h4 h4 "-" h4 "-" h4 "-" h4 "-" h4 h4 h4 } { p = $9; gsub(UIDRE, "UID", p); r = $7; sub(/^https?:\/\/[^\/]+/, "", r); print "       " substr($2, 12) " " $4 " " substr(p, 1, 110) " | ref " substr(r, 1, 70) }'
done < "$W/logins.tsv"

echo "---6-HITIMISHO-KWA-KILA-ALAMA-YA-56---"
echo "  Kanuni: (a) INAELEWEKA ikiwa ombi la nginx la saa hiyo ni la jaribio la hatua (UA lsms-18/...); (b) IP ya server/probe"
echo "  INAELEWEKA ikiwa login zake zote ni probe (UA lsms-18-probe / ?lsms18probe=) zenye HTTP 400; IP nyingine INAELEWEKA ikiwa"
echo "  HAINA ombi lolote kwenye maeneo ya usimamizi ndani ya kipindi na kila login yake ni AINA MFANYAKAZI (GET business-settings/resolved
  na GET /api/users ni kurasa za kawaida - mmiliki 26/10 g); (e) INAELEWEKA ikiwa"
echo "  kuna ombi la kuandika /api/v1/roles/$ROLE... kutoka IP ya mmiliki 11:53-15:13 na hakuna baada ya 15:13. Kingine = HAIELEWEKI."
# (a) admin@admin.com 22/10 19:42:48 (log ya backend): ombi la nginx la sek hiyo
AL=$(awk -F'\t' '$2 >= "2026-10-22 19:42:43" && $2 <= "2026-10-22 19:42:53" && $5 ~ /^\/api\/auth\/login/' "$W/t.tsv")
echo "$AL" | awk -F'\t' 'NF { print "  (a) nginx: " $2 " | " $3 " | " $4 " " $9 " | HTTP_" $6 " | UA " $8 }'
if [ -n "$AL" ] && echo "$AL" | cut -f8 | grep -q '^lsms-18/53-admin-login' && ! echo "$AL" | cut -f6 | grep -qx 200; then
  hk "ALAMA_A|INAELEWEKA|login iliyoshindwa ya admin@admin.com 22/10 19:42:48 ni jaribio la hatua 53 (UA lsms-18/53-admin-login.mjs, HTTP si 200)"
else hk "ALAMA_A|HAIELEWEKI|ombi la login ya admin@admin.com 22/10 19:42:48 halikutambuliwa kama jaribio la hatua"; fi
for ip in $ALAMA_IPS; do
  awk -F'\t' -v ip="$ip" -v a="$D0" -v b="$A1" '$3 == ip && $1 >= a && $1 <= b + 59' "$W/t.tsv" > "$W/w.tsv"
  LG=$(awk -F'\t' '$4 == "POST" && $5 ~ /^\/api\/auth\/login\/?$/' "$W/w.tsv")
  NADM=$(awk -F'\t' -v re="$ADMIN_RE" '$10 == 1' "$W/w.tsv" | grep -c . || true)
  case "$ip" in
    194.163.174.34|172.18.0.*|2a02:c207:*)
      NP=$(echo "$LG" | awk -F'\t' 'NF && !(($8 ~ /^lsms-18-probe/ || $9 ~ /lsms18probe=/) && $6 == "400")' | grep -c . || true)
      if [ -n "$LG" ] && [ "$NP" = 0 ] && [ "$NADM" = 0 ]; then hk "ALAMA_B|$ip|INAELEWEKA|login $(echo "$LG" | grep -c .) zote ni probe za hatua (UA lsms-18-probe, HTTP 400); usimamizi 0"
      else hk "ALAMA_B|$ip|HAIELEWEKI|login zisizo probe $NP; maombi ya usimamizi $NADM"; fi ;;
    *)
      NU=$(grep -c "^$ip USIMAMIZI$" "$W/aina.txt" || true)
      UAS=$(echo "$LG" | cut -f8 | sort -u | cut -c1-70 | paste -sd';' -)
      if [ -z "$LG" ]; then hk "ALAMA_B|$ip|HAIELEWEKI|hakuna login ya IP hii ndani ya kipindi kwenye log ya sasa - inapingana na 56"
      elif [ "$NADM" = 0 ] && [ "${NU:-0}" = 0 ]; then hk "ALAMA_B|$ip|INAELEWEKA|login $(echo "$LG" | grep -c .) bila ombi lolote la usimamizi (users/roles/permissions/settings/gl/capital) ndani ya kipindi - matumizi ya kawaida; UA: $UAS"
      else hk "ALAMA_B|$ip|HAIELEWEKI|maombi ya usimamizi $NADM; login za aina USIMAMIZI $NU; UA: $UAS"; fi ;;
  esac
done
RW1=$(awk -F'\t' -v a="$D0" -v b="$A0" -v o="$OWNER_IP" -v r="$ROLE" '$1 >= a && $1 < b && $3 == o && $4 ~ /^(POST|PUT|PATCH|DELETE)$/ && index($5, "/api/v1/roles/" r) == 1' "$W/t.tsv" | cut -f2,4,5 | tr '\t' ' ' | paste -sd';' -)
RW2=$(awk -F'\t' -v a="$A0" -v r="$ROLE" '$1 >= a && $4 ~ /^(POST|PUT|PATCH|DELETE)$/ && index($5, "/api/v1/roles/" r) == 1' "$W/t.tsv" | grep -c . || true)
if [ -n "$RW1" ] && [ "${RW2:-0}" = 0 ]; then hk "ALAMA_E|INAELEWEKA|role $ROLE ilibadilishwa na IP ya mmiliki kabla ya 15:13 ($RW1) - (b) ya §1.8 kwenye Roles UI; hakuna badiliko baada ya 15:13"
else hk "ALAMA_E|HAIELEWEKI|maombi ya mmiliki kwenye role hiyo 11:53-15:13: ${RW1:-hakuna}; maombi kwenye role hiyo baada ya 15:13: $RW2"; fi
sed 's/^/  /' "$W/hitimisho.txt"
NH=$(grep -c '|HAIELEWEKI|' "$W/hitimisho.txt" || true)
echo "HAIELEWEKI_JUMLA ${NH:-0}"
if [ "${NH:-0}" = 0 ]; then echo "HITIMISHO_56B ZOTE_ZINAELEWEKA"; else echo "HITIMISHO_56B KUNA_HAIELEWEKI"; fi
echo "55: inabaki IMEFUNGWA (kanuni yake: 56 = HAKUNA_USHAHIDI_WA_MATUMIZI pekee) mpaka mmiliki aamue."
echo "---USHAHIDI_56B_UMEKAMILIKA---"
exit 0
