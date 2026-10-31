# tunnel-port.ps1 (mmiliki 28/10 n) - inaitwa na tunnel-port.cmd. Mstari mmoja tu: "SAWA <port>" au "KOSA <ujumbe>".
# Ujumbe hauna herufi maalum za cmd: & | < > ( ) ^ %
param([string]$Hali = '')
$v = $env:LSMS_TUNNEL_PORT
if ([string]::IsNullOrWhiteSpace($v)) { $v = '8081' }
$v = $v.Trim()
if ($v -notmatch '^\d{1,5}$' -or [int]$v -lt 1024 -or [int]$v -gt 65535) {
  'KOSA LSMS_TUNNEL_PORT ni [' + ($v -replace '[&|<>()^%"]', '?') + '] - lazima iwe namba 1024-65535, mf. set LSMS_TUNNEL_PORT=18081'
  exit 0
}
$p = [int]$v
if ($Hali -eq 'kagua') {
  $mistari = @(netsh interface ipv4 show excludedportrange protocol=tcp)
  if ($LASTEXITCODE -ne 0 -or -not ($mistari -match 'Start Port')) {
    "KOSA haikuweza kusoma excludedportrange ya Windows - netsh exit $LASTEXITCODE"
    exit 0
  }
  foreach ($m in $mistari) {
    if ($m -match '^\s*(\d+)\s+(\d+)') {
      $a = [int]$Matches[1]; $b = [int]$Matches[2]
      if ($p -ge $a -and $p -le $b) {
        "KOSA port $p imezuiwa na Windows - excludedportrange $a-$b, mara nyingi Hyper-V/WinNAT/Docker. Chagua port nje ya safu hizo, mf. set LSMS_TUNNEL_PORT=18081, kisha port ileile kwenye dirisha la hatua"
        exit 0
      }
    }
  }
  $l = @(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue)
  if ($l.Count -gt 0) {
    $pid0 = $l[0].OwningProcess
    $jina = (Get-Process -Id $pid0 -ErrorAction SilentlyContinue).ProcessName
    "KOSA port $p tayari inasikilizwa na $jina pid $pid0 - tunnel nyingine iko wazi? Ifunge, au chagua port nyingine: set LSMS_TUNNEL_PORT=18081"
    exit 0
  }
}
"SAWA $p"
