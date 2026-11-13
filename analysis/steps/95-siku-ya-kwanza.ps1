# HATUA 95 (Chief 13/11 hi 4-5) - PROD, KUSOMA TU: ripoti ya siku ya kwanza baada ya 2.5.0 / 3.3.0. Endesha kupitia 95-siku-ya-kwanza.cmd:
#   95-siku-ya-kwanza.cmd               siku D = leo (EAT)   -> analysis\steps\95-siku-ya-kwanza.log
#   95-siku-ya-kwanza.cmd 2026-11-14    siku D iliyotajwa
#   Hakuna STOP: hakuna kinachoandikwa (SELECT, docker logs, printenv tu). Hatua 74 inaendeshwa kwa 'kagua' tu.
param([string]$D = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-250'
if ($D -and $D -notmatch '^\d{4}-\d{2}-\d{2}$') { Write-Host 'MATUMIZI: 95-siku-ya-kwanza.cmd [YYYY-MM-DD]'; exit 2 }
$Log = Join-Path $Steps '95-siku-ya-kwanza.log'
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 95 siku ya kwanza $(Get-Date -Format 'yyyy-MM-dd') D=$(if ($D) { $D } else { 'leo' }) ====="
& ssh @SshO -n contabo "mkdir -p $R" 2>&1 | Out-Null
foreach ($f in '95-siku-ya-kwanza.sh', '74-umelipa-sasa.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
$out = & ssh @SshO -n contabo "bash $R/95-siku-ya-kwanza.sh $D 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$out | ForEach-Object { L $_ }
if ($out -match '^---95_MWISHO---$') { L '---95_OK---'; exit 0 } else { L '---95_IMESHINDWA---'; exit 1 }
