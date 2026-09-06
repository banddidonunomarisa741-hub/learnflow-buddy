param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$learnflowRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$learnflowUrl = "http://127.0.0.1:$Port"
$learnflowReady = $false
try { $learnflowHealth = Invoke-RestMethod "$learnflowUrl/api/health" -TimeoutSec 2; $learnflowReady = $learnflowHealth.service -eq 'LearnFlow local adapter' } catch { }
if (-not $learnflowReady) {
  $learnflowNode = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $learnflowNode) { Start-Process -FilePath (Join-Path $learnflowRoot 'public\index.html'); exit }
  $env:LEARNFLOW_PORT = [string]$Port
  Start-Process -FilePath $learnflowNode -ArgumentList ('"' + (Join-Path $learnflowRoot 'server\server.mjs') + '"') -WorkingDirectory $learnflowRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}
Start-Process $learnflowUrl
