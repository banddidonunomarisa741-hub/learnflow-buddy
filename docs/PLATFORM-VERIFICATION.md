# 腾讯平台核验与交付边界

核验日期：2026-09-06。仅使用腾讯官方公开文档；网页部分内容在搜索索引与实时页面间存在更新差异，当前交付以实时可读中文页面为主，并保留需要控制台确认的事项。未读取、输出或复制本机 WorkBuddy/LearnBuddy 会话凭据。

## 已确认与未确认

| 问题 | 核验结论 | 对项目的影响 |
| --- | --- | --- |
| 是否必须现在成立公司 | 官方提供个人与企业两类认证；公开页面不足以确认个人账号的 Buddy 创建/发布权限 | 不能直接下“必须办公司”的结论。先核验账户权限与教育类目，再选择个人资产发布、学校/合作方主体或自建公司 |
| Buddy 是不是任意网页上传 | 它是依托 WorkBuddy 的行业应用配置，按 5 个模块填写，在指定客户端预览，并经过创建及配置审核 | 自制网页是独立前端原型。不能宣称已替换 LearnBuddy 官方前端 |
| 官方 JSON 能否自行构造 | 文档说支持导出/导入配置，但未公开完整 JSON schema | app.config.source.json 明确标为工程源稿；需要控制台真实导出后适配 |
| 是否存在官方接口 | 存在 OAuth 2.1 Open API，提供本地助理消息与云端任务等 | 不需要逆向桌面 token；须有已审核应用、合法授权和所需 scope |
| 是否有公开匿名 LearnBuddy 模型接口 | 本次所查文档没有提供这种接口 | 不将普通模型兼容接口冒称 LearnBuddy 原生算力；默认用可辨认的预设演示 |
| Skill 是否必须改为 MCP | 官方同时保留 Skill、专家和连接器，连接器推荐 MCP + Skill | Skill 管教学流程；MCP 管稳定工具调用。可移植性要靠接口边界、格式、版本和实测共同实现 |
| 腾讯生态是否已连接 | 当前没有合法相关授权及实际账号/连接器接入 | QQ、微信、腾讯会议、腾讯文档在 Demo 中是能力规划，不能标为已接通 |

主体结论依据：[入驻开放平台](https://open.workbuddy.cn/docs/onboarding)、[开放平台概述](https://open.workbuddy.cn/docs/what-is-open-platform)。应用载体和流程依据：[Buddy 应用](https://open.workbuddy.cn/docs/buddy-app)。

## 本次实际产物

- 本地静态网站与同源 loopback 后端；公开静态托管不承载服务端密钥或持续进程。
- 10 个可移植 Skill 源文件；构建时转换为腾讯要求的 Skill 元数据。
- 4 个专家源配置与 ZIP：自主学习、应试复盘、PBL、教学设计/过程性评价。真实联系邮箱尚未提供，发布校验会报告缺失。
- 真实 stdio MCP：检索策略、读取策略及哈希、生成个人策略草稿。仅访问随包数据，草稿返回文本，不自动保存记忆或读取私人文件。
- 3 个工作模式、7 个场景胶囊、双语输入提示及市场资源映射源稿。模型 ID 待控制台从实际模型池选取。

包结构依据：[Skill](https://open.workbuddy.cn/docs/skill)、[专家](https://open.workbuddy.cn/docs/expert)、[连接器](https://open.workbuddy.cn/docs/connector)。MCP 实现参照 [stdio 传输](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) 与 [生命周期](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)。本地协议测试不等于腾讯宿主兼容性认证。

## 模型接口的真实边界

server/server.mjs 有两种显式配置：兼容 Chat Completions 的自有模型接口；腾讯正式 Open API 的本地助理适配。没有自动发现桌面密钥，没有匿名调用。后者使用 /localassistant 与 /localassistant/message；需 user.localassistant.readable、user.localassistant.invokable。授权应用须先审核并由用户完成 OAuth。本项目没有实现正式 OAuth 登录/刷新，也尚未用腾讯真实凭据联调。[官方第三方应用](https://open.workbuddy.cn/docs/third-party-app)、[Open API](https://open.workbuddy.cn/docs/openapi)。

WorkBuddy 的本地助理消息查询缺少本适配器所需的独立会话、任务完成与 token 数字段。实现只能读取增量回复并报告 pending/received/requires_action 等本地适配状态，不能据此保证宿主任务结束；并行宿主任务存在归属限制。因此原生路线下一步应优先评估官方云任务/ACP 的任务隔离，或与企业确认行业宿主接口。

usage.total_tokens 只有供应商返回才记为真实，缺失用 null。多策略同轮消耗只可称“涉及该策略的会话消耗”，不能当独立归因；更不能当教学效果或刷分权重的充分证据。公共排序上线前应优先考虑可核验复测、使用者反馈、冷启动公平性与反刷量。

## 发布检查和限制

运行 `python buddy-app/build.py` 生成结构报告；运行 `node scripts/test-backend.mjs` 覆盖本地接口、权限边界、上游缺失 usage 和 stdio MCP。测试使用本地确定性桩，不消耗真实模型额度。`--release` 会在主体、邮箱、平台资源 ID、宿主预览与审核等尚缺时失败，这是正确状态。

不能绕过人脸实名认证、企业资质、OAuth 授权或平台审核。用户已授权完成工程与发布准备，但这些外部状态无法凭本地文件生成。当前交付是可运行原型与可审阅的上架工程材料，不是已上线的 Buddy 应用。

## 需要腾讯确认的四件事

1. 当前个人主体能否创建 Buddy，教育服务具体类目和准入材料是什么；大学团队是否可由学校或共建单位作为主体。
2. LearnBuddy 的官方模型/记忆/页面扩展边界，是否能采用本前端设计与学习状态协议。
3. 控制台导出 schema、资源 ID 映射、指定预览客户端及 stdio 安装目录行为。
4. QQ/微信主动触达、会议纪要与教学档案分别可用的连接器、消息订阅权限、计费和数据边界。
