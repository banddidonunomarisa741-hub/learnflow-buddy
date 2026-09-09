# LearnFlow学习流动 · Buddy 工程

## 新版 Buddy 服务 0.3.0

正式 Buddy 方向的新服务位于 `service/`：标准 HTTP MCP、MCP Apps 学习面板、SQLite 持久存储、课程邀请与核验、个人策略版本和主动分享。先阅读 [新版服务说明](service/README.md) 与 [控制台配置指南](../docs/BUDDY-CONSOLE-GUIDE.md)。新服务需要 Node.js 24；在 `service/` 安装依赖后运行 `npm run preview`，打开 `http://127.0.0.1:4318/preview`。

预览使用本机测试身份。公开部署、真实账号授权及指定 Buddy 客户端内的面板展示仍须验收。`app.config.source.json` 是填表源稿，不是伪造的平台导入文件。新服务的草稿持久保存为待确认记录，确认后成为学习资产；以下旧插件的内存草稿、Windows 窗口和 WPS 打开流程不适用于新远程服务。

## 原有本地插件入口

本工程可作为本地插件安装到 LearnBuddy / WorkBuddy，包含 11 个 Skill、4 个专家候选、12 个 MCP 工具和学习面板。正式 Buddy 应用仍需平台分配 ID、资源审核和指定客户端预览；本目录不伪造这些结果。

## 在本机开始

完整交付包或独立本机安装包解压后，双击“安装LearnBuddy插件.cmd”即可，不需要 Python。只有从源码自行构建时先运行 `python buddy-app/build.py --local-config`；命令行安装也可运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-learnbuddy.ps1`。默认安装到 LearnBuddy，另可用 `-Client WorkBuddy`。安装器调用官方 `plugin marketplace add` / `plugin install`，并将 LearnFlow MCP 合并到宿主支持的用户级 `mcp.json`。已有设置备份，不修改客户端程序或登录凭据。

新建对话后说：“启动 LearnFlow学习流动，先陪我复盘一道题。”想看面板就说“打开 LearnFlow 学习面板”。面板显示取决于宿主的 MCP Apps 支持；没有面板时仍可在对话中使用策略和资产工具。本插件不替换 LearnBuddy 首页和侧栏。

桌面安装包 `dist/learnflow-learnbuddy-install.zip` 已包含安装器和相对目录，通用插件包 `dist/learnflow-plugin.zip`；单独的 Skill、专家与连接器 ZIP 也在 dist。开发安装器在上级 scripts 目录。详细步骤见 [本机安装说明](../docs/LEARNBUDDY-INSTALL.md)。

## 工具与资产

| 能力 | 工具 |
| --- | --- |
| 找学法、读步骤 | list_learning_strategies、get_learning_strategy |
| 学习块、个人策略草稿 | draft_learning_block、draft_personal_strategy |
| 保存前检查修改 | review_learning_draft |
| 查看确认结果 | get_learning_review_status |
| 资料库、读取复用 | list_learning_assets、read_learning_asset |
| 导入用户亲自选择的 PDF | import_learning_pdf，最多 30 MB |
| 用本机默认程序打开 | open_learning_asset |
| 删除本机副本 | delete_learning_asset |
| 学法卡片、三题入门选择、资料库面板 | show_learning_workspace |

模型没有“confirmed=true 就直接保存”的接口。草稿在内存保留 30 分钟；真正写入和删除需要用户点击 Windows 原生确认窗口。内容可以修改，也能取消；pending 不能说成保存成功。PDF 只能复制用户在文件选择框里选中的文件，不扫描磁盘，删除副本不删原教材。

资产位于 `%LOCALAPPDATA%/LearnFlowHost/assets`，格式为 Markdown、SKILL.md 或 PDF。它与网页资料库目前分开，可把实际文件导出后交给其它工具使用。其它系统可使用策略和草稿，原生保存窗口尚未移植，不宣传全平台完整支持。

## 腾讯生态

LearnBuddy / WorkBuddy 内的 QQ 远程任务走宿主自己的“助理 / QQ 机器人”绑定。绑定后，QQ 任务可以使用已安装 LearnFlow Skill / MCP，仍服从宿主授权。腾讯文档、会议等也由实际安装并授权的宿主连接器提供。

网页 QQ 是另一个本机收件箱和独立授权入口。这 12 个 MCP 工具不直接收发 QQ，安装插件不等于 QQ 已绑定。不要把网页扫码与宿主扫码混为一份许可。详见 [腾讯连接说明](../docs/TENCENT-CONNECTORS.md)。

## 验证范围

本机 LearnBuddy 5.3.8 官方 CLI 插件 / 市场结构验证与安装成功；真实模型通过 MCP 读取了 11 张策略卡。该 CLI 在完整结果后仍出现 Windows 退出码 3221226505，记为宿主异常，没有报告整体稳定性通过。

`node scripts/test-buddy-host.mjs` 有 26 项检查，覆盖草稿不落盘、确认 / 取消、修改后保存、跨实例读取、删除、路径限制和 MCP Apps 资源。原生窗口使用测试资料做过后台按钮验证，取消与保存返回不同结果。面板在独立 MCP Apps 协议测试宿主中完成真实 stdio 数据加载、逐题选择与学法回传；LearnBuddy 实际内嵌面板展示仍待指定客户端验证。

## 正式发布

app.config.source.json 是控制台填表源稿，不是腾讯官方导入 JSON。工程提供 3 个工作模式、7 个场景入口、头像与日夜背景。`python buddy-app/build.py --release` 在真实前置条件缺失时应退出 2。

自动内置连接器需遵守 Buddy 文档的 OAuth 绑定要求，本地 stdio 不冒充 OAuth 服务。资源通过审核后回填真实 ID，再导出官方 JSON，完成指定客户端预览。[发布检查单](../docs/BUDDY-RELEASE-CHECKLIST.md) 列出材料与剩余条件。

官方依据：[Buddy 应用](https://open.workbuddy.cn/docs/buddy-app)、[连接器](https://open.workbuddy.cn/docs/connector)、[Skill](https://open.workbuddy.cn/docs/skill)、[专家](https://open.workbuddy.cn/docs/expert)、[插件规范](https://www.codebuddy.cn/docs/cli/plugins-reference)、[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview)。
