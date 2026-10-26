#!/usr/bin/env bash
# HATUA 45g (mmiliki 21/10 14:xx) - USHAHIDI WA admin@admin.com, KUSOMA TU. Inaendeshwa kwenye Contabo na 45g (scp -> /tmp; output -> ficha.awk).
# Matumizi: bash 45g-admin-ushahidi.sh <jina la dump mpya ya 45a, lsms_YYYYMMDD_HHMM.dump>
#  1) backend ya prod: profile inayotumika na root.email inayotoka kwenye mazingira (ROOT_EMAIL) - DataInitializer
#     (CommandLineRunner) inaweka is_root=true + ACTIVE kwa akaunti ya root.email kila boot.
#  2) mistari ya DataInitializer kwenye log ya backend ya saa 4 zilizopita (boot za 45d, 44, 45g): akaunti ipi ilikaguliwa/kuwashwa.
#  3) users kutoka DUMP ya 45a (si DB ya prod - kanuni ya 15/10): status na is_root ya admin@admin.com na root@system.com.
# Ishara (taarifa, haisimamishi): ADMIN_IS_ROOT_TRUE, ROOT_EMAIL_NI_ADMIN.
set -u -o pipefail
J="${1:-}"
echo "$J" | grep -qxE 'lsms_[0-9]{8}_[0-9]{4}\.dump' || { echo "SIYO: jina la dump si sahihi: [$J]"; exit 1; }
cd ~/lsms-deployment || exit 1

echo "--- backend ya prod: profile na root.email ---"
docker compose exec -T backend sh -c 'echo "PROFILE_YA_BACKEND [${SPRING_PROFILES_ACTIVE:-HAKUNA}]"; echo "ROOT_EMAIL_YA_BACKEND [${ROOT_EMAIL:-HAIJAWEKWA}]"' < /dev/null > /tmp/45g-env.txt 2>&1
cat /tmp/45g-env.txt
grep -qx 'ROOT_EMAIL_YA_BACKEND \[admin@admin.com\]' /tmp/45g-env.txt && echo ROOT_EMAIL_NI_ADMIN
rm -f /tmp/45g-env.txt

echo "--- DataInitializer kwenye log ya backend (saa 4 zilizopita) ---"
docker compose logs --no-color --since 4h backend 2>&1 | grep -E 'DataInitializer.*(ROOT|Email:|isRoot flag|Status:|Activating|Creating)' \
  | sed -E 's/^[^|]*\| //' | cut -c1-200 | tail -n 40

echo "--- users kutoka dump ya 45a $J (si DB ya prod) ---"
D="$HOME/backups/daily/$J"
[ -f "$D" ] || { echo "dump $J haipo kwenye ~/backups/daily"; exit 0; }
(cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore --data-only -t users -f - < "$D" 2>/dev/null) | awk -F'\t' '
  /^COPY public\.users / { s = $0; sub(/^[^(]*\(/, "", s); sub(/\).*/, "", s); n = split(s, c, ", "); for (i = 1; i <= n; i++) { gsub(/"/, "", c[i]); col[c[i]] = i }; inn = 1; next }
  inn && $0 == "\\." { inn = 0; next }
  inn { e = $col["email"]; if (e == "admin@admin.com" || e == "root@system.com") { r = $col["is_root"]; print "DUMP_USER " e " status " $col["status"] " is_root " r
        if (e == "admin@admin.com" && r == "t") print "ADMIN_IS_ROOT_TRUE" } }'
exit 0
