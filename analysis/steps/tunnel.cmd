@echo off
rem TUNNEL ya staging: http://localhost:8081 kwenye PC hii inaelekea nginx ya STAGING (127.0.0.1:8081 ya Contabo).
rem Haibadilishi chochote. Dirisha hili linabaki wazi wakati wa majaribio; kufunga tunnel bonyeza Ctrl+C.
ssh -N -o ServerAliveInterval=15 -o ExitOnForwardFailure=yes -L 8081:localhost:8081 contabo
