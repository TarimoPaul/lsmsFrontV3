# HATUA 74b (mmiliki 12/11 gb; 6b) - PROD, BAADA ya toleo 2: manunuzi YOTE yasiyo na msambazaji + UNPAID -> PAID, BILA journal
# (GL tayari inayahesabu kuwa yamelipwa). Endesha kupitia 74b-bila-msambazaji.cmd:
#   74b-bila-msambazaji.cmd kagua     PROD, kusoma tu -> analysis\steps\74b-kagua.log  -> SOMA, kisha (STOP) uamue
#   74b-bila-msambazaji.cmd andika    andika ANDIKA-74B + idadi ya YA_KUANDIKA ya log -> SQL moja ndani ya kinga -> 74b-andika.log
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'kagua', 'andika') { Write-Host 'MATUMIZI: 74b-bila-msambazaji.cmd kagua | andika'; exit 2 }
$Log = Join-Path $Steps ($(if ($Mode -eq 'kagua') { '74b-kagua.log' } else { '74b-andika.log' }))
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 74b $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
foreach ($f in '74b-bila-msambazaji.sh', 'ficha.awk') {
    & scp @SshO (Join-Path $Steps $f) "contabo:$R/$f" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $f imeshindwa"; exit 1 }
}
$F = "awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f $R/ficha.awk"
if ($Mode -eq 'kagua') {
    & ssh @SshO -n contabo "bash $R/74b-bila-msambazaji.sh kagua 2>&1 | $F" 2>&1 | ForEach-Object { L "$_" }
    exit 0
}
$ans = Read-Host 'Umesoma 74b-kagua.log? Andika ANDIKA-74B kuendelea (kingine = simama)'
if ($ans -cne 'ANDIKA-74B') { L 'Umesimamisha - hakuna kilichoandikwa.'; exit 2 }
$n = Read-Host 'Idadi ya YA_KUANDIKA kwenye 74b-kagua.log'
if ($n -notmatch '^[0-9]+$') { L 'Idadi si namba - hakuna kilichoandikwa.'; exit 2 }
L "mmiliki ameandika ANDIKA-74B, YA_KUANDIKA $n"
$out = & ssh @SshO -n contabo "L74B_N=$n bash $R/74b-bila-msambazaji.sh andika 2>&1 | $F" 2>&1 | ForEach-Object { "$_" }
$out | ForEach-Object { L $_ }
if ($out -match '^---74B_MWISHO---$') { L '---74B_OK---'; exit 0 } else { L '---74B_IMESHINDWA---'; exit 1 }
