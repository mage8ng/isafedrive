@echo off
start "" "C:\Users\user\AppData\Local\Temp\opencode\cloudflared.exe" tunnel --no-autoupdate --protocol http2 --config "C:\Users\user\Downloads\iSafedriveTaxii\cloudflared-ingress.yml" --credentials-file "C:\Users\user\Downloads\iSafedriveTaxii\credentials.json" --logfile "C:\Users\user\Downloads\iSafedriveTaxii\logs\cfd_http2.log" run >nul 2>&1
