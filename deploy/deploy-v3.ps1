# LSMS ANGULAR V3 - DEPLOY TO CONTABO  (https://elikom.co.tz/v3/)
#
#   .\deploy\deploy-v3.ps1                 # bump patch, build, push, deploy
#   .\deploy\deploy-v3.ps1 -Bump minor     # or: major
#   .\deploy\deploy-v3.ps1 -Bump none      # deploy the version in .frontend-v3-version as is (first deploy)
#   .\deploy\deploy-v3.ps1 -BuildOnly      # bump patch, build, push - and STOP. The server is never
#                                          # contacted. Test that image on staging, then deploy the
#                                          # SAME image with -DeployOnly <version>.
#   .\deploy\deploy-v3.ps1 -DeployOnly 3.1.6
#                                          # NO build/push: deploy an image already on Docker Hub
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
    # Frontend-only change with no backend coupling? -SkipPreflight.
    [switch]$SkipPreflight,
    # Build and push the image, then stop: no SSH, no deploy, no version file.
    # Refuses a tag that is already on Docker Hub (a pushed image is never overwritten).
    [switch]$BuildOnly,
    # Deploy an image that is already on Docker Hub (built earlier with -BuildOnly and tested
    # on staging). Skips the build and the push.
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$DeployOnly
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
# Is this exact tag already on Docker Hub? "no such manifest" goes to stderr - that is the answer,
# not an error, so it must not trip $ErrorActionPreference = 'Stop'.
function Test-ImageOnHub([string]$Image) {
    $ErrorActionPreference = 'Continue'
    docker manifest inspect $Image 2>&1 | Out-Null
    return ($LASTEXITCODE -eq 0)
}
# sha256 digest of a local image that has been pushed or pulled ('' when it has none).
# No quotes inside the Go template: Windows PowerShell 5.1 strips them from native arguments.
function Get-ImageDigest([string]$Image) {
    $meta = (docker image inspect $Image --format '{{json .}}') -join '' | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $meta) { return '' }
    return ((@($meta.RepoDigests) | Select-Object -First 1) -replace '^.*@', '')
}
# Refuse ANY modified, staged, deleted or untracked path in the repo (only analysis/ is allowed).
# No flag skips it. Runs git against $RepoRoot explicitly (not the caller's cwd) and forces
# untracked files to be listed, whatever the user's git config says.
function Assert-CleanTree([string]$Root) {
    $ErrorActionPreference = 'Continue'   # git may print CRLF warnings on stderr; they are not errors
    # Refresh stat info first, so a file whose content is unchanged (e.g. only touched, or CRLF/LF
    # normalisation) never reads 'modified' on one run and clean on the next: same answer every run.
    git -C $Root update-index -q --refresh | Out-Null
    $lines = @(git -C $Root -c core.quotepath=false status --porcelain=v1 --untracked-files=all --ignore-submodules=none)
    if ($LASTEXITCODE -ne 0) { Fail "git status imeshindwa kwenye $Root (exit $LASTEXITCODE)." }
    $bad = @($lines | Where-Object { $_ -and ($_.Substring(3).Trim('"') -notmatch '^analysis/') })
    if ($bad.Count) {
        Fail ("Working tree si safi ($($bad.Count)) - commit au ondoa kwanza (analysis/ peke yake inaruhusiwa):`n    " + ($bad -join "`n    "))
    }
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
$tempScript = $null
try {
    if ($BuildOnly -and $DeployOnly) { Fail "Tumia -BuildOnly AU -DeployOnly, si vyote viwili." }
    if ($DeployOnly -and $PSBoundParameters.ContainsKey('Bump')) { Fail "Tumia -DeployOnly AU -Bump, si vyote viwili." }

    # -- PREFLIGHT: BACKEND BEFORE FRONTEND -------------------
    # -BuildOnly deploys nothing, so there is nothing to confirm yet; -DeployOnly asks as usual.
    if (-not $SkipPreflight -and -not $BuildOnly) {
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
    if ($DeployOnly) { $newVersion = $DeployOnly }
    $image = "${ImageName}:${newVersion}"

    Assert-CleanTree $RepoRoot

    Invoke-Checked "Docker haipatikani - washa Docker Desktop" { docker version --format '{{.Server.Version}}' | Out-Null }
    if ($BuildOnly) {
        # Nothing on the server is read or changed. A tag that is already published is never rebuilt:
        # what was tested on staging must be byte-for-byte what -DeployOnly later puts on prod.
        if (Test-ImageOnHub $image) { Fail "$image tayari iko Docker Hub - haitaandikwa upya. Tumia -DeployOnly $newVersion kuideploy, au -Bump kwa toleo jipya." }
        Step "-BuildOnly: build + push ya $image. Server HAIGUSWI; $VersionFile haibadilishwi."
    } else {
        Invoke-Checked "SSH kwenda '$SshHost' imeshindwa (jaribu: ssh $SshHost)" { ssh -o BatchMode=yes -o ConnectTimeout=15 $SshHost "true" }
    }

    Step "Toleo: $current -> $newVersion   ($image)"

    if ($DeployOnly) {
        # The image must already be on Docker Hub; it is deployed exactly as it is.
        if (-not (Test-ImageOnHub $image)) { Fail "$image haipo Docker Hub (au hujaingia: docker login -u chiefmaster). Server haijaguswa." }
        Invoke-Checked "docker pull $image imeshindwa. Server haijaguswa." { docker pull -q $image | Out-Null }
        Step "-DeployOnly: build na push vimerukwa. Image: $(Get-ImageDigest $image)"
    } else {
    # -- BUILD ------------------------------------------------
    Step "docker build..."
    $revision = (git -C $RepoRoot rev-parse HEAD).Trim()
    Invoke-Checked "docker build imeshindwa" {
        docker build -f deploy/Dockerfile --build-arg "APP_VERSION=$newVersion" --label "org.opencontainers.image.revision=$revision" -t $image .
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
    }   # end: not -DeployOnly

    if ($BuildOnly) {
        Assert-CleanTree $RepoRoot   # nothing may have changed while building: the image IS this commit
        Write-Host ""
        Write-Host "[OK] BUILD_OK $newVersion - imejengwa na kusukumwa. Server haijaguswa; $VersionFile bado ni $current." -ForegroundColor Green
        Write-Host "  Image:    $image"
        Write-Host "  Digest:   $(Get-ImageDigest $image)"
        Write-Host "  Commit:   $(git log -1 --format='%h %s')"
        Write-Host "  Kifuatacho: ijaribu staging, kisha"
        Write-Host "      .\deploy\deploy-v3.ps1 -DeployOnly $newVersion"
        return
    }

    # -- REMOTE DEPLOY ----------------------------------------
    Assert-CleanTree $RepoRoot   # again: nothing may have changed while building
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
