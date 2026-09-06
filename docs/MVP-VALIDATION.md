# LearnFlow学习流动 · 1.4 验证记录

2026-09-06，Windows 本机与独立 Edge 测试浏览器。合成学习数据不代表用户实验。

| 检查 | 结果 | 复现入口 |
| --- | --- | --- |
| HTTP 与 MCP 集成 | 31 项通过 | `node scripts/test-backend.mjs` |
| 模型、图片与文件输入 | 14 项通过，使用本地上游桩 | `node scripts/test-chat-inputs.mjs` |
| 回答流、取消、SSE 边界 | 13 项通过，使用本地上游桩 | `node scripts/test-chat-stream.mjs` |
| 配对授权 | 19 项通过 | `node scripts/test-pairing.mjs` |
| 网页学习资产 | 15 项通过 | `node scripts/test-learning-assets.mjs` |
| Markdown 展示 | 12 项通过，含 HTML 和危险链接输入 | `node scripts/test-rich-text.mjs` |
| QQ 模块 | 51 项通过；模拟回执，无真实发送 | `node scripts/test-qq-connector.mjs` |
| QQ HTTP 权限 | 20 项通过；隔离服务 | `node scripts/test-qq-http.mjs` |
| 宿主工具与资料库 | 26 项通过；确认、取消、保存、删除、路径约束 | `node scripts/test-buddy-host.mjs` |
| 文档 | 17 页方案、16 页 PPT/PDF，33 页已渲染查看 | `python scripts/check-documents.py` |

## 真实服务与界面

- 本机模型授权测试成功，15 个模型选项来自 CLI 列表。实际 hy3 回答呈现表格与 Python 代码；自动模型的回答捕获到 262 次中间正文更新，确认不是最终整段填充。
- Netlify 公开版另完成真实本机弹窗配对、自动模型探测和学习问答。实际回答解释了主动回忆，并给出三个可点选方向；成功状态持续可见，确认后留在原网页继续学习。测试脚本曾因使用了不完整的精确文本定位而等待超时，人工核对 DOM 已收到完整回答，修正定位后保留截图 output/playwright/netlify-live-answer.png。
- 停止后保留草稿；模拟失败后重试得到真实回答，用户消息未重复。TXT 附件的独有编号被模型正确读回。此前版本已完成实际读图和 17 页 PDF 文字问答。
- 全走 7 题初始化，修复空自填默认项；保存学习资产并确认移除测试副本。390 px 模拟手机视口无横向溢出。[网页详细记录](MVP-WEB-VALIDATION.md)
- LearnBuddy 正常插件安装成功，12 个工具已被宿主发现，模型实际经 ToolSearch 和 DeferExecuteTool 读取 11 项策略。原生保存窗口取消与确认已实测。该版本 CLI 在完整输出后存在异常退出码，实际客户端面板展示单独记录。[宿主验证](LEARNBUDDY-INSTALL.md)
- QQ 已完成本人扫码、网关 READY 和唯一获明确授权的定时提醒发送；腾讯返回接收回执，不等于用户已阅读。新版入站任务仍待本人重新扫码后实测。一次调试清理操作导致测试服务退出，已停用该维护方式，凭据未落盘或泄露。[QQ 记录](TENCENT-CONNECTORS.md)

## 当前未证明的事项

正式 Buddy 审核、官方 OAuth 全流程、跨设备资料同步、多人策略社区、所有宿主版本兼容，以及提分和学习效果均未完成验证。微信、腾讯文档和腾讯会议没有被包装成本网页已接通的功能。
