**Agent 子应用样式复刻记录**

本次以 `/Users/bytedance/tool_platform/apps/agent` 的实际组件源码为基线，调整当前工作台的样式与相应展示结构。研究、存储、执行与订阅接口保持现有实现。

| 区域 | 对齐内容 | 源码依据 |
|---|---|---|
| 应用布局 | 浅灰侧栏、白色内容区、左上角 16px 圆角 | [layout.module.scss](/Users/bytedance/tool_platform/apps/agent/src/components/layout/layout.module.scss) |
| 导航与历史 | 280/56px 侧栏；小屏 220/48px；40px 导航、36px 历史行、渐隐标题 | [布局组件](/Users/bytedance/tool_platform/apps/agent/src/components/layout/index.tsx)、[历史样式](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/history/ConversationHistory.module.scss) |
| 欢迎页 | 24px 绿色对话图标、22px 标题、14px 说明、轻边框示例标签 | [EmptyConversation](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/EmptyConversation.module.scss) |
| Agent 切换 | 灰底选择器、方形头像、标题和描述、版本角色标签、下拉选项 | [AgentSwitcher](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/AgentSwitcher.module.scss) |
| 阅读与输入 | 960px 最大外框、桌面各 28px 内边距、18px 输入圆角、32px 灰色发送按钮 | [聊天布局](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/index.module.scss)、[输入样式](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/ChatComposerInput.module.scss)、[发送按钮](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/SendButton.module.scss) |
| 消息与过程 | 浅蓝用户消息、14px 正文、13px 过程标题、12px 状态、40px 轮次间隔 | [用户消息](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/UserMessage.module.scss)、[执行过程](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/ExecutionTrace.module.scss) |
| 表格与引用 | 中性表头、13px 表格、细边框、下划线引用 | [MarkdownMessage](/Users/bytedance/tool_platform/apps/agent/src/routes/deepagents-chat/components/MarkdownMessage.module.scss) |
| 数字员工等管理页 | 浅灰画布、白色卡片、中性标签、黑色主按钮、14px 说明 | [数字员工页面](/Users/bytedance/tool_platform/apps/agent/src/routes/digital-employee/index.module.scss) |

独立应用使用整个视口，原项目宿主顶部 72px 导航的占位不带入。菜单与业务文本沿用当前竞品研究场景；顶部 Agent 选择器可切换单 Agent 和多 Agent，设置入口连接现有工作空间设置。

实现位置：

- [应用壳与导航](/Users/bytedance/learning_test/clone_deepagent/apps/web/src/App.tsx)
- [聊天与欢迎页](/Users/bytedance/learning_test/clone_deepagent/apps/web/src/Chat.tsx)
- [Agent 选择器与消息组件](/Users/bytedance/learning_test/clone_deepagent/apps/web/src/components.tsx)
- [样式和设计变量](/Users/bytedance/learning_test/clone_deepagent/apps/web/src/styles.css)
- [管理页](/Users/bytedance/learning_test/clone_deepagent/apps/web/src/Panels.tsx)

验证结果：

- `npm run build` 通过，包括 TypeScript 检查和 Vite 生产构建。
- 桌面浏览器实测侧栏 280px；输入内容宽 904px，对应 960px 外框和两侧各 28px 内边距。
- 历史会话、工具过程展开、Markdown 表格和模型菜单已实际查看。
- Agent 菜单支持方向键、Enter 和 Escape；选择后顶部和输入区模式同步。
- 390×844 小屏实测页面宽 390px，侧栏收起宽 48px，输入区底部位于视口内。
- 小屏 Agent 菜单实测范围 x=64～358px，位于 390px 视口内。
- 无新增业务逻辑测试；本次验证针对展示结构、交互和构建。

截图：

- [桌面聊天页](/Users/bytedance/learning_test/clone_deepagent/docs/screenshots/tool-platform-agent-desktop.png)
- [小屏聊天页](/Users/bytedance/learning_test/clone_deepagent/docs/screenshots/tool-platform-agent-mobile.png)
