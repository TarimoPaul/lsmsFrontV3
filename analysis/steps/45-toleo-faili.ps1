# Baada ya DEPLOY_OK ya kazi ya nyuma (45d / 45h / 51): inaandika faili la toleo na kufanya commit yake - ILEILE na
# deploy-backend.ps1 / deploy-v3.ps1 zinavyofanya baada ya DEPLOY_OK (git push ni ya mmiliki). Salama kurudiwa:
# faili likiwa tayari na toleo hilo, hakuna commit mpya.
param(
    [Parameter(Mandatory = $true)][ValidateSet('backend', 'v3')][string]$Kind,
    [Parameter(Mandatory = $true)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version
)
$repo = if ($Kind -eq 'backend') { 'D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms' } else { 'D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3' }
$file = if ($Kind -eq 'backend') { '.backend-version' } else { '.frontend-v3-version' }
$text = if ($Kind -eq 'backend') { $Version } else { "$Version`n" }
$msg = if ($Kind -eq 'backend') { "deploy: backend $Version" } else { "deploy: frontend-v3 $Version" }
Set-Location $repo
[System.IO.File]::WriteAllText((Join-Path $repo $file), $text, [System.Text.ASCIIEncoding]::new())
git add -- $file
git diff --cached --quiet -- $file
if ($LASTEXITCODE -ne 0) {
    git commit --quiet --only -m $msg -- $file
    if ($LASTEXITCODE -ne 0) { Write-Host "[!] git commit ya $file imeshindwa - commit kwa mkono."; exit 1 }
    Write-Host "TOLEO_FAILI $file = $Version (committed; git push ni yako)"
} else {
    Write-Host "TOLEO_FAILI $file tayari = $Version (hakuna commit mpya)"
}
exit 0
