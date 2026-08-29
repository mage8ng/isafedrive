## Objective
- Make the iSafeDrive ride-hailing platform functional and live online for remote testing (passenger/driver/admin), and produce installable Android APKs; secure a **permanent** public URL via Cloudflare (named tunnel, not quick tunnel).

## Important Details
- Project root: `C:\Users\user\Downloads\iSafedriveTaxii`
- Running services/ports: PostgreSQL `:5432` (embedded via `scripts/dev-db.mjs`), API `:3000` (`node dist/main.js`), Admin `:3100` (`next start -p 3100`), Passenger-web `:3200`, Driver-web `:3300`
- API base in frontends: `const API = localStorage.getItem('isafedrive_api') || (window.location.origin + '/api/v1')` — both web servers proxy `/api` to `127.0.0.1:3000` (incl. WebSocket upgrade).
- Super-admin: `isafeadmin` / `prof_uchendu@!safedr!ve?`
- Map fix: bundled MapLibre GL locally in `public/vendor/maplibre-gl.js` + `.css` in both apps.
- Email OTP logged to API stdout (no SMTP). Google login decodes token locally; needs `GOOGLE_CLIENT_ID` for prod.
- PowerShell quirks: `curl` is aliased to `Invoke-WebRequest` → use `curl.exe`. `Get-Content` on a live/open log file hangs → read with `[System.IO.File]::Open(...,'Read','ReadWrite')`. Commands that spawn a console window (`cmd /c bat` with `start`) make the harness wait/timeout — launch long-running native procs via `Start-Process -WindowStyle Hidden` (returns immediately, survives). `Start-Sleep`+multi-`curl` can exceed tool timeout → keep checks short.
- Cloudflared binary: `C:\Users\user\AppData\Local\Temp\opencode\cloudflared.exe`. This version has **no `--token` flag** for `tunnel run`; use `--credentials-file` instead.
- Cloudflare: Account `6caabebf75c891fd5ea21188ad8661fc`, Zone `06be1038e99ceb26ed17d41338149f71`, domain `isafedrive.com`. API token `cfut_KAhg...` (Tunnel:Edit + DNS:Edit) used to create tunnel + DNS via REST API.
- **PERMANENT tunnel**: named tunnel `isafedrive`, id `8ff8069f-615c-4b46-9204-d7cf6afdcfda`, config_src `local`. Credentials decoded from API `result.token` (single base64url JSON, not 3-part JWT) into `credentials.json` (`AccountTag`/`TunnelID`/`TunnelSecret`/`TunnelName`). Ingress in `cloudflared-ingress.yml` maps pax→:3200, driver→:3300, admin→:3100. Launched detached (process running) via `Start-Process -WindowStyle Hidden` with `--credentials-file credentials.json --config cloudflared-ingress.yml --logfile logs/cfd_named.log run isafedrive`.
- **Permanent public URLs (verified live, return real app HTML):** `https://pax.isafedrive.com` (passenger), `https://driver.isafedrive.com` (driver), `https://admin.isafedrive.com` (admin). DNS: 3 CNAMEs → `<tunnel-id>.cfargotunnel.com` (proxied).
- Android build toolchain: JDK 17 at `C:\AndroidTools\jdk\jdk17`; Android SDK at `C:\AndroidTools\sdk` (build-tools `34.0.0`, platform `android-34`). Build script `C:\apkbuild\build_apk_generic.ps1` (params `-Url -Package -Label -OutDir -IconPath`); icon `C:\Users\user\Downloads\sdicon.png`.
- Old quick tunnels (3 cloudflared procs from `launch_tunnels.bat`) are still running but now redundant; can be killed.

## Work State
### Completed
- Feature set verified: wallets, notifications, account menu, social/email-OTP login, driver go-online auto-approves KYC, cancel, payment-received, local MapLibre.
- Backend fixes: `user.phone` nullable; `goOnline` auto-approves KYC; `/api` HTTP+WS proxy in both `server.mjs`.
- E2E trip flow verified at API level (register→login→go-online→create ride→accept→arrived→start [requires `{pin}`]→complete→pay).
- **Permanent Cloudflare named tunnel created via API, DNS CNAMEs added, tunnel running, all 3 public hostnames verified (200/app HTML).**
- APKs rebuilt to permanent URLs: passenger `C:\apkbuild\app-debug.apk` (pkg `com.isafedrive.passenger`, `pax.isafedrive.com`); driver `C:\apkbuild_driver\app-debug.apk` (pkg `com.isafedrive.driver`, `driver.isafedrive.com`).
- Render artifacts (`render.yaml`, `/health`, HTTPS-aware `server.mjs`, `.gitignore`) and Coolify/CapRover artifacts (`docker-compose.yml`, 4 Dockerfiles, `.dockerignore`) from earlier (not used since Cloudflare chosen).

### Active
- Named tunnel `isafedrive` running on this machine, serving the 3 permanent subdomains. APKs point at permanent URLs. Ready for remote browser + phone testing.

### Blocked
- None currently. (Permanent URL achieved without a deploy host.)
- Note: if this machine reboots, relaunch the tunnel: `Start-Process -FilePath "C:\Users\user\AppData\Local\Temp\opencode\cloudflared.exe" -ArgumentList @("tunnel","--no-autoupdate","--credentials-file","C:\Users\user\Downloads\iSafedriveTaxii\credentials.json","--config","C:\Users\user\Downloads\iSafedriveTaxii\cloudflared-ingress.yml","--logfile","C:\Users\user\Downloads\iSafedriveTaxii\logs\cfd_named.log","run","isafedrive") -WindowStyle Hidden` (note `--no-autoupdate` to stop periodic self-restarts that caused Error 1033). Also the local apps (API/admin/passenger/driver) must be running.

## Next Move
1. (none) — permanent URLs + APKs are live; user can test now.
2. Optional: stop the redundant old quick tunnels. Optional: set up auto-start of tunnel + apps on boot if long-term hosting wanted.

## Relevant Files
- `credentials.json`: named-tunnel credentials (decoded from API token)
- `cloudflared-ingress.yml`: tunnel ingress (pax/driver/admin → localhost ports)
- `cfd_named.bat`: launcher (start-style; prefer the `Start-Process` relaunch command above)
- `logs/cfd_named.log`: tunnel runtime log
- `apps/passenger-web/server.mjs` & `apps/driver-web/server.mjs`: `/api` proxy + WS upgrade
- `apps/api/src/main.ts`: `/health` endpoint (for Render)
- `apps/api/src/modules/drivers/drivers.service.ts`: `goOnline` auto-approves KYC
- `apps/api/src/modules/users/user.entity.ts`: `phone` nullable
- `C:\apkbuild\build_apk_generic.ps1`: parameterized APK builder
- `C:\apkbuild\app-debug.apk`: passenger APK (permanent `https://pax.isafedrive.com`)
- `C:\apkbuild_driver\app-debug.apk`: driver APK (permanent `https://driver.isafedrive.com`)
- `C:\Users\user\Downloads\sdicon.png`: app icon source
- `scripts/dev-db.mjs`: embedded Postgres (local only)
