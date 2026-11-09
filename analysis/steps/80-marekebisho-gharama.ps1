# HATUA 80 (mmiliki 09/11 dq/dr) - driver ya PC. Endesha kupitia 80-marekebisho-gharama.cmd:
#   80-marekebisho-gharama.cmd kagua        PROD, kusoma tu -> analysis\steps\80-kagua.log
#   80-marekebisho-gharama.cmd andika a     watoto 11 bila journal -> CANCELLED (hakuna GL)
#   80-marekebisho-gharama.cmd andika d     Azam x2 + TTCL x1 za Novemba -> CANCELLED (journal zinabatilishwa)
#   80-marekebisho-gharama.cmd andika b     Pango la Frame: 2400 + journal ya Novemba (pango lote 6000)
#   80-marekebisho-gharama.cmd andika c     TRA: Dr 1000 85,833.33 / Cr 6200 20,833.33 + Cr 2200 65,000
#   80-marekebisho-gharama.cmd andika e     DESEMBA (>= 01/12): Dr 6000 200,000 / Cr 2400 200,000
#   Mpangilio (ds): a -> b, c -> d ; e tarehe 01/12.
# andika: unaandika neno la kuthibitisha (ANDIKA-A, -B, -C, -D, -E), kisha email + password ya CEO (haionekani).
param([string]$Mode = '', [string]$Part = '')
$ErrorActionPreference = 'Continue'
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika' -or ($Mode -eq 'andika' -and $Part -notin 'a', 'b', 'c', 'd', 'e')) {
    Write-Host 'MATUMIZI: 80-marekebisho-gharama.cmd kagua | andika <a|b|c|d|e>'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '80-kagua.log' } else { "80-andika-$Part.log" }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 80 $Mode $Part $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '80-marekebisho-gharama.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/80-marekebisho-gharama.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$word = "ANDIKA-$($Part.ToUpper())"
$ans = Read-Host "Umesoma 80-kagua.log? Andika $word kuendelea (kingine = simama)"
if ($ans -cne $word) { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L "mmiliki ameandika $word"
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$email`n$plain") | & ssh @SshO contabo "bash $R/80-marekebisho-gharama.sh andika $Part 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---80_MWISHO---$') { L "---80_OK--- $Part"; exit 0 } else { L "---80_IMESHINDWA--- $Part"; exit 1 }
