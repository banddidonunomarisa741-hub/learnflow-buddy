# LearnFlow学习流动 · Buddy 配置与发布填表指南

候选版本 0.3.0，核对日期 2026-09-09。品牌名保持 **LearnFlow学习流动**，使用已确认的 F 标识。

本交付的应用配置是 **source-not-platform-import**：内容已整理成可填表、可检查的源稿，不能把 `app.config.source.json` 冒充腾讯导出的 JSON 上传。应用 ID、资源 ID、模型 ID、预览地址和审核结果仍须来自真实控制台。当前空值表示未取得或未核验，不是开发工具自动替你创建了应用。

## 1. 打开后用户怎样用

用户进入 LearnFlow Buddy 应用，由宿主提供聊天、模型选择和附件。首页保留三个模式、七个场景入口。需要个人策略、学习资料或课程时绑定 LearnFlow 服务，在对话里的 MCP Apps 面板选择、修改和确认。

模式、胶囊和专家只常驻绑定 `learnflow-start`。费曼法、词根法、回忆练习等由业务服务中的当前选择决定；关闭后不能继续被模式默认提示词恢复。胶囊的 `suggestedStrategyRefs` 是团队填表参考，不是平台字段，也不表示已经启用。

| 模式 | 场景胶囊 | 本轮任务 |
|---|---|---|
| 复盘错题 | 把单词串成词族 | 词族与回忆练习 |
| 复盘错题 | 从原文证据复盘一道题 | 原文、作答、干扰项与迁移题 |
| 学点新的 | 讲懂一个卡住的概念 | 解释、缺口与新例子 |
| 学点新的 | 把目标拆成第一步 | 先修关系和今天的一步 |
| 把项目做出来 | 从选题到可展示成果 | 驱动问题、分工与成果标准 |
| 把项目做出来 | 给老师一份过程证据 | 学生主动提交、教师核验 |
| 学点新的 | 把好用的方法留下 | 可编辑的个人策略草稿 |

## 2. 控制台逐项对照

| 官方模块 | 填写来源 | 仍需控制台给出的值 |
|---|---|---|
| 创建应用 | `app.config.source.json` 的 app；`assets/app-icon-256.png` | 自动生成的 App ID、Client ID；真实简介/类目/权限/可信 Origin/回调地址 |
| 首页 | home；三个 `modes/*.md`；七个 capsule 的 title、prompt | 已发布或允许引用的 Skill/专家/连接器资源 ID |
| 市场 | skills；`experts.source.json`；远程连接器包 | 平台资产 ID 和可用分类，不能把本地 slug 当平台 ID |
| 精选场景 | `assets/featured-day.png`、`featured-night.png` | 对应专家或专家团，日夜资源分别上传 |
| 其他配置 | 输入占位符、绑定说明、模型选择策略 | 从当时实际模型池选择 ID、顺序和默认模型 |
| 预览调试 | 控制台提供的链接及对应客户端 | 真实预览 URL、客户端版本、导出的官方 JSON |

应用头像为 256×256；界面线性图标 `icon-16.svg` 为 16×16、1.2 px 圆角线条；精选背景为 1000×910，日夜各一套。不要把品牌头像缩小后当成所有 16px 工具图标。上述自定义范围包括首页标题、模式、胶囊、模型和市场；面板内可以自定义交互，不代表能修改宿主任意 DOM。[官方配置与设计规范](https://open.workbuddy.cn/docs/buddy-app)

`platformResourceMapping` 统一留空待回填。源稿中的 `clientSecret` 必须一直为空：真实密钥放部署环境，不放公开源文件、Skill、PPT或 ZIP。

## 3. 两种授权分别处理

**用户把 LearnFlow 服务接进 Buddy：**采用标准 MCP OAuth。远程连接器 `source` 为 `learnflow-learning-cloud`，只配置一个 `streamableHttp` Server，生产地址为 `https://实际域名/mcp`。`auth_mode` 省略，不加 Token 表单，不预填 Bearer 凭证。

WorkBuddy 首次连接被服务要求授权后，发现根域的 OAuth 元数据、动态注册客户端，打开用户授权页面，通过 PKCE 换取令牌。回调支持 `workbuddy://workbuddy/mcp/connector%3Alearnflow-learning-cloud/oauth/callback`，并依官方规则支持本机回环回退；注册与交换时精确核对地址。根域端点为 `/.well-known/oauth-protected-resource`、`/.well-known/oauth-authorization-server`、`/oauth/register`、`/oauth/authorize`、`/oauth/token`。HTTPS、刷新、撤销与异常恢复须实测。[官方连接器认证规范](https://open.workbuddy.cn/docs/connector)

**LearnFlow 服务识别用户身份：**服务的生产登录依赖已启用、权限已获准的 WorkBuddy 应用身份。部署环境填 `LF_WORKBUDDY_CLIENT_ID` / `LF_WORKBUDDY_CLIENT_SECRET`；当前服务的身份权限为 `user.profile.readable`，回调为 `LF_PUBLIC_URL` 加 `/oauth/workbuddy/callback`，必须与控制台完全一致。不因为做学习策略就顺手申请云任务调用、QQ 发送或积分兑换。平台令牌只用于后端身份验证，不当作 LearnFlow MCP 令牌分发。

这两个授权不是同一把令牌：MCP 令牌用于用户自己的 LearnFlow 数据；WorkBuddy 应用 OAuth 用于获准的平台身份或能力。用户同意不能代替开发者身份审核，也不意味着自动获得全部腾讯生态权限。

正式 Buddy 的内置连接器目前留空，候选项记录在 `builtInConnectorCandidates`。取得远程连接器实际资源 ID、完成 HTTPS/OAuth 与宿主验证后再加入 `builtInConnectors`。因为个人资产是核心功能，源稿不建议默认跳过绑定；基础对话是否允许先体验，在真实控制台与预览中核验。

## 4. 包里有什么

| 交付包 | 用途 |
|---|---|
| `learnflow-console-source-0.3.0.zip` | 应用填表源稿、模式文案、头像和背景；不是官方导入配置 |
| `connector-learnflow-learning-cloud.zip` | 远程 OAuth MCP 连接器候选材料；域名须替换、待审核 |
| `learnflow-service-0.3.0.zip` | Node 24 服务、面板、依赖锁文件与启动示例 |
| `skill-*.zip`、`expert-*.zip` | 单项能力候选包；平台资产 ID 和审核状态另行回填 |
| `learnflow-plugin.zip`、本地安装 ZIP | 保留原本本地 stdio 入口，不是正式 Buddy 应用 |
| `learnflow-buddy-source.zip` | 工程交付源码；不含用户数据库、运行时依赖或真实环境凭据 |
| `validation-report.json` | 本次构建检查、包校验值和未完成的发布条件 |

服务包内 `service/` 与 `skills/` 保持相对目录。部署前进入 `service/` 执行 `npm ci` 安装锁定依赖；Node.js 需 24 或以上。`node_modules` 不随源码分发。旧本地 stdio 插件继续使用原有 Node 20+ 路径和本机确认窗口；远程服务不能启动用户的 WPS，也不会自动迁移该本地资料库。

本机预览可运行 `launch-preview.ps1` 或在 `service/` 执行 `node server.mjs --preview`，默认回环端口 4318。预览身份只供隔离演示，不能以此证明真实账号、QQ 或官方宿主已连通。

生产环境通过部署平台设置：

```text
LF_PUBLIC_URL=https://learnflow.example.com
LF_DATA_DIR=
LF_WORKBUDDY_CLIENT_ID=
LF_WORKBUDDY_CLIENT_SECRET=
LF_OAUTH_REDIRECT_ORIGINS=
LF_TRUSTED_ORIGINS=
LF_INTERNAL_HOSTS=
LF_HOST=127.0.0.1
LF_PORT=4318
```

上面都是待填写示例。`LF_DATA_DIR` 应为挂载的持久目录；反向代理提供 HTTPS。`LF_OAUTH_REDIRECT_ORIGINS` 只填实际需要允许的回调 Origin，不用通配符扩大授权。按服务运行说明配置后执行 `node server.mjs --production`；`launch-production.ps1` 会拒绝空应用凭证、示例域名和空数据目录。端点健康检查为 `/healthz`。本机预览入口不能直接当公网生产入口开放。

`LF_TRUSTED_ORIGINS` 是前端请求来源的精确白名单，`LF_INTERNAL_HOSTS` 是反向代理确实需要的内部 Host 白名单；不要直接复制任意网站到这两项。容器部署可在服务包根目录使用随附 Dockerfile 构建镜像，将持久目录挂载到 `/data` 并由 HTTPS 反向代理转发。容器内监听 `0.0.0.0:4318`，宿主端口建议只映射到回环地址供反向代理访问；保持外部 Host，或仅登记真实内部 Host。镜像构建、生产证书和公开 OAuth 并未因准备好 Dockerfile 就视为实测完成。

## 5. 发布闸门

运行 `python buddy-app/build.py` 检查与构建；`python buddy-app/build.py --release` 在发布条件未满足时返回非零退出码。普通构建成功仅表示文件结构通过。构建器不会登录平台，不会上传，不会自动把审核改成通过。

提交前需要这些真实结果：

1. 主体/创建权限和应用创建审核通过。
2. 资源已上传或可引用，模型列表来自真实平台池。
3. 公开 HTTPS 服务可用，OAuth 绑定、续期、取消授权与用户隔离通过。
4. 官方预览能打开面板、回传选择；至少两个可用模型验证学法开关不会被常驻提示词覆盖。
5. 学习块草稿→本人编辑确认→新会话取回；取消没有变成资产，模型不能代替面板批准。
6. 教师只读取学生实际提交；AI 评价与作业保持草稿，教师确认后才发布。
7. 控制台导出正式配置，完成连接器审核与应用配置审核。

每个 `releaseGates` 项需配套仓库内的脱敏证据文件路径；仅手改布尔值不能通过。当前候选包不包含这些正式审核结果。历史 LearnBuddy 5.3.8 的本地测试保留为历史证据，不计作 0.3.0 的宿主发布验证。

## 6. 不夸大的展示口径

可以展示个人策略、草稿、资料、课程、提交、教师评阅与社区等已实现业务，注明当前测试环境。宿主的原生模型与积分照宿主规则运行；MCP 不因此自动得到所有历史记录、逐轮 Token 或积分账单。获得真实字段才展示真实值，未知不填 0；用户自报用量与提供方用量分别标注，不把 Token 当学习成绩。

QQ 的提醒或回执单独按正式连接器授权与实际结果验收。生成邀请、生成提醒文案、工具返回“已发送”、用户自报完成、教师核验是不同状态。旧网页扫码成功不能代替新 Buddy 服务的 QQ 验证。
