$ErrorActionPreference = 'Stop'
$api = "http://localhost:3000/api/v1"
function Call($method, $path, $body, $token) {
  $h = @{}
  if ($token) { $h['Authorization'] = "Bearer $token" }
  $h['Content-Type'] = 'application/json'
  $json = if ($body) { $body | ConvertTo-Json -Compress } else { $null }
  try {
    $r = Invoke-WebRequest -Uri "$api$path" -Method $method -Headers $h -Body $json -UseBasicParsing -TimeoutSec 20
    return @{ code = $r.StatusCode; body = ($r.Content | ConvertFrom-Json -ErrorAction SilentlyContinue) }
  } catch {
    $resp = $_.Exception.Response
    $code = if ($resp) { [int]$resp.StatusCode } else { 0 }
    $msg = $_.Exception.Message
    return @{ code = $code; body = $msg }
  }
}
Write-Output "== register passenger =="
$pReg = Call POST "/auth/register" @{fullName="E2E Pass";phone="+12340000001";password="password123";role="passenger"}
Write-Output ($pReg | ConvertTo-Json -Compress)
Write-Output "== register driver =="
$dReg = Call POST "/auth/register" @{fullName="E2E Driver";phone="+12340000002";password="password123";role="driver"}
Write-Output ($dReg | ConvertTo-Json -Compress)
Write-Output "== driver login =="
$dLog = Call POST "/auth/login" @{phone="+12340000002";password="password123"}
$dTok = $dLog.body.accessToken
Write-Output "driver token? $([bool]$dTok) code=$($dLog.code)"
Write-Output "== driver go-online =="
$g = Call POST "/drivers/go-online" @{latitude=37.77;longitude=-122.42} $dTok
Write-Output ($g | ConvertTo-Json -Compress)
Write-Output "== passenger login =="
$pLog = Call POST "/auth/login" @{phone="+12340000001";password="password123"}
$pTok = $pLog.body.accessToken
Write-Output "passenger token? $([bool]$pTok) code=$($pLog.code)"
Write-Output "== create ride =="
$c = Call POST "/rides" @{categoryId="economy";pickupAddress="A St";pickupLatitude=37.77;pickupLongitude=-122.42;destinationAddress="B St";destinationLatitude=37.78;destinationLongitude=-122.43;paymentMethod="cash"} $pTok
$rideId = $null
$ridePin = $null
if ($c.body -and $c.body.id) { $rideId = $c.body.id; $ridePin = $c.body.ridePin }
Write-Output ($c | ConvertTo-Json -Compress)
if (-not $rideId) { Write-Output "NO RIDE ID - stop"; exit }
Write-Output "== driver available-rides =="
$av = Call GET "/drivers/available-rides" $null $dTok
Write-Output ($av | ConvertTo-Json -Compress)
Write-Output "== driver accept =="
$a = Call POST "/rides/$rideId/accept" $null $dTok
Write-Output ($a | ConvertTo-Json -Compress)
Write-Output "== driver arrived =="
$ar = Call POST "/rides/$rideId/arrived" $null $dTok
Write-Output ($ar | ConvertTo-Json -Compress)
Write-Output "== driver start =="
$st = Call POST "/rides/$rideId/start" @{pin=$ridePin} $dTok
Write-Output ($st | ConvertTo-Json -Compress)
Write-Output "== driver complete =="
$cp = Call POST "/rides/$rideId/complete" $null $dTok
Write-Output ($cp | ConvertTo-Json -Compress)
Write-Output "== passenger pay =="
$pay = Call POST "/rides/$rideId/pay" @{method="cash"} $pTok
Write-Output ($pay | ConvertTo-Json -Compress)
Write-Output "== ride status final =="
$fin = Call GET "/rides/$rideId" $null $pTok
Write-Output ($fin | ConvertTo-Json -Compress)
