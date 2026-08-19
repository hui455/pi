# Pi 源码学习指南

本文面向第一次阅读 `pi-mono` 源码的开发者。目标不是把所有文件读完，而是先建立一条可以反复验证的主线：

```text
用户输入
  -> CLI / SDK
  -> AgentSession
  -> Agent
  -> Agent Loop
  -> pi-ai
  -> 模型提供商
  -> 流式事件
  -> 工具执行
  -> 下一轮模型调用
  -> TUI / Print / RPC 输出
```

Pi 是一个 monorepo，核心能力分布在多个 package 中：

| Package | 作用 | 学习重点 |
| --- | --- | --- |
| `packages/ai` | 统一 LLM 和多家模型提供商接口 | 消息类型、流式输出、工具调用、provider 适配 |
| `packages/agent` | 通用有状态 Agent 运行时 | Agent 状态、Agent Loop、事件、工具执行 |
| `packages/coding-agent` | 面向终端编码场景的产品层 | 会话、认证、工具、扩展、压缩、CLI |
| `packages/tui` | 终端 UI 框架 | 组件、布局、键盘输入、差异化渲染 |
| `packages/protocol` | RPC 或跨进程通信协议 | 事件和命令的序列化 |
| `packages/client` / `packages/server` | 客户端和服务端封装 | 远程运行和集成 |

---

## 一、先建立整体认识

### 1. Pi 的分层

可以把 Pi 看成四层：

```text
应用层       coding-agent
运行时层     agent
模型层       ai
展示层       tui
```

`packages/agent` 不应该知道终端界面长什么样；它只负责维护消息、调用模型、执行工具和发出事件。

`packages/coding-agent` 把通用 Agent 运行时组装成一个可使用的编码助手：读取项目资源、选择模型、加载扩展、创建默认工具、保存会话。

`packages/tui` 只关心如何把事件显示出来，以及如何把键盘输入转换成应用事件。

这个分层是阅读 Pi 的关键。遇到一个行为时，先问：它属于模型适配、Agent 运行时、产品组装，还是 UI？这样可以快速缩小搜索范围。

### 2. 一次普通请求的调用链

以用户输入：

```text
读取 package.json，然后告诉我项目使用什么技术栈
```

为例，核心链路如下：

1. `packages/coding-agent/src/main.ts` 解析命令行参数并创建运行环境。
2. `packages/coding-agent/src/core/sdk.ts` 的 `createAgentSession()` 创建模型运行时、资源加载器、会话管理器和 `Agent`。
3. 交互模式将输入交给 `AgentSession.prompt()`。
4. `AgentSession` 更新系统提示词、当前模型、工具和扩展上下文，然后调用底层 `Agent`。
5. `packages/agent/src/agent.ts` 的 `Agent.prompt()` 将字符串转换成 user message。
6. `packages/agent/src/agent-loop.ts` 启动 Agent Loop。
7. Agent Loop 调用 `convertToLlm()`，把应用消息转换成模型能理解的 `Message[]`。
8. Agent Loop 通过 `streamFn` 调用 `pi-ai` 的 `streamSimple()`。
9. `packages/ai/src/compat.ts` 根据模型选择具体 provider。
10. provider 解析 SSE 或 WebSocket 流，并统一转换成 Pi 的增量事件。
11. 如果模型返回文本，事件直接交给 UI；如果返回 tool call，Agent Loop 校验参数并执行工具。
12. 工具结果被追加到上下文，然后进入下一轮模型调用。
13. 没有新的工具调用后，Agent Loop 发出 `agent_end`，上层保存会话并更新 UI。

建议第一次阅读时只跟踪这条链，不要同时研究所有 provider、扩展和 TUI 细节。

---

## 二、环境准备

Pi 要求 Node.js `22.19.0` 或更高版本。进入 `pi` 目录执行：

```powershell
cd C:\Users\Administrator\Desktop\agent-lab\pi
npm install --ignore-scripts
npm run build:offline
```

`build:offline` 使用仓库里已有的模型数据，适合源码阅读和没有网络模型目录刷新条件的环境。

检查代码：

```powershell
npm run check
```

按仓库规则，普通源码修改后运行 `npm run check`。不要一开始运行完整测试套件；它包含可能依赖真实 provider 的测试。非 e2e 测试可以使用：

```powershell
.\test.sh
```

源码运行入口：

```powershell
.\pi-test.sh
```

如果只想观察非交互输出，可以使用 print 或 JSON 模式。具体参数查看：

```powershell
.\pi-test.sh --help
```

学习源码时优先使用 faux provider 或测试 harness，避免依赖真实 API key 和付费模型调用。

---

## 三、第一阶段：先读 `pi-ai`

### 1. 先读类型，而不是 provider 实现

推荐顺序：

1. [`packages/ai/src/types.ts`](packages/ai/src/types.ts)
2. [`packages/ai/src/models.ts`](packages/ai/src/models.ts)
3. [`packages/ai/src/models-store.ts`](packages/ai/src/models-store.ts)
4. [`packages/ai/src/compat.ts`](packages/ai/src/compat.ts)
5. [`packages/ai/src/utils/event-stream.ts`](packages/ai/src/utils/event-stream.ts)

先回答这些问题：

- `UserMessage`、`AssistantMessage`、`ToolResultMessage` 分别表示什么？
- assistant 的 content 为什么是数组，而不是单个字符串？
- `ToolCall` 包含哪些字段？工具参数什么时候还是字符串，什么时候已经解析成对象？
- `AssistantMessageEvent` 如何表示文本增量和工具调用增量？
- `Context`、`Model`、`StreamFunction` 的边界在哪里？

### 2. 理解 `streamSimple()` 的职责

[`packages/ai/src/compat.ts`](packages/ai/src/compat.ts) 的 `streamSimple()` 是一个重要的分发层：

```text
streamSimple(model, context, options)
  -> 根据 model.provider / model.api 找 provider
  -> 加入认证信息和请求选项
  -> 调用 provider.streamSimple()
  -> 返回统一的 AssistantMessageEventStream
```

它的价值是：Agent 层不需要知道 Anthropic、OpenAI、Google 的请求格式差异。

### 3. 只选一个真实 provider 深入

不要一次阅读所有 provider。建议先选 OpenAI 兼容接口：

[`packages/ai/src/api/openai-completions.ts`](packages/ai/src/api/openai-completions.ts)

重点追踪：

```text
构造 request body
  -> 发起 HTTP 请求
  -> 解析 SSE
  -> 处理 text delta
  -> 处理 tool call delta
  -> 合并部分 JSON 参数
  -> 发出 message_end
```

读完后再对比 Anthropic：

[`packages/ai/src/api/anthropic-messages.ts`](packages/ai/src/api/anthropic-messages.ts)

你会看到 Pi 的统一抽象解决的是同一个问题：不同 provider 的流式事件协议不同，但上层需要稳定的事件模型。

---

## 四、第二阶段：读 `pi-agent-core`

### 1. `Agent` 是有状态的外壳

从 [`packages/agent/src/agent.ts`](packages/agent/src/agent.ts) 开始。

`Agent` 主要负责：

- 保存当前 `AgentState`
- 接收字符串或结构化消息
- 启动和停止一次运行
- 管理 steering 和 follow-up 队列
- 暴露事件订阅接口
- 把配置传入底层 Agent Loop
- 维护工具执行前后的钩子

先读这些方法：

- `constructor()`
- `subscribe()`
- `prompt()`
- `continue()`
- `steer()`
- `followUp()`
- `runPromptMessages()`

不要先研究所有 compaction 和扩展逻辑。先弄清楚一次运行怎样开始和结束。

### 2. `agent-loop.ts` 是核心状态机

重点文件：

[`packages/agent/src/agent-loop.ts`](packages/agent/src/agent-loop.ts)

推荐阅读顺序：

1. `agentLoop()`
2. `runAgentLoop()`
3. `runLoop()`
4. 模型调用部分
5. 工具准备和执行部分
6. `shouldStopAfterTurn`
7. 错误和 abort 处理

一个简化后的循环是：

```text
加入 user message
  -> 发出 agent_start / turn_start
  -> 转换上下文
  -> 调用模型
  -> 收集 assistant 流式事件
  -> assistant 是否包含 tool call？
       ├─ 否：turn_end -> agent_end
       └─ 是：
            校验工具和参数
            -> beforeToolCall
            -> 执行工具
            -> afterToolCall
            -> 写入 toolResult
            -> 下一轮模型调用
```

### 3. 事件顺序要自己画出来

普通文本回答：

```text
agent_start
turn_start
message_start(user)
message_end(user)
message_start(assistant)
message_update(text_delta)
message_update(text_delta)
message_end(assistant)
turn_end
agent_end
```

包含工具调用：

```text
agent_start
turn_start
message_start/end(user)
message_start/update/end(assistant with toolCall)
tool_execution_start
tool_execution_update      # 工具支持流式输出时才有
tool_execution_end
message_start/end(toolResult)
turn_start
message_start/update/end(assistant)
turn_end
agent_end
```

理解事件顺序后，TUI、RPC、日志和测试就会变成不同的事件消费者，而不是不同的 Agent 实现。

---

## 五、第三阶段：读工具调用

建议用一个具体问题来追踪：

> 模型决定调用 `read` 工具后，工具参数从 JSON 字符串到文件内容，中间经过了哪些步骤？

阅读路径：

1. `packages/agent/src/types.ts` 中的 `AgentTool`、`AgentToolCall`、`AgentToolResult`
2. `packages/agent/src/agent-loop.ts` 中的工具准备、校验和执行函数
3. `packages/coding-agent/src/core/tools/` 下的内置工具
4. `packages/coding-agent/src/core/agent-session.ts` 中的工具注册和钩子安装

要特别区分三种东西：

- **工具定义**：发送给模型的 name、description、参数 schema
- **工具调用**：模型返回的 name、id、arguments
- **工具结果**：工具执行后的 content、details、isError、terminate

Pi 支持多个工具调用并行执行。阅读时关注：

- 参数校验是并行前还是执行前？
- 为什么工具结果仍需要按 assistant 原始顺序写回上下文？
- `beforeToolCall` 阻止工具后，后续模型调用是否继续？
- 工具返回 `terminate: true` 时，Agent Loop 如何结束？

---

## 六、第四阶段：读 `coding-agent` 的组装逻辑

### 1. 从 SDK 开始

重点文件：

[`packages/coding-agent/src/core/sdk.ts`](packages/coding-agent/src/core/sdk.ts)

`createAgentSession()` 做的事情很多，但可以按四组理解：

```text
环境       cwd、agentDir、设置、项目资源
模型       ModelRuntime、认证、默认模型
会话       SessionManager、历史消息、分支
Agent      Agent、工具、system prompt、扩展钩子
```

读代码时可以在 `createAgentSession()` 里标记这四类变量。不要试图一次理解每个配置项。

### 2. 再读 `AgentSession`

重点文件：

[`packages/coding-agent/src/core/agent-session.ts`](packages/coding-agent/src/core/agent-session.ts)

主要关注：

- `prompt()` 如何准备一次请求
- 如何从会话恢复历史消息
- 如何更新 system prompt
- 如何启用或禁用 `read`、`write`、`edit`、`bash`
- 如何监听 Agent 事件并持久化 session entry
- 上下文过长时如何触发 compaction
- 扩展如何介入 provider 请求和工具调用

`AgentSession` 是产品层和通用 Agent 层之间的适配器，是理解 Pi 功能为何这么多的关键文件。

### 3. 最后读 CLI 和交互模式

入口文件：

- [`packages/coding-agent/src/main.ts`](packages/coding-agent/src/main.ts)
- `packages/coding-agent/src/modes/print-mode.ts`
- `packages/coding-agent/src/modes/rpc/`
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`

`main.ts` 负责解析参数、处理认证和创建 runtime；真正的业务操作大多已经下沉到 SDK 和 `AgentSession`。

交互模式则主要是事件消费者：它订阅 `AgentSessionEvent`，把消息、工具调用、错误和状态转换成 TUI 组件。

---

## 七、建议的动手实验

### 实验 1：只打印 Agent 事件

创建一个临时 TypeScript 文件，使用 `Agent` 和 faux provider，打印每一个 event type：

```typescript
agent.subscribe((event) => {
  console.log(event.type);
});

await agent.prompt("Hello");
```

目标：验证普通回答的事件顺序。

### 实验 2：加入一个假的工具

让 faux provider 返回一个 tool call，工具只返回固定字符串：

```text
tool_execution_start
tool_execution_end
toolResult
下一次 assistant 响应
```

目标：确认工具结果如何进入下一次模型上下文。

### 实验 3：让工具报错

分别测试：

- 工具参数 JSON 无法解析
- 工具不存在
- 工具执行抛出异常
- 工具返回 `isError: true`
- 工具返回 `terminate: true`

目标：区分“工具执行失败”和“Agent Loop 自身失败”。

### 实验 4：测试 steering 和 follow-up

在模型第一次响应或工具执行期间加入：

```typescript
agent.steer({ /* message */ });
agent.followUp({ /* message */ });
```

观察二者进入上下文的时机。核心区别是：steering 用于当前运行过程中的引导，follow-up 用于当前运行本来要结束后再追加消息。

### 实验 5：比较不同输出模式

分别运行 interactive、print 和 RPC 模式，比较它们是否共享同一个 Agent 运行时，以及差异发生在哪一层。

目标：理解“核心逻辑复用，输出适配分离”的设计。

---

## 八、如何高效搜索源码

不要按文件名随机浏览，优先从符号和事件搜索：

```powershell
rg -n "agentLoop|runAgentLoop|streamSimple|tool_execution_start|message_update" packages
```

查一个函数的调用关系：

```powershell
rg -n "createAgentSession\(|AgentSession\.prompt|agent\.prompt" packages
```

查某个事件在哪里发出、在哪里消费：

```powershell
rg -n "tool_execution_end" packages/agent packages/coding-agent
```

阅读每个函数时都记录三件事：

1. 输入状态是什么？
2. 修改了哪些状态？
3. 发出了哪些事件，下一步由谁消费？

这比只记函数名称更容易形成可复用的心智模型。

---

## 九、推荐的七天路线

### 第 1 天：模型层

读 `ai/src/types.ts`、`models.ts`、`compat.ts`。画出 `streamSimple()` 的接口。

### 第 2 天：流式协议

读一个 provider，弄清楚 SSE/WebSocket 事件如何变成 Pi 的统一事件。

### 第 3 天：Agent 状态

读 `agent.ts`，理解 `state.messages`、`isStreaming`、工具和队列。

### 第 4 天：Agent Loop

读 `agent-loop.ts`，画普通回答和工具调用两条事件时序图。

### 第 5 天：coding-agent 组装

读 `sdk.ts` 和 `agent-session.ts`，弄清模型、工具、资源和会话如何拼起来。

### 第 6 天：会话与上下文

读 `session-manager.ts`、compaction 相关代码、system prompt 和资源加载器。

### 第 7 天：扩展与 UI

读 extensions、interactive mode 和 TUI。尝试写一个最小扩展或自定义工具。

---

## 十、常见误区

### 误区 1：从 `main.ts` 第一行读到最后一行

`main.ts` 包含 CLI、认证、升级、模式选择等大量边界逻辑，不能代表 Agent 核心。先读 `agent`，再回来看 `main`。

### 误区 2：把 `AgentMessage` 当作模型消息

`AgentMessage` 可以包含 UI 消息、扩展消息和内部状态；真正发送给模型前还要经过 `transformContext()` 和 `convertToLlm()`。

### 误区 3：只看最终文本，不看增量事件

Pi 的交互体验、工具调用显示、RPC 输出都依赖事件流。必须理解 `message_update` 和 tool call delta。

### 误区 4：一开始研究所有 provider

先深入一个 provider，再比较差异。否则会把协议差异误认为 Agent 逻辑差异。

### 误区 5：忽略测试和 faux provider

测试是最短的行为说明。特别是 `packages/agent/test`、`packages/ai/test` 和 faux provider，适合在没有真实 API 的情况下验证理解。

---

## 十一、读完后的自测问题

如果下面的问题还不能回答，说明主线还没有完全掌握：

1. `Agent.prompt("hello")` 最终在哪一行触发 provider 请求？
2. `AgentMessage` 为什么不能直接全部发送给 LLM？
3. provider 返回的文本增量最终由哪个事件承载？
4. 模型返回工具调用后，参数在哪里校验？
5. 工具结果为什么会触发下一轮模型请求？
6. `AgentSession` 和 `Agent` 的职责边界是什么？
7. interactive、print、RPC 三种模式共享了哪些代码？
8. 上下文压缩发生在 Agent Loop 之前、之后，还是 session 层？
9. 如何在不修改 Agent 核心的情况下增加一个工具？
10. 如何使用 faux provider 写一个不需要真实 API key 的回归测试？

一个合格的学习结果不是“看过所有文件”，而是能够从一个用户行为反向追踪完整调用链，并能在合适的层加入新功能。

---

## 十二、推荐的下一步实践

完成主线阅读后，建议按以下顺序做小改动：

1. 增加一个只读自定义工具。
2. 写一个事件日志扩展，记录每次模型调用和工具执行耗时。
3. 给一个工具增加 `beforeToolCall` 拦截逻辑。
4. 为某个事件序列补一个 faux provider 测试。
5. 增加一个简单的 print-mode 输出格式。
6. 最后再尝试修改 TUI 组件。

每次只改一个层次，并运行对应的检查。这样可以把“读懂源码”转化成对架构边界的实际理解。
