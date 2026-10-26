#!/usr/bin/env bash
# HATUA 57b (mmiliki 26/10) - .env YA STAGING kabla ya 2.2.72: ROOT_EMAIL=root@system.com, mstari wa ROOT_PASSWORD uondolewe.
# INAANDIKA .env YA STAGING TU (~/lsms-staging/.env); prod (~/lsms-deployment) haiguswi. HAKUNA restart (57c ndiyo inawasha).
# Inaendeshwa kwenye Contabo na 57b-staging-env.cmd (scp -> /tmp; output -> ficha.awk). Thamani za siri hazichapishwi.
# Hali:
#   MPYA  : ROOT_EMAIL ni mstari 1 (si root@system.com), ROOT_PASSWORD 0 au 1, hakuna backup -> backup .env.bak.kabla-ya-2272
#           (cp -p), kisha ROOT_EMAIL=root@system.com na mistari ya ROOT_PASSWORD inaondolewa.
#   RUDIA : ROOT_EMAIL=root@system.com (mstari 1), ROOT_PASSWORD 0, backup ipo -> inathibitisha tu.
#   Kingine chochote -> HALI_57B_KATAA (hakuna kinachobadilishwa).
# Uthibitisho: tofauti kati ya backup na .env ni mistari ya ROOT_EMAIL / ROOT_PASSWORD TU; staging DB ina root@system.com
#   root ACTIVE (hali-root.sh staging SASA) - vinginevyo 2.2.72 ingeanza bila root inayoweza kuingia.
set -u -o pipefail
cd ~/lsms-staging || { echo "HALI_57B_KATAA ~/lsms-staging haipo"; exit 1; }
[ -s /tmp/hali-root.sh ] || { echo "HALI_57B_KATAA /tmp/hali-root.sh haipo"; exit 1; }
B=.env.bak.kabla-ya-2272
ne() { grep -c "^$1=" "$2" 2>/dev/null; }
ve() { sed -n "s/^$1=//p" "$2" | head -n1; }

echo "---HALI-YA-ENV-KABLA (majina na idadi; thamani ya ROOT_EMAIL si siri)---"
echo "mistari ROOT_EMAIL $(ne ROOT_EMAIL .env), ROOT_PASSWORD $(ne ROOT_PASSWORD .env), BACKEND_VERSION $(ne BACKEND_VERSION .env)"
echo "ROOT_EMAIL_YA_ENV_YA_STAGING [$(ve ROOT_EMAIL .env)]"
echo "backup $B: $([ -e "$B" ] && echo IPO || echo HAIPO)"

if [ "$(ne ROOT_EMAIL .env)" = 1 ] && [ "$(ve ROOT_EMAIL .env)" != root@system.com ] && [ "$(ne ROOT_PASSWORD .env)" -le 1 ] && [ ! -e "$B" ]; then
  cp -p .env "$B" || { echo "HALI_57B_KATAA backup imeshindwa"; exit 1; }
  sed -i -e 's/^ROOT_EMAIL=.*/ROOT_EMAIL=root@system.com/' -e '/^ROOT_PASSWORD=/d' .env || { echo "HALI_57B_KATAA sed imeshindwa"; exit 1; }
  echo "HALI_57B_MPYA"
elif [ "$(ne ROOT_EMAIL .env)" = 1 ] && [ "$(ve ROOT_EMAIL .env)" = root@system.com ] && [ "$(ne ROOT_PASSWORD .env)" = 0 ] && [ -f "$B" ]; then
  echo "HALI_57B_RUDIA"
else
  echo "HALI_57B_KATAA hali ya .env haitarajiwi - hakuna kilichobadilishwa"
  exit 1
fi

echo "---UTHIBITISHO---"
T=$(diff "$B" .env | grep -c '^[<>]')
X=$(diff "$B" .env | grep '^[<>]' | grep -vcE '^[<>] ROOT_(EMAIL|PASSWORD)=')
echo "mistari inayotofautiana na backup $T; isiyo ya ROOT_EMAIL/ROOT_PASSWORD $X"
[ "x$X" = x0 ] || { echo "SIYO: .env ina tofauti nyingine na backup"; exit 1; }
[ "$(ne ROOT_EMAIL .env)" = 1 ] && [ "$(ve ROOT_EMAIL .env)" = root@system.com ] || { echo "SIYO: ROOT_EMAIL si root@system.com"; exit 1; }
[ "$(ne ROOT_PASSWORD .env)" = 0 ] || { echo "SIYO: ROOT_PASSWORD bado ipo"; exit 1; }
echo "ROOT_EMAIL_YA_ENV_YA_STAGING [$(ve ROOT_EMAIL .env)]"
echo "---HALI-YA-ROOT-STAGING-SASA---"
H=$(bash /tmp/hali-root.sh staging SASA) || { echo "SIYO: hali-root.sh staging imeshindwa (postgres ya staging inawaka?)"; exit 1; }
echo "$H"
echo "$H" | grep -q '^HALI_ROOT|SASA|staging|root@system.com|[0-9][0-9]*|ACTIVE|is_root true|' || { echo "SIYO: root@system.com si root ACTIVE kwenye DB ya staging"; exit 1; }
echo "ENV_STAGING_2272_SAWA"
exit 0
