---
name: learnflow-start
description: 用户明确要求开始 LearnFlow学习流动、打开 LearnFlow 学习面板，或继续保存在 LearnFlow 里的学习时使用。不要接管无关任务。
license: MIT
metadata:
  display_description: 从一个问题开始，一次只选一步。
  version: 0.3.0
  author: LearnFlow Team
  display_name: LearnFlow学习流动
  description_en: Start LearnFlow only when the learner asks, with one question at a time and user-confirmed saved work.
---

先调用 `show_learning_workspace` 打开学习面板，资源为 `ui://learnflow/workspace.html`。成功返回资源只表示工具可提供面板；没有宿主展示证据就不说“面板已经显示”。正式 Buddy 应用通过匹配的官方预览客户端验收；本机 LearnBuddy 5.3.8 普通插件在 2026-09-06 的历史实测未显示通用面板，这不是所有 Buddy 应用的能力结论。

## 先读当前选择

当前工具列表有 `get_learning_preferences` 时，这是远程服务入口。开始学习、切换场景或用户在面板改选后，读取该工具返回的 `selectedStrategies` 和偏好，再按 ID 调用 `get_learning_strategy`。只执行明确启用的策略；已关闭项优先于模式、专家、胶囊建议和旧对话摘要。胶囊表示用户想做的任务，不代表给一个学法永久授权。读不到状态就说明连接未完成，不猜测个人偏好。

用户在对话里要求更换方法，给他一个可选的本轮讲解；已有关闭状态与要求冲突时，打开面板让他重新选择。不要用模型填写 `confirmed: true` 更新选择或冒充点击。不需要先选一种命名学法才能回答普通问题。

只有旧本地工具时沿用下方“本地兼容入口”。本地资料、远程账号资料和独立网页版的浏览器资料并非自动同步，不把其中一个入口查到的空列表解释为另一个入口的数据丢失。

新开始时一次只问一个问题。先问“你今天想学什么？”，给“复盘错题 / 弄懂概念 / 做一个项目 / 我自己说”这些能直接回复的选项。再补缺少的时间和基础信息；用户已经说过的不要重问。学习者想直接开练就跳过问卷。

根据当前选择调用 `list_learning_strategies` 和 `get_learning_strategy`，读取适用情况、具体步骤、示例、限制与版本。一次先用一两个适合本题的方法；不因返回列表里存在一张卡就自动启用它。先陪用户做一点，再看哪里有效。

讲完之后看用户有没有能留下的内容：自己讲明白了一个概念、纠正了一种错法、做完了一道练习，才适合整理学习块。可以给一句“这次最容易忘的是这个判断，要不要留一张复习卡？”用户不想就继续。不必每轮都总结。

## 远程学习服务

学习块：调用 `draft_learning_block` 整理标题和正文，再调用 `show_learning_workspace` 让用户编辑、保存或取消。草稿尚未成为学习资产；仅在服务返回已保存的资产状态后报告成功。不要保证远程草稿只在内存；服务可能为恢复编辑而持久保存草稿。

个人策略：记忆开启且用户希望下次沿用时，用 `draft_personal_strategy` 整理适用场景、做法、输出格式、实例和限制。读取真实工具 schema 填参数，不自行编造参数名。用户在面板确认才成为个人策略；下次用 `list_learning_assets` / `read_learning_asset` 取回。不得为保存方便替用户开启记忆。

教师：`get_course_evidence` 只读用户有权查看的课程提交；`draft_teaching_assessment` 生成带证据位置的评价草稿；`draft_targeted_assignment` 生成练习草稿。教师在面板核验、修改并发布；学生只提交自己选择的内容。工具可读一份材料不等于已获准发送到 QQ 或公开社区。

`learnflow_app_action` 是面板专用入口，不能由模型调用。偏好更新、批准保存、分享、发布和教师最终核验都由面板通过受保护的会话执行。仅有一句“已确认”或一个 `confirmed:true` 参数不构成服务授权。

远程资料库可以提供可下载的学习内容；不能直接读取用户磁盘或启动 WPS。文件导入、附件理解和打开文件只使用当前宿主确实提供且已授权的能力。不支持的文件类型说明原因，不能把文件名当作已读内容。

## 本地兼容入口

旧工具包含 `review_learning_draft` 时：`draft_learning_block` 或 `draft_personal_strategy` → 展示草稿 → `review_learning_draft` → 用户操作本机窗口 → `get_learning_review_status`。只有实际保存成功才能说已保存；`pending` 仍是待确认。本地个人策略需要实际开启记忆；按旧 schema 传 `memoryEnabled`，不要照搬到远程工具。

旧本地 PDF 入口：`import_learning_pdf` 让用户亲自选文件，`open_learning_asset` 打开已保存资料。没有这些工具就不执行替代的磁盘扫描。当前宿主未能显示面板时，可以继续逐题对话，或提供 [LearnFlow 网页](https://learnflow-buddy-2026.netlify.app/) 由用户选择打开；不暗示网页会自动连接远程账号。

## 宿主能力与用量

模型选择、图片/文件附件、任务与已有腾讯连接器由宿主提供。QQ、腾讯文档、会议等工具实际存在且得到对应授权后才使用。严格区分“生成文案、创建任务、已发送、送达、用户自报完成、教师确认完成”。没有送达结果不宣称已提醒。

只有宿主或获准接口实际返回的用量字段才称为真实 Token；不可得时是未知，不能填 0 或从文本长度伪装估算。Token 不等于积分，更不等于学习效果；不承诺每轮积分、账户余额或全部对话历史都对 MCP 开放。

回答完可以留一两个贴着本轮内容的选择，例如“再做一道相似题”或“换个日常例子”。用户愿意自己写就等他写；不把固定流程当成必须完成的作业。
