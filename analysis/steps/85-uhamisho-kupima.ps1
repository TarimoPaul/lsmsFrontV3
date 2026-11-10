# HATUA 85 (mmiliki 10/11 el/eo) - PROD, BAADA ya toleo 2: uhamisho wa KUPIMA. Endesha kupitia 85-uhamisho-kupima.cmd:
#   85-uhamisho-kupima.cmd kagua     PROD, kusoma tu -> 85-kagua.log (bidhaa, wazazi - yupi hayupo -, vipande, GL ya kufuta)
#   85-uhamisho-kupima.cmd andika    ml ulizohesabu kwa kila chombo kilicho wazi (0 = hakuna) -> ANDIKA-85 -> password ya CEO
# Bidhaa isiyo na mzazi inarukwa; iliyokwisha hamishwa inarukwa. Unaweza kuendesha tena baada ya kusajili mzazi.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # (em): log isiwe na mojibake
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 85-uhamisho-kupima.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '85-kagua.log' } else { '85-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 85 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '85-uhamisho-kupima.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/85-uhamisho-kupima.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
Write-Host 'Weka ml ulizohesabu kwenye chombo kilicho wazi cha kila kinywaji (0 = hakuna chombo wazi).'
Write-Host 'Kiwango -> ml: chupa 750ml: 1 = 750, 3/4 = 563, 1/2 = 375, 1/4 = 188.  Dumu 5000ml: 1/2 = 2500, 1/4 = 1250.'
$lines = @()
foreach ($k in @('KONYAGI', 'MOONLIGHT', 'GOLDENKING', 'GILBEYS', 'CAMINO', 'WINE')) {
    $v = Read-Host "ml za $k"
    if ($v -notmatch '^\d+$') { L "SIYO: ml za $k si namba ('$v') - hakuna kilichoandikwa"; exit 2 }
    $lines += "$k=$v"
    L "ml $k = $v"
}
$ans = Read-Host 'Umesoma 85-kagua.log? Andika ANDIKA-85 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-85') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-85'
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ((@($email, $plain) + $lines) -join "`n") | & ssh @SshO contabo "bash $R/85-uhamisho-kupima.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---85_MWISHO---$') { L '---85_OK---'; exit 0 } else { L '---85_IMESHINDWA---'; exit 1 }
