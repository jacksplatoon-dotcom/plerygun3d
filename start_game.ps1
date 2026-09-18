$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
	throw 'Python is required to start PleryGun3D.'
}
$gameListener = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $gameListener) {
	$game = Start-Process -FilePath python -ArgumentList @('-m', 'http.server', '5173') -WorkingDirectory $root -RedirectStandardOutput (Join-Path $root 'relay-output.log') -RedirectStandardError (Join-Path $root 'relay-error.log') -PassThru
	Write-Host "Game server PID: $($game.Id)"
}
$multiplayerListener = Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if (-not $multiplayerListener) {
	$multiplayer = Start-Process -FilePath node -ArgumentList 'multiplayer-server.cjs' -WorkingDirectory $root -PassThru
	Write-Host "Multiplayer server PID: $($multiplayer.Id)"
}
Write-Host "Game: http://localhost:5173"
 $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp -ErrorAction SilentlyContinue |
	Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
	Select-Object -First 1 -ExpandProperty IPAddress
if ($lanAddress) {
	Write-Host "LAN:  http://$lanAddress`:5173/PleryGun3D.html"
}
Start-Process 'http://localhost:5173/PleryGun3D.html'
