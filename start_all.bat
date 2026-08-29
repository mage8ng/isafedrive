@echo off
REM iSafeDrive full startup - double-click to launch everything.
REM Run from the project folder (it cds there itself).
cd /d "C:\Users\user\Downloads\iSafedriveTaxii"

echo [*] Starting embedded Postgres (DB)...
start "iSafeDB" cmd /c "npm run dev:db"

timeout /t 8 /nobreak >nul

echo [*] Starting API (port 3000)...
start "iSafeAPI" cmd /c "npm run start -w apps/api"

timeout /t 6 /nobreak >nul

echo [*] Starting Admin dashboard (port 3100)...
start "iSafeAdmin" cmd /c "npm run start -w apps/admin-dashboard"

echo [*] Starting Passenger web (port 3200)...
start "iSafePax" cmd /c "npm run start -w apps/passenger-web"

echo [*] Starting Driver web (port 3300)...
start "iSafeDriver" cmd /c "npm run start -w apps/driver-web"

timeout /t 12 /nobreak >nul

echo [*] Starting Cloudflare tunnel (public URLs)...
tasklist | find /i "cloudflared.exe" >nul || start "iSafeTunnel" cmd /c "launch_cfd.bat"

echo.
echo [OK] All services are launching in their own windows.
echo      Keep those windows open. To stop a service, close its window.
echo      Public URLs: https://pax.isafedrive.com  https://driver.isafedrive.com  https://admin.isafedrive.com
echo.
echo      NOTE: if the API window closes immediately, run this once first:
echo            npm run build -w packages/shared ^&^& npm run build -w apps/api ^&^& npm run build -w apps/admin-dashboard
pause
