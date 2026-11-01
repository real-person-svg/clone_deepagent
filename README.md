**Agent Studio · AI 商业化竞品研究工作台**

本地运行的 React + TypeScript + SQLite 应用。自研 ReAct 和多 Agent 调度，不依赖 LangChain、LangGraph 或 DeepAgents。

先安装 Node.js 24（支持 22.16+）与 pnpm 10，再在项目目录运行：

```sh
pnpm install --registry=https://registry.npmjs.org
pnpm dev
```

浏览器打开 [Agent Studio](http://127.0.0.1:5173)。API 默认监听 `127.0.0.1:4317`。开发启动脚本会优先使用当前兼容的 Node，也可使用机器上已有的 nvm/本地运行时，不会修改全局 Node 配置。

生产构建与本机启动：

```sh
pnpm build
pnpm start
```

构建后访问 [本机服务](http://127.0.0.1:4317)。服务包含静态前端和 API，仅用于本机工作空间。修改后重新构建才会更新生产页面。

验证命令：

```sh
pnpm typecheck
pnpm test
pnpm build
```

**已实现的链路覆盖聊天、研究和订阅。**

- 单 Agent：提交问题 → 选择上下文 → 模型/演示适配器 → 工具参数校验 → 执行工具 → SQLite 保存结果和 checkpoint → 继续 ReAct → 带引用报告。
- 历史：会话搜索、重命名、删除；消息与执行过程回放；刷新继续订阅；历史追问；Markdown 导出。
- 多 Agent：主 Agent 委派资料、定价、产品、策略、核验任务；独立子任务并行，主任务按阶段汇总。
- 发布：Agent 提示词草稿与不可变版本；任务模板草稿与发布；订阅固定模板和 Agent 版本，后续发布不改变已有订阅。
- 订阅：持久化间隔调度、手动触发、同组任务串行、触发去重、价格阈值、授权变化、失败通知、基线更新和站内通知去重。
- 证据：30 份虚构资料的两期快照，文本导入、公共静态网页采集、原文侧栏、hash、观察时间和报告引用。
- 可靠性：运行租约、取消、已提交工具结果复用、checkpoint 恢复、模型步数/总调用预算、长上下文选择、SSE 事件序号补发。

所有应用数据保存在 `data/workspace.sqlite`，SQLite 原生驱动开启 WAL、外键、FULL 同步和 busy timeout。`data/`、`.env`、依赖和构建结果不提交。服务首次启动自动迁移并导入固定资料。再次启动保留用户会话和配置。

历史追问默认沿用该会话前次研究的资料快照；明确询问“最新、现在、刷新、更新、变化、当前快照”时使用工作空间当前快照。旧报告正文和引用保持原样。

**离线演示与真实模型明确分开。**

离线模式不需要密钥，使用可重复的规则适配器选择工具；它实际经过同一套 Runtime、队列、SQLite 和 SSE。Alpha、Beta、Gamma 以及 `.example` 链接均为虚构测试资料，输出不是市场研究结论。该模式用于工程验收，不用于证明真实模型的规划或分析能力。

真实模型使用兼容 Chat Completions 的流式 HTTP 接口。将 `.env.example` 复制为 `.env` 后在服务端配置：

```dotenv
MODEL_BASE_URL=https://your-provider.example/v1
MODEL_NAME=your-model-name
MODEL_API_KEY=your-provider-key
MODEL_TIMEOUT_MS=120000
```

重启服务，然后在输入区选择“真实模型”。需要支持 SSE 流式响应、原生 `tools` 调用和 usage 流式选项。支持无需密钥的本机兼容模型服务；提供者返回的错误正文不会透传到页面。应用不会通过浏览器读取密钥。

先在“来源资料”导入真实产品说明或公开定价页，再提出问题；也可在问题中提供 URL，让模型调用 `fetch_source`。运行时只允许采集用户明确提供或已经登记的 URL。真实模式检索排除虚构资料。价格抽取由模型生成候选，数值计算由 Decimal 完成，语义和条件仍须结合原文核对。

真实价格候选须带 `evidenceId` 及包含金额、付款周期的逐字 `sourceQuote`。周期未注明的标价不能直接作为月价计算。多关键词来源/历史检索支持分别匹配，长文返回匹配附近的原文并可分页；无效引用允许一次修正，仍无效则阻止发布。厂商返回的续轮字段仅用于 checkpoint 和模型协议重放，不进入聊天或事件流。

已使用真实模型验证剪映商业化案例，包含多轮约束更新、多 Agent、并发、取消、重启恢复与长上下文测试。详细结果和局限见 [剪映真实模型验收](docs/jianying-live-validation.md)。重跑会消耗真实接口额度，默认 `npm test` 不调用真实模型：

```sh
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- sources
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- scenario
```

验证数据使用独立的 `data/validation/jianying-live/optimized/workspace.sqlite`，不改变默认工作空间的历史、Agent 配置或订阅。来源和研究文本会提交给 `.env` 中配置的模型服务。

当前来源采集支持公开静态 HTML 和文本，限制 1.5MB、标准端口与公共 IPv4，按每次跳转校验并固定 DNS 地址，阻止本机、内网和元数据地址。动态浏览器采集、自动 Web 搜索、PDF/OCR 与外部数据平台不在本次实现中。文本上传支持 TXT、MD、CSV、JSON；报告导出为 Markdown。

**变化订阅可以按以下步骤重复验收。**

1. 在左下角工作空间设置选择“基准期”快照。
2. 打开“任务与订阅”，发布任务模板或使用默认已发布模板，创建订阅。
3. 切换到“变化期”，点击“立即检查”。
4. 查看多 Agent 过程与报告；研究通知应出现 Alpha 从 USD 29 到 USD 39、上涨 34.48%，以及 Gamma 商用署名条件变化。
5. 再次检查相同快照，不会重复创建变化告警。
6. 暂停订阅后不再调度；服务关闭期间不执行，重新启动后合并补最近一次到期检查。

订阅目前针对固定资料提供可验收的确定性变化规则，使用离线适配器，不消耗真实模型额度。真实来源的持续采集、结构化事实人工核验与变化订阅尚未接入。间隔调度使用持久化 UTC 时间，界面显示北京时间；它是按创建时间计算的间隔，不是固定每天 9 点的 cron。

**工程结构先按功能归类，再按职责拆分。**

| 位置 | 内容 |
|---|---|
| `apps/web/src/features` | 工作空间、对话、Agent、来源、报告、订阅、通知；组件、Hook、配置、样式和单元测试就近放置 |
| `apps/web/src/shared` | 通用 HTTP、时间格式化、Markdown、复制按钮，以及跨功能布局和表单样式 |
| `apps/server/features` | 按工作空间、会话、执行、来源、报告、Agent、订阅、通知注册 API 路由 |
| `apps/server/http` | 参数 schema 和本机来源边界；`app.ts` 负责应用装配与生命周期 |
| `packages/contracts` | API、运行事件与业务协议 |
| `packages/storage` | 数据库连接与事务、schema、记录解码、工作空间仓储；`index.ts` 保留公开入口 |
| `packages/agent-runtime` | `models` 管理模型适配和演示报告；`execution` 管理 Agent 执行、工具 checkpoint、委派和报告；`runtime.ts` 管理调度与恢复 |
| `packages/research` | 检索、定价、历史、公共来源、委派和订阅各自聚合工具及专用逻辑；`tools` 负责统一校验和分发 |
| `tests` | 跨功能 API/运行时集成测试和桌面、移动端浏览器回归；专用单元测试放在功能旁边 |

验证结构调整可运行：

```bash
npm run typecheck
npm test
npm run build
npm run test:ui
```

浏览器测试使用本机已安装的 Google Chrome，监听 `127.0.0.1:14317`，创建并清理独立临时 SQLite 工作空间。`test:ui` 使用上一步生成的 `dist/web`。重构说明和验证范围见 [结构重构记录](docs/refactoring.md)。

完整设计见 [技术方案](docs/ai-commercial-competitive-analysis-plan.md)。该设计包含后续扩展，当前实现范围以此 README 和代码为准。

当前采用单机本地工作空间，尚未实现多用户身份和跨工作空间权限，因此服务保持本机访问边界。模型选择、网页调用和资料读取受服务端工具白名单控制。启动两个服务实例时依赖数据库租约协调 Run；不支持多机器共享 WAL 文件。

正常退出会把在途任务回收到队列。意外进程退出后等待最多约 30 秒租约过期，再从 checkpoint 重试；若模型请求结果尚未提交，恢复可能再次调用模型。数据备份需使用 SQLite 一致性备份方式或在服务停止后复制数据库及相关 WAL 文件。
