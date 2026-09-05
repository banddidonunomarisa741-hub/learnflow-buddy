# LearnFlow 策略连接器

采用官方 MCP + Skill 目录结构，提供真实 stdio JSON-RPC 服务。仅访问包内的策略，工具有 list_learning_strategies、get_learning_strategy、draft_personal_strategy。第三个工具返回可编辑的文本草稿，不写文件或浏览器存储，不收集个人学习数据，不包含腾讯生态连接器。

执行 `python buddy-app/build.py` 生成可独立解压的 connector 包。打包结果包含 mcp/ 与 skills/，从解压目录运行 `node mcp/strategy-server.mjs`。源目录 connector/mcp.json 中相对启动路径基于解压目录；宿主的工作目录行为尚需 WorkBuddy 5.0.0+ 实测。跨平台导入时可将 args[0] 改为解压后的绝对路径。禁止把某个人电脑的绝对路径提交到公共市场。

本地生成 `python buddy-app/build.py --local-config` 会额外生成仅供本机导入的 dist/local-mcp.json（绝对路径，不纳入公开 source zip）。可将该 JSON 作为自定义 MCP 配置使用，需宿主显式连接授权。它不是 Buddy 的内置 OAuth 连接器：官方首页自动启用的内置连接器要求支持 OAuth，本 stdio 工具只作为用户自选连接器。正式上架仍需 source 唯一性、安装路径和宿主兼容性验证及平台审核。

协议依据：[MCP stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。腾讯目录依据：[连接器规范](https://open.workbuddy.cn/docs/connector)。
