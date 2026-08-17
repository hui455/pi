# @earendil-works/pi-agent-core

支持工具执行与事件流式输出的有状态 Agent。基于 `@earendil-works/pi-ai` 构建。

## 安装

```bash
npm install @earendil-works/pi-agent-core
```

### SQLite 会话后端

SQLite 会话后端及 `node:sqlite` 适配器位于独立的包 `@earendil-works/pi-session-backend-sqlite-node` 中，这样核心包默认不会引入运行时内建模块或原生 SQLite 依赖。该后端接受运行时特定的 SQLite 工厂，未来其他会话后端也可以作为独立包发布。

## 快速开始

```typescript
import { Agent } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";

const models = createModels();
models.setProvider(anthropicProvider());
const model = models.getModel("anthropic", "claude-sonnet-4-6");
if (!model) throw new Error("Model not found");

const agent = new Agent({
  initialState: {
    systemPrompt: "You are a helpful assistant.",
    model,
  },
  streamFn: models.streamSimple.bind(models),
});

agent.subscribe((event) => {
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    // Stream just the new text chunk
    process.stdout.write(event.assistantMessageEvent.delta);
  }
});

await agent.prompt("Hello!");
```

## 核心概念

### AgentMessage 与 LLM Message

Agent 使用 `AgentMessage` 这一灵活类型，它可以包含：
- 标准 LLM 消息（`user`、`assistant`、`toolResult`）
- 通过声明合并（declaration merging）扩展的自定义应用消息类型

LLM 只理解 `user`、`assistant` 和 `toolResult`。`convertToLlm` 函数通过在进行每次 LLM 调用前过滤并转换消息来弥合这一差距。

### 消息流转

```
AgentMessage[] → transformContext() → AgentMessage[] → convertToLlm() → Message[] → LLM
                    (optional)                           (required)
```

1. **transformContext**：裁剪旧消息、注入外部上下文
2. **convertToLlm**：过滤掉仅用于 UI 的消息，将自定义类型转换为 LLM 格式

## 事件流转

Agent 会发出用于 UI 更新的事件。理解事件顺序有助于构建响应式界面。

### prompt() 事件序列

当你调用 `prompt("Hello")` 时：

```
prompt("Hello")
├─ agent_start
├─ turn_start
├─ message_start   { message: userMessage }      // Your prompt
├─ message_end     { message: userMessage }
├─ message_start   { message: assistantMessage } // LLM starts responding
├─ message_update  { message: partial... }       // Streaming chunks
├─ message_update  { message: partial... }
├─ message_end     { message: assistantMessage } // Complete response
├─ turn_end        { message, toolResults: [] }
└─ agent_end       { messages: [...] }
```

### 带工具调用

如果助手调用了工具，循环会继续：

```
prompt("Read config.json")
├─ agent_start
├─ turn_start
├─ message_start/end  { userMessage }
├─ message_start      { assistantMessage with toolCall }
├─ message_update...
├─ message_end        { assistantMessage }
├─ tool_execution_start  { toolCallId, toolName, args }
├─ tool_execution_update { partialResult }           // If tool streams
├─ tool_execution_end    { toolCallId, result }
├─ message_start/end  { toolResultMessage }
├─ turn_end           { message, toolResults: [toolResult] }
│
├─ turn_start                                        // Next turn
├─ message_start      { assistantMessage }           // LLM responds to tool result
├─ message_update...
├─ message_end
├─ turn_end
└─ agent_end
```

工具执行模式可配置：

- `parallel`（默认）：顺序预检工具调用，并发执行被允许的工具，每个工具完成后尽快发出 `tool_execution_end`，然后按助手来源顺序发出 toolResult 消息和 `turn_end.toolResults`
- `sequential`：逐个执行工具调用，与历史行为一致

在并行模式下，工具完成事件按工具完成顺序触发，但持久化的 toolResult 消息仍按助手来源顺序排列。

模式可以在 agent 配置中通过 `toolExecution` 全局设置，也可以通过 `AgentTool` 上的 `executionMode` 按工具设置。如果某个批次中的任何工具调用指向带 `executionMode: "sequential"` 的工具，则整个批次都按顺序执行，而不论全局设置如何。

`beforeToolCall` 钩子在 `tool_execution_start` 之后、参数校验解析完成后运行。它可以阻止执行，并给被阻止的结果附加 `terminate: true`。`afterToolCall` 钩子在工具执行结束后、`tool_execution_end` 与最终工具结果消息事件发出之前运行。

工具、被阻止的 `beforeToolCall` 结果以及 `afterToolCall` 覆盖值都可以返回 `terminate: true`，提示应跳过自动的后续 LLM 调用。只有当该批次中每个已完成的工具结果都设置了 `terminate: true` 时，循环才会提前停止。混合批次会正常继续。

`Agent` 类在 `AgentOptions` 中接受 `shouldStopAfterTurn`。底层循环调用方可以在 `AgentLoopConfig` 中设置同样的钩子：

```typescript
const stream = agentLoop(
  prompts,
  context,
  {
    model,
    convertToLlm,
    shouldStopAfterTurn: async ({ message, toolResults, context, newMessages }) => {
      return shouldCompactBeforeNextTurn(context.messages);
    },
  },
  undefined,
  models.streamSimple.bind(models),
);
```

`shouldStopAfterTurn` 在 `turn_end` 发出之后、助手响应及任何工具执行都正常完成之后运行。如果它返回 `true`，循环会在轮询 steering 或后续队列之前、以及启动下一次 LLM 调用之前发出 `agent_end` 并退出。它不会中止提供商流、不会取消正在运行的工具、也不会改变助手消息的停止原因。`AgentOptions` 中的回调还会把当前运行的 `AbortSignal` 作为第二个参数。

使用 `Agent` 类时，助手的 `message_end` 处理被视为工具预检开始前的一道屏障。这意味着 `beforeToolCall` 看到的 agent 状态已经包含请求该工具调用的助手消息。

### continue() 事件序列

`continue()` 从现有上下文继续，不添加新消息。用于出错后的重试。

```typescript
// After an error, retry from current state
await agent.continue();
```

上下文中的最后一条消息必须是 `user` 或 `toolResult`（不能是 `assistant`）。

### 事件类型

| 事件 | 描述 |
|-------|-------------|
| `agent_start` | Agent 开始处理 |
| `agent_end` | 运行的最终事件。此事件的被等待订阅者仍计入结算（settlement） |
| `turn_start` | 新轮次开始（一次 LLM 调用 + 工具执行） |
| `turn_end` | 轮次以助手消息和工具结果完成 |
| `message_start` | 任意消息开始（user、assistant、toolResult） |
| `message_update` | **仅 assistant。** 包含带增量的 `assistantMessageEvent` |
| `message_end` | 消息完成 |
| `tool_execution_start` | 工具开始 |
| `tool_execution_update` | 工具流式输出进度 |
| `tool_execution_end` | 工具完成 |

`Agent.subscribe()` 的监听器按注册顺序被等待。`agent_end` 表示不会再发出循环事件，但 `await agent.waitForIdle()` 和 `await agent.prompt(...)` 只会在被等待的 `agent_end` 监听器完成之后才结算。

## Agent 选项

```typescript
const agent = new Agent({
  // Initial state
  initialState: {
    systemPrompt: string,
    model: Model<any>,
    thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max",
    tools: AgentTool<any>[],
    messages: AgentMessage[],
  },

  // Convert AgentMessage[] to LLM Message[] (required for custom message types)
  convertToLlm: (messages) => messages.filter(...),

  // Transform context before convertToLlm (for pruning, compaction)
  transformContext: async (messages, signal) => pruneOldMessages(messages),

  // Steering mode: "one-at-a-time" (default) or "all"
  steeringMode: "one-at-a-time",

  // Follow-up mode: "one-at-a-time" (default) or "all"
  followUpMode: "one-at-a-time",

  // Required stream function
  streamFn: models.streamSimple.bind(models),

  // Session ID for provider caching
  sessionId: "session-123",

  // Dynamic API key resolution (for expiring OAuth tokens)
  getApiKey: async (provider) => refreshToken(),

  // Tool execution mode: "parallel" (default) or "sequential"
  toolExecution: "parallel",

  // Preflight each tool call after args are validated. Can block execution.
  beforeToolCall: async ({ toolCall, args, context }) => {
    if (toolCall.name === "bash") {
      return { block: true, reason: "bash is disabled", terminate: true };
    }
  },

  // Postprocess each tool result before final tool events are emitted.
  afterToolCall: async ({ toolCall, result, isError, context }) => {
    if (toolCall.name === "notify_done" && !isError) {
      return { terminate: true };
    }
    if (!isError) {
      return { details: { ...result.details, audited: true } };
    }
  },

  // Stop gracefully after a completed turn, before queued messages are polled.
  shouldStopAfterTurn: async ({ context }, signal) => {
    return shouldCompactBeforeNextTurn(context.messages, signal);
  },

  // Custom thinking budgets for token-based providers
  thinkingBudgets: {
    minimal: 128,
    low: 512,
    medium: 1024,
    high: 2048,
  },
});
```

## Agent 状态

```typescript
interface AgentState {
  systemPrompt: string;
  model: Model<any>;
  thinkingLevel: ThinkingLevel;
  tools: AgentTool<any>[];
  messages: AgentMessage[];
  readonly isStreaming: boolean;
  readonly streamingMessage?: AgentMessage;
  readonly pendingToolCalls: ReadonlySet<string>;
  readonly errorMessage?: string;
}
```

通过 `agent.state` 访问状态。

给 `agent.state.tools = [...]` 或 `agent.state.messages = [...]` 赋值时，会先复制顶层数组再存储。对返回的数组进行修改会改变当前 agent 状态。

流式输出期间，`agent.state.streamingMessage` 包含当前的部分助手消息。

`agent.state.isStreaming` 在运行完全结算（包括被等待的 `agent_end` 订阅者）之前一直为 `true`。

## 方法

### 提示（Prompting）

```typescript
// Text prompt
await agent.prompt("Hello");

// With images
await agent.prompt("What's in this image?", [
  { type: "image", data: base64Data, mimeType: "image/jpeg" }
]);

// AgentMessage directly
await agent.prompt({ role: "user", content: "Hello", timestamp: Date.now() });

// Continue from current context (last message must be user or toolResult)
await agent.continue();
```

### 状态管理

```typescript
agent.state.systemPrompt = "New prompt";
agent.state.model = getModel("openai", "gpt-4o");
agent.state.thinkingLevel = "medium";
agent.state.tools = [myTool];
agent.toolExecution = "sequential";
agent.beforeToolCall = async ({ toolCall }) => undefined;
agent.afterToolCall = async ({ toolCall, result }) => undefined;
agent.shouldStopAfterTurn = async ({ context }) => shouldCompactBeforeNextTurn(context.messages);
agent.state.messages = newMessages; // top-level array is copied
agent.state.messages.push(message);
agent.reset();
```

### 会话与思考预算

```typescript
agent.sessionId = "session-123";

agent.thinkingBudgets = {
  minimal: 128,
  low: 512,
  medium: 1024,
  high: 2048,
};
```

### 控制

```typescript
agent.abort();           // Cancel current operation
await agent.waitForIdle(); // Wait for completion
```

### 事件

```typescript
const unsubscribe = agent.subscribe(async (event, signal) => {
  if (event.type === "agent_end") {
    // Final barrier work for the run
    await flushSessionState(signal);
  }
});
unsubscribe();
```

## Steering 与 Follow-up

Steering 消息让你在工具运行期间打断 Agent。Follow-up 消息让你在 Agent 本会停止之后排队后续工作。

```typescript
agent.steeringMode = "one-at-a-time";
agent.followUpMode = "one-at-a-time";

// While agent is running tools
agent.steer({
  role: "user",
  content: "Stop! Do this instead.",
  timestamp: Date.now(),
});

// After the agent finishes its current work
agent.followUp({
  role: "user",
  content: "Also summarize the result.",
  timestamp: Date.now(),
});

const steeringMode = agent.steeringMode;
const followUpMode = agent.followUpMode;

agent.clearSteeringQueue();
agent.clearFollowUpQueue();
agent.clearAllQueues();
```

使用 clearSteeringQueue、clearFollowUpQueue 或 clearAllQueues 丢弃已排队的消息。

当一轮结束后检测到 steering 消息时：
1. 当前助手消息中的所有工具调用都已结束
2. 注入 steering 消息
3. LLM 在下一轮响应

仅当不再有工具调用且没有 steering 消息时，才检查 follow-up 消息。如果有已排队的消息，则注入它们并再运行一轮。

## 自定义消息类型

通过声明合并扩展 `AgentMessage`：

```typescript
declare module "@earendil-works/pi-agent-core" {
  interface CustomAgentMessages {
    notification: { role: "notification"; text: string; timestamp: number };
  }
}

// Now valid
const msg: AgentMessage = { role: "notification", text: "Info", timestamp: Date.now() };
```

在 `convertToLlm` 中处理自定义类型：

```typescript
const agent = new Agent({
  streamFn: models.streamSimple.bind(models),
  convertToLlm: (messages) => messages.flatMap(m => {
    if (m.role === "notification") return []; // Filter out
    return [m];
  }),
});
```

## 工具

使用 `AgentTool` 定义工具：

```typescript
import { Type } from "typebox";

const readFileTool: AgentTool = {
  name: "read_file",
  label: "Read File",  // For UI display
  description: "Read a file's contents",
  parameters: Type.Object({
    path: Type.String({ description: "File path" }),
  }),
  // Override execution mode for this tool (optional).
  // "sequential" forces the entire batch to run one at a time.
  // "parallel" allows concurrent execution with other tool calls.
  // If omitted, the global toolExecution config applies.
  executionMode: "sequential",
  execute: async (toolCallId, params, signal, onUpdate) => {
    const content = await fs.readFile(params.path, "utf-8");

    // Optional: stream progress
    onUpdate?.({ content: [{ type: "text", text: "Reading..." }], details: {} });

    // Optional: add `terminate: true` here to skip the automatic follow-up LLM call
    // when every finalized tool result in the batch does the same.
    return {
      content: [{ type: "text", text: content }],
      details: { path: params.path, size: content.length },
    };
  },
};

agent.state.tools = [readFileTool];
```

### 错误处理

工具失败时**抛出异常**。不要以 content 形式返回错误消息。

```typescript
execute: async (toolCallId, params, signal, onUpdate) => {
  if (!fs.existsSync(params.path)) {
    throw new Error(`File not found: ${params.path}`);
  }
  // Return content only on success
  return { content: [{ type: "text", text: "..." }] };
}
```

被抛出的异常由 Agent 捕获，并以 `isError: true` 作为工具错误报告给 LLM。

从 `execute()`、被阻止的 `beforeToolCall` 或 `afterToolCall` 返回 `terminate: true`，提示 Agent 应在当前工具批次后停止。只有当批次中每个已完成的工具结果都是终止性时才会生效。该提示仅作用于运行时；发出的 `toolResult` 转录消息仍是标准 LLM 工具结果。

## 代理使用（Proxy）

适用于通过后端代理的浏览器应用：

```typescript
import { Agent, streamProxy } from "@earendil-works/pi-agent-core";

const agent = new Agent({
  streamFn: (model, context, options) =>
    streamProxy(model, context, {
      ...options,
      authToken: "...",
      proxyUrl: "https://your-server.com",
    }),
});
```

## 底层 API

需要不经过 Agent 类的直接控制时：

```typescript
import { agentLoop, agentLoopContinue } from "@earendil-works/pi-agent-core";

const context: AgentContext = {
  systemPrompt: "You are helpful.",
  messages: [],
  tools: [],
};

const config: AgentLoopConfig = {
  model: getModel("openai", "gpt-4o"),
  convertToLlm: (msgs) => msgs.filter(m => ["user", "assistant", "toolResult"].includes(m.role)),
  toolExecution: "parallel",  // overridden by per-tool executionMode if set
  beforeToolCall: async ({ toolCall, args, context }) => undefined,
  afterToolCall: async ({ toolCall, result, isError, context }) => undefined,
};

const userMessage = { role: "user", content: "Hello", timestamp: Date.now() };

const streamFn = models.streamSimple.bind(models);
for await (const event of agentLoop([userMessage], context, config, undefined, streamFn)) {
  console.log(event.type);
}

// Continue from existing context
for await (const event of agentLoopContinue(context, config, undefined, streamFn)) {
  console.log(event.type);
}
```

这些底层流是观察性的。它们保持事件顺序，但不会等你的异步事件处理结算后再继续后续的生产阶段。如果需要消息处理在工具预检前充当屏障，请使用 `Agent` 类，而不是裸的 `agentLoop()` 或 `agentLoopContinue()`。

## 许可证

MIT
