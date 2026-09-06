# LearnFlow学习流动 · 本机插件

本机已安装到 LearnBuddy 的独立用户目录。使用官方插件命令注册，不改客户端程序，不接管无关任务。

## 怎么开始

新建 LearnBuddy 对话，输入：

> 启动 LearnFlow学习流动。我要复盘一道六级阅读题，先给一点提示，别急着告诉我答案。

想选学法，说“帮我选一个学习方法”；想留住成果，说“把刚才容易忘的地方整理成学习块”。保存时弹出带 F 标识的本机窗口，内容可以改；点保存才写文件，点“这次不保存”就取消。

| 想做什么 | 可以这样说 |
| --- | --- |
| 开始学习 | 启动 LearnFlow，一次只问我一个问题 |
| 找回内容 | 列出我保存在 LearnFlow 的学习资产 |
| 固定自己的方法 | 以后词汇课就用词族，先整理成个人策略让我看一眼 |
| 存教材 | 帮我保存一份 PDF，我来选文件 |
| 打开教材 | 打开我刚保存的那份 PDF |
| 撤回保存 | 删除这份学习块，我在窗口里确认 |

本机 LearnBuddy 5.3.8 已包含 MCP Apps 渲染代码，但通用入口在该版本中关闭，只放行其特定设计功能；LearnFlow 面板因此不能在这个版本里内嵌显示。插件会继续在对话中一次问一个问题，不会反复让你找面板。标准 MCP Apps 资源保留给开放通用入口的宿主使用。

想用可点击的学习界面，可以自行打开 [LearnFlow学习流动网页版](https://learnflow-buddy-2026.netlify.app/)。插件不会自动跳页。网页与宿主资料库独立，保存内容不会自动同步。模型选择、图片附件、原有腾讯连接器使用宿主自身界面。

## 在另一台 Windows 安装

1. 解压完整交付包或独立 learnflow-learnbuddy-install.zip，双击其中“安装LearnBuddy插件.cmd”。不需要 Python；请先安装 LearnBuddy / WorkBuddy。本地开发安装器需要 Node.js 20+；正式市场连接器声明托管运行时，仍需市场审核验证。
2. 在交付目录运行 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-learnbuddy.ps1`。
3. 如果没找到客户端，追加 `-ClientPath "你的 LearnBuddy.exe 完整路径"`；WorkBuddy 用 `-Client WorkBuddy`。
4. 重新打开技能页或新建对话。若没有即时刷新，正常退出再打开；脚本不会强行结束你的任务。

设置备份在对应宿主目录 `learnflow-backups/时间戳`。脚本保留其它插件及用户 MCP 配置，只新增 LearnFlow；本机分发目录为 `%LOCALAPPDATA%/LearnFlowHost/distribution/learnflow-marketplace`。

## 保存与卸载

资产位于 `%LOCALAPPDATA%/LearnFlowHost/assets`，每个编号目录含 record.json 和学习块.md、SKILL.md 或 document.pdf。迁移时保留整个编号目录。宿主库与网页库当前分开：PDF 可在网页学习资产再次导入，SKILL.md 可交给支持 Skill 的工具使用。

卸载：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-learnbuddy.ps1 -Uninstall`。移除插件注册和本安装器的 MCP 条目，保留个人学习资产与设置备份。

## QQ 与权限

宿主 QQ 走 LearnBuddy / WorkBuddy 原生助理中的 QQ 机器人入口。用户绑定后，远程任务才能进入该宿主。网页 QQ 是独立本机收件箱，授权互不替代。12 个 LearnFlow MCP 工具没有独立 QQ 收发接口。

## 1.4.2 桌面安装修正

此前官方 CLI 注册的是一个通用聚合插件；这不等于桌面的技能页已有独立技能卡，也不等于专家页已有四张专家卡。原先的安装完成表述过宽。新版安装器将 11 项技能写入客户端实际扫描的用户 skills 目录，另把四个专家作为独立 expert 插件注册，保留原来的 MCP 入口。

本机已核对 11 份 SKILL.md 与发行源文件逐字节相同，四个专家的启用配置和目录存在。复制公开技能时只写入内容，避免继承源文件的 Windows EFS 加密属性造成复制失败。已有同名个人技能不会覆盖；后续卸载会把本安装器管理的技能移到备份目录。

在“专家·技能·连接器”的“技能”页查找“LearnFlow学习流动”或“费曼”，在“专家”页查找“一起学 / 错题复盘 / 项目搭子 / 备课与评阅”。关闭这个页面再打开，必要时正常退出并重开客户端。本轮验证了实际文件和注册状态；尚未取得桌面卡片可见的截图证据，不把后台注册视作可视验收通过。

## 实测记录

官方插件校验与安装通过：11 个 Skill、4 个专家、12 个 MCP 工具。LearnBuddy 5.3.8 附带 CLI 真实调用策略检索，返回 11 张卡。0.2.1 补丁的 30 项自动检查通过，包含版本限制、对话回退和用户自行打开网页的检查；原生确认窗口此前用测试资料验证取消 / 保存，未写入用户个人资产。

三题选择、学法回传与空资料库在独立 MCP Apps 协议测试宿主中通过；LearnBuddy 5.3.8 的通用面板入口关闭，实际内嵌展示未通过验收。已只读核对安装包的前端门控及调用位置，资源路径、SHA-256 与结论记在 `buddy-app/host-validation.json`，交付包不包含客户端源码。其 CLI 在完整回复后出现 Windows 退出码 3221226505，未因这个问题放开用户全局权限，也未报告客户端稳定性通过。

参考：[官方插件规范](https://www.codebuddy.cn/docs/cli/plugins-reference)、[官方 MCP 配置](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)。
