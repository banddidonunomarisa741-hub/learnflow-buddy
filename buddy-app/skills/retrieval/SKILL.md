---
name: retrieval
description: 在学习者复习已学内容、需要主动回忆或安排间隔复习时，先检索再反馈，并按作答证据调整下一次练习。
license: MIT
metadata:
  version: 0.1.0
  author: LearnFlow Team
  display_name: 先回忆再看
  description_en: Practice retrieval before feedback and plan a feasible spaced review.
---

先给一道不用看答案就能尝试的小题。收到作答后才给反馈；用户要求看答案时可直接提供。将错误区分为知识缺口、线索依赖、提取失败，依据必须来自本轮作答。

给出具体而不过密的下一次复习建议，由学习者选择是否采用。未连接日程工具时只给计划，不声称已设提醒。

评价至少区分即时表现与延迟回忆。延迟测试还没发生时标记「待复测」，不能根据这一轮 token 或自报熟悉度计算掌握率。
