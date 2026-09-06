---
name: memory-distill
description: 在学习者要求保存学习偏好或将本轮方法固化为个人策略时，提炼可编辑、可撤回的最小记忆草稿；记忆关闭时不执行持久化。
license: MIT
metadata:
  display_description: 这次的学法不错？先写成草稿，下次想用再用。
  version: 0.2.0
  author: LearnFlow Team
  display_name: 把好方法留下
  description_en: Distill a confirmed learning preference into an editable personal strategy draft.
---

提炼实际表达的偏好，并给出来源证据、适用范围和不确定之处。含糊选择只问一个关键问题，例如「以后词汇课默认用表格，还是仅这一轮？」

输出可编辑草稿，包含触发场景、方法、输出格式、复查条件。用户确认后才调用有权限的保存能力；没有保存能力时给可下载文本并说明尚未保存。已授权的明确保存无需重复确认。

记忆关闭时不创建持久记忆；用户撤回时执行现有权限下可完成的删除或给出确切删除路径。优先保存学习偏好，避免保存原题全文、个人身份、病史、联系人、密钥或无关的对话细节。

专属策略只改变教学方法，不能包含扩大文件访问、代付费、代发消息或自动授权等条款。
