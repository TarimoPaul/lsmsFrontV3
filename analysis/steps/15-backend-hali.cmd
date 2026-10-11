@echo off
rem HATUA 15 - KUSOMA TU. Kwa nini deploy ya backend iligoma? Inaendesha deploy\deploy-backend.ps1 -PreflightOnly
rem na kuandika KILA mstari (pamoja na makosa) kwenye log, ili kosa halisi lionekane.
rem Haijengi, haisukumi image, haideploy, haiulizi swali na haibadilishi .backend-version.
rem Kitu pekee kinachoandikwa kwenye Contabo ni nakala ya script /tmp/deploy-backend.sh (kama kawaida ya preflight).
rem Inaonyesha: branch na commit, working tree, toleo lililopo na litakalofuata, SSH kwenda contabo,
rem toleo linaloendesha prod sasa, na migrations zinazosubiri (zinatarajiwa V130 na V131).
rem Matokeo: analysis\steps\15-backend-hali.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\15-backend-hali.log"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto fail
echo ---BRANCH-COMMIT-NA-HALI--- > "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1
git log -3 --oneline >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
echo ---BACKEND-VERSION--- >> "%LOG%"
type .backend-version >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo ---DOCKER--- >> "%LOG%"
docker version --format "{{.Server.Version}}" >> "%LOG%" 2>&1
echo ---SSH-CONTABO--- >> "%LOG%"
ssh -o BatchMode=yes -o ConnectTimeout=15 contabo "echo SSH_SAWA; date" >> "%LOG%" 2>&1
echo ---PREFLIGHT-ONLY--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -PreflightOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\15-backend-hali.log
goto end
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - kosa liko kwenye analysis\steps\15-backend-hali.log
:end
endlocal
