# LearnFlow · Buddy 应用工程交付

本目录提供可复用策略、专家、实际 MCP 工具和一份逐模块控制台配置源稿。**尚未创建平台应用、取得应用 ID、导入官方配置、完成宿主预览或发布。**公开 Buddy 文档没有给出完整导入 JSON schema，因此 app.config.source.json 是本项目工程格式，不能宣称腾讯可直接导入。

## 立即使用

1. 在任意支持 SKILL.md 的学习 Agent 中安装 skills/ 下需要的策略。它们是通用 Markdown 与 metadata，保持触发范围和用户选择，能力仍受宿主模型与工具限制。
2. 使用 Node.js 20+ 启动 `node buddy-app/mcp/strategy-server.mjs`，通过 MCP 客户端调用三个只读工具。手动终端里没有界面是正常的，因为它接收 JSON-RPC。
3. 运行 `python buddy-app/build.py --local-config`。dist/ 下得到 10 个独立 WorkBuddy Skill ZIP、4 个专家 ZIP、1 个连接器 ZIP和完整源包。local-mcp.json 含本机绝对路径，仅用于本机导入，不纳入开源 source ZIP。

## 格式与边界

可移植 Skill 源文件把 WorkBuddy 的版本、作者、展示名等放在 metadata；构建工具将其转换为官方要求的顶层字段。专家目录使用 .codebuddy-plugin/plugin.json、agents/、avatars/、skills/，所有引用经过本地验证。专家公开邮箱尚空缺，不能以此通过正式发布校验。`python buddy-app/build.py --release` 在发布必填项仍缺失时应退出 2，这是预期保护，不代表源包损坏。

MCP 工具是策略与工具接口的分工实例，Skill 无需“变成 MCP”才有价值。工具负责稳定检索和结构化草稿，Skill 决定何时用、如何教学；两者都需要在更换模型或宿主后复测。默认 MCP 不读取用户学习文件，不存储记忆，没有腾讯文档、QQ、微信或会议的真实授权。

前端 8 张卡的 ID 对照：evidence → exam-evidence；roots → root-affix；feynman → feynman；retrieval → retrieval；socratic → socratic；pbl → pbl-coach；plain → plain-tone；teacher → formative-evidence。self-map 与 memory-distill 是场景引导和记忆流程的支持技能。

## 按官方五模块落地

| 控制台模块 | 本目录对应材料 | 待平台填写的内容 |
| --- | --- | --- |
| 创建应用 | app.config.source.json 的 app；assets/app-icon-256.png | 主体、应用 ID、授权项、回调与可信域 |
| 首页配置 | home；modes/；7 个场景胶囊 | 把本地策略/专家标识映射为已审核资源 ID |
| 市场配置 | dist/ 中 Skill、专家、连接器包 | 先提交资源，回填市场资源引用；自动内置连接器按官方 OAuth 要求配置 |
| 其他配置 | other | 双语占位文案；从控制台实际模型池选择，不臆造模型 ID |
| 预览调试 | 前端本地演示、validation-report.json | 下载指定 WorkBuddy 客户端，打开平台预览链接，导出官方 JSON |

专家页精选场景已提供 assets/featured-day.png 与 featured-night.png 两套 1000×910 背景；每套由极简学习插画底图与三层独立渐变蒙层组成，左侧保留内容空间。对应 SVG 可编辑，标识统一使用团队提供的 F 形 Logo。控制台资源也复制到 dist/console-assets/，并纳入完整 Buddy 源包。应用头像是 256×256；专家头像共用统一 F 形标识，512×512 且小于 500 KB。仓库 assets/icon-16.svg 用于 16px 交互图标，不能拿 512px 头像替代线性图标规范。

如需重新生成背景，安装 Sharp 后运行 `node buddy-app/generate-backgrounds.mjs`；也可通过 LEARNFLOW_SHARP_MODULE 指定已有 Sharp 模块路径。普通打包只使用已生成的 SVG/PNG，无需安装图像库。

## 发布前仍需完成

主体资格与相应教育类目以控制台及腾讯审核为准。官方入驻存在个人认证，但未核验个人账号的 Buddy 创建权限，不能下“必须先办公司”或“个人一定能发”的结论。可先开源策略和本地演示，同时向平台核验是否可使用学校/合作单位主体。

真实 OAuth 由本人/主体完成，不能复制桌面会话 token 代替。学习者评分、使用强度是本地单用户原型数据，尚无公共多人市场、反刷量与在线审核服务。用户测试、延迟保持和迁移测验尚未完成，不能宣传已证明提分或教学效果。

用户的六级项目作为方法参考：[CET-6 Review Skill](https://github.com/banddidonunomarisa741-hub/cet6-intellect-crush-review-skill)。此包重新编写通用应试策略，没有复制题库、用户私人资料或原仓库全部实现。

官方依据：[Buddy 应用](https://open.workbuddy.cn/docs/buddy-app)、[Skill 格式](https://open.workbuddy.cn/docs/skill)、[专家格式](https://open.workbuddy.cn/docs/expert)、[连接器格式](https://open.workbuddy.cn/docs/connector)。
