# WorkBuddy 授权与积分能力核查

核查日期：2026-09-08。范围：腾讯官方公开文档与本机实际调用；未读取账号凭证。真实模型调用可能消耗账号额度，具体积分未返回。

## 结论

网页可以提供「连接 WorkBuddy」按钮，让用户进入腾讯授权页，同意后自动返回并开始使用。成立前提是：应用已经审核通过、处于「已启用」状态，所需权限获批，且开发者有保存应用密钥的后端。用户不必手动复制访问令牌。应用身份与用户同意缺一不可。[第三方应用接入说明](https://open.workbuddy.cn/docs/third-party-app)

GitHub Pages 等静态站可以承载按钮和聊天界面；授权码交换、刷新凭证需要后端。腾讯明确要求 `client_secret` 不暴露给前端或客户端。浏览器内的「同意」按钮不能自行获得 WorkBuddy 的桌面登录态。[认证接口](https://open.workbuddy.cn/docs/openapi)

本机助手是另一条路径：浏览器连接已安装并运行的本机服务，由该服务驱动用户已经登录的 CLI 或宿主。它需要用户安装、启动和授权，不能称为所有访客直接可用的官方网页登录。CLI 的回复、模型来源、积分字段是否真实可用，须以本机实际运行结果核验；本记录不代替实测。

## 官方接入所需的最小信息

以下路径的基础地址为 `https://www.workbuddy.cn/openapi/v2`。

| 功能 | 接口或权限 | 关键结果 |
| --- | --- | --- |
| 用户同意 | `GET /authorize`，注册的 `client_id`、一致的 `redirect_uri`、已获批 `scope`、随机 `state` | 回调 `code`、`state` |
| 后端换取、刷新凭证 | `POST /token`，应用密钥保存在后端 | `access_token`、`refresh_token`、`expires_in`、实际 `scope`、`open_id` |
| 云端任务 | `POST /tasks`：`user.task.invokable`；`GET /tasks/{task_id}`：`user.task.readable` | 任务编号和实时通信地址、短期凭据 |
| 本机助理 | `GET /localassistant`；`GET/POST /localassistant/message` | 分别需 `user.localassistant.readable` / `user.localassistant.invokable` |

云端任务随后使用 ACP 通道完成 `initialize → session/load → session/prompt`，接收流式回答；这不是公开的标准 `chat/completions` 模型转发接口。当前公开文档也不足以承诺网页能够自由枚举、切换全部宿主模型。[Open API](https://open.workbuddy.cn/docs/openapi)

令牌寿命示例在官方不同页面间存在差异，代码应遵循实际返回的 `expires_in`，不能写死为一天或七天。

## 积分能显示到什么程度

官方**英文**接口文档列出可选的个人积分接口：

- `GET /openapi/v2/credit`
- 权限：`user.credit.readable`
- `total_capacity_size`：统计范围内的总额度。
- `total_capacity_used`：该范围内的已用额度。

该说明仅适用于个人用户，合并统计有效或已用完的资源包，不区分订阅、充值与赠送包。[英文积分接口说明](https://open.workbuddy.cn/en/docs/openapi)

同日核查的**中文** Open API 页面及权限清单没有列出这个读取积分接口，仅列有兑换积分能力。因此应将余额读取作为可选能力：应用获批该权限、用户实际授予且接口成功返回后才展示；未支持、未授权、出错时显示不可用，不能填零或估算假余额。兑换接口的 `credits` 是本次发放积分，不能当作余额或对话消费。[中文权限清单](https://open.workbuddy.cn/docs/third-party-app)

公开文档没有给出可确认的「本轮对话精确扣费」字段。ACP 的 `usage` 不能直接等同于积分；账号余额前后差值也可能包含其他会话、资源包到期或赠送，最多说明账户变化，不能标成这一轮的账单。实际积分使用明细仍可在 WorkBuddy 个人主页的「套餐与用量」查看。[官方用量说明](https://www.workbuddy.cn/docs/workbuddy/Usage)

## 本次实测记录

用户最近确认的状态：第三方应用尚未创建或审核通过。因此本次未启动腾讯官方 OAuth，也未获得积分读取权限。

本机 WorkBuddy 实测成功：Auto 实际返回 `deepseek-v4-flash`。随机校验码与算式匹配，耗时 7.354 秒，服务报告输入 3120 / 输出 164，总计 3284 Tokens（按输入＋输出）。随后真实学习对话完成，网页回执显示输入 3888 / 输出 2519，总计 6407 Tokens。缓存字段另列，未重复加入。

积分扣费与余额：未从当前通道获得。校验返回 `creditsConsumed:null`、`remainingCredits:null`；界面显示“当前通道未提供”。未读取桌面凭据、未调用内部计费接口，未据此声称扣费数字正常。

本机 CLI 程序的 `total_cost_usd:0` 是占位值，不是免费账单；模型倍率也不是余额。本轮保留明确权限确认，取消不授予网页许可；同意后自动验证模型。首次仍需安装连接助手，浏览器可能另外要求启动应用/本地网络权限。

实际执行记录保存在本机 `output/connection-credit-review/`。
