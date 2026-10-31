@echo off
rem LSMS_TUNNEL_PORT (mmiliki 28/10 n): port ya PC hii kwa tunnel ya staging. Default 8081.
rem   Upande wa Contabo haubadiliki: nginx ya staging ni 127.0.0.1:8081 daima. Hii ni port ya PC tu.
rem   Weka kabla ya tunnel.cmd NA kabla ya hatua, kwenye kila dirisha:  set LSMS_TUNNEL_PORT=18081
rem   au mara moja kwa kudumu (madirisha mapya):                          setx LSMS_TUNNEL_PORT 18081
rem Matumizi (bila setlocal - inaweka TP na TP_KOSA kwa anayeiita):
rem   call analysis\steps\tunnel-port.cmd         TP = port, au TP_KOSA = ujumbe ikiwa LSMS_TUNNEL_PORT si namba sahihi
rem   call analysis\steps\tunnel-port.cmd kagua   pia: port haiko kwenye excludedportrange ya Windows na hakuna kinachoisikiliza
set "TP="
set "TP_KOSA="
set "TP_J="
set "TP_M="
for /f "usebackq tokens=1,*" %%a in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tunnel-port.ps1" %1`) do (
  set "TP_J=%%a"
  set "TP_M=%%b"
)
if "%TP_J%"=="SAWA" (set "TP=%TP_M%") else if "%TP_J%"=="KOSA" (set "TP_KOSA=%TP_M%") else set "TP_KOSA=tunnel-port.ps1 haikutoa jibu - powershell imeshindwa"
set "TP_J="
set "TP_M="
