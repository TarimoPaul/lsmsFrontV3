# HATUA 83 (mmiliki 10/11 eh) - PROD: Dr 1000 159,000 / Cr 3900 (manunuzi ya vipimo hayakulipwa). Endesha kupitia 83-vipimo-cash.cmd:
#   83-vipimo-cash.cmd kagua     PROD, kusoma tu -> analysis\steps\83-kagua.log  -> SOMA, kisha (STOP) uamue
#   83-vipimo-cash.cmd andika    andika ANDIKA-83 -> email + password ya CEO (haionekani) -> journal -> 83-andika.log
# KABLA ya cutover D tu. Ikiwa journal ya 83 ipo tayari, hakuna kinachoandikwa.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 83-vipimo-cash.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '83-kagua.log' } else { '83-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 83 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '83-vipimo-cash.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/83-vipimo-cash.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host 'Umesoma 83-kagua.log? Andika ANDIKA-83 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-83') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-83'
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/83-vipimo-cash.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---83_MWISHO---$') { L '---83_OK---'; exit 0 } else { L '---83_IMESHINDWA---'; exit 1 }
