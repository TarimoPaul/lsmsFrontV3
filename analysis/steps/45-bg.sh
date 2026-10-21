#!/usr/bin/env bash
# 45-bg.sh - KIENDESHAJI CHA NYUMA KWENYE CONTABO (mmiliki 21/10: PC inaweza kupoteza umeme/mtandao katikati ya hatua).
# Script ya server (deploy ya backend / V3, JWT) inaendeshwa na setsid + nohup: haitegemei ssh kubaki wazi.
# PC inaanzisha, kisha inafuatilia kwa ssh fupi (hali), na mwishoni inasoma log. Mantiki ya script yenyewe HAIBADILISHWI.
#   bash 45-bg.sh anza <id> <script> <arg>  -> BG_IMEANZA, au BG_IPO (kazi ya <id> ilishaanzishwa: HAIANZI mara ya pili)
#   bash 45-bg.sh hali <id>                 -> BG_HALI_HAKUNA | BG_HALI_INAENDESHA | BG_HALI_IMEISHA_<exit> | BG_HALI_IMEKUFA
#   bash 45-bg.sh log <id>                  -> log nzima ya kazi
# Kazi: ~/lsms-hatua/<id>/{run.sh, log, pid, imeanza}. mkdir ni atomic, kwa hiyo kazi moja haianzi mara mbili hata PC
# ikirudia hatua. IMEKUFA = hakuna ---BG_EXIT--- na mchakato haupo (mf. server ilizimwa) - binadamu aangalie.
set -u
D="$HOME/lsms-hatua"
cmd="${1:-}"; id="${2:-}"
[[ "$id" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "BG_KOSA: id si sahihi"; exit 2; }
dir="$D/$id"
case "$cmd" in
  anza)
    src="${3:-}"; arg="${4:-}"
    [ -s "$src" ] || { echo "BG_KOSA: script $src haipo"; exit 2; }
    [[ "$arg" =~ ^[A-Za-z0-9._-]*$ ]] || { echo "BG_KOSA: arg si sahihi"; exit 2; }
    command -v setsid > /dev/null && command -v nohup > /dev/null || { echo "BG_KOSA: setsid/nohup haipo"; exit 2; }
    mkdir -p "$D" || exit 2
    if ! mkdir "$dir" 2>/dev/null; then echo BG_IPO; exit 0; fi
    tr -d '\r' < "$src" > "$dir/run.sh" || exit 2
    date '+%F %T %Z' > "$dir/imeanza"
    echo "script sha256 $(sha256sum "$dir/run.sh" | cut -c1-12), arg $arg, imeanza $(cat "$dir/imeanza")" > "$dir/log"
    setsid nohup bash -c 'echo $$ > "$1/pid"; cd "$HOME"; bash "$1/run.sh" "$2"; echo "---BG_EXIT $?---"' bg "$dir" "$arg" >> "$dir/log" 2>&1 < /dev/null &
    for i in 1 2 3 4 5; do [ -s "$dir/pid" ] && break; sleep 1; done
    echo BG_IMEANZA ;;
  hali)
    if [ ! -d "$dir" ]; then echo BG_HALI_HAKUNA; exit 0; fi
    rc=$(grep -oE '^---BG_EXIT [0-9]+---$' "$dir/log" 2>/dev/null | tail -1 | tr -dc '0-9')
    if [ -n "$rc" ]; then echo "BG_HALI_IMEISHA_$rc"
    elif [ -s "$dir/pid" ] && kill -0 "$(cat "$dir/pid")" 2>/dev/null; then echo BG_HALI_INAENDESHA
    elif [ ! -s "$dir/pid" ] && [ $(( $(date +%s) - $(stat -c %Y "$dir") )) -lt 60 ]; then echo BG_HALI_INAENDESHA
    else echo BG_HALI_IMEKUFA; fi
    echo "mistari ya mwisho:"; tail -3 "$dir/log" 2>/dev/null | cut -c1-200 ;;
  log) cat "$dir/log" 2>/dev/null ;;
  *) echo "BG_KOSA: amri $cmd"; exit 2 ;;
esac
