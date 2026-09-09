# LearnFlow 远程连接器候选包 · 0.3.0

本目录按腾讯连接器文件结构准备，尚未经过官方市场审核。`mcp.json` 的 `https://learnflow.example.com` 是不可用的占位域名，提交前替换为已部署、可访问的公开 HTTPS 域名。不要将本目录误当成 Buddy 应用导入 JSON。

采用一个 Streamable HTTP MCP 服务，自行提供 OAuth 2.1 + PKCE。`auth_mode` 省略，让 WorkBuddy 按标准 MCP OAuth 发现与绑定；不提供 Token 输入框，也不在包内放 `Authorization` 或任何用户凭证。公共客户端不需要持有 LearnFlow 的 client_secret。

| 检查入口 | 相对路径 |
|---|---|
| MCP | `/mcp` |
| 健康检查 | `/healthz` |
| 资源元数据 | `/.well-known/oauth-protected-resource` |
| 授权服务器元数据 | `/.well-known/oauth-authorization-server` |
| 动态客户端注册 | `/oauth/register` |
| 浏览器授权 | `/oauth/authorize` |
| 换取及刷新凭证 | `/oauth/token` |

本包 source 为 `learnflow-learning-cloud`。服务的 OAuth 回调校验需支持该 source 对应的 `workbuddy://workbuddy/mcp/connector%3Alearnflow-learning-cloud/oauth/callback`，注册时回显 `redirect_uris`，令牌交换时精确匹配；按官方规范接受本机回环回退。连接器最低版本字段仅说明所用配置字段兼容性，不代表该版本一定能显示 MCP Apps；面板仍需指定预览客户端实测。

面板提供选择、编辑和确认；模型提供学习帮助与草稿。偏好启停、确认保存、课程提交、教师核验、作业发布和社区发布的最终状态由业务服务判定。模型填写 `confirmed:true` 不能替代面板上的本人操作。

宿主的模型、附件和积分仍由宿主处理。LearnFlow 服务不读取桌面登录文件，不提供“万能模型 API”，不会把 Token 换算成单轮积分。它只能处理当前获准的学习内容；不能读取全部宿主历史，也不能替远程用户启动 WPS。

`../` 中保留原本的本地 stdio 连接器；二者 source、数据位置和认证方式不同。公开版不要将 Windows 路径、本地确认窗口或开发者自己的 QQ 登录状态打包。

配置、发布前检查和启动步骤见随交付附带的 `BUDDY-CONSOLE-GUIDE.md`。官方依据：[连接器规范](https://open.workbuddy.cn/docs/connector)、[Buddy 应用规范](https://open.workbuddy.cn/docs/buddy-app)。
