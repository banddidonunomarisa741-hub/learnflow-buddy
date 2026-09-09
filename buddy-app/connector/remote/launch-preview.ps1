$ErrorActionPreference = 'Stop'
$learnflowServicePath = Join-Path $PSScriptRoot 'service/server.mjs'
if (-not (Test-Path -LiteralPath $learnflowServicePath)) {
    $learnflowServicePath = Join-Path $PSScriptRoot '../../service/server.mjs'
}
if (-not (Test-Path -LiteralPath $learnflowServicePath)) { throw '找不到 LearnFlow 服务。请先解压完整服务包。' }
$learnflowNodeVersion = (& node --version).TrimStart('v').Split('.')[0]
if ([int]$learnflowNodeVersion -lt 24) { throw 'LearnFlow 远程服务需要 Node.js 24 或更新版本。' }
Push-Location -LiteralPath (Split-Path -Parent $learnflowServicePath)
try { & node './server.mjs' --preview } finally { Pop-Location }
