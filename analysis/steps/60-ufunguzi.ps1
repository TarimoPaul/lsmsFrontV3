# HATUA 60 (fd/fe/ff) - PROD, SIKU YA D (asubuhi, kabla ya duka kufunguliwa; BAADA ya toleo 2 kufika prod). Endesha kupitia 60-ufunguzi.cmd:
#   60-ufunguzi.cmd kagua     kusoma tu -> analysis\steps\60-kagua.log  -> SOMA (tofauti ya ufunguzi?) kisha uamue
#   60-ufunguzi.cmd andika    andika UFUNGUZI-60 -> email + password ya CEO -> journal ya ufunguzi -> (tofauti) -> D -> 60-andika.log
# Utaulizwa: salio la taarifa la NMB, Selcom, M-Pesa, Tigo (jioni ya jana), pesa taslimu YOTE (droo + sefu + bahasha), bahasha,
# D = tarehe ya leo (inawekwa na script). Tofauti ya pesa taslimu inakwenda 2910 "Tofauti ya ufunguzi" (fg, akaunti ya muda, siku 30).
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 60-ufunguzi.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '60-kagua.log' } else { '60-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
function Kiasi([string]$swali) {
    while ($true) {
        $v = (Read-Host $swali).Trim() -replace '[,\s]', ''
        if ($v -match '^\d+(\.\d{1,2})?$') { return $v }
        Write-Host '  kiasi si halali (tarakimu tu, k.m. 1250000)'
    }
}
L "===== 60 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
$D = Get-Date -Format 'yyyy-MM-dd'
$v = [ordered]@{
    L60_NMB     = Kiasi 'Salio la NMB (taarifa ya jioni ya jana)'
    L60_SELCOM  = Kiasi 'Salio la Selcom'
    L60_MPESA   = Kiasi 'Salio la M-Pesa'
    L60_TIGO    = Kiasi 'Salio la Tigo Pesa'
    L60_TASLIMU = Kiasi 'Pesa taslimu YOTE (droo + sefu + bahasha)'
    L60_BAHASHA = Kiasi 'Kati ya hizo, bahasha ya akiba'
}
foreach ($k in $v.Keys) { L "$k = $($v[$k])" }
L "L60_D = $D"
$envs = "L60_D=$D " + (($v.Keys | ForEach-Object { "$_=$($v[$_])" }) -join ' ')
foreach ($f in '60-ufunguzi.sh', '60-bank-cutover.sql', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "$envs bash $R/60-ufunguzi.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host "Umesoma 60-kagua.log ya leo? Andika UFUNGUZI-60 kuandika ufunguzi na kuweka D = $D kwenye PROD (kingine = simama)"
if ($ans -cne 'UFUNGUZI-60') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika UFUNGUZI-60'
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$email`n$plain") | & ssh @SshO contabo "$envs bash $R/60-ufunguzi.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---60_MWISHO---$') { L '---60_OK---'; exit 0 } else { L '---60_IMESHINDWA---'; exit 1 }
