#!/usr/bin/env bash
# HATUA 73 (mmiliki 03/11 cp), upande wa Contabo, KUSOMA TU: hash za siri za PROD kwa kinga ya pg-checks/c2-check.
# Kwa kila mstari wa ~/lsms-deployment/.env ambao jina lake lina PASS/SECRET/TOKEN/KEY: "HASH <jina> <prefix>",
# prefix = hex 8 za KWANZA za sha256("lsms-kinga-v1:" + thamani) (mmiliki cq: hash nzima haitoki server).
# Thamani yenyewe HAITOKI kamwe; output inapita pia kwenye ficha.awk.
set -u
f=/home/chief/lsms-deployment/.env
[ -r "$f" ] || { echo "SIYO_ENV_HAISOMEKI"; exit 1; }
n=0
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%$'\r'}
  case "$line" in ''|\#*) continue ;; esac
  case "$line" in *=*) ;; *) continue ;; esac
  k=${line%%=*}; v=${line#*=}
  k=${k#export }; k=$(printf '%s' "$k" | tr -d ' \t')
  printf '%s' "$k" | grep -Eiq 'PASS|SECRET|TOKEN|KEY' || continue
  case "$v" in \"*\") v=${v#\"}; v=${v%\"} ;; \'*\') v=${v#\'}; v=${v%\'} ;; esac
  [ -n "$v" ] || continue
  h=$(printf 'lsms-kinga-v1:%s' "$v" | sha256sum | cut -c1-8)
  echo "HASH $k $h"
  n=$((n+1))
done < "$f"
echo "HASH_IDADI $n"
echo "---73_SERVER_MWISHO---"
