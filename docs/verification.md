**Agent Studio 实现验收记录**

日期：2026-11-01。验收针对本机单工作空间 MVP，源项目 `/Users/bytedance/tool_platform/` 保持只读。

自动化检查结果：

| 检查 | 结果 |
|---|---|
| `npm test` | 结构重构后：6 个测试文件，32 项通过 |
| `npm run test:ui` | 独立临时工作空间：桌面与移动端 2 项通过 |
| Prettier | 业务源码、测试、脚本和项目配置检查通过 |
| `npm run build` | TypeScript 检查和 Vite 生产构建通过 |
| 生产包 | 应用、React、Markdown、UI 分包，构建完成 |
| 编排依赖 | 源码与生产锁文件中没有 LangChain、LangGraph、DeepAgents 依赖 |

本次结构调整及基线行为对照记录见 [结构重构记录](refactoring.md)。真实模型验收保留原记录，本次没有重新调用真实模型。

自动化覆盖的关键行为包括：

- 年付与最低席位计算，价格变化精确到 34.48%，严格大于阈值。
- 单 Agent 实际工具调用、checkpoint 保存、报告引用、另一 SQLite 连接读取完整历史。
- 历史追问调用历史工具恢复约束；默认保留前次资料快照，明确要求更新时才刷新。
- 已提交工具结果恢复后不重复执行；不同运行的重复模型 call ID 正确隔离。
- 取消在途任务，过期租约恢复，报告和任务终态一致。
- 多 Agent 分阶段委派、并行分析、前后快照引用和报告保存。
- Agent 发布修订冲突、任务模板发布和订阅固定版本。
- 重复调度只形成一个逻辑任务，报告提交后的告警补偿与去重。
- 无变化不重复通知；失败不推进基线；暂停订阅不执行。
- SSE 序号回放、报告导出、会话重命名和级联删除。
- 本机 API 来源检查、参数验证、未配置模型提示、私网抓取地址拦截。
- 真实模型协议的分片参数组装、文本流、用量读取与中途断流检测（模拟 HTTP 响应）。

浏览器实际验收结果：

| 操作 | 观察结果 |
|---|---|
| 点击定价示例并发送 | 运行记录展示三个实际工具调用，生成含年付、席位和证据的报告 |
| 刷新会话 | 消息、报告和执行过程从 SQLite 恢复 |
| 点击报告引用 | 侧栏打开原始资料、观察时间、来源和 hash |
| 创建订阅并切换快照检查 | 多 Agent 完成研究，生成一条包含两项商业化变化的站内通知 |
| 发布研究模板 | 出现 v1 已发布模板，可作为订阅来源 |
| 暂停验收订阅 | 显示已暂停，立即检查禁用，验收结束不继续调度 |
| 390×844 小屏检查 | 页面宽度 390，无横向溢出；输入区底部 838，位于可视范围内 |
| 生产构建页面 | 本机静态资源与 API 正常，浏览器错误日志为空 |
| 生产版本历史追问 | 成功读取历史约束并保留三人团队的计费条件 |

界面截图：

- [桌面聊天页](/Users/bytedance/learning_test/clone_deepagent/docs/screenshots/agent-studio.png)
- [手机聊天页](/Users/bytedance/learning_test/clone_deepagent/docs/screenshots/mobile-chat.png)
- [变化通知](/Users/bytedance/learning_test/clone_deepagent/docs/screenshots/research-notification.png)

最初实现验收只验证了兼容流式协议的模拟响应。用户补充模型配置后，已对 DeepSeek `deepseek-flash` 进行真实剪映商业化验收，详细记录见 [真实模型验收报告](/Users/bytedance/learning_test/clone_deepagent/docs/jianying-live-validation.md)。离线适配器的虚构资料仍不作为真实研究能力的证明。

变化订阅当前用于固定竞品资料集的确定性验收。真实网页的持续采集、事实人工核验与变化订阅，以及动态页面、搜索 API、PDF/OCR、多用户身份和外部通知，仍属于后续扩展。当前可通过导入真实文本或显式公共 URL，在配置的真实模型中进行一次性研究。

启动与配置见 [README](/Users/bytedance/learning_test/clone_deepagent/README.md)。最初验收的示例会话、报告、模板和通知保存在默认本机数据库中，示例订阅已暂停。自动化单元/集成测试库在临时目录创建并在测试后清理；真实模型验收库独立保留于 `data/validation/jianying-live/` 以供复查。
