# HATUA 85 (mmiliki 10/11 el/eo; 13/11 hk/hl) - PROD (2.5.0 tangu 13/11): uhamisho wa KUPIMA. Endesha kupitia 85-uhamisho-kupima.cmd:
#   85-uhamisho-kupima.cmd kagua     PROD, kusoma tu -> 85-kagua.log: wazazi (uid + id), wagombea wa GILBEYS/CAMINO (uid8),
#                                    FAIDA KWA CHUPA kwa kila mzazi (ONYO faida <= 10%), vipande vya bandia, GL ya kufuta
#   85-uhamisho-kupima.cmd andika    ASUBUHI kabla ya duka kufunguliwa: ml ulizohesabu kwa kila chupa/dumu iliyo wazi (0 = hakuna),
#                                    mzazi wa dumu ya WINE, uid8 za GILBEYS/CAMINO (kutoka 85-kagua.log; Camino 50ml = 4,000 - hn),
#                                    bei za MA-LOT/Grepa (hiari) -> ANDIKA-85 -> password ya CEO
# (hm) stock ya bandia inaondoka kwa CHANZO (manunuzi Cr 1000 -> Dr 1000; mengine -> Dr 5100), SI 3900; ml > 0 kwa mzazi
#   mwenye avg 0 -> ANDIKA inakataa yote kabla ya kuandika (weka 0, au andika manunuzi kwanza).
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
function Ask([string]$key, [string]$prompt, [string]$re) {
    $v = (Read-Host $prompt).Trim()
    if ($v -notmatch $re) { L "SIYO: $key '$v' si sahihi - hakuna kilichoandikwa"; exit 2 }
    $script:lines += "$key=$v"; L "$key = $v"; return $v
}
foreach ($k in @('KONYAGI', 'MOONLIGHT', 'GOLDENKING', 'GILBEYS', 'CAMINO', 'WINE')) { [void](Ask $k "ml za $k (0 = hakuna iliyo wazi)" '^\d+$') }
if (($lines | Where-Object { $_ -eq 'WINE=0' }).Count -eq 0) { [void](Ask 'WINE_MZAZI' 'Dumu ya WINE iliyo wazi ilitoka kwa mzazi yupi? GREPA au MALOT' '^(GREPA|MALOT)$') }
foreach ($k in @('GILBEYS', 'CAMINO')) {
    $v = Read-Host "uid8 ya mzazi wa $k kutoka 85-kagua.log (herufi 8 ndani ya [ ]; - = ruka $k)"
    if ($v -ne '-') { if ($v -notmatch '^[0-9a-fA-F]{8}$') { L "SIYO: uid8 ya $k '$v' - hakuna kilichoandikwa"; exit 2 }; $lines += "${k}_MZAZI=$v"; L "${k}_MZAZI = $v" }
}
[void](Ask 'WINE_GREPA' 'Bei za GREPA WINE 5LT, mf. 70:2000,80:3000 (Enter = bei ya msingi 70:2000,80:3000)' '^((70|80):[1-9]\d*(,(70|80):[1-9]\d*)?)?$')
[void](Ask 'WINE_MALOT' 'Bei za MA-LOT BOX WINE, mf. 70:2500,80:3500 (Enter = bei ya msingi)' '^((70|80):[1-9]\d*(,(70|80):[1-9]\d*)?)?$')
$ans = Read-Host 'Umesoma 85-kagua.log na kuthibitisha ORODHA YA WAZAZI (uid, jina)? Andika ANDIKA-85 kuendelea (kingine = simama)'
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
