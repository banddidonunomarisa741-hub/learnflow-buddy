$ErrorActionPreference = 'Stop'
$learnflowServicePath = Join-Path $PSScriptRoot 'service/server.mjs'
if (-not (Test-Path -LiteralPath $learnflowServicePath)) {
    $learnflowServicePath = Join-Path $PSScriptRoot '../../service/server.mjs'
}
if (-not (Test-Path -LiteralPath $learnflowServicePath)) { throw '找不到 LearnFlow 服务。请先解压完整服务包。' }
if (-not $env:LF_PUBLIC_URL -or $env:LF_PUBLIC_URL -match 'example\.com|localhost|127\.0\.0\.1') { throw '生产环境需要真实公开 HTTPS 地址。' }
if (-not $env:LF_WORKBUDDY_CLIENT_ID -or -not $env:LF_WORKBUDDY_CLIENT_SECRET) { throw '请通过部署环境配置已审核应用凭证，不要写入发布包。' }
if (-not $env:LF_DATA_DIR) { throw '请设置独立持久数据目录 LF_DATA_DIR。' }
$learnflowNodeVersion = (& node --version).TrimStart('v').Split('.')[0]
if ([int]$learnflowNodeVersion -lt 24) { throw 'LearnFlow 远程服务需要 Node.js 24 或更新版本。' }
Push-Location -LiteralPath (Split-Path -Parent $learnflowServicePath)
try { & node './server.mjs' --production } finally { Pop-Location }
