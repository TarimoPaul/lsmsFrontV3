# HATUA 96 (mmiliki 13/11 hq/hr) - V3 PEKEE: frontend-v3 3.3.0 -> 3.3.1 (KUPIMA kwenye orodha ya POS), prod MOJA KWA MOJA
# (Chief hr: bila staging). Backend 2.5.0 HAIGUSWI. Endesha kupitia 96-deploy-v3.cmd:
#   96-deploy-v3.cmd build <v3-commit>   PC: commit lazima iwe HEAD ya main, tree safi, .frontend-v3-version = 3.3.1 ->
#                                         deploy-v3.ps1 -Bump none -BuildOnly (docker build + push) -> Docker Hub SAWA
#   96-deploy-v3.cmd prod hali           kusoma tu
#   96-deploy-v3.cmd prod deploy         STOP: andika DEPLOY-331 (duka halina wateja wengi) -> K1 kagua (backend 2.5.0, 3.3.0 IPO kwa
#                                         rollback, AMRI YA ROLLBACK kwenye log KABLA ya kubadili) -> K2 pull + version.json -> K3
#                                         frontend-v3 tu -> HEALTH (3.3.1, backend 2.5.0 container ileile); ikishindwa -> ROLLBACK
#   96-deploy-v3.cmd prod rollback       STOP: andika ROLLBACK -> frontend-v3 3.3.0
# Log: analysis\steps\96-<prod|staging|pc>-<kitendo>.log
param([string]$A1 = '', [string]$A2 = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$Repo = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-331'
$NewV3 = '3.3.1'
if ($A1 -eq 'build') { $Target = 'pc'; $Action = 'build' } else { $Target = $A1; $Action = $A2 }
if (-not (($Action -eq 'build') -or (($Target -in 'prod', 'staging') -and ($Action -in 'hali', 'deploy', 'rollback')))) {
    Write-Host 'MATUMIZI: 96-deploy-v3.cmd build <v3-commit> | 96-deploy-v3.cmd <prod|staging> <hali|deploy|rollback>'; exit 2
}
$Log = Join-Path $Steps "96-$Target-$Action.log"
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 96 $Target $Action $(Get-Date -Format 'yyyy-MM-dd') ====="

if ($Action -eq 'build') {
    $c = $A2
    if (-not $c) { L 'SIYO: taja commit: 96-deploy-v3.cmd build <v3-commit>'; exit 2 }
    $want = (git -C $Repo rev-parse --verify --quiet "$c^{commit}")
    if (-not $want) { L "SIYO: $c si commit"; exit 1 }
    $want = $want.Trim(); $head = (git -C $Repo rev-parse HEAD).Trim(); $br = (git -C $Repo rev-parse --abbrev-ref HEAD).Trim()
    $dirty = @(git -C $Repo status --porcelain --untracked-files=no -- . ':!analysis')
    $v = (Get-Content (Join-Path $Repo '.frontend-v3-version') -Raw).Trim()
    L "imetajwa $c = $want | HEAD $head | tawi $br | .frontend-v3-version = $v | mabadiliko $($dirty.Count)"
    if ($br -ne 'main') { L 'SIYO: lazima iwe tawi main'; exit 1 }
    & git -C $Repo diff --quiet $want $head -- . ':!analysis'
    if ($LASTEXITCODE -ne 0) { L "SIYO: code ya HEAD si sawa na $c (build inasoma tree)"; exit 1 }
    if ($dirty.Count -ne 0) { L "SIYO: tree si safi: $($dirty -join '; ')"; exit 1 }
    if ($v -ne $NewV3) { L "SIYO: .frontend-v3-version si $NewV3"; exit 1 }
    Add-Content -Path (Join-Path $Steps '96-build-commits.txt') -Value ("{0} v3 {1} {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $NewV3, $want) -Encoding UTF8
    L 'docker login ya PC: andika token (a) READ/WRITE kwenye "Password:" (haionekani).'
    & docker login -u chiefmaster
    if ($LASTEXITCODE -ne 0) { L 'SIYO: docker login imeshindwa'; exit 1 }
    L "V3 ${NewV3}: deploy-v3.ps1 -Bump none -BuildOnly"
    Push-Location $Repo
    try { & powershell -NoProfile -ExecutionPolicy Bypass -File .\deploy\deploy-v3.ps1 -Bump none -BuildOnly *>&1 | ForEach-Object { "$_" } | ForEach-Object { Write-Host $_; Add-Content -Path $Log -Value $_ -Encoding UTF8 }; $rc = $LASTEXITCODE } finally { Pop-Location }
    if ($rc -ne 0) { L "SIYO: build ya V3 imeshindwa (exit $rc)"; exit 1 }
    & docker manifest inspect "chiefmaster/lsms-frontend-v3:$NewV3" *> $null
    if ($LASTEXITCODE -ne 0) { L "SIYO: chiefmaster/lsms-frontend-v3:$NewV3 haipo Docker Hub"; exit 1 }
    L "Docker Hub SAWA: chiefmaster/lsms-frontend-v3:$NewV3"
    L "---96_BUILD_OK--- v3 $NewV3 $want. Sasa push-yote (V3 main), kisha 96-deploy-v3.cmd prod deploy"
    exit 0
}

if ($Action -eq 'deploy') {
    $ans = Read-Host "STOP: duka halina wateja wengi sasa? Andika DEPLOY-331 kuweka frontend-v3 $NewV3 kwenye $Target (kingine = simama)"
    if ($ans -cne 'DEPLOY-331') { L 'Umesimamisha - hakuna kilichobadilishwa.'; exit 2 }
    L 'mmiliki ameandika DEPLOY-331'
}
if ($Action -eq 'rollback') {
    $ans = Read-Host "STOP: andika ROLLBACK kurudisha frontend-v3 3.3.0 kwenye $Target (kingine = simama)"
    if ($ans -cne 'ROLLBACK') { L 'Umesimamisha - hakuna kilichobadilishwa.'; exit 2 }
    L 'mmiliki ameandika ROLLBACK'
}
& ssh @SshO -n contabo "mkdir -p $R && chmod 700 $R" 2>&1 | Out-Null
foreach ($f in '96-deploy-v3.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
$out = & ssh @SshO -n contabo "bash $R/96-deploy-v3.sh $Target $Action 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$out | ForEach-Object { L $_ }
if ($out -match '^---96_MWISHO---$') { L "---96_OK--- $Action"; exit 0 } else { L "---96_IMESHINDWA--- $Action"; exit 1 }
