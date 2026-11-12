# HATUA 74 (mmiliki 04/11 ct, 11/11 fa 6a) - PROD, BAADA ya toleo 2: ununuzi 18 (Grepa 02/10 75,000 + 17 wenye msambazaji 743,464; Chief fc: walilipwa siku hiyo hiyo) -> PAID, BILA journal (GL tayari sahihi). Endesha kupitia 74-umelipa-sasa.cmd:
#   74-umelipa-sasa.cmd kagua     PROD, kusoma tu -> analysis\steps\74-kagua.log  -> SOMA, kisha (STOP) uamue
#   74-umelipa-sasa.cmd andika    andika ANDIKA-74 -> SQL moja ndani ya kinga -> 74-andika.log (hakuna password)
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # (em): log isiwe na mojibake
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 74-umelipa-sasa.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '74-kagua.log' } else { '74-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 74 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '74-umelipa-sasa.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/74-umelipa-sasa.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host 'Umesoma 74-kagua.log? Andika ANDIKA-74 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-74') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-74'
$out = & ssh @SshO -n contabo "bash $R/74-umelipa-sasa.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$out | ForEach-Object { L $_ }
if ($out -match '^---74_MWISHO---$') { L '---74_OK---'; exit 0 } else { L '---74_IMESHINDWA---'; exit 1 }
