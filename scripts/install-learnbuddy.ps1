param([ValidateSet('LearnBuddy','WorkBuddy')][string]$Client = 'LearnBuddy', [string]$ClientPath, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$configRoot = Join-Path $env:USERPROFILE ('.' + $Client.ToLowerInvariant())
$distributionRoot = Join-Path $env:LOCALAPPDATA 'LearnFlowHost\distribution'
$backupRoot = Join-Path $configRoot ('learnflow-backups\' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$sourceMarket = Join-Path $projectRoot 'buddy-app\dist\learnflow-marketplace'
if (-not (Test-Path -LiteralPath $sourceMarket)) { throw '找不到已构建安装包。请先运行 python buddy-app/build.py，或使用完整交付包。' }
if (-not $ClientPath) {
  foreach ($key in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall')) {
    foreach ($item in @(Get-ItemProperty -Path "$key\*" -ErrorAction SilentlyContinue)) {
      if ($item.DisplayName -eq $Client -or $item.DisplayName -like "$Client *") {
        $candidate = ([string]$item.DisplayIcon) -replace ',\d+$',''
        $candidate = $candidate.Trim('"')
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { $ClientPath = $candidate; break }
      }
    }
  }
}
if (-not $ClientPath -or -not (Test-Path -LiteralPath $ClientPath -PathType Leaf)) { throw "没有找到 $Client。请用 -ClientPath 指定该客户端的 exe 路径。" }
$clientRoot = Split-Path -Parent $ClientPath
$cli = Join-Path $clientRoot 'resources\app.asar.unpacked\cli\bin\codebuddy'
if (-not (Test-Path -LiteralPath $cli)) { throw '这个客户端没有可用的官方插件安装 CLI，请更新客户端或在技能页导入单独 Skill ZIP。' }
$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  $possible = Get-ChildItem -LiteralPath (Join-Path $configRoot 'vendor') -Filter node.exe -Recurse -File -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($possible) { $nodePath = $possible.FullName } else { throw '本地开发安装器需要 Node.js 20+。正式市场连接器配置已经声明平台托管 Node 运行时；本脚本不会替你下载安装器。' }
} else { $nodePath = $nodeCmd.Source }
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
foreach ($relative in @('settings.json','mcp.json','plugins\known_marketplaces.json','plugins\installed_plugins.json')) {
  $original = Join-Path $configRoot $relative
  if (Test-Path -LiteralPath $original) { $backup = Join-Path $backupRoot $relative; New-Item -ItemType Directory -Force -Path (Split-Path -Parent $backup) | Out-Null; Copy-Item -LiteralPath $original -Destination $backup }
}
$priorCodebuddyDir = $env:CODEBUDDY_CONFIG_DIR
$priorWorkbuddyDir = $env:WORKBUDDY_CONFIG_DIR
try {
  $env:CODEBUDDY_CONFIG_DIR = $configRoot
  $env:WORKBUDDY_CONFIG_DIR = $configRoot
  if ($Uninstall) {
    & $nodePath $cli plugin uninstall 'learnflow@learnflow-local' --scope user
    if ($LASTEXITCODE -ne 0) { throw '官方插件卸载命令失败。个人学习资产未删除。' }
    $mcpPath = Join-Path $configRoot 'mcp.json'
    if (Test-Path -LiteralPath $mcpPath) {
      $mcp = Get-Content -LiteralPath $mcpPath -Raw -Encoding UTF8 | ConvertFrom-Json
      if ($mcp.mcpServers.learnflow -and ([string]$mcp.mcpServers.learnflow.args[0]).StartsWith($distributionRoot,[StringComparison]::OrdinalIgnoreCase)) {
        $mcp.mcpServers.PSObject.Properties.Remove('learnflow')
        $mcp | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $mcpPath -Encoding UTF8
      }
    }
    Write-Output 'LearnFlow 插件已卸载。个人学习资产仍在 LocalAppData/LearnFlowHost/assets。'
    return
  }
  New-Item -ItemType Directory -Force -Path $distributionRoot | Out-Null
  Copy-Item -LiteralPath $sourceMarket -Destination $distributionRoot -Recurse -Force
  $marketPath = Join-Path $distributionRoot 'learnflow-marketplace'
  & $nodePath $cli plugin validate (Join-Path $marketPath 'plugins\learnflow')
  if ($LASTEXITCODE -ne 0) { throw '本机官方 CLI 未通过插件结构验证；停止安装。' }
  # Desktop MCP Apps discover user connectors through the host proxy. Use that supported route
  # in this local install, avoiding a second plugin-owned copy of the same MCP process.
  $pluginMcpPath = Join-Path $marketPath 'plugins\learnflow\.mcp.json'
  '{"mcpServers":{}}' | Set-Content -LiteralPath $pluginMcpPath -Encoding UTF8
  $mcpPath = Join-Path $configRoot 'mcp.json'
  if (Test-Path -LiteralPath $mcpPath) { $mcp = Get-Content -LiteralPath $mcpPath -Raw -Encoding UTF8 | ConvertFrom-Json } else { $mcp = [pscustomobject]@{mcpServers=[pscustomobject]@{}} }
  if (-not $mcp.mcpServers) { $mcp | Add-Member -NotePropertyName mcpServers -NotePropertyValue ([pscustomobject]@{}) -Force }
  if ($mcp.mcpServers.learnflow -and -not ([string]$mcp.mcpServers.learnflow.args[0]).StartsWith($distributionRoot,[StringComparison]::OrdinalIgnoreCase)) { throw '已有其它同名 learnflow MCP 配置。为保留它，本次没有覆盖。' }
  $serverPath = Join-Path $marketPath 'plugins\learnflow\mcp\strategy-server.mjs'
  $entry = [pscustomobject]@{type='stdio';command=$nodePath;args=@($serverPath);timeout=30000}
  $mcp.mcpServers | Add-Member -NotePropertyName learnflow -NotePropertyValue $entry -Force
  $mcp | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $mcpPath -Encoding UTF8
  & $nodePath $cli plugin marketplace add $marketPath
  if ($LASTEXITCODE -ne 0) { throw '本地插件市场注册失败。备份已保留。' }
  & $nodePath $cli plugin install 'learnflow@learnflow-local' --scope user
  if ($LASTEXITCODE -ne 0) { throw '官方插件安装命令失败。备份已保留。' }
  $receipt = @{ product='LearnFlow学习流动'; version='0.2.0'; client=$Client; installedAt=(Get-Date).ToUniversalTime().ToString('o'); configRoot=$configRoot; backup=$backupRoot; marketplace=$marketPath; method='official-plugin-cli-and-user-mcp'; mcpConfig=$mcpPath; personalAssets=(Join-Path $env:LOCALAPPDATA 'LearnFlowHost\assets') }
  $receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $distributionRoot ('installation-' + $Client.ToLowerInvariant() + '.json')) -Encoding UTF8
  Write-Output "已用官方插件命令安装到 $Client。新建一条对话，说：启动 LearnFlow学习流动。"
  Write-Output "设置备份：$backupRoot"
  Write-Output '没有修改客户端程序，也没有读取登录卡密。若技能列表尚未刷新，请重新打开技能页；必要时正常退出并重开客户端。'
} finally {
  $env:CODEBUDDY_CONFIG_DIR = $priorCodebuddyDir
  $env:WORKBUDDY_CONFIG_DIR = $priorWorkbuddyDir
}
