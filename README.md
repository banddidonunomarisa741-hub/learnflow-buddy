# LearnFlow学习流动

**网页 1.8.0**：侧栏项目文件夹、对话拖放与排序，以及统一暖橙色的教师页、设置和操作反馈。见 [本版操作与设计说明](docs/PROJECTS-MOTION-1.8.md)。1.7 的课程、策略详情和真实模型校验继续保留。当前 1.8 入口：[GitHub Pages](https://banddidonunomarisa741-hub.github.io/learnflow-buddy/?v=1.8.0)。Netlify 账户发布额度耗尽，原 Netlify 入口仍为上一版。

LearnFlow 是面向自主学习者的对话工作台，也是腾讯产业命题的独立开源项目。学习方法、资料保存和记忆均由用户选择。网页可经授权通过本机 WorkBuddy 或 LearnBuddy 调用云端模型；正式 Buddy 应用仍待平台认证、预览与审核。

## 立即运行

已安装 Node.js 20+：

```sh
npm start
```

访问 `http://127.0.0.1:4173`。没有 Node.js 时，可以直接打开 `public/index.html` 体验预设流程；不同浏览器对 file:// 持久存储支持不同，推荐本地 HTTP 服务。

无前端安装步骤、无外部字体或运行时 CDN、无需租用服务器。授权接口的模型用量可能由对应服务计费，静态演示不会调用模型。

## 可操作的学习闭环

- **学习空间**：三场景起步、学习目标与时间问卷、可调引导及语气。
- **策略广场**：8 张默认策略；可查看原始指令、方法步骤、适用情况、限制与四轮编写示例，复制后编辑。保留立体展台、搜索、收藏、个人评分、启停及导入导出。
- **学习记忆**：本人确认后保存；可编辑、删除并生成专属策略；关闭时不再保存对话或向模型传递记忆。
- **我的策略**：区分真实接口用量与演示估算。多策略 Token 等额分摊只是使用记录，不是因果归因或学习成效。
- **项目协作**：本机任务看板、负责人、完成依据与项目包交换。没有虚构实时多人协作。
- **教师课程**：邀请链接或邀请 JSON；学生逐条选择对话、预览用量并确认提交；教师生成策略评价与针对性作业草稿，人工核验和发布；学生提交、教师验收。跨设备通过 JSON 学习包交换，没有共享后台或认证账号。
- **学习对话**：可搜索的模型菜单、逐段回答、停止与重试、表格代码排版、图片和文件拖拽。
- **学习资产**：核对后保存回答、学习块或 PDF，之后预览、下载或用本机阅读器打开。
- **QQ 连接器**：本人扫码；用户确认后发送单次提醒，读取学习收件箱并由人关联证据。不依据提醒送达或消息内容自动判定学习完成。
- **历史 Buddy 组件**：11 项技能、4 个专家候选、12 个学习与资料工具，以及 MCP Apps 资源。本轮未重制，安装方式与宿主支持范围见对应说明。

`public/` 可完整静态托管；`server/` 仅在本机监听。预设演示始终明确标示，接口失败不会伪造模型成功。

## 模型连接怎样验收

选择本机客户端、读取模型列表后，仍需明确同意一次验证。网页发送算式与随机校验码，核对返回的 `133` 和同一校验码，再显示客户端、实际模型、耗时及用量。模型列表不等于模型已经可用。

本次 WorkBuddy Auto 在 8.506 秒返回 deepseek-v4-flash；LearnBuddy Auto 在 7.657 秒返回同一模型。记录见 [WorkBuddy 验证](output/model-verification/workbuddy-browser-proof.json)、[LearnBuddy 验证](output/model-verification/learnbuddy-browser-proof.json)。`hy4-preview` 本次等待 35 秒无正文后人工中止，仅记为本次未验证。

这里使用两个客户端内置的 CodeBuddy CLI；本机未发现独立的 CodeBuddy PATH 客户端。实际推理由云服务完成，不是本地模型权重。Token 总数优先用服务总数，否则用输入加输出；缓存量分列、不重复相加，未知值如实显示，用量不是账单。

## 两条公开部署路线

1. **GitHub Pages**：在 [GitHub 创建仓库](https://github.com/new)，上传项目。Settings → Pages → Source 选择 GitHub Actions。仓库内工作流发布 `public/`。
2. **Netlify Drop**：将 `public/` 文件夹拖到 [Netlify Drop](https://app.netlify.com/drop)。也可关联仓库，发布目录为 `public`，无需构建命令。

线上版的学习状态保存在当前浏览器，可在本机窗口确认配对后调用连接助手。首次使用需下载并安装助手；浏览器可能询问本地网络访问权限。模型身份由本机通道处理。没有设置公共多人策略数据库。

## Buddy 应用交付

见 [应用包说明](buddy-app/README.md)、[平台核验](docs/PLATFORM-VERIFICATION.md) 与 [本地接口配置](server/README.md)。

包含策略包、专家包、可安装插件、MCP 工具及应用配置源稿。安装方法见 [LearnBuddy 插件说明](docs/LEARNBUDDY-INSTALL.md)，正式平台发布按 [提审检查表](docs/BUDDY-RELEASE-CHECKLIST.md) 进行。控制台完整导入 schema 未公开，需用真实导出配置映射资源 ID，不能把本地源稿当作已审核应用。

实际可创建的应用类型和发布权限，以开发者控制台与平台审核为准。

## 验证与复现

```sh
npm test
node scripts/test-local-cli.mjs
node scripts/test-chat-inputs.mjs
node scripts/test-chat-stream.mjs
```

在源码仓库运行以上检查。测试使用本地确定性上游和合成 CLI 子进程，不消耗真实模型额度。已通过本地 CLI 22 项、输入与连接校验 27 项、后端与 MCP 31 项、流式回复 13 项。教师课程另有 28 项隔离浏览器检查，策略和授权界面有 46 项；这些检查没有向真实 QQ 发送消息。

真实连接证据与合成检查分别记录。真实教学对话、教师 AI 草稿与部署结果需另行验收，不能由合成检查替代。

生成 Buddy 开发包：`python buddy-app/build.py`。发布验证：`python buddy-app/build.py --release`；平台审批与资料未齐全时应报告阻断，不能把开发包当成上架成功。

## 项目材料

- [命名与阶段定位](docs/PROJECT-NAMES.md)
- [研究依据](docs/RESEARCH.md)
- [26 道评委追问](docs/JUDGES-QA.md)
- [部署与发布操作](docs/DEPLOYMENT.md)
- [答辩讲稿](docs/DEFENSE-SCRIPT.md)

学习效果、市场规模、营收与合作不以原型作为证明。试点计划及预算假设见策划材料；没有虚构正式教学实验结果。

## 许可

代码采用 MIT；第三方品牌、考试题、课件与参考材料不随代码获得许可。当前 F 形 Logo 由团队提供，替换此前猫咪视觉；素材来源与授权记录由团队维护，不代表腾讯官方标识。详见 [LICENSE](LICENSE)。


连接助手 **1.7.0**：[本轮更新](docs/TEACHER-CONNECTION-1.7.md) · [QQ 接入](docs/TENCENT-CONNECTORS.md) · [术语表](docs/GLOSSARY.md) · [最新交付清单](最新交付清单.md)。QQ 提醒需要电脑和助手持续运行；网页、宿主及不同设备的资料分别保存，通过文件迁移。旧版 PPT、PDF 和 Buddy 组件保留历史版本。
