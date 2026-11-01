#!/usr/bin/env bash
# HATUA 71c (server) - dumps (mmiliki 29/10 as.0f, at). HAIGUSI DB yoyote (prod wala staging) wala ~/backups/daily.
#   evidence : kila faili la /tmp/71c/in/ lenye <jina>.sha256 (sha256 ya PC) -> B2 archive/evidence/ (--immutable),
#              kupakua tena, sha256 = ya PC. Ishara kwa kila faili: EVIDENCE_B2_SHA256 <jina> <sha256>
#   pakua    : dumps 2 mpya zaidi za B2 daily/ (lsms_*.dump) -> /tmp/71c/out/ + sha256 (PC inazichukua kwa scp)
set -u -o pipefail
D=${T71C_D:-/tmp/71c}  # T71C_D: majaribio ya fakes tu
BK=b2:elikom-lsms-backups
EV=$BK/archive/evidence
fail() { echo "SIYO: $*"; exit 1; }
case "${1:-}" in
hali)
  # (ay) KUSOMA TU, hakuna upload wala download ya dump: kwa kila evidence iliyoko B2, sha256 ya faili lake .sha256
  # (liliandikwa baada ya kupakia) na SHA1 ambayo B2 yenyewe inahifadhi kwa kila faili (rclone sha1sum, bila kupakua).
  L1=$(rclone sha1sum "$EV" 2>/dev/null) || L1=""
  for f in $(rclone lsf --files-only "$EV" 2>/dev/null | grep -v '\.sha256$'); do
    S=$(rclone cat "$EV/$f.sha256" 2>/dev/null | head -n1 | cut -d' ' -f1)
    H1=$(printf '%s\n' "$L1" | awk -v n="$f" '{p=$0; sub(/^[0-9a-f]+  /, "", p)} p == n {print $1; exit}')
    echo "B2_EV $f ${S:--} ${H1:--}"
  done
  echo "B2_EV_MWISHO"
  ;;
evidence)
  N=0
  mkdir -p "$D/rudi" || fail "mkdir rudi"
  for S in "$D"/in/*.sha256; do
    [ -e "$S" ] || continue
    F=$(basename "$S" .sha256)
    [ -s "$D/in/$F" ] || fail "$F haipo $D/in"
    H=$(sha256sum "$D/in/$F" | cut -d' ' -f1); HS=$(cut -d' ' -f1 "$S")
    [ "x$H" = "x$HS" ] || fail "$F iliyofika Contabo si sawa na sha256 ya PC"
    rclone copyto --immutable "$D/in/$F" "$EV/$F" || fail "kupakia $F kwenda $EV (au faili tofauti lipo tayari)"
    rclone copyto --immutable "$S" "$EV/$F.sha256" || fail "kupakia $F.sha256"
    rm -f "$D/rudi/$F"
    rclone copyto "$EV/$F" "$D/rudi/$F" || fail "kupakua $F tena kutoka $EV"
    H2=$(sha256sum "$D/rudi/$F" | cut -d' ' -f1)
    [ "x$H2" = "x$H" ] || fail "nakala ya B2 ya $F si sawa"
    rm -f "$D/rudi/$F"
    echo "EVIDENCE_B2_SHA256 $F $H2"
    N=$((N+1))
  done
  [ "$N" -gt 0 ] || fail "hakuna faili la evidence kwenye $D/in"
  rclone lsl "$EV" | cut -c1-200
  echo "EVIDENCE_IDADI $N"
  echo "EVIDENCE_B2_SAWA"
  ;;
pakua)
  L=$(rclone lsf --files-only "$BK/daily" 2>&1) || fail "rclone lsf daily: $L"
  N=$(printf '%s\n' "$L" | grep -E '^lsms_[0-9]{8}_[0-9]{4}\.dump$' | sort | tail -n 2)
  [ "$(printf '%s\n' "$N" | grep -c .)" = 2 ] || fail "B2 daily haina dumps 2 (lsms_YYYYMMDD_HHMM.dump)"
  rm -rf "$D/out" && mkdir -p "$D/out" || fail "mkdir out"
  for f in $N; do
    rclone copyto "$BK/daily/$f" "$D/out/$f" || fail "kupakua $f"
    [ -s "$D/out/$f" ] || fail "$f tupu"
    H=$(sha256sum "$D/out/$f" | cut -d' ' -f1)
    echo "DUMP_MPYA $f $(stat -c %s "$D/out/$f") $H"
  done
  echo "DUMPS_MPYA_2_SAWA"
  ;;
*) fail "tumia: evidence | pakua" ;;
esac
echo "---71c_SERVER_MWISHO---"
exit 0
