#!/usr/bin/env bash
# HATUA 76-login (mmiliki cz/de): Docker Hub kwenye server kwa token ya READ-ONLY (b).
# Token inasomwa kutoka stdin (haiandikwi kwenye faili wala output). Kwanza INAJARIBIWA kwenye config ya muda
# (docker --config <tmp> login + pull ya image iliyopo); ikifanya kazi tu: docker logout -> docker login --password-stdin.
# Ikishindwa: login ya sasa ya server haiguswi. Prod na staging zinatumia login hii moja (mtumiaji chief).
set -uo pipefail
U=chiefmaster
TEST_IMG=chiefmaster/lsms-frontend-v3:3.1.11
IFS= read -r TOKEN || true
TOKEN=${TOKEN%$'\r'}
[ -n "$TOKEN" ] || { echo "SIYO: token tupu"; echo "---76L_IMESHINDWA---"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
printf '%s' "$TOKEN" | docker --config "$T" login -u "$U" --password-stdin >/dev/null 2>"$T/err" \
  || { echo "SIYO: token imekataliwa na Docker Hub: $(head -c 200 "$T/err")"; echo "login ya server HAIJABADILIKA"; echo "---76L_IMESHINDWA---"; exit 1; }
docker --config "$T" pull -q "$TEST_IMG" >/dev/null 2>"$T/err" \
  || { echo "SIYO: token haiwezi kupull $TEST_IMG: $(head -c 200 "$T/err")"; echo "login ya server HAIJABADILIKA"; echo "---76L_IMESHINDWA---"; exit 1; }
echo "token ya majaribio SAWA (login + pull $TEST_IMG kwenye config ya muda)"
docker logout >/dev/null 2>&1; echo "docker logout SAWA"
printf '%s' "$TOKEN" | docker login -u "$U" --password-stdin >/dev/null 2>"$T/err" \
  || { echo "SIYO: login halisi imeshindwa: $(head -c 200 "$T/err") - server IKO BILA LOGIN, endesha 76-login tena"; echo "---76L_IMESHINDWA---"; exit 1; }
docker pull -q "$TEST_IMG" >/dev/null || { echo "SIYO: pull baada ya login imeshindwa"; echo "---76L_IMESHINDWA---"; exit 1; }
unset TOKEN
echo "docker login (token read-only) SAWA; pull $TEST_IMG SAWA"
echo "---76L_OK---"
