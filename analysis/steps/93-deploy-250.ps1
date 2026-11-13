# HATUA 93 (mmiliki 12/11 ge; kama 76) - driver ya PC ya deploy 2.5.0 + 3.3.0. Endesha kupitia 93-deploy-250.cmd.
#
#   93-deploy-250.cmd build <be> <v3>        (gg 3) <be>/<v3> = commit/tag ILIYOTAJWA ya main (mf. 983b202 7b6fda2). Lazima iwe kwenye
#                                            main, code ya HEAD = code yake, tree safi (V3: nje ya analysis/ - commit za analysis
#                                            baadaye haziathiri). SHA kamili -> log + 93-build-commits.txt.
#                                            PC: docker login (token a, read/write - unaiandika wewe, haionekani) ->
#                                            deploy-backend.ps1 -Bump none -BuildOnly (2.5.0) -> deploy-v3.ps1 -Bump none -BuildOnly (3.3.0)
#   93-deploy-250.cmd login                  server: token (b) READ-ONLY -> jaribio -> docker logout/login --password-stdin
#   93-deploy-250.cmd staging refresh-db     staging: DB <- dump ya prod ya leo (02:00)
#   93-deploy-250.cmd <staging|prod> deploy  K1 kagua -> K2 backup -> K3 pull -> K4 env/compose -> K5 badili -> K6 smoke
#   93-deploy-250.cmd <staging|prod> rollback
#   93-deploy-250.cmd <staging|prod> hali    kusoma tu
#   93-deploy-250.cmd <staging|prod> fuata   fuatilia log ya kazi inayoendelea (baada ya mtandao kukatika)
#   93-deploy-250.cmd <staging|prod> smoke   KUSOMA TU: login + GET za kawaida (dg: baada ya deploy ya prod)
#   93-deploy-250.cmd staging kazi           INAANDIKA: sale cash+GL, kufuta sale, ununuzi+malipo ya msambazaji+GL, reco expense
#   93-deploy-250.cmd <staging|prod> marejesho   (gy) KAGUA (kusoma tu) -> 🛑 andika ANDIKA -> ANDIKA: marejesho =true kwenye
#                                            .env + compose (backup kwanza); inaanza kufanya kazi kwenye deploy inayofuata
#
# Deploy/rollback/refresh-db zinaendeshwa kwenye server kwa nohup: mtandao/umeme wa PC ukikatika KAZI INAENDELEA server.
# Endesha amri ileile tena (au 'fuata'): ikiwa bado inaendesha, inafuatilia tu; ikiwa ilisimama, inaendelea pale ilipoishia.
# Log: analysis\steps\93-<target>-<kitendo>.log (inaongezwa, haifutwi).
param([string]$A1 = '', [string]$A2 = '', [string]$A3 = '')
$ErrorActionPreference = 'Continue'   # PS 5.1: stderr ya ssh/docker isiwe kosa la kusimamisha; exit code zinakaguliwa kwa mkono
$Repo  = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3'
$Steps = Join-Path $Repo 'analysis\steps'
$Be    = 'D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms'
$SshO  = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R     = '~/lsms-250'

if ($A1 -in 'build', 'login') { $Target = 'pc'; $Action = $A1 } else { $Target = $A1; $Action = $A2 }
if ($A1 -notin 'build', 'login' -and ($Target -notin 'staging', 'prod' -or $Action -notin 'deploy', 'rollback', 'hali', 'fuata', 'refresh-db', 'kazi', 'smoke', 'marejesho')) {
    Write-Host "MATUMIZI: 93-deploy-250.cmd build <be-commit> <v3-commit> | login | <staging|prod> <deploy|rollback|hali|fuata> | staging refresh-db"; exit 2
}
if ($Action -in 'refresh-db', 'kazi' -and $Target -ne 'staging') { Write-Host "SIYO: $Action ni ya staging tu (inaandika)"; exit 2 }
$LogDir = if ($env:L93_LOGDIR) { $env:L93_LOGDIR } else { $Steps }   # L93_LOGDIR: majaribio tu
$Log = Join-Path $LogDir ("93-{0}-{1}.log" -f $Target, $Action)
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
function Remote([string]$cmd) { & ssh @SshO -n contabo $cmd 2>&1 | ForEach-Object { "$_" } }
L "===== 93 $Target $Action $(Get-Date -Format 'yyyy-MM-dd') ====="

# ── build (PC) ──────────────────────────────────────────────────────────────────────────────────────────────
if ($Action -eq 'build') {
    # (gg 3) build ya commit/tag ILIYOTAJWA, si "main ya sasa": commit lazima iwe HEAD ya main na tree safi (build inasoma tree).
    if (-not $A2 -or -not $A3) { L 'SIYO: taja commit/tag: 93-deploy-250.cmd build <be-commit> <v3-commit>'; exit 2 }
    $built = @()
    foreach ($p in @(@($Be, '2.5.0', '.backend-version', $A2, @()), @($Repo, '3.3.0', '.frontend-v3-version', $A3, @('--', '.', ':!analysis')))) {
        $want = (git -C $p[0] rev-parse --verify --quiet "$($p[3])^{commit}")
        if (-not $want) { L "SIYO: $($p[3]) si commit/tag ya $($p[0])"; exit 1 }
        $want = $want.Trim()
        $head = (git -C $p[0] rev-parse HEAD).Trim()
        $main = (git -C $p[0] rev-parse main).Trim()
        $br = (git -C $p[0] rev-parse --abbrev-ref HEAD).Trim()
        $dirty = @(git -C $p[0] status --porcelain --untracked-files=no @($p[4]))
        $v = (Get-Content (Join-Path $p[0] $p[2]) -Raw).Trim()
        L "$($p[0]): imetajwa $($p[3]) = $want | HEAD $head | tawi $br | $($p[2]) = $v | mabadiliko $($dirty.Count)"
        if ($br -ne 'main' -or $head -ne $main) { L "SIYO: lazima iwe tawi main"; exit 1 }
        & git -C $p[0] merge-base --is-ancestor $want $head
        if ($LASTEXITCODE -ne 0) { L "SIYO: $($p[3]) haiko kwenye main"; exit 1 }
        & git -C $p[0] diff --quiet $want $head @($p[4])
        if ($LASTEXITCODE -ne 0) { L "SIYO: code ya main sasa si sawa na $($p[3]) (build inasoma tree) - taja commit ya HEAD"; exit 1 }
        if ($dirty.Count -ne 0) { L "SIYO: tree si safi: $($dirty -join '; ')"; exit 1 }
        if ($v -ne $p[1]) { L "SIYO: $($p[2]) si $($p[1])"; exit 1 }
        $built += "$($p[1]) $want"
    }
    $bc = Join-Path $LogDir '93-build-commits.txt'
    Add-Content -Path $bc -Value ("{0} backend {1} | v3 {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $built[0], $built[1]) -Encoding UTF8
    L "COMMIT ZA BUILD: backend $($built[0]) | v3 $($built[1]) (-> $bc; tag v2.5.0/v3.3.0 baada ya prod)"
    L 'docker login ya PC: andika token (a) READ/WRITE kwenye "Password:" (haionekani).'
    & docker login -u chiefmaster
    if ($LASTEXITCODE -ne 0) { L 'SIYO: docker login imeshindwa'; exit 1 }
    # (gd usafi 9) build output -> the log as UTF-8 (Add-Content -Encoding UTF8): Tee-Object -Append of PowerShell 5.1 wrote
    # UTF-16LE into this UTF-8 log (76-pc-build.log 09/11: 594,542 NUL bytes of 1,191,146).
    L 'BACKEND 2.5.0: deploy-backend.ps1 -Bump none -BuildOnly (mvn + majaribio + docker build + push)'
    Push-Location $Be
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\deploy-backend.ps1 -Bump none -BuildOnly *>&1 | ForEach-Object { "$_" } | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { L "SIYO: build ya backend imeshindwa (exit $rc)"; exit 1 }
    L 'V3 3.3.0: deploy-v3.ps1 -Bump none -BuildOnly'
    Push-Location $Repo
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\deploy-v3.ps1 -Bump none -BuildOnly *>&1 | ForEach-Object { "$_" } | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { L "SIYO: build ya V3 imeshindwa (exit $rc)"; exit 1 }
    foreach ($i in 'chiefmaster/my-lsms-backend:2.5.0', 'chiefmaster/lsms-frontend-v3:3.3.0') {
        & docker manifest inspect $i *> $null
        if ($LASTEXITCODE -ne 0) { L "SIYO: $i haipo Docker Hub"; exit 1 }
        L "Docker Hub SAWA: $i"
    }
    L "---93_BUILD_OK--- backend $($built[0]) | v3 $($built[1]). Sasa push-yote (main zote mbili), kisha 93-deploy-250.cmd login"
    exit 0
}

# ── nakili script kwenda server ─────────────────────────────────────────────────────────────────────────────
Remote "mkdir -p $R/logs && chmod 700 $R" | Out-Null
foreach ($f in '93-deploy-250.sh', '76-login.sh', '93-kazi.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa (mtandao?)"; exit 1 }
}
L 'script zimenakiliwa server (~/lsms-250)'
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"

# ── login (server, token b) ─────────────────────────────────────────────────────────────────────────────────
if ($Action -eq 'login') {
    $sec = Read-Host -AsSecureString 'Token (b) READ-ONLY ya server (haionekani)'
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
    $out = $plain | & ssh @SshO contabo "bash $R/76-login.sh 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
    $plain = $null
    $out | ForEach-Object { L $_ }
    if (-not ($out -match '^---76L_OK---$')) { L 'SIYO: login haikukamilika'; exit 1 }
    exit 0
}

# ── kazi / smoke (moja kwa moja; email + password kwa stdin, haziandikwi popote) ────────────────────────────
if ($Action -in 'kazi', 'smoke') {
    $email = Read-Host 'Email ya CEO (mtumiaji wa jaribio)'
    $sec = Read-Host -AsSecureString 'Password yake (haionekani)'
    $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
    $out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/93-kazi.sh $Target $Action 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
    $plain = $null
    $out | ForEach-Object { L $_ }
    if ($out -match '^---93K_MWISHO---$') { L "---93_OK--- $Action"; exit 0 } else { L "---93_IMESHINDWA--- $Action"; exit 1 }
}

# ── marejesho (gy): KAGUA -> 🛑 -> ANDIKA, moja kwa moja ─────────────────────────────────────────────────────
if ($Action -eq 'marejesho') {
    $k = @(Remote "bash $R/93-deploy-250.sh $Target marejesho kagua 2>&1 | $F")
    $k | ForEach-Object { L $_ }
    if ($k -match 'MAREJESHO_TAYARI') { L "---93_OK--- marejesho tayari =true"; exit 0 }
    if (-not ($k -match 'MAREJESHO_KAGUA_OK') -or -not ($k -match '^---93_MWISHO---$')) { L '---93_IMESHINDWA--- KAGUA (hakuna kilichoandikwa)'; exit 1 }
    $j = Read-Host "STOP: andika ANDIKA kuweka marejesho =true kwenye $Target (kingine chochote = simama)"
    if ($j -cne 'ANDIKA') { L "IMESIMAMISHWA na mmiliki - hakuna kilichoandikwa"; exit 1 }
    L 'mmiliki ameandika: ANDIKA'
    $a = @(Remote "bash $R/93-deploy-250.sh $Target marejesho andika 2>&1 | $F")
    $a | ForEach-Object { L $_ }
    if (($a -match 'MAREJESHO_IMEANDIKWA') -and ($a -match '^---93_MWISHO---$')) { L "---93_OK--- marejesho; sasa: 93-deploy-250.cmd $Target deploy"; exit 0 }
    L '---93_IMESHINDWA--- marejesho (soma log; backup imerudishwa kama ilivyoandikwa)'; exit 1
}

# ── hali (kusoma tu, moja kwa moja) ─────────────────────────────────────────────────────────────────────────
if ($Action -eq 'hali') {
    Remote "bash $R/93-deploy-250.sh $Target hali 2>&1 | $F" | ForEach-Object { L $_ }
    exit 0
}

# ── deploy / rollback / refresh-db: nohup kwenye server + kufuatilia log ────────────────────────────────────
$RLog = "$R/logs/$Target-$Action.log"
$busy = (Remote "[ -e $R/$Target/lock ] && ! flock -n $R/$Target/lock true && echo INAENDESHA || echo HURU") -join ''
if ($Action -eq 'fuata' -or $busy -match 'INAENDESHA') {
    if ($Action -ne 'fuata') { L "93 $Target tayari inaendesha kwenye server - nafuatilia tu (sianzishi nyingine)" }
    $lr = (Remote "ls -1t $R/logs/$Target-*.log 2>/dev/null | head -n1") -join ''
    if (-not $lr) { L 'hakuna log ya kufuatilia'; exit 1 }
    $RLog = $lr
} else {
    Remote "echo '===== $(Get-Date -Format s) =====' >> $RLog; setsid nohup bash $R/93-deploy-250.sh $Target $Action >> $RLog 2>&1 < /dev/null & echo ANZISHWA" | ForEach-Object { L $_ }
}
L "nafuatilia $RLog (mtandao ukikatika: endesha '93-deploy-250.cmd $Target fuata')"
$seen = 0; $fails = 0; $t0 = Get-Date
$start = (Remote "grep -n '^===== ' $RLog | tail -n1 | cut -d: -f1") -join ''
if ($start -match '^\d+$') { $seen = [int]$start }
while ($true) {
    Start-Sleep -Seconds 5
    $lines = @(& ssh @SshO -n contabo "tail -n +$($seen + 1) $RLog | $F | grep -v '^\[ficha\]' || true" 2>$null)   # bila mistari mipya grep=1: siyo kosa la ssh (ssh yenyewe = 255)
    if ($LASTEXITCODE -ne 0) {
        $fails++; L "ssh imeshindwa ($fails) - kazi inaendelea server; najaribu tena"
        if ($fails -ge 60) { L "mtandao umekatika muda mrefu. Endesha baadaye: 93-deploy-250.cmd $Target fuata"; exit 1 }
        continue
    }
    $fails = 0
    foreach ($x in $lines) { L $x; $seen++ }
    if ($lines -match '^---93_MWISHO---$')     { L "---93_OK--- ($([int]((Get-Date) - $t0).TotalSeconds)s)"; exit 0 }
    if ($lines -match '^---93_IMESHINDWA---$') { L '---93_IMESHINDWA--- soma log hapo juu'; exit 1 }
    if ($lines -match '^---93_INAENDESHA---$') { L '93 nyingine inaendesha - tumia: fuata'; exit 1 }
    if (((Get-Date) - $t0).TotalMinutes -gt 30) { L "dakika 30 bila mwisho - endesha: 93-deploy-250.cmd $Target fuata"; exit 1 }
}
