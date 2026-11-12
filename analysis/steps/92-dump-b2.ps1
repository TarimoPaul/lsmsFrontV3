# HATUA 92 (mmiliki 12/11 ge) - KUSOMA TU: dumps 2 mpya zaidi za prod kutoka B2 daily/ -> PC backups\ kwa lango la toleo 2.
#   Server: 71c-dumps.sh pakua (rclone copyto B2 -> /tmp/92/out, sha256) - HAIGUSI DB yoyote (prod wala staging).
#   PC: dumps -> D:\MY PROJECT\DUKA PROJECT\backups\ ; sha256 ya PC lazima = ya server.
#   92-dump-b2.cmd pakua    -> analysis\steps\92-pakua.log
#   92-dump-b2.cmd endelea  -> HAIPAKUI B2 tena: inaendelea na /tmp/92/out iliyopo server (12/11: scp ilikatika 4.3/9.8 MB).
# Kupakua kunaendelea pale kulipokatika: ssh "tail -c +N" >> faili (redirection ya cmd = binary salama), majaribio 40.
# /tmp/92 inafutwa TU dumps zote 2 zikiwa sawa (sha256). Ikishindwa: 92-dump-b2.cmd endelea.
param([string]$Mode = '')
$ErrorActionPreference = 'Continue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Steps = if ($env:L92_STEPS) { $env:L92_STEPS } else { 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps' }
$Bk = if ($env:L92_BK) { $env:L92_BK } else { 'D:\MY PROJECT\DUKA PROJECT\backups' }
$SshO = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=4')
$R = '~/lsms-240'
if ($Mode -notin 'pakua', 'endelea') { Write-Host 'MATUMIZI: 92-dump-b2.cmd pakua | endelea'; exit 2 }
$Log = Join-Path $Steps '92-pakua.log'
function L([string]$m) { $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m; Write-Host $line; Add-Content -Path $Log -Value $line -Encoding UTF8 }
L "===== 92 $Mode $(Get-Date -Format 'yyyy-MM-dd') ====="
# L92_FAKE (majaribio tu): bash script inayoigiza 'ssh contabo <amri>' kwenye PC
if ($env:L92_FAKE) { $SshLine = 'bash "' + $env:L92_FAKE + '"' } else { $SshLine = 'ssh ' + ($SshO -join ' ') + ' -n contabo' }
function RemoteText([string]$cmd) { @(cmd /c ($SshLine + ' "' + $cmd + '" 2>&1') | ForEach-Object { "$_" }) }

if ($Mode -eq 'pakua') {
    if (-not $env:L92_FAKE) {
        & scp @SshO (Join-Path $Steps '71c-dumps.sh') "contabo:$R/71c-dumps.sh" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { L 'SIYO: scp 71c-dumps.sh imeshindwa'; exit 1 }
    }
    $out = RemoteText "T71C_D=/tmp/92 bash $R/71c-dumps.sh pakua 2>&1"
    $out | ForEach-Object { L $_ }
    if (-not ($out -match '^DUMPS_MPYA_2_SAWA$')) { L 'SIYO: server haikupakua dumps 2'; L '---92_IMESHINDWA---'; exit 1 }
} else {
    $out = RemoteText 'cd /tmp/92/out 2>/dev/null && for f in *.dump; do echo DUMP_MPYA $f $(stat -c %s $f) $(sha256sum $f | cut -c1-64); done'
    $out | ForEach-Object { L "server: $_" }
    if (@($out -match '^DUMP_MPYA ').Count -ne 2) { L 'SIYO: /tmp/92/out haina dumps 2 - endesha: 92-dump-b2.cmd pakua'; L '---92_IMESHINDWA---'; exit 1 }
}

$ok = 0
foreach ($line in ($out | Where-Object { $_ -match '^DUMP_MPYA ' })) {
    $p = $line -split ' '; $name = $p[1]; $size = [int64]$p[2]; $sha = $p[3]
    $dst = Join-Path $Bk $name
    for ($try = 1; $try -le 40; $try++) {
        $have = 0; if (Test-Path $dst) { $have = (Get-Item $dst).Length }
        if ($have -gt $size) { Remove-Item $dst -Force; $have = 0 }
        if ($have -eq $size) { break }
        cmd /c ($SshLine + ' "tail -c +' + ($have + 1) + ' /tmp/92/out/' + $name + '" >> "' + $dst + '"')
        $now = 0; if (Test-Path $dst) { $now = (Get-Item $dst).Length }
        L "$name jaribio $try : $have -> $now / $size"
        if ($now -eq $have) { Start-Sleep -Seconds 10 }
    }
    $len = 0; if (Test-Path $dst) { $len = (Get-Item $dst).Length }
    if ($len -ne $size) { L "SIYO: $name haikukamilika ($len / $size)"; continue }
    $h = (Get-FileHash -Algorithm SHA256 $dst).Hash.ToLower()
    if ($h -eq $sha) { L "PC_SAWA $name $size $h"; $ok++ }
    else { L "SIYO: sha256 ya $name PC $h <> server $sha - faili la PC limefutwa"; Remove-Item $dst -Force }
}
if ($ok -eq 2) { RemoteText 'rm -rf /tmp/92' | Out-Null; L '---92_OK---'; exit 0 }
L '/tmp/92 IMEBAKI server - endesha: 92-dump-b2.cmd endelea'
L '---92_IMESHINDWA---'; exit 1
