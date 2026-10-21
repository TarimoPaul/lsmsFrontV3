# ficha.awk - inaficha siri kwenye output ya Contabo KABLA haijatoka kwenye server.
# Haina siri ndani yake. Inatumwa /tmp/ficha-lsms.awk mwanzoni mwa hatua na kufutwa mwishoni.
#
# Matumizi (upande wa Contabo):
#   <amri> 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
#
# Inachoficha:
#   1) mstari wowote unaofanana kabisa na mstari wa .env (prod au staging)
#   2) mstari wowote wenye THAMANI ya siri kutoka .env (jina lenye PASS/SECRET/TOKEN/KEY/ACCOUNT/URL/DSN; si USER, ili "postgres" isifiche kila mstari)
#   3) KEY=thamani au KEY: thamani kwa kila jina lililopo kwenye .env
#   4) URL zenye user:pass@  ->  ://***:***@
#   5) jina lolote lenye pass/password/secret/token/key/account_id likifuatwa na = au :  (bila kujali herufi kubwa/ndogo)
# Mwishoni inaandika mstari mmoja wa muhtasari: idadi ya .env zilizosomwa na mistari iliyofichwa.

BEGIN {
  nfiles = split(envs, files, " ")
  nkeys = 0; nread = 0; hidden = 0
  for (i = 1; i <= nfiles; i++) {
    got = 0
    while ((getline line < files[i]) > 0) {
      got = 1
      sub(/\r$/, "", line)
      if (line ~ /^[ \t]*(#|$)/) continue
      envline[line] = 1
      eq = index(line, "=")
      if (eq > 1) {
        k = substr(line, 1, eq - 1)
        sub(/^[ \t]*export[ \t]+/, "", k)
        sub(/[ \t]+$/, "", k)
        v = substr(line, eq + 1)
        gsub(/^["']|["']$/, "", v)
        if (!(k in keys)) { keys[k] = 1; nkeys++ }
        if (toupper(k) ~ /PASS|SECRET|TOKEN|KEY|ACCOUNT|URL|DSN/ && length(v) >= 4) secret[v] = 1
      }
    }
    close(files[i])
    if (got) nread++
  }
}

{
  out = $0
  t = out
  sub(/\r$/, "", t)

  if (t in envline) { print "***MSTARI-WA-ENV-UMEFICHWA***"; hidden++; next }

  for (v in secret) {
    if (index(out, v)) { print "***MSTARI-UMEFICHWA (thamani ya siri ya .env)***"; hidden++; next }
  }

  changed = 0

  if (gsub(/:\/\/[^\/@ \t]+:[^\/@ \t]+@/, "://***:***@", out)) changed = 1

  for (k in keys) {
    p = index(out, k "=")
    if (!p) p = index(out, k ": ")
    if (p) { out = substr(out, 1, p + length(k)) "***FICHWA***"; changed = 1 }
  }

  lo = tolower(out)
  if (match(lo, /[a-z0-9_]*(pass|password|secret|token|key|account_id)[a-z0-9_]*[ \t]*[=:]/)) {
    out = substr(out, 1, RSTART + RLENGTH - 1) "***FICHWA***"
    changed = 1
  }

  if (changed) hidden++
  print out
}

END {
  print "[ficha] .env zilizosomwa: " nread " kati ya " nfiles ", majina: " nkeys ", mistari iliyofichwa/kubadilishwa: " hidden
}
