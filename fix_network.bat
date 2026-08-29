@echo off
REM Run this as Administrator (right-click -> Run as administrator)
REM Fixes Cloudflare tunnel "Error 1033" caused by flaky DNS + Wi-Fi power saving.

set IF=Wi-Fi 4

echo [*] Setting DNS to 1.1.1.1 / 8.8.8.8 on "%IF%"...
netsh interface ip set dns "%IF%" static 1.1.1.1
netsh interface ip add dns "%IF%" 8.8.8.8 index=2

echo [*] Disabling Wi-Fi power saving (card won't sleep)...
powershell -NoProfile -Command "Set-NetAdapterPowerManagement -Name '%IF%' -AllowComputerToTurnOffDevice $false -NoLowPowerOnWake $true"

echo [*] Disabling sleep / hibernate so the tunnel host stays online...
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /change monitor-timeout-ac 0

echo [*] Flushing DNS cache...
ipconfig /flushdns

echo.
echo [OK] Done. The tunnel host should no longer drop connections.
echo      If you reboot, re-run launch_cfd.bat (normal double-click is fine).
pause
