@echo off
rem TUNNEL ya staging: http://localhost:LSMS_TUNNEL_PORT (default 8081) kwenye PC hii inaelekea nginx ya STAGING (127.0.0.1:8081 ya Contabo).
rem Haibadilishi chochote. Dirisha hili linabaki wazi wakati wa majaribio; kufunga tunnel bonyeza Ctrl+C.
rem Port ya PC (mmiliki 28/10 n): set LSMS_TUNNEL_PORT=18081 kabla ya kuendesha hii - na ileile kwenye dirisha la hatua.
rem   Kabla ya ssh: port inakaguliwa - namba sahihi, haiko kwenye excludedportrange ya Windows, hakuna kinachoisikiliza.
setlocal
call "%~dp0tunnel-port.cmd" kagua
if defined TP_KOSA goto kosa
echo Tunnel: http://localhost:%TP% kwenye PC hii -^> staging 127.0.0.1:8081 ya Contabo. Ctrl+C kufunga.
if not "%TP%"=="8081" echo KUMBUKA: kwenye dirisha la hatua weka pia: set LSMS_TUNNEL_PORT=%TP%
ssh -N -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes -L %TP%:localhost:8081 contabo
goto end
:kosa
echo SIYO: %TP_KOSA%
echo Tunnel HAIJAFUNGULIWA.
endlocal
exit /b 1
:end
endlocal
