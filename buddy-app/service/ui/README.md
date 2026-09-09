# LearnFlow MCP Apps 面板

本目录是独立于原有网站的 Buddy 学习面板。`workspace.html` 是可交给 MCP Apps 宿主的自包含资源；`preview.html` 是只在本机开发模式提供的协议预览壳。**本地浏览器验证不等于腾讯官方客户端验收。**

## 开发与构建

- `workspace.template.html`：页面外壳。
- `workspace.js`：学习、资料、课程与卡片分享交互。
- `style.css`：沿用 LearnFlow 的橙白与 F 标识，正文 17px；兼容窄屏与减少动画偏好。
- `build-ui.mjs`：内联脚本、样式及仓库原有 F 标识，输出 `workspace.html`。无 CDN、字体或第三方脚本请求。

在仓库目录执行 `node buddy-app/service/ui/build-ui.mjs`。服务每次读取当前 `workspace.html`，无需单独前端开发服务器。

## 已接通的操作

1. 初次进入自动显示三题选择，可跳过、返回或以后修改；选择回传宿主上下文。未勾选记住时，只用于本次面板。
2. 展示策略的适用情形、步骤、例子、边界；预设和个人卡片均可启停。启停写入真实服务，并回传宿主。
3. 草稿可编辑、确认保存或取消。保存带版本号；冲突不会覆盖现有输入。资料可在新面板会话读回。
4. PDF 由用户选文件并确认后上传；支持读取、浏览器打开、下载和删除服务副本。远程面板不承诺直接启动 WPS。
5. 教师创建课程和邀请码；学生明确选择对话片段及说话人。只提交勾选内容，可附本人已保存资料。
6. 教师核验学习证据；请求宿主 AI 分析或拟定针对性作业；作业需教师确认发布，学生提交后再由教师确认完成。
7. 个人策略经本人确认发布到分享区；采纳进入可编辑草稿；反馈明确为使用者自述。

## 协议与权限

面板通过标准 `ui/initialize`、`ui/notifications/initialized`、`tools/call`、`ui/message`、`ui/update-model-context` 和尺寸通知与父宿主通信。只处理来自父窗口的消息；收到初始化响应后锁定可识别的父 Origin。

服务把 `__LEARNFLOW_UI_TOKEN__` 替换为当前面板凭证。凭证仅用于 `learnflow_app_action`，不进入模型消息、模型上下文、URL、日志或浏览器持久存储。个人操作和课程权限由后端校验；客户端按钮不能代替鉴权。

预览壳使用不带 `allow-same-origin` 的沙箱 iframe，通过真实 `/mcp` 请求取得 HTML 和业务结果。测试身份只在 loopback 开发模式建立；Bearer 凭证仅在当前预览页内存。浏览器里看到的“发给学习助手的消息”是用户消息回传记录，预览壳不会编造 AI 回复。

## 验证

执行 `node scripts/test-buddy-panel.mjs`，会建立隔离数据目录、随机端口和独立浏览器，结束后关闭它们。测试记录与桌面/手机截图输出到 `output/buddy-panel-0.3.0/`。

目前通过 19 项检查，包括逐题选择、策略启停、真实 MCP 草稿、取消、旧版本冲突、跨面板持久保存、三个测试身份的课程闭环、选择性提交、人工核验、作业发布与完成、社区采纳及自述反馈、实际 PDF 下载、390px 窄屏和浏览器运行错误检查。

仍需在官方指定 Buddy 预览客户端验证：面板是否显示、用户操作是否影响真实模型下一轮教学、附件及 Token 字段、授权腾讯连接器的 QQ 收发。不能把本目录截图写成这些项目已通过。

协议依据：[MCP Apps 构建文档](https://modelcontextprotocol.io/extensions/apps/build)、[腾讯 Buddy 应用说明](https://open.workbuddy.cn/docs/buddy-app)。
