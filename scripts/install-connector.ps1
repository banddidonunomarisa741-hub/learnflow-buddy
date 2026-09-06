$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$target = Join-Path $env:LOCALAPPDATA 'LearnFlowConnector'
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Host 'Please install Node.js 20+ from https://nodejs.org and run this installer again.'; Read-Host 'Press Enter'; exit 1 }
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($folder in @('public','server','scripts')) { Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $target -Recurse -Force }
$protocol = 'HKCU:\Software\Classes\learnflow'
New-Item -Path "$protocol\shell\open\command" -Force | Out-Null
Set-Item -Path $protocol -Value 'URL:LearnFlow local connector'
New-ItemProperty -Path $protocol -Name 'URL Protocol' -Value '' -Force | Out-Null
# Fixed command, deliberately no URI interpolation or arbitrary arguments.
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $target 'scripts\launch.ps1') + '"'
Set-Item -Path "$protocol\shell\open\command" -Value $command
& (Join-Path $target 'scripts\launch.ps1')
