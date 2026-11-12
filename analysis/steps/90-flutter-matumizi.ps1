# HATUA 90 (mmiliki 11/11 fa 9) - PROD, KUSOMA TU: je, Flutter bado inatumika (logins / matukio ya siku 30 kwa user agent)? Endesha:
#   90-flutter-matumizi.cmd kagua    -> analysis\steps\90-kagua.log
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # (em): log isiwe na mojibake
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -ne 'kagua') { Write-Host 'MATUMIZI: 90-flutter-matumizi.cmd kagua'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '90-kagua.log' } else { '90-kagua.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 90 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '90-flutter-matumizi.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/90-flutter-matumizi.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
