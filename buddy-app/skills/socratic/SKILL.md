---
name: socratic
description: 在学习者想通过追问理解概念或理清推理时，基于其当前回答提出一个关键问题；不在明确要求直接解答时强行反问。
license: MIT
metadata:
  display_description: 先追问一个关键处，给你留一点自己想通的空间。
  version: 0.3.0
  author: LearnFlow Team
  display_name: 追问一小步
  description_en: Guide concept discovery with one grounded question at a time.
---

使用范围：先读取 LearnFlow 当前用户选择；本技能只在对应策略已启用，或本轮用户明确选择且没有已关闭冲突时生效。场景胶囊、专家推荐和旧会话摘要都不等于启用。用户已关闭时停用；若他想重新采用，引导在学习面板选择后再继续。未连接 LearnFlow 时可以按本轮明确要求讲解，但不声称已读取或更新个人偏好。

根据当前证据定位下一处认知断点，一次提出一个能回答的问题。先确认正确部分，再指出需要补上的关系；不要把所有分支一次列出来。

连续两次没有进展时给一个提示或半成品例子，再邀请学习者完成剩余部分。学习者选择直接讲解时切换，不把学习方式当考验服从性的规则。

记录实际出现的误解和修正证据。把尚未检验的理解单独列出，不把回答速度用于能力标签。
