# LearnFlow 本地接口

需要 Node.js 20+，没有 npm 依赖。仓库根目录执行 `node server/server.mjs`，打开 http://127.0.0.1:4173。Windows 也可运行 `powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1`。

服务仅监听 127.0.0.1，只公开 public/。适配器不提取桌面登录密钥或浏览器配置；仅检测安装元数据，CLI 自己处理正常认证，不保存对话，不记录请求正文或密钥。每个浏览器 Origin 有自己的 localStorage；换域名、端口或清除站点数据都可能导致看不到原有数据，请先导出。

## 点击连接（新增）

线上页面点击“连接学习助手”，下载 ZIP，解压并运行“安装连接助手.cmd”。安装到当前用户 LocalAppData/ LearnFlowConnector，注册 learnflow://connect；无需管理员权限。之后点击打开按钮进入本机页面，在本机确认内容发送范围。学习记录按网站地址隔离，请通过导出/恢复备份迁移。

本机页面自动检测 WorkBuddy 附带的公开 CodeBuddy CLI；选择并同意后使用 `-p --tools "" --strict-mcp-config --setting-sources "" --no-session-persistence` 进行文本推理。内容通过 stdin 传递，无 shell 拼接。该入口经过当前机器 WorkBuddy 5.4.7 实测，但不是 LearnBuddy 原生 API，也不保证其他安装版本支持。CLI 通过自身认证调用模型，适配器不读取或复制密钥。可能使用账号额度；服务商自身的数据保留政策仍适用。

也可在表单填写兼容 API 或正式 OAuth 访问令牌，不必编辑环境变量。配置仅保留在服务内存，断开清除；程序重启需重新同意。关闭页面不等于停止本机服务。服务保留严格同源限制，公网网页不能直接读取本机连接配置。

## 其他正式接口

默认不连接任何模型：`GET /api/health` 的 configured 为 false，`POST /api/chat` 返回 503/MODEL_NOT_CONFIGURED。页面预设对话不是模型回答。

1. **标准模型服务**：在启动进程的环境变量中设置 `LEARNFLOW_PROVIDER=openai-compatible`、`LEARNFLOW_API_BASE`（例如本人有权使用的 HTTPS 服务的 /v1 基址）、`LEARNFLOW_MODEL`、`LEARNFLOW_API_KEY`。本机 Ollama 等兼容服务可用 HTTP loopback，若服务本身无鉴权可不设置 key。服务发送标准 `/chat/completions` 请求；此模式不称为 LearnBuddy 原生 API。重定向被拒绝以避免凭据被转发到其他站点。
2. **官方 WorkBuddy 本地助理**：须先完成开放平台应用审核、OAuth 2.1 授权，取得 user.localassistant.readable 和 user.localassistant.invokable 两项 scope。仅将正式授权所得 access_token 注入 `LEARNFLOW_WORKBUDDY_ACCESS_TOKEN`；设置 `LEARNFLOW_PROVIDER=workbuddy-localassistant` 和 `LEARNFLOW_WORKBUDDY_ENABLE_AGENT=true`。额外开关表示已知此接口会驱动 PC 端 Agent 执行任务，而非纯文字推理。程序使用官方固定域名，检查在线后发消息并增量读取回复。不得从桌面缓存提取 token。当前未取得合法应用凭据，未作腾讯真实服务联调，也未实现 OAuth 登录/刷新服务。

WorkBuddy 消息接口是共享宿主会话，公开接口没有本适配器需要的任务隔离、完成态及 token 消耗字段。适配器仅序列化自身请求、返回收到的增量文字；不保证外部并行消息的归属或整个任务已完成。首次收到文字返回 received；30 秒无文字返回 202/pending；宿主要求确认返回 requires_action。应到 WorkBuddy 检查后续结果，不自动代答审批，不重试可能已受理的消息。

静态 Netlify / GitHub Pages 网站不运行本后端，可通过连接向导安装并打开本机页面。使用本地完整版本时，前后端由同一 loopback 服务提供。不要把 API 密钥放入 HTML、localStorage、URL 或公开仓库。不要为了静态网页方便而放宽本机 API 的 Origin 校验。

## 前后端契约

POST /api/chat，请求 Content-Type 为 application/json：

```json
{"messages":[{"role":"user","content":"请用词根词缀带我记词"}],"strategies":[{"id":"root-affix","title":"词根词缀","instructions":"先拆词，再回忆，后造句。"}],"preferences":{"memoryEnabled":false,"tone":"直接","guidance":"适中"},"scene":"exam"}
```

可选 memories 为最多 20 条 `{id,title,content}`，由前端选择当前场景已确认的偏好。只有 memory / memoryEnabled 明确开启时才传给模型，关闭时忽略。它们位于低信任的 confirmedLearningMemories 字段，不能授予额外权限。后端不自行持久化；浏览器负责用户确认、修改和删除。前端偏好 guide、style、encourage 校验为支持的枚举，minutes 为 1 至 240 的整数。

成功结果包含 reply、provider、model、status、usage。usage.total_tokens 只有供应商实际报告时为整数，否则为 null，source 为 unavailable。多卡片同时启用时返回的是整轮消耗，**不能将总量给每张卡各计一次，也不能据此声称某张卡学习效果更好**。平台可单列「涉及该卡的会话消耗」并标为非独立归因。

错误包含 error（稳定机器码）与 message（可展示说明），不带上游错误正文或密钥。401 为授权问题；409 为本适配器尚有 WorkBuddy 请求；413 为内容超限；503 为未配置或宿主离线；502/504 为上游异常。配置状态只代表配置具备，不代表凭据有效。

策略与导入内容仅作为低信任学习设置，不能扩张用户权限。后端拒绝客户端 system 角色，并把固定边界放在独立 system 消息中；这不能替代宿主自身安全控制。开启真实模型后，用户发送的消息和选中策略将交由所配置的模型服务处理，页面应明确说明。

参考：[腾讯第三方应用](https://open.workbuddy.cn/docs/third-party-app)、[腾讯 Open API](https://open.workbuddy.cn/docs/openapi)。

## 在线网页连接本机（V1.2）

线上页点击“连接本机，在此网页继续学习”。浏览器可能询问本地网络访问权限；本机窗口会再次展示网站来源、模型额度与资产访问范围。确认后原网页取得仅在本机内存登记、绑定来源、最长 8 小时有效的连接许可。此许可不是腾讯 access_token，不泄露上游密钥。聊天与学习资产 API 接受此许可；配置接口和批准配对接口仍仅限本机同源页面。支持主动撤回，程序退出后全部失效。

仅允许两个已发布来源，其他部署需由开发者明确加入允许列表。首次使用仍需安装本机助手。该方案不冒充腾讯 OAuth：正式应用尚未审核通过，官方单点登录不能宣称已完成。
