# 本地、GitHub 与 Netlify 部署

## 本地演示

推荐在仓库根目录执行 `npm start`，随后打开 `http://127.0.0.1:4173`。或运行 `scripts/start-local.ps1`。没有 Node.js 可直接打开 `public/index.html` 使用预设流程；正式展示建议使用本地 HTTP。

一次完整演示：建立学习路线 → 应试学习 → 点击“用词根词缀背单词，输出表格” → 完成学习块 → 审阅并确认记忆 → 提炼专属策略 → 查看“我的策略” → 导出 SKILL.md → 教师伙伴生成评价草稿。

示例对话为预设。演示时明确说明它证明交互流程，不证明模型已解析任意资料。

## 路线 A：GitHub Pages

1. 在 https://github.com/new 创建公开仓库，建议名称 `learnflow-buddy`。
2. 上传干净源码包，保留 `.github/workflows/pages.yml` 和 `public/` 目录。
3. Settings → Pages → Build and deployment → Source 选 GitHub Actions。
4. 提交到 `main`，查看 Actions 的 Deploy LearnFlow 工作流。
5. 成功后以 Settings → Pages 显示的 Visit site 地址为准。项目页路径依赖仓库名，不提前宣称任意地址已上线。

公开仓库的 GitHub Free 账号可以使用 Pages。实际额度、政策和构建结果以账号页面为准。[官方建站文档](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## 路线 B：Netlify Drop

1. 解压 `learnflow-netlify-drop.zip`。确保文件夹根部可看到 `index.html`。
2. 登录自己的 Netlify 账号，打开 https://app.netlify.com/drop。
3. 拖入整个文件夹。保存它返回的实际站点链接。
4. 更新时把新版本文件夹拖入同一站点 Deploys 页的区域，避免误建重复站点。

也可关联 GitHub 仓库；`netlify.toml` 已设置发布目录 `public`，不需要构建命令。平台额度和可见性以账号为准。[官方部署说明](https://docs.netlify.com/deploy/create-deploys/)

## 两条路线共同的边界

- 都发布纯静态学习工作台，不需要租用常驻服务器。
- localStorage 属于站点来源；本地、GitHub、Netlify 之间不会自动共享数据。先导出、再在目标站点导入。
- 静态站点不会运行 `server/server.mjs` 或 stdio MCP，不能持有模型密钥。
- QQ/微信发消息、会议解析和远程协作仍需要正式授权及服务能力。
- GitHub 和 Netlify 配额不等于无限免费；本项目不代购付费套餐。

## Buddy 正式发布

`buddy-app/` 中包含配置源稿、专家、策略与连接器源文件。先运行构建校验，再到腾讯控制台创建资源并回填真实 ID；在指定宿主预览成功后申请发布。联系方式和主体信息须由实际团队提供，不使用虚构公司/邮箱占位通过审核。

关键区别：网页可运行、开发包可构建、宿主可预览、平台已审核是四种不同状态。交付报告分别列出证据。
