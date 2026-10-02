# LSMS ANGULAR V3 - DEPLOY TO CONTABO  (https://elikom.co.tz/v3/)
#
#   .\deploy\deploy-v3.ps1                 # bump patch, build, push, deploy
#   .\deploy\deploy-v3.ps1 -Bump minor     # or: major
#   .\deploy\deploy-v3.ps1 -Bump none      # deploy the version in .frontend-v3-version as is (first deploy)
#
# Flow (same idea as "Deploy frontend.ps1" of Flutter, with its risks removed):
#   PC:     bump version -> docker build -> docker push (exact tag, never :latest)
#   Server: pull -> set FRONTEND_V3_VERSION -> compose up frontend-v3 -> health check
#           -> automatic rollback on failure (deploy/remote-deploy-v3.sh)
#   PC:     version file is written + committed ONLY after DEPLOY_OK.
# Flutter (/) and the backend (/api) are never touched. See deploy/DEPLOY_V3.md.

param(
    [ValidateSet('patch', 'minor', 'major', 'none')]
    [string]$Bump = 'patch',
    # Build from a working tree with uncommitted changes (not recommended).
    [switch]$AllowDirty,
    # Frontend-only change with no backend coupling? -SkipPreflight.
    [switch]$SkipPreflight
)

$ErrorActionPreference = 'Stop'

# -- CONFIG ---------------------------------------------------
$ImageName    = 'chiefmaster/lsms-frontend-v3'
$VersionFile  = '.frontend-v3-version'
$SshHost      = 'contabo'                      # alias in ~/.ssh/config (host key checked)
$RemoteScript = '/tmp/deploy-frontend-v3.sh'
$PublicUrl    = 'https://elikom.co.tz/v3/'

function Step([string]$m) { Write-Host "[*] $m" -ForegroundColor Cyan }
function Fail([string]$m) { Write-Host "`n[FAILED] $m" -ForegroundColor Red; exit 1 }
# Run a native command and stop on a non-zero exit code - after EVERY command.
function Invoke-Checked([string]$What, [scriptblock]$Cmd) {
    & $Cmd
    if ($LASTEXITCODE -ne 0) { Fail "$What (exit $LASTEXITCODE)" }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
$tempScript = $null
try {
    # -- PREFLIGHT: BACKEND BEFORE FRONTEND -------------------
    if (-not $SkipPreflight) {
        Write-Host ""
        Write-Host "===== PREFLIGHT (V3) =====" -ForegroundColor Magenta
        Write-Host "  Backend HUTANGULIA frontend. Kila mara." -ForegroundColor Magenta
        Write-Host ""
        Write-Host "  1. Backend yenye endpoint/field zinazotumiwa na toleo hili imeshadeploy?"
        Write-Host "  2. Zimethibitishwa kwenye server HALISI, si kwenye local tu?"
        Write-Host ""
        $answer = Read-Host "  Andika 'ndio' kuendelea (kitu kingine chochote = acha)"
        if ($answer.Trim().ToLower() -ne 'ndio') { Fail "Deploy imesitishwa - preflight haijapita." }
    }

    # -- CHECKS (nothing is changed yet) ----------------------
    if (-not (Test-Path $VersionFile)) { Fail "$VersionFile haipo (inatakiwa iwe na semver, mfano 3.0.0)." }
    $current = (Get-Content $VersionFile -Raw).Trim()
    if ($current -notmatch '^(\d+)\.(\d+)\.(\d+)$') { Fail "$VersionFile si semver: '$current'" }
    $major = [int]$Matches[1]; $minor = [int]$Matches[2]; $patch = [int]$Matches[3]
    switch ($Bump) {
        'major' { $major++; $minor = 0; $patch = 0 }
        'minor' { $minor++; $patch = 0 }
        'patch' { $patch++ }
        'none'  { }
    }
    $newVersion = "$major.$minor.$patch"
    $image = "${ImageName}:${newVersion}"

    $dirty = git status --porcelain
    if ($LASTEXITCODE -ne 0) { Fail "git status imeshindwa" }
    if ($dirty -and -not $AllowDirty) {
        Fail "Working tree ina mabadiliko yasiyo-commit. Commit kwanza, au tumia -AllowDirty kwa makusudi."
    }
    if ($dirty) { Write-Host "[!] -AllowDirty: image itajengwa kutoka kwenye mabadiliko yasiyo-commit." -ForegroundColor DarkYellow }

    Invoke-Checked "Docker haipatikani - washa Docker Desktop" { docker version --format '{{.Server.Version}}' | Out-Null }
    Invoke-Checked "SSH kwenda '$SshHost' imeshindwa (jaribu: ssh $SshHost)" { ssh -o BatchMode=yes -o ConnectTimeout=15 $SshHost "true" }

    Step "Toleo: $current -> $newVersion   ($image)"

    # -- BUILD ------------------------------------------------
    Step "docker build..."
    Invoke-Checked "docker build imeshindwa" {
        docker build -f deploy/Dockerfile --build-arg "APP_VERSION=$newVersion" -t $image .
    }
    # The image must at least start with a valid nginx config before it is pushed.
    Invoke-Checked "nginx -t ndani ya image imeshindwa" { docker run --rm $image nginx -t }

    # -- PUSH (exact tag only; Docker Hub sometimes times out -> retry) --
    Step "docker push $image ..."
    $pushed = $false
    foreach ($wait in 0, 5, 15) {
        if ($wait) { Write-Host "    push imeshindwa - najaribu tena baada ya ${wait}s" -ForegroundColor DarkYellow; Start-Sleep -Seconds $wait }
        docker push $image
        if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
    }
    if (-not $pushed) { Fail "docker push imeshindwa. Umeingia Docker Hub? (docker login -u chiefmaster, kwa token ya PUSH). Server haijaguswa." }

    # -- REMOTE DEPLOY ----------------------------------------
    # LF-only copy without BOM (CRLF / BOM break bash).
    $body = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'remote-deploy-v3.sh')) -replace "`r", ''
    $tempScript = [System.IO.Path]::GetTempFileName()
    [System.IO.File]::WriteAllText($tempScript, $body, [System.Text.UTF8Encoding]::new($false))

    Step "Deploying kwenye $SshHost ..."
    Invoke-Checked "scp ya script imeshindwa. Server haijaguswa." { scp -q -o BatchMode=yes $tempScript "${SshHost}:${RemoteScript}" }

    $out = @()
    ssh -o BatchMode=yes $SshHost "bash $RemoteScript $newVersion; rc=`$?; rm -f $RemoteScript; exit `$rc" |
        ForEach-Object { Write-Host "    $_"; $out += $_ }
    $sshExit = $LASTEXITCODE

    if ($sshExit -ne 0 -or ($out -notcontains "DEPLOY_OK $newVersion")) {
        Fail "Deploy ya $newVersion imeshindwa (ssh exit $sshExit). Soma mistari ya [v3] hapo juu - rollback imefanyika yenyewe kama kulikuwa na toleo la awali. $VersionFile haijabadilishwa."
    }

    # -- SUCCESS: only now record the version ------------------
    [System.IO.File]::WriteAllText((Join-Path $RepoRoot $VersionFile), "$newVersion`n", [System.Text.ASCIIEncoding]::new())
    git add -- $VersionFile
    git diff --cached --quiet -- $VersionFile
    if ($LASTEXITCODE -ne 0) {
        git commit --quiet --only -m "deploy: frontend-v3 $newVersion" -- $VersionFile
        if ($LASTEXITCODE -ne 0) { Write-Host "[!] Deploy imefanikiwa lakini git commit ya $VersionFile imeshindwa - commit kwa mkono." -ForegroundColor DarkYellow }
        else { Step "$VersionFile = $newVersion (committed)" }
    }

    # Old local images of this repository (keep new + previous).
    docker images $ImageName --format '{{.Tag}}' |
        Where-Object { $_ -ne $newVersion -and $_ -ne $current -and $_ -ne '<none>' } |
        ForEach-Object { docker rmi "${ImageName}:$_" | Out-Null }

    # Public check through Cloudflare (warning only - the server check already passed).
    $public = curl.exe -s -o NUL -w '%{http_code}' --max-time 20 $PublicUrl
    if ($public -ne '200') { Write-Host "[!] $PublicUrl imerudisha $public kupitia Cloudflare - kagua kwa browser." -ForegroundColor DarkYellow }

    Write-Host "`n[OK] DEPLOY_OK $newVersion  ->  $PublicUrl" -ForegroundColor Green
}
finally {
    if ($tempScript -and (Test-Path $tempScript)) { Remove-Item $tempScript -Force }
    Pop-Location
}
