#!/usr/bin/env bash
# HATUA 71d (server) - KUSOMA TU, PROD (mmiliki 29/10 as A3 S-1): je, IP halisi ya mtumiaji (CF-Connecting-IP / X-Forwarded-For)
#   inafika backend? Hakuna restart, hakuna reload, hakuna kuandika, DB haiguswi.
#   1) config KAMILI ya nginx inayoendesha (`nginx -T`) ya huduma nginx na frontend-v3: server, location za /api,
#      proxy_pass, proxy_set_header, real_ip, underscores_in_headers, log_format, access_log
#   2) mtandao wa docker wa compose (subnet = trusted-proxies za backend) na IP ya kila container
#   3) access log ya nginx: IDADI tu ya mistari yenye XFF / CF (IP zenyewe hazichapishwi), na umbo la mstari mmoja
#      ambapo kila IP imefichwa (a.b.x.x)
#   4) mipangilio ya backend kuhusu proxy (server.forward-headers-strategy / RemoteIpValve) ndani ya jar
#   Hitimisho linatolewa kwenye ripoti kutoka log hii (config ya nginx ndiyo ushahidi; backend haibadilishwi).
set -u -o pipefail
cd ~/lsms-deployment || { echo "SIYO: ~/lsms-deployment haipo"; exit 1; }
fail() { echo "SIYO: $*"; exit 1; }
DC() { docker compose "$@" < /dev/null; }
echo "---HUDUMA---"
DC ps --format '{{.Service}} {{.Image}} {{.State}}' | sort
F=/tmp/71d-nginx
rm -rf "$F" && mkdir -p "$F" || fail "mkdir $F"
for s in nginx frontend-v3; do
  echo "---NGINX-T $s---"
  if DC exec -T "$s" nginx -T > "$F/$s.conf" 2> "$F/$s.err"; then
    echo "mistari ya config: $(wc -l < "$F/$s.conf")"
    grep -nE '^\s*(server_name|listen|location|proxy_pass|proxy_set_header|set_real_ip_from|real_ip_header|real_ip_recursive|underscores_in_headers|ignore_invalid_headers|log_format|access_log|include)\b|# configuration file' "$F/$s.conf" \
      | sed -E 's/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/&/g' | cut -c1-220
  else
    echo "nginx -T haikufanya kazi kwenye $s: $(head -c 300 "$F/$s.err")"
  fi
done
echo "---MTANDAO-WA-DOCKER---"
for c in $(DC ps -q); do
  docker inspect -f '{{.Name}} {{range $k, $v := .NetworkSettings.Networks}}{{$k}}={{$v.IPAddress}} {{end}}' "$c"
done
for n in $(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $(DC ps -q backend) 2>/dev/null); do
  echo "subnet ya $n: $(docker network inspect -f '{{range .IPAM.Config}}{{.Subnet}} {{end}}' "$n")"
done
echo "---ACCESS-LOG (idadi tu)---"
AL=""
for s in nginx frontend-v3; do
  for p in /var/log/nginx/access.log; do
    if DC exec -T "$s" sh -c "test -f $p && ! test -L $p" 2>/dev/null; then AL="$s:$p"; fi
  done
done
if [ -n "$AL" ]; then
  S=${AL%%:*}; P=${AL#*:}
  DC exec -T "$S" sh -c "tail -n 2000 $P" > "$F/access.txt" 2>/dev/null
  echo "faili: $AL, mistari iliyosomwa: $(wc -l < "$F/access.txt")"
else
  echo "access.log ni symlink ya stdout (kawaida ya image ya nginx) - inasomwa kutoka docker logs"
  DC logs --no-color --tail 2000 nginx 2>/dev/null | sed -E 's/^[^|]*\| //' > "$F/access.txt"
  echo "mistari ya nginx iliyosomwa: $(wc -l < "$F/access.txt")"
fi
API=$(grep -c '"[A-Z]* /api/' "$F/access.txt")
echo "maombi ya /api: $API"
IPS=$(grep '"[A-Z]* /api/' "$F/access.txt" | grep -oE '[0-9]{1,3}(\.[0-9]{1,3}){3}' | wc -l)
echo "IP (zote) kwenye mistari ya /api: $IPS"
echo "mistari ya /api yenye IP 2 au zaidi (remote + XFF/CF): $(grep '"[A-Z]* /api/' "$F/access.txt" | awk '{n=gsub(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,"&"); if (n>=2) c++} END{print c+0}')"
echo "umbo la mstari mmoja wa /api wenye IP 2+ (au wa mwisho), IP zimefichwa:"
{ grep '"[A-Z]* /api/' "$F/access.txt" | awk '{l=$0; n=gsub(/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/,"&"); if (n>=2) last=l} END{print last}' | grep .   || grep '"[A-Z]* /api/' "$F/access.txt" | tail -n 1; } | sed -E 's/([0-9]{1,3})\.([0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}/\1.\2.x.x/g; s/(Bearer )[A-Za-z0-9._-]+/\1***/g' | cut -c1-300
echo "---BACKEND-PROXY-CONFIG---"
BID=$(DC ps -q backend | head -n1)
docker exec "$BID" sh -c 'unzip -p /app/app.jar BOOT-INF/classes/application.properties BOOT-INF/classes/application-pro.properties 2>/dev/null' \
  | grep -nE 'forward-headers|remoteip|remote-ip|use-forward-headers|internal-proxies' || echo "hakuna forward-headers-strategy / remoteip ndani ya jar"
docker exec "$BID" printenv 2>/dev/null | grep -oE '^(SERVER_FORWARD_HEADERS_STRATEGY|SERVER_TOMCAT_REMOTEIP[A-Z_]*)' || echo "hakuna env ya forward-headers"
rm -rf "$F"
echo "---71d_SERVER_MWISHO---"
exit 0
