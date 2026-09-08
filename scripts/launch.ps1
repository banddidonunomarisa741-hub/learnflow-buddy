param([int]$Port = 4173,[switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$learnflowRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$learnflowUrl = "http://127.0.0.1:$Port"
$learnflowReady = $false
try { $learnflowHealth = Invoke-RestMethod "$learnflowUrl/api/health" -TimeoutSec 2; $learnflowReady = $learnflowHealth.service -eq 'LearnFlow local adapter' } catch { }
# Only replace an older instance launched from this exact helper installation.
if ($learnflowReady -and $learnflowHealth.adapterVersion -ne '1.8.2') {
  $learnflowEntry = Join-Path $learnflowRoot 'server\server.mjs'
  $learnflowListener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($learnflowListener) {
    $learnflowProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($learnflowListener.OwningProcess)"
    if ($learnflowProcess.Name -eq 'node.exe' -and $learnflowProcess.CommandLine.IndexOf($learnflowEntry,[StringComparison]::OrdinalIgnoreCase) -ge 0) {
      Stop-Process -Id $learnflowProcess.ProcessId
      $learnflowReady = $false
    }
  }
}
if (-not $learnflowReady) {
  $learnflowNode = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $learnflowNode) { Start-Process -FilePath (Join-Path $learnflowRoot 'public\index.html'); exit }
  $env:LEARNFLOW_PORT = [string]$Port
  Start-Process -FilePath $learnflowNode -ArgumentList ('"' + (Join-Path $learnflowRoot 'server\server.mjs') + '"') -WorkingDirectory $learnflowRoot -WindowStyle Hidden
  Start-Sleep -Seconds 2
}
if(-not $NoOpen){Start-Process $learnflowUrl}
