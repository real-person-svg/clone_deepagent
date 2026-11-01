# 项目结构重构记录

本次以现有 React、Vite、Fastify 和 SQLite 实现为基线，调整业务代码组织方式，并保留 HTTP 路径、请求校验、响应格式、数据库结构、研究结果及界面交互。没有升级依赖。

## 功能目录

| 范围 | 当前组织 | 主要职责 |
| --- | --- | --- |
| 前端工作空间 | `apps/web/src/features/workspace` | 应用组合、侧栏与弹窗；路由、工作空间刷新与历史搜索分别由 Hook 管理 |
| 前端对话 | `apps/web/src/features/chat` | 对话、输入区、Agent 选择器和执行轨迹；历史、SSE、输入交互分开管理 |
| 前端功能页面 | `features/agents`、`sources`、`reports`、`subscriptions`、`notifications` | 每个功能就近存放组件、专用 Hook、配置与样式；订阅模板编辑与订阅表单独立组合 |
| 通用前端能力 | `apps/web/src/shared` | HTTP、时间格式化、Markdown、复制按钮，以及多个页面共同使用的基础、表单、布局样式 |
| HTTP API | `apps/server/features` | 按工作空间、会话、执行、来源、报告、Agent、订阅和通知注册路由 |
| HTTP 公共边界 | `apps/server/http` | 参数 schema、错误响应和本机来源校验；`app.ts` 装配资源和生命周期 |
| 执行运行时 | `packages/agent-runtime/execution` | Agent 循环、待执行工具、checkpoint、并发槽、上下文、租约校验及报告发布 |
| 模型适配 | `packages/agent-runtime/models` | 演示适配器、演示报告格式化、HTTP 流式适配器及模型类型 |
| 研究能力 | `packages/research` | 检索、定价、历史、来源采集、委派和订阅按功能聚合；工具入口统一处理权限及参数校验 |
| 持久化 | `packages/storage` | 连接与事务、schema、记录解码、工作空间仓储分别组织；保留 `Store`、`AppError` 等公开导出 |
| 验证 | 功能目录及 `tests` | 专用单元测试与功能代码相邻；跨功能 API、运行时和浏览器测试保留在 `tests` |

框架入口 `main.tsx`、服务器 `index.ts`、Vite 根目录和现有启动命令保持原有职责。`packages/contracts/index.ts` 继续集中定义公共业务协议，未为目录形式拆散协议。原有运行时、模型和存储入口继续导出相同名称。

## 代表性分离

- `Chat.tsx` 和 `ChatComposer.tsx` 保留界面结构。`useConversationSession.ts` 负责会话切换和异步请求保护，`useRunEvents.ts` 负责 SSE 及重连清理，`useChat.ts` 负责输入与提交交互。
- `conversation-turns.ts` 根据消息和事件计算当前轮次输出；`run-events.ts` 负责历史与流事件的去重、覆盖和排序；`trace-view.ts` 负责执行记录的显示数据计算。这些普通函数不依赖 React。
- `useTaskTemplates.ts` 管理模板草稿与发布，`useSubscriptionPanel.ts` 管理订阅创建和立即检查。组件直接绑定已准备好的事件、动态标签、样式值及禁用状态。
- `runtime.ts` 保留调度、租约、取消和停机恢复；`AgentRunner` 负责 Agent 循环；工具持久化与报告验证分别进入 `pending-tools.ts` 和 `report.ts`。
- `Tools` 保留统一执行入口，各业务工具在对应功能中定义。网页采集的地址校验、DNS 固定地址、重定向和响应大小边界保留在 `sources/public-page.ts`。

业务源码中的嵌套三元表达式已清理；可条件追加的请求字段和模型续轮字段改为逐步赋值。静态 Agent 选项、工具标签和导航配置就近存放，没有统一添加 `useMemo` 或 `useCallback`。

## 行为保护与验证

- 重构前：类型检查通过，原有 30 项测试通过。
- 重构后：类型检查与生产构建通过；6 个单元/集成测试文件、32 项测试通过。新增测试覆盖异步历史和 SSE 重连时的重复事件、乱序事件及不修改旧状态的行为。
- 临时基线对照：分别运行重构前后的基准/变化快照、单/多 Agent 研究，回答文本与完成状态一致；两期证据、工具定义以及订阅变化通知内容一致。对照用例依赖本机临时源码快照，验证后已移除，未加入日常测试。
- 样式对照：CSS 按原始顺序切分，通过 `styles.css` 集中导入。比较重构前后的 CSS AST，选择器、声明、媒体查询及层叠顺序一致。
- 浏览器回归入口为 `npm run test:ui`，需先执行 `npm run build`，并安装 Google Chrome。使用独立临时 SQLite 数据库，仅监听 `127.0.0.1:14317`，结束后清理。
- 桌面、移动端 2 项浏览器回归均通过：覆盖 Agent 菜单键盘焦点、发送与历史刷新、证据抽屉、重命名、报告、Agent 草稿、资料导入、模板发布、订阅及变化通知、附件和任务停止。
- Prettier 检查通过；依赖版本及 `packages/contracts/index.ts` 与修改前一致。未发现尚未解决的重构回归问题。

现有项目没有独立 lint 命令；使用类型检查、Prettier、现有测试和构建进行验证。本次没有运行消耗真实模型额度的 `validate:live`，也没有重新验证外部网页可用性。原有真实模型验证记录保留在 `docs/jianying-live-validation.md`。

当前目录没有 `.git`，无法通过 Git 核对未提交修改。开始修改前保存的源码快照位于 `/tmp/clone-deepagent-refactor-baseline`；重构以该快照为基线，未使用版本重置或覆盖恢复命令。默认数据库、既有验证数据和模型配置未作为本次测试写入目标。
