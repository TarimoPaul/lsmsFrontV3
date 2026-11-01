# HATUA 67 (mmiliki 29/10 ah) - kinga za build ya prod ZILEZILE za deploy\deploy-backend.ps1, bila kuendesha script hiyo:
#   functions zake za juu (Step, Fail, Assert-CleanTree, Assert-ReleaseBranch, ...) zinasomwa kwa parser ya PowerShell
#   (AST) na kuitwa hapa. Hakuna nakala ya code: mabadiliko yoyote kwenye deploy-backend.ps1 yanaonekana hapa pia.
#   powershell -NoProfile -ExecutionPolicy Bypass -File analysis\steps\67-kinga-za-deploy.ps1 -Root "<repo ya backend>"
# Ishara: KINGA_ZA_DEPLOY_SAWA (exit 0). Kosa lolote: "[FAILED] ..." ya Fail (exit 1).
param([Parameter(Mandatory = $true)][string]$Root)
$ErrorActionPreference = 'Stop'
$script = Join-Path $Root 'deploy\deploy-backend.ps1'
if (-not (Test-Path -LiteralPath $script)) { Write-Host "[FAILED] $script haipo"; exit 1 }
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($script, [ref]$tokens, [ref]$errors)
if ($errors.Count) { Write-Host "[FAILED] deploy-backend.ps1 haisomeki: $($errors[0].Message)"; exit 1 }
$fns = @($ast.EndBlock.Statements | Where-Object { $_ -is [System.Management.Automation.Language.FunctionDefinitionAst] })
foreach ($n in 'Step', 'Fail', 'Assert-CleanTree', 'Assert-ReleaseBranch') {
    if (-not ($fns | Where-Object { $_.Name -eq $n })) { Write-Host "[FAILED] function $n haipo kwenye deploy-backend.ps1"; exit 1 }
}
foreach ($f in $fns) { . ([scriptblock]::Create($f.Extent.Text)) }
# Thamani ileile ya CONFIG ya deploy-backend.ps1 (Assert-ReleaseBranch inaitumia).
$cfg = $ast.EndBlock.Statements | Where-Object { $_.Extent.Text -match '^\$MigrationDir\s*=' } | Select-Object -First 1
if (-not $cfg) { Write-Host "[FAILED] `$MigrationDir haipo kwenye deploy-backend.ps1"; exit 1 }
. ([scriptblock]::Create($cfg.Extent.Text))
Write-Host "deploy-backend.ps1 sha256 $((Get-FileHash -Algorithm SHA256 -LiteralPath $script).Hash.Substring(0, 12)); functions $($fns.Count); MigrationDir $MigrationDir"
Assert-CleanTree $Root
Assert-ReleaseBranch $Root
Write-Host 'KINGA_ZA_DEPLOY_SAWA'
exit 0
