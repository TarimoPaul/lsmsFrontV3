#!/usr/bin/env bash
# HATUA 71 (server) - nakala ya zip ya usafi kwenda B2 archive/ (mmiliki 29/10 am.4, ao Q-3). HAIGUSI prod wala staging:
#   haisomi DB, haiwashi/haizimi container. Inasoma ~/backup-lsms.sh na lifecycle ya bucket ili kuhakikisha archive/
#   haifutwi na backup ya kila usiku. Faili zinapakiwa kwa --immutable (haziandiki juu ya faili lililopo lenye tofauti).
#   Kisha zip inapakuliwa tena kutoka B2 na sha256 yake inalinganishwa. /tmp/71 inafutwa na 71-usafi.cmd.
set -u -o pipefail
D=${T71_D:-/tmp/71}  # T71_D: majaribio ya fakes tu
Z=analysis-archive-2026-10
BK=b2:elikom-lsms-backups
B2=$BK/archive/2026-10
fail() { echo "SIYO: $*"; exit 1; }
cd "$D" || fail "$D haipo"
for f in $Z.zip $Z.zip.sha256 $Z.txt; do [ -s "$f" ] || fail "$f haipo Contabo"; done
H=$(sha256sum $Z.zip | cut -d' ' -f1)
HS=$(cut -d' ' -f1 $Z.zip.sha256)
[ "x$H" = "x$HS" ] || fail "zip iliyofika Contabo si sawa na .sha256"
echo "CONTABO_SHA256_SAWA"

echo "---HATARI-YA-ARCHIVE-KUFUTWA---"
[ -f "$HOME/backup-lsms.sh" ] || fail "~/backup-lsms.sh haipo - siwezi kuthibitisha kwamba haifuti archive/"
RX='rclone[^|;#]*[[:space:]](delete|purge|sync|cleanup|deletefile|move|moveto|rmdirs)[[:space:]]'
grep -nE "$RX" "$HOME/backup-lsms.sh" | cut -c1-200
N=$(grep -E "$RX" "$HOME/backup-lsms.sh" | grep -vc 'daily')
echo "amri za rclone zinazofuta nje ya daily/: $N"
[ "x$N" = "x0" ] || fail "backup-lsms.sh ina amri ya rclone inayoweza kufuta nje ya daily/ - archive/ haiko salama. Nionyeshe mistari hapo juu"
LC=$(rclone backend lifecycle "$BK" 2>&1); LRC=$?
echo "$LC" | head -n 40 | cut -c1-200
if [ "x$LRC" != "x0" ]; then
  echo "B2_LIFECYCLE_HAIJULIKANI (rclone backend lifecycle exit $LRC) - zip iko pia D:\\LSMS-ARCHIVE"
elif command -v python3 > /dev/null; then
  HAT=$(printf '%s' "$LC" | python3 -c '
import json, sys
try:
    rules = json.load(sys.stdin) or []
except ValueError:
    print("HAIJULIKANI"); sys.exit(0)
t = "archive/2026-10/x"
print(sum(1 for r in rules if t.startswith(r.get("fileNamePrefix") or "") and r.get("daysFromUploadingToHiding")))')
  echo "lifecycle zinazoficha archive/: $HAT"
  [ "x$HAT" = "x0" ] || fail "lifecycle ya bucket inaweza kuficha/kufuta archive/ ($HAT)"
else
  echo "B2_LIFECYCLE_HAIJULIKANI (hakuna python3)"
fi
echo "B2_HAKUNA_HATARI"

echo "---KUPAKIA-B2 ($B2)---"
for f in $Z.zip $Z.zip.sha256 $Z.txt; do
  rclone copyto --immutable "$D/$f" "$B2/$f" || fail "kupakia $f kumeshindwa (au faili tofauti lipo tayari B2)"
done
rclone lsl "$B2" | cut -c1-200
echo "---KUPAKUA-TENA-NA-KULINGANISHA---"
mkdir -p "$D/rudi" || fail "mkdir rudi"
rclone copyto "$B2/$Z.zip" "$D/rudi/$Z.zip" || fail "kupakua kutoka B2 kumeshindwa"
H2=$(sha256sum "$D/rudi/$Z.zip" | cut -d' ' -f1)
[ "x$H2" = "x$H" ] || fail "nakala ya B2 si sawa na zip"
echo "B2_SHA256 $H2"
echo "B2_SHA256_SAWA"
echo "---71_B2_MWISHO---"
exit 0
