# 实际发布与交付状态

更新日期：2026-09-06。交付补丁 1.4.1；连接助手 1.4.0，解决方案 / PPT 1.4。

| 交付 | 实际状态 | 入口 |
| --- | --- | --- |
| 网页 MVP | 实时回答、模型选择、文件输入、学习块与资产 | [Netlify](https://learnflow-buddy-2026.netlify.app/) / [GitHub Pages](https://banddidonunomarisa741-hub.github.io/learnflow-buddy/) |
| 本机连接助手 | 已安装；本机授权后调用模型 | http://127.0.0.1:4173 |
| LearnBuddy 插件 | 正常安装；宿主已发现 12 个工具，模型成功检索策略 | [安装与验证](LEARNBUDDY-INSTALL.md) |
| QQ 连接 | 本人扫码、网关就绪、唯一授权提醒的发送回执已实测；新版收件待验 | [QQ 说明](TENCENT-CONNECTORS.md) |
| 解决方案 | 17 页正文式 PDF | output/pdf/LearnFlow学习流动-项目解决方案-1.4.pdf |
| 答辩演示 | 16 页可编辑 PPTX、对应 PDF 与讲稿 | output/slides/LearnFlow学习流动-答辩演示-1.4.pptx |
| 源码与组件 | 11 技能、4 专家、MCP 与插件安装包 | [GitHub](https://github.com/banddidonunomarisa741-hub/learnflow-buddy) |
| 正式 Buddy | 未上架；企业认证、真实资源配置、预览与审核待完成 | [提审检查表](BUDDY-RELEASE-CHECKLIST.md) |

真实 CLI 模型通道、QQ 机器人和 WorkBuddy 正式 OAuth 是不同连接。前两者有单机实测结果，不能据此宣布 OAuth 或 Buddy 审核完成。已查明本机 LearnBuddy 5.3.8 尚未开放普通插件的 MCP Apps 内嵌入口；1.4.1 补丁明确提供逐题对话和网页链接，保留标准面板资源供兼容宿主使用。没有修改客户端限制，也不再把当前面板状态写成待重试授权。

验证见 [MVP 记录](MVP-VALIDATION.md)、[网页流程](MVP-WEB-VALIDATION.md)、[QQ](TENCENT-CONNECTORS.md)、[宿主](LEARNBUDDY-INSTALL.md) 和 [文档版面](DOCUMENT-QA.md)。工程检查不证明教学效果。

两条公开地址托管静态前端，持续进程和身份留在本机。首次使用需安装助手，浏览器可能询问本地网络权限。QQ 提醒需要电脑联网且助手运行，受平台权限和额度限制。

上传内容由 scripts/build-release.py 的允许列表生成：网站源码、组件、公开材料和合成产品截图。私人 Obsidian 原文、原始参考 PDF、账号配置、QQ 凭据与收件、浏览器个人资料和临时调试脚本均不进入发布包。凭据管理器仅用于对应 GitHub / Netlify 请求，不把凭据写入源码或日志。

网页与宿主资料当前分别保存，可经用户导出、导入迁移；尚无自动云同步或公共多人策略市场。正式发布遵循 [腾讯 Buddy 流程](https://open.workbuddy.cn/docs/buddy-app)。公司注册、开发者认证、创建审核与配置审核分别核验。
