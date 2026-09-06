param([int]$Port = 4173)
$ErrorActionPreference = 'Stop'
$learnflowRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$learnflowNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $learnflowNode) { throw '需要 Node.js 20 或更新版本。安装后重新运行本脚本。' }
$env:LEARNFLOW_PORT = [string]$Port
Write-Host "LearnFlow 本地演示：http://127.0.0.1:$Port"
Write-Host '按 Ctrl+C 停止。未配置接口时返回真实的未连接状态，网页预设演示仍可使用。'
& $learnflowNode (Join-Path $learnflowRoot 'server\server.mjs')
