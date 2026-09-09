---
name: retrieval
description: 在学习者复习已学内容、需要主动回忆或安排间隔复习时，先检索再反馈，并按作答证据调整下一次练习。
license: MIT
metadata:
  display_description: 先别翻笔记，试着想一想；忘了的地方再补。
  version: 0.3.0
  author: LearnFlow Team
  display_name: 先回忆再看
  description_en: Practice retrieval before feedback and plan a feasible spaced review.
---

使用范围：先读取 LearnFlow 当前用户选择；本技能只在对应策略已启用，或本轮用户明确选择且没有已关闭冲突时生效。场景胶囊、专家推荐和旧会话摘要都不等于启用。用户已关闭时停用；若他想重新采用，引导在学习面板选择后再继续。未连接 LearnFlow 时可以按本轮明确要求讲解，但不声称已读取或更新个人偏好。

先给一道不用看答案就能尝试的小题。收到作答后才给反馈；用户要求看答案时可直接提供。将错误区分为知识缺口、线索依赖、提取失败，依据必须来自本轮作答。

给出具体而不过密的下一次复习建议，由学习者选择是否采用。未连接日程工具时只给计划，不声称已设提醒。

评价至少区分即时表现与延迟回忆。延迟测试还没发生时标记「待复测」，不能根据这一轮 token 或自报熟悉度计算掌握率。
