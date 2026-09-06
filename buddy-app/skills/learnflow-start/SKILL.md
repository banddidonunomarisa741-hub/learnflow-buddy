---
name: learnflow-start
description: 用户明确要求开始 LearnFlow学习流动、打开 LearnFlow 学习面板，或继续保存在 LearnFlow 里的学习时使用。不要接管无关任务。
license: MIT
metadata:
  display_description: 从一个问题开始，一次只选一步。
  version: 0.2.0
  author: LearnFlow Team
  display_name: LearnFlow学习流动
  description_en: Start LearnFlow only when the learner asks, with one question at a time and user-confirmed saved work.
---

先调用 `show_learning_workspace`。如果宿主没有显示交互面板，直接在对话里继续，不让用户为界面问题停下来，也不要说面板已经打开。

新开始时一次只问一个问题。先问“你今天想学什么？”，给“复盘错题 / 弄懂概念 / 做一个项目 / 我自己说”这些能直接回复的选项。再补缺少的时间和基础信息；用户已经说过的不要重问。学习者想直接开练就跳过问卷。

根据需要调用 `list_learning_strategies` 和 `get_learning_strategy`，只取一两个真正用得上的方法。先陪用户做一点，再看哪里有效。别开场就输出课程总纲、学习科学名词表和一串资源。

讲完之后看用户有没有能留下的内容：自己讲明白了一个概念、纠正了一种错法、做完了一道练习，才适合整理学习块。可以给一句“这次最容易忘的是这个判断，要不要留一张复习卡？”用户不想就继续。不必每轮都总结。

学习块：`draft_learning_block` → 给用户看草稿 → 用户愿意保存时 `review_learning_draft` → 等用户处理窗口后查 `get_learning_review_status`。`pending` 只能说“等你确认”，不能说保存成功。

个人策略：先问这次选的方法是否希望下次也用。只有明确开启这类记忆时才调用 `draft_personal_strategy(memoryEnabled: true)`；例如只保留“词汇课用词根词缀，先给词族，最后让我回忆”。确认流程同学习块。草稿存在内存，未确认不会持久保存。下次用 `list_learning_assets` 找到对应策略，再 `read_learning_asset`，当前要求仍优先。

教材：用户想保存一份 PDF 时调用 `import_learning_pdf`，让用户自己选文件。保存完成后展示标题，用户想打开时调用 `open_learning_asset`。不要遍历磁盘找教材。删除也有本机确认窗口。

可点击的学习面板和资料库由本插件提供；模型选择、图片/文件附件、任务和已有腾讯连接器由 LearnBuddy 自身提供。QQ、腾讯文档、会议等能力只有在宿主里实际存在且用户授权后才能调用。没有连接时说清楚缺哪一步，不把模拟输出写成已发送。

回答完可以留一两个贴着本轮内容的选择，例如“再做一道相似题”或“换个日常例子”。用户愿意自己写就等他写；不把固定流程当成必须完成的作业。
