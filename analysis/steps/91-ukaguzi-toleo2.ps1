# HATUA 91 (mmiliki 12/11 fi/fj) - PROD, KUSOMA TU: ukaguzi wa mwisho wa toleo 2 (Jagger, Flyway, D, akaunti za pesa, mikopo)
# na hatua 90 (Flutter) katika mzunguko mmoja. Endesha:
#   91-ukaguzi-toleo2.cmd kagua    -> analysis\steps\91-kagua.log
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -ne 'kagua') { Write-Host 'MATUMIZI: 91-ukaguzi-toleo2.cmd kagua'; exit 2 }
$Log = Join-Path $Steps '91-kagua.log'
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 91 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '91-ukaguzi-toleo2.sh', '90-flutter-matumizi.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
& ssh @SshO -n contabo "bash $R/91-ukaguzi-toleo2.sh kagua 2>&1 | $F; bash $R/90-flutter-matumizi.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
exit 0
