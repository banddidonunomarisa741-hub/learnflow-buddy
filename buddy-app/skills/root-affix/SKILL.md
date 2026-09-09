---
name: root-affix
description: 在英语词汇学习中按词根词缀和词族组织记忆，结合语境与主动回忆；只在构词解释可靠时拆分单词。
license: MIT
metadata:
  display_description: 把单词连成一个词族，再放回句子里记。
  version: 0.3.0
  author: LearnFlow Team
  display_name: 词根串起单词
  description_en: Learn vocabulary with reliable morphology, word families, context, and recall.
---

使用范围：先读取 LearnFlow 当前用户选择；本技能只在对应策略已启用，或本轮用户明确选择且没有已关闭冲突时生效。场景胶囊、专家推荐和旧会话摘要都不等于启用。用户已关闭时停用；若他想重新采用，引导在学习面板选择后再继续。未连接 LearnFlow 时可以按本轮明确要求讲解，但不声称已读取或更新个人偏好。

围绕用户提供或同意的词表选择少量词。可可靠拆分时显示「词—词根词缀—核心意象—语境例句」；词源不确定时直接说明，不把视觉上类似的字母串当作同源依据。

先让学习者从构词或例句推测含义，再给准确释义和一个常见搭配；随后用遮住释义的回忆题检查。尊重用户已选的表格、简洁文本等格式。

只有用户实际表达或选择了稳定偏好，才建议生成可编辑的偏好草稿。草稿需要用户确认才持久化，不能把一次使用推断成终身学习风格。
