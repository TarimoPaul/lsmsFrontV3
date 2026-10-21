# Wrapper ya script za kawaida za deploy (inaitwa na 37v; 45d kwa -Mode PreflightOnly, kusoma tu): inaendesha script ya repo, na maandishi yote ya
# dirisha yanaandikwa kwenye transcript ili .cmd iyaweke kwenye log na kutafuta BUILD_OK / DEPLOY_OK.
# Maswali ya script (mf. "andika ndio") yanajibiwa na mmiliki kwenye dirisha hili. Hakuna password inayoulizwa hapa.
#   -Kind backend|v3   -Mode DeployOnly|BuildOnly   -Version x.y.z (DeployOnly tu)
param(
    [Parameter(Mandatory = $true)][string]$Transcript,
    [Parameter(Mandatory = $true)][ValidateSet('backend', 'v3')][string]$Kind,
    [Parameter(Mandatory = $true)][ValidateSet('DeployOnly', 'BuildOnly', 'PreflightOnly')][string]$Mode,
    [ValidatePattern('^(\d+\.\d+\.\d+)?$')][string]$Version = ''
)
$ErrorActionPreference = 'Stop'
$repo = if ($Kind -eq 'backend') { 'D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms' } else { 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3' }
$script = if ($Kind -eq 'backend') { '.\deploy\deploy-backend.ps1' } else { '.\deploy\deploy-v3.ps1' }
if ($Mode -ne 'BuildOnly' -and -not $Version) { Write-Host '[deploy] -DeployOnly inahitaji -Version'; exit 1 }
$rc = 1
Start-Transcript -Path $Transcript -Force | Out-Null
try {
    Push-Location $repo
    try {
        Write-Host "[deploy] $Kind $Mode $Version  (repo: $repo, HEAD: $(git log -1 --format='%h %s'))"
        if ($Mode -eq 'DeployOnly') { & $script -DeployOnly $Version }
        elseif ($Mode -eq 'PreflightOnly') { & $script -DeployOnly $Version -PreflightOnly }
        else { & $script -BuildOnly }
        $rc = $LASTEXITCODE
    } finally { Pop-Location }
} catch {
    Write-Host "[deploy] KOSA: $($_.Exception.Message)"
    $rc = 1
} finally {
    Stop-Transcript | Out-Null
}
exit $rc
