# HATUA 92 (mmiliki 12/11 ge) - KUSOMA TU: dumps 2 mpya zaidi za prod kutoka B2 daily/ -> PC backups\ kwa lango la toleo 2.
#   Server: 71c-dumps.sh pakua (rclone copyto B2 -> /tmp/92/out, sha256) - HAIGUSI DB yoyote (prod wala staging).
#   PC: scp -> D:\MY PROJECT\DUKA PROJECT\backups\ ; sha256 ya PC lazima = ya server; /tmp/92 inafutwa.
#   92-dump-b2.cmd pakua    -> analysis\steps\92-pakua.log
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps'
$Bk = 'D:\MY PROJECT\DUKA PROJECT\backups'
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -ne 'pakua') { Write-Host 'MATUMIZI: 92-dump-b2.cmd pakua'; exit 2 }
$Log = Join-Path $Steps '92-pakua.log'
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 92 pakua $(Get-Date -Format 'yyyy-MM-dd') ====="
& scp @SshO (Join-Path $Steps '71c-dumps.sh') "contabo:$R/71c-dumps.sh" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { L 'SIYO: scp 71c-dumps.sh imeshindwa'; exit 1 }
$out = @(& ssh @SshO -n contabo "T71C_D=/tmp/92 bash $R/71c-dumps.sh pakua 2>&1" 2>&1 | ForEach-Object { "$_" })
$out | ForEach-Object { L $_ }
if (-not ($out -match '^DUMPS_MPYA_2_SAWA$')) { L 'SIYO: server haikupakua dumps 2'; L '---92_IMESHINDWA---'; exit 1 }
$ok = 0
foreach ($line in ($out | Where-Object { $_ -match '^DUMP_MPYA ' })) {
    $p = $line -split ' '; $name = $p[1]; $sha = $p[3]
    $dst = Join-Path $Bk $name
    & scp @SshO "contabo:/tmp/92/out/$name" $dst 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { L "SIYO: scp $name imeshindwa"; continue }
    $h = (Get-FileHash -Algorithm SHA256 $dst).Hash.ToLower()
    if ($h -eq $sha) { L "PC_SAWA $name $((Get-Item $dst).Length) $h"; $ok++ } else { L "SIYO: sha256 ya $name PC $h <> server $sha" }
}
& ssh @SshO -n contabo "rm -rf /tmp/92" 2>&1 | Out-Null
if ($ok -eq 2) { L '---92_OK---'; exit 0 } else { L '---92_IMESHINDWA---'; exit 1 }
