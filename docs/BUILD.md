# 再生成交付材料

网站和本地后端无需第三方运行依赖，Node.js 20+ 即可 `npm start`。

文档再生成使用 Python 的 `reportlab`、`pdfplumber`、`pypdf`，以及 Node 的 `pptxgenjs`、`sharp`。浏览器复测另需 `playwright` 与可用 Chrome。可在自己的环境安装依赖，或设置 `CODEX_NODE_MODULES` / `PLAYWRIGHT_MODULE` 指向已有运行库。

Windows 文档默认使用 `C:/Windows/Fonts/msyh.ttc` 与 `msyhbd.ttc`。在其他系统需在 `build-documents.py` 中指定允许嵌入的中文字体路径。

推荐顺序：

```sh
node scripts/build-deck.cjs
python scripts/build-documents.py
```

PPT 使用 Microsoft PowerPoint 原生导出为 PDF：运行 `scripts/export-slides-pdf.ps1`。没有 PowerPoint 时可自行用已安装的幻灯片软件导出；不应将只转换图片的版本宣称为可编辑 PPT。

内容来源为 `docs/plan-data.json`、`docs/slides-data.json`。文档复用 `public/assets/buddy-cat.svg`、`output/brand/buddy-cat.png` 和 `output/playwright/home-desktop.png`。其他截图以验证报告中的路径为准。

本地测试：`npm test`；启动服务器后，`node docs/validation-script.cjs` 执行独立合成数据的浏览器复测。它将重写测试截图和报告 JSON，不使用个人浏览器资料。

发布包：`python buddy-app/build.py`，然后 `python scripts/build-release.py`。发布包使用明确文件清单，排除原始私人笔记、旧方案 PDF、凭据、本机绝对路径的 MCP 配置和临时依赖。
