# 文档交付与版面检查

核验日期：2026-09-06。

## 交付文件

- `output/pdf/LearnFlow-项目解决方案.pdf`：20 页 A4，新版项目解决方案，带章节书签。
- `output/slides/LearnFlow-答辩演示.pptx`：16 页，文字和形状可编辑，逐页附演讲者备注。
- `output/pdf/LearnFlow-答辩演示.pdf`：由本机 PowerPoint 原生导出，16 页，与 PPTX 版式对应。
- `docs/PLAN-SOURCE.md`：20 页完整内容源稿。
- `docs/DEFENSE-SCRIPT.md`：16 页讲稿、建议演示顺序与临场边界用语。
- `docs/plan-data.json`、`docs/slides-data.json`：可再次构建的结构化源稿。

## 真实检查

1. 使用 ReportLab 和系统微软雅黑字体生成策划书，逐页按实际换行测量正文高度；无底部溢出。
2. 使用 PptxGenJS 生成可编辑 PPTX，PowerPoint 打开并原生导出 PDF；并非将整页做成图片。
3. 使用 Poppler 渲染全部 36 页，查看两套全页联系表，并放大检查策划书预算、参考资料页和 PPT 产品截图、Buddy 发布页。
4. 检查中文、页码、间距、对齐、表意与实际产品截图，无缺字方块、内容重叠、截断或截图占位文字。
5. 最终结构验证见 `output/document-checks.json`，包括页数、编辑文本和 16 页备注。

## 内容校正

- 沿用原方案“定位→需求→解决方案→设计依据→验证→企业价值→团队与成果”的骨架；根据本次任务新增预算、12 周路线、10 人分工、双部署和应用审核边界。
- 官方存在个人认证，不能把“必须立即成立公司”写成确定结论；个人具体 Buddy 权限待控制台核验。
- Skill 和 MCP 互补；跨模型迁移需要接口边界、版本与回归检查。
- LearnBuddy 和 ChatGPT Study Mode 已有记忆等能力，竞品分析按官方公开能力描述，不以“没有记忆”作为差异。
- 10 个策略、4 个专家候选包、只读 MCP 与配置源稿属于工程产物；不声称完成腾讯宿主认证、OAuth 登录或应用审核。
- 用户访谈、试用样本、效果验证和 5,000 元预算均明确标为计划或内部假设，未填写虚构成绩、市场规模、客户或收入。

## 构建方式

在具备依赖的本机依次运行：

```powershell
& 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/build-deck.cjs
& 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 scripts/build-documents.py
& scripts/export-slides-pdf.ps1
& 'C:/Users/Asus/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 scripts/check-documents.py
```

首个脚本同时从统一 SVG 构建猫咪 PNG。默认读取 `output/playwright/home-desktop.png` 作为真实产品截图；更新后须重新构建并渲染检查。导出 PPT PDF 依赖本机安装的 PowerPoint。源数据和计划人数后续修订时应保持策划书、讲稿及研究文档一致。
