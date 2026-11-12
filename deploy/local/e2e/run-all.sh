#!/usr/bin/env bash
# Playwright checks of V3 (owner 31/10 bg, 01/11 bi): part of the staging gate - ALL must pass on the FINAL build.
# Needs: backend Docker-local up (Lsms deploy/local/local.sh up <image>, 127.0.0.1:18090) and this build up
# (deploy/local/v3-local.sh build && up, 127.0.0.1:4300/v3). The checks change the throw-away local copy only.
#
#   deploy/local/e2e/run-all.sh        -> one MUHTASARI line per script, then E2E_OK n/n or E2E_IMESHINDWA (exit 1)
#   E2E_ONLY='regex' / E2E_SKIP='regex' (ge): run a subset (the gate runs 2 phases: switches as on prod, then switches ON)
#
# Playwright: PLAYWRIGHT_NODE_PATH, else the npx cache (npx playwright@1.61.1 was used on 31/10).
set -u
H=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$H/out"
NP=${PLAYWRIGHT_NODE_PATH:-$(ls -d "$LOCALAPPDATA"/npm-cache/_npx/*/node_modules 2>/dev/null | while read -r d; do [ -d "$d/playwright" ] && echo "$d"; done | head -1)}
[ -n "$NP" ] && [ -d "$NP/playwright" ] || { echo "E2E_IMESHINDWA: playwright haipo (weka PLAYWRIGHT_NODE_PATH)"; exit 1; }
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4300/v3/ | grep -q 200 || { echo "E2E_IMESHINDWA: V3 local haijibu 127.0.0.1:4300/v3"; exit 1; }
curl -s -o /dev/null http://127.0.0.1:18090/api/auth/login || { echo "E2E_IMESHINDWA: backend local haijibu 127.0.0.1:18090"; exit 1; }

ok=0; n=0; bad=()
for s in "$H"/*_e2e.cjs; do
  name=$(basename "$s" .cjs)
  [ -n "${E2E_ONLY:-}" ] && ! [[ "$name" =~ $E2E_ONLY ]] && continue
  [ -n "${E2E_SKIP:-}" ] && [[ "$name" =~ $E2E_SKIP ]] && continue
  n=$((n+1))
  NODE_PATH="$NP" node "$s" > "$H/out/$name.log" 2>&1; rc=$?
  p=$(grep -c '^PASS ' "$H/out/$name.log"); f=$(grep -c '^FAIL ' "$H/out/$name.log")
  echo "MUHTASARI $name: PASS $p, FAIL $f, exit $rc"
  if [ "$rc" = 0 ] && [ "$f" = 0 ] && [ "$p" -gt 0 ]; then ok=$((ok+1)); else bad+=("$name"); fi
done
if [ ${#bad[@]} -eq 0 ]; then echo "E2E_OK $ok/$n"; else echo "E2E_IMESHINDWA ${bad[*]} (log: deploy/local/e2e/out/)"; exit 1; fi
