# HATUA 89 (mmiliki 11/11 ew/ex) - PROD, BAADA ya toleo 2: alama "nje ya ripoti ya uendeshaji" kwa REN-MON Nov 5D9DD844 + TAX-MON Nov B4F8EA66 + OPE-MON Jan 2939F6DE (88) (GL haiguswi). Endesha kupitia 89-nje-ya-ripoti.cmd:
#   89-nje-ya-ripoti.cmd kagua     PROD, kusoma tu -> analysis\steps\89-kagua.log  -> SOMA, kisha (STOP) uamue
#   89-nje-ya-ripoti.cmd andika    andika ANDIKA-89 -> email + password ya CEO (haionekani) -> alama (API) -> 89-andika.log
# Inahitaji V145 (toleo 2) prod. Row iliyowekwa alama tayari inarukwa.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # (em): log isiwe na mojibake
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 89-nje-ya-ripoti.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '89-kagua.log' } else { '89-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 89 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '89-nje-ya-ripoti.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/89-nje-ya-ripoti.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host 'Umesoma 89-kagua.log? Andika ANDIKA-89 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-89') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-89'
$email = Read-Host 'Email ya mwenye CAPITAL_APPROVE (CEO)'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/89-nje-ya-ripoti.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---89_MWISHO---$') { L '---89_OK---'; exit 0 } else { L '---89_IMESHINDWA---'; exit 1 }
