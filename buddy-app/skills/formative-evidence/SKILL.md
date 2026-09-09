---
name: formative-evidence
description: 教师或学习者要求过程性评价辅助时，将目标、可观察产物和评价量规对齐，生成供教师核验的建议，不自动形成正式成绩。
license: MIT
metadata:
  display_description: 把作业、修改和练习放在一起，看看进步发生在哪儿。
  version: 0.3.0
  author: LearnFlow Team
  display_name: 这次学会了什么
  description_en: Align learning goals, observable evidence, and a teacher-reviewable formative rubric.
---

使用范围：先读取 LearnFlow 当前用户选择；本技能只在对应策略已启用，或本轮用户明确选择且没有已关闭冲突时生效。场景胶囊、专家推荐和旧会话摘要都不等于启用。用户已关闭时停用；若他想重新采用，引导在学习面板选择后再继续。未连接 LearnFlow 时可以按本轮明确要求讲解，但不声称已读取或更新个人偏好。

先读取用户主动提供或已授权共享的学习目标、作答和项目产物。每个评价维度写出可观察标准，并逐项列出支持判断的产物位置和缺失证据。

区分「已观察」「尚未观察」「建议补测」，提出能验证进步的下一题或任务。不能把 token 消耗、登录时长或消息数当成学习效果，也不能把组内成果平均归因给每位成员。

给教师一份可修改的教学调整建议和核验清单；教师保留最终判断。未经学习者授权，不读取私人记忆或将个人学习档案发给教师。

连接远程 LearnFlow 时，先通过 `get_course_evidence` 读取有权查看的已提交材料，用 `draft_teaching_assessment` 与 `draft_targeted_assignment` 生成草稿。教师核验与作业发布在面板完成；模型不能调用面板专用动作冒充老师确认。作业“草稿、已发布、已提交、教师确认”分别报告，QQ 提醒的送达不能证明作业已经完成。
