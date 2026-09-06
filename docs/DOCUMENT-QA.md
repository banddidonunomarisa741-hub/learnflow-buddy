# 文档交付与版面检查

版本 1.4，2026-09-06。

| 文件 | 当前结果 |
| --- | --- |
| output/pdf/LearnFlow学习流动-项目解决方案-1.4.pdf | 17 页 A4，正文、目录、章节书签 |
| output/slides/LearnFlow学习流动-答辩演示-1.4.pptx | 16 页，262 段可编辑文字，16 页讲者备注 |
| output/pdf/LearnFlow学习流动-答辩演示-1.4.pdf | PowerPoint 原生导出，16 页 |
| docs/PLAN-SOURCE.md / docs/DEFENSE-SCRIPT.md | 正文与逐页讲稿 |
| docs/plan-data.json / docs/slides-data.json | 可再次构建的结构化源稿 |

本轮使用 PyMuPDF 渲染全部 33 页，查看两套联系表，并放大检查解决方案技术与发布章节、PPT 发布页。未发现文字截断、重叠、缺字方块或截图占位。结构另由 scripts/check-documents.py 检查。

方案采用连续正文，减少装饰卡片与大面积留白。PPT 保留分点结构，使用现行网页截图及 F 标志。固定开发周数、未经确认的预算总额已移除，改成可检查的交付条件。11 项技能、4 个专家、12 项工具与实际安装结果已经更新。

原 PDF 正被阅读器占用，本次采用 -1.4 文件名。旧文件保持可打开，不列入最新交付包。

```sh
node scripts/build-deck.cjs
python scripts/build-documents.py
powershell -NoProfile -File scripts/export-slides-pdf.ps1
python scripts/check-documents.py
```

依赖、字体和截图路径见 [构建说明](BUILD.md)。
