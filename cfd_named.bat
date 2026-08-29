@echo off
"C:\Users\user\AppData\Local\Temp\opencode\cloudflared.exe" tunnel --no-autoupdate --credentials-file "C:\Users\user\Downloads\iSafedriveTaxii\credentials.json" --config "C:\Users\user\Downloads\iSafedriveTaxii\cloudflared-ingress.yml" --logfile "C:\Users\user\Downloads\iSafedriveTaxii\logs\cfd_named.log" run isafedrive
