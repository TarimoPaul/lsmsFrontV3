# HATUA 76 (mmiliki 09/11 cz/da/de/df) - driver ya PC ya deploy 2.4.0 + 3.2.0. Endesha kupitia 76-deploy-240.cmd.
#
#   76-deploy-240.cmd build                  PC: docker login (token a, read/write - unaiandika wewe, haionekani) ->
#                                            deploy-backend.ps1 -Bump none -BuildOnly (2.4.0) -> deploy-v3.ps1 -Bump none -BuildOnly (3.2.0)
#   76-deploy-240.cmd login                  server: token (b) READ-ONLY -> jaribio -> docker logout/login --password-stdin
#   76-deploy-240.cmd staging refresh-db     staging: DB <- dump ya prod ya leo (02:00)
#   76-deploy-240.cmd <staging|prod> deploy  K1 kagua -> K2 backup -> K3 pull -> K4 env/compose -> K5 badili -> K6 smoke
#   76-deploy-240.cmd <staging|prod> rollback
#   76-deploy-240.cmd <staging|prod> hali    kusoma tu
#   76-deploy-240.cmd <staging|prod> fuata   fuatilia log ya kazi inayoendelea (baada ya mtandao kukatika)
#   76-deploy-240.cmd <staging|prod> smoke   KUSOMA TU: login + GET za kawaida (dg: baada ya deploy ya prod)
#   76-deploy-240.cmd staging kazi           INAANDIKA: sale cash+GL, kufuta sale, ununuzi+malipo ya msambazaji+GL, reco expense
#
# Deploy/rollback/refresh-db zinaendeshwa kwenye server kwa nohup: mtandao/umeme wa PC ukikatika KAZI INAENDELEA server.
# Endesha amri ileile tena (au 'fuata'): ikiwa bado inaendesha, inafuatilia tu; ikiwa ilisimama, inaendelea pale ilipoishia.
# Log: analysis\steps\76-<target>-<kitendo>.log (inaongezwa, haifutwi).
param([string]$A1 = '', [string]$A2 = '')
$ErrorActionPreference = 'Continue'   # PS 5.1: stderr ya ssh/docker isiwe kosa la kusimamisha; exit code zinakaguliwa kwa mkono
$Repo  = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3'
$Steps = Join-Path $Repo 'analysis\steps'
$Be    = 'D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms'
$SshO  = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R     = '~/lsms-240'

if ($A1 -in 'build', 'login') { $Target = 'pc'; $Action = $A1 } else { $Target = $A1; $Action = $A2 }
if ($A1 -notin 'build', 'login' -and ($Target -notin 'staging', 'prod' -or $Action -notin 'deploy', 'rollback', 'hali', 'fuata', 'refresh-db', 'kazi', 'smoke')) {
    Write-Host "MATUMIZI: 76-deploy-240.cmd build | login | <staging|prod> <deploy|rollback|hali|fuata> | staging refresh-db"; exit 2
}
if ($Action -in 'refresh-db', 'kazi' -and $Target -ne 'staging') { Write-Host "SIYO: $Action ni ya staging tu (inaandika)"; exit 2 }
$LogDir = if ($env:L76_LOGDIR) { $env:L76_LOGDIR } else { $Steps }   # L76_LOGDIR: majaribio tu
$Log = Join-Path $LogDir ("76-{0}-{1}.log" -f $Target, $Action)
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
function Remote([string]$cmd) { & ssh @SshO -n contabo $cmd 2>&1 | ForEach-Object { "$_" } }
L "===== 76 $Target $Action $(Get-Date -Format 'yyyy-MM-dd') ====="

# ── build (PC) ──────────────────────────────────────────────────────────────────────────────────────────────
if ($Action -eq 'build') {
    foreach ($p in @(@($Be, '2.4.0', '.backend-version'), @($Repo, '3.2.0', '.frontend-v3-version'))) {
        $br = (git -C $p[0] rev-parse --abbrev-ref HEAD).Trim()
        $v = (Get-Content (Join-Path $p[0] $p[2]) -Raw).Trim()
        L "$($p[0]): tawi $br, $($p[2]) = $v"
        if ($br -ne 'main') { L "SIYO: lazima iwe main"; exit 1 }
        if ($v -ne $p[1]) { L "SIYO: $($p[2]) si $($p[1])"; exit 1 }
    }
    L 'docker login ya PC: andika token (a) READ/WRITE kwenye "Password:" (haionekani).'
    & docker login -u chiefmaster
    if ($LASTEXITCODE -ne 0) { L 'SIYO: docker login imeshindwa'; exit 1 }
    # (gd usafi 9) build output -> the log as UTF-8 (Add-Content -Encoding UTF8): Tee-Object -Append of PowerShell 5.1 wrote
    # UTF-16LE into this UTF-8 log (76-pc-build.log 09/11: 594,542 NUL bytes of 1,191,146).
    L 'BACKEND 2.4.0: deploy-backend.ps1 -Bump none -BuildOnly (mvn + majaribio + docker build + push)'
    Push-Location $Be
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\deploy-backend.ps1 -Bump none -BuildOnly *>&1 | ForEach-Object { "$_" } | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { L "SIYO: build ya backend imeshindwa (exit $rc)"; exit 1 }
    L 'V3 3.2.0: deploy-v3.ps1 -Bump none -BuildOnly'
    Push-Location $Repo
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\deploy-v3.ps1 -Bump none -BuildOnly *>&1 | ForEach-Object { "$_" } | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { L "SIYO: build ya V3 imeshindwa (exit $rc)"; exit 1 }
    foreach ($i in 'chiefmaster/my-lsms-backend:2.4.0', 'chiefmaster/lsms-frontend-v3:3.2.0') {
        & docker manifest inspect $i *> $null
        if ($LASTEXITCODE -ne 0) { L "SIYO: $i haipo Docker Hub"; exit 1 }
        L "Docker Hub SAWA: $i"
    }
    L '---76_BUILD_OK--- Sasa endesha push-yote (backend main + V3 main), kisha 76-deploy-240.cmd login'
    exit 0
}

# ── nakili script kwenda server ─────────────────────────────────────────────────────────────────────────────
Remote "mkdir -p $R/logs && chmod 700 $R" | Out-Null
foreach ($f in '76-deploy-240.sh', '76-login.sh', '76-kazi.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa (mtandao?)"; exit 1 }
}
L 'script zimenakiliwa server (~/lsms-240)'
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
    $out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/76-kazi.sh $Target $Action 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
    $plain = $null
    $out | ForEach-Object { L $_ }
    if ($out -match '^---76K_MWISHO---$') { L "---76_OK--- $Action"; exit 0 } else { L "---76_IMESHINDWA--- $Action"; exit 1 }
}

# ── hali (kusoma tu, moja kwa moja) ─────────────────────────────────────────────────────────────────────────
if ($Action -eq 'hali') {
    Remote "bash $R/76-deploy-240.sh $Target hali 2>&1 | $F" | ForEach-Object { L $_ }
    exit 0
}

# ── deploy / rollback / refresh-db: nohup kwenye server + kufuatilia log ────────────────────────────────────
$RLog = "$R/logs/$Target-$Action.log"
$busy = (Remote "[ -e $R/$Target/lock ] && ! flock -n $R/$Target/lock true && echo INAENDESHA || echo HURU") -join ''
if ($Action -eq 'fuata' -or $busy -match 'INAENDESHA') {
    if ($Action -ne 'fuata') { L "76 $Target tayari inaendesha kwenye server - nafuatilia tu (sianzishi nyingine)" }
    $lr = (Remote "ls -1t $R/logs/$Target-*.log 2>/dev/null | head -n1") -join ''
    if (-not $lr) { L 'hakuna log ya kufuatilia'; exit 1 }
    $RLog = $lr
} else {
    Remote "echo '===== $(Get-Date -Format s) =====' >> $RLog; setsid nohup bash $R/76-deploy-240.sh $Target $Action >> $RLog 2>&1 < /dev/null & echo ANZISHWA" | ForEach-Object { L $_ }
}
L "nafuatilia $RLog (mtandao ukikatika: endesha '76-deploy-240.cmd $Target fuata')"
$seen = 0; $fails = 0; $t0 = Get-Date
$start = (Remote "grep -n '^===== ' $RLog | tail -n1 | cut -d: -f1") -join ''
if ($start -match '^\d+$') { $seen = [int]$start }
while ($true) {
    Start-Sleep -Seconds 5
    $lines = @(& ssh @SshO -n contabo "tail -n +$($seen + 1) $RLog | $F | grep -v '^\[ficha\]' || true" 2>$null)   # bila mistari mipya grep=1: siyo kosa la ssh (ssh yenyewe = 255)
    if ($LASTEXITCODE -ne 0) {
        $fails++; L "ssh imeshindwa ($fails) - kazi inaendelea server; najaribu tena"
        if ($fails -ge 60) { L "mtandao umekatika muda mrefu. Endesha baadaye: 76-deploy-240.cmd $Target fuata"; exit 1 }
        continue
    }
    $fails = 0
    foreach ($x in $lines) { L $x; $seen++ }
    if ($lines -match '^---76_MWISHO---$')     { L "---76_OK--- ($([int]((Get-Date) - $t0).TotalSeconds)s)"; exit 0 }
    if ($lines -match '^---76_IMESHINDWA---$') { L '---76_IMESHINDWA--- soma log hapo juu'; exit 1 }
    if ($lines -match '^---76_INAENDESHA---$') { L '76 nyingine inaendesha - tumia: fuata'; exit 1 }
    if (((Get-Date) - $t0).TotalMinutes -gt 30) { L "dakika 30 bila mwisho - endesha: 76-deploy-240.cmd $Target fuata"; exit 1 }
}
