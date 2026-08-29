@echo off
cd /d C:\Users\user\Downloads\iSafedriveTaxii
set CFD="C:\Users\user\AppData\Local\Temp\opencode\cloudflared.exe"
start "" /min cmd /c %CFD% tunnel --url http://localhost:3200 --no-autoupdate --logfile logs\cfd3200.log ^> logs\cfd3200.out 2^>^&1
start "" /min cmd /c %CFD% tunnel --url http://localhost:3300 --no-autoupdate --logfile logs\cfd3300.log ^> logs\cfd3300.out 2^>^&1
start "" /min cmd /c %CFD% tunnel --url http://localhost:3100 --no-autoupdate --logfile logs\cfd3100.log ^> logs\cfd3100.out 2^>^&1
echo LAUNCHED_ALL
