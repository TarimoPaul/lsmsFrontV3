# HATUA 82 (mmiliki 10/11 eb) - YA DHARURA: kulipa deni 2400 (pango) / 2200 (TRA) bila gharama mpya. Endesha kupitia 82-lipa-deni.cmd:
#   82-lipa-deni.cmd kagua      PROD, kusoma tu -> analysis\steps\82-kagua.log (salio, cutover, kipindi, journal za 82)
#   82-lipa-deni.cmd andika     maswali: akaunti, kiasi, chanzo, akaunti ya chanzo, maelezo -> inaonyesha journal (kusoma tu)
#                               -> andika ANDIKA-82 -> email + password ya CEO (haionekani) -> journal Dr deni / Cr chanzo
# ITUMIKE TU ikiwa pango (~600,000 ~01/01/27) au TRA (65,000) linalipwa KABLA toleo 2 halijaenda prod.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 82-lipa-deni.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '82-kagua.log' } else { '82-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 82 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '82-lipa-deni.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/82-lipa-deni.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$acc = Read-Host 'Deni lipi? 2400 (pango/gharama) au 2200 (TRA/kodi)'
$amt = Read-Host 'Kiasi (TZS, bila koma, mf. 600000)'
$src = Read-Host 'Chanzo cha pesa: DROO, BENKI, SIMU au MMILIKI'
$sacc = ''
if ($src.ToUpper() -eq 'BENKI') { $sacc = Read-Host 'Akaunti ya benki: 1020 CRDB, 1021 NMB, 1022 NBC, 1023 Selcom, 1024 PCB' }
if ($src.ToUpper() -eq 'SIMU') { $sacc = Read-Host 'Akaunti ya simu: 1030 M-Pesa, 1031 Tigo, 1032 Halopesa, 1033 Airtel' }
$desc = Read-Host 'Nini kinalipwa (angalau herufi 10, mf. Pango la Frame Okt-Des 2026)'
# PowerShell 5.1 inatuma kwa ssh kama ASCII: herufi kama "–" au "é" zingekuwa "?" - tumia herufi za kawaida tu
if ($desc -match '[^\x20-\x7E]') { L 'SIYO: maelezo yana herufi zisizo za kawaida (mf. - ndefu); andika kwa herufi za kawaida tu.'; exit 2 }
$req = "$acc`n$amt`n$src`n$sacc`n$desc"
$plan = $req | & ssh @SshO contabo "bash $R/82-lipa-deni.sh angalia 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plan | ForEach-Object { L $_ }
if ($plan -match '^---82_MWISHO---$') { L 'Tayari imeandikwa - hakuna la kufanya.'; exit 0 }
if (-not ($plan -match '^---82_ANGALIA_MWISHO---$')) { L '---82_IMESHINDWA--- (ombi limekataliwa, hakuna kilichoandikwa)'; exit 1 }
$ans = Read-Host 'Journal hapo juu ni sahihi? Andika ANDIKA-82 kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-82') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
L 'mmiliki ameandika ANDIKA-82'
$email = Read-Host 'Email ya CEO'
$sec = Read-Host -AsSecureString 'Password (haionekani)'
$b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
$out = ("$req`n$email`n$plain") | & ssh @SshO contabo "bash $R/82-lipa-deni.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$plain = $null
$out | ForEach-Object { L $_ }
if ($out -match '^---82_MWISHO---$') { L '---82_OK---'; exit 0 } else { L '---82_IMESHINDWA---'; exit 1 }
