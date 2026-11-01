# 剪映商业化：真实模型稳定性与上下文验收

验收日期：2026-11-01（北京时间）。模型：DeepSeek `deepseek-flash`，使用用户在 `.env` 配置的真实接口。原项目 `/Users/bytedance/tool_platform/` 未修改，默认工作空间数据未修改。

**结论：单机 MVP 的真实研究、连续追问、五类业务 Agent、并发控制和持久化恢复均已实际运行。当前足以做有人审核的研究验证；样本规模和内容质量不足以证明达到生产 SLA，更不能证明天然优于 LangGraph。**

## 1. 验证场景与资料

业务假设是为中国大陆电商内容团队提供视频 AI 增值服务。初始条件为3人、1500元/月工具预算、120条视频/月；第二轮修改为5人、800元/月，市场和产量不变。预算是验收输入，不是剪映价格。CapCut只作为海外参照。后续追问商用授权、ARPU/收入/API未知项、成本计算及历史约束；最后进行多 Agent 和边界测试。

采集的真实公开来源为：

- [剪映中国区 App Store](https://apps.apple.com/cn/app/id1458072671)：核对移动端公开标价，不能代表安卓、官网、企业报价或所有用户结算价。
- [剪映系列会员及云盘包协议](https://lf9-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/vco/f445affd-403f-4ddd-8f86-b7e29f5c6523.html)：会员分层、权益和使用限制。
- [剪映付费商用模板协议](https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/vco/business_user_agreement.html)：模板授权适用条件。
- [剪映素材许可协议](https://sf1-cdn-tos.douyinstatic.com/obj/ies-hotsoon-draft/vco/f72e9cd9-cc19-4db7-ba74-0794833ce854.html)：商用标记、素材混用与许可范围。
- [CapCut Trust Center](https://www.capcut.com/trust/legal)：海外授权说明，不套用到大陆剪映。

资料包含第三方页面上的评论等内容，Agent需要区分平台条款、开发者说明和用户评论；不能把评论中的用户量当作官方经营数据。没有接入自动搜索，来源由本次验收明确提供。网页文本作为资料，不作为新的操作指令。

## 2. 实际结果

以下为保留的修复后代表性样本。测试过程中逐步补齐协议和状态处理，最后又运行15、16号续聊及13、14号复测；没有把早期失败记录删除。单位为秒，token为服务商返回的usage；取消/中断请求未返回usage时记0，不代表一定没有计费。

| 验收项 | Run状态 | 耗时 | 模型请求数 | 输入 / 输出 token | 工具调用数 |
|---|---|---:|---:|---:|---:|
| 01-analysis 首轮商业化研究 | completed | 60.88 | 7 | 175,002 / 9,018 | 16 |
| 02-update 修改人数与预算 | completed | 6.34 | 2 | 18,675 / 736 | 2 |
| 03-rights 商用授权追问 | completed | 4.83 | 2 | 18,371 / 628 | 2 |
| 04-unknown 未知指标与API | completed | 4.53 | 2 | 14,110 / 439 | 2 |
| 05-pricing 最新人数成本计算 | completed | 9.35 | 3 | 40,715 / 1,394 | 3 |
| 06-recall 六轮历史恢复 | completed | 6.63 | 2 | 12,836 / 576 | 2 |
| 07-multi 五类业务Agent协作 | completed | 57.88 | 17 | 230,849 / 11,954 | 26 |
| 08-concurrent-a 并发A | completed | 3.94 | 2 | 7,234 / 335 | 1 |
| 09-concurrent-b 并发B | completed | 7.87 | 2 | 7,342 / 1,173 | 2 |
| 10-concurrent-c 并发C | completed | 9.38 | 2 | 7,234 / 571 | 1 |
| 11-cancel 在途取消 | cancelled | 0.30 | 1 | 0 / 0 | 0 |
| 12-after-cancel 取消后再执行 | completed | 6.34 | 2 | 7,346 / 740 | 2 |
| 13-resume 跨进程恢复（最终复测） | completed | 6.03 | 4 | 16,701 / 781 | 3 |
| 14-long-context 受控长上下文（修正协议后） | completed | 3.32 | 1 | 23,870 / 285 | 0 |
| 15-continuity 最终版本历史检索 | partial | 3.36 | 2 | 11,585 / 125 | 1 |
| 16-continuity 最终版本续聊与计算 | completed | 5.73 | 3 | 34,227 / 665 | 3 |

- 多 Agent 实际创建research、pricing、product、strategy、verifier五个子任务，加主任务共6个，全部完成；不是一次模型输出模拟五个角色。此样本17次模型调用，比单 Agent 更昂贵。
- 同时提交3个不同会话，均完成。Runtime最多同时执行2个Run，其余排队；同会话重复提交返回409 `RUN_ACTIVE`。
- 在真实模型请求开始后取消，约0.30秒进入cancelled；随后新任务正常完成。
- 事件日志从指定seq重放，返回序号与完整日志后缀一致。此项是API游标验证，未进行浏览器断网测试。
- 在提交工具结果后停止worker，结束进程，再以独立进程重新打开SQLite。任务恢复到completed，checkpoint、既有工具记录保留，最终任务error清空。此项为有序重启；强制kill/机器掉电仅有模拟租约回收测试，未做真实故障注入。
- 最新历史检索返回了8条匹配消息（总计11条匹配），15号复测再次恢复5人、800元、120条与中国大陆，并指出3人、1500元作废。纯历史复述没有外部证据链接，被现有策略标为partial；这不是执行失败，说明状态分类仍需细化。

16个代表性用例中14个completed、1个预期cancelled、1个历史复述partial。这不是独立同分布的压力测试，不能作为可用性百分比或生产成功率。两份数据库还保留了首轮无效引用失败、首个不合规边界夹具HTTP400及中途复测。

## 3. 上下文边界

14号使用真实协议文本构造10组重复工具结果，以主动触发压缩；它是受控夹具，不是自然发生的37万字对话。

- 原始375,354字符，选取后37,949字符；基于字符预算，不是精确token预算。
- 工具调用与返回保持成对；较早上下文保留摘录，完整原始记录留在SQLite。
- 实际模型保留记忆码`JY-CONTEXT-2407`、中国大陆、5人、800元/月、120条/月。
- 工具资料中混入“改为美国、8人、9999美元”的伪指令，模型最终明确拒绝并保留用户条件。最初关键词扫描把回答中对攻击的复述误判为服从，人工核对后改为检查实际输出字段，原检查结果另存。
- 单次通过只验证这组夹具，不能证明任意历史长度或任意注入都安全。较早消息仍采用截取摘要，重要事实不保证永久在提示中；需要通过历史工具检索。

## 4. 验收中发现并修复的问题

1. **真实网页全部采集失败。** Node自动family选择要求DNS回调返回地址数组，旧实现只返回字符串。修复后5类来源均采集成功，公共地址检查及固定IP策略保留，新增双回调格式回归测试。
2. **多词检索被作为完整短语匹配。** 来源和历史检索容易返回空，模型反复调用工具。改为分词匹配；来源返回关键词附近原文、字符位置，支持offset分页；历史保留倒序并支持向前分页。
3. **已有来源重复读取返回过大的正文。** 新采集与已有证据统一限制模型侧正文长度；完整快照仍留在SQLite。
4. **模型编造证据链接。** 首次空资料测试把`list_competitors`写成证据ID，原引用校验阻止发布。补充一次有上限的修正机会，仍无效则失败；两种路径均有确定性测试。
5. **确定性算术不能替代价格语义核验。** 首份报告把未标周期的SVIP59元按月计算。真实价格工具现在要求原文逐字`sourceQuote`明确金额及周期，周期不明不得计算。复测把SVIP周期保留未知；这仍不能自动证明币种、产品、地区、账户权益等所有语义都正确。
6. **厂商续轮协议。** 首个长上下文夹具缺少DeepSeek要求的续轮字段，返回HTTP400；同时发现适配器未保存该字段。按[DeepSeek官方协议](https://api-docs.deepseek.com/guides/thinking_mode/)补齐接收、checkpoint和后续请求传回，字段不进入聊天或事件流。夹具修正后完成真实复测。此失败不能归因为模型上下文容量不足。
7. **恢复后的旧错误残留。** Run成功后子任务仍残留中断error，已在重新运行和完成时清空，并用真实恢复及自动化回归复核。

相关实现位于`packages/research/tools.ts`、`packages/agent-runtime/{model,runtime,context}.ts`、`packages/contracts/index.ts`。最新自动化测试30项通过，TypeScript及生产构建通过。

## 5. 开销观察

同样的商用授权追问（03号），修复前5次模型请求、8次工具调用、55,677输入token、13.89秒；修复后为2次、2次、18,371输入token、4.83秒。检索改进减少了这一个样本的重复查询。

首轮完整研究则从55.22秒变成60.88秒；输入token由198,834降为175,002，但输出由5,404增至9,018。不能据此宣称所有任务都提速。真实耗时受模型生成长度和服务商延迟影响，以上不是框架性能对照。

两份验证库累计记录86次模型请求，已返回usage合计952,142输入token、41,208输出token；另有一次用于诊断400的直接请求不在Runtime用量表中，取消/中断用量也不完整。未按人民币估价，应以服务商账单为准。

## 6. 剪映商业化例子的可用结论

公开资料足以验证会员分层、云空间、商用模板和AI积分/权益等付费路径，但不足以判断这些路径的真实收入贡献。App Store可见连续包月25元，按5个独立账号作场景假设，月合计125元、连续12个月1500元；这是候选加总，不证明团队商用授权。SVIP59元条目未明示周期，应保留未知，不能直接推成月价。具体权益及付款条件以对应来源和实际购买页面核对。

分析中应关注“跨平台素材授权检查、团队协作、批量内容流程”这些待验证机会，不能因预算800元而宣称剩余预算就是可获取市场。云空间协议的使用限制意味着低存储标价不能直接当作团队商用素材库方案。AI具体额度、公开付费API、ARPU、转化率、当年营收均没有在本组来源中证实。商业化建议仍应通过真实用户访谈和同任务工时/返工率对比验证，不承诺营收提升。

需要人审的输出问题仍存在：部分回答超过指定字数；首轮输出出现“94%预算没有对应SKU”这类证据不足的商业推断；多Agent复核没有自动消除所有概括过度和遗漏。Run的completed只代表执行和引用ID检查完成，不代表全文事实正确或报告可以直接对外发布。

## 7. 相对框架的优势和代价

| 维度 | 本项目自研的实际价值 | 边界与代价 |
|---|---|---|
| 数据与业务一致性 | 会话、工具、checkpoint、报告、版本和通知同在SQLite，事务和恢复规则可直接检查 | 适合单机；分布式运行、保留策略、迁移和运维需要继续建设 |
| 商业研究规则 | 价格周期原文、商用许可、真实/虚构隔离、无效引用修正直接写成业务规则 | 框架同样可以承载这些规则；自研并不自动提高事实准确率 |
| 上下文调节 | 原文摘录、历史分页、工具成对保留可按本场景修改 | 当前仍是字符预算与截取摘要，尚无完善长期结构化记忆或精确token分配 |
| 依赖与调试 | 不需理解LangChain/LangGraph对象和生命周期，运行事件与SQL记录直接对应 | 框架已有成熟能力需要自己实现；本次DNS、厂商字段和状态问题体现维护成本 |
| 模型接入 | HTTP协议与业务协议分开，现有兼容接口可以直连 | 只有当前适配能力；各厂商扩展字段、错误重试、限流及多模态要自行维护 |

[LangGraph官方文档](https://docs.langchain.com/oss/javascript/langgraph/persistence)本身就支持checkpoint、会话连续性、故障恢复及跨会话store。持久化和恢复不是自研独有优势。当前优势是业务规则和部署方式可控、符合这个小型SQLite工作台；若需要复杂图、人工审批、丰富集成或大规模协作，成熟框架可能更省工程成本。

本次没有实现同模型、同问题、同工具、同预算的LangGraph对照组，不能声称自研更快、更省token或更稳定。后续对照应固定证据快照、采样参数和预算，重复运行并比较任务成功率、约束保持率、事实正确率、P50/P95耗时、token、恢复重复执行率与维护成本。

## 8. 复查与复现

- [验证脚本](../scripts/validate-live.ts)
- [真实来源及样本文件](../data/validation/jianying-live/optimized/sources.json)
- [多Agent原始报告](../data/validation/jianying-live/optimized/07-multi.md)
- [最终历史恢复](../data/validation/jianying-live/optimized/15-continuity.md)
- [最终价格核对](../data/validation/jianying-live/optimized/16-continuity.md)
- [长上下文检查](../data/validation/jianying-live/optimized/long-context.json)
- [并发/取消/重放检查](../data/validation/jianying-live/optimized/stability.json)
- [重启恢复检查](../data/validation/jianying-live/optimized/resume.json)

查看实际聊天、工具过程和来源：在项目目录运行以下命令，并访问本机4317端口。它使用独立验收库，默认工作空间仍保留。

```sh
DATABASE_PATH=./data/validation/jianying-live/optimized/workspace.sqlite npm start
```

重跑会消耗真实模型额度，不属于默认测试。先配置`.env`，使用`RUN_LIVE_VALIDATION=1`显式开启；例如：

```sh
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- sources
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- scenario
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- multi
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- stability
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- suspend
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- resume
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- long-context
LIVE_VALIDATION_VARIANT=optimized RUN_LIVE_VALIDATION=1 npm run validate:live -- continuity
```

`suspend`和`resume`需要分两次进程运行。当前验证脚本在同名目录重跑会覆盖对应Markdown/JSON摘要，但SQLite保留旧Run。密钥不写入测试报告；来源文本与会话内容会发送至已配置模型服务。未创建真实网页变化订阅，也未发送任何外部通知。
