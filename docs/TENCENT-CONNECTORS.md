# QQ 接入与学习提醒

产品名称：**LearnFlow学习流动**。本页记录当前实现、实际验证和使用限制。

## 现在可以做什么

在网页的「连接器」里点击「扫码连接 QQ」。本机窗口说明权限后，点击「同意接入，用 QQ 扫码」，用手机 QQ 扫码并确认。连接成功后，网页会显示 QQ 已连接。

1. **手机布置任务**：给自己的 QQ 机器人发送文字，LearnFlow 收件箱会收到它。点击「带到学习空间」成为可编辑草稿；不会把陌生人的消息直接当作电脑操作指令。
2. **回复 QQ**：在收件箱选择具体消息，编辑回复，确认收件人和内容后发送。平台接收回执与“已阅读”是两回事，本产品只报告前者。
3. **学习提醒**：选择已扫码或已发来私聊的账号、消息内容和具体时间。勾选确认后，到点发送一次。可以提前取消。
4. **撤回本机连接**：点击断开 QQ，关闭网关并清除本次连接的凭据、收件和提醒。若要使机器人身份本身失效，仍需在 QQ 开放平台停用机器人或重置密钥。

整个流程使用 QQ 的公开机器人接口。它不读取 WorkBuddy/LearnBuddy 的登录缓存，不把已有宿主授权当作网页授权，也不要求用户将腾讯访问令牌粘贴进网页。

## 第一次需要本人做的事

- 准备已实名的 QQ 账号，按 [QQ 开放平台](https://q.qq.com/) 提示创建并启用属于自己的机器人。
- 用手机 QQ 扫码，并在手机上确认选择的机器人及权限。这个动作只能由账号持有人完成。
- 未公开发布的机器人按平台提供的沙箱范围测试；是否需要补充 IP 白名单或能力申请，以自己的机器人控制台为准。
- 如果同一个机器人已经连接了 WorkBuddy，建议为 LearnFlow 创建独立测试机器人，避免多个程序争用同一网关会话。
- 企业 Buddy 应用审核与这个 QQ 机器人的接入是不同事项。QQ 测试接通不意味着 Buddy 应用已取得公开发布资格。

扫码不便时，本机授权页保留 AppID / AppSecret 手动输入。字段只提交到回环地址，AppSecret 提交后立即从输入框清空；没有把它存进浏览器 localStorage、磁盘配置、源码或发布包。

## 运行方式与限制

QQ WebSocket 是本机主动连向腾讯的连接，当前版本不需要额外公网服务器或公网回调地址。电脑需要开机、联网，LearnFlow 连接助手需要持续运行。

| 项目 | 当前行为 |
| --- | --- |
| 收件范围 | 发给所连机器人的 C2C 私聊文字；群消息不会进入学习收件箱 |
| 历史和联系人 | 不读取 QQ 聊天历史，不拉取好友列表 |
| 附件 | 只显示是否有附件，不自动下载远程文件；在 QQ 下载后可自行拖入学习对话 |
| 模型调用 | 带入学习空间后由用户编辑和发送，采用当前学习策略与模型 |
| 自动执行电脑操作 | 未开启；QQ 来信本身不是执行脚本、读取磁盘或发送消息的授权 |
| 即时回复 | 关联真实入站消息；本产品使用保守的 4 分钟回复窗口，超时要求对方再发消息 |
| 定时提醒 | 单次、10 秒后至 7 天内；收件人、内容和时间在创建时一起确认 |
| 错过提醒 | 延迟超过 1 分钟不补发；记录“已错过”，避免电脑恢复后突然发送旧提醒 |
| 主动消息 | 受 QQ 实际权限、互动条件、额度及频率限制，不承诺任意用户无限提醒 |
| 保存 | 凭据、收件与提醒仅在本机服务内存；退出或断开即清除，不跨设备同步 |
| 状态 | 扫码中、连接中、已连接、重连中、失败；只收到网关 READY / RESUMED 才报告连接成功 |

“断开”会阻止之后的发送；已经提交给 QQ 的消息不能通过停止本机进程保证撤回。发送超时或回执不确定时，界面提示先在 QQ 核对，不会后台自动反复发送。

## 与 WorkBuddy 自带 QQ 助理的关系

[腾讯官方 QQ 接入指南](https://www.codebuddy.cn/docs/workbuddy/QQ-Guide)提供的路径是「助理设置 → QQ 机器人集成」，支持扫码或手动配置。它可以直接让 QQ 消息成为宿主任务。LearnFlow 的 Skill/MCP 安装到宿主后，用户可以在该任务里使用对应能力。

网页里新增的是另一条明确的连接：**QQ 机器人 → LearnFlow 本机收件箱 → 学习空间**。两个产品的授权和任务状态没有被偷偷合并。宿主里的绑定状态要在宿主查看；网页不会凭“用户安装了 WorkBuddy”就显示 QQ 已接通。

腾讯文档、腾讯会议等暂沿用宿主的正式连接器入口，按用户选择的资料授权。它们没有被标记成已经与本网页接通。本轮按用户明确选择优先完成 QQ。

## 协议与源码依据

核查日期：2026-09-06。

- [腾讯 WorkBuddy QQ 接入指南](https://www.codebuddy.cn/docs/workbuddy/QQ-Guide)：实名 QQ、创建机器人、扫码或 WebSocket 配置。
- [腾讯 WorkBuddy 助理说明](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Assistant)：手机远程任务、保持电脑运行。
- [Tencent 官方 qqbot-nodejs](https://github.com/tencent-connect/qqbot-nodejs)：OpenAPI、网关连接、消息收发和凭据更新。
- [官方 Node SDK 使用指南](https://github.com/tencent-connect/qqbot-nodejs/blob/main/USAGE.md)：C2C 回复、主动消息限制和事件回调。
- [Tencent 官方扫码绑定源码](https://github.com/tencent-connect/qqbot-agent-sdk/blob/6163b5dc979a2f12379b1916805009075008c3c3/src/qqbot_agent_sdk/onboard.py)：创建绑定任务、轮询结果、AES-256-GCM 解密。
- [同版扫码端点定义](https://github.com/tencent-connect/qqbot-agent-sdk/blob/6163b5dc979a2f12379b1916805009075008c3c3/src/qqbot_agent_sdk/constants.py)：`q.qq.com/lite/*` 和官方二维码地址模板。模板路径中包含 `openclaw` 是腾讯 SDK 自带的通用接入页路径；LearnFlow 使用自己的 `source=learnflow`，没有冒充别的产品。

扫码使用临时 AES 密钥，通过 HTTPS 提交给腾讯以加密返回的机器人凭据。本机核验 AES-GCM 认证标签后才启动连接。前端只获得官方扫码链接、短期本机绑定编号和脱敏状态，拿不到解密密钥、AppSecret 或 access_token。

## API 与集成

`server/tencent-ecosystem.mjs` 导出 `qqConnector.route(method, pathname, data, local)`。

| 路径前缀 `/api/ecosystem/qq/` | 方法 | 授权要求 |
| --- | --- | --- |
| `status`、`inbox` | GET | 本机同源，或已在本机批准配对的网站 |
| `bind/start` | POST | 仅本机；`consent:true`；返回扫码链接和临时编号 |
| `bind/poll` | POST | 仅本机；绑定编号一致且尚未过期 |
| `connect` | POST | 仅本机；手动机器人身份与 `consent:true` |
| `take`、`dismiss` | POST | 当前连接授权 + 对应消息编号 + 明确确认 |
| `send` | POST | 确定收件账号、内容、可选关联来信、唯一操作编号和明确确认 |
| `reminders` | POST | 确定收件账号、内容、时间、唯一操作编号和明确确认 |
| `reminders` | DELETE | 对应提醒编号和明确确认 |
| `disconnect` | POST | 明确确认，立即清理本机状态 |

外层服务负责回环 Host、Origin 及网页配对许可验证；模块再次限制三个身份配置端点只能在本机执行。收件账号只能来自本次扫码或真实入站消息，不能从前端任意指定一个 OpenID 发送。重复的发送编号复用结果，不重复发信；同编号改内容会被拒绝。

`public/ecosystem.js` 导出 `window.LearnFlowEcosystem.view()` / `mount()` / `open()`。点击带入学习空间时发出 `learnflow-qq-task` 事件，其 `detail` 只有消息正文、来源和本机编号。

## 验证记录

- 真实公有服务：成功创建 QQ 扫码任务，轮询返回“等待本人确认”；普通直连和本机代理均可用。
- 51 项隔离协议与权限检查通过：授权前不联网、本机配置限制、扫码结果认证、取消与过期、脱敏、带点号的消息编号、入站去重、群消息不收取、收件待确认、发送内容和对象绑定、重复发送阻止、提醒与错过处理。
- 20 项 HTTP 权限检查通过：不受信来源和未配对网页不能读收件；已配对网站仍不能调用本机身份配置；发送或设提醒必须确认；配对撤销立即失效。
- 运行命令：`node scripts/test-qq-connector.mjs` 和 `node scripts/test-qq-http.mjs`。自动检查使用模拟 QQ 回应，不向任何 QQ 账号发消息。
- **已由本人扫码实测**：真实机器人返回 READY，网页显示已连接；用户明确指定发给扫码本人的唯一测试提醒，按设定时间触发，QQ 平台返回消息接收回执。没有把平台回执当作对方已读，没有额外重复发送。
- **尚待新版复测**：手机来信进入 LearnFlow 收件箱。旧测试进程对带点号消息编号的校验过窄，磁盘版本已修复，需在新进程重新扫码后验证实际收件，不用模拟数据冒充。

测试维护记录：一次自有 Node 测试进程热更新的清理错误导致服务退出，内存凭据随之清除，需要本人重新扫码。没有读取或导出账号凭据；临时脚本已删除，后续通过正常重启加载修复版本。

## 第三方组件

`@tencent-connect/qqbot-nodejs@1.0.4` 和其 `ws@8.21.3` 被固定打包到 `server/vendor/qqbot-sdk.mjs`；用户安装连接助手时不必执行 npm 下载。二维码由本地 `qrcode-generator@1.4.4` 生成，不向第三方二维码网站提交授权链接。

各组件采用 MIT 许可，许可证在 `server/vendor/QQBOT-LICENSE`、`server/vendor/QQ-ONBOARD-LICENSE`、`server/vendor/WS-LICENSE`、`public/vendor/QRCODE-LICENSE`。扫码协议是按官方公开 Python 源码独立实现的 Node 适配；没有读取或复制用户已有的客户端凭据。
