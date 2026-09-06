# 网页数据与状态回归验证

2026-09-06，版本 1.4。12 项回归通过，0 页面异常。使用独立 Edge 浏览器、合成学习数据和拦截 API；真实 API 写入为 0。实时接口返回 404 是明确设置的兼容回退测试，模型回复为 fixture。

| 检查 | 结果 |
| --- | --- |
| 已确认记忆按场景进入请求 | PASS |
| 刷新恢复学习会话 | PASS |
| 关闭记忆后不发送也不写会话 | PASS |
| 请求中切换场景与用量归属 | PASS |
| 编辑记忆保留其他字段 | PASS |
| 10 分钟计划遵守总时长 | PASS |
| 完整备份导出与恢复 | PASS |
| 无效备份不覆盖数据 | PASS |
| 卡片 HTML 输入只作为文本 | PASS |
| 备份 ID 注入被拒绝 | PASS |
| 取消不计数，确认与刷新不重复计块 | PASS |
| 390 px 导航与页面宽度 | PASS |

这些检查覆盖记忆开关、请求归属、资料恢复和输入展示，不证明学习效果。真实模型、QQ 和宿主调用证据另见 [MVP 记录](MVP-VALIDATION.md)。

原始结果：[validation-results.json](validation-results.json)。可复现脚本：[validation-script.cjs](validation-script.cjs)。当前网页资源与 QQ 草稿行为见 [网页验收](MVP-WEB-VALIDATION.md)。

脚本使用自己的浏览器上下文，不读取个人浏览器资料。启动本机服务后按构建说明配置 Playwright 运行依赖，再执行 node docs/validation-script.cjs。
