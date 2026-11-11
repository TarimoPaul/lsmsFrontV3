# HATUA 88 (mmiliki 11/11 ex/ey) - PROD: Dr 1000 200,000 / Cr 6200 (Frame Jan mara ya 3, row 2939F6DE) - ANDIKA TU baada ya jibu la Chief. Endesha kupitia 88-frame-jan-ya-tatu.cmd:
#   88-frame-jan-ya-tatu.cmd kagua     PROD, kusoma tu -> analysis\steps\88-kagua.log  -> SOMA, kisha (STOP) uamue
#   88-frame-jan-ya-tatu.cmd andika    andika ANDIKA-88 -> email + password ya CEO (haionekani) -> journal -> 88-andika.log
# KABLA ya cutover D tu. Ikiwa journal ya 88 ipo tayari, hakuna kinachoandikwa.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # (em): log isiwe na mojibake
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 88-frame-jan-ya-tatu.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '88-kagua.log' } else { '88-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 88 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '88-frame-jan-ya-tatu.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/88-frame-jan-ya-tatu.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host 'Umesoma 88-kagua.log? Andika ANDIKA-88 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-88') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-88'
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/88-frame-jan-ya-tatu.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---88_MWISHO---$') { L '---88_OK---'; exit 0 } else { L '---88_IMESHINDWA---'; exit 1 }
