# Pi 源码学习工作簿

这不是一份按天安排的阅读清单，而是一条必须逐步完成的源码实验路线。每个步骤都包含：打开的文件、要定位的符号、要验证的行为、记录的产物和进入下一步的门槛。

## 主线

```text
examples/sdk/01-minimal.ts
  -> coding-agent/src/core/sdk.ts:createAgentSession
  -> coding-agent/src/core/agent-session.ts:prompt
  -> agent/src/agent.ts:prompt
  -> agent/src/agent-loop.ts:runAgentLoop
  -> ai/src/compat.ts:streamSimple
  -> provider stream events
  -> tool execution
  -> next turn
```

## 具体步骤

### 1. SDK 入口

打开 `packages/coding-agent/examples/sdk/01-minimal.ts`，记录 `createAgentSession`、`session.subscribe` 和 `session.prompt` 三个调用。

打开 `packages/coding-agent/src/core/sdk.ts`，定位 `CreateAgentSessionOptions`、`CreateAgentSessionResult` 和 `createAgentSession()`。将函数体标成四组：环境（cwd/agentDir/resourceLoader）、模型（ModelRuntime/model/thinkingLevel）、会话（SessionManager/restore）、Agent（new Agent/new AgentSession/tools/extensions）。

完成标准：能说明返回值中的 `session` 和 `extensionsResult`，以及每个组装对象由谁消费。

产物：`notes/01-sdk-entry.md`。

### 2. AgentSession 边界

打开 `packages/coding-agent/src/core/agent-session.ts`，定位 `prompt()` 和 `this.agent.prompt(...)`。只记录 prompt 前后的 system prompt、tools、messages 和 session persistence 操作。

完成标准：画出 `session.prompt(text) -> AgentSession 准备上下文 -> Agent.prompt(messages)`。

产物：`notes/02-session-boundary.md`。

### 3. Agent 状态

打开 `packages/agent/src/agent.ts` 的 `Agent` 构造函数、`prompt()`、`runPromptMessages()`；配合 `packages/agent/src/types.ts` 的 `AgentState`、`AgentMessage`、`AgentEvent`、`AgentTool`。

完成标准：解释哪些字段跨 prompt 保留，哪些字段只在一次运行中存在，并说明 `Agent` 不直接实现 provider 协议。

产物：`notes/03-agent-state.md`。

### 4. Agent Loop

打开 `packages/agent/src/agent-loop.ts`，按顺序阅读 `agentLoop()`、`runAgentLoop()`、`runLoop()`、`streamAssistantResponse()`。

在 `runLoop()` 中标出外层 follow-up 循环和内层 tool/steering 循环；标出 stop、error、aborted、toolCall、`shouldStopAfterTurn` 和 `prepareNextTurn` 分支。

完成标准：不用源码可以写出“user -> model -> tool? -> toolResult -> model”的伪代码。

产物：`notes/04-agent-loop.md`。

### 5. 工具 Runtime

在 `agent-loop.ts` 定位 `prepareToolCall()`、`executeToolCallsSequential()`、`executeToolCallsParallel()`、`shouldTerminateToolBatch()`。打开 `packages/coding-agent/examples/sdk/05-tools.ts` 对照工具配置。

完成标准：解释工具不存在、参数错误、执行异常、并行执行、结果排序和 terminate 的行为。

产物：`notes/05-tool-runtime.md`。

### 6. 事件协议

打开 `packages/ai/src/types.ts` 查看 `AssistantMessageEvent`；打开 `packages/agent/src/types.ts` 查看 `AgentEvent`。用实验中的事件 logger 记录普通回答、工具回答、工具错误和 abort。

完成标准：能区分 provider 增量事件和 Agent 生命周期事件，并画出两条事件序列。

产物：`notes/06-events.md`。

### 7. 模型边界

打开 `packages/ai/src/compat.ts` 的 `streamSimple()`，再看 `packages/ai/src/providers/faux.ts` 的 faux stream。只对照一个真实 provider，不扩读全部 provider。

完成标准：说明 `AgentMessage[]` 如何变成 provider 的 `Context`，provider 差异如何在 ai 层被隐藏。

产物：`notes/07-model-boundary.md`。

### 8. Session、Context、Compaction

打开 `packages/coding-agent/src/core/session-manager.ts`、`messages.ts`、`system-prompt.ts`，搜索 `compact` 和 `compaction`。建立 Session History、Model Context、Tool Result、Compaction Summary、Project Resource 的边界图。

完成标准：创建两个独立 session 的实验通过，保存和恢复实验能解释 model、thinking level、messages 的恢复来源。

产物：`notes/08-context-session.md`。

### 9. AgentHarness

打开 `packages/agent/src/harness/types.ts` 和 `packages/agent/src/harness/agent-harness.ts`，先看 `AgentHarness.create()`、lane、operation、run、close；再按关键词查 `packages/agent/docs/harness_zh.md`。

完成标准：能说清 Agent、AgentSession、AgentHarness 各自新增了什么能力，不把产品组装和通用恢复机制混为一谈。

产物：`notes/09-agent-harness.md`。

### 10. 自有 Harness

打开 `source-study/my-harness.ts` 和对应测试。观察它如何包装 `AgentSession`，而不修改 `packages/agent/src/agent-loop.ts`：事件日志通过 subscribe，危险工具通过 beforeToolCall，Skill 通过纯过滤函数，Session 通过独立实例隔离。

完成标准：测试覆盖 prompt、工具策略、事件日志、Skill 过滤和两个 session 的隔离。

产物：`notes/10-my-harness.md`。

## 运行实验

在仓库根目录执行：

```powershell
node node_modules/vitest/dist/cli.js --run --config packages/coding-agent/vitest.config.ts source-study/test/source-study.test.ts
```

测试完全使用内存 session 和 faux stream，不需要真实 provider 或 API key。

## 阅读记录模板

每个笔记至少包含：

```text
入口函数：
输入状态：
修改状态：
发出事件：
下一步调用：
一个源码证据：文件:行号
一个实验结果：
仍不确定的问题：
```

## 最终判断

只有当你能从 `createAgentSession()` 追到 `streamSimple()`，并能用实验解释 toolResult、事件顺序、session 隔离和权限拦截时，才算完成主线。TUI、全部 provider 和完整规格文档不属于第一轮必读范围。
