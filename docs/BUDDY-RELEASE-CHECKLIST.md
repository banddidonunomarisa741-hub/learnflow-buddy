# LearnFlow学习流动 · Buddy 发布检查单

按交付条件检查，不预设企业认证或审核需要几天。公司注册、平台主体认证、资源审核与应用审核是不同条件。

## 已备材料

| 控制台模块 | 本地材料 | 内容 |
| --- | --- | --- |
| 创建应用 | buddy-app/app.config.source.json、assets/app-icon-256.png | 正式名、简介、F 标识 |
| 首页 | 同文件 home、buddy-app/modes | 3 个模式、7 个场景及关联关系 |
| 技能 | buddy-app/dist/skill-*.zip | 11 个 Skill |
| 专家 | buddy-app/dist/expert-*.zip | 4 个候选专家、512×512 头像、双语字段 |
| 连接器 | buddy-app/dist/connector-learnflow-learning-strategies.zip | 12 个本地工具、原生确认、MCP Apps |
| 精选场景 | assets/featured-day.png、featured-night.png | 1000×910 日夜背景、三层渐变源 SVG |
| 其它配置 | app.config.source.json 的 other | 双语输入提示、记忆默认关闭、模型选择策略 |
| 开发内测 | learnflow-plugin.zip、learnflow-learnbuddy-install.zip | 官方插件格式的本地安装包 |

源稿为本项目工程格式，不是腾讯官方导出 JSON。

## 企业认证后仍需完成

- [ ] 确认主体权限及实际服务类目。开源、非盈利不会替代平台要求。
- [ ] 填写团队真实公开邮箱；experts.source.json 当前留空，不能编造。
- [ ] 创建应用，取得真实应用 ID、Client ID；Secret 只存私有服务配置，不进网页、Skill、GitHub 或 ZIP。
- [ ] 上传 Skill、专家、连接器，完成资源审核，记录实际资源 ID。
- [ ] 用真实 ID 映射模式、场景和市场，再导出官方 JSON。
- [ ] 从当时的官方模型池选模型；本机 CLI 模型列表不是应用授权模型池。
- [ ] 按实际功能配置最小授权、可信 Origin 与回调域名。
- [ ] 在指定客户端逐项预览：首次进入、撤回、逐题选择、图片附件、模型切换、保存 / 取消、下次找回、打开资料、错误提示。
- [ ] 验证市场连接器的托管运行时和包内相对路径，不能携带开发机路径。
- [ ] 在开放普通 MCP Apps 的指定客户端验证真实显示。本机 LearnBuddy 5.3.8 的普通入口尚关闭；独立协议测试不能替代此项。
- [ ] 通过创建审核与配置审核后发布；后续更新按平台要求重新审核。

## 两种连接方式

当前 stdio MCP 在用户电脑运行，以 Windows 原生窗口确认保存，适合本机内测；它不是公共云端策略市场。

如果正式 Buddy 要首次进入自动绑定远程服务，应按官方要求部署支持 OAuth 的 HTTPS MCP，补齐身份、撤销与数据删除。当前 builtInConnectors 为空，不能把本地 stdio 伪装成 OAuth 服务。

QQ、腾讯文档等引用实际已授权的宿主连接器。网页 QQ 使用独立扫码和收件箱，详见 docs/TENCENT-CONNECTORS.md；LearnFlow MCP 通了，不代表其它业务已授权。

## 已验证与待验证

已验证：本机官方插件校验 / 安装、MCP 连接和模型读回策略、26 项检查、原生确认按钮、协议面板交互。

待验证：主体与类目、市场 ID、指定客户端面板预览、正式配置导出、平台审核。LearnBuddy 5.3.8 CLI 完整回复后的退出异常保留在记录中。

运行 `python buddy-app/build.py --release` 会在真实前置条件缺失时退出 2，并写 validation-report.json。这表示不能宣称现在已正式可发布，不表示不能开发或本机使用。

官方依据：[Buddy 配置与发布](https://open.workbuddy.cn/docs/buddy-app)、[连接器](https://open.workbuddy.cn/docs/connector)、[专家](https://open.workbuddy.cn/docs/expert)、[Skill](https://open.workbuddy.cn/docs/skill)。
